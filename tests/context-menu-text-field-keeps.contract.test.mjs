import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-menu-context 1.27.3 (ui-control control/evidence/2026-11-19-view-shadow-menu):
// only a text field keeps the browser's own menu at an object of an area. A
// checkbox, a radio, a switch, a select and a button do not, so the menu key
// on a table row's selection checkbox opens the row's menu. The rule is run
// here from the source itself over small stand-in elements; the browser
// measures it in tests/browser/context-menu-text-field-keeps.browser.mjs.
const source = readFileSync(new URL('../src/smart/menu-context/index.js', import.meta.url), 'utf8');
const take = (from, to) => {
  const at = source.indexOf(from);
  assert.ok(at >= 0, `${from} is in the source`);
  return source.slice(at, source.indexOf(to, at));
};
const rule = [
  take('const hostOf = ', 'const holds = '),
  take('const holds = ', '// The focused element itself'),
  take('const BROWSER_KEEPS = ', '// A long press:'),
].join('\n');

// Just enough of an element: a tree, a root, attributes and the four simple
// selectors BROWSER_KEEPS is made of.
class Element {
  constructor(localName, attributes = {}, {editable = false} = {}) {
    this.localName = localName;
    this.attributes = attributes;
    this.children = [];
    this.parent = null;
    this.ownEditable = editable;
    this.rootNode = null;
  }
  get type() {
    if (this.localName !== 'input') return undefined;
    const type = String(this.attributes.type ?? 'text').toLowerCase();
    const known = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'range', 'image', 'hidden'];
    return known.includes(type) ? type : 'text';
  }
  get isContentEditable() {
    for (let at = this; at; at = at.parent) if (at.ownEditable) return true;
    return false;
  }
  add(...children) {
    for (const child of children) { child.parent = this; this.children.push(child); }
    return this;
  }
  matches(selectors) {
    return selectors.split(',').map((one) => one.trim()).some((one) => {
      const [, tag, name, value] = one.match(/^([a-z]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/u) ?? [];
      if (tag === undefined) throw new Error(`selector not understood: ${one}`);
      if (tag && tag !== this.localName) return false;
      if (name && !(name in this.attributes)) return false;
      return value === undefined || this.attributes[name] === value;
    });
  }
  contains(node) {
    for (let at = node; at; at = at.parent) if (at === this) return true;
    return false;
  }
  getRootNode() {
    let at = this;
    while (at.parent) at = at.parent;
    return at.rootNode ?? at;
  }
}
// eslint-disable-next-line no-new-func
const {keptBy} = new Function('Element', `${rule}\nreturn {keptBy, keepsBrowserMenu};`)(Element);

const path = (node) => {
  const list = [];
  for (let at = node; at; at = at.parent ?? at.host ?? null) list.push(at);
  return list;
};
const eventAt = (node) => ({composedPath: () => path(node), target: node});
// A table row: <tr><td>{cell}</td><td>name</td></tr> inside a <tbody>.
const row = (cell) => {
  const tr = new Element('tr');
  new Element('tbody').add(tr);
  tr.add(new Element('td').add(cell), new Element('td'));
  return tr;
};

test('a row\'s selection checkbox does not keep the browser menu: the menu opens', () => {
  for (const mark of [
    new Element('input', {type: 'checkbox'}),
    new Element('input', {type: 'radio'}),
    new Element('input', {type: 'checkbox', role: 'switch'}),
    new Element('span', {role: 'checkbox', tabindex: '0'}),
    new Element('button', {type: 'button'}),
    new Element('select'),
  ]) {
    const tr = row(mark);
    assert.equal(keptBy(eventAt(mark), tr), false, `${mark.localName} ${JSON.stringify(mark.attributes)}`);
  }
  // sf-checkbox draws its input in the light DOM, inside a label.
  const input = new Element('input', {type: 'checkbox'});
  const host = new Element('sf-checkbox').add(new Element('label').add(input));
  assert.equal(keptBy(eventAt(input), row(host)), false, 'sf-checkbox');
});

test('a text field keeps the browser menu: the menu does not open', () => {
  for (const field of [
    new Element('input'),
    new Element('input', {type: 'text'}),
    new Element('input', {type: 'search'}),
    new Element('input', {type: 'email'}),
    new Element('input', {type: 'number'}),
    new Element('input', {type: 'date'}),
    new Element('input', {type: 'unknown-kind'}),
    new Element('input', {type: 'text', role: 'combobox'}),
    new Element('textarea'),
    new Element('div', {role: 'textbox'}),
    new Element('div', {role: 'searchbox'}),
    new Element('div', {role: 'combobox'}, {editable: true}),
    new Element('a', {href: '#x'}),
  ]) {
    const tr = row(field);
    assert.equal(keptBy(eventAt(field), tr), true, `${field.localName} ${JSON.stringify(field.attributes)}`);
  }
  // Text inside editable text keeps it too.
  const word = new Element('b');
  const tr = row(new Element('div', {}, {editable: true}).add(word));
  assert.equal(keptBy(eventAt(word), tr), true, 'inside contenteditable');
});

test('through a shadow root: a text field drawn in a component\'s root keeps it, its checkbox does not', () => {
  const draw = (inner) => {
    const host = new Element('x-field');
    const root = new Element('#shadow-root');
    root.host = host;
    root.add(new Element('div').add(inner));
    return {host, inner};
  };
  const text = draw(new Element('input', {type: 'text'}));
  const box = draw(new Element('input', {type: 'checkbox'}));
  assert.equal(keptBy(eventAt(text.inner), row(text.host)), true, 'shadow text field');
  assert.equal(keptBy(eventAt(box.inner), row(box.host)), false, 'shadow checkbox');
});

test('a field outside the object does not keep the browser menu for it', () => {
  // The walk stops at the object: an area inside a link is not a link's menu.
  const cell = new Element('span');
  const tr = row(cell);
  new Element('a', {href: '#x'}).add(tr.parent);
  assert.equal(keptBy(eventAt(cell), tr), false);
});

test('the rule as the source writes it', () => {
  assert.match(source, /const BROWSER_KEEPS = 'a\[href\], textarea, \[role="textbox"\], \[role="searchbox"\]';/);
  assert.match(source, /const TEXT_ENTRY_TYPES = new Set\(\["text", "search", "email", "url", "tel", "password", "number", "date", "time", "datetime-local", "month", "week"\]\);/);
  const handler = take('  handleAreaEvent(event) {', '  surface() {');
  assert.equal((handler.match(/keptBy\(event, found\.target\)/g) ?? []).length, 2, 'the long press and the menu key');
  assert.ok(!handler.includes('closest?.(BROWSER_KEEPS)'), 'no field is found by closest() alone');
  assert.match(take('  browserKeeps(event, target) {', '  // The menu at an object'), /if \(keptBy\(event, target\)\) return true;/);
});
