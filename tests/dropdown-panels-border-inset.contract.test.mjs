// C105 H4 (owner decision): a dropping panel's 1 px border is inside its inline
// inset, so a row's icon or text stands 16 from the panel's outer edge (compact
// and phone 12), as sf-menu-context's and sf-settings' panels. The dropdown's
// list and the lookup's panel draw no border (a lift only), so their whole inset
// is padding; the profile picker's panel draws one and takes it off the inset.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is declared`);
  return css.slice(at, css.indexOf('\n}', at));
};

test('profile picker panel: the border is inside the inline inset, the block inset and the scrollbar keep the whole inset', () => {
  const body = rule(read('src/smart/profile-picker/scss/_smart__profile_picker.scss'), '.sf-profile-picker-panel');
  assert.match(body, /--sf-profile-picker-panel--inset-inline:\s*calc\(var\(--sf-profile-picker--inset\) - var\(--sf-px\)\);/);
  assert.match(body, /\n\s*padding:\s*var\(--sf-profile-picker--inset\) var\(--sf-profile-picker-panel--inset-inline\);/);
  assert.match(body, /border:\s*var\(--sf-px\) solid/);
  assert.match(body, /@include panel\.scrollbar\(var\(--sf-profile-picker--inset\),/);
});

test('dropdown list and lookup panel draw no border, so their inset needs no correction', () => {
  assert.match(rule(read('src/component/dropdown/scss/_css__list.scss'), '  .sf-dropdown .sf-list,\n  .sf-list--menu'), /--sf-list--border-width:\s*0;/);
  assert.match(rule(read('src/smart/input-lookup/scss/_smart__lookup.scss'), '.sf-lookup .sf-lookup-panel'), /\n\s*border:\s*0;/);
});
