#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-tree takes what is dropped on a node (owner, 2026-10-15, the file
// manager), measured on the built bytes with real drag events: records from
// a list with accept-records, files with accept-files; the node under the
// drag is marked; a tree that accepts neither takes nothing.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/tree/css/tree.css', 'component/component/tree-item/css/tree-item.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/tree/js/tree.js', 'smart/smart/tree-item/js/tree-item.js'];
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
    <sf-tree id="t" accept-records accept-files aria-label="Папки">
      <sf-tree-item value="root" label="Корень" open><sf-tree-item value="images" label="images"></sf-tree-item></sf-tree-item>
    </sf-tree>
    <sf-tree id="plain" aria-label="Другое"><sf-tree-item value="x" label="x"></sf-tree-item></sf-tree>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-tree') && document.querySelector('#t .sf-tree-item[data-value="images"]'), null, {timeout: 8000});
  await page.waitForTimeout(300);
  const got = await page.evaluate(() => {
    const heard = [];
    for (const name of ['sf-tree-records-drop', 'sf-tree-files-drop']) document.addEventListener(name, (event) => heard.push([name, event.detail.value, event.detail.ids ?? event.detail.files.map((file) => file.name)]));
    const node = (tree, value) => document.querySelector(`#${tree} .sf-tree-item[data-value="${value}"] .sf-tree-item-container`);
    const fire = (target, type, transfer) => target.dispatchEvent(new DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: transfer}));
    const records = new DataTransfer();
    records.setData('application/x-sf-records+json', JSON.stringify({ids: ['f1', 'f2'], source: 'files'}));
    const accepted = !fire(node('t', 'images'), 'dragover', records);
    const marked = document.querySelector('#t .sf-tree-item[data-value="images"]').hasAttribute('data-sf-drop-target');
    fire(node('t', 'images'), 'drop', records);
    const cleared = !document.querySelector('#t [data-sf-drop-target]');
    const files = new DataTransfer();
    files.items.add(new File(['x'], 'photo.png', {type: 'image/png'}));
    fire(node('t', 'root'), 'dragover', files);
    fire(node('t', 'root'), 'drop', files);
    const refused = fire(node('plain', 'x'), 'dragover', records);
    return {accepted, marked, cleared, refused, heard};
  });
  const said = got.heard.map(([name, value, what]) => `${name}:${value}:${what.join('+')}`).join(',');
  if (!got.accepted || !got.marked || !got.cleared) failures.push({case: 'a node takes records and is marked while dragged over', got});
  if (said !== 'sf-tree-records-drop:images:f1+f2,sf-tree-files-drop:root:photo.png') failures.push({case: 'the drops are said', got: said});
  if (!got.refused) failures.push({case: 'a tree that accepts nothing takes nothing', got});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TREE_DROP_OK');
