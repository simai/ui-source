// The page's language state lives on one shared global, never in module scope.
//
// Core, each Smart component, each composite -- and a component package such
// as larena, delivered by its owner -- are separate bundles,
// and each carries its own copy of src/core/js/page-language.js. With the
// registry in module scope the page had as many registries as bundles:
// `SF.language` was published from core's copy, the table read its own, and a
// registered language changed nothing on screen (2026-10-11,
// tests/browser/language-can-be-added.browser.mjs). A package bundle must share
// the one registry base components use, so this holds the shape in place.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const path = new URL('../src/core/js/page-language.js', import.meta.url);
const source = await readFile(path, 'utf8');
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

// Statements at the top level of the module, braces counted, so what sits
// inside a function body or the STORE initializer is not mistaken for module
// scope.
const topLevel = (() => {
  const lines = [];
  let depth = 0;
  for (const line of code.split('\n')) {
    if (depth === 0) lines.push(line);
    for (const char of line) {
      if (char === '{' || char === '(' || char === '[') depth += 1;
      if (char === '}' || char === ')' || char === ']') depth -= 1;
    }
  }
  return lines.join('\n');
})();

test('page language: the state is created once on globalThis under the shared key', () => {
  assert.match(code, /const STORE = \(\(\) => \{/);
  assert.match(code, /const root = typeof globalThis !== 'undefined' \? globalThis : \{\};/);
  assert.match(code, /const key = '__sfPageLanguage';/);
  assert.match(code, /if \(!root\[key\]\) \{\s*root\[key\] = \{ listeners: new Set\(\), registered: new Map\(\), chosen: null \};/);
  assert.match(code, /return root\[key\];/);
  assert.match(code, /const LISTENERS = STORE\.listeners;/);
  assert.match(code, /const REGISTERED = STORE\.registered;/);
});

test('page language: no module-level Map, Set or variable holds words, listeners or the choice', () => {
  // Collections are made inside the STORE initializer, or per call inside a
  // function and kept on the store -- never at the top of the module.
  assert.doesNotMatch(topLevel, /new (?:Map|Set|WeakMap|WeakSet)\(/, 'a collection in module scope');
  assert.doesNotMatch(topLevel, /^\s*(?:let|var)\s/m, 'mutable module-level state');
  for (const [, name, value] of topLevel.matchAll(/^\s*(?:export\s+)?const\s+(\w+)\s*=\s*([^\n;]*)/gm)) {
    if (name === 'STORE' || name === 'language') continue;
    assert.doesNotMatch(value, /^(?:new\s|\[|\{\s*$)/, `${name} is module-level state`);
  }
  // The chosen language is read and written on the store, nowhere else.
  assert.doesNotMatch(code, /(?<!STORE\.)\bchosen\s*=(?!=)/);
  assert.match(code, /STORE\.chosen = next;/);
});

test('page language: two copies of the module share one registry, listeners and choice', async () => {
  delete globalThis.__sfPageLanguage;
  const one = await import(`${path.href}?copy=one`);
  const two = await import(`${path.href}?copy=two`);
  assert.notEqual(one.language, two.language, 'the test needs two module instances');
  try {
    let heard = 0;
    const stop = two.language.onChange(() => { heard += 1; });
    one.language.register('sf-package-widget', 'tr', {title: 'Başlık'});
    assert.equal(two.pageText({en: {title: 'Title'}}, 'title', null, 'sf-package-widget'), 'Title',
      'English page: the registered Turkish word is not chosen yet');
    one.language.use('tr');
    assert.equal(two.pageText({en: {title: 'Title'}}, 'title', null, 'sf-package-widget'), 'Başlık');
    assert.equal(two.language.current(null), 'tr');
    assert.equal(heard, 2, 'a listener added through one copy hears changes made through the other');
    assert.deepEqual(two.language.known('sf-package-widget'), ['tr']);
    stop();
  } finally {
    one.language.forget();
  }
});

test('page language: a chosen language with a region is the language, and the locale keeps the region', async () => {
  delete globalThis.__sfPageLanguage;
  const module = await import(`${path.href}?copy=region`);
  try {
    module.language.use('pt-BR');
    assert.equal(module.pageLanguage(null), 'pt', 'the language, as for lang="pt-BR" in markup');
    assert.equal(module.pageLocale(null), 'pt-br', 'formatting keeps the region');
    module.language.use('ru-RU');
    assert.equal(module.isRussianPage(null), true);
  } finally {
    module.language.forget();
    module.language.use(null);
  }
});

