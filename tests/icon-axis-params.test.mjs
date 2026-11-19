// The subset request names grade and optical size as the icon service does
// (grad, opsz) and asks for ranges kept as variable axes (ui-control evidence
// 2026-11-19-icons-axes): the runtime sent grade and optical_size, which the
// service never read, so an author's grade and every optical size reached it
// as nothing and the font came back at GRAD 0 and opsz 24.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  iconAxisNumbers,
  iconAxisRequestRange,
  ICON_AXIS_PAGE_RANGE,
} from '../src/core/js/icon-subset-memory.js';
import {initIconSubsetState, installIconSubsetRuntime} from '../src/core/js/iconSubsetRuntime.js';

class TestLoader {
  constructor() {
    this.uniqueIcons = new Map();
    initIconSubsetState(this);
  }
}

globalThis.window = {SF_BOOT_CONFIG: {}, sfPath: '/assets/simai-framework/ui/distr'};
installIconSubsetRuntime(TestLoader);

test('a page asks for grade -25..0 and optical size 20..48 by default', () => {
  assert.deepEqual([...ICON_AXIS_PAGE_RANGE.GRAD], [-25, 0]);
  assert.equal(iconAxisRequestRange('GRAD', ''), '-25..0');
  assert.equal(iconAxisRequestRange('opsz', ''), '20..48');
});

test('an author value widens the range, clamped to the font', () => {
  assert.equal(iconAxisRequestRange('GRAD', '200'), '-25..200');
  assert.equal(iconAxisRequestRange('GRAD', '-25,500'), '-25..200');
  assert.equal(iconAxisRequestRange('GRAD', new Set(['-50'])), '-25..0');
  assert.equal(iconAxisRequestRange('opsz', '10,40'), '20..48');
  assert.deepEqual(iconAxisNumbers('20..48'), [20, 48]);
  assert.deepEqual(iconAxisNumbers(['-25', 'x', '0']), [-25, 0]);
});

async function requestUrl(requestConfig) {
  const asked = [];
  const saved = {
    fetch: globalThis.fetch,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent,
    Node: globalThis.Node,
    warn: globalThis.console.warn,
  };
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return {ok: false, status: 503};
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  };
  globalThis.Node = {ELEMENT_NODE: 1};
  globalThis.document = {
    body: {classList: {add() {}, contains() { return false; }, remove() {}}, nodeType: 1, querySelectorAll() { return []; }},
    createElement() {
      return {attributes: new Map(), remove() {}, setAttribute(name, value) { this.attributes.set(name, value); }, textContent: ''};
    },
    head: {appendChild() {}},
    querySelector() { return null; },
  };
  globalThis.window.dispatchEvent = () => true;
  globalThis.console.warn = () => {};
  try {
    const loader = new TestLoader();
    loader.uniqueIcons.set('menu', new Map([['loading', false]]));
    await loader.loadIconSubsetFamily({
      accumulate: false,
      defaultType: 'outlined',
      fill: false,
      icons: ['menu'],
      weights: new Set(['400']),
      ...requestConfig,
    });
  } finally {
    globalThis.fetch = saved.fetch;
    globalThis.document = saved.document;
    globalThis.CustomEvent = saved.CustomEvent;
    globalThis.Node = saved.Node;
    globalThis.console.warn = saved.warn;
  }
  assert.equal(asked.length, 1);
  return new URL(asked[0]).searchParams;
}

test('the request carries grad and opsz ranges, never grade or optical_size', async () => {
  const query = await requestUrl({grade: '', opticalSize: ''});
  assert.equal(query.get('grad'), '-25..0');
  assert.equal(query.get('opsz'), '20..48');
  assert.equal(query.has('grade'), false);
  assert.equal(query.has('optical_size'), false);
});

test('one icon with grade 200 widens the request, the page range stays in it', async () => {
  const query = await requestUrl({grade: '200', opticalSize: '40'});
  assert.equal(query.get('grad'), '-25..200');
  assert.equal(query.get('opsz'), '20..48');
});

test('a manifest range covers each value, list and range inside it', () => {
  const loader = new TestLoader();
  loader.setIconManifestForType('outlined', {
    family: 'outlined',
    icons: ['home'],
    axes: {
      wght: {mode: 'fixed', value: 400},
      GRAD: {mode: 'range', min: -25, max: 200, raw: '-25..200'},
      opsz: {mode: 'range', min: 20, max: 48, raw: '20..48'},
    },
  });
  const covered = (attrs) => loader.isIconCoveredByManifest('home', {type: 'outlined', weight: '400', ...attrs});
  assert.equal(covered({grade: '-25'}), true);
  assert.equal(covered({grade: '200'}), true);
  // Clamped to the font: grade 500 draws as 200, which the range holds.
  assert.equal(covered({grade: '500'}), true);
  assert.equal(covered({'optical-size': '20..48'}), true);
  assert.equal(covered({'optical-size': '10'}), true);
  assert.equal(loader.manifestAxisIncludesValue(loader.getIconManifestForType('outlined'), 'GRAD', '-25,0'), true);

  loader.setIconManifestForType('outlined', {
    family: 'outlined',
    icons: ['home'],
    axes: {GRAD: {mode: 'range', min: -25, max: 0, raw: '-25..0'}, opsz: {mode: 'fixed', value: 24}},
  });
  assert.equal(covered({grade: '200'}), false);
  assert.equal(covered({grade: '-25..0'}), true);
  assert.equal(covered({'optical-size': '20'}), false);
});
