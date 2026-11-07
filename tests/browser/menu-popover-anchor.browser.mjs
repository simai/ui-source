#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A menu or a popover opened for a Smart host. Every Smart host is
// display: contents and has no box: sfContextMenu.openFor(sf-button-icon)
// measured a zero rectangle and opened the menu at the window's left edge
// (simai/ui-source#68), width trigger took 0px. The gap between a trigger and
// its surface was a fixed 4px with no way to ask for 8 (#69). And an
// sf-dropdown written in a closed sf-popover's surface was never defined,
// because the popover never renders a template and so never sent the
// sf-after-render the Loader reads its children on (#70).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body, {theme = 'theme-light', boot = '{icons: {enabled: false}}'} = {}) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = ${boot};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

const pages = {
  '/menu.html': pageOf(`<div style="padding:200px 160px">
    <sf-button-icon id="add" icon="add" aria-label="Add"></sf-button-icon>
    <sf-button id="wide">A wide trigger button</sf-button>
    <sf-menu-context id="menu" popup></sf-menu-context>
  </div>`),
  '/popover.html': pageOf(`<div style="padding:40px">
    <sf-popover id="pop" offset="var(--sf-space-1\\/3)"><sf-button-icon slot="trigger" icon="tune" aria-label="Tune"></sf-button-icon>
      <div slot="content"><sf-dropdown label="Fit"></sf-dropdown></div></sf-popover>
    <sf-popover id="flush"><sf-button-icon slot="trigger" icon="add" aria-label="Add"></sf-button-icon><div slot="content">Flush</div></sf-popover>
  </div>`),
};

const failures = [];
const note = (detail) => failures.push(detail);
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const measured = {};
try {
  for (const [name, viewport] of [['desktop', {width: 1200, height: 800}], ['mobile', {width: 390, height: 800}]]) {
    const page = await browser.newPage({viewport});
    await page.goto(`${base}/menu.html`);
    await page.waitForFunction(() => customElements.get('sf-menu-context') && customElements.get('sf-button-icon') && customElements.get('sf-button'), null, {timeout: 10000});
    await page.waitForTimeout(300);
    const result = await page.evaluate(async () => {
      const settle = () => new Promise((done) => setTimeout(done, 250));
      const menu = document.querySelector('#menu');
      menu.entries = [{id: 'a', label: 'Alpha'}, {id: 'b', label: 'Beta'}];
      const add = document.querySelector('#add');
      const button = add.querySelector('button').getBoundingClientRect();
      const at = async (anchor, options) => {
        await menu.openFor(anchor, options);
        await settle();
        const box = menu.surface().getBoundingClientRect();
        menu.close({restoreFocus: false});
        await settle();
        return {left: box.left, top: box.top, width: box.width};
      };
      const plain = await at(add);
      const eight = await at(add, {offset: 'var(--sf-space-1\\/3)'});
      const twelve = await at(add, {offset: 12});
      const wide = document.querySelector('#wide');
      const wideButton = wide.querySelector('button').getBoundingClientRect();
      const trigger = await at(wide, {width: 'trigger'});
      return {hostDisplay: getComputedStyle(add).display, button: {left: button.left, bottom: button.bottom},
        plain, eight, twelve, wideWidth: wideButton.width, trigger};
    });
    measured[name] = result;
    if (result.hostDisplay !== 'contents') note({viewport: name, check: 'the anchor host draws no box', display: result.hostDisplay});
    if (Math.abs(result.plain.left - result.button.left) > 1) note({viewport: name, check: 'menu starts at the button', menu: result.plain.left, button: result.button.left});
    if (Math.abs(result.plain.top - result.button.bottom - 4) > 1) note({viewport: name, check: 'default gap 4px', gap: result.plain.top - result.button.bottom});
    if (Math.abs(result.eight.top - result.button.bottom - 8) > 1) note({viewport: name, check: 'offset token 8px', gap: result.eight.top - result.button.bottom});
    if (Math.abs(result.twelve.top - result.button.bottom - 12) > 1) note({viewport: name, check: 'offset 12px', gap: result.twelve.top - result.button.bottom});
    if (Math.abs(result.trigger.width - result.wideWidth) > 1) note({viewport: name, check: 'width trigger is the button width', menu: result.trigger.width, button: result.wideWidth});
    await page.close();
  }

  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  await page.goto(`${base}/popover.html`);
  await page.waitForFunction(() => customElements.get('sf-popover'), null, {timeout: 10000});
  // Its trigger is a Smart element inside it too: before #70 it never loaded.
  const triggers = await page.waitForFunction(() => customElements.get('sf-button-icon'), null, {timeout: 4000}).then(() => true, () => false);
  await page.waitForTimeout(1500);
  const popover = !triggers ? null : await page.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const pop = document.querySelector('#pop');
    const rendered = await Promise.race([pop.whenRendered().then(() => true), settle(2000).then(() => false)]);
    const before = Boolean(customElements.get('sf-dropdown'));
    pop.show();
    await settle(1500);
    const gap = (element) => {
      const trigger = element.querySelector('[slot="trigger"] button').getBoundingClientRect();
      const surface = element.querySelector('[slot="content"]').getBoundingClientRect();
      return surface.top - trigger.bottom;
    };
    const dropdown = pop.querySelector('sf-dropdown');
    const result = {rendered, before, defined: Boolean(customElements.get('sf-dropdown')),
      upgraded: dropdown?.constructor === customElements.get('sf-dropdown'), drawn: dropdown?.innerHTML.length ?? 0, gap: gap(pop)};
    pop.close();
    const flush = document.querySelector('#flush');
    flush.show();
    await settle(300);
    result.flushGap = gap(flush);
    flush.close();
    return result;
  });
  measured.popover = popover;
  if (!popover) note({check: 'the sf-button-icon trigger inside an sf-popover is defined'});
  else if (!popover.rendered) note({check: 'sf-popover whenRendered() settles'});
  if (popover && (!popover.defined || !popover.upgraded || !popover.drawn)) note({check: 'an sf-dropdown in a closed popover is defined and drawn', ...popover});
  if (popover && Math.abs(popover.gap - 8) > 1) note({check: 'sf-popover offset 8px', gap: popover.gap});
  if (popover && Math.abs(popover.flushGap) > 1) note({check: 'sf-popover without offset keeps no gap', gap: popover.flushGap});
  await page.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({measured, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
