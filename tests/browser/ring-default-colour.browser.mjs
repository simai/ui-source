#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS. A ring without a colour class draws in the focus role:
// ring-2 alone (and hover:ring-2, focus:ring-2) shows a ring of the colour
// --sf-focus--color resolves to where it is drawn, in a light and a dark
// theme. Core declared --sf-ring-color empty on the root, the utility's
// fallback never applied, the colour-mix() was invalid and ring-2 alone drew
// nothing (utilities pass 2026-11-17). A colour class still draws.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'utility/utility/ring-width/default/css/default.css',
  'utility/utility/ring-width/hover/css/hover.css',
  'utility/utility/ring-width/focus/css/focus.css',
  'utility/utility/ring-color/default/css/default.css',
].map((p) => join(out, p));

const html = (theme) => `<!doctype html><html class="theme-${theme}"><head><meta charset="utf-8"></head><body style="padding:16px">
  <button type="button" id="bare" class="ring-2">bare</button>
  <button type="button" id="hover" class="hover:ring-2">hover</button>
  <button type="button" id="focus" class="focus:ring-2">focus</button>
  <button type="button" id="primary" class="ring-2 ring-primary">primary</button>
  <span id="focus-role" style="color: var(--sf-focus--color)">focus role</span>
</body></html>`;

// The ring is the first layer of the box-shadow: its colour and spread.
const ring = (shadow) => {
  const colour = /^((?:rgba?|color|oklab|oklch)\([^)]*\))/u.exec(String(shadow).trim())?.[1] ?? null;
  return colour;
};
// Two colours as RGBA numbers in one canvas, so rgb() and color(srgb) compare.
const failures = [];
const rows = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent(html(theme));
    for (const path of css) await page.addStyleTag({path});
    const read = (id) => page.evaluate((x) => getComputedStyle(document.getElementById(x)).boxShadow, id);
    const same = (a, b) => page.evaluate(([x, y]) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const g = canvas.getContext('2d');
      const px = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data]; };
      const [p, q] = [px(x), px(y)];
      return p.every((v, i) => Math.abs(v - q[i]) <= 1);
    }, [a, b]);
    const roleOf = (id) => page.evaluate((x) => getComputedStyle(document.getElementById(x)).color, id);
    const focusRole = await roleOf('focus-role');
    const check = async (label, shadow, want) => {
      const colour = ring(shadow);
      const ok = colour !== null && await same(colour, want);
      rows.push({theme, label, shadow, want, ok});
      if (!ok) failures.push(`${theme}: ${label} draws ${colour === null ? 'no ring' : colour} (box-shadow ${shadow}), expected ${want}`);
    };
    await check('ring-2 alone', await read('bare'), focusRole);
    await page.hover('#hover');
    await check('hover:ring-2', await read('hover'), focusRole);
    await page.mouse.move(0, 0);
    await page.focus('#focus');
    await check('focus:ring-2', await read('focus'), focusRole);
    const primary = ring(await read('primary'));
    rows.push({theme, label: 'ring-2 ring-primary', shadow: primary});
    if (primary === null) failures.push(`${theme}: ring-2 ring-primary draws no ring`);
    if (errors.length) failures.push(`${theme}: console ${errors.join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(rows));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RING_DEFAULT_COLOUR_OK');
