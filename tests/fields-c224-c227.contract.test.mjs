import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// Owner decisions C224-C227 (2026-11-16; forms studies of pair 5.20261115.1622:
// quantity, textarea, inputs, datepicker). Each test names the decision it holds.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/\s+/gu, ' ');

// The declarations of the rule whose selector is exactly `selector`.
function rule(source, selector) {
  const css = flat(source);
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `a rule names ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

test('C226: the field ladder floors the label at 1/3 (12), never 1/4 (10)', () => {
  const ladder = flat(read('src/component/inputs/scss/_field-ladder.scss'));
  assert.match(ladder, /\$label-floor: '1\/3';/u);
  assert.match(ladder, /@function label-step\(\$size\) \{ \$step: below\(\$size\); @if \$step == '1\/4' \{ @return \$label-floor; \} @return \$step; \}/u);
  assert.match(ladder, /@function label-size\(\$size\) \{ @return text-size\(label-step\(\$size\)\); \}/u);
  assert.match(ladder, /@function label-height\(\$size\) \{ @return text-height\(label-step\(\$size\)\); \}/u);
});

test('C226: no field family draws a label, mark, help, count or caption on the 1/4 text', () => {
  for (const path of [
    'src/component/inputs/scss/_css__custom.scss',
    'src/component/inputs/scss/_css__inputs.scss',
    'src/component/textarea/scss/_css__textarea.scss',
    'src/component/quantity/scss/_css__quantity.scss',
    'src/component/country-code/scss/_css_country_code_custom.scss',
    'src/component/verification/scss/_css__verification_custom.scss',
    'src/component/range-slider/scss/_css__range_slider_field.scss',
    'src/smart/input-lookup/scss/_smart__lookup.scss',
    'src/smart/input-rich/scss/_smart__rich_text.scss',
    'src/smart/input-color/js/templates/default.css',
  ]) {
    assert.doesNotMatch(read(path), /--sf-text-(?:size|height)-1\\\/4/u, `${path} reads the 1/4 text`);
  }
  const custom = read('src/component/inputs/scss/_css__custom.scss');
  assert.match(rule(custom, '.sf-input.sf-input--size-1\\/3 .sf-input-label .sf-input-text'), /--sf-input-text--font-size: #\{ladder\.label-size\('1\/3'\)/u);
  assert.match(rule(custom, '.sf-input.sf-input--size-1\\/3 .sf-input-label'), /--sf-input-label--line: #\{ladder\.label-height\('1\/3'\)/u);
});

// C283 (2026-11-17) reverses the default of C224: bordered by default, filled on request (sf-quantity--filled).
test('C224 under C283: a plain sf-quantity is bordered; sf-quantity--filled draws the filled box', () => {
  const q = read('src/component/quantity/scss/_css__quantity.scss');
  assert.match(rule(q, '.sf-quantity .sf-quantity-wrap'), /border-block-end-color: var\(--sf-quantity-wrap--line-color, var\(--sf-quantity-wrap--border-color, transparent\)\);/u);
  const rest = rule(q, '.sf-quantity.sf-quantity--filled:not(.error):has(input:enabled:not(:read-only)) .sf-quantity-wrap');
  assert.match(rest, /--sf-quantity-wrap--background-color: var\(--sf-quantity-background-color, var\(--sf-surface-container\)\);/u);
  assert.match(rest, /--sf-quantity-wrap--border-color: var\(--sf-quantity-border-color, var\(--sf-transparent-for-focus\)\);/u);
  assert.match(rest, /--sf-quantity-wrap--line-color: var\(--sf-quantity-border-color, var\(--sf-outline\)\);/u);
  const hover = rule(q, '.sf-quantity.sf-quantity--filled:not(.error):has(input:enabled:not(:disabled):not(.disabled):not(:read-only):hover) .sf-quantity-wrap');
  assert.match(hover, /--sf-quantity-wrap--background-color: var\(--sf-surface-container-hover\);/u);
  assert.match(rule(q, '.sf-quantity.sf-quantity--filled.error .sf-quantity-wrap'), /--sf-quantity-wrap--background-color: var\(--sf-error-container\);/u);
  assert.match(rule(q, '.sf-quantity.sf-quantity--filled:has(input:disabled) .sf-quantity-wrap'), /--sf-quantity-wrap--background-color: var\(--sf-surface-disabled\);/u);
  assert.match(read('src/component/quantity/docs/docs.md'), /`sf-quantity--filled` draws it filled on request/u);
  assert.doesNotMatch(q, /:not\(\.sf-quantity--bordered\)/u, 'no rule fills a quantity by default');
});

test('C225: an empty growing textarea keeps its min-rows height and ellipsizes the placeholder', () => {
  const t = read('src/component/textarea/scss/_css__textarea.scss');
  assert.match(rule(t, '.sf-textarea.sf-textarea--auto-grow textarea[rows]:placeholder-shown'),
    /max-block-size: calc\(var\(--sf-textarea--min-rows, 1\) \* var\(--sf-textarea--line\) \+ var\(--sf-textarea--row-frame\)\);/u);
  const empty = rule(t, '.sf-textarea.sf-textarea--auto-grow textarea[rows]:placeholder-shown');
  assert.match(empty, /white-space: nowrap;/u);
  assert.match(empty, /text-overflow: ellipsis;/u);
  const ph = rule(t, '.sf-textarea.sf-textarea--auto-grow textarea[rows]::placeholder');
  assert.match(ph, /white-space: nowrap;/u);
  assert.match(ph, /text-overflow: ellipsis;/u);
  assert.match(ph, /overflow: hidden;/u);
});

test('C227: on a phone the one-date popup draws 44 days; a period, the sheet and an inline calendar keep theirs', () => {
  const d = flat(read('src/component/datepicker/scss/_css_datepicker.scss'));
  assert.match(d, /@media not all and \(min-width: 60rem\) \{ \.sf-datepicker:not\(\.sf-datepicker--inline\):not\(\.sf-datepicker--sheet\):not\(\.sf-datepicker--range\):not\(:has\(\.sf-datepicker-day-start, \.sf-datepicker-day-end\)\) \{ --sf-datepicker-day--height: var\(--sf-ui-2--control-height\); \}/u);
  assert.match(read('src/smart/input-date/js/templates/default.js'), /context\.range \? 'sf-datepicker--range' : ''/u);
});
