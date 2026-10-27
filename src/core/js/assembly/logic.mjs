// Readings and conditions of a rule (standard simai.smart-component 1.3.8
// §9): the closed lists a rule, a derived key (§7.1.2) and a role's `if`
// are built from. There are no expressions, no string building and no
// functions: a reading is data, and this file only walks it.

import {at, freshId, isObject, same} from './values.mjs';

export const READINGS = Object.freeze(['from', 'key', 'value', 'entry', 'new', 'object', 'sum', 'difference', 'product', 'count', 'choose', 'outcome']);
export const OPERATIONS = Object.freeze(['eq', 'ne', 'gt', 'lt', 'has', 'filled', 'empty', 'yes', 'no']);
export const OUTCOME_FIELDS = Object.freeze(['answer', 'reason', 'message']);

export const isCondition = (node) => isObject(node) && ('op' in node || 'all' in node || 'any' in node);

const filled = (value) => !(value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0));

/**
 * A reader over one context. The context gives what a reading may look at:
 *   key(name)       a key, the turn's pending writes first (§10.2)
 *   from            what the event carries
 *   entry           the entry whose part sent the event (§7.2.3)
 *   outcome         the outcome that ended the rule, inside `otherwise` only
 *   fail(text)      a reading that is not one
 * and returns `read(reading)` and `test(condition)`.
 */
export function createReader(context) {
  const fail = context.fail ?? (() => {});
  const numbers = (list) => {
    if (!Array.isArray(list)) { fail(`${JSON.stringify(list)} is not a list of readings`); return null; }
    const got = list.map(read);
    if (got.some((n) => n === null || n === undefined)) return null; // an unset operand gives null (§9)
    const numeric = got.map(Number);
    return numeric.some((n) => !Number.isFinite(n)) ? null : numeric;
  };

  function read(reading) {
    if (!isObject(reading)) { fail(`${JSON.stringify(reading)} is not a reading`); return undefined; }
    if (isCondition(reading)) return test(reading); // a condition stands wherever a boolean is read
    if ('value' in reading) return reading.value;
    if ('key' in reading) {
      const [head, ...path] = String(reading.key).split('.');
      const value = context.key(head);
      return path.length ? at(value, path.join('.')) : value;
    }
    if ('from' in reading) return at(context.from, reading.from);
    if ('entry' in reading) return context.entry ? at(context.entry, reading.entry) : undefined;
    if ('new' in reading) return freshId();
    if ('object' in reading) {
      const out = {};
      for (const [field, inner] of Object.entries(reading.object ?? {})) if (field !== '$comment') out[field] = read(inner);
      return out;
    }
    if ('sum' in reading) { const n = numbers(reading.sum); return n && n.reduce((a, b) => a + b, 0); }
    if ('product' in reading) { const n = numbers(reading.product); return n && n.reduce((a, b) => a * b, 1); }
    if ('difference' in reading) {
      const n = numbers(reading.difference);
      if (n && n.length !== 2) { fail('difference takes two readings'); return null; }
      return n && n[0] - n[1];
    }
    if ('count' in reading) { const list = read(reading.count); return Array.isArray(list) ? list.length : 0; }
    if ('choose' in reading) return test(reading.choose) ? read(reading.then) : read(reading.else);
    if ('outcome' in reading) {
      if (!context.outcome) { fail(`{"outcome": "${reading.outcome}"} is read outside otherwise`); return undefined; }
      if (!OUTCOME_FIELDS.includes(reading.outcome)) { fail(`"${reading.outcome}" is not a field of an outcome`); return undefined; }
      return context.outcome[reading.outcome] ?? '';
    }
    fail(`${JSON.stringify(reading)} is not a reading`);
    return undefined;
  }

  function test(condition) {
    if (!isObject(condition)) { fail(`${JSON.stringify(condition)} is not a condition`); return false; }
    if (Array.isArray(condition.all)) return condition.all.every(test);
    if (Array.isArray(condition.any)) return condition.any.some(test);
    const left = read(condition.left);
    const right = condition.right === undefined ? undefined : read(condition.right);
    switch (condition.op) {
      case 'eq': return same(left ?? null, right ?? null);
      case 'ne': return !same(left ?? null, right ?? null);
      case 'gt': return left !== null && left !== undefined && right !== null && right !== undefined && left > right;
      case 'lt': return left !== null && left !== undefined && right !== null && right !== undefined && left < right;
      case 'has':
        if (Array.isArray(left)) return left.some((one) => same(one, right));
        return typeof left === 'string' && right !== null && right !== undefined && left.includes(String(right));
      case 'filled': return filled(left);
      case 'empty': return !filled(left);
      case 'yes': return left === true;
      case 'no': return left === false;
      default: fail(`op "${condition.op}" is not an operation`); return false;
    }
  }

  return {read, test};
}

/** The keys a reading or a condition reads: the dependencies of a derived key (§7.1.2). */
export function keysOf(node, into = new Set()) {
  if (Array.isArray(node)) { for (const one of node) keysOf(one, into); return into; }
  if (!isObject(node)) return into;
  if (Array.isArray(node.all) || Array.isArray(node.any)) return keysOf(node.all ?? node.any, into);
  if ('op' in node) return keysOf([node.left, node.right], into);
  if ('value' in node) return into; // a constant reads nothing
  if (typeof node.key === 'string') into.add(node.key.split('.')[0]);
  else if (isObject(node.object)) keysOf(Object.values(node.object), into);
  else if ('choose' in node) keysOf([node.choose, node.then, node.else], into);
  else for (const kind of ['sum', 'difference', 'product', 'count']) if (kind in node) keysOf(node[kind], into);
  return into;
}
