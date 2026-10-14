#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.Sortable.attach in the column mode: a table's heading cells move with the
// cells under them. While a heading is dragged, the column is dimmed in every
// row and an outline the width of the column and the height of the table
// stands where it will go; the drop reports the place among its group, and the
// click a drop ends with does not reach the heading -- a click without a drag
// does (owner, 2026-10-13).
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
    + '<table id="t" style="border-collapse:collapse"><thead><tr>'
    + ['A', 'B', 'C', 'D'].map((key) => `<th data-sf-sortable-item="${key}" style="width:100px;height:30px;border:1px solid #888"><button type="button">${key}</button></th>`).join('')
    + '</tr></thead><tbody>'
    + [1, 2, 3].map((row) => `<tr>${['A', 'B', 'C', 'D'].map((key) => `<td style="height:30px;border:1px solid #ccc">${key}${row}</td>`).join('')}</tr>`).join('')
    + '</tbody></table></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.waitForFunction(() => customElements.get('sf-sortable'), null, {timeout: 8000});
  await page.evaluate(() => {
    window.intents = [];
    window.clicks = 0;
    const table = document.getElementById('t');
    const row = table.tHead.rows[0];
    for (const button of row.querySelectorAll('button')) button.addEventListener('click', () => { window.clicks += 1; });
    window.SF.Sortable.attach(row, {
      items: 'th[data-sf-sortable-item]',
      extent: table,
      label: 'Колонки',
      cellsOf: (th) => [...table.rows].map((tr) => tr.cells[th.cellIndex]),
      onIntent: (detail) => window.intents.push(detail),
    });
  });
  const a = await page.locator('th[data-sf-sortable-item="A"] button').boundingBox();
  const c = await page.locator('th[data-sf-sortable-item="C"]').boundingBox();
  await page.mouse.click(a.x + 5, a.y + 5);
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 5, {steps: 4});
  await page.mouse.move(c.x + c.width * 0.75, a.y + 5, {steps: 10});
  const during = await page.evaluate(() => {
    const outline = document.querySelector('.sf-sortable-column-outline')?.getBoundingClientRect();
    const table = document.getElementById('t').getBoundingClientRect();
    const c = document.querySelector('th[data-sf-sortable-item="C"]').getBoundingClientRect();
    return {outline: outline ? {left: Math.round(outline.left), height: Math.round(outline.height), right: Math.round(outline.right)} : null,
      table: Math.round(table.height), cRight: Math.round(c.right),
      dimmed: document.querySelectorAll('[data-sf-sortable-column-source]').length, ghost: Boolean(document.querySelector('.sf-sortable-ghost'))};
  });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({intents: window.intents, clicks: window.clicks,
    left: Boolean(document.querySelector('.sf-sortable-column-outline')), dimmed: document.querySelectorAll('[data-sf-sortable-column-source]').length}));
  await page.mouse.click(a.x + 5, a.y + 5);
  const clicksLater = await page.evaluate(() => window.clicks);
  console.log(JSON.stringify({during, after, clicksLater}, null, 1));
  if (!during.outline || during.outline.height !== during.table || Math.abs(during.outline.right - during.cRight) > 1 || during.dimmed !== 4 || !during.ghost) {
    failures.push('while dragging, the column is dimmed in every row and an outline the height of the table ends where C ends');
  }
  if (after.intents.length !== 1 || after.intents[0].item !== 'A' || after.intents[0].index !== 2 || after.left || after.dimmed) {
    failures.push('the drop asks for the place after C and leaves nothing behind');
  }
  if (after.clicks !== 1 || clicksLater !== 2) failures.push('the click a drop ends with is swallowed; a plain click is not');
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SORTABLE_COLUMNS_OK');
