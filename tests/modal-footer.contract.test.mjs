import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// Owner decision C159 (4), every window: the footer starts at the start -- the
// main answer first, «Отмена» last, data-apart at the far end; halves on a
// phone; a ladder gap (8, compact 4). The rule is core's, shared with
// sf-drawer; the defaults sit under the utilities, so footer-class still wins
// (simai/ui-source#26).
test('sf-modal footer: the shared window footer, a ladder gap, under the utilities', async () => {
  const [styles, mixin, smart, component] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/core/scss/mix/_mix__window-footer.scss'),
    read('src/smart/modal/js/templates/default.js'),
    read('src/component/modal/js/_modal.js'),
  ]);
  assert.match(styles, /@layer sf\.base \{[^}]*@include window-footer\.window-footer\('\.sf-modal-footer', var\(--sf-modal-footer-gap, var\(--sf-space-1\\\/3\)\)\)/);
  assert.match(mixin, /justify-content: flex-start;/);
  assert.match(mixin, /\[data-apart\][^{]*\{\s*margin-inline-start: auto;/);
  assert.match(mixin, /flex: 1 1 0;/);
  // A gap utility in the template would sit above sf.base and beat the default.
  for (const source of [smart, component]) {
    assert.match(source, /'sf-modal-footer flex flex-wrap',/);
    assert.doesNotMatch(source, /sf-modal-footer[^']*gap-/);
  }
});
