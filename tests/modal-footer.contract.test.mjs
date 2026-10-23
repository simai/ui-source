import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// The footer's actions stand at the end with a step of the ladder between them
// (simai/ui-source#26, ui-mail P-12); the defaults sit under the utilities, so
// footer-class still wins.
test('sf-modal footer: actions at the end, a ladder gap, under the utilities', async () => {
  const [styles, smart, component] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/smart/modal/js/templates/default.js'),
    read('src/component/modal/js/_modal.js'),
  ]);
  assert.match(styles, /@layer sf\.base \{\s*\.sf-modal-footer \{\s*align-items: center;\s*justify-content: flex-end;\s*gap: var\(--sf-modal-footer-gap, var\(--sf-space-1\\\/2\)\);/);
  // A gap utility in the template would sit above sf.base and beat the default.
  for (const source of [smart, component]) {
    assert.match(source, /'sf-modal-footer flex flex-wrap',/);
    assert.doesNotMatch(source, /sf-modal-footer[^']*gap-/);
  }
});
