#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Glyphs inside a data-sf-observer="ignore" region, on the built bytes
// (core.runtime 1.54.0; acceptance of fix/bare-glyphs-tail, 2026-11-11, N1,
// N3 and N4). The Loader's page scan passes such a region by, so what the
// four elements not on the Smart base -- sf-sortable, sf-editor-inline,
// sf-editor-overlay, sf-resizer -- draw there is handed over by the manifest
// layer's watch (core/js/element-manifest.js watchIgnoredGlyphs). It holds:
//   1. a glyph appended into each element late, and then renamed every way
//      the page scan sees outside a region -- its text, its text node,
//      innerHTML, a nested glyph, data-icon, a class that makes it an
//      sf-icon -- is drawn (4/4 each), with a name of its own per case, none
//      in the subset, so one case cannot draw another's;
//   2. the watch stops when the element leaves: 200 elements appended into a
//      region and removed leave no watch connected, and 200 outside make none;
//   3. Smart bundles the page includes itself before core.js, whose elements
//      stand only in an ignored region, are defined (the runtime is started for
//      them once the Loader is ready) and their glyphs drawn.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep, extname} from 'node:path';
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
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error(`core.js not found under ${out}`);

const PLAIN = ['sf-sortable', 'sf-editor-inline', 'sf-editor-overlay', 'sf-resizer'];
const FOLDERS = ['sortable', 'editor-inline', 'editor-overlay', 'resizer'];
const TYPES = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.html': 'text/html'};
const BOOT = `<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},cacheVersion:'t',pluginListVersion:'t'};</script>`;
const hosts = (where) => PLAIN.map((tag) => `<${tag} data-w="${where}"><div class="row">item</div></${tag}>`).join('');
const PAGES = {
  // Hosts outside load the elements; glyphs are added inside the regions only.
  '/rename.html': `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><link rel="stylesheet" href="/distr/core/css/core.css">${BOOT}</head>
<body><section>${hosts('out')}</section><div data-sf-observer="ignore" id="late"></div><div id="plain"></div><script src="/distr/core/js/core.js"></script></body></html>`,
  // The bundles before core.js; the elements only in a region.
  '/early.html': `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><link rel="stylesheet" href="/distr/core/css/core.css">${BOOT}
${FOLDERS.map((folder) => `<script src="/distr/smart/${folder}/js/${folder}.js"></script>`).join('\n')}</head>
<body><div data-sf-observer="ignore">${PLAIN.map((tag) => `<${tag}><div class="row">item</div><i class="sf-icon" data-t>home</i></${tag}>`).join('')}</div><script src="/distr/core/js/core.js"></script></body></html>`,
};

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (PAGES[path]) { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return response.end(PAGES[path]); }
  for (const [prefix, root] of mounts) {
    if (!path.startsWith(prefix)) continue;
    const file = resolve(root, path.slice(prefix.length));
    if (file.startsWith(root + sep) && existsSync(file)) {
      response.writeHead(200, {'content-type': `${TYPES[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
      return response.end(await readFile(file));
    }
  }
  response.writeHead(404); response.end();
});
await new Promise((settle) => server.listen(0, '127.0.0.1', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// Every watch the manifest layer makes: childList + subtree + characterData +
// data-icon on one of the four elements.
const INIT = `(() => {
  const P = new Set(${JSON.stringify(PLAIN)});
  const MO = window.MutationObserver; const live = new Map(); let made = 0;
  window.MutationObserver = class extends MO {
    observe(target, options) {
      if (P.has(target?.localName) && options?.subtree && options?.characterData && options?.attributeFilter?.includes('data-icon')) { made += 1; live.set(this, target); }
      return super.observe(target, options);
    }
    disconnect() { live.delete(this); return super.disconnect(); }
  };
  window.__watches = () => ({made, live: live.size, connected: [...live.values()].filter((t) => t.isConnected).length});
})();`;

// Drawn: the glyph is an sf-icon, marked loaded, at a font size above 0, and
// its name is a ligature of the font it is set in -- one em wide, where a name
// the font does not have stays a word many ems wide. The width is read on a
// visible copy in the glyph's own computed font, because sf-editor-inline is
// hidden by design and a mark left from an earlier name proves nothing.
const DRAWN = `window.__drawn = (element) => {
  const glyph = element && element.querySelector('[data-t]');
  if (!glyph) return 'none';
  const style = getComputedStyle(glyph);
  const size = parseFloat(style.fontSize);
  if (!glyph.classList.contains('sf-icon') || !glyph.classList.contains('sf-icon-loaded') || !(size > 0)) return 0;
  const copy = document.createElement('span');
  copy.style.cssText = 'position:absolute;inset-block-start:0;white-space:nowrap;visibility:hidden;font-family:' + style.fontFamily + ';font-size:' + style.fontSize + ';font-weight:' + style.fontWeight + ';font-variation-settings:' + style.fontVariationSettings + ';font-feature-settings:' + style.fontFeatureSettings;
  copy.textContent = (glyph.getAttribute('data-icon') || glyph.textContent).trim();
  document.body.append(copy);
  const wide = copy.getBoundingClientRect().width / size;
  copy.remove();
  return wide < 1.5 ? 1 : 0;
};`;
const read = (page, scope) => page.evaluate(({tags, scope}) => tags.map((tag) => window.__drawn(document.querySelector(`${scope}${tag}`))), {tags: PLAIN, scope});

const browser = await chromium.launch();
const failures = [];
const report = {};
try {
  // 1 and 2.
  const page = await browser.newPage();
  await page.addInitScript(INIT);
  await page.addInitScript(DRAWN);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/rename.html`);
  await page.evaluate(async (tags) => Promise.race([Promise.all(tags.map((tag) => customElements.whenDefined(tag))), new Promise((settle) => setTimeout(settle, 10000))]), PLAIN);
  await page.evaluate(() => window.SF.ready?.());
  const CASES = [
    ['text', 'rocket_launch', (g, name) => { g.textContent = name; }],
    ['text node', 'savings', (g, name) => { g.firstChild.data = name; }],
    ['innerHTML', 'pets', (g, name) => { g.innerHTML = name; }],
    ['nested', 'anchor', (g, name) => { const holder = document.createElement('div'); holder.innerHTML = `<span><i class="sf-icon" data-t>${name}</i></span>`; g.replaceWith(holder); }],
    ['data-icon', 'forest', (g, name) => { g.textContent = ''; g.setAttribute('data-icon', name); }],
    ['class', 'sailing', (g, name) => { const plain = document.createElement('i'); plain.dataset.t = ''; plain.textContent = name; g.replaceWith(plain); }],
  ];
  // The class case becomes a glyph a moment after it is placed, in a task of its own.
  const LATER = {class: (g) => { g.className = 'sf-icon'; }};
  await page.evaluate((tags) => {
    const late = document.getElementById('late');
    late.innerHTML = tags.map((tag) => `<${tag} data-w="late"><div class="row">item</div><i class="sf-icon" data-t>home</i></${tag}>`).join('');
  }, PLAIN);
  await page.waitForTimeout(2000);
  report.appended = await read(page, '#late ');
  for (const [name, icon, change] of CASES) {
    await page.evaluate(({tags, icon, change}) => {
      const apply = new Function(`return (${change})`)();
      for (const tag of tags) apply(document.querySelector(`#late ${tag} [data-t]`), icon);
    }, {tags: PLAIN, icon, change: change.toString()});
    if (LATER[name]) {
      await page.waitForTimeout(300);
      await page.evaluate(({tags, later}) => {
        const apply = new Function(`return (${later})`)();
        for (const tag of tags) apply(document.querySelector(`#late ${tag} [data-t]`));
      }, {tags: PLAIN, later: LATER[name].toString()});
    }
    await page.waitForTimeout(2500);
    report[name] = await read(page, '#late ');
  }
  for (const key of ['appended', ...CASES.map(([name]) => name)]) {
    const got = report[key].filter((value) => value === 1).length;
    if (got !== PLAIN.length) failures.push(`${key}: ${got}/${PLAIN.length} drawn (${PLAIN.map((tag, at) => `${tag} ${report[key][at]}`).join(', ')})`);
  }
  const before = await page.evaluate(() => window.__watches());
  await page.evaluate((tags) => {
    const region = document.getElementById('late');
    const plain = document.getElementById('plain');
    for (let n = 0; n < 50; n += 1) for (const tag of tags) {
      const inside = document.createElement(tag); inside.innerHTML = '<i class="sf-icon">home</i>'; region.append(inside); inside.remove();
      const outside = document.createElement(tag); outside.innerHTML = '<i class="sf-icon">home</i>'; plain.append(outside); outside.remove();
    }
  }, PLAIN);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__watches());
  report.watches = {before, after};
  if (after.made - before.made !== 200) failures.push(`200 elements in a region made ${after.made - before.made} watches`);
  if (after.live !== before.live || after.connected !== before.connected) failures.push(`watches left after the elements went: ${JSON.stringify({before, after})}`);
  if (errors.length) failures.push(`page errors: ${errors.join('; ')}`);
  await page.close();

  // 3.
  const early = await browser.newPage();
  await early.addInitScript(DRAWN);
  const earlyErrors = [];
  early.on('pageerror', (error) => earlyErrors.push(error.message));
  await early.goto(`${origin}/early.html`);
  const defined = await early.evaluate(async (tags) => Promise.all(tags.map((tag) => Promise.race([
    customElements.whenDefined(tag).then(() => true), new Promise((settle) => setTimeout(() => settle(false), 10000))]))), PLAIN);
  await early.waitForTimeout(2000);
  const earlyDrawn = await read(early, '');
  report.early = {defined, drawn: earlyDrawn};
  PLAIN.forEach((tag, at) => {
    if (!defined[at]) failures.push(`${tag}: its bundle came before core.js and it stands only in an ignored region; not defined in 10 s`);
    else if (earlyDrawn[at] !== 1) failures.push(`${tag}: defined, its glyph not drawn`);
  });
  if (earlyErrors.length) failures.push(`page errors (early bundles): ${earlyErrors.join('; ')}`);
  await early.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('ignored-region glyphs: every case drawn, watches stop, early bundles defined');
