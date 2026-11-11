// R076: a theme cycle under a host that owns the theme. A Docara page and its
// default example frames start the Loader with `theme: false`: the Loader
// keeps `theme` at 'light' and setTheme answers false. The cycle must name the
// theme the document draws, and a press that cannot move the theme must say
// why once instead of doing nothing in silence.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loaderOwnsTheme, pressCycle, visibleTheme, warnThemeNotOwned} from '../src/smart/helpers/cycle.js';

function setup({loader, rootClass = '', dark = false}) {
  const saved = {SF: globalThis.SF, document: globalThis.document, matchMedia: globalThis.matchMedia, warn: console.warn};
  const warnings = [];
  globalThis.SF = loader === undefined ? undefined : {Loader: loader};
  globalThis.document = {documentElement: {classList: {contains: (name) => rootClass.split(' ').includes(name)}}};
  globalThis.matchMedia = () => ({matches: dark});
  console.warn = (text) => warnings.push(String(text));
  return {warnings, restore() { Object.assign(globalThis, {SF: saved.SF, document: saved.document, matchMedia: saved.matchMedia}); console.warn = saved.warn; }};
}

function host() {
  const events = [];
  return {events, localName: 'sf-button', hasAttribute: () => true, getAttribute: () => '', setAttribute() {}, requestComponentUpdate() {}, sfEmit: (name, detail) => events.push({name, detail})};
}

const state = {theme: true, items: [{value: 'system'}, {value: 'light'}, {value: 'dark'}], item: {value: 'system'}, next: {value: 'dark'}};

test('a host-owned theme: the cycle reads the theme the document draws, not the Loader default', () => {
  const env = setup({loader: {themeEnabled: false, theme: 'light', setTheme: () => false}, rootClass: 'theme-dark'});
  try {
    assert.equal(loaderOwnsTheme(), false);
    assert.equal(visibleTheme(), 'dark');
  } finally { env.restore(); }
});

test('a host-owned theme without a root class: the system scheme decides', () => {
  const env = setup({loader: {themeEnabled: false, theme: 'light'}, dark: true});
  try { assert.equal(visibleTheme(), 'dark'); } finally { env.restore(); }
});

test('a Loader that owns the theme still answers first', () => {
  const env = setup({loader: {themeEnabled: true, theme: 'light'}, rootClass: 'theme-dark'});
  try {
    assert.equal(loaderOwnsTheme(), true);
    assert.equal(visibleTheme(), 'light');
  } finally { env.restore(); }
});

test('a press under a host-owned theme stays put, sends no change and warns once', () => {
  const env = setup({loader: {themeEnabled: false, theme: 'light', setTheme: () => false}, rootClass: 'theme-dark'});
  try {
    const h = host();
    assert.equal(pressCycle(h, state), false);
    assert.equal(pressCycle(h, state), false);
    assert.deepEqual(h.events, []);
    assert.equal(env.warnings.length, 1);
    assert.match(env.warnings[0], /sf-button theme-cycle: the press changes nothing: .*theme: false.*theme_switch=true/);
    assert.equal(h.__sfCycleAnnounce, false);
    assert.equal(h.__sfCycleExpect, undefined);
  } finally { env.restore(); }
});

test('a press without a Loader names the missing Loader', () => {
  const env = setup({loader: undefined});
  try {
    const h = host();
    assert.equal(pressCycle(h, state), false);
    assert.equal(env.warnings.length, 1);
    assert.match(env.warnings[0], /SF\.Loader is absent/);
  } finally { env.restore(); }
});

test('a press the Loader accepts moves, sends change and warns nothing', () => {
  const env = setup({loader: {themeEnabled: true, theme: 'light', setTheme: () => true}});
  try {
    const h = host();
    assert.equal(pressCycle(h, state), true);
    assert.equal(h.events.length, 1);
    assert.deepEqual(h.events[0].detail.value, 'dark');
    assert.equal(env.warnings.length, 0);
    warnThemeNotOwned(h);
    assert.equal(env.warnings.length, 1);
  } finally { env.restore(); }
});
