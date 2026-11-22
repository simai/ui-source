import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// Owner decision C397 (2026-11-21, popup head round 3, PH-8..10; refines
// C314), group build 16: the list's inset from the head's and the footer's
// lines, the footer's padding, the condition head as one text.
test('PH-8: a panel list stands the panel\'s inset from the head\'s and the footer\'s lines', () => {
  const css = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.match(css, /padding-block: max\(calc\(var\(--sf-px\) \* 0\), calc\(var\(--sf-choice--panel-inset\) - var\(--sf-choice--list-row-pad\)\)\);/u);
  assert.match(css, /\.sf-choice--list\[data-panel\] \.sf-choice-scroll \{\s*display: flex;\s*flex-direction: column;\s*min-block-size: 0;\s*overflow-x: hidden;/u, 'no horizontal bar under the rows');
});

test('PH-9: the filter window\'s footer pads as the rows\' start column, 16 / 12', () => {
  const shell = read('src/smart/field-renderers/filter-window.js');
  assert.match(shell, /foot\.className = 'sf-filter-window-foot';/u);
  assert.match(shell, /foot\.style\.padding = 'calc\(var\(--sf-space-1\\\\\/4\) \+ var\(--sf-space-1\\\\\/2\)\)';/u);
  assert.doesNotMatch(shell, /sf-filter-window-foot p-1\/2/u);
});

test('PH-10: the condition band is one medium text «Условие: …», grey in every state, excluding words in the error ink, a menu without dots', () => {
  const source = read('src/smart/field-renderers/index.js');
  const control = source.slice(source.indexOf('function renderConditionControl('), source.indexOf('function currencySign('));
  assert.match(control, /--sf-dropdown-band-caption: \$\{caption\}/u);
  assert.match(control, /--sf-dropdown-band-color: var\(--sf-error\); --sf-dropdown-band-hover-color: var\(--sf-error-hover\)/u);
  assert.match(control, /\{ink: 'error'\}/u);
  assert.doesNotMatch(control, /--sf-dropdown-background-color/u, 'no tint per condition (C314 tint removed)');
  assert.doesNotMatch(control, /dot:/u, 'no dots in the menu');
  const css = read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(css, /--sf-dropdown-input--font-weight: var\(--sf-weight--medium\);/u);
  assert.match(css, /--sf-dropdown-input--color: var\(--sf-dropdown-band-color, var\(--sf-on-surface\)\);/u);
  assert.match(css, /content: var\(--sf-dropdown-band-caption, none\);/u);
  assert.match(css, /\.sf-dropdown-option-ink--error \{\s*color: var\(--sf-error\);/u);
  const template = read('src/smart/dropdown/js/templates/default.js');
  assert.match(template, /const OPTION_INKS = new Set\(\["error"\]\);/u);
  const manifest = json('src/smart/dropdown/component.json');
  const variables = manifest['css-variables'];
  assert.equal(variables['--sf-dropdown-band-caption'].type, 'string');
  assert.equal(variables['--sf-dropdown-band-color'].type, 'color');
  assert.equal(variables['--sf-dropdown-band-hover-color'].type, 'color');
  assert.match(css, /> \.sf-dropdown-field:hover input \{\s*--sf-dropdown-input--color: var\(--sf-dropdown-band-hover-color, var\(--sf-dropdown-band-color, var\(--sf-on-surface\)\)\);/u);
});

test('C397 versions: the round-3 step of each part, with the journal records', () => {
  assert.equal(json('src/smart/input-choice/component.json').version, '1.11.2');
  assert.equal(json('src/smart/dropdown/component.json').version, '1.25.1'); // VL-43: the band's quiet plate
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.28.2'); // VL-54: a cell's badge is the row's text
  const ids = new Set(json('contracts/changes/journal.json').records.map((one) => one.id));
  for (const id of ['behaviour-input-choice-panel-list-inset', 'behaviour-filter-window-footer-start-column', 'behaviour-filter-window-condition-head-one-text']) assert.ok(ids.has(id), id);
});
