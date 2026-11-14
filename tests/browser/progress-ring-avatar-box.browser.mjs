#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-progress-ring around an sf-avatar (owner decision C152 (8); DEV GB5
// answers, 2026-11-15). The avatar's box is the ring's middle box at every
// size and density, its initials take their size from that box and stay
// inside it, and the presence point, placed from the avatar's edge, stands on
// the middle of the line at 45 degrees. Group build 5 measured a size 1/3
// avatar in a ring of 1/2 20.52 px wide in a 16 px compact middle (the point
// 4.7 px off the line) and in a 20 px phone middle (0.4 px off). Measured on
// the built bytes at 1440, 1440 compact and 390 (a touch phone at 3x).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const RINGS = [
  ['ring-1', '', '1/2', 'Анна Белова'],
  ['ring-2', '2', '1', 'Иван Петров'],
  ['ring-3', '3', '2', 'Иван Петров'],
  ['ring-12', '1/2', '1/3', 'Иван Петров'],
  ['ring-12-one', '1/2', '1/3', 'Шамиль'],
];
const markup = RINGS.map(([id, size, avatar, name]) => `<sf-progress-ring id="${id}"${size ? ` size="${size}"` : ''} value="40" label="Загрузка"><sf-avatar slot="content" size="${avatar}" heading="${name}" hue="auto" status="online"></sf-avatar></sf-progress-ring>`).join('\n');

const browser = await chromium.launch();
try {
  for (const [width, density, dpr, theme] of [[1440, '', 1, 'light'], [1440, 'compact', 1, 'light'], [390, '', 3, 'light'], [390, '', 3, 'dark']]) {
    const context = await browser.newContext({viewport: {width, height: 700}, deviceScaleFactor: dpr, isMobile: width < 768, hasTouch: width < 768});
    await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"${density ? ` data-sf-density="${density}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/css/core.css">
      <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
      <script type="module" src="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/js/core.js"></script></head>
      <body style="margin:16px; display:flex; gap:24px; flex-wrap:wrap">${markup}</body></html>`}));
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    const view = `${width} ${density || 'normal'} ${theme}`;
    page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction((count) => document.querySelectorAll('.sf-progress-ring .sf-online-indicator').length === count, RINGS.length, {timeout: 15000});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const rings = await page.evaluate((ids) => ids.map((id) => {
      const host = document.getElementById(id);
      const ring = host.querySelector('.sf-progress-ring').getBoundingClientRect();
      const middle = host.querySelector('.sf-progress-ring-content').getBoundingClientRect();
      const avatar = host.querySelector('.sf-avatar');
      const box = avatar.getBoundingClientRect();
      const point = host.querySelector('.sf-online-indicator').getBoundingClientRect();
      const line = parseFloat(getComputedStyle(host.querySelector('.sf-progress-ring')).getPropertyValue('--sf-progress-ring--line-width'));
      const text = [...avatar.querySelectorAll('*'), avatar].flatMap((element) => [...element.childNodes]).find((node) => node.nodeType === 3 && node.textContent.trim());
      const range = document.createRange();
      if (text) range.selectNodeContents(text);
      const ink = text ? range.getBoundingClientRect() : null;
      const dx = point.left + point.width / 2 - (ring.left + ring.width / 2);
      const dy = point.top + point.height / 2 - (ring.top + ring.height / 2);
      return {id, ring: ring.width, middle: middle.width, box: [box.width, box.height], letters: text?.textContent.trim(), ink: ink ? ink.width : 0,
        font: parseFloat(getComputedStyle(avatar).fontSize), off: Math.hypot(dx, dy) - (ring.width / 2 - line / 2), angle: Math.atan2(dy, dx) * 180 / Math.PI};
    }), RINGS.map(([id]) => id));
    for (const ring of rings) {
      const where = `${view} ${ring.id}`;
      if (Math.abs(ring.box[0] - ring.middle) > 0.05 || Math.abs(ring.box[1] - ring.middle) > 0.05) failures.push({view: where, name: 'the avatar box is the middle box', box: ring.box, middle: ring.middle});
      if (ring.ink > ring.middle + 0.05) failures.push({view: where, name: 'the initials stay inside the middle box', ink: ring.ink, middle: ring.middle});
      if (ring.font > ring.middle / 2 + 0.01) failures.push({view: where, name: 'the initials are at most half the middle box', font: ring.font, middle: ring.middle});
      if (Math.abs(ring.off) > 0.1) failures.push({view: where, name: 'the presence point stands on the middle of the line', off: ring.off});
      if (Math.abs(ring.angle - 45) > 0.5) failures.push({view: where, name: 'the presence point stands at 45 degrees', angle: ring.angle});
    }
    console.log(JSON.stringify({view, rings: rings.map((ring) => ({...ring, off: +ring.off.toFixed(3), angle: +ring.angle.toFixed(2), ink: +ring.ink.toFixed(2)}))}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`progress-ring avatar box: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('progress-ring avatar box: pass');
