#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A page whose origin already had the icon face draws its icon buttons with
// their glyphs from the first frame they are on screen. On effects.simai.io
// (pair ui-2d39b617a719) the header's sf-icon-button squares painted empty for
// some 340 ms on every load, a warm cache included (language switch en -> ru,
// Chromium and WebKit): the Loader wiped the subset it remembered on a page
// that sets no cacheVersion, so it asked the subset service again after boot,
// and the @font-face went in only once that answer was back.
//
// The page loads through the real Loader, configured the way the effects site
// is (no cacheVersion, the default subset host, an icons.preload list). The
// subset service at https://icons.simai.io is stubbed here with Playwright: the
// stylesheet always takes a while, a font file takes a while the first time a
// URL is asked for and is answered at once after that (the HTTP cache the stub
// cannot use -- routing turns the browser's cache off). Every frame from the
// first script on reads the header's icons. What it holds:
//   1. cold: the first load on the origin still draws every icon (the
//      subset service path), and the page raised no error;
//   2. warm: a second page on the same origin draws every icon button's glyph
//      in the first frame the button shows its icon, and draws it before the
//      subset service has answered;
//   3. a remembered subset whose font is not on the subset host is not used:
//      nothing is asked of that host, and the page draws its icons the cold way;
//   4. icons.remember = false: nothing is remembered, the second load is cold.
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {createServer} from 'node:http';
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css'), fontFile]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);
const fontBytes = await readFile(fontFile);

const HEADER_ICONS = ['language', 'dark_mode', 'menu'];
const GROWN_ICON = 'settings';
const page = (lang, extra = '', icons = HEADER_ICONS) => `<!doctype html><html lang="${lang}" class="theme-light"><head><meta charset="utf-8"><title>icons from the first frame</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {preloader: {enabled: false}, smart: {base: true}, theme: false,
    icons: {preload: ${JSON.stringify(HEADER_ICONS)}${extra}}};
</script></head><body style="margin:16px">
<header style="display:flex;gap:8px;align-items:center">
  ${icons.map((icon) => `<sf-icon-button icon="${icon}" aria-label="${icon}"></sf-icon-button>`).join('\n  ')}
  <i class="sf-icon" aria-hidden="true">home</i>
</header>
<script src="/distr/core/js/core.js"></script></body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const pageMatch = path.match(/^\/(en|ru|de|fr)\/(remember-off\/)?$/u);
  if (pageMatch) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    // fr: one icon button more than the pages before it had.
    return response.end(page(pageMatch[1], pageMatch[2] ? ', remember: false' : '',
      pageMatch[1] === 'fr' ? [...HEADER_ICONS, GROWN_ICON] : HEADER_ICONS));
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
const base = `http://127.0.0.1:${server.address().port}`;

// The stubbed subset service. One subset for whatever is asked: the
// distribution's full font under the subset family, so any name draws.
const CSS_DELAY = 250;
const FONT_COLD_DELAY = 400;
const FONT_WARM_DELAY = 5;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const stubService = async (context, log) => {
  const fontsSeen = new Set();
  await context.route('https://icons.simai.io/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/ms/css') {
      const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
      log.push({kind: 'css', icons, at: Date.now()});
      await wait(CSS_DELAY);
      const hash = `probe-${icons.join('-')}`;
      const fontUrl = `https://icons.simai.io/ms/font/${hash}.woff2`;
      const manifest = {hash, mode: 'static-weight', type: 'outlined', origin: null, family: 'Material Symbols Outlined',
        iconCount: icons.length, icons, axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}},
        fonts: [{hash, weight: 400, url: fontUrl}]};
      const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
        .replace(/=+$/, '');
      return route.fulfill({status: 200, headers: {'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header,
        'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-SIMAI-Font-Manifest'},
      body: `@font-face {
  font-family: 'Material Symbols Outlined Subset';
  src: url('${fontUrl}') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}

.sf-icon {
  font-family: 'Material Symbols Outlined Subset';
  font-feature-settings: 'liga';
}
`});
    }
    if (url.pathname.startsWith('/ms/font/')) {
      const warm = fontsSeen.has(url.pathname);
      fontsSeen.add(url.pathname);
      log.push({kind: 'font', path: url.pathname, warm, at: Date.now()});
      await wait(warm ? FONT_WARM_DELAY : FONT_COLD_DELAY);
      return route.fulfill({status: 200, headers: {'content-type': 'font/woff2', 'access-control-allow-origin': '*'},
        body: fontBytes});
    }
    return route.fulfill({status: 404, body: ''});
  });
  await context.route('https://evil.invalid/**', (route) => {
    log.push({kind: 'foreign', url: route.request().url(), at: Date.now()});
    return route.fulfill({status: 404, body: ''});
  });
};

// Every frame from the first script on: is each header icon on screen, and is
// it drawn as its glyph? On screen: the button has drawn its icon element at a
// non-zero size. Drawn: the text lays out one glyph wide (a ligature is as wide
// as the font size; a face still loading lays the name out in an invisible
// fallback), its ink is not transparent (data-sf-icons="subset-pending"), and
// document.fonts holds a loaded face of its family.
const SAMPLER = `(() => {
  const frames = [];
  window.__iconFrames = frames;
  const read = () => [...document.querySelectorAll('header .sf-icon')].map((el) => {
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize) || 0;
    const range = document.createRange();
    range.selectNodeContents(el);
    const width = range.getBoundingClientRect().width;
    const family = style.fontFamily.split(',')[0].trim().replace(/["']/gu, '');
    const faceLoaded = [...document.fonts].some((face) => face.family.replace(/["']/gu, '') === family
      && face.status === 'loaded');
    const transparent = /rgba\\(0, 0, 0, 0\\)|transparent/u.test(style.webkitTextFillColor || '');
    return {
      text: el.textContent.trim(),
      owner: el.closest('sf-icon-button') ? 'sf-icon-button' : 'static',
      shown: fontSize > 0,
      drawn: fontSize > 0 && Math.abs(width - fontSize) <= 1.5 && faceLoaded && !transparent,
      spelled: fontSize > 0 && !transparent && Math.abs(width - fontSize) > 1.5,
      fontSize, width: Math.round(width * 10) / 10, family, faceLoaded, transparent,
    };
  });
  const start = performance.now();
  const step = () => {
    const at = performance.now();
    const squares = [...document.querySelectorAll('header sf-icon-button')].filter((host) => {
      const box = (host.querySelector('button') || host).getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }).length;
    frames.push({at: Math.round(at), squares, icons: read()});
    if (at - start < 5000) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})();`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

// From the frames: when every header button first stood on screen as a
// square, and when every one of them first drew its glyph (ms since
// navigation start); the frames in between are the empty squares.
const summarise = (frames) => {
  const buttons = (frame) => frame.icons.filter((icon) => icon.owner === 'sf-icon-button');
  const allShown = frames.find((frame) => frame.squares === HEADER_ICONS.length);
  const allDrawn = frames.find((frame) => buttons(frame).length === HEADER_ICONS.length
    && buttons(frame).every((icon) => icon.drawn));
  const shownNotDrawn = frames.filter((frame) => frame.squares > 0
    && (buttons(frame).length < frame.squares || buttons(frame).some((icon) => !icon.drawn)));
  const staticDrawn = frames.find((frame) => frame.icons.some((icon) => icon.owner === 'static' && icon.drawn));
  return {
    shownAt: allShown?.at ?? null,
    drawnAt: allDrawn?.at ?? null,
    emptyFrames: shownNotDrawn.length,
    emptyFrom: shownNotDrawn[0]?.at ?? null,
    emptyExample: shownNotDrawn[0] ? buttons(shownNotDrawn[0]).find((icon) => !icon.drawn) ?? null : null,
    staticDrawnAt: staticDrawn?.at ?? null,
  };
};

const load = async (tab, url, log) => {
  const errors = [];
  const onError = (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); };
  tab.on('pageerror', onError);
  const from = log.length;
  await tab.goto(url);
  await tab.waitForFunction(() => window.__iconFrames?.length
    && performance.now() - window.__iconFrames[0].at > 4800, null, {timeout: 20000});
  const frames = await tab.evaluate(() => window.__iconFrames);
  const navigationStart = await tab.evaluate(() => performance.timeOrigin);
  tab.off('pageerror', onError);
  const requests = log.slice(from).map((entry) => ({...entry, at: Math.round(entry.at - navigationStart)}));
  return {summary: summarise(frames), requests, errors};
};

const browser = await chromium.launch();
try {
  // 1 and 2: cold, then warm, on one origin.
  {
    const log = [];
    const context = await browser.newContext({viewport: {width: 800, height: 200}});
    await stubService(context, log);
    await context.addInitScript(SAMPLER);
    const tab = await context.newPage();
    const cold = await load(tab, `${base}/en/`, log);
    evidence.cold = cold;
    check('cold: every header icon draws its glyph', cold.summary.drawnAt !== null, cold.summary);
    check('cold: the subset service was asked', cold.requests.some((entry) => entry.kind === 'css'), {requests: cold.requests});
    check('cold: the page raised no error', cold.errors.length === 0, {errors: cold.errors});

    for (const lang of ['ru', 'de']) {
      const warm = await load(tab, `${base}/${lang}/`, log);
      evidence[`warm-${lang}`] = warm;
      check(`warm (${lang}): every header icon draws its glyph`, warm.summary.drawnAt !== null, warm.summary);
      check(`warm (${lang}): no frame shows an icon button without its glyph`, warm.summary.emptyFrames === 0, warm.summary);
      check(`warm (${lang}): the glyphs are drawn in the frame the buttons first stand on screen`,
        warm.summary.shownAt !== null && warm.summary.drawnAt === warm.summary.shownAt, warm.summary);
      const css = warm.requests.find((entry) => entry.kind === 'css');
      check(`warm (${lang}): the glyphs do not wait for the subset service`,
        !css || warm.summary.drawnAt < css.at + CSS_DELAY, {drawnAt: warm.summary.drawnAt, css});
      check(`warm (${lang}): the page raised no error`, warm.errors.length === 0, {errors: warm.errors});
    }

    // A page with one name the remembered subset does not hold: the names it
    // holds draw from the first frame, the new one waits unseen (never spelled
    // out) and draws once the grown subset's face is in.
    const grown = await load(tab, `${base}/fr/`, log);
    const frames = await tab.evaluate(() => window.__iconFrames);
    const squaresAt = frames.find((frame) => frame.squares === HEADER_ICONS.length + 1)?.at ?? null;
    const known = (frame) => frame.icons.filter((icon) => HEADER_ICONS.includes(icon.text) && icon.owner === 'sf-icon-button');
    const knownLate = frames.filter((frame) => frame.at >= (squaresAt ?? Infinity)
      && (known(frame).length < HEADER_ICONS.length || known(frame).some((icon) => !icon.drawn)));
    const spelled = frames.filter((frame) => frame.icons.some((icon) => icon.text === GROWN_ICON && icon.spelled));
    const newDrawnAt = frames.find((frame) => frame.icons.some((icon) => icon.text === GROWN_ICON && icon.drawn))?.at ?? null;
    evidence.grown = {...grown, squaresAt, knownLate: knownLate.length, spelled: spelled.length, newDrawnAt};
    check('grown: the remembered names draw from the first frame', squaresAt !== null && knownLate.length === 0,
      {squaresAt, knownLate: knownLate.length, example: knownLate[0]});
    check('grown: the new name is never spelled out', spelled.length === 0, {example: spelled[0]});
    check('grown: the new name draws once its subset is in', newDrawnAt !== null, {newDrawnAt, requests: grown.requests});
    check('grown: one subset stylesheet is left for the family',
      await tab.evaluate(() => document.querySelectorAll('style[data-sf-icons-subset-family="outlined"]').length) === 1);
    check('grown: the page raised no error', grown.errors.length === 0, {errors: grown.errors});
    await context.close();
  }

  // 3: a remembered subset that names a font off the subset host.
  {
    const log = [];
    const context = await browser.newContext({viewport: {width: 800, height: 200}});
    await stubService(context, log);
    await context.addInitScript(`try {
      if (!sessionStorage.getItem('probe-seeded')) {
        sessionStorage.setItem('probe-seeded', '1');
        localStorage.setItem('SF_ICON_SUBSET_MANIFEST', JSON.stringify({hash: 'foreign', type: 'outlined',
          family: 'Material Symbols Outlined', icons: ${JSON.stringify(HEADER_ICONS)},
          axes: {wght: {mode: 'fixed', value: 400}}, fonts: [{weight: 400, url: 'https://evil.invalid/x.woff2'}]}));
      }
    } catch {}`);
    await context.addInitScript(SAMPLER);
    const tab = await context.newPage();
    const foreign = await load(tab, `${base}/en/`, log);
    const leftovers = await tab.evaluate(() => [...document.querySelectorAll('style, link')]
      .filter((node) => (node.textContent + (node.href || '')).includes('evil.invalid')).length);
    evidence.foreign = foreign;
    check('foreign: nothing is asked of a host that is not the subset host',
      !foreign.requests.some((entry) => entry.kind === 'foreign') && leftovers === 0, {requests: foreign.requests, leftovers});
    check('foreign: the page still draws its icons', foreign.summary.drawnAt !== null, foreign.summary);
    check('foreign: the page raised no error', foreign.errors.length === 0, {errors: foreign.errors});
    await context.close();
  }

  // 4: icons.remember = false.
  {
    const log = [];
    const context = await browser.newContext({viewport: {width: 800, height: 200}});
    await stubService(context, log);
    await context.addInitScript(SAMPLER);
    const tab = await context.newPage();
    await load(tab, `${base}/en/remember-off/`, log);
    const stored = await tab.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('SF_ICON_SUBSET')));
    const second = await load(tab, `${base}/ru/remember-off/`, log);
    evidence.rememberOff = {stored, second};
    check('remember off: nothing is stored', stored.length === 0, {stored});
    check('remember off: the second load asks the service again', second.requests.some((entry) => entry.kind === 'css'),
      {requests: second.requests});
    check('remember off: the second load still draws its icons', second.summary.drawnAt !== null, second.summary);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({passed: failures.length === 0, failures, evidence}, null, 1));
process.exitCode = failures.length ? 1 : 0;
