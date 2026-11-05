import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import Format, {
  calendarDayOffset,
  fileSizeUnits,
  formatDate,
  formatFileSize,
  formatLocale,
  formatNumber,
  formatRelativeDay,
  formatRelativeTime,
  msUntilNextDay,
  numberOptions,
  publishFormat,
} from '../src/core/js/format.js';
import {formatFileSize as compositionFileSize} from '../src/core/js/composition/file-size.mjs';
import * as PureDate from '../src/core/js/format-date.js';
import * as PureFileSize from '../src/core/js/format-file-size.js';
import * as PureIntl from '../src/core/js/format-intl.js';
import * as PureNumber from '../src/core/js/format-number.js';
import * as PureRelative from '../src/core/js/format-relative.js';

// The core format module (reuse audit 2026-11-02, finding 7): one rule for
// dates, days, numbers and file sizes, in the page's language. Intl puts a
// no-break space (U+00A0, U+202F) where a page shows a space; the tests read
// them as spaces.
const plain = (text) => String(text).replace(/[  ]/gu, ' ');

test('the locale is the one named, else the page language of the node', () => {
  assert.equal(formatLocale({locale: 'ru-RU'}), 'ru-RU');
  // No document, no node: the page language rule ends in English.
  assert.equal(formatLocale({}), 'en');
  const node = {closest: () => ({getAttribute: () => 'ru'}), getRootNode: () => null};
  assert.equal(formatLocale({node}), 'ru');
});

test('dates: short, medium, long and with a time, in two languages', () => {
  const at = new Date(2026, 10, 3, 14, 5);
  assert.equal(plain(formatDate(at, {locale: 'ru'})), '3 нояб. 2026 г.');
  assert.equal(plain(formatDate(at, {locale: 'en'})), 'Nov 3, 2026');
  assert.equal(formatDate(at, {locale: 'ru', date: 'short'}), '03.11.2026');
  assert.equal(formatDate(at, {locale: 'en', date: 'short'}), '11/3/26');
  assert.equal(plain(formatDate(at, {locale: 'ru', date: 'long'})), '3 ноября 2026 г.');
  assert.equal(formatDate(at, {locale: 'en', date: 'long'}), 'November 3, 2026');
  assert.match(plain(formatDate(at, {locale: 'ru', date: 'long', time: 'short'})), /^3 ноября 2026 г\.,? (в )?14:05$/u);
  assert.equal(formatDate(at, {locale: 'ru', date: null, time: 'short'}), '14:05');
  assert.equal(plain(formatDate(at, {locale: 'en', date: null, time: 'short'})), '2:05 PM');
  assert.equal(formatDate(at, {locale: 'en', intl: {hour: '2-digit', minute: '2-digit', hour12: false}}), '14:05');
  assert.equal(formatDate(at.getTime(), {locale: 'en'}), formatDate(at, {locale: 'en'}), 'a time in milliseconds is a date');
  assert.equal(formatDate('not a date', {locale: 'en'}), '');
  assert.equal(formatDate(null, {locale: 'en', gap: '—'}), '—');
});

test('relative days around midnight, with a fixed clock', () => {
  const justAfter = new Date(2026, 10, 3, 0, 0, 30); // Tuesday
  const justBefore = new Date(2026, 10, 2, 23, 59, 59); // Monday
  const cases = [
    // [moment, now, ru, en]
    [new Date(2026, 10, 3, 0, 0, 0), justAfter, 'сегодня', 'today'],
    [new Date(2026, 10, 2, 23, 59, 59), justAfter, 'вчера', 'yesterday'],
    [new Date(2026, 10, 2, 23, 59, 59), justBefore, 'сегодня', 'today'],
    [new Date(2026, 10, 3, 0, 0, 0), justBefore, 'завтра', 'tomorrow'],
    [new Date(2026, 9, 30, 12), justAfter, 'пятница', 'Friday'],
    [new Date(2026, 9, 28, 12), justAfter, 'среда', 'Wednesday'],
    // Seven days back is the date, not the weekday it shares with today.
    [new Date(2026, 9, 27, 12), justAfter, '27 октября', 'October 27'],
    [new Date(2025, 0, 5), justAfter, '5 января 2025 г.', 'January 5, 2025'],
  ];
  for (const [moment, now, ru, en] of cases) {
    assert.equal(plain(formatRelativeDay(moment, {now, locale: 'ru'})), ru, `${moment} ru`);
    assert.equal(plain(formatRelativeDay(moment, {now, locale: 'en'})), en, `${moment} en`);
  }
  assert.equal(formatRelativeDay(new Date(2026, 9, 30), {now: justAfter, locale: 'ru', weekday: false}), '30 октября');
  assert.equal(formatRelativeDay(new Date(2026, 10, 2), {now: justAfter, locale: 'ru', capital: true}), 'Вчера');
  assert.equal(formatRelativeDay(new Date(2026, 10, 3), {now: justAfter, locale: 'ru', today: 'Сегодня'}), 'Сегодня', 'a component\'s own word wins');
  assert.equal(formatRelativeDay('', {now: justAfter, locale: 'ru'}), '');

  assert.equal(calendarDayOffset(new Date(2026, 10, 2, 23, 59), {now: justAfter}), -1);
  assert.equal(calendarDayOffset(new Date(2026, 10, 3, 23, 59), {now: justAfter}), 0);
  // A day of a clock change is still one day (counted on dates, not hours).
  assert.equal(calendarDayOffset(new Date(2026, 2, 30, 12), {now: new Date(2026, 2, 29, 12)}), 1);
  assert.ok(Number.isNaN(calendarDayOffset('x')));
});

test('the next day change is the reader\'s next midnight', () => {
  assert.equal(msUntilNextDay(new Date(2026, 10, 3, 23, 59, 59, 0)), 1000);
  assert.equal(msUntilNextDay(new Date(2026, 10, 3, 0, 0, 30)), 86400000 - 30000);
  const now = new Date(2026, 10, 3, 18, 0);
  const after = new Date(now.getTime() + msUntilNextDay(now));
  assert.equal(after.getHours(), 0);
  assert.equal(calendarDayOffset(after, {now}), 1);
});

test('relative times from a fixed clock', () => {
  const now = new Date(2026, 10, 3, 12, 0, 0);
  assert.equal(formatRelativeTime(new Date(now.getTime() - 5 * 60000), {now, locale: 'ru'}), '5 минут назад');
  assert.equal(formatRelativeTime(new Date(now.getTime() - 5 * 60000), {now, locale: 'en'}), '5 minutes ago');
  assert.equal(formatRelativeTime(new Date(now.getTime() + 2 * 3600000), {now, locale: 'en'}), 'in 2 hours');
  assert.equal(formatRelativeTime(new Date(now.getTime() - 86400000), {now, locale: 'ru'}), 'вчера');
  assert.equal(formatRelativeTime(null, {now, locale: 'en'}), '');
});

test('numbers: integer, decimal, percent, compact, currency, in two languages', () => {
  const both = (value, format, ru, en, options = {}) => {
    assert.equal(plain(formatNumber(value, format, {...options, locale: 'ru'})), ru, `${format} ru`);
    assert.equal(plain(formatNumber(value, format, {...options, locale: 'en'})), en, `${format} en`);
  };
  both(1234.5, 'number', '1 234,5', '1,234.5');
  both(1234.5, 'integer', '1 235', '1,235');
  both(1234.5, 'decimal-2', '1 234,50', '1,234.50');
  both(0.123, 'percent', '12,3 %', '12.3%');
  both(1234, 'compact', '1,2 тыс.', '1.2K');
  both(1234.5, 'currency-RUB', '1 234,50 ₽', 'RUB 1,234.50');
  both(2026, 'integer', '2026', '2026', {grouping: false});
  both(0.125, 'number', '0,125', '0.125', {step: 0.005});
  assert.equal(formatNumber(Number.NaN, 'number', {locale: 'en'}), '');
  assert.equal(formatNumber(null, 'number', {locale: 'en', gap: '—'}), '—');
  assert.equal(formatNumber('12', 'integer', {locale: 'en'}), '12', 'numeric text is a number');
  assert.equal(formatNumber(5, 'currency-xyz', {locale: 'en'}), '5', 'an unknown word is number');
  assert.deepEqual(numberOptions('decimal-12'), {minimumFractionDigits: 12, maximumFractionDigits: 12});
  assert.deepEqual(numberOptions('unit-gigabyte'), {style: 'unit', unit: 'gigabyte', unitDisplay: 'short', maximumFractionDigits: 1});
});

test('file sizes at the unit boundaries, in two languages', () => {
  const ru = (bytes) => plain(formatFileSize(bytes, {locale: 'ru'}));
  const en = (bytes) => plain(formatFileSize(bytes, {locale: 'en'}));
  assert.equal(ru(0), '0 Б');
  assert.equal(ru(1023), '1 023 Б');
  assert.equal(ru(1024), '1 КБ');
  assert.equal(ru(1536), '1,5 КБ');
  assert.equal(ru(10 * 1024), '10 КБ');
  assert.equal(ru(1024 * 1024 - 1), '1 024 КБ');
  assert.equal(ru(1024 * 1024), '1 МБ');
  assert.equal(ru(1468006), '1,4 МБ');
  assert.equal(ru(3 * 1024 ** 3), '3 ГБ');
  assert.equal(ru(2 * 1024 ** 4), '2 048 ГБ', 'GB is the last unit');
  assert.equal(en(1023), '1,023 B');
  assert.equal(en(1536), '1.5 KB');
  assert.equal(en(1468006), '1.4 MB');
  assert.equal(formatFileSize('2 KB'), '2 KB', 'text the host formatted is kept');
  assert.equal(formatFileSize(null), '');
  assert.equal(formatFileSize(-1), '');
  assert.equal(formatFileSize(2048, {locale: 'de', units: ['b', 'kb', 'mb', 'gb']}), '2 kb', 'a component\'s own words');
  assert.deepEqual(fileSizeUnits('pt-BR'), ['B', 'KB', 'MB', 'GB']);
  // The positional form composition/file-size.mjs published reads as before.
  assert.equal(plain(compositionFileSize(1468006, ['Б', 'КБ', 'МБ', 'ГБ'], 'ru')), '1,4 МБ');
});

test('the format modules have no side effect on load; core publishes SF.format', () => {
  // Importing format.js (above) published nothing: only core's entry does.
  assert.equal(globalThis.SF?.format, undefined);
  assert.match(readFileSync(new URL('../src/core/js/index.js', import.meta.url), 'utf8'), /^publishFormat\(\);$/mu);
  const page = {};
  assert.equal(publishFormat(page), Format);
  assert.equal(page.SF.format, Format);
  // A Format already published stays (a second copy never replaces it).
  const other = {SF: {format: {own: true}}};
  assert.deepEqual(publishFormat(other), {own: true});
  assert.deepEqual(Object.keys(Format).sort(), ['date', 'dayOffset', 'fileSize', 'locale', 'msUntilNextDay', 'number', 'numberOptions', 'relativeDay', 'relativeTime']);
  // The formatters live on a global every copy of the modules shares.
  assert.ok(globalThis.__sfFormat?.formatters instanceof Map);
});

test('the helpers alone, from modules of their own, are the same functions', () => {
  assert.equal(formatNumber, PureNumber.formatNumber);
  assert.equal(numberOptions, PureNumber.numberOptions);
  assert.equal(formatDate, PureDate.formatDate);
  assert.equal(calendarDayOffset, PureDate.calendarDayOffset);
  assert.equal(msUntilNextDay, PureDate.msUntilNextDay);
  assert.equal(formatRelativeDay, PureRelative.formatRelativeDay);
  assert.equal(formatRelativeTime, PureRelative.formatRelativeTime);
  assert.equal(formatFileSize, PureFileSize.formatFileSize);
  assert.equal(fileSizeUnits, PureFileSize.fileSizeUnits);
  assert.equal(formatLocale, PureIntl.formatLocale);
  assert.equal(compositionFileSize, PureFileSize.formatFileSize);
});

test('no format module has a top-level statement a bundler must keep', () => {
  // What a bundle keeps of a module it imports one function from (ui-chart,
  // 2026-11-05): the module's top-level statements that are not declarations.
  // Only imports, exports, function declarations, literal constants and
  // calls annotated pure may stand at the top of these modules.
  for (const name of ['format.js', 'format-intl.js', 'format-number.js', 'format-date.js', 'format-relative.js', 'format-file-size.js']) {
    const source = readFileSync(new URL(`../src/core/js/${name}`, import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gmu, (comment) => (comment.includes('@__PURE__') ? comment : ''));
    for (const line of code.split('\n')) {
      if (!line.trim() || /^\s/u.test(line) || /^[})\]]/u.test(line)) continue;
      assert.match(line, /^(?:import |export (?:\{|default Format;|function |const [A-Z_a-z]+ = (?:\/\* @__PURE__ \*\/ |\[))|export \{|function |const [A-Z_a-z]+ = (?:\/\* @__PURE__ \*\/ |\[|\d))/u, `${name}: ${line}`);
    }
  }
});
