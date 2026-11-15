import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// Owner decision C198 (2026-11-15, ui-control control/docs-review/decisions.md;
// prototype prototypes/calendar-holidays-and-more-study.html#q-cal-holidays,
// variant C; closes the open part of C62): a holiday and a moved day off take
// the day-off ink, a moved working Saturday the weekday's; the dot and the day
// line are drawn only for days the site listed.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('holidays is a list setting of {date, kind, name?} with the three kinds', () => {
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  const setting = manifest.settings.holidays;
  assert.equal(setting.type, 'list');
  assert.deepEqual(setting.default, []);
  assert.equal(setting.of.date, 'string');
  assert.deepEqual(setting.of.kind.values, ['holiday', 'day-off', 'working-day']);
  assert.equal(setting.of.name.optional, true);
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /const HOLIDAY_KINDS = new Set\(\['holiday', 'day-off', 'working-day'\]\);/u);
  assert.match(source, /holidays: \{default: ''\},/u);
  assert.match(source, /this\.upgradeProperty\('holidays'\);/u);
  // The attribute is JSON; anything else is no special day.
  assert.match(source, /const parsed = JSON\.parse\(raw\);\s*return Array\.isArray\(parsed\) \? parsed : \[\];/u);
  assert.match(source, /if \(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/u\.test\(date\) \|\| !HOLIDAY_KINDS\.has\(entry\?\.kind\)\) continue;/u);
});

test('a listed day wins over the week: working-day is a weekday, the others days off; the name joins the label', () => {
  const source = read('src/smart/input-date/index.js');
  const facts = source.slice(source.indexOf('    dayFacts(date, value, daysOff'), source.indexOf('    get dayLine()'));
  assert.match(facts, /const weekend = special \? special\.kind !== 'working-day' : daysOff\.has\(date\.getDay\(\)\);/u);
  assert.match(facts, /const parts = \[getDateLabel\(date, locale\)\];\s*if \(special\?\.name\) parts\.push\(special\.name\);\s*if \(weekend\) parts\.push\(this\.sfWord\('day-off'\)\);/u);
  assert.match(facts, /special: Boolean\(special\)/u);
});

test('the dot and the day line are drawn only with data', () => {
  const template = read('src/smart/input-date/js/templates/default.js');
  assert.ok(template.includes("day.special ? 'sf-datepicker-day-special' : ''"));
  assert.ok(read('src/smart/input-date/js/templates/ribbon.js').includes("day.special ? 'sf-datepicker-day-special' : ''"));
  assert.match(template, /function renderDayLine\(context\) \{\s*const line = context\.dayLine;\s*if \(!line\) return nothing;/u);
  assert.ok(template.includes('<p class="sf-datepicker-dayline" aria-hidden="true">'));
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /get dayLine\(\) \{\s*if \(!this\.holidayDays\.size\) return null;/u);
  assert.match(source, /dayLine: this\.mode === 'time' \? null : this\.dayLine,/u);
  const day = read('src/component/datepicker/scss/_css_day.scss');
  assert.ok(day.includes('.sf-datepicker-day.sf-datepicker-day-special .sf-datepicker-day-date::after {'));
  assert.ok(day.includes('--sf-datepicker-day-special--size: var(--sf-space-1\\/4);'));
  assert.ok(day.includes('background-color: currentColor;'));
  const sheet = read('src/component/datepicker/scss/_css_datepicker.scss');
  assert.ok(sheet.includes('min-block-size: calc(2 * var(--sf-text-height-1\\/2) + var(--sf-space-1\\/3));'));
});

test('the example with data prints its first frame', () => {
  const examples = JSON.parse(read('src/smart/input-date/examples.json')).examples;
  const example = examples.find((one) => one.name === 'holidays');
  assert.ok(example, 'example holidays');
  assert.deepEqual(example.settings.holidays.map((one) => one.kind), ['day-off', 'holiday', 'working-day']);
  const html = read('src/smart/input-date/static/default/holidays.html');
  assert.equal((html.match(/sf-datepicker-day-special/gu) || []).length, 3);
  assert.ok(html.includes('class="sf-datepicker-dayline" aria-hidden="true"'));
  assert.ok(html.includes('Радуница'));
});
