import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// SF.whenDefined('acme-counter') before the package's rules had loaded read the
// short name as a Framework one and waited forever for sf-acme-counter.

const source = readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = source.slice(source.indexOf('function normalizeSmartTagName'), source.indexOf('function toAttributeName'));

function runtime(rules = {}) {
  const waiting = new Map();
  const define = (tag) => { waiting.get(tag)?.forEach((resolve) => resolve()); };
  const context = vm.createContext({
    globalThis: {SF: {Loader: {getCustomElementRules: () => rules}}},
    window: {customElements: {whenDefined: (tag) => new Promise((resolve) => {
      if (!/-/.test(tag)) throw new SyntaxError(tag);
      waiting.set(tag, [...(waiting.get(tag) || []), resolve]);
    })}},
    Promise,
  });
  vm.runInContext(slice, context);
  return {whenDefined: context.whenSmartDefined, define};
}

test('a package element named short resolves once it is defined, before its rules load', async () => {
  const {whenDefined, define} = runtime();
  const done = whenDefined('acme-counter');
  define('acme-counter');
  assert.deepEqual(await done, ['acme-counter']);
});

test('a short Framework name still resolves to its sf- element', async () => {
  const {whenDefined, define} = runtime();
  const done = whenDefined(['data-view', 'button']);
  define('sf-data-view');
  define('sf-button');
  assert.deepEqual(await done, ['sf-data-view', 'sf-button']);
});

test('a name the package rules know is waited for as written', async () => {
  const {whenDefined, define} = runtime({'acme-counter': {}});
  const done = whenDefined('acme-counter');
  define('acme-counter');
  assert.deepEqual(await done, ['acme-counter']);
});
