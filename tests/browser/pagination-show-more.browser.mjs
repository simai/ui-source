#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-pagination (owner, 2026-10-14), measured on the built bytes: «Показать
// ещё» takes the room between the pages and the page size, an easy target
// with no hole either side of it.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css', 'component/component/pagination/css/pagination.css', 'component/component/dropdown/css/dropdown.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js', 'smart/smart/list-item/js/list-item.js', 'smart/smart/dropdown/js/dropdown.js', 'smart/smart/pagination/js/pagination.js'];
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 600}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html lang="ru" class="theme-light"><body style="margin:20px"><div style="width:1000px"><sf-pagination id="p" total="450" page-size="20" current="1" top></sf-pagination></div></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-pagination') && document.querySelector('#p .sf-pagination-more button'), null, {timeout: 8000});
  await page.waitForTimeout(300);
  const got = await page.evaluate(() => {
    const more = document.querySelector('#p .sf-pagination-more');
    const button = more.querySelector('button').getBoundingClientRect();
    const box = more.getBoundingClientRect();
    return {box: Math.round(box.width), button: Math.round(button.width), row: Math.round(document.querySelector('#p .sf-pagination-more').parentElement.getBoundingClientRect().width)};
  });
  if (got.button !== got.box || got.box < got.row / 4) failures.push({case: '«Показать ещё» fills the room between', got});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PAGINATION_SHOW_MORE_OK');
