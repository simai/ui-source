#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A failed file's retry line (docs report on pair ui-2d39b617a719): the words
// «Не удалось передать. Повторить» are the file's second line under its name,
// like the size line of a file in progress --
// - the retry words start where the size line starts (no inset), in every size;
// - they take the size line's font size and weight (not bold, not larger).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/featured-icon/css/featured-icon.css',
  'component/component/progress-bar/css/progress-bar.css', 'component/component/file-upload/css/file-upload.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/progress-bar/js/progress-bar.js',
  'smart/smart/file-upload/js/file-upload.js'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const seen = {};
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  const sizes = ['1/2', '1', '2'];
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px;width:480px">
    ${sizes.map((size, at) => `<sf-file-upload id="u${at}" size="${size}"></sf-file-upload>`).join('')}</body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-file-upload'), null, {timeout: 8000});
  await page.evaluate(() => {
    for (const host of document.querySelectorAll('sf-file-upload')) {
      host.items = [
        {id: 'a', name: 'report.pdf', fileSize: '2MB', state: 'process', progress: 40},
        {id: 'b', name: 'photo.png', fileSize: '3MB', state: 'error', errorMessage: 'Не удалось передать. Повторить'},
      ];
    }
  });
  await page.waitForFunction(() => document.querySelectorAll('.sf-upload-progress-repeat').length === 3, null, {timeout: 8000});
  await page.waitForTimeout(300);
  const got = await page.evaluate(() => [...document.querySelectorAll('sf-file-upload')].map((host) => {
    const row = host.querySelector('.sf-upload-progress--error');
    const meta = row.querySelector('.sf-upload-progress-text');
    const retry = row.querySelector('.sf-upload-progress-repeat');
    // Where the words start: the first glyph's box, not the element's.
    const textLeft = (node) => {
      const range = document.createRange();
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {acceptNode: (t) => (t.textContent.trim() ? 1 : 3)});
      const first = walker.nextNode();
      const offset = first.textContent.search(/\S/u);
      range.setStart(first, offset);
      range.setEnd(first, offset + 1);
      return Math.round(range.getBoundingClientRect().left);
    };
    const style = (node) => { const s = getComputedStyle(node); return {size: s.fontSize, weight: s.fontWeight}; };
    return {size: host.getAttribute('size'), metaLeft: textLeft(meta), retryLeft: textLeft(retry), meta: style(meta), retry: style(retry)};
  }));
  seen.rows = got;
  for (const row of got) {
    if (Math.abs(row.metaLeft - row.retryLeft) > 1) note({size: row.size, case: 'the retry words start where the size line starts', got: row});
    if (row.meta.size !== row.retry.size || row.meta.weight !== row.retry.weight) note({size: row.size, case: 'the retry words take the size line type', got: row});
  }
  console.log(JSON.stringify(seen, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FILE_UPLOAD_ERROR_ROW_OK');
