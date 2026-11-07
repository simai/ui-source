#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-switch's on colour was hard-coded --sf-primary with no public variable
// (simai/ui-source#46 item 2): a page could not give a switch its own on
// colour. Its look now follows the native control alone -- checked from
// input:checked, disabled from input:disabled (item 3) -- so a script that
// sets the input, without the component's classes, draws right. Measured in
// both themes.
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

const body = `<div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start">
  <sf-switch id="plain" label="Plain" checked></sf-switch>
  <div style="--sf-switch-checked-background-color: rgb(10, 120, 60); --sf-switch-checked-thumb-color: rgb(250, 240, 200)">
    <sf-switch id="own" label="Own colour" checked></sf-switch>
  </div>
  <sf-switch id="off" label="Off"></sf-switch>
  <label class="sf-switch sf-switch--size-1 flex" id="bare"><span class="sf-switch-toggler flex items-cross-center"><input type="checkbox" role="switch"><span class="sf-switch-inner" aria-hidden="true"></span></span></label>
</div>`;
const pages = {'/light.html': pageOf(body), '/dark.html': pageOf(body, {theme: 'theme-dark'})};

const failures = [];
const note = (detail) => failures.push(detail);
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const measured = {};
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 800, height: 600}});
    await page.goto(`${base}/${theme}.html`);
    await page.waitForFunction(() => customElements.get('sf-switch'), null, {timeout: 10000});
    await page.waitForFunction(() => document.querySelector('#own .sf-switch-toggler'), null, {timeout: 10000});
    await page.waitForTimeout(800);
    const result = await page.evaluate(async () => {
      const paint = (root) => {
        const track = root.querySelector('.sf-switch-toggler');
        const thumb = root.querySelector('.sf-switch-inner');
        return {track: getComputedStyle(track).backgroundColor, thumb: getComputedStyle(thumb).backgroundColor, border: getComputedStyle(track).borderColor};
      };
      const probe = document.createElement('span');
      probe.style.color = 'var(--sf-primary)';
      document.body.append(probe);
      const primary = getComputedStyle(probe).color;
      probe.style.color = 'var(--sf-on-disable)';
      const onDisable = getComputedStyle(probe).color;
      probe.remove();
      const bare = document.querySelector('#bare');
      const input = bare.querySelector('input');
      const offBare = paint(bare);
      // Set from a script, no change event, no class: the look follows the input.
      input.checked = true;
      bare.classList.remove('active');
      await new Promise((done) => setTimeout(done, 400));
      const checkedBare = paint(bare);
      input.disabled = true;
      bare.classList.remove('disabled');
      // The fill changes over the switch's own duration.
      await new Promise((done) => setTimeout(done, 400));
      const disabledBare = paint(bare);
      return {primary, onDisable, plain: paint(document.querySelector('#plain')), own: paint(document.querySelector('#own')),
        off: paint(document.querySelector('#off')), offBare, checkedBare, disabledBare};
    });
    measured[theme] = result;
    if (result.plain.track !== result.primary) note({theme, check: 'a checked switch keeps --sf-primary by default', ...result.plain, primary: result.primary});
    if (result.own.track !== 'rgb(10, 120, 60)') note({theme, check: '--sf-switch-checked-background-color fills the track', track: result.own.track});
    if (result.own.thumb !== 'rgb(250, 240, 200)') note({theme, check: '--sf-switch-checked-thumb-color paints the thumb', thumb: result.own.thumb});
    if (result.off.track === 'rgb(10, 120, 60)') note({theme, check: 'the variable reaches no switch outside its area'});
    if (result.checkedBare.track !== result.primary) note({theme, check: 'input.checked from a script draws the on look', ...result.checkedBare});
    if (result.disabledBare.thumb !== result.onDisable) note({theme, check: 'input.disabled without the class draws the disabled thumb', ...result.disabledBare, onDisable: result.onDisable});
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({measured, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
