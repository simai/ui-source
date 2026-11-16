// Retired class names (owner decisions C185 (2), C186 (8) and C187 (1), 2026-11-14;
// C208 (2), (3), 2026-11-15; C212 (6), 2026-11-16; C208 (2), (3) and C210 (5), 2026-11-15; C208 (2), (3) and C210 (5), 2026-11-15; C212 (6), 2026-11-16).
// One table, core/js/retired-classes.table.js, lists every class
// the Framework retires: a name, a family (pattern) or a whole utility sheet.
// A retired class keeps drawing what it drew until remove_after, and the
// Loader notes each one once in SF.deprecations the first time a page uses it
// (a console line under data-sf-deprecations="warn", and after the date
// whatever the page opted into). Journals: class-table-sm-to-density,
// class-text-flow-utility-aliases,
// class-c187-retired-utilities, class-c187-retired-parts, class-c96-tabs-looks,
// utility-c208-scrollbar-retired-sheets, class-c187-doc-to-docara,
// class-editor-utility-retired, class-c212-hide-print,
// class-ut1-layout-col-auto, class-ut1-grid-row, class-ut1-negative-auto,
// class-ut1-bg-position, class-ut1-blur, class-ut1-radius-square,
// class-ut1-tracking, utility-c210-scrollbar-retired-sheets,
// class-c210-scrollbar-class, class-avatar-offline-point-retired.
import table from './retired-classes.table.js';
import {noteDeprecated} from './deprecations.js';

const VARIANT = /^((?:[a-z-]+:)*)(.*)$/;

function entry(record, from, value) {
  const to = value && typeof value === 'object' ? value.to : value;
  const component = (value && typeof value === 'object' && value.component) || record.component || 'utility';
  return {component, from, to: to ?? null, since: record.since, remove_after: record.remove_after};
}

const NAMES = new Map();
const PATTERNS = [];
const SHEETS = new Map();
const MODIFIERS = [];
for (const record of table.records) {
  for (const [from, value] of Object.entries(record.names || {})) NAMES.set(from, entry(record, from, value));
  for (const item of record.patterns || []) PATTERNS.push({...entry(record, item.from, item.to), re: new RegExp(item.pattern), values: item.values,
    except: item.variants_except ? new RegExp(item.variants_except, 'u') : null});
  for (const [sheet, to] of Object.entries(record.sheets || {})) SHEETS.set(sheet, entry(record, sheet, to));
  for (const [name, item] of Object.entries(record.modifiers || {})) MODIFIERS.push({...entry(record, name, item.to), name, re: new RegExp(item.with)});
}

const TEXT_FLOW = table.records.find((record) => record.journal === 'class-text-flow-utility-aliases');

// The C186 (8) text-flow names and their dates, as C186 published them.
export const UTILITY_CLASS_ALIASES = Object.freeze({...TEXT_FLOW.names});
export const UTILITY_CLASS_ALIAS_DATES = Object.freeze({since: TEXT_FLOW.since, remove_after: TEXT_FLOW.remove_after});

export const RETIRED_CLASSES = table;

const expiredAt = (date, now) => now > Date.parse(`${date}T23:59:59.999Z`);

function note(found, from, to, now) {
  noteDeprecated({
    component: found.component,
    kind: 'class',
    from,
    to,
    since: found.since,
    remove_after: found.remove_after,
    ...(expiredAt(found.remove_after, now) ? {expired: true} : {}),
  });
}

/**
 * The retired name or family `token` belongs to, as {from, to} with the
 * variant prefix kept on both sides, or null. `to` is '' when the job leaves
 * the utilities.
 */
export function retiredClassName(token) {
  if (typeof token !== 'string' || !token) return null;
  const [, variants, base] = token.match(VARIANT);
  let found = NAMES.get(base);
  let to = found?.to;
  if (!found) {
    for (const item of PATTERNS) {
      // variants_except names the prefixes under which the family keeps its
      // name (C212 (4): cq-md:col-gap-2 stays, query-layout has no gap-x-*).
      if (item.except?.test(variants)) continue;
      const match = base.match(item.re);
      if (!match) continue;
      found = item;
      // values maps a group to the name it stands for in `to` (C212 (4): the
      // rung m-b6 is written m-1, its nearest space step; journal
      // class-c212-length-nearest).
      to = item.to === null ? null : base.replace(item.re, item.values
        ? (...groups) => item.to.replace(/\$(\d)/gu, (ref, n) => item.values[n]?.[groups[n]] ?? groups[n])
        : item.to);
      break;
    }
  }
  if (!found) return null;
  // A name may retire into two classes (C212 (2), journal class-c212-alignment:
  // md:center-center -> md:content-main-center md:items-cross-center); the
  // variant prefix goes on each of them.
  if (to === null) return {found, from: token, to: ''};
  return {found, from: token, to: to.split(' ').map((name) => `${variants}${name}`).join(' ')};
}

/**
 * Notes `token` when it is a retired class name or belongs to a retired
 * family; returns the name to write instead ('' when there is none) or null.
 * The Loader calls it once per distinct class token of the page.
 */
export function noteUtilityClassAlias(token, now = Date.now()) {
  const retired = retiredClassName(token);
  if (!retired) return null;
  note(retired.found, retired.from, retired.to || null, now);
  return retired.to;
}

/**
 * Notes `token` when every utility sheet it loads (`keys`, the Loader's rule
 * keys such as margin-ext/md) is a retired sheet; returns true when noted.
 */
export function noteRetiredUtilitySheets(token, keys, now = Date.now()) {
  if (!keys || !keys.length) return false;
  let found = null;
  for (const key of keys) {
    const sheet = SHEETS.get(String(key).split('/')[0]);
    if (!sheet) return false;
    found = sheet;
  }
  const [, variants] = token.match(VARIANT);
  note(found, token, found.to ? `${variants}${found.to}` : null, now);
  return true;
}

/**
 * Notes a retired modifier class (C212 (3): heading beside text-N, which is
 * title-N) when `classList` holds it next to the class it modifies; returns
 * the class to write instead, or null. A modifier alone is an author's own
 * class (a site's .heading), not the Framework's, and is not noted.
 * Journals class-c212-text and class-c212-text-nearest (C212 (3)).
 */
export function noteRetiredModifiers(classList, now = Date.now()) {
  if (!classList || !MODIFIERS.length) return null;
  for (const item of MODIFIERS) {
    if (!classList.contains(item.name)) continue;
    for (const token of classList) {
      const match = token.match(item.re);
      if (!match) continue;
      const to = item.to === null ? null : token.replace(item.re, item.to);
      note(item, `${token} ${item.name}`, to, now);
      return to;
    }
  }
  return null;
}
