#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// icons.enabled = false: the page draws its icons from the full local font the
// distribution carries (docs/developer/icon-subset-runtime.md). The released
// pair ui-68a2e7c1167f drew none: every `sf-icon-loaded` mark came from the
// subset path, which this setting turns off, so core.css's
// `.sf-icon:not(.sf-icon-loaded) { font-size: 0 }` kept each icon at zero
// while the font sat loaded (reported by the ui-chat thread, 2026-10-22).
//
// The page loads through the real Loader with the subset disabled, holding
// `<i class="sf-icon">`, an icon inside a button, `<sf-icon>` and
// `<sf-icon-button>`; more of each is added after load. The local font file is
// held back for a while first. What it holds:
//   1. no flash: while the font is held back, no icon is marked loaded and none
//      is drawn at a non-zero font size (the ligature text never shows);
//   2. once it arrives, every icon -- present before load and added after, the
//      static ones and the Smart ones -- is marked loaded and has a width;
//   3. nothing is asked of the subset service (icons.simai.io), and the font
//      came from the distribution.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css'),
  join(out, 'component', 'component', 'icons', 'css', 'icons.css')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>icons from the local font</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icons-local-font', pluginListVersion: 'icons-local-font',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body style="margin:16px">
<div id="before" style="display:flex;gap:16px;align-items:center">
  <i class="sf-icon" aria-hidden="true">verified</i>
  <span class="sf-icon sf-icon--size-5" aria-hidden="true">home</span>
  <button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center" aria-label="Почта"><i class="sf-icon" aria-hidden="true">mail</i></button>
  <sf-icon icon="settings" label="Настройки"></sf-icon>
  <sf-icon-button icon="notifications" aria-label="Уведомления"></sf-icon-button>
</div>
<div id="after" style="display:flex;gap:16px;align-items:center"></div>
<script src="/distr/core/js/core.js"></script></body></html>`;

// The local font file is held until released, so the probe can look at the
// page while it is still on its way.
let releaseFont;
const fontHeld = new Promise((done) => { releaseFont = done; });
const fontRequests = [];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  if (/\.(woff2|otf|ttf)$/u.test(file) && path.startsWith('/distr/component/icons/')) {
    fontRequests.push(path);
    await fontHeld;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

// Every drawn icon element: the static ones and the one each Smart host renders.
const readIcons = (tab) => tab.evaluate(() => [...document.querySelectorAll('.sf-icon')].map((el) => {
  const box = el.getBoundingClientRect();
  return {
    where: el.closest('#before') ? 'before' : 'after',
    owner: el.closest('sf-icon-button') ? 'sf-icon-button' : el.closest('sf-icon') ? 'sf-icon' : 'static',
    text: el.textContent.trim(),
    loaded: el.classList.contains('sf-icon-loaded'),
    width: Math.round(box.width * 10) / 10,
    fontSize: parseFloat(getComputedStyle(el).fontSize),
  };
}));

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1000, height: 600}});
  const errors = [];
  const subsetRequests = [];
  tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
  tab.on('request', (request) => { if (/icons\.simai\.io/u.test(request.url())) subsetRequests.push(request.url()); });
  await tab.goto(`${base}/page.html`);
  await tab.waitForFunction(() => customElements.get('sf-icon') && customElements.get('sf-icon-button')
    && document.querySelectorAll('sf-icon .sf-icon, sf-icon-button .sf-icon').length >= 2, null, {timeout: 15000});

  // 1. Held back: nothing is marked loaded, nothing is drawn.
  await tab.waitForTimeout(600);
  const held = await readIcons(tab);
  evidence.held = {icons: held.length, fontRequests: fontRequests.length};
  check('the local font was asked for', fontRequests.length > 0, {fontRequests});
  for (const icon of held) {
    check('no icon is marked loaded before its font is', !icon.loaded, icon);
    check('no icon draws its ligature text before its font is', icon.fontSize === 0, icon);
  }

  // Added after load, while the font is still on its way.
  await tab.evaluate(() => {
    const after = document.getElementById('after');
    after.insertAdjacentHTML('beforeend', '<span class="sf-icon" aria-hidden="true">verified</span>'
      + '<sf-icon icon="verified"></sf-icon>'
      + '<sf-icon-button icon="delete" aria-label="Удалить"></sf-icon-button>');
  });
  releaseFont();
  await tab.waitForFunction(() => [...document.querySelectorAll('.sf-icon')].every((el) => el.classList.contains('sf-icon-loaded')),
    null, {timeout: 10000}).catch(() => {});

  // Added once the font is in place.
  await tab.evaluate(() => {
    const after = document.getElementById('after');
    after.insertAdjacentHTML('beforeend', '<i class="sf-icon sf-icon--size-5" aria-hidden="true">star</i>'
      + '<sf-icon icon="home" size="5"></sf-icon>'
      + '<sf-icon-button icon="edit" aria-label="Изменить"></sf-icon-button>');
    const late = document.createElement('span');
    late.className = 'sf-icon';
    late.textContent = 'check';
    after.append(late);
  });
  await tab.waitForTimeout(600);

  // 2. Every icon is loaded and drawn.
  const drawn = await readIcons(tab);
  evidence.drawn = drawn;
  const expected = {before: {static: 3, 'sf-icon': 1, 'sf-icon-button': 1}, after: {static: 3, 'sf-icon': 2, 'sf-icon-button': 2}};
  for (const [where, owners] of Object.entries(expected)) {
    for (const [owner, count] of Object.entries(owners)) {
      const found = drawn.filter((icon) => icon.where === where && icon.owner === owner).length;
      check(`${count} ${owner} icon(s) ${where} load are drawn`, found === count, {found});
    }
  }
  for (const icon of drawn) {
    check('every icon is marked loaded', icon.loaded, icon);
    check('every icon has a width', icon.width > 0, icon);
    check('every icon is drawn at a non-zero font size', icon.fontSize > 0, icon);
  }
  const fontReady = await tab.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"'));
  check('the local Material Symbols Outlined font is loaded', fontReady);

  // 3. No subset service.
  check('nothing is asked of icons.simai.io', subsetRequests.length === 0, {subsetRequests});
  check('the font came from the distribution', fontRequests.every((path) => path.startsWith('/distr/component/icons/')), {fontRequests});
  check('the page raised no error', errors.length === 0, {errors});
  evidence.fontRequests = fontRequests;
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({passed: failures.length === 0, failures, evidence: {held: evidence.held, fontRequests: evidence.fontRequests,
  drawn: evidence.drawn?.length}}, null, 1));
process.exitCode = failures.length ? 1 : 0;
