import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {components, assemblies, exampleFiles, givesLateData, measuredFonts, portOf, FAKE_PORT, readConfig, serveOutput, sizeProblem, SNAPSHOT_MAX_BYTES} from '../scripts/first-paint-lib.mjs';
import {fillSkeleton, repeatCount} from '../scripts/first-paint-skeleton.mjs';

// The first-paint tools themselves (scripts/first-paint-*.mjs,
// scripts/snapshot-first-paint.mjs, tests/browser/first-paint-gate.browser.mjs):
// a snapshot is the same on every run, an empty list is data, a package
// declares itself, a port-fed component gets its data in phase 3, and a
// skeleton template repeats rows of cells. Without a browser.
const root = new URL('..', import.meta.url).pathname;
const snapshots = () => components().flatMap((component) => {
  const walk = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap((one) => (one.isDirectory() ? walk(join(dir, one.name)) : [join(dir, one.name)]));
  try { return walk(join(component.dir, 'static')).filter((file) => file.endsWith('.html')); } catch { return []; }
});

test('1. a JSON island is printed once: never again as a held child', () => {
  const page = readFileSync(join(root, 'scripts/first-paint-page.js'), 'utf8');
  assert.match(page, /filter\(\(node\) => !island\(node\)\)/u, 'the island is not kept among the page children');
  for (const file of snapshots()) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /<script[^>]*data-sf-held[^>]*data-sf-settings|<script[^>]*data-sf-settings[^>]*data-sf-held/u, file);
  }
});

test('2. the icon font\'s arrival leaves no trace in a snapshot', () => {
  for (const file of snapshots()) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /\bsf-icon-loaded\b/u, `${file}: sf-icon-loaded`);
    assert.doesNotMatch(html, /<sf-icon\b[^>]*\sloaded(?=[\s>=])/u, `${file}: sf-icon loaded`);
  }
});

const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
class FakeBase extends EventTarget {
  static get props() { return {}; }
  constructor() {
    super();
    this.localName = 'sf-late';
    this.attrs = new Map();
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  requestComponentUpdate() {}
}

test('3. an explicitly empty list is data: the skeleton leaves, and no skeleton is written for it', () => {
  const Late = elementFromManifest({id: 'smart.late', tag: 'sf-late', version: '1.0.0', kind: 'leaf',
    settings: {items: {type: 'list', default: []}},
    presentation: {skeleton: {late: ['items']}}}, {base: FakeBase});
  const printed = () => { const one = new Late(); one.setAttribute('data-sf-first-paint', 'skeleton'); return one; };
  assert.equal(printed().sfAwaitingData(), true, 'nothing set: waiting');
  const empty = printed();
  empty.items = [];
  assert.equal(empty.sfAwaitingData(), false, 'an empty list set: arrived');
  const some = printed();
  some.items = [{id: 1}];
  assert.equal(some.sfAwaitingData(), false);
  const cleared = printed();
  cleared.items = null;
  assert.equal(cleared.sfAwaitingData(), true, 'null is not data');

  const component = {late: ['items']};
  assert.equal(givesLateData(component, {settings: {items: []}}), false);
  assert.equal(givesLateData(component, {settings: {items: [1]}}), true);
  assert.equal(givesLateData(component, {settings: {}}), false);
  for (const one of components()) {
    for (const example of one.examples) {
      for (const name of one.late) {
        if (Array.isArray(example.settings?.[name]) && !example.settings[name].length) {
          assert.equal(givesLateData(one, example) || one.late.some((other) => other !== name && givesLateData({late: [other]}, example)), false, `${one.folder}/${example.name}`);
        }
      }
    }
  }
  const page = readFileSync(join(root, 'scripts/first-paint-page.js'), 'utf8');
  assert.match(page, /hasOwnProperty\.call\(store, name\)/u, 'the assembly composer reads late data as the element does');
});

test('4a. a package declares its output and its base; the server serves it after the free output', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'first-paint-config-'));
  try {
    const out = join(dir, 'out');
    for (const [one, inner] of [['core', 'core'], ['core', 'rule'], ['component', 'component'], ['utility', 'utility'], ['smart', 'smart']]) mkdirSync(join(out, one, inner), {recursive: true});
    writeFileSync(join(out, 'smart', 'smart', 'free.js'), 'free');
    mkdirSync(join(out, 'core', 'core', 'css'));
    writeFileSync(join(out, 'core', 'core', 'css', 'core.css'), '@font-face{font-family:"Inter Variable";font-display:optional;src:url(a.woff2)}@font-face{font-family:"Icons";font-display:optional}');
    const pkg = join(dir, 'pkg', 'smart');
    mkdirSync(join(pkg, 'table'), {recursive: true});
    writeFileSync(join(pkg, 'rule.js'), 'rule');
    writeFileSync(join(pkg, 'free.js'), 'shadow');
    writeFileSync(join(pkg, 'table', 'index.js'), 'table');
    writeFileSync(join(dir, 'config.json'), JSON.stringify({packages: {larena: {output: 'pkg/smart'}, beside: {output: 'pkg/smart', base: '/distr/smart/'}}}));
    const config = readConfig([`--config=${join(dir, 'config.json')}`], {});
    assert.deepEqual(config.packages.larena, {output: pkg, base: '/distr/package/larena/'});
    assert.equal(config.packages.beside.base, '/distr/smart/');
    assert.deepEqual(readConfig([], {FIRST_PAINT_CONFIG: join(dir, 'config.json')}), config);
    assert.deepEqual(readConfig([], {}), {packages: {}});
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({packages: {larena: {output: 'nowhere'}}}));
    assert.throws(() => readConfig([`--config=${join(dir, 'bad.json')}`], {}), /no rule\.js/u);

    const site = await serveOutput(out, {packages: config.packages});
    try {
      const get = async (path) => { const response = await fetch(`${site.origin}${path}`); return response.ok ? response.text() : response.status; };
      assert.equal(await get('/distr/package/larena/rule.js'), 'rule');
      assert.equal(await get('/distr/package/larena/table/index.js'), 'table');
      assert.equal(await get('/distr/smart/table/index.js'), 'table', 'a package under a free base is served after it');
      assert.equal(await get('/distr/smart/free.js'), 'free', 'never in the free output\'s place');
      assert.equal(await get('/distr/package/larena/../../../config.json'), 404);
      const css = await get('/distr/core/css/core.css');
      assert.match(css, /"Inter Variable";font-display: block/u, 'the snapshots are measured in Inter');
      assert.match(css, /"Icons";font-display:optional/u, 'other faces as shipped');
    } finally {
      await site.close();
    }
    const shipped = await serveOutput(out, {packages: {}, fonts: 'as-shipped'});
    try {
      assert.match(await (await fetch(`${shipped.origin}/distr/core/css/core.css`)).text(), /Variable";font-display:optional/u);
    } finally {
      await shipped.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
  const tools = ['scripts/snapshot-first-paint.mjs', 'tests/browser/first-paint-gate.browser.mjs'].map((file) => readFileSync(join(root, file), 'utf8'));
  for (const tool of tools) assert.match(tool, /--config=<file>/u);
});

test('4b. an example declares its port\'s answers; the gate hands the fake port over in phase 3', async () => {
  const component = {folder: 'view', hasPort: true, manifest: {port: {id: 'simai.view-port', version: '1.2.0'}}};
  assert.equal(portOf(component, {}), null);
  assert.throws(() => portOf({...component, hasPort: false}, {name: 'x', port: {}}), /declares none/u);
  const spec = portOf(component, {name: 'rows', port: {answers: {query: {outcome: 'applied', rows: [1, 2]}, '*': {outcome: 'applied'}}, methods: {describe: {fields: []}}}});
  assert.equal(spec.id, 'simai.view-port');
  assert.equal(spec.version, '1.2.0');
  // eslint-disable-next-line no-eval
  const port = (0, eval)(FAKE_PORT)(spec);
  assert.equal(port.port, 'simai.view-port');
  const first = await port.raise('query', {});
  assert.deepEqual(first, {outcome: 'applied', rows: [1, 2]});
  first.rows.push(3);
  assert.deepEqual((await port.raise('query', {})).rows, [1, 2], 'answers are copied');
  assert.deepEqual(await port.raise('other', {}), {outcome: 'applied'});
  assert.deepEqual(await port.describe(), {fields: []});
  assert.deepEqual(port.calls, ['query', 'query', 'other', 'describe']);
  const none = (0, eval)(FAKE_PORT)(portOf(component, {name: 'x', port: {}}));
  assert.equal((await none.raise('query')).reason, 'not-in-example');
  const gate = readFileSync(join(root, 'tests/browser/first-paint-gate.browser.mjs'), 'utf8');
  assert.match(gate, /host\.connectPort\(window\.__fpPort\)/u);
  assert.match(gate, /never asked the example\\'s port/u);
});

test('5. a skeleton template repeats rows of cells, with a default count', () => {
  const component = {folder: 'grid', manifest: {settings: {rows: {type: 'list', default: []}, columns: {type: 'list', default: []}, title: {type: 'string', default: 'T'}}},
    skeletonRepeat: {rows: {setting: 'rows', default: 3}, cells: 'columns', fixed: 2, fallback: {default: 1}}};
  const template = '<!-- a table --><table><caption>{{title}}</caption><template data-sf-repeat="rows"><tr><template data-sf-repeat="cells"><td>x</td></template></tr></template></table>';
  assert.equal(fillSkeleton(component, {rows: [1, 2], columns: ['a', 'b', 'c']}, template),
    '<table><caption>T</caption><tr><td>x</td><td>x</td><td>x</td></tr><tr><td>x</td><td>x</td><td>x</td></tr></table>');
  assert.equal(fillSkeleton(component, {columns: ['a']}, template),
    '<table><caption>T</caption><tr><td>x</td></tr><tr><td>x</td></tr><tr><td>x</td></tr></table>', 'rows not given: the default');
  assert.equal(fillSkeleton(component, {rows: 0, columns: ['a']}, template), '<table><caption>T</caption></table>', 'given zero: none');
  assert.equal(repeatCount(component, {}, 'fixed'), 2);
  assert.equal(repeatCount(component, {}, 'fallback'), 1);
  assert.equal(repeatCount(component, {}, 'cells'), 0, 'a setting without a default: its default value');
  assert.throws(() => fillSkeleton(component, {}, '<template data-sf-repeat="other">x</template>'), /does not name/u);
  assert.throws(() => fillSkeleton(component, {}, '<template data-sf-repeat="rows"><template data-sf-repeat="cells">x</template>'), /not closed/u);
  assert.equal(fillSkeleton(component, {rows: [1], columns: [1, 2]}, '<template data-sf-repeat="rows">a<template data-sf-repeat="cells">b</template>c<template data-sf-repeat="fixed">d</template></template>e'), 'abbcdde');
});

test('6. the text faces: optional on a page, block on the snapshot server only', () => {
  const sheet = readFileSync(join(root, 'src/core/scss/_sf_css__fonts.scss'), 'utf8');
  assert.equal((sheet.match(/font-display: optional;/gu) ?? []).length, 7, 'a page keeps optional');
  assert.equal(measuredFonts('@font-face{font-family:"Inter Variable";font-display:optional}'), '@font-face{font-family:"Inter Variable";font-display: block}');
  assert.equal(measuredFonts('@font-face{font-family:"Inter Fallback";src:local(Arial)}'), '@font-face{font-family:"Inter Fallback";src:local(Arial)}');
  const snapshot = readFileSync(join(root, 'scripts/snapshot-first-paint.mjs'), 'utf8');
  assert.equal((snapshot.match(/await page\.evaluate\(fontsReady\)/gu) ?? []).length, 2, 'every snapshot page waits for Inter');
});

test('7. a closed surface prints closed, and a snapshot keeps to its size', () => {
  assert.equal(SNAPSHOT_MAX_BYTES, 8192);
  assert.equal(sizeProblem({name: 'a'}, 8192), null);
  assert.match(sizeProblem({name: 'a'}, 8193), /over 8192/u);
  assert.equal(sizeProblem({name: 'a', 'first-paint': {'max-bytes': 20000, why: 'a palette'}}, 19000), null);
  assert.match(sizeProblem({name: 'a', 'first-paint': {'max-bytes': 20000, why: 'a palette'}}, 20001), /declared 20000/u);
  assert.match(sizeProblem({name: 'a', 'first-paint': {'max-bytes': 20000}}, 10), /needs an integer max-bytes and a why/u);
  const checked = [];
  for (const component of components()) {
    for (const example of component.examples.filter((one) => one.template !== 'skeleton')) {
      const files = exampleFiles(component, example);
      for (const file of [files.html, files.skeleton]) {
        let bytes;
        try { bytes = readFileSync(file).length; } catch { continue; }
        checked.push(file);
        assert.equal(sizeProblem(example, bytes), null, file);
      }
    }
  }
  for (const assembly of assemblies()) {
    for (const layout of Object.keys(assembly.layouts)) {
      for (const example of assembly.examples) {
        assert.equal(sizeProblem(example, readFileSync(join(assembly.dir, 'static', layout, `${example.name}.html`)).length), null, `${assembly.folder}/${layout}/${example.name}`);
      }
    }
  }
  assert.ok(checked.length > 250);
  // sf-country-code printed its whole open list (107 KB) for a closed field.
  const country = readFileSync(join(root, 'src/smart/country-code/static/default/default.html'), 'utf8');
  assert.doesNotMatch(country, /sf-country-code-item/u);
  assert.match(country, /<span class="sf-country-code-list" id="[^"]+" role="listbox"[^>]*><\/span>/u, 'the list is printed as its empty element');
  const page = readFileSync(join(root, 'scripts/first-paint-page.js'), 'utf8');
  assert.match(page, /if \(closed\(el\)\) inner = '';/u);
  const tool = readFileSync(join(root, 'scripts/snapshot-first-paint.mjs'), 'utf8');
  assert.match(tool, /results\.tooLarge\.length \|\|/u, 'the size gate fails the run, --check included');
});

test('8. no size or place the code measured enters a snapshot', () => {
  const geometry = /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|left|top|right|bottom|inset(?:-[\w-]+)?|clip-path|transform|translate)$/u;
  for (const file of snapshots()) {
    const html = readFileSync(file, 'utf8');
    for (const [, style] of html.matchAll(/ style="([^"]*)"/gu)) {
      for (const part of style.split(';')) {
        const at = part.indexOf(':');
        const name = part.slice(0, at).trim();
        if (at < 0 || !(geometry.test(name) || name.startsWith('--'))) continue;
        const px = [...part.slice(at + 1).matchAll(/(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))px\b/gu)].filter((one) => Number(one[1]) !== 0);
        assert.equal(px.length, 0, `${file}: ${part.trim()}`);
      }
    }
  }
  const page = readFileSync(join(root, 'scripts/first-paint-page.js'), 'utf8');
  assert.match(page, /function unmeasured\(style\)/u);
  assert.match(page, /name\.startsWith\('--'\)\) && measured/u, 'a measured custom property too');
});
