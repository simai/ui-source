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

// Two windows of keydown listeners, as the browser has them: capture, then
// bubble; and the same two for pointerdown.
const listeners = {capture: [], bubble: []};
const pointer = {capture: [], bubble: []};
globalThis.addEventListener = (type, fn, capture) => {
  if (type === 'keydown') listeners[capture ? 'capture' : 'bubble'].push(fn);
  if (type === 'pointerdown') pointer[capture ? 'capture' : 'bubble'].push(fn);
};
// A pointerdown whose composed path holds these nodes.
const pointerDown = (path, {onTheWay} = {}) => {
  const event = {composedPath: () => path};
  pointer.capture.forEach((fn) => fn(event));
  onTheWay?.(event);
  pointer.bubble.forEach((fn) => fn(event));
  return event;
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
  pointer.capture.length = 0;
  pointer.bubble.length = 0;
  const doc = {activeElement: null, body: null, querySelectorAll: () => [],
    defaultView: {getComputedStyle: () => ({visibility: 'visible'}), MutationObserver: class { observe() {} disconnect() {} }}};
  globalThis.document = doc;
  const node = (name, inside = null) => ({name, isConnected: true, ownerDocument: doc, parentElement: inside,
    matches: () => false, closest: () => null, getClientRects: () => [{}], hasAttribute: () => false,
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
    contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; },
    focus() { doc.activeElement = this; },
    blur() { if (doc.activeElement === this) doc.activeElement = doc.body; }});
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

test('a layer opened while nothing had focus gives it back to the body, not to a landmark (§19.2)', () => {
  const {doc, node} = reset();
  // As in a browser: the body is active when nothing is focused, and its
  // focus() takes nothing.
  doc.body.focus = () => {};
  doc.activeElement = doc.body;
  const written = [];
  const main = node('main');
  main.setAttribute = (name, value) => written.push([name, value]);
  doc.querySelectorAll = () => [main];
  const modalRoot = node('modal-root');
  const modal = layer(modalBundle, 'modal', 'modal', {root: modalRoot});
  node('in-modal', modalRoot).focus();
  press('Escape');
  assert.equal(modalBundle.hasLayer(modal), false);
  assert.equal(doc.activeElement, doc.body);
  // The page's own <main> took no focus and no temporary tabindex.
  assert.deepEqual(written, []);

  // An opener that is gone still falls back to the landmark.
  const {doc: next, node: make} = reset();
  const landmark = make('main');
  next.querySelectorAll = () => [landmark];
  const gone = make('gone');
  gone.focus();
  const second = layer(drawerBundle, 'drawer', 'panel', {root: make('drawer-root')});
  gone.isConnected = false;
  drawerBundle.closeLayer(second);
  assert.equal(next.activeElement, landmark);
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

// One document listener for an outside press (reuse audit 2026-11-02, finding
// 1): a popover, a menu and a context menu each bound one of their own.
test('an outside press reaches the top layer only; a press inside it, or a layer below, is not heard', () => {
  reset();
  const log = [];
  const popoverRoot = {name: 'popover-root'};
  const popover = {isConnected: true};
  drawerBundle.openLayer(popover, {kind: 'surface', root: () => popoverRoot,
    onOutsidePress: () => log.push('popover:outside')});
  const listRoot = {name: 'list-root'};
  const list = {isConnected: true};
  modalBundle.openLayer(list, {kind: 'surface', root: () => listRoot,
    onOutsidePress: () => { log.push('list:outside'); modalBundle.closeLayer(list, {restoreFocus: false}); }});
  // Inside the top layer: its root, or its owner when it draws in place.
  pointerDown([{}, listRoot, {}]);
  pointerDown([list]);
  assert.deepEqual(log, []);
  // Inside the popover under the list is outside the list: the list closes,
  // and the popover, no longer under anything, is not handed the same press.
  pointerDown([popoverRoot]);
  assert.deepEqual(log, ['list:outside']);
  // Now the popover is the top layer.
  pointerDown([{name: 'page'}]);
  assert.deepEqual(log, ['list:outside', 'popover:outside']);
});

test('a layer that opens on the way down does not take the press that opened it', () => {
  reset();
  const log = [];
  const below = {isConnected: true};
  drawerBundle.openLayer(below, {kind: 'surface', root: () => ({}), onOutsidePress: () => log.push('below:outside')});
  const above = {isConnected: true};
  pointerDown([{name: 'trigger'}], {onTheWay: () => modalBundle.openLayer(above, {kind: 'surface',
    root: () => ({}), onOutsidePress: () => log.push('above:outside')})});
  assert.deepEqual(log, []);
  // A toast takes no presses: the layer under it is still the top one.
  modalBundle.openLayer({isConnected: true}, {kind: 'toast'});
  pointerDown([{name: 'page'}]);
  assert.deepEqual(log, ['above:outside']);
});

// One default page lock (finding 2): a drawer, a site header and a search
// window each wrote a copy of their own, without the modal's care.
test('a layer that locks the page and brings no lock takes the default one, one lease for all', () => {
  reset();
  const marks = [];
  const node = () => {
    const classes = new Set();
    const props = new Map();
    return {clientWidth: 1000,
      classList: {contains: (name) => classes.has(name), add: (name) => { classes.add(name); }, remove: (name) => { classes.delete(name); }},
      style: {getPropertyValue: (name) => props.get(name)?.[0] ?? '', getPropertyPriority: (name) => props.get(name)?.[1] ?? '',
        setProperty(name, value, priority = '') { props.set(name, [value, priority]); }, removeProperty(name) { props.delete(name); }}};
  };
  const html = node();
  const body = node();
  Object.assign(globalThis.document, {documentElement: html, body});
  globalThis.document.defaultView.innerWidth = 1015;
  globalThis.document.defaultView.getComputedStyle = () => ({visibility: 'visible', paddingInlineEnd: '0'});
  const locked = () => html.classList.contains('overflow-hidden') && body.style.getPropertyValue('overflow') === 'hidden';
  const drawer = {isConnected: true};
  const header = {isConnected: true};
  const search = {isConnected: true};
  drawerBundle.openLayer(drawer, {kind: 'panel', locksPage: true});
  marks.push(locked(), body.style.getPropertyValue('padding-inline-end'));
  modalBundle.openLayer(header, {kind: 'panel', locksPage: true});
  // A layer that does not lock the page (a search window in an overlay box).
  modalBundle.openLayer(search, {kind: 'modal', locksPage: false});
  drawerBundle.closeLayer(drawer, {restoreFocus: false});
  marks.push(locked());
  modalBundle.closeLayer(header, {restoreFocus: false});
  marks.push(locked(), body.style.getPropertyValue('padding-inline-end'));
  assert.deepEqual(marks, [true, '15px', true, false, '']);
  // preserveScrollGap: false leaves the page's padding alone.
  drawerBundle.openLayer(drawer, {kind: 'panel', locksPage: true, preserveScrollGap: false});
  assert.equal(body.style.getPropertyValue('padding-inline-end'), '');
  drawerBundle.closeLayer(drawer, {restoreFocus: false});
});

test('the components keep one list of what takes focus, and no lock or outside listener of their own', async () => {
  const stack = await modalBundle;
  assert.match(stack.FOCUSABLE, /\[contenteditable="true"\]/);
  for (const path of ['src/smart/drawer/index.js', 'src/smart/header-site/index.js', 'src/smart/search/index.js', 'src/core/js/workspace.js']) {
    const code = await read(path);
    assert.doesNotMatch(code, /const FOCUSABLE(_SELECTOR)? = /, `${path} keeps a list of its own`);
    assert.doesNotMatch(code, /^\s+lockPage\(/mu, `${path} writes a page lock of its own`);
  }
  for (const path of ['src/smart/help-mark/index.js', 'src/smart/menu-context/index.js', 'src/smart/menu/index.js', 'src/smart/profile-picker/index.js']) {
    assert.doesNotMatch(await read(path), /addEventListener\(['"]pointerdown['"]/u, `${path} binds an outside press of its own`);
  }
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
  assert.ok(modal.includes('carryLayerOrigin(this._portalRoot, this, { variables: MODAL_VARIABLES, area: true, except: ["--sf-modal-"] })'));
  assert.ok(modal.includes('const MODAL_VARIABLES = Object.keys(manifest["css-variables"] || {});'));
  assert.ok((await read('src/smart/drawer/index.js')).includes("carryLayerOrigin(portal, this, {variables: DRAWER_VARIABLES, area: true, except: ['--sf-drawer-']})"));
});
