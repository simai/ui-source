#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The box before the code (owner, 2026-10-15, rule 5; the box rule of
// 2026-10-28), measured on the built core sheet: an element not defined yet
// keeps the box the page declares and core draws no shape of its own in it;
// «block» and «line» draw their declared box as one bar; printed static markup
// is the element's own picture, with no placeholder; once defined, nothing of
// the placeholder is left.
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
    <sf-probe-rows id="rows-box" data-sf-skeleton="rows" style="--sf-skeleton-block-size:300px"></sf-probe-rows>
    <sf-probe-record id="record" data-sf-skeleton="record"></sf-probe-record>
    <sf-probe-menu id="menu" data-sf-skeleton="menu" style="block-size:240px"></sf-probe-menu>
    <sf-probe-block id="block" data-sf-skeleton="block" style="--sf-skeleton-block-size:120px"></sf-probe-block>
    <sf-probe-line id="line" data-sf-skeleton="line"></sf-probe-line>
    <sf-probe-rows id="printed" data-sf-skeleton="rows" style="--sf-skeleton-block-size:300px"><div data-sf-static style="block-size:80px"></div></sf-probe-rows>
    <div id="plain" data-sf-skeleton="block"></div>
  </body></html>`);
  await page.addStyleTag({content: readFileSync(join(out, 'core/core/css/core.css'), 'utf8')});
  const ids = ['rows', 'rows-box', 'record', 'menu', 'block', 'line', 'printed', 'plain'];
  const before = await page.evaluate((list) => Object.fromEntries(list.map((id) => {
    const node = document.getElementById(id);
    const style = getComputedStyle(node);
    return [id, {height: Math.round(node.getBoundingClientRect().height), painted: style.backgroundImage !== 'none', animated: style.animationName !== 'none'}];
  })), ids);
  // A count is not a box, and core draws no rows, pairs or stripes of its own.
  for (const id of ['rows', 'record']) {
    if (before[id].painted || before[id].height !== 0) failures.push({case: `«${id}» with no declared box reserves nothing and draws nothing`, got: before[id]});
  }
  if (before['rows-box'].height !== 300 || before['rows-box'].painted) failures.push({case: 'a declared box is reserved, empty', got: before['rows-box']});
  if (before.menu.height !== 240 || before.menu.painted) failures.push({case: 'the page\'s own block size is the box; no stripes', got: before.menu});
  if (before.block.height !== 120 || !before.block.painted) failures.push({case: 'a block is as tall as it says, one bar', got: before.block});
  if (!before.line.painted || before.line.height < 16) failures.push({case: 'a line takes a line and shows its bar', got: before.line});
  if (before.printed.height !== 80 || before.printed.painted || before.printed.animated) failures.push({case: 'printed static markup is the box; no placeholder', got: before.printed});
  if (before.plain.painted) failures.push({case: 'only a custom element not defined yet is a placeholder', got: before.plain});
  // Defined: the element's own again.
  const after = await page.evaluate(() => {
    customElements.define('sf-probe-rows', class extends HTMLElement {});
    const node = document.getElementById('rows-box');
    return {painted: getComputedStyle(node).backgroundImage !== 'none', height: Math.round(node.getBoundingClientRect().height)};
  });
  if (after.painted || after.height !== 0) failures.push({case: 'once defined, no placeholder is left', got: after});
  console.log(JSON.stringify({before, after}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PLACEHOLDER_GEOMETRY_OK');
