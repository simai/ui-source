// The block tree of a Composition Document: where a node stands, its
// ancestors, its children in slot order, new ids and copies with new ids.
// Pure functions over plain JSON; nothing here knows about the page.
//
// Provenance: the shared editing parts of SIMAI Editor (ui-editor
// package/src/smart/editor/js/tree.mjs) were moved into the SIMAI Framework
// core by their rightholder, Rim Zabarov (owner decision 2026-11-10,
// composition F3.1). This file is written for the Framework and is licensed
// with it (REUSE.toml: Apache-2.0); no SIMAI Editor code is imported.
import { isPlainObject } from './canonical.mjs';

export { isPlainObject };

/** A deep copy of plain JSON; undefined stays undefined. */
export const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** Whether two plain JSON values are the same (key order counts). */
export const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** The children of a node in slot order: [{slot, index, node}]. */
export function childrenOf(node) {
  const out = [];
  for (const [slot, list] of Object.entries(isPlainObject(node?.slots) ? node.slots : {})) {
    (Array.isArray(list) ? list : []).forEach((child, index) => out.push({ slot, index, node: child }));
  }
  return out;
}

/** Calls visit(node, parent, slot, index) for every node, parents first; visit returns false to skip a node's children. */
export function walk(root, visit, parent = null, slot = '', index = 0) {
  if (!isPlainObject(root)) return;
  if (visit(root, parent, slot, index) === false) return;
  for (const child of childrenOf(root)) walk(child.node, visit, root, child.slot, child.index);
}

/** Where a node stands: {node, parent, slot, index, ancestors} (ancestors from the root down to the parent), or null. */
export function locate(root, id) {
  if (!isPlainObject(root) || id === undefined || id === null) return null;
  if (root.id === id) return { node: root, parent: null, slot: '', index: 0, ancestors: [] };
  const trail = [root];
  const search = (node) => {
    for (const child of childrenOf(node)) {
      if (child.node?.id === id) return { node: child.node, parent: node, slot: child.slot, index: child.index, ancestors: [...trail] };
      trail.push(child.node);
      const found = search(child.node);
      trail.pop();
      if (found) return found;
    }
    return null;
  };
  return search(root);
}

/** Every id of a subtree, added to `into`. */
export function idsOf(node, into = new Set()) {
  walk(node, (current) => {
    if (current.id !== undefined) into.add(current.id);
  });
  return into;
}

/**
 * Makes ids `<prefix><n>` (n in base 36) that no node of the tree holds;
 * the ids it gives are taken too. next.reserve(node) marks a subtree's ids
 * taken (a node inserted from outside).
 */
export function idMaker(root, prefix = 'e') {
  const taken = idsOf(root);
  let count = taken.size;
  const next = () => {
    let id;
    do id = `${prefix}${(count += 1).toString(36)}`;
    while (taken.has(id));
    taken.add(id);
    return id;
  };
  next.reserve = (node) => idsOf(node, taken);
  next.taken = (id) => taken.has(id);
  return next;
}

/**
 * A copy of a subtree with new ids all through it. Runtime links inside the
 * copy follow the ids: a binding with owner 'section' and ref '<id>#<state>'
 * points at the copied node.
 */
export function freshCopy(node, next) {
  const copy = clone(node);
  const map = new Map();
  walk(copy, (current) => {
    const id = next();
    map.set(current.id, id);
    current.id = id;
  });
  walk(copy, (current) => {
    if (!Array.isArray(current.bindings)) return;
    current.bindings = current.bindings.map((binding) => {
      if (binding?.owner !== 'section' || typeof binding.ref !== 'string') return binding;
      const [from, state] = binding.ref.split('#');
      return map.has(from) ? { ...binding, ref: `${map.get(from)}#${state}` } : binding;
    });
  });
  return copy;
}

/** The list of a slot, made when it is missing. */
export function slotList(node, slot) {
  if (!isPlainObject(node.slots)) node.slots = {};
  if (!Array.isArray(node.slots[slot])) node.slots[slot] = [];
  return node.slots[slot];
}

/** Puts a node into a slot at an index (clamped to the list). */
export function insertAt(parent, slot, index, node) {
  const list = slotList(parent, slot);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, node);
}

/** Takes the node at an index out of a slot; null when there is none. */
export function removeAt(parent, slot, index) {
  const list = parent?.slots?.[slot];
  if (!Array.isArray(list)) return null;
  return list.splice(index, 1)[0] ?? null;
}

/** Whether `id` stands inside the subtree of `ancestorId` (or is it). */
export function within(root, ancestorId, id) {
  const at = locate(root, ancestorId);
  return Boolean(at && locate(at.node, id));
}

export default { childrenOf, clone, freshCopy, idMaker, idsOf, insertAt, isPlainObject, locate, removeAt, same, slotList, walk, within };
