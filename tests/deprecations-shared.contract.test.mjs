import assert from 'node:assert/strict';
import test from 'node:test';

// Every bundle carries its own copy of core/js/deprecations.js. Each copy kept
// a list of its own and SF.deprecations.list() answered with the copy that
// loaded last, so a page printing legacy warnings from one bundle listed none.
// Two imports under different URLs are two module instances, as two bundles are.

test('two copies of the module note into one list, and either lists it all', async () => {
  const url = new URL('../src/core/js/deprecations.js', import.meta.url);
  const first = await import(`${url}?bundle=buttons`);
  const second = await import(`${url}?bundle=datepicker`);
  assert.notEqual(first.noteDeprecated, second.noteDeprecated, 'two instances, as two bundles');
  first.clearDeprecations();
  first.noteDeprecated({component: 'sf-button', attribute: 'type', from: 'type', to: 'appearance'});
  second.noteDeprecated({component: 'sf-datepicker', attribute: 'type', from: 'type', to: 'appearance'});
  second.noteDeprecated({component: 'sf-button', attribute: 'type', from: 'type', to: 'appearance'});
  const listed = globalThis.SF.deprecations.list();
  assert.equal(listed.length, 2);
  assert.equal(listed.find((note) => note.component === 'sf-button').count, 2);
  assert.deepEqual(first.listDeprecations(), second.listDeprecations());
  second.clearDeprecations();
  assert.deepEqual(first.listDeprecations(), []);
});
