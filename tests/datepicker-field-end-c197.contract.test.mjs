import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// Owner decision C197 (2026-11-15, ui-control control/docs-review/decisions.md;
// prototype prototypes/date-icon-place.html#q-date-icon, variant B): the
// calendar of sf-input-date stands at the field's end, after clear, by the
// C123 (6) order text -> clear -> action. The start is for a meaning icon.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the field draws the calendar as its indicator in the inner sf-input end slot, after the hint marker', () => {
  const template = read('src/smart/input-date/js/templates/default.js');
  const field = template.slice(template.indexOf('function renderDatepickerInput'), template.indexOf('function renderDay('));
  const hint = field.indexOf('<span slot="end" class=${context.hintIcon ? \'sf-input-hint flex\' : \'sf-input-hint\'} ?hidden=${!context.hintIcon} aria-hidden="true"');
  const calendar = field.indexOf('<span slot="end" class="sf-field-action sf-field-action--indicator sf-datepicker-indicator" aria-hidden="true"');
  assert.ok(hint > 0 && calendar > hint, 'the hint marker, then the calendar at the edge');
  assert.ok(field.includes('<sf-icon icon=${context.calendarIcon}></sf-icon></span></sf-input>'), 'the calendar is the last child');
  // sf-input draws no hint marker of its own here: the end slot replaces it.
  assert.doesNotMatch(field, /hint-icon=\$\{/u);
  // No part that comes and goes inside sf-input: it takes its slot children once.
  assert.doesNotMatch(field.slice(field.indexOf('@keydown')), /\$\{context\.hintIcon \?\s*html`/u);
});

test('icon-start is a meaning icon, none by default; the calendar follows the mode', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /leftIcon: \{attribute: 'left-icon', default: ''\},/u);
  assert.match(source, /return this\.getAttribute\('left-icon'\) \|\| '';/u);
  assert.match(source, /get calendarIcon\(\) \{\s*return this\.mode === 'time' \? 'schedule' : 'calendar_today';\s*\}/u);
  assert.match(source, /calendarIcon: this\.calendarIcon,/u);
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  assert.equal(manifest.settings['icon-start'].default, '');
  assert.equal(manifest.settings['left-icon'].default, '');
});

test('the indicator keeps the C123 gaps and takes the text ink while the field is under the pointer', () => {
  const css = read('src/component/datepicker/scss/_css_datepicker.scss');
  assert.ok(css.includes('.sf-datepicker-wrap .sf-input-field > input:has(+ .sf-input-hint[hidden] + .sf-datepicker-indicator) {\n    --sf-input-input--padding-inline-end: calc(var(--sf-field-action--inset) / 4);'));
  assert.ok(css.includes('.sf-datepicker-wrap .sf-input-field > .sf-input-hint:not([hidden]) + .sf-datepicker-indicator {\n    margin-inline-start: calc(var(--sf-field-action--inset) / 4);'));
  const states = css.slice(css.lastIndexOf('@layer sf.states {'));
  assert.ok(states.includes('.sf-datepicker-wrap .sf-input-field:hover > .sf-datepicker-indicator {\n    --sf-field-action--ink: var(--sf-on-surface);'));
  assert.ok(states.includes('.sf-datepicker-wrap .sf-input-field:has(> input:disabled) > .sf-datepicker-indicator {\n    --sf-field-action--ink: var(--sf-on-surface-disabled);'));
});
