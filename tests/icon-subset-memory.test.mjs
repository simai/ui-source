import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  applyRememberedIconSubset,
  iconSubsetCssFromManifest,
  iconSubsetHostOrigin,
  isRememberedIconSubsetUsable,
  readRememberedIconSubset,
} from '../src/core/js/icon-subset-memory.js';

// The subset a page drew with is remembered for the next page on its origin
// and written at boot, before any component renders (effects.simai.io,
// 2026-11-02: the header's icon buttons stood empty some 340 ms on every load,
// a warm cache included). The browser side is the probe
// tests/browser/icons-warm-first-frame.browser.mjs; these hold the checks.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const HOST = 'https://icons.simai.io';
// The manifest the service sends for dark_mode, language and menu (2026-11-02).
const manifest = () => ({
  hash: 'ea6f8025053b1c3a7db6cc752096d2d03267fcff', mode: 'static-weight', type: 'outlined', origin: null,
  family: 'Material Symbols Outlined', iconCount: 3, icons: ['dark_mode', 'language', 'menu'],
  axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}},
  fonts: [{hash: '06b4feb15cddcfb54901407e7384feb6ea7254c6', weight: 400,
    url: 'https://icons.simai.io/ms/font/06b4feb15cddcfb54901407e7384feb6ea7254c6.woff2'}],
});
const usable = (value, type = 'outlined') => isRememberedIconSubsetUsable(value, {hostOrigin: HOST, type});

test('the service manifest is used again on its own host', () => {
  assert.equal(usable(manifest()), true);
  assert.equal(iconSubsetHostOrigin(undefined, 'https://effects.simai.io/ru/'), HOST);
  assert.equal(iconSubsetHostOrigin('/subset', 'https://app.example/x/'), 'https://app.example');
});

test('a remembered subset is not used off the subset host, or with anything but plain values', () => {
  const off = manifest();
  off.fonts[0].url = 'https://evil.invalid/x.woff2';
  assert.equal(usable(off), false, 'a font file on another host');
  const http = manifest();
  http.fonts[0].url = 'http://icons.simai.io/ms/font/x.woff2';
  assert.equal(usable(http), false, 'another scheme');
  const quote = manifest();
  quote.fonts[0].url = "https://icons.simai.io/ms/font/x.woff2') ; } body { color: red";
  assert.equal(usable(quote), false, 'a URL that would leave url(...)');
  const name = manifest();
  name.icons.push('</style>');
  assert.equal(usable(name), false, 'an icon name that is not a ligature name');
  const family = manifest();
  family.font_family = "x'; } * { display: none";
  assert.equal(usable(family), false, 'a family name that would leave its quotes');
  const weight = manifest();
  weight.fonts[0].weight = '400; } *';
  assert.equal(usable(weight), false, 'a weight that is not a weight');
  assert.equal(usable(manifest(), 'rounded'), false, 'another family');
  assert.equal(usable({...manifest(), fonts: []}), false, 'no font file');
  assert.equal(usable(null), false);
  assert.equal(isRememberedIconSubsetUsable(manifest(), {hostOrigin: '', type: 'outlined'}), false);
});

test('unreadable, missing or broken storage reads as nothing remembered', () => {
  const throwing = {getItem() { throw new Error('denied'); }};
  assert.equal(readRememberedIconSubset(throwing, {hostOrigin: HOST, type: 'outlined'}), null);
  assert.equal(readRememberedIconSubset({getItem: () => null}, {hostOrigin: HOST, type: 'outlined'}), null);
  assert.equal(readRememberedIconSubset({getItem: () => '{'}, {hostOrigin: HOST, type: 'outlined'}), null);
  const stored = {getItem: (key) => (key === 'SF_ICON_SUBSET_MANIFEST' ? JSON.stringify(manifest()) : null)};
  assert.deepEqual(readRememberedIconSubset(stored, {hostOrigin: HOST, type: 'outlined'})?.icons,
    ['dark_mode', 'language', 'menu']);
  assert.equal(readRememberedIconSubset(stored, {hostOrigin: HOST, type: 'rounded'}), null, 'per-family keys');
});

test('the stylesheet keeps font-display: block and the subset family', () => {
  const {cssText, family} = iconSubsetCssFromManifest(manifest());
  assert.equal(family, 'Material Symbols Outlined Subset');
  assert.match(cssText, /font-display: block;/u);
  assert.match(cssText, /--sf-icon--font-family: 'Material Symbols Outlined Subset';/u);
});

// A head that records what goes into it.
const fakePage = ({config = {}, existing = []} = {}) => {
  const head = [];
  const attrs = new Map([['data-sf-icons', 'subset-pending']]);
  const element = (tag) => {
    const own = new Map();
    return {tag, isConnected: true, textContent: '', setAttribute: (key, value) => own.set(key, String(value)),
      hasAttribute: (key) => own.has(key), getAttribute: (key) => own.get(key) ?? null, own};
  };
  const loads = [];
  const doc = {
    baseURI: 'https://effects.simai.io/ru/',
    head: {appendChild: (node) => head.push(node)},
    documentElement: {getAttribute: (key) => attrs.get(key) ?? null, removeAttribute: (key) => attrs.delete(key)},
    createElement: element,
    querySelector: (selector) => existing.find((value) => selector.includes(value)) ?? null,
    querySelectorAll: () => [],
    fonts: {load: (font, text) => { loads.push({font, text}); return Promise.resolve([{}]); }},
  };
  return {win: {SF_BOOT_CONFIG: config}, doc, head, attrs, loads};
};
const storage = (value) => ({getItem: (key) => (key === 'SF_ICON_SUBSET_MANIFEST' ? JSON.stringify(value) : null)});

test('at boot the remembered subset goes in with a font preload, and the pending mark lifts once its face loads', async () => {
  const page = fakePage();
  const applied = applyRememberedIconSubset({win: page.win, doc: page.doc, storage: storage(manifest())});
  assert.ok(applied);
  const link = page.head.find((node) => node.tag === 'link');
  assert.equal(link.rel, 'preload');
  assert.equal(link.as, 'font');
  assert.equal(link.crossOrigin, 'anonymous');
  assert.equal(link.href, manifest().fonts[0].url);
  const style = page.head.find((node) => node.tag === 'style');
  assert.equal(style.getAttribute('data-sf-icons-subset-family'), 'outlined');
  assert.equal(style.getAttribute('data-sf-icons-subset'), 'dark_mode,language,menu');
  assert.equal(style.getAttribute('data-sf-icons-subset-hash'), manifest().hash);
  assert.equal(style.hasAttribute('data-sf-icons-remembered'), true);
  assert.match(style.textContent, /@font-face/u);
  await new Promise((done) => setTimeout(done, 0));
  assert.equal(page.loads[0].font, '400 24px "Material Symbols Outlined Subset"');
  assert.equal(page.attrs.has('data-sf-icons'), false, 'lifted once the face is loaded');
});

test('nothing goes in with icons.remember = false, a foreign manifest, or a subset already in the head', () => {
  for (const [label, page, value] of [
    ['remember off', fakePage({config: {icons: {remember: false}}}), manifest()],
    ['foreign host', fakePage(), {...manifest(), fonts: [{weight: 400, url: 'https://evil.invalid/x.woff2'}]}],
    ['already written', fakePage({existing: ['data-sf-icons-subset-family="outlined"']}), manifest()],
  ]) {
    assert.equal(applyRememberedIconSubset({win: page.win, doc: page.doc, storage: storage(value)}), null, label);
    assert.equal(page.head.length, 0, label);
    assert.equal(page.attrs.get('data-sf-icons'), 'subset-pending', label);
  }
});

test('the core runtime writes it at boot, and the Loader keeps, checks and adopts it', () => {
  const index = read('src/core/js/index.js');
  assert.match(index, /applyRememberedIconSubset\(\{win: window, doc: document, storage: pageStorage\(\)\}\)/u);
  assert.ok(index.indexOf('applyRememberedIconSubset({') < index.indexOf("link.rel = 'preconnect'"),
    'before the request is even prepared');
  const loader = read('src/core/js/loader.js');
  const wipe = loader.slice(loader.indexOf('prototype.clearAllSfCache = '));
  assert.match(wipe.slice(0, wipe.indexOf('};')), /!key\.startsWith\('SF_ICON_SUBSET_MANIFEST'\)/u,
    'a page without cacheVersion keeps the remembered subset');
  const runtime = read('src/core/js/iconSubsetRuntime.js');
  const restore = runtime.slice(runtime.indexOf('prototype.restoreIconManifestFromCache = '));
  assert.match(restore.slice(0, restore.indexOf('\n  };')), /isRememberedIconSubsetUsable\(/u);
  assert.match(runtime, /hasAttribute\("data-sf-icons-remembered"\)/u);
});

test('icons.remember and the site hints are documented', () => {
  const docs = read('docs/developer/icon-subset-runtime.md');
  assert.match(docs, /`icons\.remember = false`/u);
  assert.match(docs, /<link rel="preconnect" href="https:\/\/icons\.simai\.io" crossorigin>/u);
  assert.match(docs, /<link rel="preload" as="font" type="font\/woff2" crossorigin/u);
  assert.match(docs, /cacheVersion: 'ui-2d39b617a719'/u);
  assert.match(read('src/smart/icon/docs.md'), /icons\.remember/u);
});
