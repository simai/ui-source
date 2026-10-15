#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The final shape before the code (owner, 2026-10-15; rules of the road, rule
// 5), measured on the built core sheet: an element not defined yet that names
// a shape with data-sf-skeleton takes that shape's room and shows its bars;
// once defined, it is the element's own again, with no bars left.
import {resolve, join} from 'node:path';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0">
    <sf-probe-rows id="rows" data-sf-skeleton="rows" style="--sf-skeleton-rows:5"></sf-probe-rows>
    <sf-probe-record id="record" data-sf-skeleton="record"></sf-probe-record>
    <sf-probe-menu id="menu" data-sf-skeleton="menu"></sf-probe-menu>
    <sf-probe-block id="block" data-sf-skeleton="block" style="--sf-skeleton-block-size:120px"></sf-probe-block>
    <sf-probe-line id="line" data-sf-skeleton="line"></sf-probe-line>
    <div id="plain" data-sf-skeleton="rows"></div>
  </body></html>`);
  await page.addStyleTag({content: readFileSync(join(out, 'core/core/css/core.css'), 'utf8')});
  const before = await page.evaluate(() => Object.fromEntries(['rows', 'record', 'menu', 'block', 'line', 'plain'].map((id) => {
    const node = document.getElementById(id);
    const style = getComputedStyle(node);
    return [id, {height: Math.round(node.getBoundingClientRect().height), painted: style.backgroundImage !== 'none'}];
  })));
  for (const id of ['rows', 'record', 'menu', 'block', 'line']) {
    if (!before[id].painted || before[id].height < 16) failures.push({case: `«${id}» takes its room and shows its bars`, got: before[id]});
  }
  if (before.block.height !== 120) failures.push({case: 'a block is as tall as it says', got: before.block});
  if (before.rows.height < 5 * 40) failures.push({case: 'five rows take five rows of room', got: before.rows});
  if (before.plain.painted) failures.push({case: 'only a custom element not defined yet is a placeholder', got: before.plain});
  // Defined: the element's own again.
  const after = await page.evaluate(() => {
    customElements.define('sf-probe-rows', class extends HTMLElement {});
    const node = document.getElementById('rows');
    return {painted: getComputedStyle(node).backgroundImage !== 'none', height: Math.round(node.getBoundingClientRect().height)};
  });
  if (after.painted || after.height !== 0) failures.push({case: 'once defined, no placeholder is left', got: after});
  console.log(JSON.stringify({before, after}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PLACEHOLDER_GEOMETRY_OK');
