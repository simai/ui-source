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
//   {field, op, value}   op: eq, ne, in, not_in (value a list), empty, not_empty
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

export const CONDITION_OPS = Object.freeze(['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty']);
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
