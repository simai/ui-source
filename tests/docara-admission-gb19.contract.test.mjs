// Group build 19 (Docara msg-991e765ceb3d4b02ace3): what a consumer that reads
// component.json as written needs for ui.copy-button, ui.tabs and ui.tooltip.
//
// D1 sf-button-copy: one contract for one tag, at smart/button-copy/; it
//    declares its slots (none) besides settings and events; the old path
//    smart/copy-button/ is a forward with no component.json of its own.
// D2 sf-tabs: component.json says how a panel's content is given, with the
//    names the element reads (role=tabpanel children with data-entry,
//    panel-<n>, tab-<n>).
// D3 sf-tooltip: size draws nothing (C160 (3)); the static markup prints the
//    same root class as the drawing, and the manifest says size is retired.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

test('D1: sf-button-copy carries settings, slots and events in one component.json', () => {
  const component = json('src/smart/button-copy/component.json');
  assert.equal(component.tag, 'sf-button-copy');
  assert.equal(component.version, '1.7.8'); // GB19 render: 1.7.8 above 1.7.7
  assert.deepEqual(component.slots, {}, 'no slots: the element reads nothing written inside the host');
  for (const name of ['value', 'target', 'text', 'label', 'size', 'appearance']) assert.ok(component.settings[name], name);
  assert.deepEqual(Object.keys(component.events).sort(), ['copied', 'copy-failed']);
  // The element does not read the host's children (no slot API in its source).
  assert.doesNotMatch(read('src/smart/button-copy/index.js'), /getSlotContent|hasSlotContent/u);
  assert.doesNotMatch(read('src/smart/button-copy/js/templates/default.js'), /getSlotContent|hasSlotContent/u);
});

test('D1: the old path smart/copy-button/ is a forward, not a second contract', () => {
  assert.deepEqual(readdirSync(join(root, 'src/smart/copy-button')), ['index.js']);
  assert.equal(existsSync(join(root, 'src/smart/copy-button/component.json')), false);
  const forwards = json('src/core/contracts/smart-rule-forwards.v1.json').forwards;
  assert.equal(forwards['cl-copy-button'].to, 'cl-button-copy');
  const tag = json('src/smart/button-copy/aliases.json').aliases.find((row) => row.kind === 'tag');
  assert.deepEqual([tag.from, tag.to, tag.remove_after], ['sf-copy-button', 'sf-button-copy', '2027-01-01']);
});

test('D2: sf-tabs declares how panel content is given, as the element reads it', () => {
  const component = json('src/smart/tabs/component.json');
  assert.equal(component.version, '1.6.0'); // GB19 integration: 1.5.4 (D2) moved on by area C (1.5.5) and touch size (1.5.6) // GB20 A: devices (1.6.0)
  const {slots} = component;
  assert.deepEqual(Object.keys(slots), ['panels', 'panel-<n>', 'tab-<n>']);
  assert.equal(slots.panels.default, true);
  assert.equal(slots.panels['x-element'], 'div[role=tabpanel]');
  assert.equal(slots.panels['x-entry'], 'data-entry');
  for (const name of ['panel-3', 'panel-12']) assert.match(name, new RegExp(slots['panel-<n>']['x-pattern'], 'u'));
  for (const name of ['tab-0', 'tab-7']) assert.match(name, new RegExp(slots['tab-<n>']['x-pattern'], 'u'));
  assert.doesNotMatch('panel-a', new RegExp(slots['panel-<n>']['x-pattern'], 'u'));
  // The names the element reads.
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /getAttribute\('role'\) === 'tabpanel'/u, 'page panels are role=tabpanel children');
  assert.match(source, /getAttribute\('data-entry'\) === item\.key/u, 'data-entry names the item');
  assert.match(source, /slotName: item\.slotName \|\| `panel-\$\{index\}`/u, 'panel-<n>');
  assert.match(source, /tabSlotName: item\.tabSlotName \|\| `tab-\$\{index\}`/u, 'tab-<n>');
  // The ids the summary promises: <path>--panel-<n>, <path>--tab-<n>, page-<id>.
  const template = read('src/smart/tabs/js/templates/default.js');
  assert.match(template, /\$\{context\.tabsId\}--panel-\$\{item\.index\}/u);
  assert.match(template, /\$\{context\.tabsId\}--tab-\$\{item\.index\}/u);
  assert.match(read('src/core/js/instance-path.js'), /if \(id\) return `page\/\$\{id\}`;/u);
  assert.match(slots.panels.summary, /page-<host id>/u);
});

test('D3: the tooltip static markup prints size as the drawing does, and size is retired', () => {
  const component = json('src/smart/tooltip/component.json');
  assert.equal(component.version, '1.5.5'); // GB19 render: 1.5.5 above 1.5.4
  const template = read('src/smart/tooltip/js/templates/default.js');
  assert.match(template, /`sf-tooltip--size-\$\{context\.size\}`/u, 'the drawing prints sf-tooltip--size-<size>');
  const fallback = component.settings.size.default;
  assert.equal(fallback, '1/3');
  const {examples} = json('src/smart/tooltip/examples.json');
  for (const example of examples) {
    const file = `src/smart/tooltip/static/default/${example.name}.html`;
    assert.ok(existsSync(join(root, file)), file);
    const markup = read(file);
    const size = example.settings?.size ?? fallback;
    const rootClass = markup.match(/<div class="(sf-tooltip [^"]*)" data-sf-static>/u)?.[1] ?? '';
    assert.ok(rootClass.split(' ').includes(`sf-tooltip--size-${size}`), `${example.name}: ${rootClass}`);
    assert.equal(example.settings?.size, undefined, `${example.name}: an example sets no retired size`);
    assert.equal(example.studio?.props?.size, undefined, `${example.name}: studio props set no retired size`);
    assert.doesNotMatch(markup, /<sf-tooltip[^>]* size=/u, `${example.name}: the host carries no size`);
  }
  const row = json('src/smart/tooltip/aliases.json').aliases.find((one) => one.from === 'size');
  assert.deepEqual([row.kind, row.to, row.mode, row.remove_after], ['setting', null, 'retired', '2027-01-01']);
  // No sheet reads the size class: it draws nothing.
  const sheets = readdirSync(join(root, 'src/component/tooltip/scss')).map((name) => read(`src/component/tooltip/scss/${name}`)).join('\n')
    .replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  assert.doesNotMatch(sheets, /tooltip--size/u);
});
