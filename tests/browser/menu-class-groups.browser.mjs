#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, component/.
//
// component.menu 1.2.1: a hand-written group -- the markup sf-menu draws for a
// group, li.sf-menu-item.sf-menu-item--group > .sf-menu-group-heading + ul.sf-menu
// -- is styling only. The class runtime leaves it flat: no generated row
// element or disclosure, the list shown, its rows on the first level and the
// size 1 control height. A collapsible group (button heading) opens and closes
// by its button with a pointer and Enter; a fixed group never closes. A real
// branch beside it still nests. No page errors.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const page = `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/menu/css/menu.css">
<script defer src="/distr/component/menu/js/menu.js"></script></head>
<body><nav aria-label="Sections"><ul class="sf-menu" id="root">
  <li class="sf-menu-item sf-menu-item--group" data-sf-menu-group id="fixed">
    <span class="sf-menu-group-heading" id="fixed-heading"><span class="sf-menu-group-label">Site</span></span>
    <ul class="sf-menu" aria-labelledby="fixed-heading">
      <li class="sf-menu-item"><a class="sf-menu-element" href="#a"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Address</span></span></a></li>
      <li class="sf-menu-item"><a class="sf-menu-element" href="#b"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Code</span></span></a></li>
    </ul>
  </li>
  <li class="sf-menu-item" id="bare">
    <span class="sf-menu-group-heading" id="bare-heading"><span class="sf-menu-group-label">Heading only</span></span>
    <ul class="sf-menu"><li class="sf-menu-item"><a class="sf-menu-element" href="#c"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Data</span></span></a></li></ul>
  </li>
  <li class="sf-menu-item sf-menu-item--group" data-sf-menu-group id="collapsible">
    <button class="sf-menu-group-heading" type="button" id="watch-heading" aria-expanded="true"><span class="sf-menu-group-label">Watch</span><span class="sf-icon" aria-hidden="true">keyboard_arrow_up</span></button>
    <ul class="sf-menu" aria-labelledby="watch-heading">
      <li class="sf-menu-item"><a class="sf-menu-element" href="#d"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Health</span></span></a></li>
    </ul>
  </li>
  <li class="sf-menu-item" id="leaf"><a class="sf-menu-element" href="#e"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Overview</span></span></a></li>
  <li class="sf-menu-item" id="branch">Project<ul class="sf-menu"><li class="sf-menu-item">Documents</li></ul></li>
</ul></nav></body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return response.end(page); }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); };
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  for (let load = 0; load < 3; load += 1) {
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => document.querySelector('#branch')?.dataset.sfMenuBound === 'true');
    const read = () => tab.evaluate(() => {
      const group = (id) => {
        const root = document.querySelector(`#${id}`);
        const list = root.querySelector(':scope > .sf-menu');
        const row = list.querySelector(':scope > .sf-menu-item > .sf-menu-element');
        return {
          element: Boolean(root.querySelector(':scope > .sf-menu-element')),
          branchClass: root.classList.contains('sf-menu-item--has-submenu'),
          open: root.classList.contains('open'),
          hidden: list.hidden || getComputedStyle(list).display === 'none',
          rowLevel1: row.classList.contains('sf-menu-element--level-1'),
          rowHeight: Math.round(row.getBoundingClientRect().height),
        };
      };
      const toggle = document.querySelector('#watch-heading');
      return {
        fixed: group('fixed'), bare: group('bare'), collapsible: group('collapsible'),
        expanded: toggle.getAttribute('aria-expanded'), controls: toggle.getAttribute('aria-controls'),
        controlsList: document.getElementById(toggle.getAttribute('aria-controls') || '') === document.querySelector('#collapsible > .sf-menu'),
        branchNested: Boolean(document.querySelector('#branch > button.sf-menu-element')) && document.querySelector('#branch > .sf-menu').hidden,
        topRowHeight: Math.round(document.querySelector('#leaf > .sf-menu-element').getBoundingClientRect().height),
        leafLevel1: document.querySelector('#leaf > .sf-menu-element').classList.contains('sf-menu-element--level-1'),
      };
    });
    const before = await read();
    for (const id of ['fixed', 'bare', 'collapsible']) {
      const g = before[id];
      check(!g.element, `load ${load}: ${id} got a generated row element`);
      check(!g.branchClass, `load ${load}: ${id} marked as a branch`);
      check(g.open && !g.hidden, `load ${load}: ${id} list not shown`);
      check(g.rowLevel1, `load ${load}: ${id} row not on level 1`);
      check(g.rowHeight === before.topRowHeight, `load ${load}: ${id} row height ${g.rowHeight} != first-level ${before.topRowHeight}`);
    }
    check(before.expanded === 'true' && before.controlsList, `load ${load}: collapsible button not wired (${before.expanded}, ${before.controls})`);
    check(before.leafLevel1, `load ${load}: the first-level leaf is not level 1`);
    check(before.branchNested, `load ${load}: the real branch did not nest`);
    await tab.click('#watch-heading');
    const closed = await read();
    check(!closed.collapsible.open && closed.collapsible.hidden && closed.expanded === 'false', `load ${load}: click did not close the collapsible group`);
    check(await tab.evaluate(() => document.querySelector('#watch-heading .sf-icon').textContent === 'keyboard_arrow_down'), `load ${load}: closed glyph`);
    await tab.focus('#watch-heading');
    await tab.keyboard.press('Enter');
    const reopened = await read();
    check(reopened.collapsible.open && !reopened.collapsible.hidden && reopened.expanded === 'true', `load ${load}: Enter did not reopen the group`);
    await tab.click('#fixed-heading');
    check((await read()).fixed.open, `load ${load}: a click closed the fixed group`);
    if (load === 0) console.log(JSON.stringify(before));
  }
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('menu-class-groups: ok (3 loads)');
