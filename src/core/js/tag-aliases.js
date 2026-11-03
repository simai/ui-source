// Dated tag aliases (rename plan R0, ui-control RENAME-PLAN-2026-11-03; change
// lifecycle: contracts/changes/journal.json, kind "tag"). When a Smart
// component takes a new tag, the old tag keeps working until its
// `remove_after` day:
//
// - Definition. defineTagAliases(Class, tag) defines each old tag as a trivial
//   subclass of the class that defines the new one (the Smart base calls it
//   from define()). The Loader's rule lists the old tag beside the new one, so
//   markup with the old tag alone loads the bundle.
// - Note. The first old-tag element a page connects is noted in
//   SF.deprecations (kind "tag") and named once on the console with the new tag
//   and the date, whatever the page opted into: an element name is the most
//   visible thing a page writes, and the old one is going.
// - Script. Code that finds a renamed element by name asks for both names
//   through one helper instead of a literal:
//
//     import {tagSelector, isTag} from '../../core/js/smart-base';
//     host.querySelector(`.sf-tag > ${tagSelector('sf-button-close')}`);
//     if (isTag(node, 'sf-button-close')) ...
//
// - Sheets. A selector that names the new tag names the old one beside it in
//   source, `:is(sf-button-close, sf-close)`, for as long as the alias lives
//   (scripts/rename-smart-tag.mjs writes it, --sweep takes it out; the
//   contract test tests/tag-aliases.contract.test.mjs holds both).
//
// The Framework's own aliases are a static table (tag-aliases.generated.js,
// written from every component's aliases.json by scripts/tag-alias-table.mjs),
// so a lookup finds an old tag before the renamed component's bundle has run.
// A package's component adds its rows when it is defined. Every copy of this
// module shares one state on the page (a global symbol); the Smart bundles
// reach it through the shared runtime (smart-base re-exports it).
import {noteDeprecated} from './deprecations.js';
import {aliasExpired, readTagAliases} from './alias-table.js';
import FRAMEWORK_TAG_ALIASES from './tag-aliases.generated.js';

const STATE = Symbol.for('simai.sf.tag-aliases');

function state() {
  if (!globalThis[STATE]) {
    const shared = {byOld: new Map(), byNew: new Map(), noted: new Set()};
    Object.defineProperty(globalThis, STATE, {value: shared, configurable: true});
    for (const row of FRAMEWORK_TAG_ALIASES) addRow(shared, row);
  }
  return globalThis[STATE];
}

function addRow(shared, row) {
  if (shared.byOld.has(row.from)) return;
  shared.byOld.set(row.from, row);
  shared.byNew.set(row.to, [...(shared.byNew.get(row.to) ?? []), row.from]);
}

// Rows from a component's aliases.json (its `tag` rows); the Framework's are
// already known, a package's are added here.
export function registerTagAliases(table, tag) {
  const {rows} = readTagAliases(table, {tag});
  const shared = state();
  for (const row of rows) addRow(shared, row);
  return rows;
}

// The open old names of a tag, its own first: ['sf-button-close', 'sf-close'].
export function tagNames(tag) {
  const name = String(tag || '').toLowerCase();
  return [name, ...(state().byNew.get(name) ?? [])];
}

// A selector for the tag that matches its old names too:
// ':is(sf-button-close, sf-close)', or the tag itself when it has none.
export function tagSelector(tag) {
  const names = tagNames(tag);
  return names.length > 1 ? `:is(${names.join(', ')})` : names[0];
}

// Whether an element is the tag, under its own or an old name.
export function isTag(element, tag) {
  const name = element?.localName;
  return Boolean(name) && tagNames(tag).includes(name);
}

// The current name of a tag: 'sf-button-close' for 'sf-close'.
export function canonicalTag(tag) {
  const name = String(tag || '').toLowerCase();
  return state().byOld.get(name)?.to ?? name;
}

// Every open row: [{from, to, since, remove_after}].
export function listTagAliases() {
  return [...state().byOld.values()].map((row) => ({...row}));
}

// The page met an element under an old name: once per old tag.
export function noteTagAlias(row) {
  const shared = state();
  const expired = aliasExpired(row);
  noteDeprecated({component: row.to, kind: 'tag', from: row.from, to: row.to, tag: row.to, since: row.since, remove_after: row.remove_after, expired});
  if (shared.noted.has(row.from)) return;
  shared.noted.add(row.from);
  // deprecations.js prints an expired name itself, and every name when the
  // page opted in; the note here is for the rest.
  const optedIn = globalThis.document?.documentElement?.dataset?.sfDeprecations === 'warn' || globalThis.SF?.deprecations?.warn === true;
  if (expired || optedIn) return;
  globalThis.console?.warn?.(`[SIMAI Framework] <${row.from}> is now <${row.to}>; the old tag works until ${row.remove_after}. Write <${row.to}>. See contracts/changes/journal.json.`);
}

// Defines each old tag of `tag` as a subclass of `Base` (the class that
// defines `tag`), through `define(name, Class)`: the Smart base passes its
// definition queue, so both names are defined in the same batch. Returns the
// rows defined.
export function defineTagAliases(Base, tag, {table = Base?.aliases, define} = {}) {
  if (table) registerTagAliases(table, tag);
  const rows = (state().byNew.get(tag) ?? []).map((from) => state().byOld.get(from));
  const registry = globalThis.customElements;
  const defined = [];
  for (const row of rows) {
    if (!registry || registry.get(row.from)) continue;
    class TagAlias extends Base {
      connectedCallback() {
        noteTagAlias(row);
        super.connectedCallback?.();
      }
    }
    Object.defineProperty(TagAlias, 'sfTagAliasOf', {value: row.to});
    (define ?? ((name, Class) => registry.define(name, Class)))(row.from, TagAlias);
    defined.push(row);
  }
  return defined;
}

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  // For scripts that are not Smart bundles (class components, a page):
  // SF.tags.selector('sf-button-close').
  if (!globalThis.SF.tags) {
    globalThis.SF.tags = Object.freeze({names: tagNames, selector: tagSelector, is: isTag, canonical: canonicalTag, list: listTagAliases});
  }
}
