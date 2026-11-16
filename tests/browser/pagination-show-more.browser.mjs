#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-pagination, measured on the built bytes: «Показать ещё» (owner decision
// C97 (1), which replaced the 2026-10-14 rule that it fill the room between
// the pages and the page size) is never in one row with the arrows: with top
// it stands in its own row above them, and appearance="more" is a look of its
// own.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css', 'component/component/pagination/css/pagination.css', 'component/component/dropdown/css/dropdown.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/input/js/input.js', 'smart/smart/list-item/js/list-item.js', 'smart/smart/dropdown/js/dropdown.js', 'smart/smart/pagination/js/pagination.js'];
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
  await page.waitForFunction(() => customElements.get('sf-pagination') && document.querySelector('#p .sf-pagination-more-button button')
    && document.querySelector('#p .sf-pagination-direction--next button'), null, {timeout: 8000});
  await page.waitForTimeout(300);
  // Owner decision C97 (1): «Показать ещё» is not in one row with the arrows.
  // With top it stands in a row of its own above them (sf-pagination-top),
  // centred, an sf-button of the pagination's size (as tall as its arrows).
  const got = await page.evaluate(() => {
    const r = (node) => { const b = node.getBoundingClientRect(); return {x: b.x, right: b.right, y: b.y, bottom: b.bottom, w: b.width, h: b.height, cx: b.x + b.width / 2}; };
    const top = document.querySelector('#p .sf-pagination-top');
    const main = document.querySelector('#p .sf-pagination-main');
    const button = document.querySelector('#p .sf-pagination-more-button button');
    const arrow = document.querySelector('#p .sf-pagination-direction--next button');
    return {top: top && r(top), main: r(main), button: r(button), arrow: r(arrow), inTop: Boolean(top && top.contains(button)),
      text: button.textContent.replace(/\s+/gu, ' ').trim()};
  });
  if (!got.inTop) failures.push({case: '«Показать ещё» stands in its own row (sf-pagination-top)', got});
  else {
    if (got.button.bottom > got.main.y + 0.5) failures.push({case: '«Показать ещё» stands above the arrows, not on their line', got});
    if (Math.abs(got.button.cx - got.top.cx) > 0.5) failures.push({case: '«Показать ещё» is centred in its row', got});
  }
  if (Math.abs(got.button.h - got.arrow.h) > 0.5) failures.push({case: '«Показать ещё» is as tall as the arrows of the same size', got});
  if (got.text !== 'Показать ещё') failures.push({case: 'the button says «Показать ещё»', got: got.text});
  console.log(JSON.stringify(got));

  // The «Показать ещё» look (C97 (1)): a look of its own -- the button with
  // the next portion, «Показано N из M» and a bar, and no arrows.
  await page.setContent('<!doctype html><html lang="ru" class="theme-light"><body style="margin:20px"><div style="width:1000px"><sf-pagination id="m" appearance="more" total="240" page-size="20" current="1"></sf-pagination></div></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-pagination') && document.querySelector('#m .sf-pagination-more-button'), null, {timeout: 8000});
  await page.waitForTimeout(300);
  const look = await page.evaluate(() => {
    const el = document.getElementById('m');
    const button = el.querySelector('.sf-pagination-more-button');
    return {button: button.querySelector('button')?.textContent.replace(/\s+/gu, ' ').trim() || button.getAttribute('text'),
      shown: el.querySelector('.sf-pagination-shown')?.textContent.replace(/\s+/gu, ' ').trim() ?? null,
      bar: Boolean(el.querySelector('sf-progress-bar')), arrows: el.querySelectorAll('.sf-pagination-direction').length};
  });
  if (!/Показать ещё 20/u.test(look.button ?? '')) failures.push({case: 'the more look offers the next portion', got: look});
  if (!/Показано 20 из 240/u.test(look.shown ?? '')) failures.push({case: 'the more look says how many are shown', got: look});
  if (!look.bar) failures.push({case: 'the more look draws its bar', got: look});
  if (look.arrows) failures.push({case: 'the more look draws no arrows', got: look});
  console.log(JSON.stringify(look));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PAGINATION_SHOW_MORE_OK');
