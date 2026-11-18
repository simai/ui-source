// The conditions of a filter field's window, per property type (owner
// decision C310, 2026-11-18; study ui-control control/research/2026-11-18-
// filter-field-choice, the per-property table): which conditions a type has,
// which of them need a value, what the field button shows after applying,
// and how wide the window is. The window's composition (where the condition
// stands, the footer of a single choice) is the shell's and waits for the
// owner's answer on the window without repeats; these are its data.
//
//   choice, user, lookup, record   любой из · ни один из · не задано · задано
//   choices                        любой из · все из · ни один из · не задано · задано
//   boolean                        Да / Нет / Не задано, one choice, no condition line
//   string, text                   содержит · начинается с · не задано · задано
//   number, integer, money         от – до · равно · больше · меньше (money in its currency, C294)
//   date, datetime                 the type's own control (C293's list is the date template's)
//
// A field's filter.conditions, when given, is the list the window offers.
// The stored value stays {operator, value?, values?}: in, all, not_in carry
// values; empty and not_empty carry none.

export const LIST_CONDITIONS = Object.freeze(['in', 'not_in', 'empty', 'not_empty']);
export const MULTI_CONDITIONS = Object.freeze(['in', 'all', 'not_in', 'empty', 'not_empty']);
export const STRING_CONDITIONS = Object.freeze(['contains', 'startsWith', 'empty', 'not_empty']);
export const NUMBER_CONDITIONS = Object.freeze(['between', 'eq', 'gt', 'lt']);
export const VALUELESS_CONDITIONS = Object.freeze(['empty', 'not_empty']);
const LIST_OPERATORS = new Set(['in', 'all', 'not_in']);

const LIST_TYPES = new Set(['choice', 'user', 'lookup', 'record', 'relation', 'single-select', 'multi-select',
  'entity-multi-select', 'entity-single-select', 'file', 'color']);
const WIDE_TYPES = new Set(['user', 'lookup', 'record', 'relation', 'entity-multi-select', 'entity-single-select']);
const STRING_TYPES = new Set(['string', 'text', 'html']);
const NUMBER_TYPES = new Set(['number', 'integer', 'money', 'percent']);

/** The property type a filter is drawn for. */
export function filterTypeOf(field = {}) {
  return String(field.filter?.control || field.propertyType || field.type || field.dataType || 'text');
}

/** What kind of window a type has: list, multi (choices), boolean, string, number or own. */
export function filterKindOf(field = {}) {
  const type = filterTypeOf(field);
  if (type === 'choices') return 'multi';
  if (type === 'boolean') return 'boolean';
  if (LIST_TYPES.has(type)) return 'list';
  if (STRING_TYPES.has(type)) return 'string';
  if (NUMBER_TYPES.has(type)) return 'number';
  return 'own';
}

/** The conditions the window offers for a field, the field's own list first. */
export function filterConditions(field = {}) {
  const own = field.filter?.conditions;
  if (Array.isArray(own) && own.length) return own.map(String);
  switch (filterKindOf(field)) {
    case 'multi': return [...MULTI_CONDITIONS];
    case 'list': return [...LIST_CONDITIONS];
    case 'string': return [...STRING_CONDITIONS];
    case 'number': return [...NUMBER_CONDITIONS];
    default: return [];
  }
}

/** The condition a value holds, or the field's first. */
export function filterCondition(field = {}, value = {}) {
  const conditions = filterConditions(field);
  const asked = value?.operator || field.filter?.defaultCondition || field.filter?.defaultOperator;
  if (asked && (!conditions.length || conditions.includes(asked))) return asked;
  return conditions[0] || asked || '';
}

/** Whether a condition is answered without a value (не задано / задано). */
export function filterValueless(operator) {
  return VALUELESS_CONDITIONS.includes(operator);
}

const filled = (one) => one !== undefined && one !== null && String(one).trim() !== '';

/** Whether the value sets a condition at all (the field button takes its colour). */
export function filterActive(field = {}, value = {}) {
  if (!value || typeof value !== 'object') return false;
  const operator = filterCondition(field, value);
  if (filterValueless(operator)) return true;
  if (Array.isArray(value.values)) return value.values.length > 0;
  if (Array.isArray(value.value)) return value.value.some(filled);
  return filled(value.value);
}

/** The number on the field button and in «Применить (N)»: chosen values of a list condition only (C310). */
export function filterCount(field = {}, value = {}) {
  const kind = filterKindOf(field);
  if (kind !== 'list' && kind !== 'multi') return 0;
  const operator = filterCondition(field, value);
  if (!LIST_OPERATORS.has(operator)) return 0;
  return Array.isArray(value?.values) ? value.values.length : 0;
}

/** How wide the window is: panel (20rem) or wide (24rem, people and records with a caption). */
export function filterWidth(field = {}) {
  const own = field.filter?.width;
  if (own === 'panel' || own === 'wide') return own;
  if (WIDE_TYPES.has(filterTypeOf(field))) return 'wide';
  const options = Array.isArray(field.filter?.options) ? field.filter.options : [];
  return options.some((option) => option && option.caption) ? 'wide' : 'panel';
}

/**
 * What the field button says after applying (C300, C310): {active, count,
 * words}. count is shown only for list conditions; any other active
 * condition is the colour alone, its words in the tooltip.
 * label(operator) gives a condition's words; name(value) an option's name.
 */
export function filterSummary(field = {}, value = {}, {label = (one) => one, name = (one) => one, yes = 'Да', no = 'Нет'} = {}) {
  const active = filterActive(field, value);
  if (!active) return {active: false, count: 0, words: ''};
  const operator = filterCondition(field, value);
  const count = filterCount(field, value);
  if (filterValueless(operator)) return {active, count: 0, words: label(operator)};
  const kind = filterKindOf(field);
  if (kind === 'boolean') {
    const one = Array.isArray(value.values) ? value.values[0] : value.value;
    return {active, count: 0, words: String(one) === 'true' || one === true ? yes : no};
  }
  if (kind === 'list' || kind === 'multi') {
    const names = (value.values || []).map((one) => name(String(one))).join(', ');
    return {active, count, words: `${label(operator)}: ${names}`};
  }
  const shown = Array.isArray(value.value) ? value.value.filter(filled).join(' – ') : String(value.value);
  return {active, count: 0, words: `${label(operator)} ${shown}`.trim()};
}
