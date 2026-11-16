// Register plain-b defects (ui-control control/standards/register/plain-b.json):
// RG-B-1 link icon gap, RG-B-11 pagination list gap, RG-B-50 one ring on a
// reference card, RG-B-47 the class tree's toggle is the chevron. The
// measurements are taken in a browser on a build (ui-control evidence
// register-plain-b); these pin the source that makes them.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('C105 H3 (RG-B-1): an icon in a link stands 4 from the words', async () => {
  const css = await read('src/component/link/scss/_css__link.scss');
  assert.match(css, /--sf-link--gap: var\(--sf-gap--icon-inline, var\(--sf-space-1\\\/4\)\);/);
  assert.doesNotMatch(css, /--sf-link--gap: var\(--sf-space-1\\\/3\)/);
  assert.match(css, /gap\/var\(--sf-space-1\\\/4\)/);
  assert.equal((await json('src/component/link/passport.json')).version, '1.1.1');
});

test('C105 H5 (RG-B-11): the pagination list spaces its numbers without the container', async () => {
  const css = await read('src/component/pagination/scss/_css__pagination.scss');
  const rule = css.match(/\.sf-pagination \.sf-pagination-list \{[^}]*\}/)[0];
  assert.match(rule, /gap: var\(--sf-pagination-container--gap, var\(--sf-pagination-gap, var\(--sf-space-1\\\/3\)\)\);/);
  // The container keeps the same step, so a list inside it reads the same.
  assert.match(css, /--sf-pagination-container--gap: var\(--sf-pagination-gap, var\(--sf-space-1\\\/3\)\);/);
  assert.equal((await json('src/component/pagination/passport.json')).version, '1.5.1'); // group build 7: the integrated number (the branch wrote 1.4.4)
});

test('RG-B-50: a reference card draws one ring, the link inside none', async () => {
  const css = await read('src/component/reference-link/scss/_css__reference_link.scss');
  const states = css.slice(css.indexOf('@layer sf.states'));
  assert.match(states, /\.sf-reference-link :where\(\.sf-reference-link__link, \.sf-reference-link-left > a\):focus-visible \{\s*outline: none;\s*\}/);
  assert.match(states, /\.sf-reference-link:has\(:where\(\.sf-reference-link__link, \.sf-reference-link-left > a\):focus-visible\) \{\s*outline-color: var\(--sf-focus\);/);
  assert.equal((await json('src/component/reference-link/passport.json')).version, '1.2.1');
});

test('C102 (4) (RG-B-47): the class tree toggles by the chevron, the folder is the type icon', async () => {
  const js = await read('src/component/tree/js/_tree.js');
  // The toggle button and the sf-tree-chevron both show the chevron.
  assert.match(js, /const chevron = activeOpen \? 'keyboard_arrow_down' : 'chevron_right';/);
  assert.match(js, /setIconText\(getButtonIcon\(item\), chevron\);/);
  assert.match(js, /setIconText\(getChevronIcon\(item\), chevron\);/);
  // The folder is never written into the toggle any more.
  assert.doesNotMatch(js, /setIconText\(getButtonIcon\(item\), activeOpen \? getOpenIcon/);
  // A branch's type icon follows the state only while it shows the folder pair.
  assert.match(js, /:scope > \.sf-tree-node-icon/);
  assert.match(js, /if \(branch && nodeIcon && folderPair\.includes\(nodeIcon\.textContent\.trim\(\)\)\)/);
  // A press on the button or the chevron opens and closes the branch.
  assert.match(js, /event\.target\.closest\?\.\('\.sf-icon-button, \.sf-tree-chevron'\)/);
  assert.equal((await json('src/component/tree/passport.json')).version, '1.5.1');
});
