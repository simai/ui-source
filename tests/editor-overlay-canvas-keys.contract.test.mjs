// sf-editor-overlay 1.5.1: the action keys of a pointer selection on a 'for'
// canvas (simai/ui-source#62). A click leaves focus on the scroller around the
// canvas or on the body; the selected node's action shortcuts are taken there.
// The handlers are driven with plain objects in place of the DOM;
// tests/browser/composition-host-canvas.browser.mjs drives the same with a real
// mouse and keys.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// A host element of attributes and dispatched events, enough for the handlers.
globalThis.HTMLElement ??= class {
  constructor() {
    this.attributes = new Map();
    this.sent = [];
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this.attributeChangedCallback?.(name, null, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    this.attributeChangedCallback?.(name, null, null);
  }

  toggleAttribute(name, force) {
    if (force) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return Boolean(force);
  }

  dispatchEvent(event) {
    this.sent.push(event);
    return true;
  }
};
globalThis.CustomEvent ??= class {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

const { OVERLAY_EVENTS, defineCompositionOverlay } = await import('../src/core/js/composition/overlay.mjs');
const defined = {};
const Overlay = defineCompositionOverlay({ get: (name) => defined[name], define: (name, Class) => { defined[name] = Class; } });

// A tree of plain elements: each knows its parent, so contains and closest work.
function element(localName, parent = null, extra = {}) {
  const node = {
    nodeType: 1, localName, parent, attributes: {}, isContentEditable: false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }),
    getAttribute(name) { return this.attributes[name] ?? null; },
    contains(other) { for (let at = other; at; at = at.parent) if (at === this) return true; return false; },
    closest(selector) {
      if (selector !== '[contenteditable]:not([contenteditable="false"])') return null;
      for (let at = this; at; at = at.parent) if (at.attributes.contenteditable !== undefined && at.attributes.contenteditable !== 'false') return at;
      return null;
    },
    ...extra,
  };
  return node;
}

// body > scroller > canvas > block; the overlay and its tree beside the canvas.
function page() {
  const body = element('body');
  const scroller = element('section', body);
  const canvas = element('div', scroller);
  const block = element('p', canvas);
  const field = element('input', block);
  const editable = element('div', block);
  editable.attributes.contenteditable = 'true';
  const button = element('button', block);
  const outside = element('aside', body);
  const overlay = new Overlay();
  const tree = element('div', scroller);
  overlay.contains = (other) => tree.contains(other);
  overlay.canvas = canvas;
  overlay.byId = new Map([['b', { id: 'b', parent: null, slot: null }], ['c', { id: 'c', parent: null, slot: null }]]);
  overlay.nodes = [...overlay.byId.values()];
  overlay.nodeAt = (target) => target.node ?? null;
  overlay.select = (id) => { overlay.selectedId = id; return overlay; };
  overlay.sendOpen = () => false;
  overlay._actions = [
    { id: 'move-down', label: 'Down', shortcut: '⌥↓' },
    { id: 'remove', label: 'Remove', shortcut: '⌫' },
    { id: 'locked', label: 'Locked', shortcut: '⌘D', disabled: true },
  ];
  return { body, scroller, canvas, block, field, editable, button, outside, overlay, tree };
}

const click = (node) => ({ target: { node }, detail: 1, clientX: 5, clientY: 5, preventDefault() {}, stopPropagation() {} });
const key = (target, name, held = {}) => ({
  target, key: name, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false, isComposing: false, defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; }, ...held,
});
const applied = (overlay) => overlay.sent.filter((event) => event.type === OVERLAY_EVENTS.action).map((event) => event.detail);

test('after a click on a block, an action key on the scroller or the body is the action\'s', () => {
  const { overlay, scroller, body, canvas, block } = page();
  overlay.onCanvasClick(click('b'));
  assert.equal(overlay.selectedId, 'b');
  for (const target of [scroller, body, canvas, block]) {
    const down = key(target, 'ArrowDown', { altKey: true });
    overlay.onCanvasKey(down);
    assert.ok(down.defaultPrevented, `the key is taken on ${target.localName}`);
  }
  assert.deepEqual(applied(overlay).map(({ action, ids, scope }) => [action, scope, ids]), Array(4).fill(['move-down', 'entry', ['b']]));
  overlay.onCanvasKey(key(body, 'Backspace'));
  assert.deepEqual(applied(overlay).at(-1), { action: 'remove', scope: 'entry', ids: ['b'] });
});

test('a disabled action takes its key and sends nothing; a key no action names passes', () => {
  const { overlay, body } = page();
  overlay.onCanvasClick(click('b'));
  const locked = key(body, 'd', { metaKey: true });
  overlay.onCanvasKey(locked);
  assert.ok(locked.defaultPrevented);
  const plain = key(body, 'ArrowDown');
  overlay.onCanvasKey(plain);
  assert.ok(!plain.defaultPrevented, 'arrows without the modifier stay the page\'s');
  assert.deepEqual(applied(overlay), []);
});

test('the canvas takes no key before a pointer selection, while passive, in a field, outside the canvas or in the tree', () => {
  const none = page();
  none.overlay.selectedId = 'b';
  none.overlay.onCanvasKey(key(none.body, 'Backspace'));
  assert.deepEqual(applied(none.overlay), [], 'a selection made by the host or the tree is not a pointer selection');

  const { overlay, field, editable, button, outside, tree, body } = page();
  overlay.onCanvasClick(click('b'));
  for (const target of [field, editable, outside, tree]) overlay.onCanvasKey(key(target, 'Backspace'));
  assert.deepEqual(applied(overlay), [], 'a text field, an editable, a place beside the canvas and the tree keep their keys');
  overlay.onCanvasKey(key(button, 'Backspace'));
  assert.equal(applied(overlay).length, 1, 'a button in a block types nothing: the key is the action\'s');
  const prevented = key(body, 'Backspace');
  prevented.defaultPrevented = true;
  overlay.onCanvasKey(prevented);
  assert.equal(applied(overlay).length, 1, 'a key the page already took is left alone');
  overlay.passive = true;
  overlay.onCanvasKey(key(body, 'Backspace'));
  assert.equal(applied(overlay).length, 1, 'passive: nothing is read');
  overlay.passive = false;
  overlay.selectedId = null;
  overlay.onCanvasKey(key(body, 'Backspace'));
  assert.equal(applied(overlay).length, 1, 'no selection, no action');
});

test('of two overlays on a page, the one clicked last takes a key on the body', () => {
  const first = page();
  const second = page();
  second.overlay.canvas = first.canvas;
  first.overlay.onCanvasClick(click('b'));
  second.overlay.onCanvasClick(click('c'));
  first.overlay.onCanvasKey(key(first.body, 'Backspace'));
  second.overlay.onCanvasKey(key(first.body, 'Backspace'));
  assert.deepEqual(applied(first.overlay), []);
  assert.deepEqual(applied(second.overlay).map(({ ids }) => ids), [['c']]);
});

test('a framed overlay reads keys inside its frame only, as before', () => {
  const { overlay, body } = page();
  overlay.onCanvasClick(click('b'));
  overlay.iframe = {};
  overlay.onCanvasKey(key(body, 'Backspace'));
  assert.deepEqual(applied(overlay), []);
});

test('the version moves to 1.5.1 or later in the manifests', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/smart/editor-overlay/smart.manifest.json', import.meta.url), 'utf8'));
  const component = JSON.parse(await readFile(new URL('../src/smart/editor-overlay/component.json', import.meta.url), 'utf8'));
  // 1.5.2 carries the counted sortable id on top of 1.5.1; 1.5.3 its first-paint list after the actions block.
  // 1.6.0: the toolbar is the overlay place (C20); 1.7.0 it declares a popup place (C16).
  assert.equal(component.version, '1.7.0');
  assert.equal(manifest.version, '1.7.0');
  assert.ok(component['x-decisions'].some((entry) => entry.startsWith('version 1.5.1 (simai/ui-source#62')), 'the decision is recorded');
});
