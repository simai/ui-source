#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-pagination publishes its page row's box on :root (docs/docs.md, «The
// row's box»; standard simai.smart-component 1.3.10 §5.4), so a page can hold
// the room of a list and its pages before they draw. Measured on the built
// bytes with the Loader, at size 1/2 and 1: --sf-pagination-block-size-<step>
// is the row drawn on one line, a row of text alone (no pages) is as tall,
// and the docs' formula (2 x --sf-space-1 + the step's control height + 1px)
// gives the same length.
//
// The row measured 88 px at size 1 and 80 at 1/2 instead of 73 and 65 on a
// page that loaded the first paint's sheets in their listed order, a
// component sheet before core.css: the order of cascade layers is the order
// a page first meets their names. When the build declares the order in every
// sheet (ui-builder, a sheet opening with the `@layer sf.reset, ...;`
// statement), the listed order is measured too.
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {serveOutput, head, coreScript, repo} from '../../scripts/first-paint-lib.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const listed = JSON.parse(readFileSync(join(repo, 'src/smart/pagination/static/sheets.json'), 'utf8')).sheets;
const coreFirst = ['core/css/core.css', ...listed.filter((one) => one !== 'core/css/core.css')];
const declaresOrder = /^(?:@charset "[^"]*";\s*)?@layer sf\.reset,/u
  .test(readFileSync(join(out, 'component/component/pagination/css/pagination.min.css'), 'utf8'));

const rows = `
  <sf-pagination id="one" size="1" current="2" total="80" page-size="10" top="false" bottom="false"></sf-pagination>
  <sf-pagination id="half" size="1/2" current="2" total="80" page-size="10" top="false" bottom="false"></sf-pagination>
  <sf-pagination id="one-text" size="1" total="0" top="false" bottom="false"></sf-pagination>
  <sf-pagination id="half-text" size="1/2" total="0" top="false" bottom="false"></sf-pagination>`;
const orders = {'core.css first': coreFirst, ...(declaresOrder ? {'listed order': listed} : {})};
const pages = new Map(Object.entries(orders).map(([name, sheets], index) => [`/box/${index}`,
  `${head({title: name, sheets: sheets.map((one) => `/distr/${one}`), extra: coreScript})}<body><main id="stage" style="max-inline-size:1100px">${rows}</main></body></html>`]));

const failures = [];
const site = await serveOutput(out, {pages});
const browser = await chromium.launch();
try {
  for (const [index, name] of Object.keys(orders).entries()) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({viewport: {width, height: 900}});
      const page = await context.newPage();
      await page.goto(`${site.origin}/box/${index}`, {waitUntil: 'load'});
      await page.waitForFunction(() => [...document.querySelectorAll('sf-pagination')].every((one) => (one.isRendered ?? true) && one.querySelector('.sf-pagination-main')), null, {timeout: 20000});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const read = await page.evaluate(() => {
        const px = (value) => {
          const probe = document.createElement('div');
          probe.style.blockSize = value;
          document.body.append(probe);
          const length = probe.getBoundingClientRect().height;
          probe.remove();
          return length;
        };
        const drawn = (id) => document.querySelector(`#${id} .sf-pagination-main`).getBoundingClientRect().height;
        const step = (id) => (id.startsWith('half') ? '1\\/2' : '1');
        return ['one', 'half', 'one-text', 'half-text'].map((id) => ({
          id,
          drawn: drawn(id),
          published: px(`var(--sf-pagination-block-size-${step(id)})`),
          formula: px(`calc(2 * var(--sf-space-1) + var(--sf-ui-${step(id)}--control-height) + var(--sf-px))`),
        }));
      });
      for (const one of read) {
        // At a phone's width the row stands in a column, part under part: only
        // the row of text alone is one line there.
        if (width < 768 && !one.id.endsWith('-text')) continue;
        if (!(one.published > 0) || Math.abs(one.published - one.drawn) > 0.5) failures.push(`${name} @${width} ${one.id}: published ${one.published} px, drawn ${one.drawn} px`);
        if (Math.abs(one.formula - one.published) > 0.5) failures.push(`${name} @${width} ${one.id}: the docs' formula gives ${one.formula} px, published ${one.published} px`);
      }
      await context.close();
    }
  }
} catch (error) {
  failures.push(String(error.message ?? error).slice(0, 400));
} finally {
  await browser.close();
  await site.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`pagination published box: the page row at 1/2 and 1, with pages and with text alone, is what --sf-pagination-block-size-<step> says (${Object.keys(orders).join(', ')})`);
