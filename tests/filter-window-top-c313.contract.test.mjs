// The filter field window's top (owner decisions C313, C314, 2026-11-18;
// study ui-control prototypes/filter-field-choice-study.html #top3 and
// #q-ff-cond-colour) and the Framework parts it orders (FF-9..FF-12): the
// condition band (sf-dropdown appearance="band"), a menu the trigger's width
// (list-width="trigger"), a status dot per option, a frameless value field
// (sf-input appearance="plain"), the choice list as a panel (sf-input-choice
// panel, «Выбрать найденные (N)»). The rules without a browser; the browser
// probe is tests/browser/filter-window.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {filterConditionTone, filterConditions} from '../src/smart/field-renderers/filter-conditions.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('C313 (1), FF-11: sf-dropdown band -- no frame, no radius, the search header\'s height, the grey container fill, the text over the rows', () => {
  const manifest = json('src/smart/dropdown/component.json');
  assert.ok(manifest.settings.appearance.values.includes('band'));
  assert.ok(manifest['css-variables']['--sf-dropdown-band-edge'], 'the band\'s edge is a public variable');
  const css = read('src/component/dropdown/scss/_css__custom.scss');
  const block = css.slice(css.indexOf('.sf-dropdown.sf-dropdown--band {'));
  assert.match(block, /--sf-dropdown--band-inset: calc\(#\{panel\.\$inset\} \+ #\{panel\.\$row-padding\} \+ var\(--sf-dropdown--band-edge\)\);/u);
  assert.match(block, /--sf-dropdown-field--border-end-end-radius: 0;/u);
  assert.match(block, /--sf-dropdown-field--background-color: var\(--sf-dropdown-background-color, var\(--sf-surface-container\)\);/u);
  assert.match(block, /min-block-size: calc\(var\(--sf-dropdown--band-row\) \+ 2 \* #\{panel\.\$inset\}\);/u);
  // VR11-4 (group build 16): the band's hairline sits inside the search's height, not one pixel more.
  assert.doesNotMatch(block, /min-block-size: calc\(var\(--sf-dropdown--band-row\) \+ 2 \* #\{panel\.\$inset\} \+ var\(--sf-px\)\);/u);
  assert.match(block, /background-image: linear-gradient\(var\(--sf-surface-state-hover\), var\(--sf-surface-state-hover\)\);/u);
  assert.match(block, /@layer sf\.paint \{\n\s+\.sf-dropdown\.sf-dropdown--band\.sf-dropdown--band > \.sf-dropdown-field\.sf-dropdown-field \{\n\s+border-block-end-color: var\(--sf-outline-variant\);/u);
});

test('FF-10: list-width="trigger" -- the menu takes the trigger\'s width, in place and portaled', () => {
  const portal = read('src/component/dropdown/portal.js');
  assert.match(portal, /matchWidth: list\.dataset\.sfListWidth === 'trigger' \? true :/u);
  const css = read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(css, /\[data-sf-list-width="trigger"\]/u);
  assert.match(read('src/smart/dropdown/index.js'), /listWidth: \['list', 'trigger'\]\.includes\(this\.listWidth\) \? this\.listWidth : 'field'/u);
});

test('C314 (4): an option\'s dot survives the option data and draws sf-dot\'s 8 px disc before its name', () => {
  const source = read('src/smart/dropdown/index.js');
  assert.match(source, /dot: option\.dot \? String\(option\.dot\) : '',/u);
  assert.match(source, /dot: node\.getAttribute\('dot'\) \|\| '',/u);
  const template = read('src/smart/dropdown/js/templates/default.js');
  assert.match(template, /const OPTION_DOTS = new Set\(\["primary", "tertiary", "info", "success", "warning", "error", "neutral"\]\);/u);
  assert.match(template, /class="sf-dot sf-dot--size-1 sf-dot--\$\{String\(option\.dot\)\} sf-dropdown-option-dot"><span class="sf-dot-item" aria-hidden="true"><\/span>/u);
  assert.ok(json('src/smart/dropdown/component.json').relations.some((one) => one.name === 'dot'), 'the dot sheet is a relation');
  assert.match(read('src/component/dot/scss/_css_dot.scss'), /\.sf-dot\.sf-dot--tertiary \{\n\s+--sf-dot-item--background-color: var\(--sf-tertiary\);/u);
});

test('C314: excluding conditions are error red, presence tertiary purple, the rest grey', () => {
  assert.deepEqual(['not_in', 'ne', 'not_contains'].map(filterConditionTone), ['error', 'error', 'error']);
  assert.deepEqual(['empty', 'not_empty'].map(filterConditionTone), ['tertiary', 'tertiary']);
  assert.deepEqual(['in', 'all', 'eq', 'gt', 'between', 'contains', 'starts_with'].map(filterConditionTone), ['', '', '', '', '', '', '']);
  for (const type of ['choice', 'choices', 'user', 'string', 'money', 'date']) {
    for (const one of filterConditions({propertyType: type})) assert.ok(['', 'error', 'tertiary'].includes(filterConditionTone(one)), `${type}: ${one}`);
  }
});

test('C313 (1), C314: the window\'s condition is a band with a menu the band\'s width, size 1 rows, search from ten, a tint only for unusual conditions', () => {
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /<sf-dropdown class="sf-filter-window-condition" size=\$\{windowStep\(\)\} appearance="band" mode="select"/u);
  assert.match(source, /search=\$\{conditions\.length >= 10 \? 'true' : 'false'\} list-width="trigger"/u);
  assert.match(source, /tone \? `--sf-dropdown-background-color: var\(--sf-\$\{tone\}-container\)` : ''/u);
  assert.match(source, /dot: filterConditionTone\(operator\) \|\| 'neutral'/u);
  // In a phone's sheet the window's parts reach the sheet's edges past its body's inset.
  assert.match(source, /margin-inline: calc\(-1 \* var\(--sf-drawer--inset-start\)\) calc\(-1 \* var\(--sf-drawer--inset-end\)\)/u);
});

test('C313 (4), FF-12: the value row is a frameless field at the band\'s text edge; two values read as words', () => {
  const manifest = json('src/smart/input/component.json');
  assert.ok(manifest.settings.appearance.values.includes('plain'));
  assert.match(read('src/smart/input/js/templates/default.js'), /sf-input--plain/u);
  const css = read('src/component/inputs/scss/_css__inputs.scss');
  const block = css.slice(css.indexOf('@layer sf.overrides {\n  .sf-input.sf-input--plain'));
  assert.match(block, /border-inline-width: 0;\n\s+border-block-start-width: 0;\n\s+border-radius: 0;/u);
  assert.match(block, /border-block-end-color: var\(--sf-primary\);/u);
  assert.doesNotMatch(block, /box-shadow: inset/u);
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /appearance="plain"/u);
  for (const [lang, from, to] of [['ru', 'от', 'до'], ['en', 'from', 'to']]) {
    const words = json(`src/smart/field-renderers/lang/${lang}.json`).runtime;
    assert.deepEqual([words.rangeFromWord, words.rangeToWord], [from, to]);
  }
});

test('C313 (3), C312 (1): the choice list as a panel -- the search header, the list scrolling under it, «Выбрать найденные (N)» while searching', () => {
  const manifest = json('src/smart/input-choice/component.json');
  assert.ok(manifest.settings.panel, 'panel is a setting');
  for (const [lang, word] of [['ru', 'Выбрать найденные'], ['en', 'Select found']]) {
    assert.equal(json(`src/smart/input-choice/lang/${lang}.json`).runtime['select-found'], word);
  }
  const source = read('src/smart/input-choice/index.js');
  assert.match(source, /if \(!this\.multiple \|\| !this\.panelValue \|\| !this\._pages\.query\.trim\(\)\) return \[\];/u);
  assert.match(source, /const detail = \{value: this\.value, values: \[\.\.\.next\], item: null, checked: true\};/u);
  const css = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.match(css, /\.sf-choice--list\[data-panel\] \.sf-choice-scroll \{\n\s+display: flex;\n\s+flex-direction: column;\n\s+min-block-size: 0;\n\s+overflow-y: auto;/u);
  assert.match(read('src/smart/input-choice/js/templates/default.js'), /return context\.panel \? html`<div class="sf-choice-scroll">\$\{content\}<\/div>` : content;/u);
  assert.match(read('src/smart/field-renderers/index.js'), /\?panel=\$\{host\.filterWindow === true\}/u);
});

test('C313 (5), C312 (2): a boolean has no band and no footer; a press applies; «Снять условие» while a condition is set', () => {
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /footer: filterKindOf\(field\) !== 'boolean'/u);
  assert.match(source, /filterRemoveCondition/u);
  const shell = read('src/smart/field-renderers/filter-window.js');
  assert.match(shell, /footer: withFooter = true/u);
  // The footer's buttons on the window's one step (popup head round 3, PH-7), as the rows; a step below was a second step in one window.
  assert.match(shell, /export const FILTER_WINDOW_STEP = '1';/u);
  assert.match(shell, /const footSize = FILTER_WINDOW_STEP;/u);
  assert.match(shell, /size: FILTER_WINDOW_STEP,/u);
  assert.doesNotMatch(shell, /followTrack|--sf-dropdown-band-end/u);
  assert.match(shell, /<sf-button size=\$\{footSize\} scheme="primary" text=\$\{applyText\(\)\}/u);
  assert.match(shell, /applyTempFilterValue: \(key, patch\) => \{/u);
  assert.match(shell, /resetFilter: \(\) => finish\('reset'\),/u);
  assert.equal(json('src/smart/field-renderers/lang/ru.json').runtime.filterRemoveCondition, 'Снять условие');
});
