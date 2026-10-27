// The debugging journal of every bus (standard simai.smart-component 1.3.8
// §14). In development mode — `?sf-debug` in the address, `data-sf-debug` on
// <html> (the Loader's switch) or `SF_BOOT_CONFIG.debug.scope` — every turn,
// rule, step, host answer, write and crossing of the frame is recorded as one
// entry. Nothing is recorded in production; errors still reach the page as the
// base event `sf-component-error` on the host that met them (§4.1).
//
// The store lives on the shared global, like SF.language's: every bundle that
// carries a copy of this module records into the one journal.

const STORE = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfAssemblyJournal';
  if (!root[key]) root[key] = {entries: [], listeners: new Set(), seq: 0, forced: null, limit: 5000};
  return root[key];
})();

/** Whether the journal records: development mode only (§14). */
export function journalOn() {
  if (STORE.forced !== null) return STORE.forced;
  const root = globalThis;
  if (root.SF_BOOT_CONFIG?.debug?.scope) return true;
  try {
    if (new globalThis.URLSearchParams(root.location?.search || '').has('sf-debug')) return true;
  } catch {
    // no address: Node, a worker
  }
  return Boolean(root.document?.documentElement?.hasAttribute?.('data-sf-debug'));
}

/**
 * Record one entry: `{seq, time, instance, kind, level, text, …data}`.
 * Returns the entry, or null when the journal is off.
 */
export function record(instance, kind, text, data = {}, level = 'info') {
  if (!journalOn()) return null;
  const entry = {seq: ++STORE.seq, time: Date.now(), instance: instance ?? 'page', kind, level, text, ...data};
  STORE.entries.push(entry);
  if (STORE.entries.length > STORE.limit) STORE.entries.splice(0, STORE.entries.length - STORE.limit);
  for (const listener of [...STORE.listeners]) {
    try {
      listener(entry);
    } catch {
      // a listener that throws does not stop the journal
    }
  }
  return entry;
}

export const journal = {
  /** Turn the journal on or off whatever the page says; `null` follows the page again. */
  force(on) { STORE.forced = on === null || on === undefined ? null : Boolean(on); return this; },
  get on() { return journalOn(); },
  /** The entries, optionally of one instance (its path, or a path prefix ending with `/`). */
  entries(instance) {
    if (!instance) return [...STORE.entries];
    return STORE.entries.filter((entry) => entry.instance === instance || (instance.endsWith('/') && entry.instance.startsWith(instance)));
  },
  /** The journal as JSON (§14 «exports as JSON»). */
  export(instance) { return JSON.stringify(this.entries(instance)); },
  /** The keys of an instance as they were after a journal entry: the time machine (§14). */
  keysAt(instance, seq) {
    let found = null;
    for (const entry of STORE.entries) {
      if (entry.seq > seq) break;
      if (entry.instance === instance && entry.kind === 'commit' && entry.snapshot) found = entry.snapshot;
    }
    return found ? JSON.parse(found) : null;
  },
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    STORE.listeners.add(listener);
    return () => STORE.listeners.delete(listener);
  },
  clear() { STORE.entries.length = 0; return this; },
  /** How many entries are kept before the oldest are dropped. */
  limit(count) { STORE.limit = Math.max(100, Number(count) || 5000); return this; },
};
