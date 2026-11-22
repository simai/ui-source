import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// Forms block of group build 10 (fix/forms-fm2): DEV letter msg-f424660f (Smart
// study pass, forms) and owner decisions C153 (1), C251, C283, C284. Each test
// names the item it holds; each was red on the branch's base.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/\s+/gu, ' ');

// The declarations of every rule whose selector is exactly `selector`, joined.
function rule(source, selector) {
  const css = flat(source);
  const parts = [];
  for (let at = css.indexOf(`${selector} {`); at >= 0; at = css.indexOf(`${selector} {`, at + 1)) {
    if (at > 0 && !/[\s{};]/u.test(css[at - 1])) continue;
    const open = css.indexOf('{', at);
    parts.push(css.slice(open + 1, css.indexOf('}', open)));
  }
  assert.ok(parts.length, `a rule names ${selector}`);
  return parts.join(' ');
}

test('C283: sf-input-quantity has appearance bordered | filled, bordered by default, filled draws sf-quantity--filled', () => {
  const setting = json('src/smart/input-quantity/component.json').settings.appearance;
  assert.deepEqual(setting.values, ['bordered', 'filled']);
  assert.equal(setting.default, 'bordered');
  const template = read('src/smart/input-quantity/js/templates/default.js');
  assert.match(template, /context\.appearance === 'filled' \? 'sf-quantity--filled' : ''/u);
  assert.match(read('src/smart/input-quantity/index.js'), /get appearance\(\) \{\s*return this\.getAttribute\('appearance'\) === 'filled' \? 'filled' : 'bordered';/u);
  assert.match(read('src/smart/input-quantity/index.js'), /appearance: this\.appearance,/u);
});

test('SM-QT-1: the number place counts its padding in its width and is border-box, whatever the page resets', () => {
  const q = read('src/component/quantity/scss/_css__quantity.scss');
  const box = rule(q, '.sf-quantity .sf-quantity-row > .sf-quantity-wrap > input');
  assert.ok(box.includes('box-sizing: border-box;'), box);
  assert.ok(box.includes('inline-size: calc((var(--sf-quantity--digits, 6) + 0.5) * 1ch + var(--sf-quantity-input--padding-inline-start, calc(var(--sf-px) * 0)) + var(--sf-quantity-input--padding-inline-end, calc(var(--sf-px) * 0)));'), box);
  assert.doesNotMatch(flat(q), /box-sizing: content-box/u);
});

test('SM-DP-1: the date field box holds a whole value of its format, two dates and the dash for a period', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /get textChars\(\) \{/u);
  assert.match(source, /const full = this\.range \? `\$\{one\}\$\{RANGE_SEPARATOR\}\$\{one\}` : one;/u);
  assert.match(source, /textChars: this\.textChars,/u);
  assert.match(read('src/smart/input-date/js/templates/default.js'), /root-style=\$\{`--sf-datepicker-input--chars: \$\{context\.textChars \|\| 0\}`\}/u);
  const box = rule(read('src/component/datepicker/scss/_css_datepicker.scss'), '.sf-datepicker-wrap .sf-input-field > input');
  assert.ok(box.includes('font-variant-numeric: tabular-nums;'), box);
  assert.ok(box.includes('min-inline-size: calc(var(--sf-datepicker-input--chars, 0) * 1ch + var(--sf-input-input--padding-inline-start, calc(var(--sf-px) * 0)) + var(--sf-input-input--padding-inline-end, calc(var(--sf-px) * 0)));'), box);
});

test('SM-DP-2: left-icon and input-size are dated aliases until 2027-01-01, noted in SF.deprecations', () => {
  const rows = json('src/smart/input-date/aliases.json').aliases;
  for (const [from, to] of [['left-icon', 'icon-start'], ['input-size', 'size']]) {
    const row = rows.find((item) => item.from === from);
    assert.ok(row, `${from} has a dated row`);
    assert.equal(row.to, to);
    assert.equal(row.remove_after, '2027-01-01');
    assert.equal(row.shim, 'none');
  }
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /noteDeprecated\(\{component: 'sf-input-date', kind: 'attribute', from, to,\s+since: '2026-11-17', remove_after: '2027-01-01'\}\);/u);
  assert.match(source, /if \(this\.hasAttribute\('input-size'\)\) noteLegacyName\('input-size', 'size'\);/u);
  assert.match(source, /if \(this\.hasAttribute\('left-icon'\)\) noteLegacyName\('left-icon', 'icon-start'\);/u);
  const record = json('contracts/changes/journal.json').records.find((item) => item.id === 'attribute-input-date-legacy-names');
  assert.equal(record?.remove_after, '2027-01-01');
});

test('C153 (1), SM-CI-1 / SM-CLR-1 / SM-IF-1 / SM-ICH-1: code, colour, image and choice labels are in the text ink and stay 14 on a phone', () => {
  const phone = /@media not all and \(min-width: (?:60rem|#\{bp\.\$breakpoint-desktop\})\) \{[^@]*?font-size: var\(--sf-text-size-1\); line-height: var\(--sf-text-height-1\);/u;
  const cases = [
    ['src/component/verification/scss/_css__verification-form.scss', '.sf-verification-form-label', '.sf-verification-form--size-1 .sf-verification-form-label, .sf-verification-form:not([class*="sf-verification-form--size-"]) .sf-verification-form-label'], // group build 10: group build 9's wider phone rule, which also takes a form with no size class
    ['src/smart/input-color/js/templates/default.css', '.sf-color-label', '.sf-color-field.sf-color-field--size-1 .sf-color-label'],
    ['src/smart/input-image/scss/_smart__image_field.scss', '.sf-image-field-label', '.sf-image-field.sf-image-field--size-1 .sf-image-field-label'],
    ['src/smart/input-choice/scss/_smart__choice.scss', '.sf-choice .sf-choice-label', '.sf-choice .sf-choice-label'],
  ];
  for (const [path, label, small] of cases) {
    const css = read(path);
    const own = rule(css, label);
    assert.match(own, /color: var\(--sf-on-surface\);/u, `${path}: ${label} is on-surface`);
    assert.doesNotMatch(own, /color: var\(--sf-on-surface-variant\)/u, `${path}: ${label} is not the hint ink`);
    const text = flat(css);
    const at = text.indexOf(`${small} {`, text.search(/@media not all and \(min-width: (?:60rem|#\{bp\.\$breakpoint-desktop\})\)/u));
    assert.ok(at > 0, `${path}: a phone rule names ${small}`);
    assert.match(text.slice(text.lastIndexOf('@media', at)), phone, `${path}: the phone label is 14 / 20`);
  }
});

test('C284: code cells give way in width down to the touch rung 1/2, the row never leaves its column', () => {
  const css = read('src/component/verification/scss/_css__verification.scss');
  const cell = rule(css, '.sf-verification-cell, .sf-verification-form-wrap .sf-verification');
  assert.ok(cell.includes('flex: 0 1 var(--sf-verification--cell-size);'), cell);
  assert.ok(cell.includes('min-inline-size: min(var(--sf-verification--cell-size), var(--sf-ui-1\\/2--control-height));'), cell);
  // component.verification 1.9.0 (signin parts item 5): the cell's own width is its side, so the row's
  // content size is the cells' and --sf-verification-cell-size sets the width; it still gives way (flex shrink).
  assert.ok(cell.includes('inline-size: var(--sf-verification--cell-size);'), cell);
  assert.match(rule(css, '.sf-verification-form > .sf-verification'), /max-inline-size: 100%;/u);
  assert.match(rule(css, '.sf-verification-cells, .sf-verification-form-wrap'), /min-inline-size: 0;/u);
});

test('C251, SM-RD-1 / SM-SW-1: sf-radio and sf-switch take position start | end, as sf-checkbox and the class markup', () => {
  for (const name of ['radio', 'switch']) {
    const setting = json(`src/smart/${name}/component.json`).settings.position;
    assert.deepEqual(setting?.values, ['start', 'end'], name);
    assert.equal(setting.default, 'start', name);
    const template = read(`src/smart/${name}/js/templates/default.js`);
    assert.match(template, /const atEnd = context\.position === 'end';/u, name);
  }
  assert.match(read('src/smart/radio/js/templates/default.js'), /\$\{atEnd \? '' : box\}\s+\$\{renderCheckableText[^\n]+\n\s+\$\{atEnd \? box : ''\}/u);
  assert.match(read('src/smart/switch/js/templates/default.js'), /\$\{atEnd \? '' : toggler\}\s+\$\{renderCheckableText[^\n]+\n\s+\$\{atEnd \? toggler : ''\}/u);
  assert.match(rule(read('src/component/radio/scss/_css_radio_custom.scss'), '.sf-radio-button:has(> .sf-radio-button-container + .sf-radio-button-box) > .sf-radio-button-container'), /flex: 1 1 auto;/u);
  assert.match(rule(read('src/component/switch/scss/_css_switch_custom.scss'), '.sf-switch:has(> .sf-switch-container-wrap + .sf-switch-toggler) > .sf-switch-container-wrap'), /flex: 1 1 auto;/u);
  // The Smart row hugs its content (W1) except at the end, where it is the whole row (W4), as sf-checkbox's.
  const row = read('src/smart/helpers/checkable-row.css');
  const end = '.sf-checkable:has(> .sf-checkbox-container + .sf-checkbox-box:last-child, > .sf-radio-button-container + .sf-radio-button-box, > .sf-switch-container-wrap + .sf-switch-toggler)';
  assert.match(rule(row, end), /inline-size: auto;/u);
  assert.match(rule(row, `.sf-checkable-row > ${end}`), /flex: 1 1 auto;/u);
  assert.match(row, /> \.sf-checkable--text > \.sf-radio-button-container \+ \.sf-radio-button-box, > \.sf-checkable--text > \.sf-switch-container-wrap \+ \.sf-switch-toggler\) \{\s+grid-template-columns: minmax\(0, auto\) auto 1fr auto;/u);
  assert.equal(json('src/core/passports/module.smart-helpers.json').version, '1.20.0'); // forms-fb: FO-4 the press holds the leave check // feat/button-truncate-appearance: field-appearance.js (one look vocabulary for every field) // group build 10: 1.15.0 moved on by the merged branches or a GB10 patch // group build 13: 1.16.0 moved on by the merged branches or a GB11 merge
});

test('C251, SM-SW-1: sf-switch draws the class markup\'s thumb glyphs, icon alone or icon with icon-on', () => {
  const settings = json('src/smart/switch/component.json').settings;
  assert.equal(settings.icon?.type, 'icon');
  assert.equal(settings['icon-on']?.type, 'icon');
  const template = read('src/smart/switch/js/templates/default.js');
  assert.match(template, /<i class="sf-icon sf-switch-icon--off" aria-hidden="true">\$\{context\.icon\}<\/i>/u);
  assert.match(template, /<i class="sf-icon sf-switch-icon--on" aria-hidden="true">\$\{context\.iconOn\}<\/i>/u);
  assert.match(template, /<span class="sf-switch-inner transition" aria-hidden="true">\$\{icons\}<\/span>/u);
  // The class sheet the glyphs answer to (the twin's own rules).
  const plain = read('src/component/switch/scss/_css_switch.scss');
  assert.match(plain, /\.sf-switch:has\(input:checked\) \.sf-switch-inner \.sf-switch-icon--on \{\s*opacity: 1;/u);
});

test('field parity: sf-slider-range draws hint under the field and help after its label, as sf-input', () => {
  const settings = json('src/smart/slider-range/component.json').settings;
  assert.equal(settings.hint?.type, 'string');
  assert.equal(settings.help?.type, 'string');
  const template = read('src/smart/slider-range/js/templates/default.js');
  assert.match(template, /import \{renderFieldHelp\} from '\.\.\/\.\.\/\.\.\/helpers\/field-help';/u);
  assert.match(template, /renderFieldHelp\(\{help: context\.help, label: context\.name, size: context\.size, className: 'sf-range-slider-help', component: context\.component\}\)/u);
  assert.match(template, /<span class="sf-range-slider-hint" id=\$\{context\.hintId\} data-field-message="hint">\$\{context\.hint\}<\/span>/u);
  assert.match(template, /data-describedby=\$\{context\.hintId \|\| nothing\}/u);
  assert.match(template, /aria-describedby=\$\{context\.hintId \|\| nothing\}/u);
  // The class slider describes each handle by the field's line.
  const plain = read('src/component/range-slider/js/_range_slider.js');
  assert.match(plain, /const description = root\.getAttribute\('data-describedby'\);\s+if \(description && !handle\.hasAttribute\('aria-describedby'\)\) \{\s+handle\.setAttribute\('aria-describedby', description\);/u);
  const css = read('src/component/range-slider/scss/_css__range_slider_field.scss');
  const hint = rule(css, '.sf-range-slider-hint');
  assert.match(hint, /color: var\(--sf-on-surface-variant\);/u);
  assert.match(hint, /font-size: var\(--sf-range-slider--label-size, var\(--sf-text-size-1\\\/2\)\);/u);
});

test('field parity: sf-dropdown shows hint under the field, an error in its place while shown', () => {
  assert.equal(json('src/smart/dropdown/component.json').settings.hint?.type, 'string');
  const source = read('src/smart/dropdown/index.js');
  assert.match(source, /if \(this\.invalid && this\.errorMessage\) return this\.errorMessage;\s+if \(this\.shownMissing\) return this\.sfWord\('value-missing'\);\s+return this\.hint \|\| '';/u);
  assert.match(read('src/smart/dropdown/js/templates/default.js'), /data-field-message=\$\{context\.messageIsError \? "error" : "hint"\}/u);
});
