// The dated alias table of one component (standard simai.smart-component
// 1.3.8 §16.20, vocabulary 1.1.5 §9): what the migration converter writes as
// <component>/aliases.json, read and checked here before core/js/aliases.js
// installs it on an element. Pure data, no DOM, so a build, a lint and the
// runtime share one reading of it.
//
// A table is a list of rows, or {tag, aliases: [rows]}. A row:
//
//   {from, to, kind, since, remove_after, mode?, when?, setting?, tag?}
//
//   kind      event | setting | attribute | action | value
//   since     the first day the new name exists, YYYY-MM-DD
//   remove_after
//             the last day the old name is promised, YYYY-MM-DD
//   mode      events only: same-detail (default) | detail-adds | split
//   when      events only, optional: {<detail field>: <value>}; the old name
//             is sent only for a new event whose detail matches (two old
//             names folded into one new name, as modal:after-hide and
//             modal:after-show into change)
//   setting   values only: the attribute the value belongs to
//
// A row that does not hold is refused with a reason, never thrown: the rest of
// the table still installs, and the refusals are reported.

export const ALIAS_KINDS = Object.freeze(['event', 'setting', 'attribute', 'action', 'value']);
export const ALIAS_MODES = Object.freeze(['same-detail', 'detail-adds', 'split']);

const DAY = 86400000;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ATTRIBUTE = /^[a-z][a-z0-9-]*$/u;
const MEMBER = /^[A-Za-z_$][\w$]*$/u;

function dateOf(text) {
  if (typeof text !== 'string' || !DATE.test(text)) return NaN;
  const time = Date.parse(`${text}T00:00:00Z`);
  // 2026-02-30 parses in some engines; it must print back as itself.
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text ? NaN : time;
}

// `remove_after` is the last promised day, whole, in UTC: the old name is
// open until the end of it and expired from the next midnight.
export function aliasExpired(row, now = Date.now()) {
  const last = dateOf(row?.remove_after);
  return Number.isFinite(last) && now >= last + DAY;
}

// kebab-case attribute -> camelCase property: backdrop-blur -> backdropBlur.
export function propertyOf(attribute) {
  return String(attribute).replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());
}

function primitive(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function checkRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'not-an-object';
  const {from, to, kind, since, mode = 'same-detail', when, setting} = row;
  if (!ALIAS_KINDS.includes(kind)) return 'unknown-kind';
  if (typeof from !== 'string' || !from) return 'no-from';
  if (to === null || to === undefined || to === '') return 'no-new-name';
  if (typeof to !== 'string') return 'no-to';
  if (from === to) return 'same-name';
  const start = dateOf(since);
  const end = dateOf(row.remove_after);
  if (Number.isNaN(start)) return 'bad-since';
  if (Number.isNaN(end)) return 'bad-remove-after';
  if (end < start) return 'remove-after-before-since';
  if (!ALIAS_MODES.includes(mode)) return 'unknown-mode';
  if (kind !== 'event' && mode !== 'same-detail') return 'mode-on-non-event';
  if (when !== undefined) {
    if (kind !== 'event') return 'when-on-non-event';
    if (!when || typeof when !== 'object' || Array.isArray(when) || !Object.values(when).every(primitive)) return 'bad-when';
  }
  if (kind === 'setting' || kind === 'attribute') {
    if (!ATTRIBUTE.test(from) || !ATTRIBUTE.test(to)) return 'bad-attribute-name';
  }
  if (kind === 'action' && (!MEMBER.test(from) || !MEMBER.test(to))) return 'bad-member-name';
  if (kind === 'value') {
    if (typeof setting !== 'string' || !ATTRIBUTE.test(setting)) return 'value-needs-setting';
  } else if (setting !== undefined) {
    return 'setting-on-non-value';
  }
  return null;
}

function normal(row, tag) {
  const out = {
    kind: row.kind,
    from: row.from,
    to: row.to,
    since: row.since,
    remove_after: row.remove_after,
    tag: typeof row.tag === 'string' && row.tag ? row.tag : tag,
  };
  if (row.kind === 'event') {
    out.mode = row.mode || 'same-detail';
    if (row.when) out.when = {...row.when};
  }
  if (row.kind === 'value') out.setting = row.setting;
  return Object.freeze(out);
}

// -> {tag, rows: [frozen rows], refused: [{index, from, to, kind, reason}]}
export function readAliasTable(table, {tag = ''} = {}) {
  const list = Array.isArray(table) ? table : table?.aliases;
  const owner = (!Array.isArray(table) && typeof table?.tag === 'string' && table.tag) || tag || '';
  const rows = [];
  const refused = [];
  if (!Array.isArray(list)) {
    refused.push({index: -1, from: null, to: null, kind: null, reason: 'not-a-table'});
    return {tag: owner, rows, refused};
  }
  const refuse = (index, row, reason) => refused.push({index, from: row?.from ?? null, to: row?.to ?? null, kind: row?.kind ?? null, reason});
  const seen = new Map();
  list.forEach((row, index) => {
    const reason = checkRow(row);
    if (reason) return refuse(index, row, reason);
    const one = normal(row, owner);
    // An attribute, a property or a method has one new name; an event's old
    // name may be sent beside several new ones (split, folded names).
    const identity = one.kind === 'event'
      ? `event|${one.from}|${one.to}|${JSON.stringify(one.when ?? null)}`
      : one.kind === 'value' ? `value|${one.setting}|${one.from}` : `${one.kind === 'action' ? 'action' : 'name'}|${one.from}`;
    const before = seen.get(identity);
    if (before) return refuse(index, row, before.to === one.to ? 'duplicate' : 'conflict');
    seen.set(identity, one);
    rows.push({index, row: one});
  });
  // Two old names folded into one new name by their detail: without `when`
  // each would be sent on every new event, the wrong one among them.
  const folded = new Map();
  for (const entry of rows) {
    const {row} = entry;
    if (row.kind !== 'event' || row.mode === 'same-detail' || row.when) continue;
    folded.set(row.to, [...(folded.get(row.to) ?? []), entry]);
  }
  const ambiguous = new Set();
  for (const group of folded.values()) if (group.length > 1) for (const entry of group) ambiguous.add(entry);
  const kept = [];
  for (const entry of rows) {
    if (ambiguous.has(entry)) refuse(entry.index, entry.row, 'needs-when');
    else kept.push(entry.row);
  }
  refused.sort((a, b) => a.index - b.index);
  return {tag: owner, rows: kept, refused};
}
