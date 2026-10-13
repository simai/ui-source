import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/component/country-code/js/_country_code.js', import.meta.url), 'utf8');
const smart = await readFile(new URL('../src/smart/country-code/index.js', import.meta.url), 'utf8');
const template = await readFile(new URL('../src/smart/country-code/js/templates/default.js', import.meta.url), 'utf8');
function runtime() {
  const requests = [], destroyed = [];
  const context = vm.createContext({window: {SF: {Mask: {
    create: () => new Promise(resolve => requests.push(resolve)),
    destroy: instance => destroyed.push(instance),
  }}}, buildPlaceholderFromMask: () => '', syncCountryRequired: () => {}, console,
    // The field asks component/mask-service for SF.Mask, which waits for a Core
    // that runs after it; here Core is already there.
    maskService: async () => context.window.SF.Mask});
  vm.runInContext(source.slice(source.indexOf('async function applyMaskForRoot'), source.indexOf('function resolveInitialCountry')), context);
  const root = {dataset: {}}, input = {value: ''};
  const apply = pattern => context.applyMaskForRoot(root, input, pattern, {showMaskPlaceholder: false});
  return {root, requests, destroyed, apply};
}

test('CountryCode late mask request cannot reclaim a rebound root', async () => {
  const {root, requests, destroyed, apply} = runtime();
  const tick = () => new Promise(setImmediate);
  const older = apply('000'); await tick(); delete root.__sfCountryMaskToken;
  const newer = apply('0000'), oldInstance = {}, newInstance = {}; await tick();
  requests[1](newInstance); await newer;
  requests[0](oldInstance); await older;
  assert.equal(root.__sfCountryMask, newInstance);
  assert.deepEqual(destroyed, [oldInstance]);
});

test('CountryCode mask removal invalidates an unresolved request', async () => {
  const {root, requests, destroyed, apply} = runtime();
  const pending = apply('000'); await new Promise(setImmediate); await apply('');
  const instance = {}; requests[0](instance); await pending;
  assert.equal(root.__sfCountryMask, undefined);
  assert.deepEqual(destroyed, [instance]);
});

test('CountryCode visible root consumes shared styling and preserves runtime state on cosmetic updates', () => {
  assert.match(template, /rootClasses.push\(context.rootClass\)/);
  assert.match(template, /style=\$\{context.rootStyle \|\| nothing\}/);
  assert.match(smart, /typeof callback === 'function'\) return super.afterRender\(callback\)/);
  assert.match(smart, /_renderAttributes.has\('open'\)/);
  assert.match(smart, /_renderAttributes.has\('disabled'\)/);
});
