#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The drawer's title and its content start on one inline axis, with the
// drawer's own gutter and with a wider one set through the gutter attribute,
// at full size on a phone and at a step on a desktop. Zero tolerance.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
let measured = 0;
const browser = await chromium.launch();
try {
  for (const [width, size] of [[390, 'full'], [1296, '1']]) {
    for (const gutter of ['', 'var(--sf-space-3)']) {
      const page = await browser.newPage({viewport: {width, height: 800}});
      await page.goto('about:blank');
      await page.addStyleTag({path: join(out, 'core', 'core', 'css', 'core.css')});
      await page.addStyleTag({path: join(out, 'smart', 'smart', 'drawer', 'css', 'drawer.css')});
      await page.addScriptTag({path: join(out, 'core', 'core', 'js', 'smart-base.js')});
      await page.addScriptTag({path: join(out, 'smart', 'smart', 'drawer', 'js', 'drawer.js')});
      const result = await page.evaluate(async ({size, gutter}) => {
        document.body.innerHTML = `<sf-drawer size="${size}" title="Invoice 42" open ${gutter ? `gutter="${gutter}"` : ''}><p>Body text</p></sf-drawer>`;
        await new Promise((settle) => setTimeout(settle, 700));
        const left = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const range = document.createRange();
          range.selectNodeContents(element);
          return Math.round(range.getBoundingClientRect().left * 100) / 100;
        };
        const panel = document.querySelector('.sf-drawer-panel').getBoundingClientRect();
        return {title: left('.sf-drawer-title'), body: left('.sf-drawer-body p'), panel: Math.round(panel.left * 100) / 100};
      }, {size, gutter});
      await page.close();
      measured += 1;
      const where = `${width}px size ${size}${gutter ? ` gutter ${gutter}` : ''}`;
      if (result.title === null || result.body === null) failures.push(`${where}: nothing rendered`);
      else if (result.title !== result.body) failures.push(`${where}: title at ${result.title}, content at ${result.body}`);
      if (result.title !== null && result.title <= result.panel) failures.push(`${where}: the title has no gutter`);
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({measured, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
