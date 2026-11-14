#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-pagination address links (PG-10; DEV's intent acceptance 2026-11-14
// returned it): with href="?page={page}" every arrow and page number is a
// link, and a plain click or Enter on it must open the page its href shows.
// It opened the page after: «next» showing ?page=4 went to ?page=5, because
// the move in place re-drew the arrows before the browser read the href.
// Measured on the built bytes for the footer arrows (first, prev, next,
// last), the numbers (arrows and two page links) and the text arrows, at
// pages 2, 3 and 11 of 12, with no listener on sf-pagination-change:
//   - a click and Enter both open exactly the href the link showed;
//   - a listener that cancels sf-pagination-change keeps the address and
//     moves in place.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/inputs/css/inputs.css',
  'component/component/pagination/css/pagination.css', 'component/component/dropdown/css/dropdown.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/input/js/input.js', 'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/pagination/js/pagination.js'];
const origin = 'http://probe.test';
const VARIANTS = {
  footer: (current) => `<sf-pagination id="p" href="?page={page}" total="240" page-size="20" current="${current}" top="false" bottom="false"></sf-pagination>`,
  numbers: (current) => `<sf-pagination id="p" appearance="numbers" href="?page={page}" total="240" page-size="20" current="${current}"></sf-pagination>`,
  arrows: (current) => `<sf-pagination id="p" appearance="arrows" href="?page={page}" total="240" page-size="20" current="${current}"></sf-pagination>`,
};
const KINDS = ['first', 'prev', 'next', 'last'];

const failures = [];
const evidence = [];
const browser = await chromium.launch();
const serve = (path, route) => (existsSync(path)
  ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
  : route.fulfill({status: 404, body: ''}));

async function place(markup) {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    const distr = url.pathname.match(/^\/distr\/([^/]+)\/(.+)$/u);
    if (distr) return serve(join(out, distr[1], distr[1], distr[2]), route);
    return serve(join(out, url.pathname), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">${markup}</body></html>`);
  await page.evaluate(() => { window.sfPath = '/distr/'; });
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-pagination') && document.querySelector('#p a[href]'), null, {timeout: 10000});
  await page.waitForTimeout(300);
  return page;
}

// The link of a kind: its href (the query it names) and a mark to reach it by.
const mark = (page, kind) => page.evaluate((kind) => {
  const root = document.getElementById('p');
  const el = kind.startsWith('page-')
    ? root.querySelector(`a.sf-pagination-page[data-page="${kind.slice(5)}"]`)
    : root.querySelector(`.sf-pagination-direction--${kind}`);
  const link = el && (el.matches('a') ? el : el.querySelector('a[href]'));
  if (!link?.getAttribute('href')) return null;
  link.setAttribute('data-probe', kind);
  return new URL(link.href).search;
}, kind);

try {
  for (const [variant, markup] of Object.entries(VARIANTS)) for (const current of [2, 3, 11]) {
    const kinds = variant === 'numbers' ? [...KINDS, `page-${current + 1}`, `page-${current - 1}`] : KINDS;
    for (const kind of kinds) for (const how of ['click', 'enter']) {
      const page = await place(markup(current));
      const shown = await mark(page, kind);
      if (shown === null) { await page.close(); continue; }
      const navigation = page.waitForNavigation({timeout: 5000}).catch(() => null);
      if (how === 'click') await page.click(`[data-probe="${kind}"]`);
      else { await page.focus(`[data-probe="${kind}"]`); await page.keyboard.press('Enter'); }
      await navigation;
      const opened = new URL(page.url()).search;
      evidence.push({variant, current, kind, how, shown, opened});
      if (opened !== shown) failures.push({case: 'a followed link opens the page its href showed', variant, current, kind, how, shown, opened});
      await page.close();
    }
  }
  // A host that takes the move in place cancels the change: the address stays.
  const page = await place(VARIANTS.footer(3));
  await page.evaluate(() => document.addEventListener('sf-pagination-change', (event) => event.preventDefault()));
  await mark(page, 'next');
  await page.click('[data-probe="next"]');
  await page.waitForTimeout(300);
  const kept = await page.evaluate(() => ({search: location.search, current: Number(document.getElementById('p').current)}));
  evidence.push({case: 'cancelled', ...kept});
  if (kept.search !== '' || kept.current !== 4) failures.push({case: 'a cancelled change keeps the address and moves in place', ...kept});
  await page.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify({checked: evidence.length, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('PAGINATION_LINKS_OK');
