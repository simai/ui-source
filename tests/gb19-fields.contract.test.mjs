import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Group build 19, area B (fields and forms):
// - the include field's view owns no lit DOM inside its code block (View
//   round 19 return: sf-highlight rewrote the code's text node and the next
//   record threw «Cannot set properties of null (setting 'data')» in lit's
//   commit), module.smart-field-renderers 1.30.2;
// - the window content-actions rows (D-SCROLL) weigh nothing, so a
//   composite's own bar wins with a class rule (View round 17 cde9354e),
//   sf-drawer 1.22.1, sf-modal 1.11.2;
// - sf-form labels="start" reads its attribute through :where and takes the
//   label column from --sf-form-label-width (study S-B SB-4), sf-form 1.16.0.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the include view draws its block through an element directive, not a lit text part in code', () => {
  const source = read('src/smart/field-renderers/index.js');
  const view = source.slice(source.indexOf('function renderIncludeView('), source.indexOf('// The include editor is code'));
  assert.doesNotMatch(view, /<code>\$\{/u, 'no lit part inside the code block');
  assert.match(view, /\$\{includeBlock\(String\(text\), language\)\}/u);
  assert.match(view, /style="display: contents"/u);
  const directive = source.slice(source.indexOf('class IncludeBlock extends Directive'), source.indexOf('const includeBlock = directive(IncludeBlock);'));
  assert.match(directive, /partInfo\.type !== PartType\.ELEMENT/u);
  assert.match(directive, /this\.text === text && this\.language === language && box\.firstChild\) return noChange;/u);
  assert.match(directive, /code\.textContent = text;/u);
  assert.match(directive, /box\.replaceChildren\(pre\);/u);
  assert.match(source, /^import \{Directive, PartType, directive\} from "lit\/directive\.js";$/mu);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.2');
});

test('the content-actions rows of a window weigh nothing', () => {
  const mixin = read('src/core/scss/mix/_mix__window-footer.scss');
  const body = mixin.slice(mixin.indexOf('@mixin content-actions('));
  assert.match(body, /:where\(#\{\$body\} #\{\$row\}\) \{\n\s+position: sticky;/u);
  assert.match(body, /:where\(#\{\$more-end\} #\{\$row\}\) \{\n\s+box-shadow/u);
  assert.match(body, /:where\(#\{\$body\} #\{\$row\}\) \{\n\s+background-color: var\(--sf-surface-place\);/u);
  // The question's step above its answers keeps its weight (it is no default a composite replaces).
  assert.match(body, /\n\s+#\{\$body\} \.sf-confirm--window > \* \+ \.sf-confirm__footer \{/u);
  for (const [path, version] of [['src/smart/drawer/component.json', '1.22.1'], ['src/smart/drawer/smart.manifest.json', '1.22.1'],
    ['src/smart/modal/component.json', '1.11.2'], ['src/smart/modal/smart.manifest.json', '1.11.2'], ['src/component/modal/passport.json', '1.8.2']]) {
    assert.equal(json(path).version, version, path);
  }
});

test('sf-form start labels read the attribute through :where and the column from --sf-form-label-width', () => {
  const sheet = read('src/smart/form/scss/_smart__form.scss');
  assert.match(sheet, /--sf-form--label-column: var\(--sf-form-label-width, fit-content\(var\(--sf-form--label-width\)\)\);/u);
  assert.match(sheet, /:where\(\.sf-form\[data-labels="start"\]\) \.sf-form-fields \{\n\s+grid-template-columns: var\(--sf-form--label-column\) minmax\(0, 1fr\);/u);
  for (const rule of [':where(.sf-form[data-labels="start"]) .sf-form-field {',
    ':where(.sf-form[data-labels="start"]) .sf-form-field > .sf-form-label {',
    ':where(.sf-form[data-labels="start"][data-size="1/2"]) .sf-form-field > .sf-form-label {',
    ':where(.sf-form[data-labels="start"]) .sf-form-field > :not(.sf-form-label) {']) {
    assert.ok(sheet.includes(rule), rule);
  }
  assert.doesNotMatch(sheet, /^\s+\.sf-form\[data-labels="start"\] \.sf-form-field/mu, 'no start-label row at the attribute weight');
  const component = json('src/smart/form/component.json');
  assert.equal(component.version, '1.16.0');
  assert.deepEqual(component['css-variables']['--sf-form-label-width'], {type: 'length', state: 'default'});
  const listed = json('src/core/contracts/public-variables.v1.json').components.find((one) => one.component === 'form');
  assert.ok(listed.variables.some((one) => one.name === '--sf-form-label-width' && one.role === 'inline-size'));
  assert.match(read('src/smart/form/docs.md'), /--sf-form-label-width/u);
});

test('C52 names its record card clause (study S-B variant A) in the form docs', () => {
  const docs = read('src/smart/form/docs.md');
  assert.match(docs, /Своего фона у формы нет \(C52\)/u);
  assert.match(docs, /Исключение — карточка\nзаписи \(`sf-view-properties`, исследование S-B, вариант A\)/u);
  assert.match(docs, /`--sf-surface-card` с линией `--sf-outline-variant` на сером\n`--sf-surface-area`/u);
  assert.match(docs, /Формы настроек в шторке правило не меняет\./u);
});

test('the change journal records both weights', () => {
  const ids = json('contracts/changes/journal.json').records.map((one) => one.id);
  assert.ok(ids.includes('behaviour-window-content-actions-weightless'));
  assert.ok(ids.includes('behaviour-form-start-labels-weight-and-width'));
});
