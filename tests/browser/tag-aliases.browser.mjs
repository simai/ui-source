#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Dated tag aliases on a build (rename plan R0; the contract half is
// tests/tag-aliases.contract.test.mjs). For every `tag` row of the build's
// Smart manifests (compatibility.aliases "<sf-old>"), through the real Loader:
//
//   1. a page whose markup names only the old tag loads the renamed bundle
//      (smart/<new folder>/js/...) and upgrades the element; the old tag's
//      class is a subclass of the new tag's;
//   2. the old tag draws as the new one: the same computed geometry and
//      colours of the element and its parts, also where another component's
//      sheet names the tag (an icon button's close glyph, :is(new, old));
//   3. the first old-tag element is named once on the console with the new tag
//      and the date, however many there are, and noted in SF.deprecations;
//      a page with the new tag alone prints nothing.
//
// sf-close -> sf-button-close is the first row, with the glyph inside a close
// icon button as the case of another component's sheet.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const smartRoot = join(out, 'smart', 'smart');
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', smartRoot],
];
for (const path of [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]) {
  if (!existsSync(path)) throw new Error(`asset not found: ${path}`);
}

// The rows, as the build ships them.
const rows = readdirSync(smartRoot)
  .filter((folder) => existsSync(join(smartRoot, folder, 'smart.manifest.json')))
  .flatMap((folder) => {
    const manifest = JSON.parse(readFileSync(join(smartRoot, folder, 'smart.manifest.json'), 'utf8'));
    return (manifest.compatibility?.aliases ?? [])
      .filter((alias) => /^<sf-[a-z0-9-]+>$/u.test(alias))
      .map((alias) => ({from: alias.slice(1, -1), to: manifest.custom_element, folder}));
  });
if (!rows.some((row) => row.from === 'sf-close' && row.to === 'sf-button-close')) throw new Error('the build carries no sf-close -> sf-button-close alias');

const head = (title) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'tag-aliases', pluginListVersion: 'tag-aliases',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body style="margin:16px">`;
const tail = '<script src="/distr/core/js/core.js"></script></body></html>';

// A close glyph inside a close icon button in the class markup, so the icon
// button's own sheet (smart/icon-button, :is(sf-button-close, sf-close)) is what
// colours it; <sf-icon-button> on the page asks the Loader for that sheet.
const inButton = (id, tag) => `<button id="${id}" type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--default sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center" aria-label="Закрыть"><${tag} size="1"></${tag}></button>`;

const pages = {
  // Only the old tag: the Loader has nothing else to go by.
  'old.html': `${head('old tag only')}
<div id="fixture" style="display:flex;gap:24px;align-items:center">
  <sf-close id="a" size="2"></sf-close>
  <sf-close id="b" size="1/2"></sf-close>
</div>${tail}`,
  // Both names side by side, alone and inside a close icon button.
  'both.html': `${head('old and new tag')}
<div id="fixture" style="display:flex;gap:24px;align-items:center">
  <sf-button-close id="new" size="3"></sf-button-close>
  <sf-close id="old" size="3"></sf-close>
  ${inButton('new-in-button', 'sf-button-close')}
  ${inButton('old-in-button', 'sf-close')}
  <sf-button-close id="plain" size="1"></sf-button-close>
  <sf-icon-button id="loader-asks-icon-button" icon="edit" aria-label="Редактировать"></sf-icon-button>
</div>${tail}`,
  // The new tag alone: a page that moved hears nothing.
  'new.html': `${head('new tag only')}
<div id="fixture"><sf-button-close id="n" size="2"></sf-button-close></div>${tail}`,
};

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path.slice(1)]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path.slice(1)]);
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

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

// What draws: the host box and the glyph's parts, as the browser computes them.
const DRAWN = ['display', 'width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'background-color', 'color'];
const ICON = ['width', 'height', 'background-color', 'mask-image', 'mask-size', 'mask-repeat'];
const drawn = (tab, selector) => tab.evaluate(([selector, drawnProps, iconProps]) => {
  const host = document.querySelector(selector);
  const root = host?.querySelector('.sf-close');
  const icon = host?.querySelector('.sf-close-icon');
  const pick = (node, props) => (node ? Object.fromEntries(props.map((prop) => [prop, getComputedStyle(node).getPropertyValue(prop)])) : null);
  const box = (node) => (node ? (({width, height}) => ({width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100}))(node.getBoundingClientRect()) : null);
  return {host: pick(host, ['display']), root: pick(root, drawnProps), icon: pick(icon, iconProps), rootBox: box(root), iconBox: box(icon)};
}, [selector, DRAWN, ICON]);

async function open(browser, name, ready) {
  const tab = await browser.newPage({viewport: {width: 1000, height: 600}});
  const warnings = [];
  const errors = [];
  const scripts = [];
  tab.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
  tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
  tab.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname); });
  await tab.goto(`${base}/${name}`);
  await tab.waitForFunction(ready, null, {timeout: 15000});
  await tab.waitForTimeout(400);
  return {tab, warnings, errors, scripts};
}

const NOTE = /<sf-close> is now <sf-button-close>; the old tag works until (\d{4}-\d{2}-\d{2})/u;
const browser = await chromium.launch();
try {
  // 1. Only the old tag.
  {
    const {tab, warnings, errors, scripts} = await open(browser, 'old.html',
      () => customElements.get('sf-close') && document.querySelectorAll('#fixture .sf-close').length === 2);
    const state = await tab.evaluate(() => ({
      oldIsSubclass: customElements.get('sf-close')?.prototype instanceof customElements.get('sf-button-close'),
      sizes: [...document.querySelectorAll('#fixture > sf-close')].map((host) => host.querySelector('.sf-close')?.className),
      deprecations: (window.SF?.deprecations?.list?.() ?? []).filter((note) => note.kind === 'tag'),
      selector: window.SF?.tags?.selector?.('sf-button-close'),
      canonical: window.SF?.tags?.canonical?.('sf-close'),
    }));
    const notes = warnings.filter((text) => NOTE.test(text));
    evidence.oldOnly = {scripts: scripts.filter((path) => /\/smart\//u.test(path)), state, notes, errors};
    check('old-tag markup alone loads the renamed bundle', scripts.some((path) => /\/smart\/button-close\/js\/button-close(\.min)?\.js$/u.test(path)), {scripts});
    check('the old tag is a subclass of the new tag\'s class', state.oldIsSubclass === true);
    check('both old-tag elements draw with their sizes', state.sizes[0]?.includes('sf-close--size-2') && state.sizes[1]?.includes('sf-close--size-1/2'), {sizes: state.sizes});
    check('the console names the new tag and the date once for two elements', notes.length === 1 && NOTE.exec(notes[0])?.[1] === '2027-01-01', {notes, warnings});
    const note = state.deprecations.find((entry) => entry.from === 'sf-close');
    check('SF.deprecations notes the old tag with its replacement, its date and both uses', note?.to === 'sf-button-close' && note?.remove_after === '2027-01-01' && note?.count === 2, {deprecations: state.deprecations});
    check('SF.tags answers for both names', state.selector === ':is(sf-button-close, sf-close)' && state.canonical === 'sf-button-close', {selector: state.selector, canonical: state.canonical});
    check('no page error', errors.length === 0, {errors});
    await tab.close();
  }

  // 2. Old and new side by side.
  {
    const {tab, warnings, errors} = await open(browser, 'both.html',
      () => customElements.get('sf-close') && customElements.get('sf-button-close') && customElements.get('sf-icon-button')
        && document.querySelectorAll('#fixture .sf-close-icon').length === 5 && document.querySelector('#loader-asks-icon-button .sf-icon-button'));
    // The icon button's sheet is on the page before the glyphs are compared.
    await tab.waitForFunction(() => [...document.styleSheets].some((sheet) => /\/smart\/icon-button\/css\//u.test(sheet.href || '')), null, {timeout: 10000}).catch(() => {});
    const alone = {new: await drawn(tab, '#new'), old: await drawn(tab, '#old')};
    const inside = {new: await drawn(tab, '#new-in-button'), old: await drawn(tab, '#old-in-button'), plain: await drawn(tab, '#plain')};
    const notes = warnings.filter((text) => NOTE.test(text));
    evidence.sideBySide = {alone, inside, notes, errors};
    check('alone: the old tag draws exactly as the new one', JSON.stringify(alone.old) === JSON.stringify(alone.new) && alone.new.root !== null, {alone});
    check('in a close icon button: the old tag draws exactly as the new one', JSON.stringify(inside.old) === JSON.stringify(inside.new) && inside.new.icon !== null, {inside});
    check('the icon button\'s sheet reaches the glyph (its colour is not the glyph\'s own)',
      inside.new.icon?.['background-color'] !== inside.plain.icon?.['background-color'], {button: inside.new.icon, plain: inside.plain.icon});
    check('one console note for the old tag', notes.length === 1, {notes});
    check('no page error', errors.length === 0, {errors});
    await tab.close();
  }

  // 3. The new tag alone.
  {
    const {tab, warnings, errors} = await open(browser, 'new.html', () => document.querySelector('#n .sf-close-icon'));
    const tagNotes = await tab.evaluate(() => (window.SF?.deprecations?.list?.() ?? []).filter((note) => note.kind === 'tag'));
    evidence.newOnly = {warnings, tagNotes, errors};
    check('a page with the new tag alone prints no tag note', !warnings.some((text) => /is now <sf-/u.test(text)) && tagNotes.length === 0, {warnings, tagNotes});
    check('no page error', errors.length === 0, {errors});
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({rows, evidence, failures}, null, 2));
if (failures.length) process.exitCode = 1;
