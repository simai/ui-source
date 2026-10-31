#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// .sf-card on the built sheets, light and dark, 1280 and 390 px: a hairline
// edge in the outline-variant role on the page surface, the surface radius,
// space-2 inside, the blocks in one column one text gap apart with their own
// margins taken off; sf-card--plain has no fill, no edge and no padding; a
// long word wraps inside the card instead of widening the page.
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const sheets = ['core/core/css/core.css', 'component/component/card/css/card.css'].map((path) => readFileSync(join(out, path), 'utf8'));
const html = `<div class="sf-card" id="card"><h4 id="title">Portable project</h4><p id="text">Markdown and JSON stay next to the code.</p><p>${'Unbreakable'.repeat(12)}</p></div>
<div class="sf-card sf-card--plain" id="plain" style="margin-top:16px"><h4>Plain</h4><p>No surface.</p></div>`;
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const where = `${theme} ${width}`;
      const page = await browser.newPage({viewport: {width, height: 700}});
      await page.setContent(`<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px">${html}</body></html>`);
      for (const content of sheets) await page.addStyleTag({content});
      const state = await page.evaluate(() => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const resolve = (value) => { probe.style.cssText = `width:${value}`; return getComputedStyle(probe).width; };
        const color = (value) => { probe.style.cssText = `color:${value}`; return getComputedStyle(probe).color; };
        const card = getComputedStyle(document.getElementById('card'));
        const plain = getComputedStyle(document.getElementById('plain'));
        const title = document.getElementById('title').getBoundingClientRect();
        const text = document.getElementById('text').getBoundingClientRect();
        return {
          border: card.borderTopWidth, borderColor: card.borderTopColor, outline: color('var(--sf-outline-variant)'),
          background: card.backgroundColor, surface: (() => { probe.style.cssText = 'background-color:var(--sf-surface-0)'; return getComputedStyle(probe).backgroundColor; })(),
          radius: card.borderTopLeftRadius, surfaceRadius: resolve('var(--sf-radius--surface)'),
          padding: card.paddingTop, paddingInline: card.paddingLeft, space2: resolve('var(--sf-space-2)'),
          gap: Math.round(text.top - title.bottom), textGap: parseFloat(resolve('var(--sf-content--space-text)')),
          titleMargin: getComputedStyle(document.getElementById('title')).marginTop,
          plain: {border: plain.borderTopColor, background: plain.backgroundColor, padding: plain.paddingTop},
          scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        };
      });
      seen[where] = state;
      const check = (ok, said) => { if (!ok) failures.push({where, said, state}); };
      check(state.border === '1px' && state.borderColor === state.outline, 'a 1 px edge in outline-variant');
      check(state.background === state.surface, 'the page surface fill');
      check(state.radius === state.surfaceRadius, 'the surface radius');
      check(state.padding === state.space2 && state.paddingInline === state.space2, 'space-2 inside');
      check(Math.abs(state.gap - state.textGap) <= 1 && state.titleMargin === '0px', 'one text gap between blocks, their margins off');
      check(state.plain.padding === '0px' && /, 0\)$/u.test(state.plain.background) && /, 0\)$/u.test(state.plain.border), 'plain: no fill, no edge, no padding');
      check(state.scrollWidth <= state.viewport, 'nothing wider than the window');
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(seen['light 1280']));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('CARD_OK');
