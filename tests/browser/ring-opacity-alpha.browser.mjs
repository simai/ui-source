#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS. ring + ring-opacity-N must draw the ring at the strength
// the ladder step names (ring-opacity-5 is 0.5, full is 1, 0 is 0), for the
// default, hover, focus and focus-visible variants, in a light and in a dark
// theme. Until 2026-11-15 the utility wrote the opacity token (a percentage)
// into a channel the ring multiplies by 100%, so the box-shadow was invalid and
// no ring was drawn at all. The former channel --sf-ring--alfa a page sets keeps
// drawing until 2027-01-01 (journal token-ring-alpha-spelling).
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'utility/utility/ring-width/default/css/default.css',
  'utility/utility/ring-color/default/css/default.css',
  'utility/utility/ring-opacity/default/css/default.css',
  'utility/utility/ring-opacity/hover/css/hover.css',
  'utility/utility/ring-opacity/focus/css/focus.css',
  'utility/utility/ring-opacity/focus-visible/css/focus-visible.css',
].map((p) => join(out, p));

const ladder = [['0', 0], ['1', 0.1], ['2', 0.2], ['3', 0.3], ['4', 0.4], ['5', 0.5], ['6', 0.6], ['7', 0.7], ['8', 0.8], ['9', 0.9], ['full', 1]];

const box = (id, classes, style = '') => `<button type="button" id="${id}" class="${classes}"${style ? ` style="${style}"` : ''}>${id}</button>`;
const html = (theme) => `<!doctype html><html class="theme-${theme}"><body>
  ${ladder.map(([n]) => box(`d-${n}`, `ring-2 ring-primary ring-opacity-${n}`)).join('\n  ')}
  ${ladder.map(([n]) => box(`h-${n}`, `ring-2 ring-primary hover:ring-opacity-${n}`)).join('\n  ')}
  ${ladder.map(([n]) => box(`f-${n}`, `ring-2 ring-primary focus:ring-opacity-${n}`)).join('\n  ')}
  ${ladder.map(([n]) => box(`v-${n}`, `ring-2 ring-primary focus-visible:ring-opacity-${n} focus-visible`)).join('\n  ')}
  ${box('plain', 'ring-2 ring-primary')}
  ${box('former', 'ring-2 ring-primary', '--sf-ring--alfa: 0.5')}
  ${box('both', 'ring-2 ring-primary ring-opacity-3', '--sf-ring--alfa: 0.5')}
</body></html>`;

// Chromium serialises a colour that came out of color-mix() as color(srgb …).
const alpha = (colour) => {
  const match = /^(?:rgba?|color|oklab|oklch|lab|lch|hsla?)\(([^)]+)\)$/u.exec(String(colour).trim());
  if (!match) return null;
  const slash = match[1].split('/');
  if (slash.length > 1) return Number(slash[1].trim());
  // color(srgb r g b) names its colour space first.
  const parts = match[1].split(/[,\s]+/u).filter(Boolean).filter((part) => !/^[a-z]/u.test(part));
  return parts.length > 3 ? Number(parts[3]) : 1;
};
// The ring is the first layer of the box-shadow; an invalid ring leaves "none".
const ringAlpha = (shadow) => {
  const colour = /^(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\))/u.exec(String(shadow).trim())?.[1];
  return colour ? alpha(colour) : null;
};

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
    const shadowOf = (id) => page.evaluate((x) => getComputedStyle(document.getElementById(x)).boxShadow, id);
    // The primary role colour's own alpha: the ring multiplies it.
    const base = ringAlpha(await shadowOf('plain'));
    if (base === null) failures.push(`${theme}: ring-2 ring-primary draws no ring (${await shadowOf('plain')})`);
    const check = (label, shadow, want) => {
      const got = ringAlpha(shadow);
      const expected = Math.round(want * (base ?? 1) * 1000) / 1000;
      const ok = got !== null && Math.abs(got - expected) < 0.005;
      rows.push({theme, label, expected, got, ok});
      if (!ok) failures.push(`${theme}: ${label} ring alpha ${got} (box-shadow ${shadow}), expected ${expected}`);
    };
    for (const [n, want] of ladder) check(`ring-opacity-${n}`, await shadowOf(`d-${n}`), want);
    for (const [n, want] of ladder) {
      await page.hover(`#h-${n}`);
      check(`hover:ring-opacity-${n}`, await shadowOf(`h-${n}`), want);
    }
    await page.mouse.move(0, 0);
    for (const [n, want] of ladder) {
      await page.focus(`#f-${n}`);
      check(`focus:ring-opacity-${n}`, await shadowOf(`f-${n}`), want);
    }
    await page.evaluate(() => document.activeElement?.blur());
    for (const [n, want] of ladder) check(`focus-visible:ring-opacity-${n}`, await shadowOf(`v-${n}`), want);
    check('former --sf-ring--alfa: 0.5', await shadowOf('former'), 0.5);
    check('ring-opacity-3 over a former 0.5', await shadowOf('both'), 0.3);
    if (errors.length) failures.push(`${theme}: console ${errors.join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (process.env.RING_OPACITY_ROWS) process.stdout.write(`${JSON.stringify(rows)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ring-opacity alpha: ${rows.length} reads, light and dark, all at the ladder step`);
