import assert from 'node:assert/strict';
import test from 'node:test';

// The runtime's own names live under SF.__internal; the old names read and
// write through to it, a read noted as deprecated (journal global-sf-internal).
test('the old names are accessors onto SF.__internal, a read noted, a prior value kept', async () => {
  const root = {SF: {send: 'page-put-this-first'}};
  globalThis.document = undefined;
  const {installInternal, INTERNAL_NAMES} = await import('../src/core/js/internal.js');
  const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
  const store = installInternal(root);
  assert.equal(store, root.SF.__internal);
  assert.equal(store.send, 'page-put-this-first', 'a value already there is kept');
  root.SF.loadRuntime = () => 'loaded';
  assert.equal(typeof store.loadRuntime, 'function', 'a write through the old name lands in SF.__internal');
  clearDeprecations();
  root.SF.__internal.litHtml = 'x';
  assert.equal(root.SF.litHtml, 'x');
  assert.ok(listDeprecations().some((note) => note.from === 'SF.litHtml' && note.to === 'SF.__internal.litHtml'));
  for (const name of INTERNAL_NAMES) assert.ok(!Object.keys(root.SF).includes(name), `${name} is not enumerable`);
  assert.equal(installInternal(root), store, 'a second bundle finds the store in place');
});
