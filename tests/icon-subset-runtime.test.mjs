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
