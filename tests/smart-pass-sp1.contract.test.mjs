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

// ---- SM-AV-2: the passport's photo example draws with no network ------------

test('SM-AV-2: no example of sf-avatar points at an address that does not exist', () => {
  const examples = read('src/smart/avatar/examples.json');
  assert.doesNotMatch(examples, /example\.test/u);
  const image = json('src/smart/avatar/examples.json').examples.find((one) => one.name === 'image');
  assert.match(image.settings['image-url'], /^data:image\//u);
});

// ---- SM-LS-1, SM-LD-1: a list setting as a JSON attribute, one rule ---------

class AttributeBase extends EventTarget {
  static get props() { return {}; }
  static get observedAttributes() { return []; }
  constructor() { super(); this.localName = 'sf-x'; this.attrs = new Map(); this.children = []; }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  closest() { return null; }
  requestComponentUpdate() {}
  connectedCallback() {}
}

async function listElement(folder) {
  const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
  return elementFromManifest(json(`src/smart/${folder}/component.json`), {base: AttributeBase, lang: {}});
}

function withWarnings(run) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  try { run(); } finally { console.warn = warn; }
  return warnings;
}

for (const folder of ['list', 'list-description']) {
  test(`SM-LS-1/SM-LD-1: sf-${folder} reads items from a JSON attribute and warns on bad JSON`, async () => {
    const Element = await listElement(folder);
    const rows = [{id: 'a', label: 'Адрес', text: 'Адрес', value: 'demo.test'}];
    const good = new Element();
    good.setAttribute('items', JSON.stringify(rows));
    const quiet = withWarnings(() => good.sfReadListAttributes());
    assert.deepEqual(quiet, []);
    assert.equal(good.items.length, 1);
    assert.equal(good.items[0].id, 'a');
    const bad = new Element();
    bad.setAttribute('items', '[{id: a}]');
    const said = withWarnings(() => bad.sfReadListAttributes());
    assert.equal(said.length, 1);
    assert.match(said[0], /"items" attribute is not JSON/u);
    assert.equal(bad.items.length, 0);
    // A property given first wins over the attribute.
    const given = new Element();
    given.items = [{id: 'p', label: 'P', text: 'P', value: 'p'}];
    given.setAttribute('items', JSON.stringify(rows));
    given.sfReadListAttributes();
    assert.equal(given.items[0].id, 'p');
  });
}

test('SM-LS-1: a component that observes its list attribute keeps its own reading', async () => {
  const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
  class Observing extends AttributeBase { static get observedAttributes() { return ['items']; } }
  const Element = elementFromManifest(json('src/smart/list-description/component.json'), {base: Observing, lang: {}});
  const element = new Element();
  element.setAttribute('items', '[{"label": "A", "value": "1"}]');
  element.sfReadListAttributes();
  assert.equal(element.items.length, 0);
});
