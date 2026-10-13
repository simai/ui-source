#!/usr/bin/env node
// Browser acceptance for SF.Position on the remaining anchored surfaces:
// Country code list, tooltip (arrow-driven side, mirrored arrow on flip) and
// horizontal menu flyouts (below, then to the inline end; flip at the edge).
// Usage: PLAYWRIGHT_MODULE=… node position-surfaces.browser.mjs <lab> <distr> <smart-root> <output-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = [];
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const warnings = [];
page.on('console', (message) => {
  if (message.type() === 'error' && !/favicon|flag/i.test(message.text())) errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});

async function load({ width, dir, scenario, only }) {
  await page.setViewportSize({ width, height: 700 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.evaluate(({ scenario, only }) => {
    const stage = document.getElementById('stage');
    for (const child of stage.children) child.style.display = child.id === only ? '' : 'none';
    stage.style.top = scenario === 'bottom' ? `${innerHeight - 70}px` : scenario === 'top' ? '4px' : '200px';
    if (scenario === 'edge') stage.style.justifyContent = 'flex-end';
  }, { scenario, only });
}
const rect = (selector) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null; }, selector);
const inside = (r, width) => r && r.left >= -1 && r.right <= width + 1 && r.top >= -1 && r.bottom <= 701;

for (const width of [1280, 390]) {
  for (const dir of ['ltr', 'rtl']) {
    // Country code: below by default, above near the bottom, inside at the edge.
    for (const scenario of ['top', 'bottom', 'edge']) {
      await load({ width, dir, scenario, only: 'country' });
      await page.evaluate(() => document.querySelector('#country .sf-country-code-left').click());
      await page.waitForTimeout(350);
      const list = await rect('#country .sf-country-code-list'); const field = await rect('#country .sf-country-code-field');
      const label = `country ${scenario} ${dir} ${width}`; observations.push({ label, list, field });
      check(list && list.height > 0, `${label}: list opens`, list);
      if (!list) continue;
      check(inside(list, width), `${label}: list stays inside the viewport`, { list });
      if (scenario === 'bottom') check(list.bottom <= field.top + 1, `${label}: list flips above the field`, { list, field });
      else check(list.top >= field.bottom - 1, `${label}: list opens below the field`, { list, field });
    }
    // Tooltip: the bottom arrow puts it above; at the top it flips below with a mirrored arrow.
    for (const scenario of ['middle', 'top', 'edge']) {
      await load({ width, dir, scenario, only: 'tip' });
      await page.focus('#tip button');
      await page.waitForTimeout(300);
      const tip = await rect('#tip .sf-tooltip'); const anchor = await rect('#tip');
      const arrow = await page.evaluate(() => document.querySelector('#tip .sf-tooltip').className.match(/sf-tooltip--arrow-([a-z-]+)/)?.[1]);
      const label = `tooltip ${scenario} ${dir} ${width}`; observations.push({ label, tip, anchor, arrow });
      check(tip && tip.width > 0, `${label}: tooltip shows`, tip);
      if (!tip) continue;
      check(inside(tip, width), `${label}: tooltip stays inside the viewport`, { tip });
      if (scenario === 'middle') {
        check(tip.bottom <= anchor.top + 1 && arrow === 'bottom-center', `${label}: tooltip sits above with a bottom arrow`, { tip, anchor, arrow });
        const centre = (anchor.left + anchor.right) / 2;
        const fitsCentred = centre - tip.width / 2 >= 8 && centre + tip.width / 2 <= width - 8;
        if (fitsCentred) check(Math.abs((tip.left + tip.right) / 2 - centre) <= 2, `${label}: tooltip is centred on its trigger`, { tip, anchor });
        // Centred or shifted, the tail points at the middle of the trigger.
        const tail = await rect('#tip .sf-tooltip-tail');
        check(tail && Math.abs((tail.left + tail.right) / 2 - centre) <= 2, `${label}: tail points at the trigger`, { tail, anchor });
      }
      if (scenario === 'top') check(tip.top >= anchor.bottom - 1 && arrow === 'top-center', `${label}: tooltip flips below and mirrors its arrow`, { tip, anchor, arrow });
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      const restored = await page.evaluate(() => document.querySelector('#tip .sf-tooltip').className.includes('sf-tooltip--arrow-bottom-center'));
      check(restored, `${label}: authored arrow is restored after closing`, null);
    }
    // Smart <sf-tooltip>: the rendered box inside the display:contents host is positioned.
    for (const scenario of ['middle', 'top']) {
      await load({ width, dir, scenario, only: 'stip' });
      await page.focus('#stip button');
      await page.waitForTimeout(400);
      const tip = await rect('#stip sf-tooltip .sf-tooltip'); const anchor = await rect('#stip button');
      const label = `smart-tooltip ${scenario} ${dir} ${width}`; observations.push({ label, tip, anchor });
      check(tip && tip.width > 0 && inside(tip, width), `${label}: tooltip shows inside the viewport`, { tip });
      if (!tip) continue;
      if (scenario === 'middle') check(tip.bottom <= anchor.top + 1, `${label}: tooltip sits above its trigger`, { tip, anchor });
      if (scenario === 'top') check(tip.top >= anchor.bottom - 1, `${label}: tooltip flips below its trigger`, { tip, anchor });
    }
    // Menu: first level below, nested to the inline end, flipped at the inline-end edge.
    for (const scenario of ['top', 'edge']) {
      await load({ width, dir, scenario, only: 'nav' });
      await page.evaluate(() => document.querySelector('#catalog > .sf-menu-element').click());
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelector('#products > .sf-menu-element').click());
      await page.waitForTimeout(300);
      const item = await rect('#catalog'); const first = await rect('#catalog > .sf-menu');
      const nestedItem = await rect('#products'); const nested = await rect('#products > .sf-menu');
      const label = `menu ${scenario} ${dir} ${width}`; observations.push({ label, item, first, nestedItem, nested });
      check(first && first.top >= item.bottom - 1, `${label}: first flyout opens below its item`, { item, first });
      check(inside(first, width) && inside(nested, width), `${label}: flyouts stay inside the viewport`, { first, nested });
      const endSide = dir === 'rtl' ? nested.right <= nestedItem.left + 1 : nested.left >= nestedItem.right - 1;
      const startSide = dir === 'rtl' ? nested.left >= nestedItem.right - 1 : nested.right <= nestedItem.left + 1;
      check(endSide || startSide || width < 700, `${label}: nested flyout opens beside its item`, { nestedItem, nested });
      if (scenario === 'top' && width >= 1280) check(endSide, `${label}: nested flyout prefers the inline end`, { nestedItem, nested });
      if (scenario === 'edge' && width >= 1280) check(startSide, `${label}: nested flyout flips to the inline start at the edge`, { nestedItem, nested });
      await page.screenshot({ path: resolve(outputDir, `menu-${scenario}-${dir}-${width}.png`) });
    }
  }
}

await browser.close();
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, cases: observations.length };
writeFileSync(resolve(outputDir, 'position-surfaces-browser.json'), `${JSON.stringify({ ...result, observations }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failureCount: failures.length, failures: failures.slice(0, 6), errors: errors.slice(0, 5) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
