#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-sortable shows where a dragged item will land: the item leaves the flow,
// an outline of its size opens at the place it would take and the list makes
// room; the intent carries that place's index. A line two pixels thick said
// where but not how the list would look (owner, 2026-10-13).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'smart/smart/sortable/css/sortable.css'];
const modules = ['core/core/js/core.js', 'smart/smart/sortable/js/sortable.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 800, height: 600}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html lang="ru"><body style="margin:40px">'
    + '<sf-sortable id="list" group="rows" label="Строки">'
    + ['Первая', 'Вторая', 'Третья', 'Четвёртая'].map((text, at) => `<div data-sf-sortable-item="r${at}" style="height:40px;border:1px solid #888;margin:0">`
      + `<span data-sf-sortable-handle>⠿</span> ${text}</div>`).join('')
    + '</sf-sortable></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-sortable'), null, {timeout: 8000});
  await page.evaluate(() => {
    window.intents = [];
    document.addEventListener('sf-sortable-intent', (event) => window.intents.push(event.detail));
  });
  const sourceHeight = await page.evaluate(() => Math.round(document.querySelector('[data-sf-sortable-item="r0"]').getBoundingClientRect().height));
  const handle = page.locator('[data-sf-sortable-item="r0"] [data-sf-sortable-handle]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  // Between the third and the fourth row.
  await page.mouse.move(box.x + 4, box.y + 30, {steps: 4});
  await page.mouse.move(box.x + 4, box.y + 105, {steps: 8});
  const during = await page.evaluate(() => {
    const list = document.getElementById('list');
    const holder = list.querySelector('.sf-sortable-placeholder');
    const order = [...list.children].map((node) => (node === holder ? 'outline' : node.dataset.sfSortableItem));
    const source = list.querySelector('[data-sf-sortable-item="r0"]');
    return {order, height: holder ? Math.round(holder.getBoundingClientRect().height) : null,
      sourceShown: source.getClientRects().length > 0, ghost: Boolean(document.querySelector('.sf-sortable-ghost'))};
  });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({intents: window.intents,
    left: Boolean(document.querySelector('.sf-sortable-placeholder')),
    sourceShown: document.querySelector('[data-sf-sortable-item="r0"]').getClientRects().length > 0}));
  console.log(JSON.stringify({during, after}, null, 1));
  const outlineAt = during.order.filter((key) => key !== 'r0').indexOf('outline');
  if (outlineAt !== 2 || during.height !== sourceHeight || during.sourceShown || !during.ghost) {
    failures.push('while dragging, the item leaves the flow and an outline of its size opens at the place it would take');
  }
  if (after.intents.length !== 1 || after.intents[0].index !== 2 || after.left || !after.sourceShown) {
    failures.push('the drop asks for that place, and the outline and the hidden item are gone after it');
  }

  // A grid of two columns (owner, 2026-10-14: a record view's fields): the
  // outline is one of the cells, in reading order.
  await page.setContent('<!doctype html><html lang="ru"><body style="margin:40px">'
    + '<sf-sortable id="grid" group="cells" label="Поля" style="display:grid;grid-template-columns:200px 200px;gap:8px;width:408px">'
    + ['A', 'B', 'C', 'D', 'E', 'F'].map((text) => `<div data-sf-sortable-item="${text}" style="height:40px;border:1px solid #888">`
      + `<span data-sf-sortable-handle>⠿</span> ${text}</div>`).join('')
    + '</sf-sortable></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.intents = [];
    document.addEventListener('sf-sortable-intent', (event) => window.intents.push(event.detail));
  });
  const cell = await page.locator('[data-sf-sortable-item="A"] [data-sf-sortable-handle]').boundingBox();
  const target = await page.locator('[data-sf-sortable-item="D"]').boundingBox();
  await page.mouse.move(cell.x + 4, cell.y + 4);
  await page.mouse.down();
  await page.mouse.move(cell.x + 30, cell.y + 30, {steps: 4});
  // Over the right half of D: A lands after D.
  await page.mouse.move(target.x + target.width * 0.75, target.y + target.height / 2, {steps: 8});
  const grid = await page.evaluate(() => {
    const list = document.getElementById('grid');
    const holder = list.querySelector('.sf-sortable-placeholder');
    return {order: [...list.children].filter((node) => node === holder || (node.dataset?.sfSortableItem && node.getClientRects().length)).map((node) => (node === holder ? 'outline' : node.dataset.sfSortableItem)),
      line: Boolean(document.querySelector('.sf-sortable-indicator:not([hidden])'))};
  });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const gridIntent = await page.evaluate(() => window.intents);
  console.log(JSON.stringify({grid, gridIntent}));
  if (grid.order.join() !== 'B,C,D,outline,E,F' || gridIntent.length !== 1 || gridIntent[0].index !== 3) {
    failures.push('in a grid the outline is a cell in reading order, and the drop asks for that place');
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SORTABLE_SILHOUETTE_OK');
