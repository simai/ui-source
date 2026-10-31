#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// .sf-figure on the built sheets, light and dark, 1280 and 390 px: without a
// ratio the box is the image's own proportion; each named ratio holds its
// box (1x1, 4x3, 3x2, 16x9, 21x9) and the image covers it, or stands whole in
// it with sf-figure--contain; the box clips to the surface radius; the caption
// is the small text in on-surface-variant; nothing is wider than the window.
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const sheets = ['core/core/css/core.css', 'component/component/figure/css/figure.css'].map((path) => readFileSync(join(out, path), 'utf8'));
// A 2:1 picture, inline, so nothing waits on the network.
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#1e5aa8"/></svg>')}`;
const RATIOS = {'1x1': 1, '4x3': 4 / 3, '3x2': 3 / 2, '16x9': 16 / 9, '21x9': 21 / 9};
const figure = (id, classes, caption = '') => `<figure class="sf-figure ${classes}" id="${id}"><div class="sf-figure-media"><img src="${image}" alt="" width="800" height="400"></div>${caption}</figure>`;
const html = [
  figure('auto', '', '<figcaption class="sf-figure-caption" id="caption">A caption under the picture.</figcaption>'),
  ...Object.keys(RATIOS).map((ratio) => figure(`r${ratio}`, `sf-figure--ratio-${ratio}`)),
  figure('contain', 'sf-figure--ratio-1x1 sf-figure--contain'),
].join('');
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const where = `${theme} ${width}`;
      const page = await browser.newPage({viewport: {width, height: 900}});
      await page.setContent(`<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px"><div style="max-width:640px;display:flex;flex-direction:column;gap:16px">${html}</div></body></html>`);
      for (const content of sheets) await page.addStyleTag({content});
      await page.waitForFunction(() => [...document.images].every((img) => img.complete));
      const state = await page.evaluate((ratios) => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const resolve = (property, value) => { probe.style.cssText = `${property}:${value}`; return getComputedStyle(probe)[property]; };
        const media = (id) => document.querySelector(`#${id} .sf-figure-media`);
        const box = (node) => node.getBoundingClientRect();
        const caption = getComputedStyle(document.getElementById('caption'));
        return {
          auto: box(media('auto')).width / box(media('auto')).height,
          ratios: Object.fromEntries(Object.keys(ratios).map((ratio) => [ratio, {box: box(media(`r${ratio}`)).width / box(media(`r${ratio}`)).height, fit: getComputedStyle(media(`r${ratio}`).firstElementChild).objectFit, fills: Math.abs(box(media(`r${ratio}`).firstElementChild).height - box(media(`r${ratio}`)).height) < 1}])),
          contain: getComputedStyle(media('contain').firstElementChild).objectFit,
          radius: getComputedStyle(media('auto')).borderTopLeftRadius, surfaceRadius: resolve('width', 'var(--sf-radius--surface)'),
          overflow: getComputedStyle(media('auto')).overflow,
          caption: {color: caption.color, role: resolve('color', 'var(--sf-on-surface-variant)'), size: caption.fontSize, small: resolve('width', 'var(--sf-text-size-1\\/2)')},
          margin: getComputedStyle(document.getElementById('auto')).marginLeft,
          scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        };
      }, RATIOS);
      seen[where] = state;
      const check = (ok, said) => { if (!ok) failures.push({where, said, state}); };
      check(Math.abs(state.auto - 2) < 0.02, 'without a ratio the box is the image\'s own 2:1');
      for (const [ratio, value] of Object.entries(RATIOS)) {
        const got = state.ratios[ratio];
        check(Math.abs(got.box - value) < 0.02 && got.fit === 'cover' && got.fills, `${ratio}: the box holds the ratio and the image covers it`);
      }
      check(state.contain === 'contain', 'sf-figure--contain keeps the image whole');
      check(state.radius === state.surfaceRadius && state.overflow === 'hidden', 'the box clips to the surface radius');
      check(state.caption.color === state.caption.role && state.caption.size === state.caption.small, 'the caption is small on-surface-variant text');
      check(state.margin === '0px', 'a figure has no page margin of its own');
      check(state.scrollWidth <= state.viewport, 'nothing wider than the window');
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(seen['light 390']));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIGURE_OK');
