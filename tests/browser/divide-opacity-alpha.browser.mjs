#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS. divide-y-1 divide-primary divide-opacity-N must draw the
// line between children in the primary colour at the strength the ladder step
// names (divide-opacity-5 is 0.5, full is 1, 0 is 0), for both spellings
// (divide-opacity-N and the alias divider-opacity-N, C187 (4): the class
// retires through an alias and still draws until 2027-01-01), in a light and
// in a dark theme. Until 2026-11-15 the utility wrote the opacity token (a
// percentage) into a channel the divider colour multiplies by 100%, so the
// border-color was invalid at computed-value time and the line fell back to
// currentColor, the text colour.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'utility/utility/divider-width/default/css/default.css',
  'utility/utility/divider-style/default/css/default.css',
  'utility/utility/divider-color/default/css/default.css',
  'utility/utility/divider-opacity/default/css/default.css',
].map((p) => join(out, p));

const ladder = [['0', 0], ['1', 0.1], ['2', 0.2], ['3', 0.3], ['4', 0.4], ['5', 0.5], ['6', 0.6], ['7', 0.7], ['8', 0.8], ['9', 0.9], ['full', 1]];

// The text colour is set apart from the primary colour, so a line that fell
// back to currentColor cannot pass for a primary one.
const list = (id, classes) => `<div id="${id}" class="${classes}" style="color: rgb(0, 128, 0)"><p>one</p><p>two</p></div>`;
const html = (theme) => `<!doctype html><html class="theme-${theme}"><body>
  ${ladder.map(([n]) => list(`d-${n}`, `divide-y-1 divide-primary divide-opacity-${n}`)).join('\n  ')}
  ${ladder.map(([n]) => list(`a-${n}`, `divider-y-1 divider-primary divider-opacity-${n}`)).join('\n  ')}
  ${list('plain', 'divide-y-1 divide-primary')}
</body></html>`;

// Chromium serialises a colour that came out of color-mix() as color(srgb …).
const parse = (colour) => {
  const match = /^(rgba?|color)\(([^)]+)\)$/u.exec(String(colour).trim());
  if (!match) return null;
  const [channels, slash] = match[2].split('/');
  const numbers = channels.split(/[,\s]+/u).filter(Boolean).filter((part) => !/^[a-z]/u.test(part)).map(Number);
  const scale = match[1] === 'color' ? 255 : 1;
  const alpha = slash !== undefined ? Number(slash.trim()) : (numbers.length > 3 ? numbers[3] : 1);
  return {rgb: numbers.slice(0, 3).map((v) => Math.round(v * scale)), alpha};
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
    // The line is the top border of the second child.
    const lineOf = (id) => page.evaluate((x) => {
      const style = getComputedStyle(document.querySelector(`#${x} > p + p`));
      return {colour: style.borderTopColor, width: style.borderTopWidth, style: style.borderTopStyle};
    }, id);
    const plain = await lineOf('plain');
    const base = parse(plain.colour);
    if (!base || plain.width !== '1px' || plain.style !== 'solid') failures.push(`${theme}: divide-y-1 divide-primary draws no line (${JSON.stringify(plain)})`);
    const check = (label, line, want) => {
      const got = parse(line.colour);
      const expected = Math.round(want * (base?.alpha ?? 1) * 1000) / 1000;
      const sameHue = want === 0 || (got && base && got.rgb.every((v, i) => Math.abs(v - base.rgb[i]) <= 1));
      const ok = got !== null && Math.abs(got.alpha - expected) < 0.005 && sameHue && line.width === '1px';
      rows.push({theme, label, expected, got: got?.alpha ?? null, colour: line.colour, ok});
      if (!ok) failures.push(`${theme}: ${label} line ${line.colour} (${line.width} ${line.style}), expected the primary colour at ${expected}`);
    };
    for (const [n, want] of ladder) check(`divide-opacity-${n}`, await lineOf(`d-${n}`), want);
    for (const [n, want] of ladder) check(`divider-opacity-${n}`, await lineOf(`a-${n}`), want);
    if (errors.length) failures.push(`${theme}: console ${errors.join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (process.env.DIVIDE_OPACITY_ROWS) process.stdout.write(`${JSON.stringify(rows)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`divide-opacity alpha: ${rows.length} reads, light and dark, all at the ladder step`);
