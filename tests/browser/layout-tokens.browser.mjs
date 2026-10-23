#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The layout tokens (simai/ui-source#25, the ui-chat kit), resolved from the
// built core.css: --sf-layout-reading-width is 48rem (768px at 16px) and the
// floating panel 400 x 680px, in the light and the dark theme, and they follow
// the root font size (rem).
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  for (const [theme, font] of [['light', 16], ['dark', 16], ['light', 20]]) {
    await page.setContent(`<!doctype html><html lang="ru" class="theme-${theme}" style="font-size:${font}px"><head><meta charset="utf-8"></head><body></body></html>`);
    await page.addStyleTag({path: join(out, 'core/core/css/core.css')});
    const sizes = await page.evaluate(() => {
      const measure = (inline, block) => {
        const box = document.createElement('div');
        box.style.cssText = `position:absolute;inline-size:${inline};block-size:${block}`;
        document.body.append(box);
        const rect = box.getBoundingClientRect();
        box.remove();
        return [rect.width, rect.height];
      };
      return {
        reading: measure('var(--sf-layout-reading-width)', '0')[0],
        panel: measure('var(--sf-layout-floating-panel-width)', 'var(--sf-layout-floating-panel-height)'),
        capped: measure('min(var(--sf-layout-floating-panel-width), 100vi - 2 * var(--sf-space-2))', '0')[0],
      };
    });
    const key = `${theme} ${font}px`;
    evidence[key] = sizes;
    const scale = font / 16;
    check(`${key}: the reading column is 48rem`, sizes.reading === 768 * scale, sizes);
    check(`${key}: the floating panel is 25rem x 42.5rem`, sizes.panel[0] === 400 * scale && sizes.panel[1] === 680 * scale, sizes);
    check(`${key}: the documented cap keeps the panel's size when there is room`, sizes.capped === 400 * scale, sizes);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('LAYOUT_TOKENS_OK');
