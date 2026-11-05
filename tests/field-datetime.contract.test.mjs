import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {composeDateTime, composeTime, normalizeTime, splitDateTime, splitTime} from '../src/smart/field-renderers/datetime.js';

// The field set edited a datetime as a day alone (Larena acceptance,
// 2026-10-22): a new record could not get a time. It is a day and a time now,
// lifted from ui-admin's property view, whose contract this keeps; the round
// trip is lossless.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('a stored datetime is split into its day, its time, the rest of its clock and its zone', () => {
  assert.deepEqual(splitDateTime('2026-11-15T10:30:15.250+03:00'),
    {raw: '2026-11-15T10:30:15.250+03:00', known: true, date: '2026-11-15', time: '10:30', rest: ':15.250', zone: '+03:00'});
  assert.deepEqual(splitDateTime('2026-11-15 10:30'), {raw: '2026-11-15 10:30', known: true, date: '2026-11-15', time: '10:30', rest: '', zone: ''});
  assert.equal(splitDateTime({value: '2026-11-15T10:30:00Z', text: '15.11.2026 13:30'}).zone, 'Z');
  assert.equal(splitDateTime('2026-11-15').time, '');
  assert.equal(splitDateTime(null).known, true);
  assert.equal(splitDateTime('завтра').known, false);
});

test('a time is read as hh:mm, from the mask or typed without it', () => {
  assert.equal(normalizeTime('10:30'), '10:30');
  assert.equal(normalizeTime('9:30'), '09:30');
  assert.equal(normalizeTime('0930'), '09:30');
  assert.equal(normalizeTime('23:59'), '23:59');
  assert.equal(normalizeTime(''), '');
  assert.equal(normalizeTime('__:__'), '');
  for (const wrong of ['24:00', '10:60', '1', '10:3', 'ab:cd']) assert.equal(normalizeTime(wrong), null, wrong);
});

test('an untouched value writes back the very text it read', () => {
  for (const raw of ['2026-11-15T10:30:15.250+03:00', '2026-11-15 10:30', '2026-11-15T10:30:00Z']) {
    const before = splitDateTime(raw);
    assert.deepEqual(composeDateTime(before, {date: before.date, time: before.time}), {value: raw});
  }
});

test('a new value is ISO 8601 with a time and no zone: the host\'s local time', () => {
  assert.deepEqual(composeDateTime(splitDateTime(null), {date: '2026-11-15', time: '10:30'}), {value: '2026-11-15T10:30:00'});
  assert.deepEqual(composeDateTime(splitDateTime('2026-11-15'), {date: '2026-11-15', time: '10:30'}), {value: '2026-11-15T10:30:00'});
});

test('a changed day keeps the stored clock and zone; a changed time keeps the zone', () => {
  const before = splitDateTime('2026-11-15T10:30:15+03:00');
  assert.deepEqual(composeDateTime(before, {date: '2026-11-16', time: '10:30'}), {value: '2026-11-16T10:30:15+03:00'});
  assert.deepEqual(composeDateTime(before, {date: '2026-11-15', time: '18:05'}), {value: '2026-11-15T18:05:00+03:00'});
});

test('clearing both clears the value; a partial entry is an error, never a guessed value', () => {
  const before = splitDateTime('2026-11-15T10:30:00');
  assert.deepEqual(composeDateTime(before, {date: '', time: ''}), {value: null});
  assert.deepEqual(composeDateTime(before, {date: '2026-11-15', time: ''}), {error: 'timeMissing'});
  assert.deepEqual(composeDateTime(before, {date: '', time: '10:30'}), {error: 'dateMissing'});
  assert.deepEqual(composeDateTime(before, {date: '2026-11-15', time: '25:00'}), {error: 'timeInvalid'});
  assert.deepEqual(composeDateTime(before, {date: '15.11.2026', time: '10:30'}), {error: 'dateInvalid'});
});

test('a stored time is split and written back the same way', () => {
  assert.deepEqual(splitTime('10:30:15'), {raw: '10:30:15', known: true, time: '10:30', rest: ':15'});
  assert.deepEqual(splitTime('09:05'), {raw: '09:05', known: true, time: '09:05', rest: ''});
  assert.equal(splitTime('25:00').known, false);
  assert.equal(splitTime(null).known, true);
  assert.deepEqual(composeTime(splitTime('10:30:15'), '10:30'), {value: '10:30:15'});
  assert.deepEqual(composeTime(splitTime('10:30:15'), '18:05'), {value: '18:05:00'});
  assert.deepEqual(composeTime(splitTime('10:30'), '18:05'), {value: '18:05'});
  assert.deepEqual(composeTime(splitTime(null), '07:45'), {value: '07:45'});
  assert.deepEqual(composeTime(splitTime('10:30'), ''), {value: null});
  assert.deepEqual(composeTime(splitTime('10:30'), '24:00'), {error: 'timeInvalid'});
});

// sf-input-date has a time (1.4.0, duplication audit A-14): a datetime is one
// control in datetime mode, a time one in time mode -- not a day and an
// sf-input masked to hh:mm beside it.
test('the set edits a datetime and a time with sf-input-date in its mode, at the field size, named by the label', () => {
  const set = read('src/smart/field-renderers/index.js');
  assert.match(set, /\n {4}date: renderDateEdit,\n {4}datetime: renderDateTimeEdit,\n {4}time: renderTimeEdit,\n/u);
  const body = (name) => {
    const start = set.indexOf(`function ${name}(field, value, host) {`);
    assert.ok(start > 0, name);
    return set.slice(start, set.indexOf('\n}\n', start));
  };
  for (const [name, mode, min, max] of [['renderDateTimeEdit', 'datetime', 'min-date', 'max-date'], ['renderTimeEdit', 'time', 'min-time', 'max-time']]) {
    const editor = body(name);
    assert.match(editor, new RegExp(`<sf-input-date\\n\\s+class="sf-field-${mode}"\\n\\s+mode="${mode}"\\n\\s+size=\\$\\{EDIT_SIZE\\}`, 'u'), name);
    assert.match(editor, /aria-label=\$\{field\.label \|\| field\.key \|\| ''\}/u, name);
    assert.match(editor, new RegExp(`${min}=\\$\\{min \\|\\| nothing\\}[\\s\\S]*${max}=\\$\\{max \\|\\| nothing\\}[\\s\\S]*minute-step=\\$\\{step \\|\\| nothing\\}`, 'u'), name);
    assert.doesNotMatch(editor.replace(/^\s*\/\/.*$/gmu, ''), /<sf-input[\s>]|<input\b|mask-pattern/u, `${name}: one control`);
    // Back to what was stored is no change.
    assert.match(editor, /host\.setFieldValue\(field, same \? undefined : result\.value\);/u, name);
  }
  assert.ok(set.includes('dateTime: {split: readDateTime, compose: composeDateTime, normalizeTime, splitTime, composeTime},'));
  const api = JSON.parse(read('src/core/contracts/public-js-api.json'));
  assert.ok(api.globals.find((entry) => entry.name === 'SF.fieldRenderers').members.includes('dateTime'));
});
