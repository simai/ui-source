#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// A page that brings its own icon face keeps sf-icon-loaded on the icons drawn
// in it (core.runtime 1.54.1). In a Docara example frame
// (data-docara-example-frame) the shell hands the frame its icon faces and
// Docara marks the icons it draws; the Loader, in subset mode, knew only the
// faces its own subset requests brought, so it took the class away on every
// scan and Docara put it back, about every 104 ms (2026-11-11).
//
// On ui-doc.test (pair-next-2 docs, 2026-11-11) every example frame flipped
// its icons: 6 icons, 330 removals in 8 s. Docara runs the Loader with the
// subset off ({enabled: false, accumulate: false}), its frames hold no face of
// the plain "Material Symbols Outlined" family (the icons stylesheet does not
// reach them), and the shell sends its own subset family
// "Material Symbols Outlined Subset 1923885bcfbd" with an !important rule.
//
// The pages load through the real Loader. The subset service at
// https://icons.simai.io is stubbed with Playwright. Frame pages
// (data-docara-example-frame): the icons stylesheet is not served, and once
// the Loader has started the page adds its face:
//   A. subset off, `document.fonts.add(new FontFace('Material Symbols
//      Outlined', bytes))` and a page rule drawing the icons in it, with a
//      Docara-like script that puts the class back whenever it is taken away;
//   B. subset off, Docara's way: a <style> with an @font-face of Docara's
//      subset family and Docara's !important rule, the same script;
//   C. as B, without the script: the Loader marks the icons itself;
//   E. subset on, the service and the Loader's full font refused (a sandboxed
//      frame), "Material Symbols Outlined Full" the Docara way, the script;
//   in each, every icon gets the class once and never loses it, 0 flips over
//   10 s after the face loaded, and no icon marked loaded spells its name;
//   D. a normal subset page that holds a loaded full face in document.fonts
//      (no page rule: the icons draw in the subset family): a name the subset
//      does not hold is not marked loaded before the grown subset is in, and
//      never spells its name; it is marked once that subset is in.
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = Math.max(1, Number(process.argv[3]) || 3);
const WATCH_MS = 10000;
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

const ICONS = ['home', 'search', 'settings'];

// Docara's frame runtime, cut down: an icon without the class gets it back
// once its face is loaded (FrameworkAssetPlanner::iconFallbackReadyRuntime).
const READDER = `<script>
(() => {
  const back = (icon) => {
    if (icon.classList.contains('sf-icon-loaded') || !window.__faceLoadedAt) return;
    icon.classList.add('sf-icon-loaded');
  };
  const watch = () => {
    new MutationObserver((records) => records.forEach((record) => {
      const icon = record.target.closest?.('.sf-icon');
      if (icon) back(icon);
    })).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['class']});
  };
  window.__readd = () => document.querySelectorAll('.sf-icon').forEach(back);
  document.addEventListener('DOMContentLoaded', watch, {once: true});
})();
</script>`;

const FAMILIES = {A: 'Material Symbols Outlined', B: 'Material Symbols Outlined Subset 1923885bcfbd',
  C: 'Material Symbols Outlined Subset 1923885bcfbd', E: 'Material Symbols Outlined Full'};
const frameBody = (variant) => {
  const family = FAMILIES[variant];
  const rule = `html body .sf-icon{--sf-icon--font-family:"${family}";font-family:"${family}"!important;`
    + 'font-feature-settings:"liga"!important}';
  // After the Loader has started (its first scan is done): the shell's answer.
  const add = variant !== 'A'
    ? `const style = document.createElement('style');
       style.setAttribute('data-docara-example-framework-inline-style', 'simai.framework.icon_fallback_font.css');
       style.textContent = '@font-face{font-family:"${family}";src:url("/face/full.woff2") format("woff2");'
         + 'font-style:normal;font-weight:100 700;font-display:block}${rule}';
       document.head.appendChild(style);
       await document.fonts.load('400 24px "${family}"', 'home');`
    : `const bytes = await (await fetch('/face/full.woff2')).arrayBuffer();
       const face = new FontFace('${family}', bytes, {weight: '100 700'});
       document.fonts.add(face);
       await face.load();
       const style = document.createElement('style');
       style.textContent = '${rule}';
       document.head.appendChild(style);`;
  return `${variant === 'C' ? '' : READDER}
<script>
  window.addEventListener('load', () => setTimeout(async () => {
    window.__faceAddedAt = performance.now();
    ${add}
    window.__faceLoadedAt = performance.now();
    window.__readd?.();
  }, 300));
</script>`;
};

const page = (variant) => {
  const frame = variant !== 'D';
  const icons = variant === 'E'
    ? {fallbackFontUrl: '/missing/full.woff2'}
    : frame ? {enabled: false, accumulate: false} : {preload: ['home', 'search']};
  return `<!doctype html><html lang="en" class="theme-light"${frame ? ' data-docara-example-frame' : ''}><head><meta charset="utf-8">
<title>icon faces the page brings</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {preloader: {enabled: false}, smart: {base: true}, theme: false, icons: ${JSON.stringify(icons)}};
</script></head><body style="margin:16px">
<main>
  <i class="sf-icon" aria-hidden="true">home</i>
  <i class="sf-icon" aria-hidden="true">search</i>
  ${frame ? '<i class="sf-icon" aria-hidden="true">settings</i>' : ''}
</main>
${frame ? frameBody(variant) : ''}
<script src="/distr/core/js/core.js"></script></body></html>`;
};

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const pageMatch = path.match(/^\/([ABCDE])\/$/u);
  if (pageMatch) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(pageMatch[1]));
  }
  if (path === '/face/full.woff2') {
    response.writeHead(200, {'content-type': 'font/woff2'});
    return response.end(fontBytes);
  }
  // A Docara frame gets no icons stylesheet: it holds no plain-family face.
  const from = String(request.headers.referer || '');
  if (path.startsWith('/distr/component/icons/css/') && /\/[ABCE]\/$/u.test(from)) {
    response.writeHead(404); return response.end();
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

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
// failing: the frame case (the service cannot be reached). Otherwise one
// subset for whatever is asked, the full font under the subset family; a
// request that grows the subset beyond the preload list waits GROW_DELAY.
const GROW_DELAY = 800;
const stubService = async (context, log, failing) => {
  await context.route('https://icons.simai.io/**', async (route) => {
    const url = new URL(route.request().url());
    if (failing) {
      log.push({kind: 'refused', path: url.pathname, at: Date.now()});
      return route.fulfill({status: 503, body: ''});
    }
    if (url.pathname === '/ms/css') {
      const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
      const grows = icons.some((icon) => !['home', 'search'].includes(icon));
      log.push({kind: 'css', icons, at: Date.now()});
      await wait(grows ? GROW_DELAY : 100);
      const hash = `probe-${icons.join('-')}`;
      const fontUrl = `https://icons.simai.io/ms/font/${hash}.woff2`;
      const manifest = {hash, mode: 'static-weight', type: 'outlined', origin: null, family: 'Material Symbols Outlined',
        iconCount: icons.length, icons, axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}},
        fonts: [{hash, weight: 400, url: fontUrl}]};
      const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
        .replace(/=+$/, '');
      log.push({kind: 'answered', icons, at: Date.now()});
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
      log.push({kind: 'font', path: url.pathname, at: Date.now()});
      return route.fulfill({status: 200, headers: {'content-type': 'font/woff2', 'access-control-allow-origin': '*'},
        body: fontBytes});
    }
    return route.fulfill({status: 404, body: ''});
  });
};

// From the first script on: every change of sf-icon-loaded on an icon, with
// its time (ms since navigation start), and every frame in which an icon
// marked loaded spells its name (laid out wider than one glyph, ink not
// transparent).
const RECORDER = `(() => {
  const changes = [];
  const spelled = [];
  window.__iconChanges = changes;
  window.__iconSpelled = spelled;
  const name = (el) => el.textContent.trim();
  new MutationObserver((records) => records.forEach((record) => {
    const el = record.target;
    if (!el.classList?.contains('sf-icon')) return;
    const was = /(^|\\s)sf-icon-loaded(\\s|$)/u.test(record.oldValue || '');
    const is = el.classList.contains('sf-icon-loaded');
    if (was !== is) changes.push({icon: name(el), loaded: is, at: Math.round(performance.now())});
  })).observe(document, {subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true});
  const step = () => {
    document.querySelectorAll('.sf-icon').forEach((el) => {
      const style = getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize) || 0;
      if (!fontSize) return;
      const transparent = /rgba\\(0, 0, 0, 0\\)|transparent/u.test(style.webkitTextFillColor || '');
      const range = document.createRange();
      range.selectNodeContents(el);
      const width = range.getBoundingClientRect().width;
      if (el.classList.contains('sf-icon-loaded') && !transparent && width - fontSize > 1.5) {
        spelled.push({icon: name(el), at: Math.round(performance.now()), width: Math.round(width), fontSize,
          family: style.fontFamily});
      }
    });
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})();`;

// The probe's own refusals (a sandboxed frame's service, full font and icons
// stylesheet) are not page errors.
const REFUSED = /^Failed to load resource: the server responded with a status of (404|503)/u;
const failures = [];
const evidence = {loads: LOADS, watchMs: WATCH_MS, runs: []};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();
try {
  for (const variant of ['A', 'B', 'C', 'E']) {
    for (let run = 1; run <= LOADS; run += 1) {
      const log = [];
      const context = await browser.newContext({viewport: {width: 600, height: 200}});
      await stubService(context, log, variant === 'E');
      await context.addInitScript(RECORDER);
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error' && !REFUSED.test(message.text())) errors.push(message.text()); });
      await tab.goto(`${base}/${variant}/`);
      await tab.waitForFunction(() => window.__faceLoadedAt, null, {timeout: 20000});
      const faceLoadedAt = await tab.evaluate(() => Math.round(window.__faceLoadedAt));
      await tab.waitForFunction((until) => performance.now() > until, faceLoadedAt + WATCH_MS,
        {timeout: WATCH_MS + 20000, polling: 500});
      const result = await tab.evaluate(() => ({
        changes: window.__iconChanges,
        spelled: window.__iconSpelled,
        final: [...document.querySelectorAll('.sf-icon')].map((el) => ({
          icon: el.textContent.trim(), loaded: el.classList.contains('sf-icon-loaded'),
          family: getComputedStyle(el).fontFamily})),
      }));
      await context.close();
      const after = result.changes.filter((change) => change.at >= faceLoadedAt);
      const perIcon = ICONS.map((icon) => {
        const mine = result.changes.filter((change) => change.icon === icon);
        return {icon, adds: mine.filter((change) => change.loaded).length,
          removes: mine.filter((change) => !change.loaded).length,
          removesAfterFace: after.filter((change) => change.icon === icon && !change.loaded).length,
          firstAddAt: mine.find((change) => change.loaded)?.at ?? null};
      });
      // A flip is the class taken away once it was there.
      const flips = after.filter((change) => !change.loaded).length;
      // Before the face is in, a frame whose fonts all failed shows the names
      // as it would with no Framework (the Loader settles on the failure).
      const spelled = result.spelled.filter((frame) => frame.at >= faceLoadedAt).length;
      const entry = {variant, run, faceLoadedAt, perIcon, changesAfterFace: after.length, flips, spelled,
        final: result.final, refused: log.length, errors};
      evidence.runs.push(entry);
      const tag = `${variant}${run}`;
      check(`${tag}: every icon ends loaded`, result.final.every((icon) => icon.loaded), {final: result.final});
      check(`${tag}: every icon is set once`, perIcon.every((icon) => icon.adds === 1), {perIcon});
      check(`${tag}: no icon loses the class`, perIcon.every((icon) => icon.removes === 0), {perIcon});
      check(`${tag}: 0 flips over ${WATCH_MS} ms after the face loaded`, flips === 0, {flips, after: after.slice(0, 12)});
      check(`${tag}: no icon marked loaded spells its name once the face is in`, spelled === 0, {spelled});
      if (variant === 'C') {
        // Nobody else marks them: the Loader sees the face it did not bring.
        check(`${tag}: the Loader marks the icons within 250 ms of the face`, perIcon.every((icon) => icon.firstAddAt !== null
          && icon.firstAddAt - faceLoadedAt <= 250), {perIcon, faceLoadedAt});
      }
      check(`${tag}: no page error`, errors.length === 0, {errors});
    }
  }

  // D: the Loader's own subset still decides for icons drawn in it.
  for (let run = 1; run <= LOADS; run += 1) {
    const log = [];
    const context = await browser.newContext({viewport: {width: 600, height: 200}});
    await stubService(context, log, false);
    await context.addInitScript(RECORDER);
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error' && !REFUSED.test(message.text())) errors.push(message.text()); });
    await tab.goto(`${base}/D/`);
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-icon')].length === 2
      && [...document.querySelectorAll('.sf-icon')].every((el) => el.classList.contains('sf-icon-loaded')),
    null, {timeout: 20000});
    // A full face of the icon family, loaded, in document.fonts; no page rule.
    const fullFace = await tab.evaluate(async () => {
      const bytes = await (await fetch('/face/full.woff2')).arrayBuffer();
      const face = new FontFace('Material Symbols Outlined', bytes, {weight: '100 700'});
      document.fonts.add(face);
      await face.load();
      return face.status;
    });
    const insertedAt = await tab.evaluate(() => {
      const icon = document.createElement('i');
      icon.className = 'sf-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'settings';
      document.querySelector('main').appendChild(icon);
      return Math.round(performance.now());
    });
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-icon')]
      .find((el) => el.textContent.trim() === 'settings')?.classList.contains('sf-icon-loaded'), null, {timeout: 20000});
    await wait(500);
    const result = await tab.evaluate(() => ({changes: window.__iconChanges, spelled: window.__iconSpelled,
      navigationStart: performance.timeOrigin}));
    await context.close();
    const grown = log.find((entry) => entry.kind === 'answered' && entry.icons.includes('settings'));
    const grownAt = grown ? Math.round(grown.at - result.navigationStart) : null;
    const settings = result.changes.filter((change) => change.icon === 'settings');
    const firstAdd = settings.find((change) => change.loaded)?.at ?? null;
    const entry = {variant: 'D', run, fullFace, insertedAt, grownAnsweredAt: grownAt, settingsLoadedAt: firstAdd,
      settingsChanges: settings, spelled: result.spelled.length, errors};
    evidence.runs.push(entry);
    const tag = `D${run}`;
    check(`${tag}: the full face loaded`, fullFace === 'loaded', {fullFace});
    check(`${tag}: the grown subset was asked for settings`, grownAt !== null, {log});
    check(`${tag}: settings is not marked before its subset is in`, firstAdd !== null && grownAt !== null
      && firstAdd >= grownAt, {firstAdd, grownAt, insertedAt});
    check(`${tag}: settings is set once`, settings.filter((change) => change.loaded).length === 1, {settings});
    check(`${tag}: no icon spells its name`, result.spelled.length === 0, {spelled: result.spelled.slice(0, 4)});
    check(`${tag}: no page error`, errors.length === 0, {errors});
  }
} finally {
  await browser.close();
  server.close();
}

const summary = evidence.runs.map((entry) => (entry.variant === 'D'
  ? `D${entry.run}: settings inserted ${entry.insertedAt}, grown subset answered ${entry.grownAnsweredAt}, `
    + `marked ${entry.settingsLoadedAt}, spelled frames ${entry.spelled}`
  : `${entry.variant}${entry.run}: face loaded ${entry.faceLoadedAt} ms, changes after it ${entry.changesAfterFace}, `
    + `flips ${entry.flips}, ${entry.perIcon.map((icon) => `${icon.icon} +${icon.adds}/-${icon.removes}`).join(' ')}`))
  .join('\n');
console.log(summary);
console.log(JSON.stringify({failures, evidence}, null, 2));
if (failures.length) {
  console.error(`icon-loaded-document-fonts: ${failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log('icon-loaded-document-fonts: PASS');
}
