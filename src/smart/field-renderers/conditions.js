// A field's conditions (Framework order FO-3 of the view set study, ui-control
// control/research/2026-11-17-view-round-1/framework-orders.md): when the
// field is shown, required and enabled, each a condition over the other
// fields' values as they stand on screen -- what the record holds, or what
// the person has changed it to and not saved yet. It is a part of the
// Framework field descriptor:
//
//   {key, label, propertyType, required?, readonly?,
//    when?: {visible?: <condition>, required?: <condition>, enabled?: <condition>}}
//
// The grammar is small on purpose (the data view port's, Larena's settings
// SettingConditions):
//
//   {field, op, value}   op: eq, ne, in, not_in (value a list), empty, not_empty,
//                        gt, gte, lt, lte (an order as the server keeps it:
//                        decimals exactly, ISO dates as text; Larena
//                        msg-75b451e2eec6413aa2eb)
//   {all: [...]}         every condition holds
//   {any: [...]}         at least one holds
//   {not: {...}}         the condition does not hold
//
// A value is compared by what it is, not by how it is shown ({value, label}
// by its value), as text on both sides (5 and "5" are one value). A multiple
// field is equal when any of its items is. A condition that cannot be read --
// an unknown op, an empty all or any, in without a list -- leaves the field as
// it is declared: a field lost to a typo is a value nobody can see or change.
// A field that is not enabled is drawn read-only, as a field declared readonly.
//
// Plain functions, no rendering: sf-form evaluates them on every drawing, so a
// field appears the moment the value it waits for is chosen, and the contract
// test runs them without a DOM. sf-view-properties' js/conditions.js was the
// copy this replaces; SF.fieldRenderers.conditions publishes it for a host.

export const CONDITION_OPS = Object.freeze(['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty', 'gt', 'gte', 'lt', 'lte']);
const COMPARE_OPS = new Set(['gt', 'gte', 'lt', 'lte']);

// An order as the server keeps it (Larena when-cases, simai.settings.when-
// cases 1): decimals compare exactly, by their digits, never as floats (a
// big integer stays exact); ISO dates compare as text; a text is not ordered
// against a decimal, and a list or nothing has no order. -1, 0, 1, or null
// where there is no order.
const DECIMAL = /^[-+]?\d+(\.\d+)?$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[-+]\d{2}:?\d{2})?)?$/u;
function compareDecimal(a, b) {
  const sign = (text) => (text.startsWith('-') ? -1 : 1);
  const parts = (text) => {
    const [whole, fraction = ''] = text.replace(/^[-+]/u, '').split('.');
    return [whole.replace(/^0+(?=\d)/u, ''), fraction.replace(/0+$/u, '')];
  };
  const [aw, af] = parts(a);
  const [bw, bf] = parts(b);
  const zero = (w, f) => /^0*$/u.test(w) && f === '';
  const sa = zero(aw, af) ? 0 : sign(a);
  const sb = zero(bw, bf) ? 0 : sign(b);
  if (sa !== sb) return sa < sb ? -1 : 1;
  if (sa === 0) return 0;
  let order = aw.length !== bw.length ? (aw.length < bw.length ? -1 : 1) : (aw < bw ? -1 : aw > bw ? 1 : 0);
  if (order === 0) {
    const width = Math.max(af.length, bf.length);
    const fa = af.padEnd(width, '0');
    const fb = bf.padEnd(width, '0');
    order = fa < fb ? -1 : fa > fb ? 1 : 0;
  }
  return sa < 0 ? -order : order;
}
function orderOf(held, bound) {
  const a = String(held).trim();
  const b = String(bound).trim();
  if (DECIMAL.test(a) && DECIMAL.test(b)) return compareDecimal(a, b);
  if (ISO_DATE.test(a) && ISO_DATE.test(b)) return a < b ? -1 : a > b ? 1 : 0;
  return null;
}
export const CONDITION_NODES = Object.freeze(['all', 'any', 'not']);
export const CONDITION_PARTS = Object.freeze(['visible', 'required', 'enabled']);

const scalar = (value) => (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value ? value.value : value);

// What a field holds, as a list of texts: a multiple field is a list already,
// a single one a list of one, and nothing (null, '', []) a list of none.
const itemsOf = (value) => (Array.isArray(value) ? value : [value])
  .map(scalar)
  .filter((item) => item !== null && item !== undefined && item !== '')
  .map((item) => String(item));

// The values on screen, read by key: a Map, or a plain object.
const reader = (values) => {
  if (values instanceof Map) return (key) => values.get(key);
  if (values && typeof values === 'object') return (key) => values[key];
  return () => undefined;
};

/** True or false, or null for a condition that cannot be read. values: a Map or an object of the fields' values by key. */
export function evaluateCondition(condition, values) {
  const read = typeof values === 'function' ? values : reader(values);
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return null;
  for (const node of ['all', 'any']) {
    if (!(node in condition)) continue;
    const list = condition[node];
    if (!Array.isArray(list) || !list.length) return null;
    const results = list.map((item) => evaluateCondition(item, read));
    if (results.includes(null)) return null;
    return node === 'all' ? results.every(Boolean) : results.some(Boolean);
  }
  if ('not' in condition) {
    const inner = evaluateCondition(condition.not, read);
    return inner === null ? null : !inner;
  }
  if (typeof condition.field !== 'string' || !CONDITION_OPS.includes(condition.op)) return null;
  const held = itemsOf(read(condition.field));
  if (condition.op === 'empty') return held.length === 0;
  if (condition.op === 'not_empty') return held.length > 0;
  if (COMPARE_OPS.has(condition.op)) {
    // An order (gt, gte, lt, lte), as the server decides it: a list or
    // nothing has no order, and no order holds.
    const raw = read(condition.field);
    const bound = scalar(condition.value);
    if (Array.isArray(raw) || held.length !== 1 || bound === null || bound === undefined || typeof bound === 'object') return false;
    const order = orderOf(held[0], bound);
    if (order === null) return false;
    return condition.op === 'gt' ? order > 0 : condition.op === 'gte' ? order >= 0 : condition.op === 'lt' ? order < 0 : order <= 0;
  }
  if (condition.op === 'eq' || condition.op === 'ne') {
    const hit = held.includes(String(scalar(condition.value)));
    return condition.op === 'eq' ? hit : !hit;
  }
  if (!Array.isArray(condition.value)) return null;
  const wanted = condition.value.map((item) => String(scalar(item)));
  const hit = held.some((item) => wanted.includes(item));
  return condition.op === 'in' ? hit : !hit;
}

/**
 * What a field's `when` decides, given the values on screen: {visible,
 * required, enabled}. A part the field does not condition, or conditions
 * unreadably, is what the field declares: shown, required as `required`
 * says, enabled (`readonly` stays the field's own and is read beside it).
 */
export function fieldConditions(field, values) {
  const when = field?.when && typeof field.when === 'object' && !Array.isArray(field.when) ? field.when : null;
  const decide = (key) => (when && key in when ? evaluateCondition(when[key], values) : null);
  const visible = decide('visible');
  const required = decide('required');
  const enabled = decide('enabled');
  return {
    visible: visible ?? true,
    required: required ?? field?.required === true,
    enabled: enabled ?? true,
  };
}

/**
 * Whether a single-field edit may open (FO3-4): a table cell's edit, a
 * card's quick edit. The field is shown, enabled by its conditions over the
 * record's values and not declared readonly; otherwise the edit does not
 * open and the value stays as text. The record's other fields are the values.
 */
export function fieldEditable(field, values) {
  if (!field || field.readonly === true) return false;
  const {visible, enabled} = fieldConditions(field, values);
  return visible && enabled;
}

/** The keys of the fields a field's `when` reads, each once. */
export function conditionFields(field) {
  const keys = new Set();
  const walk = (condition) => {
    if (!condition || typeof condition !== 'object') return;
    if (Array.isArray(condition)) {
      condition.forEach(walk);
      return;
    }
    if (typeof condition.field === 'string') keys.add(condition.field);
    walk(condition.all);
    walk(condition.any);
    walk(condition.not);
  };
  const when = field?.when;
  if (when && typeof when === 'object') for (const part of CONDITION_PARTS) walk(when[part]);
  return [...keys];
}
