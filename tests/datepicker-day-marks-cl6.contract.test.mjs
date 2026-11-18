import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// CL-6 (calendar layout study, ui-control control/research/2026-11-18-calendar-view;
// DEV msg-9e2f03e75ea646a9a00e): a day of sf-input-date carries a mark -- a dot
// or a small count in a tone's ink -- so the panel can be the mini month beside
// a calendar and the phone month. The day keeps its height; a screen reader
// hears the day, then the label or the plural count.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/input-date/index.js');

// readDayMark taken from the source, with the two constants it reads.
function loadReadDayMark() {
  const constants = source.slice(source.indexOf('const MARK_TONES'), source.indexOf('// One day\'s mark as the grid draws it'));
  const body = source.slice(source.indexOf('function readDayMark(raw)'), source.indexOf('\nfunction padDatePart'));
  return new Function(`${constants}\n${body}\nreturn readDayMark;`)();
}

test('day-marks is an object setting {count?, tone?, label?} with six tones, and refresh is an action', () => {
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  const setting = manifest.settings['day-marks'];
  assert.equal(setting.type, 'object');
  assert.deepEqual(setting.of.tone.values, ['primary', 'error', 'warning', 'success', 'tertiary', 'neutral']);
  assert.equal(setting.of.count.integer, true);
  assert.equal(setting.of.label.type, 'string');
  assert.deepEqual(manifest.actions.refresh['x-outcomes'], ['applied']);
  assert.match(source, /dayMarks: \{attribute: 'day-marks', default: ''\},/u);
  assert.match(source, /this\.upgradeProperty\('dayMarks'\);/u);
  assert.match(source, /'refresh'\(\) \{\s*this\.redrawDayMarks\(\);\s*return 'applied';/u);
});

test('a mark is read as a dot, a count or nothing', () => {
  const readDayMark = loadReadDayMark();
  assert.deepEqual(readDayMark({}), {count: null, tone: 'primary', label: '', text: ''});
  assert.deepEqual(readDayMark({count: 1, tone: 'error'}), {count: 1, tone: 'error', label: '', text: ''});
  assert.deepEqual(readDayMark({count: 3}), {count: 3, tone: 'primary', label: '', text: '3'});
  assert.deepEqual(readDayMark({count: '12', tone: 'warning', label: ' 12 доставок '}), {count: 12, tone: 'warning', label: '12 доставок', text: '12'});
  assert.equal(readDayMark({count: 120}).text, '99+');
  assert.equal(readDayMark({count: 120}).count, 120);
  assert.equal(readDayMark({count: 99}).text, '99');
  assert.equal(readDayMark({tone: 'pink'}).tone, 'primary');
  for (const none of [null, undefined, 3, 'x', [], {count: 0}, {count: -2}, {count: 'many'}]) assert.equal(readDayMark(none), null);
});

test('the function, the map and the attribute are read; a throwing function marks nothing', () => {
  const marks = source.slice(source.indexOf('    get dayMarks()'), source.indexOf('    set preset(next)'));
  assert.match(marks, /if \(typeof marks === 'function'\) \{\s*try \{\s*return readDayMark\(marks\(value\)\);/u);
  assert.match(marks, /return Object\.prototype\.hasOwnProperty\.call\(marks, value\) \? readDayMark\(marks\[value\]\) : null;/u);
  assert.match(marks, /const parsed = JSON\.parse\(raw\);\s*return parsed && typeof parsed === 'object' && !Array\.isArray\(parsed\) \? parsed : null;/u);
  assert.match(marks, /if \(this\._sheetOpen && this\._ribbon\) this\.renderRibbon\(\);/u);
});

test('the label ends with the host label, else the plural count, else the presence word', () => {
  const facts = source.slice(source.indexOf('    dayFacts(date, value, daysOff'), source.indexOf('    get dayLine()'));
  assert.match(facts, /if \(weekend\) parts\.push\(this\.sfWord\('day-off'\)\);[\s\S]*if \(mark\) parts\.push\(this\.dayMarkWords\(mark\)\);/u);
  assert.match(source, /if \(mark\.label\) return mark\.label;\s*if \(mark\.count !== null\) return this\.sfWord\('mark-count', \{count: mark\.count\}\);\s*return this\.sfWord\('mark-present'\);/u);
  const en = JSON.parse(read('src/smart/input-date/lang/en.json')).runtime;
  const ru = JSON.parse(read('src/smart/input-date/lang/ru.json')).runtime;
  assert.deepEqual(en['mark-count'], {one: '{n} event', other: '{n} events'});
  assert.deepEqual(Object.keys(ru['mark-count']).sort(), ['few', 'many', 'one', 'other']);
  assert.equal(ru['mark-count'].many, '{n} событий');
  assert.ok(en['mark-present'] && ru['mark-present']);
});

test('both grids draw the mark, hidden from a screen reader', () => {
  const template = read('src/smart/input-date/js/templates/default.js');
  assert.match(template, /export function renderDayMark\(mark\) \{\s*if \(!mark\) return nothing;/u);
  assert.ok(template.includes("mark.text ? 'sf-datepicker-day-mark--count' : 'sf-datepicker-day-mark--dot')} aria-hidden=\"true\">"));
  assert.ok(template.includes('<span class="sf-datepicker-day-date">${day.day}</span>${renderDayMark(day.mark)}'));
  const ribbon = read('src/smart/input-date/js/templates/ribbon.js');
  assert.ok(ribbon.includes("import {renderDayMark} from './default.js';"));
  assert.ok(ribbon.includes('<span class="sf-datepicker-day-date">${day.day}</span>${renderDayMark(day.mark)}'));
});

test('the mark stands in the row under the number: a 6 px dot (C132), the smallest text, state inks', () => {
  const day = read('src/component/datepicker/scss/_css_day.scss');
  assert.ok(day.includes('--sf-datepicker-day-mark--size: #{size.small-step(6)};'));
  assert.ok(day.includes('inset-block: calc(50% + var(--sf-datepicker-day-date--line-height, var(--sf-text--height)) / 2) 0;'));
  assert.ok(day.includes('font-size: var(--sf-text-size-1\\/4);'));
  assert.ok(day.includes('line-height: var(--sf-text-height-1\\/4);'));
  for (const [tone, ink] of [['error', '--sf-error'], ['warning', '--sf-warning'], ['success', '--sf-success'], ['tertiary', '--sf-tertiary'], ['neutral', '--sf-on-surface-variant']]) {
    assert.ok(day.includes(`.sf-datepicker-day > .sf-datepicker-day-mark--${tone} {\n    --sf-datepicker-day-mark--color: var(${ink});`), tone);
  }
  const overrides = day.slice(day.indexOf('@layer sf.overrides'));
  assert.ok(overrides.includes('--sf-datepicker-day-mark--color: var(--sf-datepicker-selected-color, var(--sf-on-primary));'));
  assert.ok(overrides.includes('--sf-datepicker-day-mark--color: var(--sf-on-primary-container);'));
  assert.ok(overrides.includes('--sf-datepicker-day-mark--color: var(--sf-on-surface-disabled);'));
  assert.ok(day.includes('.sf-datepicker-day.sf-datepicker-day-special:has(> .sf-datepicker-day-mark) .sf-datepicker-day-date::after {\n    content: none;'));
  // No literal sizes or colours in the mark's rules.
  const rules = day.slice(day.indexOf('  .sf-datepicker-day:has(> .sf-datepicker-day-mark)'), day.indexOf('// Paint (C273)'));
  assert.doesNotMatch(rules.replace(/\/\*[\s\S]*?\*\//gu, ''), /\d+px|#[0-9a-f]{3,6}\b|rgb\(/iu);
});

test('the example with marks prints its first frame', () => {
  const examples = JSON.parse(read('src/smart/input-date/examples.json')).examples;
  const example = examples.find((one) => one.name === 'day-marks');
  assert.ok(example, 'example day-marks');
  assert.equal(example.settings.input, false);
  assert.ok(Object.keys(example.settings['day-marks']).length >= 6);
  assert.ok(example['first-paint']);
});
