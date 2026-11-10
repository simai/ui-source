import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initIconSubsetState,
  installIconSubsetRuntime,
  normalizeIconFontLoadWeight,
} from '../src/core/js/iconSubsetRuntime.js';

class TestLoader {
  constructor() {
    this.uniqueIcons = new Map();
    initIconSubsetState(this);
  }
}

globalThis.window = {
  SF_BOOT_CONFIG: {},
  sfPath: '/assets/simai-framework/ui/distr',
};
installIconSubsetRuntime(TestLoader);

test('variable icon font ranges use one cross-browser load weight', () => {
  assert.equal(normalizeIconFontLoadWeight('100 700'), '400');
  assert.equal(normalizeIconFontLoadWeight('500 900'), '500');
  assert.equal(normalizeIconFontLoadWeight('300 100'), '300');
});

test('fixed and named icon font weights remain unchanged', () => {
  assert.equal(normalizeIconFontLoadWeight('700'), '700');
  assert.equal(normalizeIconFontLoadWeight('bold'), 'bold');
  assert.equal(normalizeIconFontLoadWeight(''), '400');
});

test('fallback fonts are exact local Framework assets and never @latest', () => {
  const loader = new TestLoader();

  assert.equal(
    loader.getIconFallbackFontUrl('outlined'),
    '/assets/simai-framework/ui/distr/component/icons/fonts/MaterialSymbols-Outlined.woff2',
  );
  assert.equal(
    loader.getIconFallbackFontUrl('rounded'),
    '/assets/simai-framework/ui/distr/component/icons/fonts/MaterialIconsRound-Regular.otf',
  );
  assert.equal(
    loader.getIconFallbackFontUrl('sharp'),
    '/assets/simai-framework/ui/distr/component/icons/fonts/MaterialIconsSharp-Regular.otf',
  );
  assert.doesNotMatch(loader.buildIconFallbackCss(), /@latest|https?:\/\//);
});

test('dynamic icon requests are separated by family and stay cumulative', () => {
  const loader = new TestLoader();
  loader.uniqueIcons.set(
    'home',
    new Map([
      ['loading', false],
      ['type', new Set(['outlined'])],
      ['weight', new Set(['400'])],
    ]),
  );
  loader.uniqueIcons.set(
    'menu',
    new Map([
      ['loading', false],
      ['type', new Set(['rounded'])],
      ['filled', new Set(['1'])],
    ]),
  );
  loader.uniqueIcons.set(
    'search',
    new Map([
      ['loading', true],
      ['type', new Set(['outlined'])],
    ]),
  );

  const configs = loader.getIconSubsetRequestConfigs();
  assert.deepEqual(
    configs.map(({defaultType, icons}) => ({defaultType, icons})),
    [
      {defaultType: 'outlined', icons: ['home', 'search']},
      {defaultType: 'rounded', icons: ['menu']},
    ],
  );
  assert.equal(configs[1].fill, true);
});

test('Smart icon tracking preserves family, grade and optical size', () => {
  const loader = new TestLoader();
  const originalNode = globalThis.Node;
  globalThis.Node = {ELEMENT_NODE: 1};
  const attributes = new Map([
    ['icon', 'favorite'],
    ['type', 'rounded'],
    ['weight', '500'],
    ['grade', '-25'],
    ['optical-size', '40'],
    ['filled', ''],
  ]);
  const icon = {
    nodeType: 1,
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
  };

  try {
    assert.deepEqual(loader.getTrackedIconAttrs(icon), {
      icon: 'favorite',
      attrs: {
        weight: '500',
        grade: '-25',
        'optical-size': '40',
        type: 'rounded',
        filled: '1',
      },
    });
  } finally {
    globalThis.Node = originalNode;
  }
});

test('loaded state requires every requested icon axis', () => {
  const loader = new TestLoader();
  loader.setIconManifestForType('outlined', {
    family: 'outlined',
    icons: ['home'],
    axes: {
      wght: {values: [400]},
      FILL: {values: [0, 1]},
      GRAD: {values: [-25, 0]},
      opsz: {values: [24, 40]},
    },
  });

  assert.equal(loader.isIconCoveredByManifest('home', {
    type: 'outlined',
    weight: '400',
    grade: '-25',
    'optical-size': '40',
  }), true);
  assert.equal(loader.isIconCoveredByManifest('home', {
    type: 'outlined',
    weight: '400',
    grade: '200',
    'optical-size': '40',
  }), false);
  assert.equal(loader.isIconCoveredByManifest('home', {
    type: 'outlined',
    weight: '400',
    grade: '-25',
    'optical-size': '48',
  }), false);
});

test('same glyph keeps distinct descriptor combinations', () => {
  const loader = new TestLoader();

  assert.equal(loader.trackIconDescriptor('favorite', {
    type: 'outlined',
  }), 1);
  assert.equal(loader.trackIconDescriptor('favorite', {
    type: 'rounded',
    weight: '500',
    filled: '1',
    grade: '-25',
    'optical-size': '40',
  }), 1);

  assert.deepEqual(
    [...loader.iconDescriptorStates.values()].map(descriptor => descriptor.attrs),
    [
      {weight: '400', type: 'outlined'},
      {
        weight: '500',
        filled: '1',
        grade: '-25',
        'optical-size': '40',
        type: 'rounded',
      },
    ],
  );
});

test('manifests are isolated by icon family', () => {
  const loader = new TestLoader();
  const outlined = {family: 'Material Symbols Outlined', icons: ['home']};
  const rounded = {family: 'Material Symbols Rounded', icons: ['menu']};

  loader.setIconManifestForType('outlined', outlined);
  loader.setIconManifestForType('rounded', rounded);

  assert.equal(loader.getIconManifestForType('outlined'), outlined);
  assert.equal(loader.getIconManifestForType('rounded'), rounded);
  assert.equal(loader.getIconManifestStorageKey('outlined'), 'SF_ICON_SUBSET_MANIFEST');
  assert.equal(loader.getIconManifestStorageKey('rounded'), 'SF_ICON_SUBSET_MANIFEST:rounded');
});

test('v1 generator manifests keep their exact content-addressed font family', () => {
  const loader = new TestLoader();
  const manifest = {
    schema: 'sf.icon_subset.v1',
    family: 'outlined',
    font_family: 'Material Symbols Outlined Subset ca434039712d',
    icons: ['menu'],
  };

  assert.equal(
    loader.getIconManifestFontFamily(manifest),
    'Material Symbols Outlined Subset ca434039712d',
  );
});

test('simultaneous discoveries coalesce and reload one cumulative packet', async () => {
  const loader = new TestLoader();
  let releaseFirst;
  const calls = [];
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  loader.syncStaticIconLoadedState = () => {};
  loader.loadIconSubsetFamily = async (config) => {
    calls.push([...config.icons]);
    if (calls.length === 1) await first;
    return true;
  };
  loader.uniqueIcons.set('menu', new Map([
    ['loading', false],
    ['type', new Set(['outlined'])],
  ]));

  const initial = loader.loadFonts();
  loader.uniqueIcons.set('search', new Map([
    ['loading', false],
    ['type', new Set(['outlined'])],
  ]));
  const concurrent = loader.loadFonts();
  releaseFirst();
  await Promise.all([initial, concurrent]);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

  assert.deepEqual(calls, [['menu'], ['menu', 'search']]);
});

test('dynamic ready event is emitted only after descriptor state becomes loaded', async () => {
  const loader = new TestLoader();
  const originalCustomEvent = globalThis.CustomEvent;
  const originalDispatchEvent = globalThis.window.dispatchEvent;
  const observations = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  };
  globalThis.window.dispatchEvent = (event) => {
    observations.push({
      type: event.type,
      icons: [...event.detail.icons],
      loaded: loader.isTrackedIconLoaded({icon: 'menu', attrs: {}}),
    });
    return true;
  };
  loader.syncStaticIconLoadedState = () => {};
  loader.loadIconSubsetFamily = async () => true;
  loader.uniqueIcons.set('menu', new Map([['loading', false]]));

  try {
    assert.equal(await loader.loadFonts(), true);
    assert.deepEqual(observations, [{
      type: 'sf-icons-subset:ready',
      icons: ['menu'],
      loaded: true,
    }]);
  } finally {
    globalThis.CustomEvent = originalCustomEvent;
    globalThis.window.dispatchEvent = originalDispatchEvent;
  }
});

test('initial Smart component discovery schedules both runtime and icon font', () => {
  const loader = new TestLoader();
  const scheduled = [];
  loader.mutate = callback => scheduled.push(callback);
  loader.getLoader = () => {};
  loader.loadFonts = () => {};

  const result = loader.handleCustomElementScanResult({
    keys: ['cl-icon'],
    count: 1,
    iconCount: 1,
  });

  assert.equal(result.count, 1);
  assert.equal(result.iconCount, 1);
  assert.equal(scheduled.length, 2);
});

test('service failure atomically falls back to the exact local family font once', async () => {
  const appended = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const originalCustomEvent = globalThis.CustomEvent;
  const originalNode = globalThis.Node;
  const originalWarn = globalThis.console.warn;
  const warnings = [];
  globalThis.fetch = async () => ({ok: false, status: 503});
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  };
  globalThis.Node = {ELEMENT_NODE: 1};
  globalThis.document = {
    body: {
      classList: {add() {}, contains() { return false; }, remove() {}},
      nodeType: 1,
      querySelectorAll() { return []; },
    },
    createElement() {
      return {
        attributes: new Map(),
        remove() {},
        setAttribute(name, value) { this.attributes.set(name, value); },
        textContent: '',
      };
    },
    head: {appendChild(node) { appended.push(node); }},
    querySelector() { return null; },
  };
  globalThis.window.dispatchEvent = () => true;
  globalThis.console.warn = (...args) => warnings.push(args);

  try {
    const loader = new TestLoader();
    loader.uniqueIcons.set('menu', new Map([['loading', false]]));
    const request = {
      accumulate: false,
      defaultType: 'outlined',
      fill: false,
      grade: '',
      icons: ['menu'],
      weights: new Set(['400']),
    };

    assert.equal(await loader.loadIconSubsetFamily(request), true);
    assert.equal(await loader.loadIconSubsetFamily(request), true);
    assert.equal(appended.length, 2);
    assert.match(appended[0].textContent, /MaterialSymbols-Outlined\.woff2/);
    assert.doesNotMatch(appended[0].textContent, /@latest|https?:\/\//);
    assert.equal(warnings.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    globalThis.CustomEvent = originalCustomEvent;
    globalThis.Node = originalNode;
    globalThis.console.warn = originalWarn;
  }
});

test('the first request waits for the page to become ready and carries every icon scanned by then', async () => {
  const loader = new TestLoader();
  loader.eventSend = false;
  const calls = [];
  const listeners = new Map();
  const original = {
    addEventListener: globalThis.window.addEventListener,
    removeEventListener: globalThis.window.removeEventListener,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  globalThis.window.addEventListener = (type, fn) => listeners.set(type, fn);
  globalThis.window.removeEventListener = (type) => listeners.delete(type);
  globalThis.requestAnimationFrame = (fn) => globalThis.setTimeout(fn, 0);
  loader.syncStaticIconLoadedState = () => {};
  loader.loadIconSubsetFamily = async (config) => {
    calls.push([...config.icons]);
    return true;
  };

  try {
    loader.uniqueIcons.set('menu', new Map([['loading', false], ['type', new Set(['outlined'])]]));
    const first = loader.loadFonts();
    loader.uniqueIcons.set('search', new Map([['loading', false], ['type', new Set(['outlined'])]]));
    const second = loader.loadFonts();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 5));
    assert.deepEqual(calls, [], 'nothing is asked for before ready');

    loader.eventSend = true;
    listeners.get('sf-loader-ready')();
    await Promise.all([first, second]);
    assert.deepEqual(calls, [['menu', 'search']]);
  } finally {
    globalThis.window.addEventListener = original.addEventListener;
    globalThis.window.removeEventListener = original.removeEventListener;
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
  }
});

// Pair 1110, probe tag-icon-glyph: a cold page under load sent the button's
// search alone at the 2.5 s budget while sf-tag's bundle was still on the way,
// and the tags' names went in a second request. The first request waits for
// the Smart tags the Loader asked for, after ready and past the budget.
const withHeldTags = async (run) => {
  const defined = new Map();
  const waiters = new Map();
  const asked = new Set();
  const listeners = new Map();
  const original = {
    addEventListener: globalThis.window.addEventListener,
    removeEventListener: globalThis.window.removeEventListener,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    customElements: globalThis.window.customElements,
    SF: globalThis.window.SF,
  };
  globalThis.window.addEventListener = (type, fn) => listeners.set(type, fn);
  globalThis.window.removeEventListener = (type) => listeners.delete(type);
  globalThis.requestAnimationFrame = (fn) => globalThis.setTimeout(fn, 0);
  globalThis.window.customElements = {
    get: (tag) => defined.get(tag),
    whenDefined: (tag) => new Promise((resolve) => waiters.set(tag, resolve)),
  };
  const internal = {pendingTags: {held: () => [...asked], asked: () => [...asked]}};
  globalThis.window.SF = {...(original.SF || {}), __internal: internal};
  const define = (tag) => {
    defined.set(tag, class {});
    asked.delete(tag);
    waiters.get(tag)?.();
  };
  try {
    await run({asked, define, listeners});
  } finally {
    globalThis.window.addEventListener = original.addEventListener;
    globalThis.window.removeEventListener = original.removeEventListener;
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    globalThis.window.customElements = original.customElements;
    globalThis.window.SF = original.SF;
  }
};
const iconState = () => new Map([['loading', false], ['type', new Set(['outlined'])]]);

test('the first request waits after ready for a Smart tag the Loader asked for and is still defining', async () => {
  await withHeldTags(async ({asked, define, listeners}) => {
    const loader = new TestLoader();
    loader.eventSend = false;
    const calls = [];
    loader.syncStaticIconLoadedState = () => {};
    loader.loadIconSubsetFamily = async (config) => { calls.push([...config.icons]); return true; };
    asked.add('sf-tag');
    loader.uniqueIcons.set('search', iconState());
    const first = loader.loadFonts();
    loader.eventSend = true;
    listeners.get('sf-loader-ready')();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    assert.deepEqual(calls, [], 'ready with sf-tag still on the way sends nothing');
    loader.uniqueIcons.set('label', iconState());
    define('sf-tag');
    await first;
    assert.deepEqual(calls, [['label', 'search']]);
  });
});

test('a page slow to become ready holds the first request past the budget while an asked Smart tag is on the way', async () => {
  await withHeldTags(async ({asked, define}) => {
    const loader = new TestLoader();
    loader.eventSend = false;
    const calls = [];
    loader.syncStaticIconLoadedState = () => {};
    loader.loadIconSubsetFamily = async (config) => { calls.push([...config.icons]); return true; };
    loader.holdFirstIconRequest = ((hold) => function () { return hold.call(this, 30, 400); })(loader.holdFirstIconRequest);
    asked.add('sf-tag');
    loader.uniqueIcons.set('search', iconState());
    const first = loader.loadFonts();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 120));
    assert.deepEqual(calls, [], 'past the budget, sf-tag on the way: still held');
    loader.uniqueIcons.set('sell', iconState());
    define('sf-tag');
    await first;
    assert.deepEqual(calls, [['search', 'sell']]);
  });
});

test('a page slow to become ready with nothing on the way sends the first request at the budget', async () => {
  await withHeldTags(async () => {
    const loader = new TestLoader();
    loader.eventSend = false;
    const calls = [];
    loader.syncStaticIconLoadedState = () => {};
    loader.loadIconSubsetFamily = async (config) => { calls.push([...config.icons]); return true; };
    loader.holdFirstIconRequest = ((hold) => function () { return hold.call(this, 30, 400); })(loader.holdFirstIconRequest);
    loader.uniqueIcons.set('search', iconState());
    const started = Date.now();
    await loader.loadFonts();
    assert.deepEqual(calls, [['search']]);
    assert.ok(Date.now() - started < 300, 'released at the budget, not the cap');
  });
});

test('icons the page declares in icons.preload go in the first request, tracked as scanned ones', async () => {
  const loader = new TestLoader();
  const calls = [];
  globalThis.window.SF_BOOT_CONFIG = {icons: {preload: ['article', {icon: 'library_books'}]}};
  loader.syncStaticIconLoadedState = () => {};
  loader.loadIconSubsetFamily = async (config) => {
    calls.push([...config.icons]);
    return true;
  };

  try {
    assert.equal(loader.trackIconDescriptor('menu', {weight: '400', type: 'outlined'}), 1);
    await loader.loadFonts();
    assert.deepEqual(calls, [['article', 'library_books', 'menu']]);

    // The data arrives: the scan finds the declared icons already asked for.
    assert.equal(loader.trackIconDescriptor('article', {weight: '400', type: 'outlined'}), 0);
    assert.equal(loader.trackIconDescriptor('library_books', {weight: '400', type: 'outlined'}), 0);
  } finally {
    globalThis.window.SF_BOOT_CONFIG = {};
  }
});

test('SF.Loader.preloadIcons adds icons a component knows it will draw', () => {
  const loader = new TestLoader();
  let flushed = 0;
  loader.flushPendingIconScan = () => { flushed += 1; };
  assert.equal(loader.preloadIcons('article, library_books'), 2);
  assert.equal(loader.preloadIcons(['article']), 0, 'an icon already tracked is not added twice');
  assert.equal(flushed, 1);
  assert.equal(loader.pendingIconScanCount, 2);
});

test('a static icon is filled only when something says so, not when --sf-icon--fill is unset', () => {
  const loader = new TestLoader();
  const originalNode = globalThis.Node;
  globalThis.Node = {ELEMENT_NODE: 1};
  const icon = ({classes = [], fill = ''} = {}) => {
    const classList = new Set(['sf-icon', ...classes]);
    return {
      nodeType: 1,
      textContent: 'home',
      classList: {contains: (name) => classList.has(name), [Symbol.iterator]: () => classList.values()},
      closest: () => null,
      getAttribute: () => null,
      hasAttribute: () => false,
      style: {getPropertyValue: (name) => (name === '--sf-icon--fill' ? fill : '')},
    };
  };

  try {
    assert.equal(loader.getTrackedStaticIconAttrs(icon()).attrs.filled, undefined);
    assert.equal(loader.getTrackedStaticIconAttrs(icon({fill: '0'})).attrs.filled, undefined);
    assert.equal(loader.getTrackedStaticIconAttrs(icon({fill: '1'})).attrs.filled, '1');
    assert.equal(loader.getTrackedStaticIconAttrs(icon({classes: ['sf-icon--filled']})).attrs.filled, '1');
  } finally {
    globalThis.Node = originalNode;
  }
});

// An app that serves its own icons, with no subset service to ask (consumer
// case ui-mail.icons-offline, 2026-10-21).
test('icons.enabled = false asks for no subset at all', async () => {
  const loader = new TestLoader();
  globalThis.window.SF_BOOT_CONFIG = {icons: {enabled: false}};

  try {
    assert.equal(loader.isIconSubsetEnabled(), false);
    assert.deepEqual(loader.getIconSubsetRequestConfig().icons, []);
    assert.equal(await loader.loadFonts(), false, 'nothing is requested');
    // The full font the icons stylesheet declares is the app's own file.
    assert.equal(
      loader.getIconFallbackFontUrl('outlined'),
      '/assets/simai-framework/ui/distr/component/icons/fonts/MaterialSymbols-Outlined.woff2',
    );
  } finally {
    globalThis.window.SF_BOOT_CONFIG = {};
  }
});

test('an app can serve the fallback fonts and the subset service itself', () => {
  const loader = new TestLoader();
  globalThis.window.SF_BOOT_CONFIG = {
    icons: {
      subsetHost: 'https://icons.example.com',
      fallbackFonts: {outlined: '/fw/fonts/symbols.woff2'},
      fallbackFontUrl: '/fw/fonts/any.woff2',
    },
  };

  try {
    assert.equal(loader.getIconSubsetHost(), 'https://icons.example.com');
    assert.equal(loader.getIconFallbackFontUrl('outlined'), '/fw/fonts/symbols.woff2');
    // A family without its own entry falls to the outlined one, then to the
    // single fallbackFontUrl, and only then to the distribution's path.
    assert.equal(loader.getIconFallbackFontUrl('sharp'), '/fw/fonts/symbols.woff2');
  } finally {
    globalThis.window.SF_BOOT_CONFIG = {};
  }
});

test('a build-time static subset asks for exactly the icons it names', () => {
  const loader = new TestLoader();
  globalThis.window.SF_BOOT_CONFIG = {
    icons: {staticSubset: {icons: ['home', 'upload_file'], weights: ['400']}},
  };

  try {
    assert.equal(loader.hasConfiguredIconSubset(), true);
    const request = loader.getIconSubsetRequestConfig();
    assert.deepEqual(request.icons, ['home', 'upload_file']);
    assert.deepEqual([...request.weights], ['400']);
    // Discovery adds nothing on top of the named list.
    assert.equal(loader.trackIconDescriptor('search'), 0);
  } finally {
    globalThis.window.SF_BOOT_CONFIG = {};
  }
});

test('the offline and self-hosted settings are documented', async () => {
  const {readFile} = await import('node:fs/promises');
  const {URL} = await import('node:url');
  const documentation = await readFile(
    new URL('../docs/developer/icon-subset-runtime.md', import.meta.url),
    'utf8',
  );

  assert.match(documentation, /## An app that serves its own icons/);
  for (const setting of ['icons.enabled = false', 'icons.subsetHost', 'icons.fallbackFonts', 'icons.staticSubset']) {
    assert.ok(documentation.includes(setting), `${setting} is documented`);
  }
  assert.match(documentation, /component\/icons\/fonts\/MaterialSymbols-Outlined\.woff2/);
});

test('a disclosure glyph brings the glyph it swaps to into the same request', () => {
  const loader = new TestLoader();
  const attrs = {weight: '400', type: 'outlined'};
  // ⌄ brings ⌃ (a row opening) and › (a column closing): three names, one request.
  assert.equal(loader.trackIconDescriptor('keyboard_arrow_down', attrs), 3);
  assert.ok(loader.uniqueIcons.has('keyboard_arrow_up'));
  assert.ok(loader.uniqueIcons.has('chevron_right'));
  assert.equal(loader.uniqueIcons.get('keyboard_arrow_up').get('weight').has('400'), true);
  // The swap itself then asks for nothing new.
  assert.equal(loader.trackIconDescriptor('keyboard_arrow_up', attrs), 0);
  assert.equal(loader.trackIconDescriptor('chevron_right', attrs), 0);
  assert.equal(loader.trackIconDescriptor('expand_more', attrs), 2);
  // A name with no partner tracks itself alone.
  assert.equal(loader.trackIconDescriptor('menu', attrs), 1);
});

// R074: a fake page for the subset request path -- styles in the head found
// by their data attributes, FontFace and document.fonts that load at once,
// frames on a timer, and a fetch the test answers when it chooses.
function subsetPage() {
  const saved = {
    fetch: globalThis.fetch,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent,
    Node: globalThis.Node,
    FontFace: globalThis.window.FontFace,
    raf: globalThis.requestAnimationFrame,
    warn: globalThis.console.warn,
    dispatch: globalThis.window.dispatchEvent,
  };
  const head = [];
  const events = [];
  const warnings = [];
  const requests = [];
  const element = () => ({
    attributes: new Map(),
    textContent: '',
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    hasAttribute(name) { return this.attributes.has(name); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    remove() { const at = head.indexOf(this); if (at >= 0) head.splice(at, 1); },
  });
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  };
  globalThis.Node = {ELEMENT_NODE: 1};
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 1);
  globalThis.window.FontFace = class FontFace {
    constructor(family) { this.family = family; }
    load() { return Promise.resolve(this); }
  };
  globalThis.document = {
    body: {classList: {add() {}, contains() { return false; }, remove() {}}, nodeType: 1, querySelectorAll() { return []; }},
    documentElement: {getAttribute() { return null; }, removeAttribute() {}},
    createElement: element,
    head: {appendChild(node) { node.remove(); head.push(node); }},
    querySelector(selector) {
      const match = /^style\[([\w-]+)="([^"]+)"\]$/.exec(selector);
      return match ? head.find((node) => node.getAttribute(match[1]) === match[2]) || null : null;
    },
    querySelectorAll() { return []; },
    fonts: {add() {}, delete() {}, load: async () => [{}]},
  };
  globalThis.window.dispatchEvent = (event) => { events.push(event); return true; };
  globalThis.console.warn = (...args) => warnings.push(args);
  globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => {
    const names = new URL(url, 'https://icons.test').searchParams.get('icon_names').split(',');
    requests.push({url, options, names, resolve, reject});
    options.signal?.addEventListener?.('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})));
  });
  const answer = (request) => request.resolve({
    ok: true,
    status: 200,
    headers: {get() { return null; }},
    text: async () => `@font-face { font-family: 'Material Symbols Outlined Subset'; src: url('https://icons.test/ms/font/${request.names.join('-')}.woff2') format('woff2'); font-weight: 400; }\n.sf-icon { font-family: 'Material Symbols Outlined Subset'; }`,
  });
  const restore = () => {
    globalThis.fetch = saved.fetch;
    globalThis.document = saved.document;
    globalThis.CustomEvent = saved.CustomEvent;
    globalThis.Node = saved.Node;
    globalThis.window.FontFace = saved.FontFace;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.console.warn = saved.warn;
    globalThis.window.dispatchEvent = saved.dispatch;
  };
  return {head, events, warnings, requests, answer, restore};
}

const outlinedRequest = (icons) => ({
  accumulate: false,
  defaultType: 'outlined',
  fill: false,
  grade: '',
  opticalSize: '',
  icons,
  weights: new Set(['400']),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('R074: a subset request is not asked to bypass the HTTP cache and carries an abort signal', async () => {
  const page = subsetPage();
  try {
    const loader = new TestLoader();
    loader.uniqueIcons.set('menu', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const done = loader.loadIconSubsetFamily(outlinedRequest(['menu']));
    await sleep(0);
    assert.equal(page.requests.length, 1);
    assert.equal(page.requests[0].options.cache, undefined);
    assert.ok(page.requests[0].options.signal);
    page.answer(page.requests[0]);
    assert.equal(await done, true);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0);
  } finally {
    page.restore();
  }
});

test('R074: a slow subset answer draws from the full font at the deadline, and the grown subset takes over when it holds every name', async () => {
  const page = subsetPage();
  try {
    const loader = new TestLoader();
    loader.iconSubsetDeadlineMs = 30;
    loader.syncStaticIconLoadedState = () => {};
    loader.uniqueIcons.set('grid_view', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const started = Date.now();
    assert.equal(await loader.loadIconSubsetFamily(outlinedRequest(['grid_view'])), true);
    assert.ok(Date.now() - started < 500, 'the deadline, not the answer, ends the wait');
    const fallback = page.head.find((node) => node.hasAttribute('data-sf-icons-fallback'));
    assert.ok(fallback, 'the full font draws the names');
    assert.match(fallback.getAttribute('data-sf-icons-fallback-url'), /MaterialSymbols-Outlined\.woff2/);
    assert.doesNotMatch(fallback.textContent, /@font-face/, 'the full face was loaded before the rule went in');
    assert.ok(loader.isTrackedIconLoaded({icon: 'grid_view', attrs: {}}), 'the icon is drawn, not held');
    assert.match(String(page.warnings[0]?.[1]?.reason?.message || ''), /timed out after 30 ms/);

    // A name that turns up while the full font draws: drawn at once, no
    // second fallback stylesheet, and the subset grows in the background.
    loader.uniqueIcons.set('view_list', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const second = Date.now();
    assert.equal(await loader.loadIconSubsetFamily(outlinedRequest(['grid_view', 'view_list'])), true);
    assert.ok(Date.now() - second < 25, 'no deadline wait once the full font draws');
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 1);
    assert.ok(loader.isTrackedIconLoaded({icon: 'view_list', attrs: {}}));

    // The first answer arrives without view_list: dropped, the full font stays.
    page.answer(page.requests[0]);
    await sleep(20);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-subset-family')).length, 0);
    assert.ok(page.head.find((node) => node.hasAttribute('data-sf-icons-fallback')));

    // The grown answer holds both: it takes over and the full font leaves.
    page.answer(page.requests[1]);
    await sleep(30);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-subset-family')).length, 1);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0);
    assert.ok(page.events.some((event) => event.type === 'sf-icons-subset:ready' && event.detail.background && event.detail.icons.has('view_list')));
  } finally {
    page.restore();
  }
});

test('R074 D-A: the full font is fetched before the deadline and its rule goes in only once the face is loaded', async () => {
  const page = subsetPage();
  try {
    const loads = [];
    globalThis.window.FontFace = class FontFace {
      constructor(family, src) { this.family = family; this.src = src; }
      load() { return new Promise((resolve) => loads.push({face: this, resolve: () => resolve(this)})); }
    };
    const added = [];
    globalThis.document.fonts.add = (face) => { added.push(face); };
    const loader = new TestLoader();
    loader.iconSubsetDeadlineMs = 40;
    loader.iconFallbackPrefetchMs = 10;
    loader.syncStaticIconLoadedState = () => {};
    loader.uniqueIcons.set('grid_view', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const done = loader.loadIconSubsetFamily(outlinedRequest(['grid_view']));
    await sleep(25);
    assert.equal(loads.length, 1, 'the full face is asked for at the prefetch point, before the deadline');
    assert.match(loads[0].face.src, /MaterialSymbols-Outlined\.woff2/);
    await sleep(40);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0,
      'past the deadline, the rule waits for the face: icons the subset draws stay drawn');
    loads[0].resolve();
    assert.equal(await done, true);
    assert.equal(added.length, 1, 'the loaded face joins document.fonts');
    const fallback = page.head.find((node) => node.hasAttribute('data-sf-icons-fallback'));
    assert.ok(fallback);
    assert.doesNotMatch(fallback.textContent, /@font-face/);
    assert.equal(loads.length, 1, 'one load of the full face');
  } finally {
    page.restore();
  }
});

test('R074 D-A: a request that answers while the full font is on its way keeps its subset and puts in no fallback', async () => {
  const page = subsetPage();
  try {
    const loads = [];
    globalThis.window.FontFace = class FontFace {
      constructor(family) { this.family = family; }
      load() { return new Promise((resolve) => loads.push(() => resolve(this))); }
    };
    const loader = new TestLoader();
    loader.iconSubsetDeadlineMs = 20;
    loader.iconFallbackPrefetchMs = 0;
    loader.syncStaticIconLoadedState = () => {};
    loader.uniqueIcons.set('grid_view', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const done = loader.loadIconSubsetFamily(outlinedRequest(['grid_view']));
    await sleep(40);
    page.answer(page.requests[0]);
    // The subset's own face (a FontFace too) and the full one are both pending.
    await sleep(10);
    loads.forEach((resolve) => resolve());
    await sleep(10);
    loads.forEach((resolve) => resolve());
    assert.equal(await done, true);
    await sleep(30);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0);
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-subset-family')).length, 1);
  } finally {
    page.restore();
  }
});

test('R074 R-1: a service that answers before the prefetch point fetches no full font, however long its own font takes', async () => {
  const page = subsetPage();
  try {
    const full = [];
    globalThis.window.FontFace = class FontFace {
      constructor(family, src) { this.family = family; if (/MaterialSymbols-Outlined/u.test(String(src))) full.push(src); }
      load() { return Promise.resolve(this); }
    };
    // The answer's own font arrives well after the prefetch point.
    globalThis.document.fonts.load = () => new Promise((resolve) => setTimeout(() => resolve([{}]), 80));
    const loader = new TestLoader();
    loader.iconSubsetDeadlineMs = 400;
    loader.iconFallbackPrefetchMs = 20;
    loader.syncStaticIconLoadedState = () => {};
    loader.uniqueIcons.set('menu', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    const done = loader.loadIconSubsetFamily(outlinedRequest(['menu']));
    await sleep(5);
    page.answer(page.requests[0]);
    assert.equal(await done, true);
    await sleep(30);
    assert.equal(full.length, 0, 'the full font is not fetched once the service has answered');
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0);
  } finally {
    page.restore();
  }
});

test('R074: a background request outrun by a newer answer is aborted and changes nothing', async () => {
  const page = subsetPage();
  try {
    const loader = new TestLoader();
    loader.iconSubsetDeadlineMs = 20;
    loader.syncStaticIconLoadedState = () => {};
    loader.uniqueIcons.set('menu', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    await loader.loadIconSubsetFamily(outlinedRequest(['menu']));
    loader.uniqueIcons.set('search', new Map([['loading', true], ['type', new Set(['outlined'])]]));
    await loader.loadIconSubsetFamily(outlinedRequest(['menu', 'search']));
    page.answer(page.requests[1]);
    await sleep(30);
    assert.equal(page.requests[0].options.signal.aborted, true);
    const subsets = page.head.filter((node) => node.hasAttribute('data-sf-icons-subset-family'));
    assert.equal(subsets.length, 1);
    assert.equal(subsets[0].getAttribute('data-sf-icons-subset'), 'menu,search');
    assert.equal(page.head.filter((node) => node.hasAttribute('data-sf-icons-fallback')).length, 0);
  } finally {
    page.restore();
  }
});

test('D2: a Smart tag whose module failed to load lets the first request go at once, not at the cap', async () => {
  const {installPendingTags} = await import('../src/core/js/pending-tags.js');
  await withHeldTags(async ({listeners}) => {
    const store = installPendingTags({customElements: globalThis.window.customElements});
    globalThis.window.SF.__internal.pendingTags = store;
    const loader = new TestLoader();
    loader.eventSend = false;
    const calls = [];
    loader.syncStaticIconLoadedState = () => {};
    loader.loadIconSubsetFamily = async (config) => { calls.push([...config.icons]); return true; };
    store.hold('sf-tag', {asked: true});
    loader.uniqueIcons.set('search', iconState());
    const started = Date.now();
    const first = loader.loadFonts();
    loader.eventSend = true;
    listeners.get('sf-loader-ready')();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
    assert.deepEqual(calls, [], 'sf-tag still on the way holds the request');
    assert.equal(store.fail('sf-tag'), true);
    await first;
    assert.deepEqual(calls, [['search']]);
    assert.ok(Date.now() - started < 1000, `the request went ${Date.now() - started} ms after the start, not at the 8 s cap`);
    assert.equal(store.hold('sf-tag', {asked: true}), false, 'a failed tag is not held again');
    assert.deepEqual(store.asked(), []);
  });
});
