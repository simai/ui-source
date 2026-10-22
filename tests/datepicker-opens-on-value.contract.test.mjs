import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The calendar opens on the month of the value (Larena acceptance, 2026-10-22:
// 15.11.2026 typed, the calendar opened on August -- the month it had been
// left on). The browser probe datepicker-opens-on-value drives it; this holds
// the shape of the fix.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/datepicker/index.js');
const between = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test('opening the panel commits typed text and goes to the value\'s month', () => {
  const open = between('openPanel({focusCalendar = false} = {}) {', 'closePanel(');
  assert.match(open, /if \(!this\.open\) this\.showValueMonth\(\);/u);
  const show = between('showValueMonth() {', 'commitTypedText() {');
  assert.ok(show.indexOf('this.commitTypedText();') < show.indexOf('const primaryDate = this.primaryDate;'));
  assert.match(show, /this\.setState\(\{year: anchor\.getFullYear\(\), month: anchor\.getMonth\(\), context: ''\}\);/u);
  // No value: back to today only when the component moved the grid itself.
  assert.match(show, /else if \(this\._gridMoved\) \{\s*this\.setState\(\{year: '', month: '', context: ''\}\);/u);
  assert.match(show, /this\.set\(\{activeDate: formatIsoDate\(this\.anchorDate\)\}\);/u);
  // Only a whole date is committed; anything else waits for the field's change.
  const commit = between('commitTypedText() {', 'attributeChangedCallback(');
  assert.match(commit, /!parseDateValue\(text, this\.format\)\) return this;/u);
  assert.match(commit, /this\.handleInputChange\(\{target: this\._input\}\);/u);
});

test('the opening month is inside min-date and max-date, today\'s with no value', () => {
  const anchor = between('get anchorDate() {', 'showValueMonth() {');
  assert.match(anchor, /const candidate = this\.primaryDate \|\| new Date\(\);/u);
  assert.match(anchor, /compareDates\(candidate, minDate\) < 0\) return minDate;/u);
  assert.match(anchor, /compareDates\(candidate, maxDate\) > 0\) return maxDate;/u);
  assert.match(between('get year() {', 'set year('), /const fallback = this\.anchorDate\.getFullYear\(\);/u);
  assert.match(between('get month() {', 'set month('), /const fallback = this\.anchorDate\.getMonth\(\);/u);
});

test('a value set by a property or the value attribute moves the grid', () => {
  for (const setter of ['set value(nextValue) {', 'set date(nextValue) {', 'set startValue(nextValue) {']) {
    const body = between(setter, '\n    }\n');
    assert.ok(body.includes('...this.monthOf('), setter);
  }
  const changed = between('attributeChangedCallback(name, oldValue, newValue) {', '\n    }\n');
  assert.match(changed, /name === 'value' && oldValue !== null/u);
  // A month a host sets stays a host's month.
  assert.match(between('set month(nextValue) {', 'get contextMode()'), /this\._gridMoved = false;/u);
  assert.match(between('set year(nextValue) {', 'get month()'), /this\._gridMoved = false;/u);
});
