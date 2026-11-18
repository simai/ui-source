// The date filter's conditions, its server contract and its words (owner
// decision C293, 2026-11-17; study ui-control
// prototypes/date-filter-conditions-study.html, notes
// control/research/2026-11-17-date-filter/README.md).
//
// A field holds one date (a date, or a date and time) or a period (a start and
// an end). The filter is a condition first and then exactly what the condition
// needs: nothing, one day, two days, a number of days, or -- for a period
// field -- a period by name or two days. One condition per field travels to the
// server as {operator, value}:
//
//   one date    eq, lt, gt, gte, lte          value: "yyyy-mm-dd"
//               between                       value: ["yyyy-mm-dd", "yyyy-mm-dd"], both days in
//               period                        value: a period's name (DATE_PERIODS)
//               last-days, next-days          value: a whole number of days, today counted
//   a period    overlaps, within, starts, ends   value: a period's name or two days
//               contains                      value: "yyyy-mm-dd"
//   both        empty, not-empty              value: true
//   a time      eq, lt, gt                    value: "hh:mm" (catalogue step 4)
//               between                       value: ["hh:mm", "hh:mm"], both ends in
//               empty, not-empty              value: true
//
// The request carries the context the server resolves the periods in,
// {timeZone, weekStart} (weekStart 0 Sunday .. 6 Saturday, as Date#getDay
// counts): «this week» is the server's to work out, by name, so a saved view
// stays «this week» and the browser's clock is not trusted. A date and time is
// compared by its day in that time zone.
//
// The operators today, week and month (fix/date-pd) are read as the periods
// today, this-week and this-month until 2027-01-01 (contracts/changes/journal.json
// value-date-filter-period-operators).
//
// No DOM here and no Lit: the table, a record view and a server-side test read
// the same rules.
import {pageLocale, pageWord} from '../../core/js/page-language.js';
import {noteDeprecated} from '../../core/js/deprecations.js';
import {localeWeekStart} from '../input-date/js/locale-calendar.js';
import LANG_WORDS from './lang/index.mjs';
import {TIME_FILTER_OPERATORS} from './registry.js';

const SET_NAME = 'sf-field-renderers';

// Whole calendar periods (this week is Monday to Sunday where the week starts
// on Monday, this month to its last day, this year to 31 December) and the
// rolling «last 7 days», today and the six days before it.
export const DATE_PERIODS = Object.freeze(['today', 'yesterday', 'this-week', 'last-week', 'last-7-days',
    'this-month', 'last-month', 'this-year']);
// A deadline field (filter.future: true) also looks forward. «Overdue» is not
// a date condition: it depends on the record's status.
export const DATE_FUTURE_PERIODS = Object.freeze(['tomorrow', 'next-week', 'next-month']);

export const LEGACY_DATE_OPERATORS = Object.freeze({today: 'today', week: 'this-week', month: 'this-month'});
export const LEGACY_DATE_OPERATORS_UNTIL = '2027-01-01';

// What a condition needs: none | day | days | count | when (a period's name or
// two days).
const DAY_OPERATORS = ['eq', 'lt', 'gt', 'gte', 'lte'];
const PERIOD_FIELD_OPERATORS = ['overlaps', 'within', 'starts', 'ends'];

function condition(operator, need, group, period = '', extra = {}) {
    return Object.freeze({key: period ? `period:${period}` : operator, operator, need, group, ...(period ? {period} : {}), ...extra});
}

function singleConditions(future) {
    return [
        condition('eq', 'day', 'date'),
        condition('between', 'days', 'date'),
        condition('lt', 'day', 'date'),
        condition('gt', 'day', 'date'),
        condition('gte', 'day', 'date'),
        condition('lte', 'day', 'date'),
        ...DATE_PERIODS.map((name) => condition('period', 'none', 'period', name)),
        condition('last-days', 'count', 'period'),
        ...(future ? [
            condition('period', 'none', 'period', 'tomorrow'),
            condition('period', 'none', 'period', 'next-week'),
            condition('next-days', 'count', 'period'),
            condition('period', 'none', 'period', 'next-month'),
        ] : []),
        condition('empty', 'none', 'filled'),
        condition('not-empty', 'none', 'filled'),
    ];
}

function periodFieldConditions() {
    return [
        ...PERIOD_FIELD_OPERATORS.map((operator) => condition(operator, 'when', 'range')),
        condition('contains', 'day', 'range'),
        condition('empty', 'none', 'filled'),
        condition('not-empty', 'none', 'filled'),
    ];
}

// A time of day (catalogue step 4; it was searched as text): one time, two
// (both ends in), earlier, later, empty, not empty. A time has no zone and no
// week: the request's context does not change it.
const TIME_NEEDS = {eq: 'time', between: 'times', lt: 'time', gt: 'time', empty: 'none', 'not-empty': 'none'};

function timeConditions() {
    return TIME_FILTER_OPERATORS.map((operator) => condition(operator, TIME_NEEDS[operator],
        TIME_NEEDS[operator] === 'none' ? 'filled' : 'time', '', {time: true}));
}

// A field is a period when it says so: its property type or control is
// `period`, or its filter's kind is; a time of day when its type or control
// is `time`. Every other date field holds one date.
export function dateFilterKind(field = {}) {
    const asked = [field.filter?.kind, field.filter?.control, field.propertyType, field.type];
    if (asked.includes('period')) return 'period';
    return [field.filter?.kind, field.filter?.control, field.propertyType || field.type].includes('time') ? 'time' : 'date';
}

function isDueField(field = {}) {
    return field.filter?.future === true || field.future === true;
}

// The conditions the field's filter offers, in the order of the list. A host's
// filter.operators narrows them: an operator it names stays, `period` keeps
// every period, and the old today, week and month keep every period and «last
// N days» (they were the list's periods).
export function dateFilterConditions(field = {}) {
    const kind = dateFilterKind(field);
    const all = kind === 'period' ? periodFieldConditions() : kind === 'time' ? timeConditions() : singleConditions(isDueField(field));
    const asked = field.filter?.operators;
    if (!Array.isArray(asked) || !asked.length) return all;
    const names = new Set();
    for (const operator of asked) {
        const name = String(operator);
        if (LEGACY_DATE_OPERATORS[name]) {
            names.add('period');
            names.add('last-days');
            names.add('next-days');
        } else names.add(name);
    }
    const kept = all.filter((one) => names.has(one.operator));
    return kept.length ? kept : all;
}

function isDay(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function dayOf(value) {
    if (typeof value !== 'string') return '';
    const day = value.slice(0, 10);
    return isDay(day) ? day : '';
}

const TIME_TEXT_RE = /^([01]\d|2[0-3]):[0-5]\d$/u;

function timeOf(value) {
    if (typeof value !== 'string') return '';
    const time = value.trim().slice(0, 5);
    return TIME_TEXT_RE.test(time) ? time : '';
}

function isTwoTimes(value) {
    return Array.isArray(value) && value.length === 2 && Boolean(timeOf(value[0])) && Boolean(timeOf(value[1]));
}

function isTwoDays(value) {
    return Array.isArray(value) && value.length === 2 && isDay(dayOf(value[0])) && isDay(dayOf(value[1]));
}

function isPeriodName(value) {
    return typeof value === 'string' && (DATE_PERIODS.includes(value) || DATE_FUTURE_PERIODS.includes(value));
}

function isCount(value) {
    const number = Number(value);
    return value !== '' && value !== null && value !== true && Number.isInteger(number) && number > 0;
}

// The old operators as the new periods, noted once per page in
// SF.deprecations until LEGACY_DATE_OPERATORS_UNTIL.
export function normalizeFilterEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const period = LEGACY_DATE_OPERATORS[entry.operator];
    if (!period) return entry;
    noteDeprecated({component: SET_NAME, kind: 'value', attribute: 'filter operator', from: entry.operator,
        to: `period ${period}`, since: '2026-11-17', remove_after: LEGACY_DATE_OPERATORS_UNTIL});
    return {...entry, operator: 'period', value: period};
}

function isBlank(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.every(isBlank);
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'object') return Object.values(value).every(isBlank);
    return false;
}

// Whether a filter entry says nothing yet, so the table drops it with its
// chip. It reads the operator (DF-1): a period, «empty» and «not empty» are
// whole by themselves, and a condition that needs a day is empty without one.
// An entry of any other field keeps the old reading: empty when its value or
// values are.
export function isEmptyFilterEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return isBlank(entry);
    const one = LEGACY_DATE_OPERATORS[entry.operator] ? normalizeFilterEntry(entry) : entry;
    const {operator, value} = one;
    switch (operator) {
        case 'empty':
        case 'not-empty':
            return false;
        case 'period':
            return !isPeriodName(value);
        case 'last-days':
        case 'next-days':
            return !isCount(value);
        case 'overlaps':
        case 'within':
        case 'starts':
        case 'ends':
            return !(isPeriodName(value) || isTwoDays(value));
        default:
            break;
    }
    if (Object.prototype.hasOwnProperty.call(one, 'values')) return isBlank(one.values);
    if (Object.prototype.hasOwnProperty.call(one, 'value')) return isBlank(one.value);
    return Object.entries(one).filter(([key]) => !['operator', 'control', 'type'].includes(key)).every(([, item]) => isBlank(item));
}

// The value a condition starts with when it is chosen: the stale day of the
// condition before is not carried into a period (DF-2), but a day stays a day
// and two days stay two days.
export function dateConditionValue(next, previous = {}) {
    const before = previous?.value;
    switch (next.need) {
        case 'none':
            return next.period || true;
        case 'day':
            return isDay(dayOf(before)) ? dayOf(before) : null;
        case 'days':
            return isTwoDays(before) ? before.map(dayOf) : null;
        case 'count':
            return isCount(before) ? Number(before) : 30;
        case 'when':
            return isPeriodName(before) || isTwoDays(before) ? before : 'this-week';
        case 'time':
            return timeOf(before) || (Array.isArray(before) ? timeOf(before[0]) || null : null);
        case 'times':
            return isTwoTimes(before) ? before.map(timeOf) : timeOf(before) ? [timeOf(before), ''] : ['', ''];
        default:
            return null;
    }
}

// The condition an entry stands for, in the field's list.
export function dateConditionOf(field, entry) {
    const list = dateFilterConditions(field);
    const one = normalizeFilterEntry(entry || {});
    if (one?.operator === 'period') return list.find((item) => item.period === one.value) ?? null;
    return list.find((item) => item.operator === one?.operator) ?? null;
}

// The context a request carries: the time zone and the first day of the week
// the server resolves the periods in. A host that knows the person's own
// (monday.com takes them from the profile) passes them; otherwise the
// browser's zone and the page language's week.
export function filterRequestContext(node = null, {timeZone, weekStart} = {}) {
    let zone = typeof timeZone === 'string' && timeZone ? timeZone : '';
    if (!zone) {
        try {
            zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            zone = 'UTC';
        }
    }
    const start = Number.isInteger(weekStart) && weekStart >= 0 && weekStart <= 7
        ? weekStart % 7
        : localeWeekStart(pageLocale(node));
    return {timeZone: zone, weekStart: start};
}

// A filter's values as the server is asked for them: the old operators read as
// periods, empty entries left out, and the context beside them.
export function buildFilterRequest(values = {}, {node = null, context} = {}) {
    const out = {};
    for (const [key, entry] of Object.entries(values || {})) {
        if (isEmptyFilterEntry(entry)) continue;
        out[key] = normalizeFilterEntry(entry);
    }
    return {values: out, context: filterRequestContext(node, context || {})};
}

// A period's first and last day for a given today, as the server is asked to
// resolve it (a reference for a host's server and for the tests). `today` is
// yyyy-mm-dd in the request's time zone.
export function resolveDatePeriod(name, {today, weekStart = 1} = {}) {
    if (!isDay(today)) return null;
    const [y, m, d] = today.split('-').map(Number);
    const at = (year, month, day) => {
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toISOString().slice(0, 10);
    };
    const shift = (days) => at(y, m, d + days);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const back = (dow - (weekStart % 7) + 7) % 7;
    switch (name) {
        case 'today': return [today, today];
        case 'yesterday': return [shift(-1), shift(-1)];
        case 'tomorrow': return [shift(1), shift(1)];
        case 'this-week': return [shift(-back), shift(6 - back)];
        case 'last-week': return [shift(-back - 7), shift(-back - 1)];
        case 'next-week': return [shift(7 - back), shift(13 - back)];
        case 'last-7-days': return [shift(-6), today];
        case 'this-month': return [at(y, m, 1), at(y, m + 1, 0)];
        case 'last-month': return [at(y, m - 1, 1), at(y, m, 0)];
        case 'next-month': return [at(y, m + 1, 1), at(y, m + 2, 0)];
        case 'this-year': return [at(y, 1, 1), at(y, 12, 31)];
        default: return null;
    }
}

// ---- Words ----

const camel = (text) => String(text).replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());

function word(node, key, vars, count) {
    return pageWord(LANG_WORDS, key, node, {component: SET_NAME, vars, count});
}

// A condition's name in the list: «Точная дата», «Прошлый месяц», «Пусто».
export function dateConditionLabel(node, item) {
    if (!item) return '';
    if (item.period) return word(node, `datePeriod_${camel(item.period)}`);
    if (item.time && item.operator === 'eq') return word(node, 'timeCondition_eq');
    return word(node, `dateCondition_${camel(item.operator)}`);
}

export function dateGroupLabel(node, group) {
    return word(node, `dateGroup_${group}`);
}

function currentYear(timeZone) {
    try {
        return new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric'}).format(new Date());
    } catch {
        return String(new Date().getFullYear());
    }
}

function dayDate(day) {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
}

// A day as the chip says it: «17 ноября», «20 января 2025» -- the year only when
// it is not this year.
function dayText(node, day, timeZone) {
    if (!isDay(day)) return '…';
    const withYear = day.slice(0, 4) !== currentYear(timeZone);
    try {
        return new Intl.DateTimeFormat(pageLocale(node), {day: 'numeric', month: 'long', ...(withYear ? {year: 'numeric'} : {}), timeZone: 'UTC'})
            .format(dayDate(day));
    } catch {
        return day;
    }
}

// Two days as one span: «1–15 ноября», «28 октября – 3 ноября».
function spanText(node, from, to, timeZone) {
    const a = dayOf(from);
    const b = dayOf(to);
    if (!isDay(a) || !isDay(b)) return dayText(node, a || b, timeZone);
    if (a === b) return dayText(node, a, timeZone);
    const year = currentYear(timeZone);
    const withYear = a.slice(0, 4) !== year || b.slice(0, 4) !== year;
    try {
        const format = new Intl.DateTimeFormat(pageLocale(node), {day: 'numeric', month: 'long', ...(withYear ? {year: 'numeric'} : {}), timeZone: 'UTC'});
        return format.formatRange(dayDate(a), dayDate(b));
    } catch {
        return `${dayText(node, a, timeZone)} – ${dayText(node, b, timeZone)}`;
    }
}

function periodPhrase(node, name) {
    return word(node, `datePeriodIn_${camel(name)}`);
}

// A time as the chip says it, in the page's language: «10:30», «10:30 AM».
function timeText(node, value) {
    const time = timeOf(value);
    if (!time) return '…';
    const [h, m] = time.split(':').map(Number);
    try {
        return new Intl.DateTimeFormat(pageLocale(node), {hour: 'numeric', minute: '2-digit', timeZone: 'UTC'})
            .format(new Date(Date.UTC(2000, 0, 1, h, m)));
    } catch {
        return time;
    }
}

function timePhrase(node, {operator, value}) {
    switch (operator) {
        case 'eq': return timeText(node, value);
        case 'between': return Array.isArray(value) ? `${timeText(node, value[0])}\u2013${timeText(node, value[1])}` : '…';
        case 'lt':
        case 'gt': return word(node, `dateChip_${operator}`, {date: timeText(node, value)});
        case 'empty':
        case 'not-empty': return word(node, `dateChip_${camel(operator)}`);
        default: return '';
    }
}

// What a condition says after the field's name on its chip: «в прошлом
// месяце», «не позже 17 ноября», «идёт на этой неделе», «пусто» (DF-4); for
// a time «10:00–18:00», «раньше 10:30».
export function dateConditionPhrase(field, entry, node = null, {timeZone} = {}) {
    if (dateFilterKind(field) === 'time') return timePhrase(node, entry || {});
    const one = normalizeFilterEntry(entry || {});
    const zone = timeZone || filterRequestContext(node).timeZone;
    const {operator, value} = one || {};
    const when = () => (isPeriodName(value) ? periodPhrase(node, value) : isTwoDays(value) ? spanText(node, value[0], value[1], zone) : '…');
    switch (operator) {
        case 'eq': return dayText(node, dayOf(value), zone);
        case 'between': return Array.isArray(value) ? spanText(node, value[0], value[1], zone) : '…';
        case 'lt':
        case 'gt':
        case 'gte':
        case 'lte': return word(node, `dateChip_${operator}`, {date: dayText(node, dayOf(value), zone)});
        case 'period': return isPeriodName(value) ? periodPhrase(node, value) : '…';
        case 'last-days':
        case 'next-days': return word(node, `dateChip_${camel(operator)}`, undefined, isCount(value) ? Number(value) : 0);
        case 'empty':
        case 'not-empty': return word(node, `dateChip_${camel(operator)}`);
        case 'overlaps':
        case 'starts':
        case 'ends': return word(node, `dateChip_${operator}`, {when: when()});
        case 'within': return isPeriodName(value)
            ? word(node, 'dateChip_within', {when: when()})
            : word(node, 'dateChip_withinDays', {when: when()});
        case 'contains': return word(node, 'dateChip_contains', {date: dayText(node, dayOf(value), zone)});
        default: return '';
    }
}

// The chip of a date filter: «Дата оплаты: в прошлом месяце». A condition the
// set does not know keeps the field's name alone.
export function dateFilterChipText(field = {}, entry, node = null, options = {}) {
    const name = String(field.label ?? field.key ?? '');
    const phrase = dateConditionPhrase(field, entry, node, options);
    return phrase ? word(node, 'dateChip', {field: name, condition: phrase}) : name;
}
