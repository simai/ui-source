#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// R074: a cycle button's new icon draws at once after a press. The owner saw
// `grid_view` stay blank for up to ~30 s after a click on a view cycle: only
// the icon on screen was asked for, so the press asked the subset service
// for a grown font, the service built new lists one after another, and the
// Loader waited for it with no deadline (a slow answer is not an error, so
// the full-font fallback never ran).
//
// Through the real Loader against a subset service served here: it answers
// any list with the distribution's full Material Symbols font, the stylesheet
// after 250 ms and the font after 400 ms, both cacheable as the real service
// sends them (the stylesheet max-age=3600, the font immutable). The page holds
// a view cycle (sf-button-icon, view_list / grid_view), a speed cycle whose
// second item is pressed (the filled form), a theme cycle (sf-button
// theme-cycle: contrast, light_mode, dark_mode) and a pressed toggle
// (sf-button-icon star, outline and filled).
//
//   normal     -- three loads (the first in a fresh browser context: cold;
//                 two reloads: warm). The first /ms/css request lists every
//                 icon a press can show, with fill=1. Each press draws its new
//                 glyph within 1 s (cold) / 300 ms (warm), with no /ms/css
//                 request on the press, and no frame after the press shows
//                 the previous glyph.
//   slow-late  -- three loads; the first list is answered as above, every
//                 later list takes 10 s. A cycle added after boot (new names)
//                 draws within 3.5 s through the full-font fallback, the
//                 console warning names the timeout, and its press draws at
//                 once from the full font.
//   slow-boot  -- three loads; every list takes 10 s. The page's icons draw
//                 within 3.5 s of the first request through the fallback, and
//                 a press draws at once.
//
// Drawn means: the sf-icon is loaded (its glyph .sf-icon-loaded, the
// element's loaded value), the glyph has a font size, lays out one glyph wide
// (a ligature resolved, not the name spelled out) and document.fonts.check()
// answers true for its family and name. Light and dark; no page error and no
// console error in any load, no Loader warning in the normal loads.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const CSS_MS = 250;
const FONT_MS = 400;
const SLOW_MS = 10000;
const COLD_MS = 1000;
const WARM_MS = 300;
const FALLBACK_MS = 3500;
const SWITCH_ICONS = ['view_list', 'grid_view', 'speed', 'contrast', 'light_mode', 'dark_mode', 'star'];
const LATE_ICONS = ['bolt', 'rocket_launch'];

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>cycle icons</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icon-cycle-switch', pluginListVersion: 'icon-cycle-switch',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}};
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:center}</style>
</head><body><main id="main">
<sf-button-icon id="cy-view" kind="ghost" aria-label="Вид" value="list" cycle='[{"value":"list","label":"Список","icon":"view_list"},{"value":"grid","label":"Плитка","icon":"grid_view"}]'></sf-button-icon>
<sf-button-icon id="cy-speed" kind="ghost" aria-label="Скорость" value="normal" cycle="normal::Обычная::icon=speed|fast::Быстрая::icon=speed,pressed"></sf-button-icon>
<sf-button id="cy-theme" theme-cycle aria-label="Тема"></sf-button>
<sf-button-icon id="tg-star" kind="ghost" aria-label="В избранное" icon="star" pressed="false"></sf-button-icon>
</main></body></html>`;

const LATE_MARKUP = `<sf-button-icon id="cy-late" kind="ghost" aria-label="Режим" value="a" cycle='[{"value":"a","label":"Обычный","icon":"bolt"},{"value":"b","label":"Быстрый","icon":"rocket_launch"}]'></sf-button-icon>`;

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);
const fontBytes = await readFile(fontFile);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
// The service's state for one load: its mode and every /ms/css request.
let mode = 'normal';
let requests = [];
let cuts = 0;
let base = '';
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const [, theme] = /^\/(light|dark)$/u.exec(path) || [];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page(theme));
  }
  if (path === '/subset/ms/css') {
    const index = cuts++;
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    requests.push({at: Date.now(), icons, fill: url.searchParams.get('fill') === '1'});
    const slow = mode === 'slow-boot' || (mode === 'slow-late' && requests.length > 1);
    await sleep(slow ? SLOW_MS : CSS_MS);
    const fontUrl = `${base}/subset/ms/font/subset-${icons.join('-')}.woff2`;
    const manifest = {hash: `probe-${index}`, mode: 'static-weight', type: 'outlined', origin: null,
      family: 'Material Symbols Outlined', iconCount: icons.length, icons,
      axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}}, fonts: [{hash: `probe-${index}`, weight: 400, url: fontUrl}]};
    const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (response.destroyed) return undefined;
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header,
      'access-control-expose-headers': 'X-SIMAI-Font-Manifest', 'cache-control': 'public, max-age=3600'});
    return response.end(`@font-face {
  font-family: 'Material Symbols Outlined Subset';
  src: url('${fontUrl}') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}

.sf-icon {
  font-family: 'Material Symbols Outlined Subset';
  font-weight: var(--sf-icon--weight, 400);
  font-style: normal;
  line-height: 1;
  display: inline-flex;
  white-space: nowrap;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' var(--sf-icon--fill, 0), 'wght' var(--sf-icon--weight, 400), 'GRAD' var(--sf-icon--grade, 0), 'opsz' var(--sf-icon--optical-size, 24);
}
`);
  }
  if (path.startsWith('/subset/ms/font/')) {
    await sleep(FONT_MS);
    response.writeHead(200, {'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable'});
    return response.end(fontBytes);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

// Every sf-icon of the page: drawn or not (see the header).
const READ = () => [...document.querySelectorAll('main sf-icon')].map((element) => {
  const glyph = element.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon');
  const name = element.getAttribute('icon') || '';
  let width = 0;
  let fontSize = 0;
  let check = false;
  if (glyph) {
    const style = getComputedStyle(glyph);
    fontSize = parseFloat(style.fontSize);
    const range = document.createRange();
    range.selectNodeContents(glyph);
    width = Math.round(range.getBoundingClientRect().width * 10) / 10;
    try { check = document.fonts.check(`${style.fontWeight} ${fontSize || 24}px ${style.fontFamily}`, name); } catch { check = false; }
  }
  const drawn = Boolean(glyph?.classList.contains('sf-icon-loaded')) && element.loaded === true && fontSize > 0 && Math.abs(width - fontSize) <= 1.5 && check;
  return {host: element.closest('[id]')?.id || '', icon: name, drawn};
});

// A press and the frames after it, until the host's glyph is the next one
// and drawn: how long it took, and frames that showed the previous glyph.
const PRESS = async ({id, limit}) => {
  const host = document.getElementById(id);
  const icon = () => host.querySelector('sf-icon');
  const before = icon()?.getAttribute('icon') || '';
  const target = host.querySelector('button');
  const started = performance.now();
  target.click();
  // A toggle is the page's to switch, as an app does on its click.
  const toggle = host.hasAttribute('pressed') && !host.hasAttribute('cycle') && !host.hasAttribute('theme-cycle');
  if (toggle) host.pressed = host.pressed !== true;
  const frames = [];
  const state = () => {
    const element = icon();
    const glyph = element?.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon');
    const name = element?.getAttribute('icon') || '';
    const filled = element?.hasAttribute('filled') && element.getAttribute('filled') !== 'false';
    if (!glyph) return {name, filled, drawn: false, shown: false};
    const style = getComputedStyle(glyph);
    const fontSize = parseFloat(style.fontSize);
    const range = document.createRange();
    range.selectNodeContents(glyph);
    const width = range.getBoundingClientRect().width;
    let check = false;
    try { check = document.fonts.check(`${style.fontWeight} ${fontSize || 24}px ${style.fontFamily}`, name); } catch { check = false; }
    const loaded = glyph.classList.contains('sf-icon-loaded') && element.loaded === true;
    return {name, filled, shown: fontSize > 0 && style.visibility !== 'hidden', drawn: loaded && fontSize > 0 && Math.abs(width - fontSize) <= 1.5 && check};
  };
  const first = state();
  return await new Promise((done) => {
    const tick = () => {
      const now = state();
      frames.push({t: Math.round(performance.now() - started), ...now});
      const changed = now.name !== before || now.filled !== first.filled;
      if (changed && now.drawn) {
        done({before, after: now.name, filled: now.filled, ms: Math.round(performance.now() - started), frames: frames.length,
          // A frame after the press (the first one is painted before lit
          // redraws) that still shows the previous name.
          stale: frames.slice(1).filter((frame) => frame.name === before && frame.shown && before !== now.name).length});
        return;
      }
      if (performance.now() - started > limit) {
        done({before, after: now.name, filled: now.filled, ms: null, frames: frames.length, last: frames.slice(-3)});
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

const failures = [];
const seen = {};
const presses = {normal: {cold: [], warm: []}, 'slow-late': [], 'slow-boot': []};
const browser = await chromium.launch();

async function waitDrawn(tab, label, hosts, limit) {
  const started = Date.now();
  let rows = [];
  while (Date.now() - started < limit) {
    rows = await tab.evaluate(READ);
    const wanted = rows.filter((row) => hosts.includes(row.host));
    if (wanted.length === hosts.length && wanted.every((row) => row.drawn)) return {ms: Date.now() - started, rows};
    await sleep(25);
  }
  failures.push(`${label}: ${JSON.stringify(rows.filter((row) => hosts.includes(row.host) && !row.drawn))} not drawn within ${limit} ms`);
  return {ms: null, rows};
}

async function press(tab, label, id, limit, bucket) {
  const asked = requests.length;
  const result = await tab.evaluate(PRESS, {id, limit: Math.max(limit, 4000)});
  await sleep(200);
  result.requests = requests.length - asked;
  bucket.push({id, ...result});
  const name = `${label} press ${id} ${result.before}->${result.after}`;
  if (result.ms === null || result.ms > limit) failures.push(`${name}: drawn in ${result.ms} ms, limit ${limit} ms ${result.last ? JSON.stringify(result.last) : ''}`);
  if (result.stale) failures.push(`${name}: ${result.stale} frames after the press showed the previous glyph`);
  return result;
}

try {
  for (const theme of ['light', 'dark']) {
    for (const scenario of ['normal', 'slow-late', 'slow-boot']) {
      let context = null;
      let tab = null;
      for (let load = 1; load <= LOADS; load += 1) {
        const label = `${theme} ${scenario} load ${load}`;
        // normal: one context, reloaded (warm); the slow ones: a fresh
        // context each load, so every list is new to the browser.
        if (!context || scenario !== 'normal') {
          await context?.close();
          context = await browser.newContext({viewport: {width: 900, height: 300}, colorScheme: theme});
          tab = null;
        }
        if (!tab) {
          tab = await context.newPage();
          tab.on('pageerror', (error) => tab.__errors?.push(`pageerror ${error.message}`));
          tab.on('console', (message) => {
            if (message.type() === 'error') tab.__errors?.push(`error ${message.text()}`);
            if (message.type() === 'warning') tab.__warnings?.push(message.text());
          });
        }
        tab.__errors = [];
        tab.__warnings = [];
        mode = scenario;
        requests = [];
        const warm = scenario === 'normal' && load > 1;
        await tab.goto(`${base}/${theme}`);
        const until = Date.now() + 12000;
        while (!requests.length && Date.now() < until && !(warm && await tab.evaluate(() => document.querySelector('#cy-view sf-icon')?.loaded === true))) await sleep(10);
        const firstAt = requests[0]?.at ?? Date.now();
        const record = {requests: () => requests.map((one) => `${one.fill ? 'fill ' : ''}${one.icons.join(',')}`)};

        if (!warm) {
          const first = requests[0];
          if (!first) failures.push(`${label}: no /ms/css request`);
          else {
            for (const icon of SWITCH_ICONS) if (!first.icons.includes(icon)) failures.push(`${label}: the first /ms/css request lacks ${icon} (${first.icons.join(',')})`);
            if (!first.fill) failures.push(`${label}: the first /ms/css request does not ask for the filled form (pressed item, toggle)`);
          }
        }
        const bootLimit = scenario === 'slow-boot' ? FALLBACK_MS : 8000;
        const boot = await waitDrawn(tab, `${label} boot`, ['cy-view', 'cy-speed', 'cy-theme', 'tg-star'], bootLimit + (Date.now() - firstAt));
        const bootFromRequest = boot.ms === null ? null : Date.now() - firstAt;
        if (scenario === 'slow-boot' && (bootFromRequest === null || bootFromRequest > FALLBACK_MS + 300)) {
          failures.push(`${label}: the page's icons drew ${bootFromRequest} ms after the first request, limit ${FALLBACK_MS} ms`);
        }

        const entry = {firstRequest: record.requests()[0] || '(browser cache)', bootFromRequestMs: bootFromRequest};
        if (scenario === 'normal') {
          const bucket = warm ? presses.normal.warm : presses.normal.cold;
          const limit = warm ? WARM_MS : COLD_MS;
          const asked = requests.length;
          for (const id of ['cy-view', 'cy-view', 'cy-speed', 'cy-speed', 'cy-theme', 'cy-theme', 'tg-star', 'tg-star']) await press(tab, label, id, limit, bucket);
          if (requests.length !== asked) failures.push(`${label}: ${requests.length - asked} /ms/css requests during the presses`);
        } else if (scenario === 'slow-late') {
          const inserted = Date.now();
          await tab.evaluate((markup) => document.getElementById('main').insertAdjacentHTML('beforeend', markup), LATE_MARKUP);
          const late = await waitDrawn(tab, `${label} late cycle`, ['cy-late'], FALLBACK_MS + 1500);
          entry.lateDrawnMs = late.ms === null ? null : Date.now() - inserted;
          if (entry.lateDrawnMs === null || entry.lateDrawnMs > FALLBACK_MS) failures.push(`${label}: the late cycle drew in ${entry.lateDrawnMs} ms, limit ${FALLBACK_MS} ms`);
          const lateRequest = requests.slice(1).find((one) => LATE_ICONS.every((icon) => one.icons.includes(icon)));
          if (!lateRequest) failures.push(`${label}: the late cycle's icons (${LATE_ICONS}) never reached a request`);
          if (!tab.__warnings.some((text) => /timed out after \d+ ms/.test(text) || /SFLoader icon subset font fallback/.test(text))) {
            failures.push(`${label}: no console warning names the fallback timeout`);
          }
          await press(tab, label, 'cy-late', WARM_MS, presses['slow-late']);
          await press(tab, label, 'cy-view', WARM_MS, presses['slow-late']);
        } else {
          if (!tab.__warnings.some((text) => /SFLoader icon subset font fallback/.test(text))) failures.push(`${label}: no console warning names the fallback`);
          await press(tab, label, 'cy-view', WARM_MS, presses['slow-boot']);
          await press(tab, label, 'cy-theme', WARM_MS, presses['slow-boot']);
        }
        entry.requests = record.requests();
        entry.warnings = tab.__warnings.slice(0, 3);
        seen[label] = entry;
        if (tab.__errors.length) failures.push(`${label}: console ${JSON.stringify(tab.__errors)}`);
        if (scenario === 'normal' && tab.__warnings.some((text) => /SFLoader/.test(text))) failures.push(`${label}: Loader warning ${JSON.stringify(tab.__warnings)}`);
      }
      await context?.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const summary = (list) => {
  const times = list.map((one) => one.ms).filter((ms) => ms !== null).sort((a, b) => a - b);
  return {presses: list.length, maxMs: times.at(-1) ?? null, medianMs: times[Math.floor(times.length / 2)] ?? null,
    requestsOnPress: list.reduce((sum, one) => sum + (one.requests || 0), 0), staleFrames: list.reduce((sum, one) => sum + (one.stale || 0), 0)};
};
console.log(JSON.stringify({seen, presses: {
  normalCold: summary(presses.normal.cold), normalWarm: summary(presses.normal.warm),
  slowLate: summary(presses['slow-late']), slowBoot: summary(presses['slow-boot']),
}, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('ICON_CYCLE_SWITCH_OK');
