// AM-21 (admin menu audit, 2026-11-18): on a cold load a real glyph was
// judged missing before its face was in, the face came while the font's name
// list was still on its way, and nothing read the glyph again -- its box
// stayed empty for good. The check is run here on a stand-in page: the glyph
// draws as letters, is marked missing, the face comes in silently, and the
// glyph must leave the missing state once the list says the name is real.
import assert from 'node:assert/strict';
import test from 'node:test';

function standIn() {
  const listeners = new Map();
  const on = (target) => (type, fn) => listeners.set(`${target}:${type}`, [...(listeners.get(`${target}:${type}`) || []), fn]);
  const state = {letters: true, attributes: new Map()};
  const glyph = {
    isConnected: true,
    textContent: 'search',
    hasAttribute: (name) => state.attributes.has(name),
    getAttribute: (name) => (state.attributes.has(name) ? state.attributes.get(name) : null),
    setAttribute: (name, value) => state.attributes.set(name, value),
    removeAttribute: (name) => state.attributes.delete(name),
    getBoundingClientRect: () => ({width: 20, height: 20}),
  };
  const doc = {
    documentElement: {},
    createRange: () => ({selectNodeContents() {}, getBoundingClientRect: () => ({width: state.letters ? 96 : 20})}),
    defaultView: {getComputedStyle: () => ({fontSize: '20px', fontStyle: 'normal', fontWeight: '400', fontFamily: 'Material Symbols Outlined Subset'})},
    fonts: {check: () => true, load: async () => [], ready: Promise.resolve(), addEventListener: on('fonts')},
    querySelectorAll: (selector) => (selector.includes('data-sf-icon-missing') && state.attributes.has('data-sf-icon-missing') ? [glyph] : []),
  };
  glyph.ownerDocument = doc;
  return {glyph, doc, state, listeners};
}

test('a real name judged before its face came is read again once the name list answers', async () => {
  const {glyph, doc, state} = standIn();
  let answer;
  const listed = new Promise((settle) => { answer = settle; });
  const saved = {document: globalThis.document, fetch: globalThis.fetch, raf: globalThis.requestAnimationFrame, warn: console.warn, sfPath: globalThis.sfPath};
  const warned = [];
  globalThis.document = doc;
  globalThis.sfPath = '/distr/';
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.fetch = () => listed;
  console.warn = (text) => warned.push(text);
  try {
    const {checkIconGlyph} = await import(`../src/core/js/icon-glyphs.js?am21=${Date.now()}`);
    checkIconGlyph(glyph);
    await new Promise((settle) => setTimeout(settle, 5));
    assert.ok(glyph.hasAttribute('data-sf-icon-missing'), 'drawn as letters, the glyph is marked missing');
    // The face comes in while the list is on its way, with no event after it.
    state.letters = false;
    answer({ok: true, json: async () => ({names: ['home', 'search', 'settings']})});
    await new Promise((settle) => setTimeout(settle, 20));
    assert.equal(glyph.hasAttribute('data-sf-icon-missing'), false, 'read again, the glyph draws');
    assert.deepEqual(warned, [], 'a real name is never said missing');
  } finally {
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.sfPath = saved.sfPath;
    console.warn = saved.warn;
  }
});
