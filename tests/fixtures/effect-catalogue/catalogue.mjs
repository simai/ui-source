// A fake simai/ui-effects catalogue for the SF.Effects probes, in the form the
// real one publishes (catalogue/index.json, simai.ui-effects.catalogue v1:
// effects/<id>/ with effect.json and index.js, a SHA-256 and a size per file),
// built from the kit fixture tests/fixtures/effect-schemes, and a page that
// serves it beside the built core at https://probe.test/ through Playwright's
// router. Nothing leaves the browser: every other address answers 404 and is
// recorded, so a probe can prove a foreign address was never asked for.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..');
const bands = JSON.parse(readFileSync(join(fixtures, 'effect-schemes', 'effect.json'), 'utf8'));
const source = readFileSync(join(fixtures, 'effect-schemes', 'sample-bands.js'), 'utf8');

export const ORIGIN = 'https://probe.test';
export const BASE = `${ORIGIN}/cat/`;
export const FOREIGN_PAIR = 'https://foreign.test/effects/dawn-bands/effect.json';

// The module, marked: its top level and its mount each leave a trace on the
// page, so a probe can tell whether it was ever executed.
const marked = (id) => `globalThis.__effectRan = [...(globalThis.__effectRan ?? []), ${JSON.stringify(id)}];\n`
  + source.replace('export function mount(host, settings, context) {\n', `export function mount(host, settings, context) {\n  globalThis.__effectMounted = [...(globalThis.__effectMounted ?? []), ${JSON.stringify(id)}];\n`);

const manifest = (id, fields) => {
  const value = {...bands, id, entry: 'index.js', label: {ru: id, en: id}, ...fields};
  for (const [key, field] of Object.entries(fields)) if (field === undefined) delete value[key];
  return value;
};

// Every effect the probes need: both schemes, a dark one paired with a light
// one by id (and back), a dark one paired by a foreign address, a light one
// alone, one without the windows capability, and two tampered ones.
export const EFFECTS = {
  'sample-bands': manifest('sample-bands', {}),
  'night-bands': manifest('night-bands', {schemes: ['dark'], pair: 'day-bands'}),
  'day-bands': manifest('day-bands', {schemes: ['light'], pair: 'night-bands'}),
  'dusk-bands': manifest('dusk-bands', {schemes: ['dark'], pair: FOREIGN_PAIR}),
  'lone-light': manifest('lone-light', {schemes: ['light'], capabilities: undefined}),
  'tampered-module': manifest('tampered-module', {}),
  'tampered-manifest': manifest('tampered-manifest', {}),
};

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// path -> bytes served; the index holds the digests of the honest bytes, and
// the two tampered effects are served with one byte changed.
export function buildCatalogue() {
  const files = new Map();
  const entries = [];
  for (const [id, value] of Object.entries(EFFECTS)) {
    const honest = {
      'effect.json': Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
      'index.js': Buffer.from(marked(id)),
    };
    const served = {...honest};
    // One byte: a space becomes a tab, so the bytes still parse and only the digest tells.
    const flip = (bytes, at) => {
      const copy = Buffer.from(bytes);
      copy[at] = copy[at] === 0x20 ? 0x09 : 0x20;
      return copy;
    };
    if (id === 'tampered-module') served['index.js'] = flip(honest['index.js'], honest['index.js'].indexOf(' '));
    if (id === 'tampered-manifest') served['effect.json'] = flip(honest['effect.json'], honest['effect.json'].indexOf('"id"') - 1);
    for (const [name, bytes] of Object.entries(served)) files.set(`/cat/effects/${id}/${name}`, bytes);
    entries.push({
      id,
      version: value.version,
      label: value.label,
      description: {ru: id},
      role: {ru: id},
      schemes: value.schemes ?? ['dark', 'light'],
      pair: typeof value.pair === 'string' && !value.pair.startsWith('https://') ? value.pair : null,
      tags: ['probe'],
      surfaces: value.surfaces,
      path: `effects/${id}/`,
      entry: 'index.js',
      files: Object.entries(honest).map(([name, bytes]) => ({path: name, sha256: sha(bytes), size: bytes.length})),
      kit: {status: 'pass', framework: 'ui-000000000000', schemes: {}},
    });
  }
  const index = {
    schema: 'simai.ui-effects.catalogue',
    version: 1,
    repository: 'simai/ui-effects',
    standard: 'simai.effect 1.1.0',
    framework: {pair: 'ui-000000000000', ui: '0'.repeat(40), ui_source: '0'.repeat(40)},
    runtime: {placement: {path: 'site/lib/placement.js', sha256: '0'.repeat(64), size: 1, replaced_by: 'simai.effect 1.1'}},
    counts: {effects: entries.length, dual: 0, dark: 0, light: 0},
    effects: entries,
  };
  files.set('/cat/catalogue/index.json', Buffer.from(`${JSON.stringify(index, null, 2)}\n`));
  return files;
}

// A page with the built core, the catalogue configured, `body` in <body>, the
// <html> in `theme`; `listen(page)` is called before it loads. Answers the
// page and the list of every address asked for.
export async function openPage(browser, out, {body = '', theme = 'theme-light', head = '', reducedMotion = 'no-preference', listen = null} = {}) {
  const coreRoot = join(resolve(out), 'core', 'core');
  const catalogue = buildCatalogue();
  const context = await browser.newContext({reducedMotion});
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  listen?.(page);
  const html = `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8"><title>effects probe</title>
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'effects', pluginListVersion: 'effects', preloader: {enabled: false}, icons: {enabled: false}, theme: false, effects: {catalogue: '${BASE}'}};
window.__loadAt = null; window.addEventListener('load', () => { window.__loadAt = performance.now(); });
window.__refused = []; document.addEventListener('sf-effect-refused', (event) => window.__refused.push({target: event.target.id, ...event.detail}));</script>
<link rel="stylesheet" href="/distr/core/css/core.css">${head}
</head><body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`;
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.fulfill({status: 404, body: ''});
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
    if (catalogue.has(url.pathname)) {
      const type = url.pathname.endsWith('.json') ? 'application/json' : 'text/javascript';
      return route.fulfill({status: 200, contentType: `${type}; charset=utf-8`, headers: {'access-control-allow-origin': '*'}, body: catalogue.get(url.pathname)});
    }
    if (url.pathname.startsWith('/distr/core/')) {
      const file = resolve(coreRoot, url.pathname.slice('/distr/core/'.length));
      if (file.startsWith(coreRoot + sep) && existsSync(file)) {
        const type = file.endsWith('.css') ? 'text/css' : 'text/javascript';
        return route.fulfill({status: 200, contentType: `${type}; charset=utf-8`, body: readFileSync(file)});
      }
    }
    return route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.SF?.Effects && window.__loadAt !== null, null, {timeout: 15000});
  // The core shows the body once the Loader is ready.
  await page.waitForFunction(() => document.body.style.opacity !== '0', null, {timeout: 15000}).catch(() => {});
  return {context, page, requests, errors};
}

// The manifests and the module source, for probes that mount through the JS API.
export const moduleUrl = (id) => `${BASE}effects/${id}/index.js`;
