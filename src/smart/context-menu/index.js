import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import BundledPosition from "../../core/js/position.js";
import { renderContextMenuTemplate } from "./js/templates/default";
import { holdOpenSurfaceMark } from "../../core/js/open-surface-mark";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// sf-context-menu from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8, §19): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, and its events
// go out by their verbs through sfEmit. aria-label and role stay the host's.
const ContextMenuElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});

// Prefer the helper Core published; a bundle loaded without core.js still
// positions with its own copy.
const position = () => globalThis.SF?.Position || BundledPosition;
const TYPEAHEAD_MS = 500;

// ─── drilling (1.5.0) ────────────────────────────────────────────────────────
// A row's path in the tree, the way the template writes it into the markup:
// "2" is a row of the level and "2/1" a row inside that row -- its submenu, or
// the items of a group. The step says it went one list in, so the depth and the
// place are read from the path alone.
const inside = (entry) => (Array.isArray(entry?.submenu) ? entry.submenu : Array.isArray(entry?.items) ? entry.items : null);

function entryAt(entries, path) {
  let list = entries;
  let entry = null;
  for (const [, step, at] of String(path ?? "").matchAll(/([/]?)(\d+)/gu)) {
    if (entry) list = step === "/" ? inside(entry) : null;
    if (!Array.isArray(list)) return null;
    entry = list[Number(at)] ?? null;
    if (!entry) return null;
  }
  return entry;
}

// A row with a submenu: the list it opens, whichever way it opens it.
const submenuOf = (entry) => (Array.isArray(entry?.submenu) && entry.submenu.length > 0 ? entry.submenu : null);

// A choice row that asked for its options as a level of their own
// (view: "drill"): the row shows the chosen one under its label and opens the
// list in the panel, a check mark on the chosen option. In a flyout menu there
// is no level to open, so the row stays the quiet one.
const optionsOf = (entry) => (entry?.type === "choice" && entry.view === "drill"
  && Array.isArray(entry.options) && entry.options.length > 0 ? entry.options : null);

// What a drilling panel opens one level into.
const drillable = (entry) => Boolean(submenuOf(entry) || optionsOf(entry));

// ─── value rows (1.5.0) ──────────────────────────────────────────────────────
// A setting's value lives in its entry and nowhere else: a value with two homes
// is a value that can disagree with itself. These three rows carry one.
const VALUE_ROWS = new Set(["switch", "range", "choice"]);

// The value a row has: a boolean for a switch, a number for a range, the chosen
// option's id for a choice.
function entryValue(entry) {
  if (entry?.type === "switch") return Boolean(entry.value);
  if (entry?.type === "range") return Number(entry.value ?? entry.min ?? 0);
  if (entry?.type === "choice") return (entry.options ?? []).find((option) => option.checked)?.id ?? null;
  return entry?.value ?? null;
}

// What to write into a row to give it a value; null when the row cannot hold
// that value (a choice has no such option), so a refused write stays refused.
function valuePatch(entry, value) {
  if (entry?.type === "switch") return {value: Boolean(value)};
  if (entry?.type === "range") {
    const number = Number(value);
    return Number.isFinite(number) ? {value: number} : null;
  }
  if (entry?.type === "choice") {
    const options = Array.isArray(entry.options) ? entry.options : [];
    if (!options.some((option) => option.id === value)) return null;
    return {options: options.map((option) => ({...option, checked: option.id === value}))};
  }
  return null;
}

// Every value row's value by its id, at the depth it sits: the snapshot reset
// puts back.
function valueMap(entries, into = {}) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.id && VALUE_ROWS.has(entry.type)) into[entry.id] = entryValue(entry);
    valueMap(entry.submenu, into);
    valueMap(entry.items, into);
  }
  return into;
}

// The tree with one row rewritten, found by its path: the lists above it are
// copied, so a change is a new tree and the template sees it.
function patchAt(entries, path, patch) {
  const steps = [...String(path ?? "").matchAll(/([/]?)(\d+)/gu)].map((found) => Number(found[2]));
  if (!steps.length || !Array.isArray(entries)) return entries;
  const rewrite = (list, depth) => {
    if (!Array.isArray(list)) return list;
    const at = steps[depth];
    const entry = list[at];
    if (!entry || typeof entry !== "object") return list;
    let next;
    if (depth + 1 === steps.length) {
      next = {...entry, ...patch};
    } else {
      const key = Array.isArray(entry.submenu) ? "submenu" : "items";
      const inner = rewrite(entry[key], depth + 1);
      if (inner === entry[key]) return list;
      next = {...entry, [key]: inner};
    }
    const copy = list.slice();
    copy[at] = next;
    return copy;
  };
  return rewrite(entries, 0);
}

// The tree with every value row a resolver answers for rewritten: what set-all
// and reset write. A tree with nothing to change is given back as it was.
function rewriteValues(entries, resolve) {
  if (!Array.isArray(entries)) return {list: entries, count: 0};
  let count = 0;
  const list = entries.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    let next = entry;
    const patch = VALUE_ROWS.has(entry.type) ? resolve(entry) : null;
    if (patch) {
      next = {...entry, ...patch};
      count += 1;
    }
    for (const key of ["submenu", "items"]) {
      if (!Array.isArray(next[key])) continue;
      const inner = rewriteValues(next[key], resolve);
      if (!inner.count) continue;
      next = {...next, [key]: inner.list};
      count += inner.count;
    }
    return next;
  });
  return {list: count ? list : entries, count};
}

// The path of the entry carrying an id, at any depth: what `show` goes to.
function pathOf(entries, id, prefix = "") {
  const list = Array.isArray(entries) ? entries : [];
  for (const [index, entry] of list.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const path = `${prefix}${index}`;
    if (entry.id === id) return path;
    const found = pathOf(inside(entry), id, `${path}/`);
    if (found) return found;
  }
  return "";
}

// What the menu walks with its arrows and holds one tab stop in: its rows, and
// the controls that are not rows -- a range's slider keeps its own slider role
// and its side arrows, so it is a stop rather than an item.
const STOPS = ".sf-context-menu-item, .sf-context-menu-stop";

const POSITION_ALIASES = {
  start: "inline-start",
  end: "inline-end",
  "top-start": "top-inline-start",
  "top-end": "top-inline-end",
  "bottom-start": "bottom-inline-start",
  "bottom-end": "bottom-inline-end",
  "left-start": "left-top",
  "left-end": "left-bottom",
  "right-start": "right-top",
  "right-end": "right-bottom",
  "inline-start-start": "inline-start-top",
  "inline-start-end": "inline-start-bottom",
  "inline-end-start": "inline-end-top",
  "inline-end-end": "inline-end-bottom",
};

function normalizePosition(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return POSITION_ALIASES[normalized] || normalized;
}

class SfContextMenu extends ContextMenuElement {
  constructor() {
    super();
    this._itemAttributes = new Map();
    this._currentItem = null;
    this._itemObserver = new MutationObserver(() => this.syncMenuItems());
    this.addEventListener("keydown", this.handleMenuKeyDown);
    this.addEventListener("keydown", this.handleOwnedKeyDown);
    this.addEventListener("click", this.handleEntryClick);
    this.addEventListener("pointerover", this.handleEntryHover);
    this._owned = null;
    this._typeahead = {text: "", at: 0};
    // The way down a drilling panel: the paths of the rows it was opened
    // through, the last of them the level it shows. Empty is the top level.
    this._drill = [];
    this._afterRender = null;
    if (Object.prototype.hasOwnProperty.call(this, "search")) {
      const early = this.search;
      delete this.search;
      this._search = early && typeof early === "object" ? early : null;
    }
    if (Object.prototype.hasOwnProperty.call(this, "entries")) {
      const early = this.entries;
      delete this.entries;
      this._entries = Array.isArray(early) ? early : null;
    }
    this._onOutsidePress = (event) => {
      const path = event.composedPath();
      if (path.includes(this) || path.includes(this._owned?.anchor)) return;
      // A press inside an open submenu is inside the menu.
      if (this._submenu && path.includes(this._submenu)) return;
      this.close({restoreFocus: false, reason: "outside"});
    };
    this.addEventListener("focusin", (event) => {
      if (this.menuItems().includes(event.target)) {
        this._currentItem = event.target;
        this.syncMenuItems();
      }
    });
    this.addEventListener("sf-after-render", (event) => {
      if (event.target !== this && event.target.closest("sf-context-menu") === this) {
        this.syncMenuItems();
      }
    });
  }

  afterRender(callback) {
    if (typeof callback === "function") return super.afterRender(callback);
    this._itemObserver.disconnect();
    this.syncMenuItems();
    // What a drilling step asked to do once its level was drawn.
    const run = this._afterRender;
    this._afterRender = null;
    run?.();
    const content = this.querySelector(".sf-context-menu-content");
    if (content) this._itemObserver.observe(content, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["disabled", "aria-disabled", "hidden", "inert"],
    });
  }

  disconnectedCallback() {
    // Taken out of the page, it closes without asking: nothing is left to keep.
    if (this._owned) this.close({restoreFocus: false, ask: false});
    this._itemObserver.disconnect();
    for (const item of this._itemAttributes.keys()) this.releaseItem(item);
    this._currentItem = null;
    super.disconnectedCallback();
  }

  menuItems() {
    if (this.templateName !== "default" || this.menuRole !== "menu") return [];
    const content = this.querySelector(".sf-context-menu-content");
    // Rendered from entries, every row is an item and carries its own role
    // (menuitem, menuitemcheckbox or menuitemradio); a value row's own control
    // is a stop of the same walk, under the role the platform gives it.
    if (this.entries.length) return Array.from(content?.querySelectorAll(STOPS) || []);
    return Array.from(content?.children || []).flatMap((child) => {
      const item = child.localName === "sf-button" ? child.querySelector("button, a[href]") : child;
      if (!item?.matches("button, a[href]")) return [];
      const role = item.getAttribute("role");
      return !role || role === "menuitem" ? [item] : [];
    });
  }

  availableMenuItems() {
    return this.menuItems().filter(item => !item.matches(":disabled") &&
      !item.closest('[hidden], [inert], [aria-disabled="true"], sf-button[disabled]') &&
      item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
  }

  ownItemAttribute(item, name, value) {
    let attributes = this._itemAttributes.get(item);
    if (!attributes) this._itemAttributes.set(item, attributes = new Map());
    let lease = attributes.get(name);
    if (!lease) {
      lease = {original: item.getAttribute(name), value: item.getAttribute(name), released: false};
      attributes.set(name, lease);
    }
    // A later application override is not ours to erase on cleanup or rerender.
    if (lease.released || item.getAttribute(name) !== lease.value) {
      lease.released = true;
      return;
    }
    if (lease.value !== value) item.setAttribute(name, value);
    lease.value = value;
  }

  releaseItem(item) {
    for (const [name, lease] of this._itemAttributes.get(item) || []) {
      if (lease.released || item.getAttribute(name) !== lease.value) continue;
      if (lease.original === null) item.removeAttribute(name);
      else item.setAttribute(name, lease.original);
    }
    this._itemAttributes.delete(item);
  }

  syncMenuItems() {
    const items = this.menuItems(), available = this.availableMenuItems();
    for (const item of this._itemAttributes.keys()) if (!items.includes(item)) this.releaseItem(item);
    if (!available.includes(this._currentItem)) this._currentItem = available[0] || null;
    for (const item of items) {
      // A row the menu drew carries its own role; a control that is not a row
      // keeps the platform's. Only a host's own child is given menuitem.
      if (!item.matches(STOPS)) this.ownItemAttribute(item, "role", "menuitem");
      this.ownItemAttribute(item, "tabindex", item === this._currentItem ? "0" : "-1");
    }
  }

  focus(options) {
    this.syncMenuItems();
    this._currentItem?.focus(options);
  }

  // ─── entries ─────────────────────────────────────────────────────────────
  // Entries are data, set as a property (`.entries=${…}` in a template) or as
  // JSON in the attribute. Set before the element was defined, the value sat
  // on the instance and is taken over in the constructor.
  get entries() {
    if (Array.isArray(this._entries)) return this._entries;
    if (!this.hasAttribute("entries")) return [];
    try {
      const parsed = JSON.parse(this.getAttribute("entries"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  set entries(value) {
    this._entries = Array.isArray(value) ? value : null;
    // New entries declare new values: the snapshot reset puts back is taken
    // again from them, the next time a value row is asked for one.
    this._declared = null;
    this._rangeFrom = null;
    this.requestComponentUpdate("entries");
  }

  // The entry a row was drawn from, found by the path in its markup.
  entryOf(element) {
    const row = element?.closest?.(`${STOPS}, .sf-context-menu-value-row`);
    if (!row || !this.contains(row)) return null;
    return entryAt(this.entries, row.dataset.sfEntry) ?? null;
  }

  // ─── values (1.5.0) ──────────────────────────────────────────────────────
  // The declared values: the ones the entries carried when the host set them,
  // taken once. Re-read after a change they would be the person's values, not
  // the declared ones, and reset would have nothing to put back.
  declaredValues() {
    if (!this._declared) this._declared = valueMap(this.entries);
    return this._declared;
  }

  // The entries after a change the menu made itself. It goes round the setter,
  // so the declared snapshot is still the host's.
  applyEntries(next) {
    if (!Array.isArray(next)) return;
    this._entries = next;
    this.requestComponentUpdate("entries");
  }

  // One change of a value row. Three events in order, and the order is the
  // contract: select (cancelable) -- a command row raises it alone, a value row
  // raises both -- then change, the cancelable request, and only when select
  // was not cancelled; the value is written after that, and changed is the
  // fact. A refused request leaves the row as it was, so the view never shows
  // a value its host did not take.
  changeValue(path, value, {previous} = {}) {
    const before = entryAt(this.entries, path);
    const patch = valuePatch(before, value);
    if (!patch) return false;
    const was = previous === undefined ? entryValue(before) : previous;
    const next = {...before, ...patch};
    this.declaredValues();
    const checked = before.type === "switch" ? Boolean(value) : null;
    if (!this.sfEmit("select", {id: before.id ?? null, entry: next, checked}, {cancelable: true})) return false;
    const fact = {id: before.id ?? null, value, previous: was, entry: next};
    if (!this.sfEmit("change", fact, {cancelable: true})) return false;
    this.applyEntries(patchAt(this.entries, path, patch));
    this.sfEmit("changed", fact);
    return true;
  }

  // A boolean setting: the row is the switch, so a press anywhere on it turns
  // the setting. A setting is tried rather than committed, so the menu stays
  // open unless the entry asked otherwise.
  toggleSwitch(row, entry) {
    const changed = this.changeValue(row.dataset.sfEntry, !entry.value, {previous: Boolean(entry.value)});
    if (changed && entry.keepOpen === false) this.closeAll();
    return changed;
  }

  // The number under a dragged thumb follows the pointer: the entry holds it,
  // so the row and its number show what the person is doing. The events come
  // when the thumb is let go, or at once from a key, which is one notch.
  previewRange(input) {
    const path = input?.dataset?.sfEntry;
    const entry = entryAt(this.entries, path);
    if (!entry) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || Number(entry.value) === value) return;
    this.declaredValues();
    if (this._rangeFrom?.path !== path) this._rangeFrom = {path, value: entryValue(entry)};
    this.applyEntries(patchAt(this.entries, path, {value}));
  }

  // The thumb let go, or one notch from a key: the request goes out once. A
  // refused request puts the row back where the drag began -- the preview wrote
  // the entry so the number could follow the pointer, and nothing else did.
  commitRange(input) {
    const path = input?.dataset?.sfEntry;
    const entry = entryAt(this.entries, path);
    if (!entry) return false;
    const from = this._rangeFrom?.path === path ? this._rangeFrom.value : entryValue(entry);
    this._rangeFrom = null;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value === from) return false;
    if (this.changeValue(path, value, {previous: from})) return true;
    this.applyEntries(patchAt(this.entries, path, {value: from}));
    return false;
  }

  // Write a setting's value into its own entry: the host's answer to change, or
  // a value restored on load. The menu raises nothing.
  // An action takes one object (`set-value {id, value}`); a page's own call may
  // name the two.
  setValue(target, given) {
    const {id, value} = target && typeof target === "object" ? target : {id: target, value: given};
    this.declaredValues();
    const {list, count} = rewriteValues(this.entries, (entry) => (entry.id === id ? valuePatch(entry, value) : null));
    if (!count) return {outcome: "refused", reason: "not-found"};
    this.applyEntries(list);
    return {outcome: "applied"};
  }

  // A whole map at once: a panel restored from storage in one call.
  setAll(given) {
    const values = given && typeof given === "object" && given.values && typeof given.values === "object" ? given.values : given;
    const map = values && typeof values === "object" ? values : {};
    this.declaredValues();
    const {list, count} = rewriteValues(this.entries, (entry) => (entry.id && Object.hasOwn(map, entry.id)
      ? valuePatch(entry, map[entry.id])
      : null));
    if (!count) return {outcome: "refused", reason: "not-found", count};
    this.applyEntries(list);
    return {outcome: "applied", count};
  }

  // The declared values back, and reset asked once. A listener that cancels it
  // keeps the current values; otherwise the menu shows the declared ones, says
  // changed for each row that moved and waits for the host to persist them.
  reset() {
    const declared = this.declaredValues();
    if (!this.sfEmit("reset", {}, {cancelable: true})) return {outcome: "cancelled"};
    const facts = [];
    const {list, count} = rewriteValues(this.entries, (entry) => {
      if (!entry.id || !Object.hasOwn(declared, entry.id)) return null;
      const previous = entryValue(entry);
      const value = declared[entry.id];
      if (previous === value) return null;
      const patch = valuePatch(entry, value);
      if (patch) facts.push({id: entry.id, value, previous, entry: {...entry, ...patch}});
      return patch;
    });
    if (count) this.applyEntries(list);
    for (const fact of facts) this.sfEmit("changed", fact);
    return {outcome: "applied"};
  }

  // Straight to one setting: the panel opens the levels down to it -- its own
  // submenu when it has one, otherwise the level its row stands on -- and the
  // focus goes to the row. A flyout menu has no level to go to.
  show(given) {
    const id = given && typeof given === "object" ? given.id : given;
    const path = pathOf(this.entries, id);
    if (!path) return {outcome: "refused", reason: "not-found"};
    if (!this.drill) return {outcome: "unavailable", reason: "no-levels"};
    const entry = entryAt(this.entries, path);
    const stack = [];
    let walked = "";
    for (const [, step, at] of path.matchAll(/([/]?)(\d+)/gu)) {
      walked = walked ? `${walked}${step}${at}` : `${at}`;
      if (walked !== path && drillable(entryAt(this.entries, walked))) stack.push(walked);
    }
    const into = drillable(entry);
    if (into) stack.push(path);
    this._drill = stack;
    this.clearQuery();
    this._afterRender = into ? () => this.focusLevelStart() : () => {
      this.syncMenuItems();
      const row = this.menuItems().find((item) => item.dataset.sfEntry === path);
      (row ?? this.availableMenuItems()[0])?.focus({preventScroll: true});
    };
    this.requestComponentUpdate("drill");
    return {outcome: "applied"};
  }

  // ─── drilling ────────────────────────────────────────────────────────────
  // submenu="drill": a submenu replaces the panel's content instead of opening
  // a second panel beside it, so the width never grows with the depth -- the
  // complaint behind the 400px reader panel on ui.simai.io (owner, 2026-10-30).
  // The default stays flyout, so no shipped menu changes.
  get drill() {
    return this.submenu === "drill";
  }

  // The level the panel shows: its entries, the path they are drawn under, how
  // deep it is and the label of the row it was opened through. A path that no
  // longer leads anywhere (the host set other entries) is dropped, so the
  // panel falls back to the deepest level it can still show.
  drillLevel() {
    if (!this.drill || !this._drill.length) return {entries: this.entries, prefix: "", depth: 0, label: "", search: null, choice: null};
    let entries = this.entries;
    let label = "";
    let prefix = "";
    let search = null;
    let choice = null;
    const kept = [];
    for (const path of this._drill) {
      const entry = entryAt(this.entries, path);
      if (!drillable(entry)) break;
      kept.push(path);
      label = entry.text ?? "";
      prefix = `${path}/`;
      // The option list of a choice row: the level holds no entries of its own,
      // only that row's options, and nothing opens below it.
      if (!submenuOf(entry)) {
        choice = {entry, path};
        entries = [];
        search = null;
        break;
      }
      entries = entry.submenu;
      // A level opened from a row that asked for a search draws the field,
      // as the flyout it replaces did.
      search = entry.search && typeof entry.search === "object" ? entry.search : null;
    }
    if (kept.length !== this._drill.length) this._drill = kept;
    return {entries, prefix, depth: kept.length, label, search, choice};
  }

  // Into a row's submenu, in place. The focus goes to the level's first row
  // once it is drawn.
  drillInto(path, {focus = true} = {}) {
    const asked = typeof path === "string" ? path : path?.dataset?.sfEntry;
    if (!this.drill || !drillable(entryAt(this.entries, asked))) return false;
    this._drill = [...this._drill, asked];
    this.clearQuery();
    if (focus) this._afterRender = () => this.focusLevelStart();
    this.requestComponentUpdate("drill");
    return true;
  }

  // One level back. The focus returns to the row the level was opened from.
  drillBack({focus = true} = {}) {
    if (!this._drill.length) return false;
    const from = this._drill[this._drill.length - 1];
    this._drill = this._drill.slice(0, -1);
    this.clearQuery();
    if (focus) this._afterRender = () => {
      this.syncMenuItems();
      const row = this.menuItems().find((item) => item.dataset.sfEntry === from);
      (row ?? this.availableMenuItems()[0])?.focus({preventScroll: true});
    };
    this.requestComponentUpdate("drill");
    return true;
  }

  // A level change clears what was typed, without telling a host-searched
  // list: changing level is not a search.
  clearQuery() {
    if (!this._query) return;
    this._query = "";
    this.requestComponentUpdate("query");
  }

  focusLevelStart() {
    this.syncMenuItems();
    (this.searchField() ?? this.availableMenuItems()[0])?.focus({preventScroll: true});
  }

  // A search over the entries: a submenu given `search` (or a menu given the
  // property) draws a field above its rows and narrows them as one types.
  get search() {
    return this._search && typeof this._search === "object" ? this._search : null;
  }

  set search(value) {
    this._search = value && typeof value === "object" ? value : null;
    this.requestComponentUpdate("search");
  }

  get query() {
    return this._query ?? "";
  }

  setQuery(value) {
    this._query = String(value ?? "");
    this.requestComponentUpdate("query");
    // A search the host answers: it is told the query and sets the entries.
    if (this.search?.remote) this.sfEmit("search", {query: this._query});
  }

  searchField() {
    return this.querySelector(".sf-context-menu-search-input");
  }

  // One option of a choice row: the menu marks it at once, so the row shows
  // the choice while the host applies it, and stays open -- a theme is tried,
  // not committed. The row is found by its path, so a choice row inside a
  // submenu or a group is chosen as one at the top level is.
  chooseOption(row, entry) {
    return this.chooseOptionAt(row.dataset.sfEntry, entry, Number(row.dataset.sfOption));
  }

  chooseOptionAt(path, entry, at) {
    const option = entry.options?.[at];
    if (!option || option.disabled) return false;
    const previous = entryValue(entry);
    const selected = this.sfEmit("select", {id: option.id ?? null, entry: option, checked: true, group: entry.id ?? null}, {cancelable: true});
    if (!selected) return false;
    this.declaredValues();
    const patch = {options: entry.options.map((item, index) => ({...item, checked: index === at}))};
    // A choice row is a value row: the cancelable change follows the
    // uncancelled select and the fact follows the write, so a host that wants
    // settings listens to change (or changed) alone.
    const fact = {id: entry.id ?? null, value: option.id ?? null, previous, entry: {...entry, ...patch}};
    if (!this.sfEmit("change", fact, {cancelable: true})) return false;
    this.applyEntries(patchAt(this.entries, path, patch));
    this.sfEmit("changed", fact);
    if (entry.keepOpen === false) this.closeAll();
    return true;
  }

  // A tile of a group does what its row would: a switch turns, a choice steps
  // on to the next option, a row with a submenu opens its level.
  pressTile(row, entry) {
    if (entry.type === "switch") return this.toggleSwitch(row, entry);
    if (entry.type === "choice") {
      const options = Array.isArray(entry.options) ? entry.options : [];
      if (!options.length) return false;
      const at = options.findIndex((option) => option.checked);
      return this.chooseOptionAt(row.dataset.sfEntry, entry, (at + 1) % options.length);
    }
    return false;
  }

  handleEntryClick(event) {
    const row = event.target?.closest?.(".sf-context-menu-item");
    if (!row || !this.contains(row) || row.matches(":disabled")) return;
    const entry = this.entryOf(row);
    if (!entry) return;
    if (row.dataset.sfOption !== undefined) {
      const chose = this.chooseOption(row, entry);
      // An option chosen in the level the row opened: the panel goes back to
      // the rows, the focus to the row it came from -- the choice is made.
      if (chose && row.classList.contains("sf-context-menu-level-option")) this.drillBack();
      return;
    }
    if (this.drill ? drillable(entry) : submenuOf(entry)) {
      event.preventDefault();
      if (this.drill) {
        // In place: the same panel, the same width, one level deeper. A
        // pointer leaves the focus where it is unless the level is a search.
        this.drillInto(row, {focus: event.detail === 0 || Boolean(entry.search)});
        return;
      }
      // A pointer leaves the focus where it is, unless the submenu is a search:
      // whoever opened a list to find something is about to type.
      this.openSubmenu(row, entry, {focus: event.detail === 0 || entry.search ? "first" : "none"});
      return;
    }
    // A value row: the row is the control, so a press on it changes the
    // setting and the menu stays open.
    if (row.classList.contains("sf-context-menu-tile")) {
      event.preventDefault();
      this.pressTile(row, entry);
      return;
    }
    if (entry.type === "switch") {
      event.preventDefault();
      this.toggleSwitch(row, entry);
      return;
    }
    const checkable = entry.kind === "check" || entry.kind === "radio";
    const detail = {id: entry.id ?? null, entry, checked: checkable ? (entry.kind === "radio" ? true : !entry.checked) : null};
    const selected = this.sfEmit("select", detail, {cancelable: true});
    // A choice ends the menu, unless the host cancelled the event to keep it
    // (a check list ticked several times) or the entry asked to stay.
    if (selected && !entry.keepOpen) this.closeAll({restoreFocus: !entry.href});
  }

  // A pointer resting on a row with a submenu opens it; resting on another
  // row of this menu closes the one that was open.
  handleEntryHover(event) {
    if (!this._owned || event.pointerType === "touch") return;
    const row = event.target?.closest?.(".sf-context-menu-item");
    if (!row || !this.contains(row) || row === this._hoverRow) return;
    this._hoverRow = row;
    clearTimeout(this._hoverTimer);
    this._hoverTimer = setTimeout(() => {
      if (this._hoverRow !== row || !this._owned) return;
      if (this.drill) return;
      const entry = this.entryOf(row);
      if (entry && submenuOf(entry) && !row.matches(":disabled")) {
        this.openSubmenu(row, entry, {focus: "none"});
      } else {
        this.closeSubmenu({restoreFocus: false});
      }
    }, 120);
  }

  // ─── opening (the menu owns its lifecycle when opened through openFor) ────
  toggleFor(anchor, options = {}) {
    if (this._owned?.anchor === anchor) {
      this.close();
      return Promise.resolve(false);
    }
    return this.openFor(anchor, options);
  }

  get isOpen() {
    return Boolean(this._owned);
  }

  surface() {
    return this.querySelector(":scope > .sf-context-menu");
  }

  // width: "content" (the default) lets the menu be as wide as its longest
  // line; "trigger" makes it exactly as wide as the control that opened it --
  // a site switcher, a profile button (owner, 2026-10-14) -- a long line ending
  // in an ellipsis; a CSS length fixes it. The attribute gives the default.
  async openFor(anchor, {side = "block-end", align = "start", focus = "first", parentMenu = null, alignmentOffset = 0, width = this.width} = {}) {
    if (!(anchor instanceof Element)) throw new TypeError("A menu opens for an element");
    if (this._owned) this.close({restoreFocus: false, ask: false});
    // The request first (§19, vocabulary §4): a listener that prevents it keeps
    // the menu closed.
    if (!this.sfEmit("open", {}, {cancelable: true})) return false;
    await this.whenRendered();
    const surface = this.surface();
    if (!surface) return false;
    // Focus goes back where it was, or to the control that opened the menu
    // when it was nowhere -- a press on an sf-button leaves it on the body in
    // some browsers, and the menu returned it there. A host element is not
    // itself focusable; its native control is.
    const focusable = (element) => (element?.matches?.("button, a[href], input, select, textarea, [tabindex]")
      ? element
      : element?.querySelector?.("button, a[href], input, select, textarea, [tabindex]") ?? element);
    const active = document.activeElement;
    this._owned = {
      anchor, parentMenu,
      returnTo: active instanceof HTMLElement && active !== document.body && active !== document.documentElement
        ? active
        : focusable(anchor),
      expanded: anchor.getAttribute("aria-expanded"),
      haspopup: anchor.getAttribute("aria-haspopup"),
    };
    anchor.setAttribute("aria-haspopup", "menu");
    anchor.setAttribute("aria-expanded", "true");
    // The top layer, where the platform has it: above every stacking context
    // and every clipping box, so a menu in a scrolled card is never cut and
    // never under the table it belongs to.
    surface.classList.add("sf-context-menu--open");
    if (typeof surface.showPopover === "function") {
      surface.setAttribute("popover", "manual");
      if (!surface.matches(":popover-open")) surface.showPopover();
    } else {
      surface.style.zIndex = "var(--sf-z-index-9)";
    }
    const content = this.querySelector(".sf-context-menu-content");
    const sized = width && width !== "content";
    if (sized && content) {
      const length = width === "trigger" ? `${anchor.getBoundingClientRect().width}px` : width;
      content.style.setProperty("--sf-context-menu--min-inline-size", length);
      content.style.setProperty("--sf-context-menu--max-inline-size", length);
      content.style.setProperty("inline-size", length);
      this._owned.sizedContent = content;
    }
    this._owned.position = position().anchor(anchor, surface, {
      side, align, alignmentOffset, flip: true, shift: true, fitHeight: true, matchWidth: width === "trigger",
    });
    document.addEventListener("pointerdown", this._onOutsidePress, true);
    // A menu it opens owns Escape, so the root says a surface is open: a record
    // panel listening on the document in capture runs before the menu's own
    // listener and would otherwise close with it.
    holdOpenSurfaceMark(this, true);
    this.sfEmit("opened", {});
    if (focus !== "none") {
      this.syncMenuItems();
      const items = this.availableMenuItems();
      const field = this.searchField();
      if (field && focus !== "last") field.focus({preventScroll: true});
      else (focus === "last" ? items[items.length - 1] : items[0])?.focus({preventScroll: true});
    }
    return true;
  }

  // reason says why (standard 1.3.8 §19.3): escape, outside, close (the head's
  // close button) or api (a choice, Tab, a script). A listener that prevents
  // sf-context-menu-close keeps the menu open; `ask: false` closes without
  // asking (the menu is leaving the page, or reopening).
  close({restoreFocus = true, reason = "api", ask = true} = {}) {
    const owned = this._owned;
    if (!owned) return false;
    if (ask && !this.sfEmit("close", {reason, unsaved: false}, {cancelable: true})) return false;
    this.closeSubmenu({restoreFocus: false});
    this._owned = null;
    this._hoverRow = null;
    // The next opening starts at the top level: a panel that reopened three
    // levels down is a panel that remembers what the person left behind.
    if (this._drill.length) {
      this._drill = [];
      this.requestComponentUpdate("drill");
    }
    // Cleared for the next opening, without telling a host-searched list:
    // closing is not a search.
    if (this._query) {
      this._query = "";
      this.requestComponentUpdate("query");
    }
    clearTimeout(this._hoverTimer);
    owned.position?.stop();
    for (const name of ["--sf-context-menu--min-inline-size", "--sf-context-menu--max-inline-size", "inline-size"]) {
      owned.sizedContent?.style.removeProperty(name);
    }
    document.removeEventListener("pointerdown", this._onOutsidePress, true);
    holdOpenSurfaceMark(this, false);
    const surface = this.surface();
    if (surface) {
      if (surface.matches?.(":popover-open")) surface.hidePopover();
      surface.removeAttribute("popover");
      surface.classList.remove("sf-context-menu--open");
      surface.style.removeProperty("z-index");
    }
    const {anchor} = owned;
    if (owned.haspopup === null) anchor.removeAttribute("aria-haspopup");
    else anchor.setAttribute("aria-haspopup", owned.haspopup);
    if (owned.expanded === null) anchor.setAttribute("aria-expanded", "false");
    else anchor.setAttribute("aria-expanded", owned.expanded);
    if (restoreFocus) (owned.returnTo?.isConnected ? owned.returnTo : anchor)?.focus?.({preventScroll: true});
    this.sfEmit("closed", {reason});
    return true;
  }

  // A choice in a submenu closes the whole chain and returns focus to where
  // the first menu was opened from.
  closeAll({restoreFocus = true, reason = "api"} = {}) {
    let root = this;
    while (root._owned?.parentMenu) root = root._owned.parentMenu;
    if (root === this) return this.close({restoreFocus, reason});
    return root.close({restoreFocus, reason});
  }

  async openSubmenu(row, entry, {focus = "first"} = {}) {
    if (this._submenu?._owned?.anchor === row) {
      if (focus !== "none") this._submenu.focus();
      return this._submenu;
    }
    this.closeSubmenu({restoreFocus: false});
    const child = document.createElement("sf-context-menu");
    child.setAttribute("aria-label", entry.text ?? "");
    child.setAttribute("popup", "");
    // A submenu is the size of the menu it opens from.
    if (this.size === "1") child.setAttribute("size", "1");
    child.entries = entry.submenu;
    if (entry.search) child.search = entry.search;
    // Selections in the submenu are the parent's to announce: a host listens
    // on one element whatever depth the item sits at.
    child.addEventListener("sf-context-menu-select", (event) => {
      event.stopPropagation();
      const forwarded = this.sfEmit("select", event.detail, {cancelable: true});
      if (!forwarded) event.preventDefault();
    });
    child.addEventListener("sf-context-menu-closed", () => {
      if (this._submenu === child) {
        this._submenu = null;
        child.remove();
      }
    });
    (this.closest("dialog[open]") || document.body).append(child);
    this._submenu = child;
    // The submenu's first row stands level with the row that opened it: the
    // panel moves up by its own padding and border, which this menu shares.
    const content = this.querySelector(".sf-context-menu-content");
    const style = content ? getComputedStyle(content) : null;
    const inset = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0) : 0;
    await child.openFor(row, {side: "inline-end", align: "start", focus, parentMenu: this, alignmentOffset: -inset});
    return child;
  }

  closeSubmenu({restoreFocus = true} = {}) {
    const child = this._submenu;
    if (!child) return false;
    this._submenu = null;
    child.close({restoreFocus, ask: false});
    child.remove();
    return true;
  }

  // Escape, Tab, typeahead and the submenu keys belong to a menu that owns its
  // lifecycle. A host that renders the menu itself keeps them, as before.
  handleOwnedKeyDown(event) {
    if (!this._owned || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!this.contains(event.target)) return;
    const rtl = getComputedStyle(this.surface() ?? document.documentElement).direction === "rtl";
    const inward = rtl ? "ArrowLeft" : "ArrowRight", outward = rtl ? "ArrowRight" : "ArrowLeft";
    // In a range row the side arrows, Home, End and the digits are the
    // slider's: the platform moves the value. The menu keeps Escape, Tab and
    // its own up and down walk.
    if (event.target?.classList?.contains("sf-context-menu-range-input")
      && !["Escape", "Tab", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    // Inside a choice row the side arrows move between its options.
    const option = event.target?.closest?.(".sf-context-menu-choice-option");
    if (option && (event.key === inward || event.key === outward)) {
      const options = Array.from(option.parentElement.querySelectorAll(".sf-context-menu-choice-option:not(:disabled)"));
      const at = options.indexOf(option);
      const next = options[(at + (event.key === inward ? 1 : options.length - 1)) % options.length];
      event.preventDefault();
      next?.focus();
      return;
    }
    // In the search field the letters and the side arrows are the field's;
    // ArrowDown goes on to the rows, and Escape still closes.
    if (event.target === this.searchField() && event.key !== "Escape" && event.key !== "Tab") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.syncMenuItems();
        this.availableMenuItems()[0]?.focus();
      }
      return;
    }
    // One level back before the menu closes: the way out of a drilling panel
    // is the way it came in. Escape at the top level closes it, as before.
    if (this._drill.length && (event.key === "Escape" || event.key === outward)) {
      event.preventDefault();
      event.stopPropagation();
      this.drillBack();
      return;
    }
    if (event.key === "Escape" || (event.key === outward && this._owned.parentMenu)) {
      event.preventDefault();
      event.stopPropagation();
      this.close({reason: event.key === "Escape" ? "escape" : "api"});
      return;
    }
    if (event.key === "Tab") {
      // Tab leaves the menu for the page; the menu does not trap it.
      this.closeAll({restoreFocus: true});
      return;
    }
    const entry = this.entryOf(event.target);
    if (event.key === inward && (this.drill ? drillable(entry) : submenuOf(entry))) {
      event.preventDefault();
      const row = event.target.closest(".sf-context-menu-item");
      if (this.drill) this.drillInto(row);
      else this.openSubmenu(row, entry, {focus: "first"});
      return;
    }
    if (event.key.length === 1 && event.key !== " ") this.typeahead(event);
  }

  typeahead(event) {
    const now = Date.now();
    this._typeahead.text = (now - this._typeahead.at > TYPEAHEAD_MS ? "" : this._typeahead.text) + event.key.toLowerCase();
    this._typeahead.at = now;
    const items = this.availableMenuItems();
    const from = Math.max(0, items.indexOf(event.target));
    const ordered = [...items.slice(from + (this._typeahead.text.length === 1 ? 1 : 0)), ...items.slice(0, from + 1)];
    const found = ordered.find((item) => (item.querySelector(".sf-context-menu-item-label")?.textContent ?? item.textContent)
      .trim().toLowerCase().startsWith(this._typeahead.text));
    if (!found) return;
    event.preventDefault();
    found.focus();
  }

  handleMenuKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Home and End take a slider to its ends; the menu does not take them away.
    if (event.target?.classList?.contains("sf-context-menu-range-input")
      && (event.key === "Home" || event.key === "End")) return;
    const items = this.availableMenuItems(), index = items.indexOf(event.target);
    if (index < 0) return;
    let next;
    switch (event.key) {
      case "ArrowDown": next = (index + 1) % items.length; break;
      case "ArrowUp": next = (index + items.length - 1) % items.length; break;
      case "Home": next = 0; break;
      case "End": next = items.length - 1; break;
      default: return; // Native activation and host-owned Tab/Escape remain intact.
    }
    event.preventDefault();
    event.stopPropagation();
    items[next].focus();
  }

  // The manifest's settings, and what the menu reads more closely (its
  // position's old words, the lists set as properties, the host's role).
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: "template", default: "default" },
      position: { default: "" },
      tooltip: { type: Boolean, default: true },
      text: { default: "" },
      items: {type: Array, default: []},
      entries: {type: Array, default: []},
      popup: {type: Boolean, default: false},
      role: { default: "menu" },
      contentClass: { default: "" },
      rootClass: { default: "" },
      // The menu's size: "1/2" (32px rows, the default) or "1" (40px rows).
      size: { default: "1/2" },
      // How wide the menu opens: "content" (its longest line, the default),
      // "trigger" (exactly the control that opened it) or a CSS length.
      width: { default: "content" },
      // A panel with tabs (owner, 2026-10-15): the tabs and the way out on a
      // head that never scrolls, the rows of the chosen tab in a body that
      // does, the actions in a footer that stays. "A|B" or [{id, label}].
      tabs: { default: "" },
      // The chosen tab's id (or index); the host shows that tab's rows.
      activeTab: { attribute: "active-tab", default: "" },
      // A close button at the end of the head.
      closable: { type: Boolean, default: false },
    };
  }

  // The tabs as [{id, label}]: a string list names each tab by its label.
  get tabs() {
    const raw = Array.isArray(this._tabs) ? this._tabs : (this.getAttribute("tabs") || "");
    const list = Array.isArray(raw) ? raw : String(raw).split("|").map((label) => label.trim()).filter(Boolean);
    return list.map((tab, index) => (typeof tab === "string"
      ? {id: tab, label: tab, index}
      : {id: String(tab.id ?? index), label: String(tab.label ?? tab.id ?? index), index}));
  }

  set tabs(value) {
    if (Array.isArray(value)) {
      this._tabs = value;
      this.requestComponentUpdate("tabs");
      return;
    }
    this._tabs = null;
    this.setState({tabs: value ? String(value) : ""});
  }

  get activeTab() {
    const tabs = this.tabs;
    const asked = this.getAttribute("active-tab") ?? "";
    return tabs.find((tab) => tab.id === asked) ?? tabs[Number(asked)] ?? tabs[0] ?? null;
  }

  get closable() {
    return this.getBooleanAttr("closable", false);
  }

  get panel() {
    return this.tabs.length > 0;
  }

  // A tab chosen: the head marks it and says so; the host puts that tab's
  // rows in the body. The panel keeps its width -- it is fixed, never the
  // width of what a tab holds.
  chooseTab(index) {
    const tab = this.tabs[index];
    if (!tab || tab.id === this.activeTab?.id) return this;
    this.setState({activeTab: tab.id});
    this.sfEmit("tab", {id: tab.id, index: tab.index});
    return this;
  }

  // The head's close button: an owned menu closes itself; a menu its host
  // placed is closed by the host, which hears the same event either way.
  requestClose() {
    if (this._owned) return this.close({reason: "close"});
    this.sfEmit("close", {reason: "close", unsaved: false}, {cancelable: true});
    return true;
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  get position() {
    return normalizePosition(this.getAttribute("position"));
  }

  // The host's role (§3.1): a menu unless the page says otherwise.
  get menuRole() {
    return this.getAttribute("role") || "menu";
  }

  templateContext() {
    const props = this.getPropsContext();
    const level = this.drillLevel();

    return this.createTemplateContext({
      ...props,
      entries: this.entries,
      search: level.search ?? this.search,
      query: this.query,
      tabs: this.tabs,
      activeTab: this.activeTab,
      closable: this.closable,
      closeLabel: this.sfWord("close"),
      backLabel: this.sfWord("back"),
      // What a switch tile says it is set to, in the menu's language.
      onLabel: this.sfWord("on"),
      offLabel: this.sfWord("off"),
      drill: this.drill,
      level,
      role: this.menuRole,
      panel: this.panel,
      position: this.position,
      size: this.size,
      component: this,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderContextMenuTemplate(this.templateContext());
  }
}

SfContextMenu.define("sf-context-menu");
