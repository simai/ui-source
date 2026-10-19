#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Text on a container fill reads, on the built bytes, in both themes: every
// text in the components below -- each lays --sf-surface-container under its
// content -- holds 4.5:1 against what it actually lies on, the translucent
// fill composited over the page. Dimmed text there measured 4.0:1 in the
// dark theme until the container carried its own dimmed role (effects-gallery
// theme audit and a crawl of the documentation, 2026-10-19).
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const SHEETS = ['core/core/css/core.css', ...['avatars', 'tags', 'alerts', 'accordion', 'kbd', 'file-preview']
  .map((name) => `component/component/${name}/css/${name}.css`),
  'utility/utility/background-color/default/css/default.css', 'utility/utility/text-color/default/css/default.css'];
const MARKUP = `
  <span class="sf-avatar sf-avatar--text sf-avatar--size-2">АБ</span>
  <span class="sf-tag sf-tag--size-1 sf-tag--default"><span class="sf-tag-text">Метка</span></span>
  <div class="sf-alert sf-alert--neutral sf-alert--default"><div class="sf-alert-wrap"><p class="sf-alert-text" style="color: var(--sf-on-surface-variant)">Вторичный текст сообщения</p></div></div>
  <div class="sf-accordion"><div class="sf-accordion-content" style="color: var(--sf-on-surface-variant)">Содержимое аккордеона</div></div>
  <kbd class="sf-kbd" style="color: var(--sf-on-surface-variant)">Ctrl</kbd>
  <span class="sf-tag sf-tag--size-1 sf-tag--avatar"><span class="sf-avatar sf-avatar--text sf-avatar--size-1/3">ВГ</span><span class="sf-tag-text">Тег с аватаром</span></span>
  <div class="bg-surface-2" style="padding:12px"><span class="bg-surface-container color-on-surface-variant">Утилита на поверхности 2</span>
    <span class="sf-tag sf-tag--size-1 sf-tag--default"><span class="sf-tag-text">Тег на поверхности 2</span></span></div>`;

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['theme-light', 'theme-dark']) {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:var(--sf-surface-0);display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">${MARKUP}</body></html>`);
    for (const sheet of SHEETS) await page.addStyleTag({content: readFileSync(join(out, sheet), 'utf8')});
    const low = await page.evaluate(() => {
      const parse = (value) => { const m = value.match(/rgba?\(([^)]+)\)/u); if (!m) return null; const p = m[1].split(/[ ,/]+/u).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
      const channel = (value) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
      const over = (top, bottom) => ({r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1});
      const found = [];
      for (const element of document.querySelectorAll('body *')) {
        if (![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
        const layers = [];
        for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
          const fill = parse(getComputedStyle(node).backgroundColor);
          if (fill && fill.a > 0) { layers.push(fill); if (fill.a >= 1) break; }
        }
        let ground = layers.length && layers[layers.length - 1].a >= 1 ? layers.pop() : parse(getComputedStyle(document.body).backgroundColor);
        for (let index = layers.length - 1; index >= 0; index -= 1) ground = over(layers[index], ground);
        const text = over(parse(getComputedStyle(element).color), ground);
        const [a, b] = [luminance(text), luminance(ground)];
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 4.5) found.push({text: element.textContent.trim().slice(0, 30), ratio: Math.round(ratio * 100) / 100});
      }
      return found;
    });
    if (low.length) failures.push({theme, low});
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('CONTAINER_TEXT_CONTRAST_OK');
