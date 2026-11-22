#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// GB17 L1 (View list register LV2-5): a class-markup icon (<i class="sf-icon">)
// that comes into the page after load, or whose name changes, to a name the
// font in place already draws is marked sf-icon-loaded at once -- before the
// next frame -- not after the Loader observer's 100 ms debounce, during which
// it stayed unseen (sf-view-table's checked-box tick: 102-126 ms; the table
// handed its ticks over with SF.Loader.adoptStaticIcons to show them).
//
// Through the real Loader against a subset service served here (every asked
// name is in the one font it serves). The page holds home and search. After
// sf-loader-ready, in one task:
//   added-same   -- a new <i> «home»: loaded on the first frame;
//   changed-same -- an existing «home» renamed «search»: loaded on the first
//                   frame (it never loses the mark);
//   added-new    -- a new <i> «favorite» (not in the font yet): unseen until
//                   its font is in, then loaded (within 3 s);
//   ignored      -- «delete» inside data-sf-observer="ignore": the Loader does
//                   not read it (the region is the page's), adoptStaticIcons
//                   still hands it over.
// 1440 and 390, light and dark, three loads each; no page error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>icons at once</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icons-shown-at-once', pluginListVersion: 'icons-shown-at-once',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
</head><body><main><p><i class="sf-icon">home</i> <i class="sf-icon" id="rename">home</i> <i class="sf-icon">search</i></p>
<p id="late"></p><p id="ignored" data-sf-observer="ignore"></p></main></body></html>`;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page(url.searchParams.get('theme') || 'light'));
  }
  if (path === '/subset/ms/css') {
    const names = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort().join('-');
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(`@font-face { font-family: 'Material Symbols Outlined Subset'; src: url('/subset/ms/font/${names}.woff2') format('woff2'); font-weight: 400; font-display: block; }
.sf-icon { font-family: 'Material Symbols Outlined Subset'; font-feature-settings: 'liga'; }`);
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
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const results = [];
const browser = await chromium.launch({headless: true});
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      for (let load = 1; load <= LOADS; load += 1) {
        const label = `${width} ${theme} load ${load}`;
        const context = await browser.newContext({viewport: {width, height: 600}});
        const tab = await context.newPage();
        const errors = [];
        tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
        await tab.goto(`${base}/page?theme=${theme}`);
        await tab.waitForFunction(() => window.SF?.Loader && document.querySelector('main i.sf-icon.sf-icon-loaded'), null, {timeout: 15000});
        await tab.waitForTimeout(300);
        const got = await tab.evaluate(async () => {
          const late = document.getElementById('late');
          late.innerHTML = '<i class="sf-icon" data-case="added-same">home</i><i class="sf-icon" data-case="added-new">favorite</i>';
          const rename = document.getElementById('rename');
          rename.dataset.case = 'changed-same';
          const wasLoaded = rename.classList.contains('sf-icon-loaded');
          rename.textContent = 'search';
          document.getElementById('ignored').innerHTML = '<i class="sf-icon" data-case="ignored">delete</i>';
          const read = () => Object.fromEntries([...document.querySelectorAll('[data-case]')].map((el) => [el.dataset.case, el.classList.contains('sf-icon-loaded')]));
          const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
          await frame();
          const first = read();
          const t0 = performance.now();
          while (performance.now() - t0 < 3000 && !document.querySelector('[data-case="added-new"].sf-icon-loaded')) await frame();
          const later = read();
          window.SF.Loader.adoptStaticIcons(document.getElementById('ignored'));
          await new Promise((done) => setTimeout(done, 1500));
          return {wasLoaded, first, later, adopted: read().ignored};
        });
        results.push({label, ...got});
        const say = (what, detail) => failures.push({label, what, detail});
        if (!got.wasLoaded) say('the page icon was not loaded before the change', got);
        if (!got.first['added-same']) say('an added icon of a drawn name is not loaded on the first frame', got.first);
        if (!got.first['changed-same']) say('a renamed icon of a drawn name is not loaded on the first frame', got.first);
        if (got.first['added-new']) say('a new name is marked before its font', got.first);
        if (!got.later['added-new']) say('a new name is not loaded within 3 s', got.later);
        if (got.later.ignored) say('the Loader read an ignored region', got.later);
        if (!got.adopted) say('adoptStaticIcons did not hand the ignored glyph over', got);
        if (errors.length) say('page errors', errors);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(results.map(({label, first}) => ({label, first}))));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 1));
  console.error(`icons-shown-at-once: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`icons-shown-at-once: ${results.length} loads ok`);
