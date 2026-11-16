import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import test from 'node:test';

// The Smart joint pass over the Smart study pages (DEV, 2026-11-17; pages
// ui-control prototypes/smart-*-study.html, measured on pair 5.20261115.1622)
// and the owner decisions C279-C281 it raised. One test per finding; the
// browser half is the probe of fix/smart-pass-sp1 (its README).

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(read(path));

// ---- SM-CH-1..3, C279: sf-change before/after are attribute only ----------

test('C279: the island writes an attribute-only setting as the attribute, silently', async () => {
  const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
  // before and after are ChildNode methods: give the fake prototype chain them.
  const saved = globalThis.HTMLElement;
  class FakeElement { before() {} after() {} }
  globalThis.HTMLElement = FakeElement;
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    class Base extends EventTarget {
      static get props() { return {}; }
      constructor() { super(); this.localName = 'sf-change'; this.attrs = new Map(); this.children = []; }
      getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
      hasAttribute(name) { return this.attrs.has(name); }
      setAttribute(name, value) { this.attrs.set(name, String(value)); }
      removeAttribute(name) { this.attrs.delete(name); }
      toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
      closest() { return null; }
      requestComponentUpdate() {}
      connectedCallback() {}
    }
    const manifest = json('src/smart/change/component.json');
    const Change = elementFromManifest(manifest, {base: Base, lang: {}});
    const island = (data) => ({localName: 'script', type: 'application/json', textContent: JSON.stringify(data),
      hasAttribute: (name) => name === 'data-sf-settings', remove() {}});
    const element = new Change();
    element.children = [island({label: 'Статус', before: 'Собран', after: 'Передан'})];
    element.sfReadIsland();
    assert.equal(element.getAttribute('before'), 'Собран');
    assert.equal(element.getAttribute('after'), 'Передан');
    assert.equal(element.getAttribute('label'), 'Статус');
    // The page's own attribute wins over the island.
    const own = new Change();
    own.setAttribute('before', 'Свой');
    own.children = [island({before: 'Собран'})];
    own.sfReadIsland();
    assert.equal(own.getAttribute('before'), 'Свой');
    assert.deepEqual(warnings.filter((line) => /before|after/u.test(line)), []);
    // The browser's method stays the browser's: no property shadows it.
    assert.equal(Object.getOwnPropertyDescriptor(Change.prototype, 'before'), undefined);
  } finally {
    globalThis.HTMLElement = saved;
    console.warn = warn;
  }
});

test('C279: the passport marks before and after attribute only, and the docs say how to pass them', () => {
  const manifest = json('src/smart/change/component.json');
  for (const name of ['before', 'after']) {
    assert.equal(manifest.settings[name]['attribute-only'], true, name);
    assert.match(manifest.settings[name].summary, /Attribute only/u);
  }
  const docs = read('src/smart/change/docs.md');
  assert.match(docs, /Только атрибутом/u);
  assert.match(docs, /списо?к\s+`changes`/u);
});

test('SM-CH-2: the docs list every version up to the passport', () => {
  const {version} = json('src/smart/change/component.json');
  const docs = read('src/smart/change/docs.md');
  const section = docs.slice(docs.indexOf('## Изменения'));
  const listed = [...section.matchAll(/^- (\d+\.\d+\.\d+) /gmu)].map((match) => match[1]);
  assert.ok(listed.includes(version), `docs list ${listed.join(', ')}, passport ${version}`);
  for (const old of ['1.0.1', '1.0.2', '1.0.3', '1.0.4', '1.0.5']) assert.ok(listed.includes(old), old);
});
