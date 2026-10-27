// The one document layer stack (standard simai.smart-component 1.3.8 §19.1-19.3).
// Three lists and two z-index bases broke it: Escape over a modal opened from a
// drawer closed the drawer (simai/ui-source#36), and a drawer opened from a
// modal was drawn under it (simai/ui-source#37). The stack is exercised here as
// two bundles would load it, each with its own copy of the module.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('src/core/js/layer-stack.js');

// Two windows of keydown listeners, as the browser has them: capture, then bubble.
const listeners = {capture: [], bubble: []};
globalThis.addEventListener = (type, fn, capture) => {
  if (type === 'keydown') listeners[capture ? 'capture' : 'bubble'].push(fn);
};
const press = (key, {onTheWay} = {}) => {
  const event = {key, defaultPrevented: false, stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }};
  listeners.capture.forEach((fn) => fn(event));
  onTheWay?.(event);
  if (!event.stopped) listeners.bubble.forEach((fn) => fn(event));
  return event;
};

const load = (copy) => import(`data:text/javascript,${encodeURIComponent(`${source}\n// ${copy}`)}`);
const modalBundle = await load('modal bundle');
const drawerBundle = await load('drawer bundle');

function reset() {
  delete globalThis[Symbol.for('sf.layerStack')];
  listeners.capture.length = 0;
  listeners.bubble.length = 0;
  const doc = {activeElement: null, body: null, querySelectorAll: () => [],
    defaultView: {getComputedStyle: () => ({visibility: 'visible'}), MutationObserver: class { observe() {} disconnect() {} }}};
  globalThis.document = doc;
  const node = (name, inside = null) => ({name, isConnected: true, ownerDocument: doc, parentElement: inside,
    matches: () => false, closest: () => null, getClientRects: () => [{}], hasAttribute: () => false,
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
    contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; },
    focus() { doc.activeElement = this; }});
  doc.body = node('body');
  return {doc, node};
}

// A layer as a component registers it: its root, its handlers, its height.
function layer(bundle, name, kind, {root, trapsFocus = true, log = []} = {}) {
  const owner = {name, isConnected: true, placed: null};
  bundle.openLayer(owner, {
    kind, trapsFocus,
    root: () => root,
    focusIn: () => { log.push(`${name}:focus-in`); root?.focus(); },
    onEscape: () => { log.push(`${name}:escape`); bundle.closeLayer(owner); return true; },
    onTab: () => log.push(`${name}:tab`),
    place: (placed) => { owner.placed = placed; },
  });
  return owner;
}

test('a modal opened from a drawer takes Escape; the drawer stays (#36)', () => {
  const {doc, node} = reset();
  const log = [];
  const opener = node('page-opener');
  opener.focus();
  const drawerRoot = node('drawer-root');
  const drawer = layer(drawerBundle, 'drawer', 'panel', {root: drawerRoot, log});
  const inDrawer = node('drawer-button', drawerRoot);
  inDrawer.focus();
  const modalRoot = node('modal-root');
  const modal = layer(modalBundle, 'modal', 'modal', {root: modalRoot, log});
  assert.equal(drawerBundle.isTopLayer(drawer), false);
  assert.equal(modalBundle.isTopLayer(modal), true);
  const event = press('Escape');
  assert.deepEqual(log, ['modal:escape']);
  assert.equal(event.defaultPrevented, true);
  assert.equal(drawerBundle.hasLayer(drawer), true);
  assert.equal(drawerBundle.isTopLayer(drawer), true);
  // Focus goes back to the button in the drawer the modal was opened from.
  assert.equal(doc.activeElement, inDrawer);
});

test('a layer opened later is drawn higher, across kinds and bundles (#37)', () => {
  reset();
  const modal = layer(modalBundle, 'modal', 'modal');
  const drawer = layer(drawerBundle, 'drawer', 'panel');
  assert.ok(drawer.placed.zIndex > modal.placed.zIndex);
  assert.equal(modal.placed.zIndex, 9000);
  assert.equal(drawer.placed.zIndex, 9002);
  assert.equal(drawer.placed.top, true);
  // Raising the modal puts it back on top, and above the drawer.
  modalBundle.raiseLayer(modal);
  assert.ok(modal.placed.zIndex > drawer.placed.zIndex);
  assert.equal(modalBundle.layerZIndex({}), '');
});

test('focus returns through three stacked layers, each to its own opener', () => {
  const {doc, node} = reset();
  const page = node('page-button');
  page.focus();
  const drawerRoot = node('drawer-root');
  const drawer = layer(drawerBundle, 'drawer', 'panel', {root: drawerRoot});
  const inDrawer = node('in-drawer', drawerRoot);
  inDrawer.focus();
  const modalRoot = node('modal-root');
  const modal = layer(modalBundle, 'modal', 'modal', {root: modalRoot});
  const inModal = node('in-modal', modalRoot);
  inModal.focus();
  const secondRoot = node('second-root');
  layer(drawerBundle, 'second', 'panel', {root: secondRoot});
  node('in-second', secondRoot).focus();
  press('Escape');
  assert.equal(doc.activeElement, inModal);
  press('Escape');
  assert.equal(doc.activeElement, inDrawer);
  assert.equal(modalBundle.hasLayer(modal), false);
  press('Escape');
  assert.equal(doc.activeElement, page);
  assert.equal(drawerBundle.hasLayer(drawer), false);
});

test('a layer that closes under another one moves no focus; one whose opener is gone hands focus to the new top', () => {
  const {doc, node} = reset();
  const log = [];
  const drawerRoot = node('drawer-root');
  const opener = node('opener', drawerRoot);
  opener.focus();
  const drawer = layer(drawerBundle, 'drawer', 'panel', {root: drawerRoot, log});
  const modalRoot = node('modal-root');
  const inModal = node('in-modal', modalRoot);
  layer(modalBundle, 'modal', 'modal', {root: modalRoot, log});
  inModal.focus();
  // The drawer under the modal closes from a script: the focus stays.
  drawerBundle.closeLayer(drawer);
  assert.equal(doc.activeElement, inModal);

  const {doc: next, node: make} = reset();
  const lowerRoot = make('lower-root');
  const lower = layer(modalBundle, 'lower', 'modal', {root: lowerRoot, log});
  const gone = make('gone');
  gone.focus();
  const upper = layer(modalBundle, 'upper', 'modal', {root: make('upper-root'), log});
  gone.isConnected = false;
  modalBundle.closeLayer(upper);
  assert.equal(next.activeElement, lowerRoot);
  assert.ok(log.includes('lower:focus-in'));
  assert.equal(modalBundle.isTopLayer(lower), true);
});

test('only the top layer hears Tab; a control that handled Escape keeps it', () => {
  reset();
  const log = [];
  layer(drawerBundle, 'drawer', 'panel', {log});
  layer(modalBundle, 'modal', 'modal', {log});
  press('Tab');
  assert.deepEqual(log, ['modal:tab']);
  press('Escape', {onTheWay: (event) => event.preventDefault()});
  assert.deepEqual(log, ['modal:tab']);
});

test('a surface that closed itself on the way down does not hand the press to the layer under it', () => {
  reset();
  const log = [];
  const drawer = layer(drawerBundle, 'drawer', 'panel', {log});
  const list = {name: 'list', isConnected: true};
  modalBundle.openLayer(list, {kind: 'surface'});
  assert.equal(drawerBundle.isTopLayer(drawer), false);
  // The list's own listener closes it without preventing the default.
  press('Escape', {onTheWay: () => modalBundle.closeLayer(list, {restoreFocus: false})});
  assert.deepEqual(log, []);
  press('Escape');
  assert.deepEqual(log, ['drawer:escape']);
});

test('the toast area is a layer that takes no keys', () => {
  reset();
  const log = [];
  const modal = layer(modalBundle, 'modal', 'modal', {log});
  const area = {isConnected: true};
  modalBundle.openLayer(area, {kind: 'toast', place: (placed) => { area.placed = placed; }});
  assert.equal(modalBundle.isTopLayer(modal), true);
  assert.ok(area.placed.zIndex > modal.placed.zIndex);
  press('Escape');
  assert.deepEqual(log, ['modal:escape']);
});

test('one page lock for the whole stack, given back when the last locking layer closes', () => {
  reset();
  const calls = [];
  const lock = (who) => () => { calls.push(`${who}:lock`); return () => calls.push(`${who}:unlock`); };
  const modal = {isConnected: true};
  const drawer = {isConnected: true};
  modalBundle.openLayer(modal, {kind: 'modal', locksPage: true, lockPage: lock('modal')});
  drawerBundle.openLayer(drawer, {kind: 'panel', locksPage: true, lockPage: lock('drawer')});
  // Closed out of order: the page stays locked under the drawer.
  modalBundle.closeLayer(modal, {restoreFocus: false});
  assert.deepEqual(calls, ['modal:lock']);
  drawerBundle.closeLayer(drawer, {restoreFocus: false});
  assert.deepEqual(calls, ['modal:lock', 'modal:unlock']);
});

test('a layer removed from the document without closing does not hold the keys', () => {
  reset();
  const log = [];
  layer(drawerBundle, 'drawer', 'panel', {log});
  const modal = layer(modalBundle, 'modal', 'modal', {log});
  modal.isConnected = false;
  press('Escape');
  assert.deepEqual(log, ['drawer:escape']);
});

test('the scale is one pair of core tokens, and the old bases are gone from the overlays', async () => {
  const size = await read('src/core/scss/_sf_css__size.scss');
  assert.match(size, /--sf-z-index-layer: #\{zIndexVars\.\$z-index-layer\};/);
  assert.match(size, /--sf-z-index-layer-step: #\{zIndexVars\.\$z-index-layer-step\};/);
  const vars = await read('src/utility/z-index/default/scss/_sf_var__z_index.scss');
  assert.match(vars, /\$z-index-layer: 9000;/);
  assert.match(vars, /\$z-index-layer-step: 2;/);
  const drawer = await read('src/smart/drawer/index.js');
  assert.doesNotMatch(drawer, /--sf-z-index-9/);
  assert.doesNotMatch(drawer, /const drawerStack = \[\]/);
  assert.match(await read('src/smart/drawer/scss/_smart__drawer.scss'), /var\(--sf-drawer-z-index, var\(--sf-z-index-layer, 9000\)\)/);
  const modal = await read('src/smart/modal/index.js');
  assert.match(modal, /return layerZIndexAt\(this\._stackIndex\);/);
  assert.match(await read('src/component/modal/js/_modal.js'), /String\(layerZIndexAt\(index\)\)/);
});

test('sf-modal places the page nodes of its slots and never re-serialises them (§4.5, #42)', async () => {
  const modal = await read('src/smart/modal/index.js');
  for (const slot of ['header', 'content', 'footer']) {
    assert.ok(modal.includes(`${slot}Content: this.slotNodes("${slot}")`), slot);
  }
  assert.doesNotMatch(modal, /unsafeHTML\(this\.getSlotHtml/);
  // The root takes the modal id only when the element does not already hold it.
  assert.ok(modal.includes('rootId: this.id === this.modalId ? "" : this.modalId'));
  assert.match(await read('src/smart/modal/js/templates/default.js'), /id=\$\{context\.rootId \|\| nothing\}/);
  // The portal keeps lang, dir and theme of where the element stands (§19.1).
  // ... and the values of the public variables its manifest declares (§19.1).
  assert.ok(modal.includes('carryLayerOrigin(this._portalRoot, this, { variables: MODAL_VARIABLES })'));
  assert.ok(modal.includes('const MODAL_VARIABLES = Object.keys(manifest["css-variables"] || {});'));
  assert.ok((await read('src/smart/drawer/index.js')).includes('carryLayerOrigin(portal, this, {variables: DRAWER_VARIABLES})'));
});
