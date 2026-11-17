import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  DATE_FUTURE_PERIODS,
  DATE_PERIODS,
  buildFilterRequest,
  dateConditionValue,
  dateFilterChipText,
  dateFilterConditions,
  dateFilterKind,
  filterRequestContext,
  isEmptyFilterEntry,
  normalizeFilterEntry,
  resolveDatePeriod,
} from '../src/smart/field-renderers/date-filter.js';

// The date filter (owner decision C293, 2026-11-17; ui-control
// prototypes/date-filter-conditions-study.html, control/research/2026-11-17-date-filter).
// The browser probe field-date-filter-c293 draws the conditions on the built
// set; this holds the rules: the lists, the contract, the empty entry, the
// periods and the chip.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const keys = (list) => list.map((one) => one.key);

test('one date: grouped Date, Period, Filled; the words for dates are before and after', () => {
  const list = dateFilterConditions({key: 'paid_at', propertyType: 'date'});
  assert.deepEqual(keys(list), ['eq', 'between', 'lt', 'gt', 'gte', 'lte',
    'period:today', 'period:yesterday', 'period:this-week', 'period:last-week', 'period:last-7-days',
    'period:this-month', 'period:last-month', 'period:this-year', 'last-days', 'empty', 'not-empty']);
  assert.deepEqual([...new Set(list.map((one) => one.group))], ['date', 'period', 'filled']);
  assert.deepEqual(list.filter((one) => one.need === 'none').map((one) => one.key).slice(-2), ['empty', 'not-empty']);
  const en = JSON.parse(read('src/smart/field-renderers/lang/en.json')).runtime;
  assert.ok(!Object.values(en).some((word) => typeof word === 'string' && /greater|less than/iu.test(word)));
});

test('a deadline (filter.future) also looks forward; overdue is not a date condition', () => {
  const list = keys(dateFilterConditions({propertyType: 'date', filter: {future: true}}));
  for (const key of ['period:tomorrow', 'period:next-week', 'next-days', 'period:next-month']) assert.ok(list.includes(key), key);
  assert.ok(!list.some((key) => /overdue/u.test(key)));
  assert.ok(!keys(dateFilterConditions({propertyType: 'date'})).includes('period:tomorrow'));
});

test('a period field: overlaps, within, starts, ends, contains a day, empty, not empty', () => {
  const field = {propertyType: 'period'};
  assert.equal(dateFilterKind(field), 'period');
  assert.equal(dateFilterKind({filter: {kind: 'period'}}), 'period');
  assert.equal(dateFilterKind({propertyType: 'datetime'}), 'date');
  const list = dateFilterConditions(field);
  assert.deepEqual(keys(list), ['overlaps', 'within', 'starts', 'ends', 'contains', 'empty', 'not-empty']);
  assert.deepEqual(list.map((one) => one.need), ['when', 'when', 'when', 'when', 'day', 'none', 'none']);
});

test('a host\'s operator list narrows the conditions; the old today, week and month keep the periods', () => {
  const list = keys(dateFilterConditions({propertyType: 'date', filter: {operators: ['between', 'eq', 'gt', 'gte', 'lt', 'lte', 'today', 'week', 'month']}}));
  assert.ok(list.includes('between') && list.includes('period:this-week') && list.includes('last-days'));
  assert.ok(!list.includes('empty'));
  assert.deepEqual(keys(dateFilterConditions({propertyType: 'date', filter: {operators: ['eq', 'empty', 'not-empty']}})), ['eq', 'empty', 'not-empty']);
});

test('DF-1: an entry is read by its operator; a period and empty / not empty are whole by themselves', () => {
  assert.equal(isEmptyFilterEntry({operator: 'period', value: 'today'}), false);
  assert.equal(isEmptyFilterEntry({operator: 'empty', value: true}), false);
  assert.equal(isEmptyFilterEntry({operator: 'not-empty', value: true}), false);
  assert.equal(isEmptyFilterEntry({operator: 'today'}), false, 'the old operator is a period');
  assert.equal(isEmptyFilterEntry({operator: 'period', value: 'fortnight'}), true);
  assert.equal(isEmptyFilterEntry({operator: 'eq', value: ''}), true);
  assert.equal(isEmptyFilterEntry({operator: 'last-days', value: 30}), false);
  assert.equal(isEmptyFilterEntry({operator: 'last-days', value: 0}), true);
  assert.equal(isEmptyFilterEntry({operator: 'overlaps', value: ['2026-11-01', '2026-11-05']}), false);
  assert.equal(isEmptyFilterEntry({operator: 'overlaps', value: ['', '']}), true);
  // Any other field keeps the old reading.
  assert.equal(isEmptyFilterEntry({operator: 'contains', value: 'Анна'}), false);
  assert.equal(isEmptyFilterEntry({operator: 'in', values: []}), true);
  assert.equal(isEmptyFilterEntry({operator: 'between', value: ['1', '']}), false);
});

test('DF-2: a condition starts with its own value; a stale day never travels with a period', () => {
  const list = dateFilterConditions({propertyType: 'date'});
  const one = (key) => list.find((item) => item.key === key);
  assert.equal(dateConditionValue(one('period:this-week'), {value: '2026-11-10'}), 'this-week');
  assert.equal(dateConditionValue(one('empty'), {value: '2026-11-10'}), true);
  assert.equal(dateConditionValue(one('gt'), {value: '2026-11-10'}), '2026-11-10', 'a day stays a day');
  assert.equal(dateConditionValue(one('between'), {value: '2026-11-10'}), null);
  assert.equal(dateConditionValue(one('eq'), {value: 'this-week'}), null);
  assert.equal(dateConditionValue(one('last-days'), {value: 'today'}), 30);
});

test('the contract: one {operator, value} per field, the old operators as periods, the request context', () => {
  const request = buildFilterRequest({
    paid_at: {operator: 'week'},
    created_at: {operator: 'last-days', value: 30},
    stay: {operator: 'within', value: 'this-month'},
    note: {operator: 'eq', value: ''},
  }, {context: {timeZone: 'Europe/Moscow', weekStart: 1}});
  assert.deepEqual(request, {
    values: {
      paid_at: {operator: 'period', value: 'this-week'},
      created_at: {operator: 'last-days', value: 30},
      stay: {operator: 'within', value: 'this-month'},
    },
    context: {timeZone: 'Europe/Moscow', weekStart: 1},
  });
  assert.deepEqual(normalizeFilterEntry({operator: 'month', value: '2026-11-10'}), {operator: 'period', value: 'this-month'});
  const context = filterRequestContext(null);
  assert.equal(typeof context.timeZone, 'string');
  assert.ok(context.timeZone.length > 0);
  assert.ok(Number.isInteger(context.weekStart) && context.weekStart >= 0 && context.weekStart <= 6);
  assert.equal(filterRequestContext(null, {weekStart: 7}).weekStart, 0);
});

test('DF-5: the periods are whole calendar periods; last 7 days is today and the six before', () => {
  const at = {today: '2026-11-17', weekStart: 1};
  const expected = {
    today: ['2026-11-17', '2026-11-17'],
    yesterday: ['2026-11-16', '2026-11-16'],
    'this-week': ['2026-11-16', '2026-11-22'],
    'last-week': ['2026-11-09', '2026-11-15'],
    'last-7-days': ['2026-11-11', '2026-11-17'],
    'this-month': ['2026-11-01', '2026-11-30'],
    'last-month': ['2026-10-01', '2026-10-31'],
    'this-year': ['2026-01-01', '2026-12-31'],
    tomorrow: ['2026-11-18', '2026-11-18'],
    'next-week': ['2026-11-23', '2026-11-29'],
    'next-month': ['2026-12-01', '2026-12-31'],
  };
  assert.deepEqual([...DATE_PERIODS, ...DATE_FUTURE_PERIODS].sort(), Object.keys(expected).sort());
  for (const [name, days] of Object.entries(expected)) assert.deepEqual(resolveDatePeriod(name, at), days, name);
  assert.deepEqual(resolveDatePeriod('this-week', {today: '2026-11-17', weekStart: 0}), ['2026-11-15', '2026-11-21']);
  assert.deepEqual(resolveDatePeriod('last-month', {today: '2026-01-10'}), ['2025-12-01', '2025-12-31']);
  const picker = read('src/smart/input-date/index.js');
  assert.match(picker, /case 'this-week': return \[weekFirst, addDays\(weekFirst, 6\)\];/u);
  assert.match(picker, /case 'this-month': return \[new Date\(day\.getFullYear\(\), day\.getMonth\(\), 1\), new Date\(day\.getFullYear\(\), day\.getMonth\(\) \+ 1, 0\)\];/u);
  for (const id of ['last-week', 'this-year', 'tomorrow', 'next-week', 'next-month']) assert.ok(picker.includes(`'${id}'`), id);
});

test('DF-4: the chip says the condition in words', () => {
  const field = {key: 'paid_at', label: 'Paid'};
  const year = String(new Date().getFullYear());
  assert.equal(dateFilterChipText(field, {operator: 'period', value: 'last-month'}), 'Paid: last month');
  assert.equal(dateFilterChipText(field, {operator: 'lt', value: `${year}-11-17`}), 'Paid: before November 17');
  assert.equal(dateFilterChipText(field, {operator: 'last-days', value: 30}), 'Paid: in the last 30 days');
  assert.equal(dateFilterChipText(field, {operator: 'empty', value: true}), 'Paid: empty');
  assert.equal(dateFilterChipText({label: 'Stay', propertyType: 'period'}, {operator: 'overlaps', value: 'this-week'}), 'Stay: runs this week');
  assert.equal(dateFilterChipText(field, {operator: 'unknown'}), 'Paid');
  const ru = JSON.parse(read('src/smart/field-renderers/lang/ru.json')).runtime;
  assert.equal(ru.datePeriodIn_lastMonth, 'в прошлом месяце');
  assert.equal(ru.dateChip, '{field}: {condition}');
});

test('the renderer: a condition list then only what it needs; a quick range in «Между» becomes that period', () => {
  const set = read('src/smart/field-renderers/index.js');
  const start = set.indexOf('function renderDateRangeValue(');
  const range = set.slice(start, set.indexOf('\nfunction ', start + 10));
  assert.ok(range.includes("current.operator === 'between' ? {operator: 'period', value: preset}"));
  assert.ok(set.includes("period: renderDateFilterControl,"));
  assert.ok(set.includes('dateFilter: {'));
  // DF-8: the calendar's markup carries no utility names.
  for (const file of ['src/smart/input-date/js/templates/default.js', 'src/smart/input-date/js/templates/ribbon.js']) {
    const markup = read(file);
    assert.ok(!/class="(?:[^"]*\s)?(?:grid|grid-col-\d|flex|inline-flex|absolute|relative)(?:\s[^"]*)?"/u.test(markup), file);
    assert.ok(!markup.includes('grid grid-col-7'), file);
  }
  const sheet = read('src/component/datepicker/scss/_css_datepicker.scss');
  assert.match(sheet, /\.sf-datepicker \.sf-datepicker-grid,\n {2}\.sf-datepicker \.sf-datepicker-weekdays \{\n {4}display: grid;\n {4}grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/u);
});
