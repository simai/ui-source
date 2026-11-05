// sf-editor-overlay 1.5.0: the setting passive and the event open (ui-editor
// gaps G-16 and G-17). The element's own handlers are driven with plain
// objects in place of the DOM; tests/browser/overlay-passive-open.browser.mjs
// drives the same in a browser, with real clicks and keys.
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

const { OVERLAY_EVENTS, OVERLAY_EVENTS_FORMER_TAG, defineCompositionOverlay, openDetail } = await import('../src/core/js/composition/overlay.mjs');
const defined = {};
const Overlay = defineCompositionOverlay({ get: (name) => defined[name], define: (name, Class) => { defined[name] = Class; } });

// An overlay over a canvas at (10, 20) with nodes p and h, p chosen.
function overlay() {
  const element = new Overlay();
  element.byId = new Map([['p', { id: 'p', parent: null, slot: null }], ['h', { id: 'h', parent: null, slot: null }]]);
  element.nodes = [...element.byId.values()];
  element.selectedId = 'p';
  element.canvas = { getBoundingClientRect: () => ({ left: 10, top: 20 }) };
  element.element = () => ({ getBoundingClientRect: () => ({ left: 30, top: 40, width: 100, height: 20 }) });
  element.nodeAt = (target) => target.node;
  element.selected = [];
  element.select = (id) => {
    element.selected.push(id);
    element.selectedId = id;
    return element;
  };
  element.toolbar = { querySelector: () => null };
  return element;
}

const pointer = (node, detail, x = 50, y = 70) => ({
  target: { node }, detail, clientX: x, clientY: y, prevented: false, stopped: false,
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; },
});
const key = (name, held = {}) => ({ key: name, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false, prevented: false, preventDefault() { this.prevented = true; }, ...held });
const opens = (element) => element.sent.filter((event) => event.type === OVERLAY_EVENTS.open).map((event) => event.detail);

test('open is the vocabulary\'s verb, under the former tag too until 2027-01-01, its detail frozen', () => {
  assert.equal(OVERLAY_EVENTS.open, 'sf-editor-overlay-open');
  assert.equal(OVERLAY_EVENTS_FORMER_TAG.open, 'sf-composition-overlay-open');
  const detail = openDetail('p', { x: 4, y: 5, extra: 1 }, 'click');
  assert.deepEqual(detail, { ids: ['p'], id: 'p', node: 'p', point: { x: 4, y: 5 }, trigger: 'click' });
  assert.ok(Object.isFrozen(detail) && Object.isFrozen(detail.ids) && Object.isFrozen(detail.point));
  assert.equal(openDetail('p', null, 'enter').point, null);
  assert.equal(openDetail('p', { x: Number.NaN, y: 1 }, 'enter').point, null);
});

test('a second click on the chosen node opens it once, at the point in canvas coordinates', () => {
  const element = overlay();
  const click = pointer('p', 1);
  element.onCanvasClick(click);
  assert.deepEqual(opens(element), [{ ids: ['p'], id: 'p', node: 'p', point: { x: 40, y: 50 }, trigger: 'click' }]);
  assert.ok(click.prevented && click.stopped, 'the click stays the editor\'s');
  assert.deepEqual(element.selected, []);
  // Defined without its manifest, the overlay sends the former-tag name itself, the same detail.
  assert.deepEqual(element.sent.map((event) => event.type), ['sf-editor-overlay-open', 'sf-composition-overlay-open']);
  assert.equal(element.sent[1].detail, element.sent[0].detail);
});

test('a click on another node selects it and opens nothing', () => {
  const element = overlay();
  element.onCanvasClick(pointer('h', 1));
  assert.deepEqual(element.selected, ['h']);
  assert.deepEqual(opens(element), []);
});

test('a double click opens once: by the first click on the chosen node, else by the double click', () => {
  const chosen = overlay();
  chosen.onCanvasClick(pointer('p', 1));
  chosen.onCanvasClick(pointer('p', 2));
  chosen.onCanvasDoubleClick(pointer('p', 2));
  assert.deepEqual(opens(chosen).map(({ trigger }) => trigger), ['click']);

  const other = overlay();
  other.onCanvasClick(pointer('h', 1, 60, 90));
  other.onCanvasClick(pointer('h', 2, 60, 90));
  other.onCanvasDoubleClick(pointer('h', 2, 60, 90));
  assert.deepEqual(other.selected, ['h']);
  assert.deepEqual(opens(other), [{ ids: ['h'], id: 'h', node: 'h', point: { x: 50, y: 70 }, trigger: 'dblclick' }]);

  // A later double click is a gesture of its own.
  chosen.onCanvasClick(pointer('p', 1));
  chosen.onCanvasClick(pointer('p', 2));
  chosen.onCanvasDoubleClick(pointer('p', 2));
  assert.equal(opens(chosen).length, 2);
});

test('Enter on the chosen node opens it at the centre of its box; with a modifier it does not', () => {
  const element = overlay();
  const enter = key('Enter');
  element.onTreeKey(enter);
  assert.deepEqual(opens(element), [{ ids: ['p'], id: 'p', node: 'p', point: { x: 70, y: 30 }, trigger: 'enter' }]);
  assert.ok(enter.prevented);
  element.onTreeKey(key('Enter', { shiftKey: true }));
  assert.equal(opens(element).length, 1);
});

test('passive: no click, double click or key is read, prevented or stopped; the selection stays', () => {
  const element = overlay();
  element.passive = true;
  assert.equal(element.getAttribute('passive'), '');
  assert.equal(element.passive, true);
  const click = pointer('p', 1);
  element.onCanvasClick(click);
  element.onCanvasClick(pointer('h', 1));
  element.onCanvasDoubleClick(pointer('h', 2));
  const enter = key('Enter');
  element.onTreeKey(enter);
  element.onFrameClick(pointer('p', 1));
  element.onFrameKey(key('Enter'));
  assert.deepEqual(element.sent, []);
  assert.deepEqual(element.selected, []);
  assert.equal(element.selectedId, 'p');
  assert.ok(!click.prevented && !click.stopped && !enter.prevented);
  assert.equal(element.sendOpen('p', null, 'click'), false, 'open is never sent while passive');

  element.passive = false;
  assert.equal(element.hasAttribute('passive'), false);
  element.onCanvasClick(pointer('p', 1));
  assert.deepEqual(opens(element).map(({ id }) => id), ['p'], 'off again, the kept selection opens on a click');
});

test('passive reads the attribute as the manifest base reads a boolean', () => {
  const element = overlay();
  for (const [value, expected] of [['', true], ['true', true], ['on', true], ['false', false], ['no', false]]) {
    element.attributes.set('passive', value);
    assert.equal(element.isPassive(), expected, JSON.stringify(value));
  }
  element.attributes.delete('passive');
  assert.equal(element.isPassive(), false);
  assert.ok(Overlay.observedAttributes.includes('passive'));
});

test('the manifest declares passive and open as the element does', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/smart/editor-overlay/smart.manifest.json', import.meta.url), 'utf8'));
  const component = JSON.parse(await readFile(new URL('../src/smart/editor-overlay/component.json', import.meta.url), 'utf8'));
  assert.equal(component.version, '1.5.0');
  assert.equal(manifest.version, '1.5.0');
  assert.deepEqual([manifest.inputs.properties.passive.type, manifest.inputs.properties.passive.default], ['boolean', false]);
  const open = manifest.events['sf-editor-overlay-open'];
  assert.deepEqual(open.payload.required, ['ids', 'id', 'node', 'point', 'trigger']);
  assert.deepEqual(open.payload.properties.trigger.enum, ['click', 'dblclick', 'enter']);
  assert.ok(manifest.events['sf-composition-overlay-open'], 'the former-tag name is declared until 2027-01-01');
});
