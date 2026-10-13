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
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: readFileSync(path)});
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
  if (outlineAt !== 2 || during.height !== 42 || during.sourceShown || !during.ghost) {
    failures.push('while dragging, the item leaves the flow and an outline of its size opens at the place it would take');
  }
  if (after.intents.length !== 1 || after.intents[0].index !== 2 || after.left || !after.sourceShown) {
    failures.push('the drop asks for that place, and the outline and the hidden item are gone after it');
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SORTABLE_SILHOUETTE_OK');
