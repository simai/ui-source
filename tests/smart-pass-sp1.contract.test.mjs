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

test('C279: the island passes only the list; an attribute-only setting in it is left out with a warning', async () => {
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
    assert.equal(element.getAttribute('before'), null);
    assert.equal(element.getAttribute('after'), null);
    assert.equal(element.getAttribute('label'), 'Статус');
    const said = warnings.filter((line) => /before|after/u.test(line));
    assert.equal(said.length, 2, said.join(' | '));
    for (const line of said) assert.match(line, /attribute only \(C279\); pass it in the list setting \(sf-change: changes\)/u);
    // The page's own attribute stays as written.
    const own = new Change();
    own.setAttribute('before', 'Свой');
    own.children = [island({before: 'Собран'})];
    own.sfReadIsland();
    assert.equal(own.getAttribute('before'), 'Свой');
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
  assert.match(docs, /в острове не читаются/u);
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

// ---- SM-PR-1: the ring's percentage is «62 %» on both twins -----------------

test('SM-PR-1: the ring prints the number, a no-break space and «%» (C203 (3), C219), Smart and class', async () => {
  const {percentText} = await import('../src/core/js/format-number.js');
  assert.equal(percentText(62, null), '62 %');
  const template = read('src/smart/progress-ring/js/templates/default.js');
  assert.match(template, /percentText\(value/u);
  const docs = read('src/component/progress-ring/docs/docs.md');
  assert.doesNotMatch(docs, /\d%</u);
  assert.match(docs, /85&nbsp;%</u);
});

// ---- SM-SP-3: the dots look's settings are retired, dated, noted ------------

test('SM-SP-3: sf-spinner lists no dots, filled or direction; each is a dated retired attribute, noted', () => {
  const manifest = json('src/smart/spinner/component.json');
  for (const name of ['dots', 'filled', 'direction']) {
    assert.equal(manifest.settings[name], undefined, name);
    const row = manifest.aliases.rows.find((one) => one.from === name && one.kind === 'attribute');
    assert.ok(row, name);
    assert.equal(row.mode, 'retired');
    assert.equal(row.remove_after, '2027-01-01');
  }
  const source = read('src/smart/spinner/index.js');
  assert.match(source, /const DOTS_SETTINGS = \['dots', 'filled', 'direction'\]/u);
  assert.match(source, /noteDeprecated\(\{ component: 'sf-spinner'[^}]*from: name/u);
  const journal = json('contracts/changes/journal.json').records.find((one) => one.id === 'attribute-spinner-dots-settings-retired');
  assert.equal(journal?.remove_after, '2027-01-01');
  assert.doesNotMatch(read('src/smart/spinner/docs/docs.md'), /`dots` — от 3 до 32/u);
});

// ---- SM-CNF-1, SM-CCH-1: the status sign is written with the ladder name ----

test('SM-CNF-1/SM-CCH-1: the confirm surface writes no old-scale icon size', () => {
  const source = read('src/smart/helpers/confirm-surface.js');
  const icons = [...source.matchAll(/<sf-icon\b[^>]*>/gu)].map((match) => match[0]);
  assert.ok(icons.length > 0);
  for (const icon of icons) {
    const size = /\ssize="([^"]+)"/u.exec(icon)?.[1];
    if (size === undefined) continue;
    assert.match(icon, /data-sf-icon-scale="ladder"/u, icon);
  }
});

// ---- SM-MD-4, SM-PO-2: a passport example is the model for Studio ----------

test('SM-MD-4: no sf-modal example uses the dated position for a side panel', () => {
  const examples = json('src/smart/modal/examples.json').examples;
  for (const example of examples) {
    assert.ok(!['inline-start', 'inline-end'].includes(example.settings?.position), example.name);
  }
  assert.equal(existsSync(new URL('src/smart/modal/static/default/side.html', root)), false);
});

test('SM-PO-2: every sf-popover example trigger is a Framework button', () => {
  for (const example of json('src/smart/popover/examples.json').examples) {
    const trigger = example.slots?.trigger;
    if (trigger === undefined) continue;
    assert.match(trigger, /^<sf-button\b/u, example.name);
  }
});

// ---- C280: a bare sf-tag is a plain tag; the toggle is kind="checkbox" ------

test('C280: sf-tag defaults to kind default; a bare toggle is a dated deprecation', () => {
  const manifest = json('src/smart/tag/component.json');
  assert.equal(manifest.settings.kind.default, 'default');
  const source = read('src/smart/tag/index.js');
  assert.match(source, /kind: \{\n\s+default: 'default',/u);
  assert.match(source, /const BARE_TOGGLE = \{since: '2026-11-17', remove_after: '2027-01-01'\}/u);
  assert.match(source, /legacyType\(element, 'kind'\) \|\| \(bareToggle\(element\) \? 'checkbox' : fallback\)/u);
  const journal = json('contracts/changes/journal.json').records.find((one) => one.id === 'value-tag-default-kind-plain');
  assert.equal(journal?.remove_after, '2027-01-01');
  // The Framework's own toggles say so by name.
  assert.match(read('src/smart/search/js/templates/default.js'), /<sf-tag kind="checkbox" key=/u);
  for (const tag of read('src/smart/tag-group/examples.json').match(/<sf-tag [^>]*key=[^>]*>/gu)) {
    assert.match(tag, /kind=\\"checkbox\\"/u, tag);
  }
  const example = json('src/smart/tag/examples.json').examples.find((one) => one.name === 'checkbox');
  assert.equal(example.settings.kind, 'checkbox');
});

// ---- C281: a metric tile's inset follows its size step -----------------------

test('C281: sf-tile-metric insets by the size step (space-x less the hairline), never the card inset', () => {
  const sheet = read('src/smart/tile-metric/scss/_smart__tile-metric.scss');
  assert.match(sheet, /--sf-tile-metric--padding: var\(--sf-tile-metric-padding, calc\(var\(--sf-tile-metric--space-x\) - var\(--sf-tile-metric--border\)\)\);/u);
  assert.match(sheet, /\.sf-tile-metric \{[^}]*--sf-tile-metric--space-x: var\(--sf-ui-1--space-x\);/u);
  assert.match(sheet, /--sf-tile-metric--space-x: var\(--sf-ui-1\\\/2--space-x\);/u);
  assert.match(sheet, /--sf-tile-metric--space-x: var\(--sf-ui-2--space-x\);/u);
  assert.doesNotMatch(sheet, /--sf-card[a-z-]*(padding|inset)/u);
  assert.match(read('src/smart/tile-metric/docs.md'), /C281/u);
});

// ---- SM-CPY-2: on-surface-variant is one class, its glyph not held by order -

test('SM-CPY-2: sf-button-icon writes one scheme class; the sheet carries on-surface-variant alone', () => {
  const template = read('src/smart/button-icon/js/templates/default.js');
  assert.doesNotMatch(template, /\['sf-icon-button--on-surface-variant', 'sf-icon-button--on-surface'\]/u);
  assert.match(template, /\? \['sf-icon-button--on-surface-variant'\]/u);
  const sheets = read('src/component/icon-buttons/scss/_css_icon_buttons.scss') + read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss');
  // Every on-surface rule names the variant too.
  assert.doesNotMatch(sheets, /:is\(\.sf-icon-button--on-surface, \.sf-icon-button--secondary\)/u);
  assert.doesNotMatch(sheets, /\.sf-icon-button--on-surface\.sf-icon-button--on-surface-variant/u);
  // The quiet glyph stands one class above the on-surface glyph rules (0,4,0).
  assert.match(sheets, /\.sf-icon-button\.sf-icon-button:is\(\.sf-icon-button--on-surface-variant\.sf-icon-button--on-surface-variant, \.sf-icon-button--secondary\):not\(\.sf-icon-button--default\) \{\n\s+--sf-icon--color: var\(--sf-icon-button-color, var\(--sf-on-surface-variant\)\);/u);
});

// ---- SM-PN-1, EX-3: both pagination twins fit a phone column ---------------

test('SM-PN-1, EX-3: a numbers place of either twin shrinks to square when the row has no room, with no screen query', () => {
  const sheet = read('src/component/pagination/scss/_css__pagination.scss');
  const rule = (selector) => {
    const at = sheet.indexOf(`${selector} {`);
    assert.ok(at >= 0, `the rule ${selector}`);
    return sheet.slice(at, sheet.indexOf('}', at));
  };
  // One place rule for the Smart slot and the plain sf-page-number item.
  const place = rule('.sf-pagination .sf-pagination-item.sf-pagination-slot,\n.sf-pagination .sf-pagination-item:has(> .sf-page-number)');
  assert.match(place, /flex: 0 1 max\(var\(--sf-pagination--control-height\), calc\(var\(--sf-pagination--digits, 2\) \* 1ch \+ 2 \* var\(--sf-pagination--space-x\)\)\);/u);
  // The floor is the place's own number (RG-NV 9, defects-d11): square for one
  // or two digits, as wide as «10240» for five; the digits are the row's.
  assert.match(place, /min-inline-size: min-content;/u);
  assert.doesNotMatch(place, /--sf-pagination--digits:/u);
  // The numbers' own padding is the label's, a step of the role table, so the place can shrink.
  assert.match(sheet, /\.sf-pagination \{\s*--sf-pagination--place-x: var\(--sf-ui-1--text-space-x\);/u);
  assert.match(sheet, /\.sf-pagination\.sf-pagination--size-1\\\/2 \{\s*--sf-pagination--place-x: var\(--sf-ui-1\\\/2--text-space-x\);/u);
  const smart = rule('.sf-pagination .sf-pagination-slot > .sf-pagination-page');
  assert.match(smart, /--sf-button--padding-inline-start: var\(--sf-pagination--place-x\);/u);
  assert.match(smart, /min-inline-size: var\(--sf-pagination--control-height\);/u);
  const plain = rule('.sf-pagination .sf-pagination-item > .sf-page-number');
  assert.match(plain, /--sf-page-number--space-x: var\(--sf-pagination--place-x\);/u);
  // Square at least by RG-NV 9's own rule (_css__page_number.scss): the item
  // hands it the control height as the width, no second min-inline-size.
  assert.match(plain, /--sf-page-number--width: var\(--sf-pagination--control-height\);\s*inline-size: 100%;/u);
  assert.doesNotMatch(plain, /min-inline-size/u);
  // The item's flex: 0 0 auto stays below the place rule in specificity (0,2,0 against 0,3,0).
  assert.match(sheet, /\.sf-pagination \.sf-pagination-item \{\s*display: flex;\s*flex: 0 0 auto;/u);
  // No screen query (C181): the row shrinks in any narrow box.
  assert.doesNotMatch(sheet, /media-breakpoint-down\(sm\)/u);
  // The arithmetic at the phone step (control 36, gap 8): Smart two arrows and
  // five places, the class long range seven places.
  assert.ok(2 * 36 + 5 * 36 + 6 * 8 <= 326 && 7 * 36 + 6 * 8 <= 326);
  assert.equal(json('src/component/pagination/passport.json').version, '1.6.4'); // group build 10: 1.5.2 moved on by the merged branches or a GB10 patch // defects-d11: component.pagination 1.6.2 above 1.6.1 on fix/c178-findings: a place never below its own number (RG-NV 9) // group build 14: 1.6.3 moved on by the merged branches or the C278 language patch
});

// ---- SM-DL-2: the class row puts the size under the name on a phone --------

test('SM-DL-2: below sm the hand-written class row stacks the size under the name, as the Smart row', () => {
  const sheet = read('src/component/download-file/scss/_css_download-file.scss');
  const at = sheet.indexOf('@media (max-width: map.get(bp.$breakpoint-array, sm))');
  assert.ok(at > 0, 'the phone block');
  const block = sheet.slice(at, sheet.indexOf('\n  }\n', at));
  assert.match(block, /\.sf-download-file-wrap:has\(> \.sf-download-file-file-size\)\) \{\s*flex-direction: column;/u);
  assert.match(block, /\.sf-download-file-wrap > \.sf-download-file-file-size\) \{\s*margin-inline-start: calc\(var\(--sf-file-download-icon-size[^;]*--sf-download-file--gap\)\)\)\);\s*font-size: var\(--sf-text-size-1\\\/2\);/u);
  assert.equal(json('src/component/download-file/passport.json').version, '1.7.3'); // group build 10: 1.6.1 moved on by the merged branches or a GB10 patch // C278: 1.7.2 moved on by the language packs
});

// ---- C250: sf-progress-ring declares the avatar it holds -------------------

test('C250: sf-progress-ring declares component.avatars and smart.avatar (lazy relations)', async () => {
  const {usesOf} = await import('../scripts/generate-component-files.mjs');
  const component = json('src/smart/progress-ring/component.json');
  const uses = usesOf(component);
  for (const id of ['component.avatars', 'smart.avatar', 'component.progress-ring']) assert.ok(uses.includes(id), `declares ${id}`);
  for (const name of ['avatars', 'cl-avatar']) assert.equal(component.relations.find((r) => r.name === name)?.lazy, true, `${name} is lazy: the ring draws no avatar itself`);
  assert.deepEqual(json('src/smart/progress-ring/smart.manifest.json').composition.uses, uses);
  // The code that makes the use: the ring sheet sizes an avatar, the element warns about a stray one.
  assert.match(read('src/component/progress-ring/scss/_css__progress_ring.scss'), /\.sf-progress-ring-content > \.sf-avatar/u);
  assert.match(read('src/smart/progress-ring/index.js'), /'sf-avatar'/u);
});
