#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-tag (owner, 2026-10-14), measured on the built bytes: a tag without a
// count ends at its label and its own padding -- no empty count element, no
// band at its end; a tag with a count still draws it.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/tags/css/tags.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/tags/js/tags.js'];
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
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
  await page.setContent('<!doctype html><html lang="ru" class="theme-light"><body style="margin:20px"><sf-tag id="plain" type="default" text="Биллинг" size="1/3"></sf-tag> <sf-tag id="counted" type="default" text="Платежи" count="3" size="1/3"></sf-tag></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-tag') && document.querySelector('#plain .sf-tag'), null, {timeout: 8000});
  await page.waitForTimeout(200);
  const got = await page.evaluate(() => {
    const measure = (id) => {
      const tag = document.querySelector(`#${id} .sf-tag`);
      const label = tag.querySelector('.sf-tag-container').getBoundingClientRect();
      return {count: tag.querySelector('.sf-tag-count')?.textContent.trim() ?? null,
        tail: Math.round(tag.getBoundingClientRect().right - label.right), padding: Math.round(parseFloat(getComputedStyle(tag).paddingRight))};
    };
    return {plain: measure('plain'), counted: measure('counted')};
  });
  if (got.plain.count !== null || got.plain.tail !== got.plain.padding) failures.push({case: 'a tag without a count ends at its label', got: got.plain});
  if (got.counted.count !== '3') failures.push({case: 'a count is still drawn', got: got.counted});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TAGS_GEOMETRY_OK');
