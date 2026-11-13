#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Two docs precheck fixes measured in ordinary markup with the Loader, where
// a unit test of the template had passed while the page did not change
// (content acceptance 2026-11-11, D1 and D2):
//
// - SK-01: <sf-skeleton kind="circle"> and kind="square" with no width of
//   their own draw equal sides (the size step's height), in normal flow and
//   in a flex row; the setting's default width, 100 %, is not a width of its
//   own. A text skeleton keeps the row's width.
// - TB-04: sf-tabs type="full" with a tab drawn by a component of the page's
//   own (setData component) stretches that tab like its neighbour: the two
//   tabs share the row within a pixel.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {serveOutput, head, coreScript} from '../../scripts/first-paint-lib.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const body = `
  <section id="flow" style="inline-size: 600px">
    <sf-skeleton id="circle" kind="circle"></sf-skeleton>
    <sf-skeleton id="square" kind="square"></sf-skeleton>
    <sf-skeleton id="ignored" kind="circle" width="64px"></sf-skeleton>
    <sf-skeleton id="text" kind="text"></sf-skeleton>
  </section>
  <section id="row" style="display: flex; gap: 12px; inline-size: 600px; align-items: center">
    <sf-skeleton id="row-circle" kind="circle"></sf-skeleton>
    <sf-skeleton id="row-text" kind="text"></sf-skeleton>
  </section>
  <sf-tabs id="full" type="full" aria-label="Разделы"></sf-tabs>
  <script>
    customElements.whenDefined('sf-tabs').then(async () => {
      const tabs = document.getElementById('full');
      await tabs.updateComplete;
      tabs.setData({
        tabs: [{label: 'Обзор', component: {type: 'sf-button', props: {text: 'Обзор'}}}, {label: 'История'}],
        panels: [{text: 'Первая.'}, {text: 'Вторая.'}],
      });
    });
  </script>`;
const pages = new Map([['/acceptance', `${head({title: 'acceptance', sheets: ['/distr/core/css/core.css'], extra: coreScript})}<body>${body}</body></html>`]]);

const failures = [];
let measured = 0;
const site = await serveOutput(out, {pages});
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({viewport: {width, height: 900}, colorScheme});
      const page = await context.newPage();
      await page.goto(`${site.origin}/acceptance`, {waitUntil: 'load'});
      await page.waitForFunction(() => document.querySelectorAll('#full [role="tab"]').length === 2
        && [...document.querySelectorAll('sf-skeleton')].every((one) => one.querySelector('.sf-skeleton')), null, {timeout: 20000});
      await page.waitForTimeout(400);
      const read = await page.evaluate(() => {
        const box = (element) => {
          const rect = element.getBoundingClientRect();
          return [Math.round(rect.width * 100) / 100, Math.round(rect.height * 100) / 100];
        };
        const shape = (id) => {
          const root = document.querySelector(`#${id} .sf-skeleton`);
          const item = root.querySelector('[class*="sf-skeleton-"]') || root;
          return box(item);
        };
        return {
          skeleton: Object.fromEntries(['circle', 'square', 'ignored', 'text', 'row-circle', 'row-text'].map((id) => [id, shape(id)])),
          tabs: [...document.querySelectorAll('#full [role="tab"]')].map(box),
        };
      });
      await context.close();
      measured += 1;
      const where = `${width} ${colorScheme}`;
      for (const id of ['circle', 'square', 'ignored', 'row-circle']) {
        const [w, h] = read.skeleton[id];
        if (!(h > 0) || Math.abs(w - h) > 0.5) failures.push(`${where}: ${id} is ${w}x${h}, not equal sides`);
      }
      if (read.skeleton.text[0] < 500) failures.push(`${where}: the text skeleton is ${read.skeleton.text[0]} wide, not the row`);
      const [first, second] = read.tabs.map(([w]) => w);
      if (Math.abs(first - second) > 1) failures.push(`${where}: type=full tabs ${first} and ${second} wide`);
    }
  }
} finally {
  await browser.close();
  await site.close();
}
console.log(JSON.stringify({measured, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
