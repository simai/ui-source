// The values an assembly holds: the types of standard simai.smart-component
// 1.3.8 §4.2 and §7.1, and the small helpers every other module of the
// assembly runtime shares. No DOM here: the whole file runs in Node as well.

/** The data states a key of type `state` holds (§7.1). */
export const STATES = Object.freeze(['idle', 'loading', 'ready', 'empty', 'error', 'refused', 'unavailable']);

/** The verbs that write to the host (vocabulary 1.1.5 §5.3). */
export const WRITE_VERBS = new Set([
  'save', 'delete', 'create', 'rename', 'archive', 'restore', 'move', 'apply',
  'submit', 'retry', 'attach', 'detach', 'answer', 'rate', 'read',
]);

/** The answers a waiting step can give (§10.3, vocabulary §3.1). */
export const ANSWERS = Object.freeze(['applied', 'conflict', 'refused', 'unavailable', 'cancelled']);

/** The cause chain limit of the quality profile (`runtime.cause_chain_depth`, §10.5). */
export const CAUSE_CHAIN_DEPTH = 32;

/** The base actions every element has (§4.1). */
export const BASE_ACTIONS = new Set(['focus', 'blur', 'connect-port']);

export const typeOf = (def) => (typeof def === 'string' ? def : def?.type);

/** `page-size` → `pageSize`: the property of a setting or a value (§4.2). */
export const camel = (name) => String(name).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** The entries of a manifest object, without `$comment` and the tools' `x-` fields (§3.3). */
export function own(object) {
  if (!object || typeof object !== 'object') return [];
  return Object.entries(object).filter(([name]) => name !== '$comment' && !name.startsWith('x-'));
}

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether a value fits a declared type; unset (null, undefined) always fits (§4.2). */
export function fits(def, value) {
  if (value === null || value === undefined) return true;
  const type = typeOf(def);
  switch (type) {
    case 'string': case 'icon': case 'date': return typeof value === 'string';
    case 'id': return typeof value === 'string' || Number.isInteger(value);
    case 'enum': return !def?.values || def.values.includes(value);
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'list': return Array.isArray(value);
    case 'object': return isObject(value);
    case 'state': return STATES.includes(value);
    default: return true;
  }
}

/** Structural equality of data: «an equal value is not passed again» (§7.2, §10.5). */
export function same(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!same(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = Object.keys(a);
  if (left.length !== Object.keys(b).length) return false;
  for (const name of left) if (!Object.prototype.hasOwnProperty.call(b, name) || !same(a[name], b[name])) return false;
  return true;
}

/** A copy of data, so a key's initial value is never shared between instances. */
export function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  return typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/** A field of a value along a dotted path (`answer.accepted`, `query.search`). */
export function at(value, path) {
  let current = value;
  for (const step of String(path).split('.')) {
    if (current === null || current === undefined) return undefined;
    current = current[step];
  }
  return current;
}

/** A short form of a value for the journal. */
export function show(value) {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value === undefined) return 'undefined';
  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  } catch {
    return String(value);
  }
}

/** The value of an attribute read as a declared type (§4.2: the attribute form of a boolean is absent / present / "false"). */
export function fromAttribute(def, raw) {
  if (raw === null) return typeOf(def) === 'boolean' && !def?.optional ? false : null;
  switch (typeOf(def)) {
    case 'boolean': return raw !== 'false';
    case 'number': {
      if (raw.trim() === '') return null;
      const number = Number(raw);
      return Number.isFinite(number) ? number : null;
    }
    default: return raw;
  }
}

/** A fresh id for a new entry: unique on the page, never a counter (§9 `new`, §7.1.1). */
export function freshId() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** An outcome in its one shape `{answer, reason, message, …}` (§4.4, vocabulary §3.1). */
export function outcomeOf(value) {
  if (value === undefined || value === null || value === true) return {answer: 'applied'};
  if (value === false) return {answer: 'refused', reason: '', message: ''};
  if (typeof value === 'string') return ANSWERS.includes(value) ? {answer: value} : {answer: 'applied'};
  if (isObject(value) && typeof value.answer === 'string') {
    return ANSWERS.includes(value.answer) ? value : {...value, answer: 'refused', reason: value.reason ?? 'unknown-answer'};
  }
  return {answer: 'applied'};
}
