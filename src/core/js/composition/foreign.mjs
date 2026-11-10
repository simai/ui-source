import { normalizeInline } from './inline-model.mjs';

// content.foreign for the converters (2026-11-10 composition review, P4):
// the block a converter cannot map is kept with its source and hash, and an
// exporter writes it back only while its hash matches.

async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('composition_crypto_unavailable');
  const bytes = new globalThis.TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** A content.foreign node; its hash is written by settleHashes. */
export function foreignNode(id, source, raw) {
  return { id, type: 'content.foreign', data: { source, raw } };
}

/** Writes the hash of every foreign node of a tree that has none. */
export async function settleHashes(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'content.foreign' && node.data && typeof node.data.raw === 'string' && node.data.hash === undefined) {
    node.data.hash = await sha256(node.data.raw);
  }
  for (const children of Object.values(node.slots || {})) {
    if (Array.isArray(children)) for (const child of children) await settleHashes(child);
  }
}

/** True when a foreign node's hash is absent or matches its raw. */
export async function hashMatches(node) {
  if (node?.data?.hash === undefined) return true;
  return node.data.hash === await sha256(String(node.data.raw));
}

/** Every foreign node of a tree whose hash does not match, by path. */
export async function mismatchedForeign(node, path, found = new Map()) {
  if (!node || typeof node !== 'object') return found;
  if (node.type === 'content.foreign' && !(await hashMatches(node))) found.set(path, node);
  for (const [name, children] of Object.entries(node.slots || {})) {
    if (Array.isArray(children)) for (const [index, child] of children.entries()) await mismatchedForeign(child, `${path}.slots.${name}[${index}]`, found);
  }
  return found;
}

/** Key-sorted JSON: equal values give equal strings. */
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const INLINE_FIELDS = ['content', 'title', 'summary', 'caption'];
/** The tree with every inline field normalized, for comparing two conversions. */
export function normalizedTree(node) {
  if (Array.isArray(node)) return node.map(normalizedTree);
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return node;
  const out = { ...node };
  if (node.data && typeof node.data === 'object') {
    out.data = { ...node.data };
    for (const key of INLINE_FIELDS) if (Array.isArray(node.data[key])) out.data[key] = normalizeInline(node.data[key]);
    if (node.type === 'content.table' && Array.isArray(node.data.rows)) out.data.rows = node.data.rows.map((row) => (Array.isArray(row) ? row.map((cell) => normalizeInline(cell)) : row));
  }
  if (node.slots && typeof node.slots === 'object') out.slots = Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [name, normalizedTree(children)]));
  return out;
}

/** The tree without its node ids, for comparing two conversions. */
export function withoutIds(node) {
  if (Array.isArray(node)) return node.map(withoutIds);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'id' && typeof node.type === 'string') continue;
    if (key === 'data' && node.type === 'content.foreign' && value && typeof value === 'object') { const { hash, ...rest } = value; out.data = rest; continue; }
    if (key === 'root') out[key] = withoutIds(value);
    else out[key] = key === 'slots' ? Object.fromEntries(Object.entries(value).map(([name, children]) => [name, withoutIds(children)])) : value;
  }
  return out;
}
