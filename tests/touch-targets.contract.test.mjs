import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Touch screens rule 12 (docs/foundation-touch-screens.md; DEV decision on the
// coarse-pointer target size, group build 19; C428): on a coarse pointer
// stacked rows grow to --sf-hit--touch (44) at every size, isolated controls
// keep their drawn size and reach 44 by a pseudo-element under their
// neighbours. Core holds the rule; the sheets include it. The browser half is
// tests/browser/touch-targets.browser.mjs.
const device = await import('../src/core/js/device.js');
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const COARSE = '@media (pointer: coarse) and (not (any-pointer: fine))';
const coarseQuery = /@media \(pointer: coarse\) and \(not \(any-pointer: fine\)\)/u;

test('core: the mixins carry the pointer word, the row, the row height and the hit area', () => {
  const mix = read('src/core/scss/mix/_mix__touch.scss');
  assert.ok(mix.includes(COARSE), 'coarse is the core pointer word');
  assert.equal(device.COARSE_QUERY, '(pointer: coarse) and (not (any-pointer: fine))');
  assert.match(mix, /@mixin row \{\s*min-block-size: var\(--sf-hit--touch\);\s*\}/u);
  assert.match(mix, /@function row-height\(\$step\) \{\s*@return max\(#\{\$step\}, var\(--sf-hit--touch\)\);/u);
  assert.match(mix, /@mixin hit-area\(\$pseudo: after\) \{\s*position: relative;/u);
  assert.match(mix, /z-index: -1;\s*inset: min\(calc\(var\(--sf-px\) \* 0\), calc\(\(100% - var\(--sf-hit--touch\)\) \/ 2\)\);/u);
  const role = JSON.parse(read('src/core/contracts/role-tokens.v1.json'));
  assert.ok(JSON.stringify(role).includes('--sf-hit--touch'), 'the target is the role token of C173');
});

test('core: the parent of an isolated control is a stacking context on a coarse pointer only', () => {
  const sheet = read('src/core/scss/_sf_css__touch_targets.scss');
  assert.match(sheet, /@include touch\.coarse \{\s*@layer sf\.base \{\s*:where\(:has\(> :is\(:is\(sf-button-icon, sf-icon-button\), sf-checkbox, sf-radio, sf-switch, \.sf-icon-button\)\)\) \{\s*isolation: isolate;/u);
  assert.match(read('src/core/scss/index.scss'), /@use 'sf_css__touch_fields';\n[^\n]*\n@use 'sf_css__touch_targets';/u);
});

test('stacked rows: settings panel, menu rows and tabs grow to the target under the pointer word', () => {
  const settings = read('src/smart/settings/scss/_smart__settings.scss');
  assert.match(settings, /@include touch\.coarse \{\s*\.sf-settings-panel \{\s*--sf-settings-panel--row-height: #\{touch\.row-height\(var\(--sf-ui-1\\\/2--control-height\)\)\};\s*\}\s*\.sf-settings-panel--size-1 \{\s*--sf-settings-panel--row-height: #\{touch\.row-height\(var\(--sf-ui-1--control-height\)\)\};/u);
  const menu = read('src/component/menu/scss/_css__menu_element.scss');
  assert.match(menu, /@include touch\.coarse \{\s*@layer sf\.components \{\s*\.sf-menu-element \{\s*@include touch\.row;/u);
  const tabs = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(tabs, /@media \(pointer: coarse\) and \(not \(any-pointer: fine\)\) \{\s*@layer sf\.components \{\s*\.sf-tabs > \.sf-tabs-top-container > \.sf-tabs-top :is\(\.sf-button, \.sf-icon-button\) \{\s*min-block-size: var\(--sf-hit--touch\);/u);
});

test('isolated controls: icon buttons and bare checkables take the area, without weight, in sf.base', () => {
  const icons = read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss');
  assert.match(icons, /@include touch\.coarse \{\s*@layer sf\.base \{\s*:where\(\.sf-icon-button:not\(\.loading, \.sf-icon-button-state-loading, \.sf-tabs-top \*, \.sf-settings-row \*, \.sf-tag > \*, \.sf-drawer-head \*, \.sf-drawer-edge \*\)\) \{\s*@include touch\.hit-area;/u);
  const checkable = read('src/smart/helpers/checkable-row.css');
  const tail = checkable.slice(checkable.lastIndexOf('Touch screens rule 12'));
  assert.match(tail, coarseQuery);
  assert.match(tail, /:where\(\.sf-checkable:not\(\.sf-checkable--text\)\)::after \{\s*content: '';\s*position: absolute;\s*z-index: -1;\s*inset: min\(calc\(var\(--sf-px\) \* 0\), calc\(\(100% - var\(--sf-hit--touch\)\) \/ 2\)\);/u);
});

test('the Touch screens page states rule 12 and its number', () => {
  const page = read('docs/foundation-touch-screens.md');
  assert.match(page, /\n12\. \*\*Target size on a coarse pointer\*\*/u);
  assert.match(page, /\| 12 \(C428\) \| `--sf-hit--touch` \| [^|]* \| 44 \| 44 \| 44 \|/u);
  assert.ok(page.includes('tests/browser/touch-targets.browser.mjs'));
  assert.ok(page.includes('Option 3'));
});
