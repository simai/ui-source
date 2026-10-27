import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Which language an element speaks (standard simai.smart-component 1.3.8
// §11.1, owner decision 2026-10-26; simai/ui-source#45): a section's [lang]
// wins over SF.language.use(), and a [lang] changed at runtime redraws the
// elements under it, with one observer for the page. The browser half is
// tests/browser/switch-manifest.browser.mjs (a lang="en" section in a ru page).

const {pageLanguage, pageLocale, followLanguage, language} = await import('../src/core/js/page-language.js');

// A document just big enough: nodes with a parent, [lang], closest('[lang]').
function node(lang, parent = null) {
  const one = {
    parentNode: parent,
    attrs: lang ? {lang} : {},
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    closest(selector) {
      assert.equal(selector, '[lang]');
      for (let current = this; current; current = current.parentNode) if (current.attrs.lang) return current;
      return null;
    },
    getRootNode() { return null; },
  };
  return one;
}

function withDocument(html, run) {
  const observers = [];
  const previous = {document: globalThis.document, MutationObserver: globalThis.MutationObserver, watch: globalThis.__sfLanguageWatch};
  class FakeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
  }
  Object.defineProperty(html, 'lang', {get() { return this.attrs.lang ?? ''; }, configurable: true});
  globalThis.document = {documentElement: html};
  html.ownerDocument = globalThis.document;
  globalThis.MutationObserver = FakeObserver;
  delete globalThis.__sfLanguageWatch;
  try {
    return run(observers);
  } finally {
    language.forget();
    language.use(null);
    globalThis.document = previous.document;
    globalThis.MutationObserver = previous.MutationObserver;
    globalThis.__sfLanguageWatch = previous.watch;
  }
}

test('a section [lang] wins over the page choice; the choice wins over <html lang> (§11.1)', () => {
  const html = node('ru');
  withDocument(html, () => {
    const section = node('en', html);
    const inSection = node('', section);
    const onPage = node('', html);
    assert.equal(pageLanguage(inSection), 'en');
    assert.equal(pageLanguage(onPage), 'ru');
    language.use('de');
    assert.equal(pageLanguage(inSection), 'en', 'the nearest [lang] below <html> wins');
    assert.equal(pageLanguage(onPage), 'de', 'the choice wins over <html lang>');
    assert.equal(html.getAttribute('lang'), 'de', 'use() also sets <html lang>');
    language.use('en');
    language.use(null);
    assert.equal(html.getAttribute('lang'), 'ru', 'use(null) gives the markup its own language back');
    language.use('de');
    section.attrs.lang = 'pt-BR';
    assert.equal(pageLanguage(inSection), 'pt');
    assert.equal(pageLocale(inSection), 'pt-br');
  });
});

test('one observer follows [lang] and redraws the elements under a changed one', () => {
  const html = node('ru');
  withDocument(html, (observers) => {
    const section = node('ru', html);
    const inside = node('', section);
    const outside = node('', html);
    inside.ownerDocument = outside.ownerDocument = globalThis.document;
    const redrawn = [];
    const stopInside = followLanguage(inside, () => redrawn.push('inside'));
    followLanguage(outside, () => redrawn.push('outside'));
    assert.equal(observers.length, 1, 'one observer for the page');
    assert.equal(observers[0].target, html);
    assert.deepEqual(observers[0].options, {attributes: true, attributeFilter: ['lang'], subtree: true});
    section.attrs.lang = 'en';
    observers[0].callback([{target: section, attributeName: 'lang'}]);
    assert.deepEqual(redrawn, ['inside']);
    redrawn.length = 0;
    observers[0].callback([{target: html, attributeName: 'lang'}]);
    assert.deepEqual(redrawn.sort(), ['inside', 'outside']);
    stopInside();
    redrawn.length = 0;
    observers[0].callback([{target: section, attributeName: 'lang'}]);
    assert.deepEqual(redrawn, [], 'a removed element is not followed');
  });
});

test('the Smart base follows [lang] for every element and lets go on removal', () => {
  const base = readFileSync(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
  assert.match(base, /this\.__sfLanguageUnwatch = followLanguage\(this, \(\) => \{\s*if \(this\._isMounted\) this\.requestComponentUpdate\("language"\);/);
  assert.match(base, /this\.__sfLanguageUnwatch\?\.\(\);/);
});
