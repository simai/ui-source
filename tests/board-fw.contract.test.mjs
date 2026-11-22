import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// View round 2 board orders for SIMAI Framework (fix/board-fw, 2026-11-18).
// (1) A plain host (sf-sortable, sf-editor-inline, sf-editor-overlay) inside
// another element's printed first paint leaves the children there: a board
// drew its cards into the list, and sf-sortable's code coming first cleared
// them as its own static markup. (2) sf-view-board is a reserved name of the
// view set. (3) Tabs with no panel content keep their panel row hidden.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function body(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, signature);
  const open = source.indexOf('{', start + signature.length - 1);
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, at);
}

// A child as the parser leaves it: attributes and a remove().
function child(attributes, list) {
  const own = new Map(Object.entries(attributes));
  const node = {
    hasAttribute: (name) => own.has(name),
    removeAttribute: (name) => own.delete(name),
    remove: () => list.splice(list.indexOf(node), 1),
  };
  return node;
}

function host(inPicture) {
  const children = [];
  children.push(child({'data-sf-static': '', 'data-sf-sortable-item': 'c1'}, children));
  children.push(child({'data-sf-static': '', 'data-sf-sortable-item': 'c2'}, children));
  children.push(child({'data-sf-sortable-item': 'c3', slot: 'item'}, children));
  return {
    children,
    attributes: new Map([['data-sf-first-paint', 'skeleton']]),
    removeAttribute(name) { this.attributes.delete(name); },
    closest: (selector) => (selector === '[data-sf-static]' && inPicture ? {} : null),
    constructor: {},
  };
}

test('a plain host inside a printed picture keeps the children there; one the page wrote ends its first paint', () => {
  const source = read('src/core/js/composition/manifest-host.mjs');
  const connected = new Function(`return function () {${body(source, '    connectedCallback() {')}}`)();
  const inPicture = new Function(`return function () {${body(source, '    sfInPicture() {')}}`)();

  const nested = host(true);
  nested.sfInPicture = inPicture;
  connected.call(nested);
  assert.equal(nested.children.length, 3, 'the cards the board drew stay until the board draws');
  assert.equal(nested.__sfFirstPaintEnded, undefined, 'its first paint is not ended: a later connect still ends it');

  const own = host(false);
  own.sfInPicture = inPicture;
  connected.call(own);
  assert.equal(own.children.length, 1, 'its own static markup goes; a slotted child stays');
  assert.equal(own.__sfFirstPaintEnded, true);
  assert.equal(own.attributes.has('data-sf-first-paint'), false);
});

test('sf-sortable in a picture adds no live region and takes no keys until it is drawn live', () => {
  const source = read('src/core/js/composition/sortable.mjs');
  const connected = body(source, '    connectedCallback() {');
  assert.match(connected, /super\.connectedCallback\?\.\(\);\s*(?:\/\/[^\n]*\n\s*)*if \(this\.sfInPicture\?\.\(\)\) return;\s*if \(this\.connection\) return;/u);
  for (const name of ['sortable', 'editor-inline', 'editor-overlay']) {
    const component = JSON.parse(read(`src/smart/${name}/component.json`));
    // group build 14: a later note (the manifest probe patch) may follow it
    assert.ok(component['x-decisions'].some((note) => /fix\/board-fw/u.test(note)), `${name} notes the plain host`);
  }
  assert.equal(JSON.parse(read('src/smart/sortable/component.json')).version, '1.7.6'); // group build 15: 1.7.6 = VS-SITE-4's words (written as 1.7.4) above reds-before-gb15's 1.7.5; reds-before-gb15: 1.7.5 probe only, above 1.7.4 on fix/ru-words-vs-site-4; // group build 13: 1.7.2 moved on by the merged branches or a GB11 merge
});

test('sf-view-board is a preview name of the view set (rule cl-view-board; GB15 A7: the set ships it)', () => {
  const registry = JSON.parse(read('contracts/registry/names.json'));
  const view = registry.owners.find(({id}) => id === 'view');
  assert.deepEqual(view.names.find(({element}) => element === 'sf-view-board'), {element: 'sf-view-board', status: 'preview'});
  assert.ok(view.families.includes('view'));
  const others = registry.owners.filter(({id}) => id !== 'view').flatMap(({names}) => names.map(({element}) => element));
  assert.ok(!others.includes('sf-view-board'), 'one owner per name');
  assert.match(view.source, /sf-view-board \(rule cl-view-board\)/u);
});

test('tabs with no panel content keep their panel row hidden; words written later show it', () => {
  const template = read('src/smart/tabs/js/templates/default.js');
  assert.match(template, /<div class="sf-tabs-main-container" \?hidden=\$\{!panels\} \?data-sf-panels-empty=\$\{!panels\}>/u);
  assert.match(template, /const panels = hasPanelContent\(context\);/u);
  const source = read('src/smart/tabs/index.js');
  const panelHasContent = new Function(`return function panelHasContent(panel) {${body(source, '\nfunction panelHasContent(panel) {')}}`)();
  const sync = new Function('FOCUSABLE', 'panelHasContent', `return function () {${body(source, '\n  syncPanelFocus() {')}}`)('input', panelHasContent);
  const panel = (nodes) => ({childNodes: nodes, querySelector: () => null, setAttribute() {}, removeAttribute() {}});
  const row = {hidden: true};
  const tabs = (panels, links = false) => ({links, drawnPanels: () => panels, _authoredPanelFocus: new WeakSet(), watchPanelContent() {},
    querySelector: (selector) => (selector.endsWith('.sf-tabs-main-container[data-sf-panels-empty]') ? row : null)});
  sync.call(tabs([panel([{nodeType: 8}]), panel([])]));
  assert.equal(row.hidden, true, 'nothing in the panels: no room');
  sync.call(tabs([panel([{nodeType: 3, textContent: 'Текст'}]), panel([])]));
  assert.equal(row.hidden, false, 'a host wrote into a panel: the row shows');
  sync.call(tabs([panel([]), panel([])]));
  assert.equal(row.hidden, true, 'emptied again');
  assert.equal(JSON.parse(read('src/smart/tabs/component.json')).version, '1.5.2'); // GB16-5/6: the label beside the glyph, name tooltips; // group build 16 returns GB16-1/2: the tightest row; // group build 16: G9 fold; // group build 13: 1.4.5 moved on by the merged branches or a GB11 merge // group build 14: 1.4.6 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
});
