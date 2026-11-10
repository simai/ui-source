#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build-output [--json <file>]
//
// sf-dropdown 1.8.1 / sf-list-item 1.2.7: the field's chevron, the list's
// search glyph and the icons of icon options are sf-icon elements on the icon
// system. They were bare <i class="sf-icon"> printed after the page's icon
// scan, so their names could miss the first icon_names request and the glyph
// came a round later (the defect sf-dropdown 1.8.0 fixed for the pictures of
// a choice).
//
// Through the real Loader against a subset service served here (it answers
// with the distribution's full Material Symbols font and records the names it
// was asked for), every sheet held 300 ms so a sheet that comes late shows,
// light and dark, 1000 and 390 wide, 3 fresh loads each:
//   1. every glyph of the dropdowns -- chevron, search, option icons -- is an
//      sf-icon's, and all their names are in one icon_names request, the
//      first that carries any of them;
//   2. each glyph is marked loaded and draws one glyph wide within the first
//      icon request's budget: by 2500 ms after navigation (holdFirstIconRequest)
//      or, when the held sheets keep the page from being ready that long,
//      within 500 ms of the request that asked for it;
//   2b. a dropdown placed after the page settled, with names no request has
//      carried (pets, home, work, expand), has its glyphs asked for and
//      drawn within 1000 ms -- a bare glyph waited for a later scan;
//   3. frame by frame from the first paint, the field and its chevron never
//      move or resize once drawn (no shift);
//   4. the boxes of every glyph, at rest and with the list open, are printed
//      (--json) so a build can be compared with another: geometry unchanged;
//      colours read as the icon roles (on-surface-variant at rest, on-disable
//      for a disabled field);
//   5. the page raised no error.
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonAt = process.argv.indexOf('--json');
const jsonFile = jsonAt > 0 ? process.argv[jsonAt + 1] : null;
const HOLD_MS = 300;
const BUDGET_MS = 2500;
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);

const OPTIONS = [
  {value: 'a', text: 'Метка', kind: 'icon', icon: 'label'},
  {value: 'b', text: 'Закладка', kind: 'icon', icon: 'bookmark'},
  {value: 'c', text: 'Флаг', kind: 'icon', icon: 'flag'}];
const OWN = new Set(['keyboard_arrow_down', 'search', 'label', 'bookmark', 'flag']);
const SIZES = ['1/2', '1', '2'];
const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>dropdown glyphs</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'dropdown-glyphs', pluginListVersion: 'dropdown-glyphs',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:grid;gap:var(--sf-space-1);padding:var(--sf-space-1);grid-template-columns:repeat(auto-fill,minmax(var(--sf-f7),1fr))}</style>
</head><body><main>
${SIZES.map((size, at) => `<sf-dropdown id="d${at}" size="${size}" label="Знак ${size}" name="d${at}" options='${j(OPTIONS)}'></sf-dropdown>`).join('\n')}
<sf-dropdown id="off" disabled label="Выключен" name="off" options='${j(OPTIONS)}'></sf-dropdown>
</main></body></html>`;

let requests = [];
let started = 0;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
let base = '';
let cuts = 0;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
  }
  if (path === '/subset/ms/css') {
    const index = cuts++;
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    requests.push({at: Date.now() - started, icons});
    const fontUrl = `${base}/subset/ms/font/subset-${index}.woff2`;
    const manifest = {hash: `probe-${index}`, mode: 'static-weight', type: 'outlined', origin: null,
      family: 'Material Symbols Outlined', iconCount: icons.length, icons,
      axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}}, fonts: [{hash: `probe-${index}`, weight: 400, url: fontUrl}]};
    const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header,
      'access-control-expose-headers': 'X-SIMAI-Font-Manifest'});
    return response.end(`@font-face {
  font-family: 'Material Symbols Outlined Subset';
  src: url('${fontUrl}') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}
`);
  }
  if (path.startsWith('/subset/ms/font/')) {
    response.writeHead(200, {'content-type': 'font/woff2'});
    return response.end(await readFile(fontFile));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    if (file.endsWith('.css')) await wait(HOLD_MS);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

// Every frame from the first: the boxes of each field and its chevron.
const RECORD = () => {
  window.__frames = [];
  const box = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',');
  };
  const chevron = (field) => field?.querySelector('.sf-icon-button i.sf-icon') ?? null;
  const tick = () => {
    const row = {t: Math.round(performance.now())};
    for (const host of document.querySelectorAll('sf-dropdown')) {
      const field = host.querySelector('.sf-dropdown-field');
      row[host.id] = [box(field), box(chevron(field))];
    }
    window.__frames.push(row);
    if (performance.now() < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const GLYPHS = (ids) => {
  const read = (glyph) => {
    if (!glyph) return {missing: true};
    const range = document.createRange();
    range.selectNodeContents(glyph);
    const r = glyph.getBoundingClientRect();
    const style = getComputedStyle(glyph);
    return {
      text: glyph.textContent.trim(),
      element: glyph.parentElement?.localName === 'sf-icon' ? 'sf-icon' : 'bare',
      loaded: glyph.classList.contains('sf-icon-loaded'),
      width: Math.round(range.getBoundingClientRect().width * 10) / 10,
      box: [r.width, r.height].map((v) => Math.round(v * 10) / 10).join('x'),
      fontSize: parseFloat(style.fontSize),
      color: style.color,
    };
  };
  const out = {};
  for (const id of ids) {
    const host = document.getElementById(id);
    const list = host._list ?? host.querySelector('.sf-list');
    out[id] = {
      chevron: read(host.querySelector('.sf-dropdown-field .sf-icon-button i.sf-icon')),
      search: read(list?.querySelector('.sf-list-search i.sf-icon')),
      options: [...(list?.querySelectorAll('.sf-list-item-wrap i.sf-icon') ?? [])].map(read),
    };
  }
  return out;
};

const failures = [];
const seen = {};
const IDS = ['d0', 'd1', 'd2', 'off'];
const browser = await chromium.launch();
try {
  for (const width of [1000, 390]) for (const theme of ['light', 'dark']) for (const load of [1, 2, 3]) {
    const label = `${width} ${theme} load ${load}`;
    const tab = await browser.newPage({viewport: {width, height: 700}, colorScheme: theme});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.addInitScript(RECORD);
    requests = [];
    started = Date.now();
    await tab.goto(`${base}/${theme}`);
    await tab.waitForFunction((ids) => customElements.get('sf-dropdown') && ids.every((id) => document.querySelector(`#${id} .sf-dropdown-field`)), IDS, {timeout: 20000})
      .catch(() => failures.push(`${label}: the dropdowns never drew`));
    const loadedAt = await tab.waitForFunction((ids) => ids.every((id) => {
      const host = document.getElementById(id);
      const list = host._list ?? host.querySelector('.sf-list');
      const glyphs = [host.querySelector('.sf-dropdown-field .sf-icon-button i.sf-icon'), ...(list?.querySelectorAll('.sf-list-search i.sf-icon, .sf-list-item-wrap i.sf-icon') ?? [])];
      return glyphs.length >= 5 && glyphs.every((g) => g?.classList.contains('sf-icon-loaded'));
    }) && Math.round(performance.now()), IDS, {timeout: 8000}).then((h) => h.jsonValue()).catch(() => null);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(4200 - Math.min(4200, Date.now() - started));
    const frames = await tab.evaluate(() => window.__frames);
    const rest = await tab.evaluate(GLYPHS, IDS);
    const open = {};
    for (const id of IDS.slice(0, 3)) {
      await tab.evaluate((one) => document.getElementById(one).openDropdown(), id);
      await tab.waitForTimeout(250);
      open[id] = (await tab.evaluate(GLYPHS, [id]))[id];
      await tab.evaluate((one) => document.getElementById(one).closeDropdown(), id);
      await tab.waitForTimeout(150);
    }
    // No shift: once a field and its chevron are drawn, their boxes stay.
    const shifts = [];
    for (const id of IDS) {
      const drawn = frames.filter((row) => row[id]?.[0] && row[id]?.[1] && !row[id][1].endsWith(',0,0'));
      const first = drawn[0];
      for (const row of drawn) if (row[id][0] !== first[id][0] || row[id][1] !== first[id][1]) { shifts.push({id, t: row.t, from: first[id], to: row[id]}); break; }
    }
    // A dropdown placed after the page settled: its names reach a request of
    // their own at once.
    const lateFrom = requests.length;
    const late = await tab.evaluate(async (options) => {
      const t0 = performance.now();
      const host = document.createElement('sf-dropdown');
      host.id = 'late';
      host.setAttribute('label', 'Поздний');
      host.setAttribute('options', JSON.stringify(options));
      document.querySelector('main').append(host);
      const done = () => {
        const list = host._list ?? host.querySelector('.sf-list');
        const glyphs = [...(list?.querySelectorAll('.sf-list-item-wrap i.sf-icon') ?? [])];
        return glyphs.length === options.length && glyphs.every((g) => g.classList.contains('sf-icon-loaded'));
      };
      while (!done() && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 20));
      return {ms: Math.round(performance.now() - t0), done: done()};
    }, [{value: 'p', text: 'Питомец', kind: 'icon', icon: 'pets'}, {value: 'h', text: 'Дом', kind: 'icon', icon: 'home'}, {value: 'w', text: 'Работа', kind: 'icon', icon: 'work'}]);
    const lateRequests = requests.slice(lateFrom).map((r) => r.icons);
    if (!late.done || late.ms > 1000) failures.push(`${label}: a late dropdown's option glyphs drew in ${late.ms} ms (done ${late.done}); requests after it ${JSON.stringify(lateRequests)}`);
    const round = requests.findIndex((r) => r.icons.some((name) => OWN.has(name)));
    const names = requests[round]?.icons ?? [];
    seen[`${width}-${theme}-${load}`] = {requests, round: round + 1, loadedAt, late, lateRequests, frames: frames.length, firstFrame: frames[0]?.t, shifts, rest, open};
    for (const name of OWN) if (!names.includes(name)) failures.push(`${label}: ${name} is not in the dropdowns' first icon_names request #${round + 1} (${names.join(',')}); all ${JSON.stringify(requests.map((r) => r.icons))}`);
    // Before the late dropdown: no second round for the first ones (a later
    // request lists every name again, as the subset grows).
    if (requests.slice(round + 1, lateFrom).length) failures.push(`${label}: the page made a second icon round before the late dropdown: ${JSON.stringify(requests.slice(round + 1, lateFrom).map((r) => r.icons))}`);
    const askedAt = requests[round]?.at ?? Infinity;
    if (loadedAt === null || (loadedAt > BUDGET_MS && loadedAt - askedAt > 500)) failures.push(`${label}: the glyphs were not all loaded within ${BUDGET_MS} ms or 500 ms of their request (${loadedAt}, asked at ${askedAt})`);
    if (shifts.length) failures.push(`${label}: shift ${JSON.stringify(shifts)}`);
    for (const [id, set] of Object.entries(open)) {
      for (const [part, rows] of [['chevron', [rest[id].chevron]], ['search', [set.search]], ['option', set.options]]) {
        if (!rows.length) failures.push(`${label} #${id}: no ${part} glyph`);
        for (const row of rows) {
          if (row.missing) { failures.push(`${label} #${id}: no ${part} glyph`); continue; }
          if (row.element !== 'sf-icon') failures.push(`${label} #${id} ${part}: a bare glyph, not an sf-icon's`);
          if (!row.loaded) failures.push(`${label} #${id} ${part}: never marked loaded`);
          if (!(row.fontSize > 0 && Math.abs(row.width - row.fontSize) <= 1.5)) failures.push(`${label} #${id} ${part}: lays out ${row.width}px at ${row.fontSize}px, not one glyph`);
        }
      }
    }
    if (errors.length) failures.push(`${label}: console ${JSON.stringify(errors)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (jsonFile) await writeFile(jsonFile, `${JSON.stringify({seen, failures}, null, 1)}\n`);
console.log(JSON.stringify({failures}, null, 1));
console.log(`DROPDOWN_GLYPHS_FIRST_PAINT ${failures.length ? 'FAIL' : 'PASS'} (${Object.keys(seen).length} loads)`);
if (failures.length) process.exit(1);
