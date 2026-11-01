#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A subset that grows must not blank the icons it already drew. On
// effects.simai.io (pair ui-76c3b120303e) the theme button turned light_mode
// into dark_mode; the Loader asked the subset service for a grown subset, the
// new @font-face for 'Material Symbols Outlined Subset' shadowed the loaded
// one while its file was on the way, and with font-display: block every icon
// on the page went blank until the file arrived -- the owner saw the icons in
// the buttons vanish on a click and come back.
//
// The page loads through the real Loader against a subset service served here
// (the first subset is one the service cut, without dark_mode; the
// distribution's full Material Symbols font stands in for the grown one). The first subset is answered at once; every later one is held back --
// the stylesheet a little, the font file well over the sampled window. A click
// turns a button's icon into a name the page has not drawn yet. What it holds:
//   1. each icon that already showed keeps its glyph: on screen at ~30, 120
//      and 300 ms after the click it keeps at least half the ink it had
//      before, and at every frame for 600 ms its text lays out one glyph wide
//      and document.fonts holds a loaded face for it;
//   2. the new name waits unseen until its glyph is in: at no frame is it
//      drawn as its name in a fallback font (the observer's debounce let
//      "light_mode" show spelled out on effects.simai.io);
//   3. the grown subset was asked for, and once its file is in, the new name
//      draws as a glyph too;
//   4. the page raised no error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
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
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
// The first subset, as the service cut it: every icon on the page but
// dark_mode, so the new name is not drawn until the grown subset is in.
const firstSubset = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'icons-subset-grow',
  'subset-without-dark-mode.woff2');
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css'), fontFile, firstSubset]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const page = `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8"><title>a growing icon subset</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icons-subset-grow', pluginListVersion: 'icons-subset-grow',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}, theme: false};
</script></head><body style="margin:16px">
<div style="display:flex;gap:16px;align-items:center">
  <i class="sf-icon" data-probe="home" aria-hidden="true">home</i>
  <span class="sf-icon sf-icon--size-5" data-probe="settings" aria-hidden="true">settings</span>
  <button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center" aria-label="Mail"><i class="sf-icon" data-probe="mail" aria-hidden="true">mail</i></button>
  <sf-icon icon="favorite" label="Favourite"></sf-icon>
  <sf-icon-button icon="notifications" aria-label="Notifications"></sf-icon-button>
  <button type="button" id="theme" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center" aria-label="Theme"><i class="sf-icon" id="theme-glyph" aria-hidden="true">light_mode</i></button>
</div>
<script>
  document.getElementById('theme').addEventListener('click', () => {
    const glyph = document.getElementById('theme-glyph');
    glyph.textContent = glyph.textContent.trim() === 'light_mode' ? 'dark_mode' : 'light_mode';
  });
</script>
<script src="/distr/core/js/core.js"></script></body></html>`;

// The subset service: CSS with the manifest header the real one sends, and a
// font file per subset. Every request after the first is held back.
const CSS_DELAY = 150;
const FONT_DELAY = 2500;
const cssRequests = [];
const fontRequests = [];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let base = '';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  if (path === '/subset/ms/css') {
    const index = cssRequests.length;
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    cssRequests.push(icons);
    if (index > 0) await wait(CSS_DELAY);
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
    fontRequests.push({path, at: Date.now()});
    if (!path.endsWith('subset-0.woff2')) await wait(FONT_DELAY);
    response.writeHead(200, {'content-type': 'font/woff2'});
    return response.end(await readFile(path.endsWith('subset-0.woff2') ? firstSubset : fontFile));
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
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

// One icon's state: the width its text lays out at (a ligature is one glyph,
// as wide as the font size; a blank icon lays its name out in an invisible
// fallback), and whether document.fonts holds a loaded face for it.
const READ = () => [...document.querySelectorAll('.sf-icon')].map((el) => {
  const text = el.textContent.trim();
  const range = document.createRange();
  range.selectNodeContents(el);
  const width = range.getBoundingClientRect().width;
  const style = getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  const family = style.fontFamily.split(',')[0].trim();
  return {
    text,
    owner: el.closest('sf-icon-button') ? 'sf-icon-button' : el.closest('sf-icon') ? 'sf-icon' : 'static',
    width: Math.round(width * 10) / 10,
    fontSize,
    glyph: fontSize > 0 && Math.abs(width - fontSize) <= 1.5,
    faceLoaded: document.fonts.check(`${style.fontWeight} ${fontSize || 24}px ${family}`, text),
  };
});

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1000, height: 400}});
  const errors = [];
  tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
  await tab.goto(`${base}/page.html`);
  await tab.waitForFunction(() => customElements.get('sf-icon') && customElements.get('sf-icon-button')
    && document.querySelectorAll('sf-icon .sf-icon, sf-icon-button .sf-icon').length >= 2, null, {timeout: 15000});
  // Every icon on the page drawn from the first subset.
  await tab.waitForFunction(`(${READ})().every((icon) => icon.glyph && icon.faceLoaded)`, null, {timeout: 10000})
    .catch(() => {});
  const before = await tab.evaluate(READ);
  evidence.before = before;
  check('the first subset was asked for', cssRequests.length >= 1, {cssRequests});
  check('the first subset does not hold light_mode back from the page', cssRequests[0]?.includes('light_mode'), {cssRequests});
  for (const icon of before) check('every icon draws its glyph before the click', icon.glyph && icon.faceLoaded, icon);
  const requestsBefore = cssRequests.length;

  // Ink: what a screenshot shows inside each icon's box, counted in the page
  // from the PNG. A blank icon has none, whatever its layout says.
  const boxes = await tab.evaluate(() => [...document.querySelectorAll('.sf-icon')]
    .filter((el) => el.id !== 'theme-glyph')
    .map((el) => {
      const box = el.getBoundingClientRect();
      return {text: el.textContent.trim(), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height)};
    }));
  const ink = async () => {
    const png = (await tab.screenshot({clip: {x: 0, y: 0, width: 1000, height: 120}})).toString('base64');
    return tab.evaluate(async ({png, boxes}) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const scale = image.width / 1000;
      return Object.fromEntries(boxes.map((box) => {
        const data = context.getImageData(Math.round(box.x * scale), Math.round(box.y * scale),
          Math.max(1, Math.round(box.w * scale)), Math.max(1, Math.round(box.h * scale))).data;
        const [r0, g0, b0] = data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 96) count += 1;
        }
        return [box.text, count];
      }));
    }, {png, boxes});
  };
  const baseline = await ink();
  evidence.baseline = baseline;
  for (const [text, count] of Object.entries(baseline)) check(`${text} has ink before the click`, count > 20, {count});

  // Click, then read every icon at every frame for 600 ms, and look at the
  // screen at ~30, 120 and 300 ms.
  await tab.evaluate(`(() => {
    const read = ${READ};
    window.__probeFrames = [];
    document.getElementById('theme').click();
    const start = performance.now();
    window.__probeDone = new Promise((done) => {
      const step = () => {
        const at = performance.now() - start;
        window.__probeFrames.push({at: Math.round(at), icons: read()});
        if (at < 600) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  })()`);
  const clicked = Date.now();
  evidence.samples = {};
  for (const ms of [30, 120, 300]) {
    const left = ms - (Date.now() - clicked);
    if (left > 0) await wait(left);
    const at = Date.now() - clicked;
    const seen = await ink();
    evidence.samples[`${ms}ms`] = {at, ink: seen};
    for (const [text, count] of Object.entries(seen)) {
      check(`${text} keeps its ink at ~${ms} ms after the click`, count >= baseline[text] * 0.5, {at, count, before: baseline[text]});
    }
  }
  await tab.evaluate(() => window.__probeDone);
  const frames = await tab.evaluate(() => window.__probeFrames);
  const others = (icons) => icons.filter((icon) => icon.text !== 'dark_mode');
  evidence.frames = frames.length;
  check('frames were sampled across the window', frames.length >= 10 && frames.at(-1).at >= 600, {frames: frames.length});
  check('the grown subset was asked for within the window', cssRequests.length > requestsBefore
    && cssRequests.at(-1).includes('dark_mode'), {cssRequests});
  // The window is the page's own: the last frame read, against when the
  // grown file could first have arrived.
  const arrives = fontRequests.length >= 2 ? fontRequests.at(-1).at + FONT_DELAY - clicked : 0;
  check('the grown subset file was still on its way at the end of the window', arrives > frames.at(-1).at,
    {lastFrame: frames.at(-1).at, arrives, fontRequests: fontRequests.map(({path, at}) => ({path, sinceClick: at - clicked}))});
  for (const frame of frames) {
    const changed = frame.icons.find((icon) => icon.text === 'dark_mode');
    check('the new name waits unseen, never spelled out in a fallback font',
      changed && (changed.fontSize === 0 || (changed.glyph && changed.faceLoaded)), {at: frame.at, ...changed});
    for (const icon of others(frame.icons)) {
      check(`an icon that showed keeps its glyph after the click (${icon.text})`, icon.glyph && icon.faceLoaded,
        {at: frame.at, ...icon});
    }
  }

  // 2. Once the grown file is in, the new name draws as well.
  await tab.waitForFunction(`(${READ})().every((icon) => icon.glyph && icon.faceLoaded)`, null, {timeout: 10000})
    .catch(() => {});
  const after = await tab.evaluate(READ);
  evidence.after = after;
  const dark = after.find((icon) => icon.text === 'dark_mode');
  check('the new name draws as a glyph once its subset is in', dark?.glyph && dark?.faceLoaded, {dark});
  for (const icon of after) check('every icon draws its glyph after the grown subset', icon.glyph && icon.faceLoaded, icon);
  const styles = await tab.evaluate(() => document.querySelectorAll('style[data-sf-icons-subset-family="outlined"]').length);
  check('one subset stylesheet is left for the family', styles === 1, {styles});
  check('the page raised no error', errors.length === 0, {errors});
  evidence.cssRequests = cssRequests;
} finally {
  await browser.close();
  server.close();
}

// Failures folded by name: one blank icon shows in every frame.
const folded = Object.values(failures.reduce((all, failure) => {
  all[failure.name] ??= {...failure, count: 0};
  all[failure.name].count += 1;
  return all;
}, {}));
console.log(JSON.stringify({passed: failures.length === 0, failures: folded, evidence: {baseline: evidence.baseline, samples: evidence.samples,
  frames: evidence.frames, cssRequests: evidence.cssRequests, before: evidence.before?.length}}, null, 1));
process.exitCode = failures.length ? 1 : 0;
