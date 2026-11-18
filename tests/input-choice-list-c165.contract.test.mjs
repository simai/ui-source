// sf-input-choice appearance="list" and sf-form's short choice fields (owner
// decision C165 (1), (3); research ui-control control/research/2026-11-14-checks.md,
// prototype prototypes/checks-study.html #q-group, #q-inline).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHOICE_APPEARANCES, CHOICE_FLOWS, ROW_MOST, SHORT_OPTION_LENGTH, listFlow} from '../src/smart/input-choice/js/choice-model.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/input-choice/component.json'));

test('C165 (1): appearance cards (default) or list; help after the heading', () => {
  assert.deepEqual([...CHOICE_APPEARANCES], ['cards', 'list']);
  assert.deepEqual(manifest.settings.appearance.values, [...CHOICE_APPEARANCES]);
  assert.equal(manifest.settings.appearance.default, 'cards');
  assert.equal(manifest.settings.help.type, 'string');
  assert.ok(manifest.relations.some((one) => one.name === 'cl-help-mark' && one.lazy === true));
  for (const lang of ['ru', 'en']) {
    assert.match(JSON.parse(read(`src/smart/input-choice/lang/${lang}.json`)).runtime.help, /\{label\}/u);
  }
  const template = read('src/smart/input-choice/js/templates/default.js');
  // The rows are the class markup of sf-checkbox and sf-radio at size 1.
  assert.match(template, /'sf-checkbox', 'sf-checkbox--size-1', 'flex', 'sf-choice-row'/u);
  assert.match(template, /'sf-radio-button', 'sf-radio-button--size-1', 'flex', 'sf-choice-row'/u);
  // The heading names the group; the hint and the error describe it; the error comes after the rows.
  const list = template.slice(template.indexOf('function renderListTemplate'));
  assert.ok(list.indexOf('sf-choice-heading') < list.indexOf('sf-choice-hint'));
  assert.ok(list.indexOf('sf-choice-hint') < list.indexOf('sf-choice-options'));
  assert.ok(list.indexOf('sf-choice-options') < list.indexOf('sf-choice-message'));
  assert.match(list, /aria-describedby=\$\{described \|\| nothing\}/u);
});

test('C165 (3): flow auto puts up to three short options in a row, more in a column', () => {
  assert.deepEqual([...CHOICE_FLOWS], ['auto', 'row', 'column']);
  assert.equal(ROW_MOST, 3);
  const short = (n) => Array.from({length: n}, (_, i) => ({label: `Вариант ${i}`}));
  assert.equal(listFlow('auto', short(2)), 'row');
  assert.equal(listFlow('auto', short(3)), 'row');
  assert.equal(listFlow('auto', short(4)), 'column');
  assert.equal(listFlow('auto', [{label: 'Да'}, {label: 'Нет', caption: 'пояснение'}]), 'column');
  assert.equal(listFlow('auto', [{label: 'x'.repeat(SHORT_OPTION_LENGTH + 1)}, {label: 'Нет'}]), 'column');
  assert.equal(listFlow('row', short(5)), 'row');
  assert.equal(listFlow('column', short(2)), 'column');
  // Anything else is auto.
  assert.equal(listFlow('', short(2)), 'row');
  assert.deepEqual(manifest.settings.flow.values, [...CHOICE_FLOWS]);
  assert.equal(manifest.settings.flow.default, 'auto');
  assert.deepEqual(manifest.settings.layout.values, ['tile', 'list', 'picture']);
  // No own loading skeleton (owner route msg-be707cc5).
  assert.deepEqual(manifest['x-registry'].presentation.skeleton, {shape: 'none', while_loading: 'none'});
});

test('C165 (3): the row is the groups gap apart and a column in a narrow field; rows of the step', () => {
  const sheet = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.match(sheet, /\.sf-choice--list\[data-flow='row'\] \.sf-choice-options \{[^}]*column-gap: var\(--sf-space-1\);/u);
  assert.match(sheet, /@container sf-choice \(inline-size < (?:24rem|#\{mq\.container-step\(g2\)\})\) \{\s*\.sf-choice--list\[data-flow='row'\] \.sf-choice-options \{\s*flex-direction: column;/u);
  assert.match(sheet, /--sf-choice--row-pad: calc\(\(var\(--sf-ui-1--control-height\) - var\(--sf-text-height-1\)\) \/ 2\);/u);
  assert.match(sheet, /max\(var\(--sf-ui-1--control-height\), var\(--sf-d1\)\)/u);
});

test('C165 (1): sf-form draws a short choice field through sf-input-choice appearance list', async () => {
  // The module imports lit; read the rule from the source.
  const source = read('src/smart/form/js/choice-list.js');
  assert.match(source, /export const LIST_MOST = 5;/u);
  assert.match(source, /appearance="list"/u);
  // A template other than the default dropdown keeps its own control (C302), as does the former select.
  assert.match(source, /if \(template !== DEFAULT_TEMPLATE \|\| former === 'select'\) return false;/u);
  const form = read('src/smart/form/index.js');
  assert.match(form, /isListChoice\(field\) \? renderChoiceList\(field, value, host\) : renderEditField/u);
  assert.equal(JSON.parse(read('src/smart/form/component.json')).version, '1.7.0'); // form fields: 1.7.0, field host // field orders FO-1, FO-6: 1.6.0 // C302/C303: 1.5.0 // 1.2.0: late fields and groups (R222 FP-8) // group build 9: 1.2.0 moved on by the merged branches or a GB9 patch // C282: 1.2.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.3.1 moved on by the merged branches or a GB10 patch // fix/date-pd: 1.3.4, the unknown-type warning
});
