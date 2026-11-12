import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {localeWeekStart, localeWeekend, weekendDays} from '../src/smart/input-date/js/locale-calendar.js';

// Owner decision C62 (2026-11-11, ui-control control/docs-review/decisions.md):
// the calendar and the date field. Each point of the gap analysis
// (control/evidence/2026-11-11-datepicker-c62-gap) has its checks here.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sorted = (set) => [...set].sort((a, b) => a - b);

// Point 2: days off are the locale's, and a product with working weekends
// says so. They were Saturday and Sunday for every locale.
test('the days off follow the locale', () => {
  assert.deepEqual([...localeWeekend('ru')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('de')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('en-US')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('ar-EG')].sort(), [5, 6]);
  // A locale Intl refuses keeps Saturday and Sunday.
  assert.deepEqual([...localeWeekend('not a locale')].sort(), [0, 6]);
  assert.equal(localeWeekStart('ru'), 1);
  assert.equal(localeWeekStart('en-US'), 0);
  assert.equal(localeWeekStart('not a locale'), 1);
});

test('the weekend setting: empty, none, or a list of days', () => {
  assert.deepEqual(sorted(weekendDays('', 'ru')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('', 'ar-EG')), [5, 6]);
  assert.deepEqual(sorted(weekendDays('none', 'ru')), []);
  assert.deepEqual(sorted(weekendDays(' None ', 'ru')), []);
  // Intl's numbering (7 Sunday) and Date#getDay's (0 Sunday) both read.
  assert.deepEqual(sorted(weekendDays('6,7', 'ar-EG')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('6 0', 'ar-EG')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('5,6', 'ru')), [5, 6]);
  assert.deepEqual(sorted(weekendDays('0', 'ru')), [0]);
  // What is not a day is left out; nothing left is the locale's.
  assert.deepEqual(sorted(weekendDays('6,8,x', 'ru')), [6]);
  assert.deepEqual(sorted(weekendDays('8,x', 'ar-EG')), [5, 6]);
});

test('the grid reads the days off from the setting, not a fixed pair', () => {
  const source = read('src/smart/input-date/index.js');
  assert.doesNotMatch(source, /\[0, 6\]\.includes/u, 'Saturday and Sunday are no longer hard-coded');
  assert.match(source, /const daysOff = this\.weekendDays;/u);
  assert.match(source, /const weekend = daysOff\.has\(date\.getDay\(\)\);/u);
  assert.match(source, /label: weekend\s*\?\s*`\$\{getDateLabel\(date, this\.locale\)\}, \$\{this\.sfWord\('day-off'\)\}`/u);
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  assert.equal(manifest.settings.weekend.type, 'string');
  assert.equal(manifest.settings.weekend.default, '');
  assert.match(manifest.settings.weekend.summary, /none/u);
});

// Point 3: a period is one field «с – по»; two fields are a recipe.
test('a period is one field with an en dash between spaces', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /const RANGE_SEPARATOR = ' \\u2013 ';/u);
  assert.match(source, /return `\$\{this\.formattedStartValue\}\$\{RANGE_SEPARATOR\}\$\{this\.formattedEndValue\}`;/u);
  assert.match(source, /mask \+= `\$\{RANGE_SEPARATOR\}\$\{mask\}`;/u);
  assert.doesNotMatch(source, /\$\{this\.formattedStartValue\} - \$\{this\.formattedEndValue\}/u, 'no hyphen between the dates');
  const snapshot = read('src/smart/input-date/static/default/range.html');
  assert.ok(snapshot.includes('value="01.09.2026 – 07.09.2026"'));
  assert.ok(!snapshot.includes('2026 - '));
  const guide = read('src/smart/input-date/docs/smart-datepicker-guide.md');
  assert.ok(guide.includes('## A period: one field, or two as a recipe'));
  assert.ok(guide.includes('id="check-in"') && guide.includes('id="check-out"'));
  assert.ok(guide.includes("checkOut.setAttribute('min-date', start)"));
});
