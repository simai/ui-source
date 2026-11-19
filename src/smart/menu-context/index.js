import SfBaseElement from "../../core/js/smart-base";
import { densityOf, followDensity, sizeOf, sizeStep } from "../../core/js/density.js";
import { elementFromManifest } from "../../core/js/element-manifest";
import BundledPosition from "../../core/js/position.js";
import { renderContextMenuTemplate } from "./js/templates/default";
import { holdOpenSurfaceMark } from "../../core/js/open-surface-mark";
import { tagSelector } from "../../core/js/tag-aliases.js";
import { noteDeprecated } from "../../core/js/deprecations.js";
import { PanelScrollbar } from "../../component/panel-scrollbar.js";
import { swipeToClose } from "../../core/js/sheet-swipe.js";
import manifest from "./component.json";
import aliases from "./aliases.json";
import {files as languageFiles} from "./lang/index.mjs";
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// sf-menu-context from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8, §19): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, and its events
// go out by their verbs through sfEmit. aria-label and role stay the host's.
const ContextMenuElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: "ru",
  aliases,
  // openFor(anchor, options), toggleFor(anchor, options), openAt(x, y, options) and chooseTab(index)
  // take their fields in order; the runtime gives them the object form of
  // §4.4 as well: openFor({anchor, options}), chooseTab({index}).
  positional: ["open-for", "toggle-for", "open-at", "choose-tab"],
});

// Prefer the helper Core published; a bundle loaded without core.js still
// positions with its own copy.
const position = () => globalThis.SF?.Position || BundledPosition;

// What a point anchor stands for (sf-menu-context 1.18.0). An anchor is a
// point when it draws a box of no size: a fixed span at the pointer of a
// right-click. A host that draws no box of its own (display: contents, as
// sf-button) or a hidden element is not one. Answers null for any other
// anchor, else {under, focusable, lent}: the page's element under the point
// (never the anchor or the menu), and what takes the focus back when the
// menu closes and nothing held it before (CM-2): the nearest focusable
// element from it up, else the element itself, lent a tabindex.
const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]";
function pointOf(anchor, menu) {
  if (!anchor.getClientRects?.().length) return null;
  const rect = anchor.getBoundingClientRect();
  if (rect.width !== 0 || rect.height !== 0) return null;
  const document = anchor.ownerDocument;
  const under = (document.elementsFromPoint?.(rect.left, rect.top) ?? [])
    .find((element) => element !== anchor && !menu.contains(element) && element !== document.documentElement && element !== document.body);
  if (!under) return {under: null, focusable: null, lent: false};
  const near = under.closest(FOCUSABLE);
  return near && near !== document.body ? {under, focusable: near, lent: false} : {under, focusable: under, lent: true};
}

// Focus to an element that may not take it: lent a tabindex of -1 (focusable
// from script, never a Tab stop) until it loses the focus.
function focusLent(element, options) {
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener("blur", () => {
      if (element.getAttribute("tabindex") === "-1") element.removeAttribute("tabindex");
    }, {once: true});
  }
  element.focus(options);
}

const TYPEAHEAD_MS = 500;
// The menus' own numbers for the ids of their icon options' tooltips.
let menuTips = 0;

// A tooltip that repeats what is in the row's name is not its description.
function dropDescription(row, id) {
    const rest = (row.getAttribute("aria-describedby") || "").split(/\s+/u).filter((one) => one && one !== id);
    if (rest.length) row.setAttribute("aria-describedby", rest.join(" "));
    else row.removeAttribute("aria-describedby");
}

// A menu without `popup` is drawn in place, as its contract says: opened
// through openFor() it floats, and once closed it is drawn where it stands
// again -- with the entries it was last given (sf-editor, evidence
// control/evidence/2026-11-12-menu-context-closed). The contract is unchanged;
// the development warning says so once per page, naming the first such menu.
const IN_PLACE_OPEN_SAID = Symbol.for("sf.menu-context.in-place-open-said");
function sayInPlaceOpen(menu) {
  if (globalThis[IN_PLACE_OPEN_SAID] || menu.hasAttribute("popup")) return;
  globalThis[IN_PLACE_OPEN_SAID] = true;
  const name = menu.id ? `#${menu.id}` : (menu.className ? `${menu.localName}.${String(menu.className).trim().split(/\s+/u)[0]}` : menu.localName);
  console.warn(`SIMAI Framework: ${name} was opened through openFor() without the popup attribute. A menu without popup is drawn in place, so it stays drawn after it closes; add popup to a menu that only opens from a control or a right click.`);
}

// How wide a popup is by what it holds (owner decision C32, 2026-11-09): the
// class sheet sizes each from core's --sf-popup-*-width steps, which follow
// the density. "content" (the default) is the menu's rule.
const WIDTH_KINDS = new Set(["list", "panel", "form", "form-wide"]);
const FORM_KINDS = new Set(["form", "form-wide"]);
// On a phone -- below the md breakpoint, where core declares
// --sf-breakpoint-md -- a form is a sheet at the bottom of the screen. A
// tablet (md up to lg) has room for the form's step beside its control, so it
// keeps the anchored form; a sheet there was a full-width strip for a field
// (C32 acceptance, 2026-11-09).
const onPhone = () => !getComputedStyle(document.documentElement).getPropertyValue("--sf-breakpoint-md").trim();
// What a form, a panel or a slot's own markup holds instead of rows: the
// first of these takes the focus when the menu has no row and no search.
const TABBABLE = 'input:not([type="hidden"]), select, textarea, button, a[href], [tabindex]:not([tabindex="-1"]), [contenteditable=""], [contenteditable="true"]';
// A panel's list (R193, DP-4): the rows of one container that each hold a
// checkable mark -- a checkbox or a switch -- are one Tab stop, and the
// arrows walk them, as a menu's rows (APG). One of several is a radio group,
// whose native radios of one name already are one stop with arrows; they are
// not walked here.
const ROW_MARK = 'input[type="checkbox"], [role="checkbox"], [role="switch"]';
const editable = (element) => Boolean(element?.matches?.('input, select, textarea, [contenteditable=""], [contenteditable="true"]'));

// ─── the menu of an object (owner decision C164, 2026-11-14) ───────────────
// `for` names the page's areas -- a list, a table, a tree, a canvas -- whose
// objects open this menu by the right button, the menu key (Shift+F10 too)
// and a long press on a touch screen: one setting, one menu, the same list
// the object's «⋯» opens (C164 (1), (2)). The object is the row the event
// came from: a table body's row, an element with a row, option, tree item or
// list item role, or a list item; an area without rows is one object itself.
const TARGETS = 'tbody > tr, [role="row"]:not(:has(> [role="columnheader"])), [role="option"], [role="treeitem"], [role="listitem"], li';
// Where the browser's own menu stays: a link, a field and text being edited,
// selected text and the right button with Shift (C164 (1)). A field is one
// that takes typed text: a text-like input, a textarea, editable text and a
// textbox, searchbox or combobox with text entry (an editable one). A
// checkbox, a radio, a switch, a select and a button are not: their browser
// menu offers nothing, and a row's selection checkbox is where the keyboard
// stands in a table, so the menu key there opens the row's menu (1.27.3).
const BROWSER_KEEPS = 'a[href], textarea, [role="textbox"], [role="searchbox"]';
const TEXT_ENTRY_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "time", "datetime-local", "month", "week"]);
const keepsBrowserMenu = (node) => node instanceof Element && (node.matches(BROWSER_KEEPS) || node.isContentEditable
  || (node.localName === "input" && TEXT_ENTRY_TYPES.has(node.type)));
// The node an area's event came from and every node above it up to the
// object, through the shadow roots between them (the composed path): one of
// them that keeps the browser's menu keeps it for the event.
const keptBy = (event, target) => {
  const path = event.composedPath?.() ?? [event.target];
  for (const node of path) {
    if (keepsBrowserMenu(node) && holds(target, node)) return true;
    if (node === target) break;
  }
  return false;
};
// A long press: half a second, the finger still within ten pixels (the
// platforms' own slop); a move further is a scroll.
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;
const ids = (value) => String(value ?? "").trim().split(/\s+/u).filter(Boolean);
// An area may stand in a shadow root -- a view's own table (sf-menu-context
// 1.27.0). The page's events come to the document retargeted to the shadow
// host; the node the event really came from is the first of its composed
// path. Each area reads it in its own tree: the node walks up through the
// hosts to the root the area stands in -- for an area of the document that is
// event.target, as it always was; for an area in a shadow root, the row.
const origin = (event) => {
  const node = event.composedPath?.()[0] ?? event.target;
  return node instanceof Element ? node : (node?.parentElement ?? event.target);
};
const hostOf = (node) => {
  const root = node?.getRootNode?.();
  return root && root !== node && root.host ? root.host : null;
};
const inTreeOf = (node, element) => {
  const root = element.getRootNode();
  let at = node;
  while (at && at.getRootNode() !== root) at = hostOf(at);
  return at;
};
const holds = (outer, node) => {
  const at = node && inTreeOf(node, outer);
  return Boolean(at && outer.contains(at));
};
// The focused element itself, inside the shadow roots it stands in.
const deepActive = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};
const selected = (element) => element?.getAttribute?.("aria-selected") === "true";

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
// The page's events the areas named by `for` open the menu by (C164).
const AREA_EVENTS = ["contextmenu", "keydown", "pointerdown", "pointermove", "pointerup", "pointercancel", "click"];

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
    this._rowMarks = new Map();
    this._rowCurrent = new WeakMap();
    this.addEventListener("keydown", this.handleRowKeyDown);
    this.addEventListener("keydown", this.handleMenuKeyDown);
    this.addEventListener("keydown", this.handleOwnedKeyDown);
    this.addEventListener("click", this.handleEntryClick);
    this.addEventListener("pointerover", this.handleEntryHover);
    // A drilling row's cut value (TT-11): its tooltip, made on the first
    // hover or keyboard focus.
    this.addEventListener("pointerover", (event) => this.syncValueTooltip(event));
    this.addEventListener("focusin", (event) => this.syncValueTooltip(event));
    // The objects of the areas named by `for` (C164): the page's events,
    // heard on the document while the menu is in the page.
    this._onAreaEvent = (event) => this.handleAreaEvent(event);
    this._press = null;
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
    // Areas given as the property before the element was defined (1.27.0).
    if (Object.prototype.hasOwnProperty.call(this, "for")) {
      const early = this.for;
      delete this.for;
      this.for = early;
    }
    if (Object.prototype.hasOwnProperty.call(this, "entries")) {
      const early = this.entries;
      delete this.entries;
      this._entries = Array.isArray(early) ? early : null;
    }
    // A press outside, from the layer stack's one listener while this menu is
    // the top layer (§19.3). The stack hears only the top one, the deepest
    // submenu, so the walk goes up the chain: every menu the press is outside
    // of closes, from the outermost, and a press on a parent row closes only
    // the submenus below it -- as when each menu kept a listener of its own.
    this._onOutsidePress = (event) => {
      const path = event.composedPath();
      let outermost = null;
      for (let menu = this; menu?._owned; menu = menu._owned.parentMenu) {
        if (path.includes(menu) || path.includes(menu._owned.anchor)) break;
        // A press inside an open submenu is inside the menu.
        if (menu._submenu && path.includes(menu._submenu)) break;
        outermost = menu;
      }
      if (!outermost) return;
      // A parent that refuses to close (sf-menu-context-close prevented) keeps
      // itself open; the submenu the press was outside of still closes.
      if (!outermost.close({restoreFocus: false, reason: "outside"}) && outermost !== this) {
        this.close({restoreFocus: false, reason: "outside"});
      }
    };
    this.addEventListener("focusin", (event) => {
      const list = this.rowListOf(event.target);
      if (list) {
        this._rowCurrent.set(list.parent, event.target);
        this.syncRowLists();
      }
      if (this.menuItems().includes(event.target)) {
        this._currentItem = event.target;
        this.syncMenuItems();
      }
    });
    this.addEventListener("sf-after-render", (event) => {
      if (event.target !== this && event.target.closest(tagSelector("sf-menu-context")) === this) {
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
    this.watchScrollbar();
    // An icon option names itself by the Framework's tooltip (C160 (1)):
    // the controller is a lazy plugin, asked for once a menu draws one.
    if (!this._tipsAsked && this.querySelector(".sf-context-menu-choice-option[data-tooltip]")) {
      this._tipsAsked = true;
      globalThis.SF?.Loader?.ensurePlugin?.("tooltip");
    }
    const content = this.querySelector(".sf-context-menu-content");
    if (content) this._itemObserver.observe(content, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["disabled", "aria-disabled", "hidden", "inert"],
    });
  }

  // The scrollbar stands in the inline-end inset only while it takes room
  // (owner C07, R029): the area that scrolls the rows -- the rows' area under
  // a search, else the content of a menu that is not a panel -- gives up its
  // inline-end padding then, and keeps it beside an overlay scrollbar or none.
  // Read whenever the area is drawn or changes its size: a narrowed search, a
  // panel fitted to its room, a window made smaller.
  // A panel with tabs scrolls its body, under the head and over the footer
  // (the scroll-area inset rule, owner C106 addendum to C105, 2026-11-12).
  scrollArea() {
    return this.querySelector(".sf-context-menu-content--search > .sf-context-menu-list")
      ?? this.querySelector(":scope > .sf-context-menu.sf-context-menu--panel > .sf-context-menu-frame > .sf-context-menu-content > .sf-context-menu-body")
      ?? this.querySelector(":scope > .sf-context-menu:not(.sf-context-menu--panel) > .sf-context-menu-frame > .sf-context-menu-content");
  }

  // The mark itself is shared with every dropping panel
  // (src/component/panel-scrollbar.js).
  watchScrollbar() {
    const area = this.scrollArea();
    const name = area?.classList.contains("sf-context-menu-list") ? "sf-context-menu-list--scrollbar"
      : area?.classList.contains("sf-context-menu-body") ? "sf-context-menu-body--scrollbar" : "sf-context-menu-content--scrollbar";
    this._scrollbar ??= new PanelScrollbar();
    this._scrollbar.watch(area, name);
  }

  connectedCallback() {
    super.connectedCallback();
    for (const type of AREA_EVENTS) document.addEventListener(type, this._onAreaEvent, type === "click");
  }

  disconnectedCallback() {
    for (const type of AREA_EVENTS) document.removeEventListener(type, this._onAreaEvent, type === "click");
    this.cancelPress();
    this._point?.remove();
    this._point = null;
    // Taken out of the page, it closes without asking: nothing is left to keep.
    if (this._owned) this.close({restoreFocus: false, ask: false});
    this._itemObserver.disconnect();
    this._scrollbar?.disconnect();
    for (const item of this._itemAttributes.keys()) this.releaseItem(item);
    for (const mark of [...this._rowMarks.keys()]) this.releaseRowMark(mark);
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

  // A row the menu drew from a disabled entry is dimmed but stays in the
  // walk, so its reason -- the caption -- is read (owner decision C164 (4);
  // APG: disabled menu items are focusable but cannot be activated). It is
  // aria-disabled, never disabled, and a press on it does nothing.
  availableMenuItems() {
    return this.menuItems().filter(item => !item.matches(":disabled") &&
      (item.matches(".sf-context-menu-item--disabled") || !item.closest('[aria-disabled="true"]')) &&
      !item.closest('[hidden], [inert], sf-button[disabled]') &&
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
    this.syncRowLists();
  }

  // ─── a panel's lists (R193, DP-4) ───────────────────────────────────────
  // The lists of rows in the menu's content: rows of one container, each
  // with a checkable mark, two or more of them. A row's mark is its first
  // checkbox or switch; a handle or a pin beside it keeps its own stop.
  rowLists() {
    const content = this.querySelector(".sf-context-menu-content");
    if (!content) return [];
    const lists = new Map();
    for (const row of content.querySelectorAll(".sf-context-menu-row")) {
      const mark = row.querySelector(ROW_MARK);
      if (!mark || mark.closest(".sf-context-menu-row") !== row) continue;
      const parent = row.parentElement;
      if (!lists.has(parent)) lists.set(parent, []);
      lists.get(parent).push(mark);
    }
    return Array.from(lists, ([parent, marks]) => ({parent, marks})).filter((list) => list.marks.length > 1);
  }

  rowListOf(element) {
    if (!element?.matches?.(ROW_MARK) || !element.closest?.(".sf-context-menu-row")) return null;
    return this.rowLists().find((list) => list.marks.includes(element)) ?? null;
  }

  availableRowMarks(list) {
    return list.marks.filter((mark) => !mark.matches(":disabled") && mark.getAttribute("aria-disabled") !== "true"
      && !mark.closest("[hidden], [inert]") && mark.getClientRects().length > 0);
  }

  // One stop per list: the mark last focused in it, else its first one. A
  // mark that left the lists gets back the tabindex it had.
  syncRowLists() {
    const kept = new Set();
    for (const list of this.rowLists()) {
      const available = this.availableRowMarks(list);
      let current = this._rowCurrent.get(list.parent);
      if (!available.includes(current)) current = available[0] ?? null;
      this._rowCurrent.set(list.parent, current);
      for (const mark of list.marks) {
        kept.add(mark);
        if (!this._rowMarks.has(mark)) this._rowMarks.set(mark, mark.getAttribute("tabindex"));
        const tabindex = mark === current ? "0" : "-1";
        if (mark.getAttribute("tabindex") !== tabindex) mark.setAttribute("tabindex", tabindex);
      }
    }
    for (const mark of [...this._rowMarks.keys()]) if (!kept.has(mark)) this.releaseRowMark(mark);
  }

  releaseRowMark(mark) {
    const original = this._rowMarks.get(mark);
    this._rowMarks.delete(mark);
    if (original === null || original === undefined) mark.removeAttribute("tabindex");
    else mark.setAttribute("tabindex", original);
  }

  // Up and down walk a list, Home and End go to its ends; Space is the mark's
  // own and checks it, Tab leaves the list.
  handleRowKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const list = this.rowListOf(event.target);
    if (!list) return;
    const marks = this.availableRowMarks(list), index = marks.indexOf(event.target);
    if (index < 0) return;
    let next;
    switch (event.key) {
      case "ArrowDown": next = (index + 1) % marks.length; break;
      case "ArrowUp": next = (index + marks.length - 1) % marks.length; break;
      case "Home": next = 0; break;
      default: next = marks.length - 1;
    }
    event.preventDefault();
    event.stopPropagation();
    this._rowCurrent.set(list.parent, marks[next]);
    this.syncRowLists();
    marks[next].focus();
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

  // The controls of the open surface that Tab reaches, in order.
  tabbables() {
    const surface = this.surface() ?? this;
    return Array.from(surface.querySelectorAll(TABBABLE)).filter((element) => !element.matches(":disabled")
      && element.getAttribute("tabindex") !== "-1"
      && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== "hidden");
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
    // A dimmed row is read, not chosen (C164 (4)).
    if (row.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
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
        // In place: the same panel, the same width, one level deeper. The
        // row that held the focus is gone from the level, so the focus always
        // moves into it: left behind it falls to the body, where no key of the
        // menu is heard. Moved by a pointer, it draws no ring.
        this.drillInto(row, {focus: true});
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

  // The value under a drilling row's name (TT-11, owner decision C160 (1)):
  // one line, cut with an ellipsis where it is long. A cut value is the row's
  // Framework tooltip on hover, keyboard focus or a long press, not a browser
  // title: the surface stands after the row, named by its data-tooltip, and
  // the tooltip controller (component tooltip, asked for here) shows it. It is
  // measured each time the row is reached, so a value that fits loses it. The
  // value is already in the row's name, so the surface is not its
  // description too (a screen reader would say the value twice).
  syncValueTooltip(event) {
    if (event.type === "pointerover" && event.pointerType === "touch") return;
    const row = event.target?.closest?.(".sf-context-menu-item");
    if (!row || row.closest(tagSelector("sf-menu-context")) !== this) return;
    const under = row.querySelector(".sf-context-menu-item-under");
    if (!under) return;
    const next = row.nextElementSibling;
    let tip = next?.classList?.contains("sf-context-menu-value-tooltip") ? next : null;
    const words = (under.textContent || "").replace(/\s+/gu, " ").trim();
    const cut = under.scrollWidth > under.clientWidth + 1;
    if (!cut || !words) {
      if (tip) {
        if (row.getAttribute("data-tooltip") === tip.id) row.removeAttribute("data-tooltip");
        tip.remove();
      }
      return;
    }
    const fresh = !tip;
    if (!tip) {
      const doc = this.ownerDocument;
      tip = doc.createElement("span");
      tip.className = "sf-tooltip sf-tooltip--dark sf-context-menu-value-tooltip";
      tip.hidden = true;
      const content = doc.createElement("span");
      content.className = "sf-tooltip-content";
      const text = doc.createElement("span");
      text.className = "sf-tooltip-text";
      content.append(text);
      tip.append(content);
      const prefix = this._tipPrefix ??= `sf-menu-tip-${++menuTips}`;
      tip.id = `${prefix}-${String(row.dataset.sfEntry ?? "").replace(/[^\w-]/gu, "-")}-value`;
      row.after(tip);
    }
    const text = tip.querySelector(".sf-tooltip-text");
    if (text && text.textContent !== words) text.textContent = words;
    if (row.getAttribute("data-tooltip") !== tip.id) row.setAttribute("data-tooltip", tip.id);
    if (!fresh) {
      dropDescription(row, tip.id);
      return;
    }
    // The first time: the controller links the row on its own (its observer)
    // and is handed the event that woke the tooltip while it still holds.
    const kind = event.type;
    const pointerType = event.pointerType;
    const handOver = () => setTimeout(() => {
      if (row.getAttribute("data-tooltip") !== tip.id) return;
      dropDescription(row, tip.id);
      if (kind === "pointerover" && row.matches(":hover")) {
        row.dispatchEvent(new PointerEvent("pointerenter", {pointerType}));
      } else if (kind === "focusin" && this.ownerDocument.activeElement === row) {
        row.dispatchEvent(new FocusEvent("focusin"));
      }
    }, 0);
    const loader = globalThis.SF?.Loader;
    if (globalThis.SF?.ComponentRegistry?.Tooltip || loader?.ComponentRegistry?.Tooltip) {
      handOver();
      return;
    }
    loader?.ensurePlugin?.("tooltip");
    if (typeof loader?.ready === "function") loader.ready("Tooltip", handOver);
    else globalThis.addEventListener?.("Tooltip:ready", handOver, {once: true});
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
      if (entry && submenuOf(entry) && !row.matches(':disabled, [aria-disabled="true"]')) {
        this.openSubmenu(row, entry, {focus: "none"});
      } else {
        this.closeSubmenu({restoreFocus: false});
      }
    }, 120);
  }

  // ─── opening (the menu owns its lifecycle when opened through openFor) ────
  // Both answer an outcome (§4.4): applied with `value`, whether the menu is
  // open afterwards; refused {reason: prevented} when a listener kept it as it
  // was, {reason: invalid} for an anchor that is not an element; unavailable
  // when the menu has no surface to open.
  toggleFor(anchor, options = {}) {
    if (this._owned?.anchor === anchor) {
      const closed = this.close();
      return Promise.resolve(closed ? {outcome: "applied", value: false} : {outcome: "refused", reason: "prevented"});
    }
    return this.openFor(anchor, options);
  }

  get isOpen() {
    return Boolean(this._owned);
  }

  // The menu takes the size step of what opens it (owner remark 2026-11-15):
  // the opener's size, else its component's or the Smart component holding
  // it (core density.js sizeOf); its two steps are "1/2" for an opener below
  // 1 and "1" from 1 up, as sf-button's own menu reads its size. A size the
  // page or a host gave the menu wins: the menu takes the opener's only while
  // its size attribute is the one it wrote itself, and writes it again on
  // every opening, so one menu opened from two tables follows each.
  followOpenerSize(place) {
    if (this.hasAttribute("size") && this._openerSize === undefined) return;
    const step = sizeStep(sizeOf(place));
    const size = Number.isNaN(step) ? null : step < 1 ? "1/2" : "1";
    this._writingSize = true;
    try {
      if (size === null) this.removeAttribute("size");
      else if (this.getAttribute("size") !== size) this.setAttribute("size", size);
    } finally {
      this._writingSize = false;
    }
    this._openerSize = size === null ? undefined : size;
  }

  // A size written by anyone but the menu itself is the menu's own: it wins
  // over the opener's from then on.
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "size" && !this._writingSize) this._openerSize = undefined;
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  // Open with the menu's corner exactly at a point of the screen -- the
  // pointer's -- with no gap (CM-5), flipping at the edges. `target` is the
  // object it acts on: the focus goes back to it, and on a phone the menu is
  // the sheet at the bottom (C164 (6)). The options are openFor()'s.
  openAt(x, y, options = {}) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return Promise.resolve({outcome: "refused", reason: "invalid"});
    if (!this._point) {
      this._point = document.createElement("span");
      this._point.setAttribute("aria-hidden", "true");
      this._point.className = "sf-context-menu-point";
    }
    // Where the menu is, so a dialog's top layer holds it as it holds the menu.
    (this.closest("dialog[open]") || document.body).append(this._point);
    // The point is drawn by the menu's sheet (.sf-context-menu-point): a
    // zero box fixed to the screen; only where it stands is set here.
    this._point.style.left = `${Number(x)}px`;
    this._point.style.top = `${Number(y)}px`;
    return this.openFor(this._point, {side: "block-end", align: "start", offset: "0px", ...options});
  }

  // ─── the areas named by `for` (C164) ─────────────────────────────────────
  // `for` is the areas' ids in the attribute; the property also takes a list
  // of the areas themselves, or of ids, for an area the page cannot name by
  // an id the document sees -- a table in a shadow root (1.27.0). A list set
  // as the property is kept until a string is set.
  get for() {
    return Array.isArray(this._forList) ? this._forList.slice() : (this.getAttribute("for") ?? "");
  }

  set for(value) {
    if (Array.isArray(value)) {
      this._forList = value.slice();
      return;
    }
    this._forList = null;
    if (value === null || value === undefined || value === "") this.removeAttribute("for");
    else this.setAttribute("for", String(value));
  }

  // The areas named by `for`: the elements it was given, and each id found
  // in the menu's own root, in the root of the control it is open for, then
  // in the document.
  areas() {
    const given = Array.isArray(this._forList) ? this._forList : ids(this.getAttribute("for"));
    const roots = [...new Set([this.getRootNode?.(), this._owned?.anchor?.getRootNode?.(), document])]
      .filter((root) => typeof root?.getElementById === "function");
    const areas = [];
    for (const one of given) {
      const area = one instanceof Element ? one
        : typeof one === "string" ? roots.map((root) => root.getElementById(one)).find(Boolean) : null;
      if (area?.isConnected && !areas.includes(area)) areas.push(area);
    }
    return areas;
  }

  // The object a node of the page stands in: {area, target}, or null outside
  // every area.
  targetOf(node) {
    if (!(node instanceof Element)) return null;
    for (const area of this.areas()) {
      const at = inTreeOf(node, area);
      if (!at || !area.contains(at)) continue;
      const row = at.closest(TARGETS);
      return {area, target: row && row !== area && area.contains(row) ? row : area};
    }
    return null;
  }

  // Which objects the menu acts on (C164 (3)): every selected row of the
  // area when the row is selected (aria-selected="true"); a row that can be
  // selected and is not is selected alone first (`select` lists the rows
  // that lose their selection); any other object is acted on alone.
  selectionOf({area, target}) {
    if (!area || target === area) return {targets: [target], select: null};
    const rows = Array.from(area.querySelectorAll(TARGETS));
    if (selected(target)) {
      const all = rows.filter(selected);
      return {targets: all.length ? all : [target], select: null};
    }
    if (target.hasAttribute("aria-selected")) return {targets: [target], select: rows.filter((row) => row !== target && selected(row))};
    return {targets: [target], select: null};
  }

  // The rows the open menu acts on (empty when it is not open for an object).
  get targets() {
    return this._targets ?? [];
  }

  // The right button with Shift, a link, a field and selected text keep the
  // browser's own menu (C164 (1)).
  browserKeeps(event, target) {
    if (event.shiftKey && event.type === "contextmenu" && event.button === 2) return true;
    if (keptBy(event, target)) return true;
    const root = target.getRootNode?.();
    const selection = (typeof root?.getSelection === "function" ? root : document).getSelection?.();
    return Boolean(selection && !selection.isCollapsed && String(selection).trim()
      && selection.anchorNode && holds(target, selection.anchorNode));
  }

  // The menu at an object opened from the keyboard: under its start.
  openAtTarget(target, options = {}) {
    const rect = target.getBoundingClientRect();
    const rtl = getComputedStyle(target).direction === "rtl";
    return this.openAt(rtl ? rect.right : rect.left, Math.min(rect.bottom, window.innerHeight), {...options, target});
  }

  cancelPress() {
    if (this._press?.timer) clearTimeout(this._press.timer);
    this._press = null;
  }

  handleAreaEvent(event) {
    const {type} = event;
    if (type === "pointermove") {
      const press = this._press;
      if (press && !press.fired && Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) this.cancelPress();
      return;
    }
    if (type === "pointerup" || type === "pointercancel") {
      if (this._press && !this._press.fired) this.cancelPress();
      return;
    }
    if (type === "click") {
      // The lift after a long press is not a press on the row.
      if (this._press?.fired) {
        const {at} = this._press;
        this._press = null;
        if (Date.now() - at < 2000) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }
    // The menu's own rows, when the page placed the menu inside its area,
    // are not objects of the area.
    // An area in a shadow root sends its events retargeted to the host: the
    // node they came from is read from the composed path (1.27.0).
    const node = origin(event);
    if (event.defaultPrevented || holds(this, node)) return;
    const found = this.targetOf(node);
    if (!found) return;
    if (type === "pointerdown") {
      this.cancelPress();
      if (event.pointerType !== "touch" || event.button > 0 || !event.isPrimary) return;
      if (keptBy(event, found.target)) return;
      const press = {x: event.clientX, y: event.clientY, fired: false, at: 0};
      press.timer = setTimeout(() => {
        if (this._press !== press) return;
        press.fired = true;
        press.at = Date.now();
        this.openAt(press.x, press.y, {target: found.target});
      }, LONG_PRESS_MS);
      this._press = press;
      return;
    }
    if (type === "keydown") {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      if (keptBy(event, found.target)) return;
      event.preventDefault();
      this._keyAt = Date.now();
      this.openAtTarget(found.target);
      return;
    }
    // contextmenu: a long press that opened the menu already, a key the
    // keydown answered, the right button, or a phone's own long press.
    if (this._press?.fired || Date.now() - (this._keyAt ?? 0) < 500) {
      event.preventDefault();
      return;
    }
    if (this.browserKeeps(event, found.target)) return;
    event.preventDefault();
    this.cancelPress();
    if (event.pointerType === "touch") {
      this._press = {fired: true, at: Date.now()};
      this.openAt(event.clientX, event.clientY, {target: found.target});
    } else if (event.button === 2) {
      this.openAt(event.clientX, event.clientY, {target: found.target});
    } else {
      this.openAtTarget(found.target);
    }
  }

  surface() {
    return this.querySelector(":scope > .sf-context-menu");
  }

  // width: "content" (the default) lets the menu be as wide as its longest
  // line, between the menu's clamps; "trigger" makes it exactly as wide as the
  // control that opened it -- a site switcher, a profile button (owner,
  // 2026-10-14) -- a long line ending in an ellipsis; a CSS length fixes it.
  // The kinds of decision C32 size it by what it holds: "list" (at least the
  // trigger, up to the list's step or the trigger), "panel" (the panel's step
  // or the trigger, whichever is wider), "form" and "form-wide" (the form's
  // steps; on a phone a sheet at the bottom, the screen's width). The
  // attribute gives the default.
  async openFor(anchor, {side = "block-end", align = "start", focus = "first", parentMenu = null, alignmentOffset = 0, offset = undefined, width = this.width, target = undefined} = {}) {
    if (!(anchor instanceof Element)) return {outcome: "refused", reason: "invalid"};
    sayInPlaceOpen(this);
    if (this._owned) this.close({restoreFocus: false, ask: false});
    // The object the menu acts on (C164): the row of an area named by `for`
    // that holds the anchor -- the row's «⋯» opens the same menu the right
    // button does -- or the one openAt() was given; on a selected row every
    // selected row of its area (C164 (3)).
    const found = target instanceof Element ? (this.targetOf(target) ?? {area: null, target}) : this.targetOf(anchor);
    const selection = found ? this.selectionOf(found) : null;
    // The request first (§19, vocabulary §4): a listener that prevents it keeps
    // the menu closed. It names the object and the objects, so the host gives
    // the entries for them, in one place for every way in (C164 (2)).
    if (!this.sfEmit("open", {target: found?.target ?? null, targets: selection?.targets ?? []}, {cancelable: true})) {
      return {outcome: "refused", reason: "prevented"};
    }
    // An unselected row is selected alone before the menu acts on it (C164 (3)).
    if (selection?.select) {
      for (const row of selection.select) row.setAttribute("aria-selected", "false");
      found.target.setAttribute("aria-selected", "true");
    }
    const targets = selection?.targets ?? [];
    if (targets.length || this._targets?.length) {
      this._targets = targets;
      this.requestComponentUpdate("targets");
    }
    // An anchor the size of nothing is a point: where a right-click was (a
    // host's contextmenu, SF.Effects). The menu's corner is the point itself,
    // not --sf-space-1/4 below it (CM-5, as system menus open), and what
    // stands under the point is the place the menu belongs to: its density
    // (C22/C79), its size and where the focus goes back (CM-2). A point
    // appended to <body> had neither, so the menu came out normal in a compact
    // table and the focus fell to <body>. Where it does not fit, core
    // positioning turns it to the other side of the point (C164 (1)): left of
    // it at the right edge, above it at the bottom edge.
    const point = pointOf(anchor, this);
    const place = point?.under ?? anchor;
    // The size of what opens it, on every opening (owner remark 2026-11-15):
    // a menu without a size of its own is drawn where it stands -- often on
    // <body> -- so the row menu of a table of size 1 opened at 1/2.
    this.followOpenerSize(place);
    await this.whenRendered();
    const surface = this.surface();
    if (!surface) return {outcome: "unavailable", reason: "no-surface"};
    // Focus goes back where it was, or to the control that opened the menu
    // when it was nowhere -- a press on an sf-button leaves it on the body in
    // some browsers, and the menu returned it there. A host element is not
    // itself focusable; its native control is.
    const focusable = (element) => (element?.matches?.("button, a[href], input, select, textarea, [tabindex]")
      ? element
      : element?.querySelector?.("button, a[href], input, select, textarea, [tabindex]") ?? element);
    // The focus inside an area's shadow root is the element itself, not the
    // host the document names (1.27.0).
    const shallow = document.activeElement, deep = deepActive();
    const active = found && deep !== shallow && !found.target.contains(shallow) && holds(found.target, deep) ? deep : shallow;
    const somewhere = active instanceof HTMLElement && active !== document.body && active !== document.documentElement;
    // Opened at the pointer for an object (openAt, C164), the focus goes back
    // to the object it acted on -- where it was inside it, else the object
    // itself, lent a tabindex when it takes none (CM-2: it fell to the page).
    const forObject = anchor === this._point && Boolean(found);
    const back = forObject && !(somewhere && found.target.contains(active));
    this._owned = {
      anchor, parentMenu,
      target: found?.target ?? null,
      returnTo: back ? found.target
        : somewhere ? active : point ? point.focusable : focusable(anchor),
      lent: back ? !found.target.matches(FOCUSABLE) : Boolean(point?.lent) && !somewhere,
      expanded: anchor.getAttribute("aria-expanded"),
      haspopup: anchor.getAttribute("aria-haspopup"),
    };
    anchor.setAttribute("aria-haspopup", "menu");
    anchor.setAttribute("aria-expanded", "true");
    // The density of the control that opens it (C22): the panel is drawn
    // where the menu element stands -- often on <body>, outside the compact
    // region of the toolbar or table that opens it -- so two menus of one
    // compact page drew at two sizes. A size the page gave the menu is a step
    // on that region's ladder too (C79), so every menu takes it.
    this._owned.density = surface.getAttribute("data-sf-density");
    surface.setAttribute("data-sf-density", densityOf(place) ?? "normal");
    // The top layer, where the platform has it: above every stacking context
    // and every clipping box, so a menu in a scrolled card is never cut and
    // never under the table it belongs to.
    surface.classList.add("sf-context-menu--open");
    if (typeof surface.showPopover === "function") {
      surface.setAttribute("popover", "manual");
      if (!surface.matches(":popover-open")) surface.showPopover();
    } else {
      surface.style.zIndex = "var(--sf-layer--popover)";
    }
    const content = this.querySelector(".sf-context-menu-content");
    const kind = WIDTH_KINDS.has(width) ? width : "";
    // The control's width, for the kinds that read it (C32), public while
    // the menu is open: a page may size a part of the panel by it.
    const triggerWidth = () => `${(position().referenceRect?.(anchor) ?? anchor.getBoundingClientRect()).width}px`;
    surface.style.setProperty("--sf-context-menu-trigger-inline-size", triggerWidth());
    this._owned.trigger = triggerWidth;
    if (content) {
      if (kind) content.setAttribute("data-sf-width", kind);
      else content.removeAttribute("data-sf-width");
      this._owned.kindContent = content;
    }
    // A form, the menu of an object (C164 (6)) and a drilling popup -- a
    // settings menu, the person menu with its settings rows (owner decision
    // C176, defect SM-3) -- are the one sheet on a phone (C157 (5)): its levels
    // open inside the same sheet with the way back in its head (C157 (6)).
    const sheets = FORM_KINDS.has(kind) || Boolean(found) || (this.drill && !parentMenu);
    const sheet = sheets && onPhone();
    const sized = width && width !== "content" && !kind;
    if (sized && content) {
      // A display: contents trigger (sf-button-icon, sf-button) is as wide as
      // what it draws (#68).
      const rect = position().referenceRect?.(anchor) ?? anchor.getBoundingClientRect();
      const length = width === "trigger" ? `${rect.width}px` : width;
      content.style.setProperty("--sf-context-menu--min-inline-size", length);
      content.style.setProperty("--sf-context-menu--max-inline-size", length);
      content.style.setProperty("inline-size", length);
      this._owned.sizedContent = content;
    }
    // offset: the gap between the trigger and the menu, a token or a length
    // (simai/ui-source#69); left out, the positioning's own --sf-space-1/4.
    // A form on a phone is not anchored: it is a sheet at the bottom of the
    // screen (the sheet's rules are the class sheet's).
    const owned = this._owned;
    const placeAt = (asSheet) => {
      owned.position?.stop();
      owned.position = null;
      owned.sheet = asSheet;
      if (asSheet) {
        surface.setAttribute("data-sf-sheet", "");
        return;
      }
      surface.removeAttribute("data-sf-sheet");
      owned.position = position().anchor(anchor, surface, {
        side, align, alignmentOffset, flip: true, shift: true, fitHeight: true, matchWidth: width === "trigger",
        ...(offset === undefined || offset === null || offset === "" ? (point ? {offset: 0} : {}) : {offset}),
        // The trigger may change its width while the menu is open (a field
        // that grows): the width the kinds read follows it.
        onPosition: () => {
          if (this._owned?.anchor === anchor) surface.style.setProperty("--sf-context-menu-trigger-inline-size", triggerWidth());
        },
      });
    };
    placeAt(sheet);
    // The one sheet (owner decision C157 (5)): a swipe down from its handle
    // row closes the form, as Escape does.
    owned.unswipe = swipeToClose(surface, {
      when: () => owned.sheet && this._owned === owned,
      onDismiss: () => this.close({reason: "close"}),
    });
    // A form stays what the screen makes it: opened wide and the window
    // narrowed to a phone, it becomes the sheet; widened, it is anchored again.
    if (sheets) {
      owned.onResize = () => {
        if (this._owned === owned && onPhone() !== owned.sheet) placeAt(onPhone());
      };
      window.addEventListener("resize", owned.onResize);
    }
    // A menu it opens owns Escape, so the root says a surface is open: a record
    // panel listening on the document in capture runs before the menu's own
    // listener and would otherwise close with it. The outside press comes from
    // the stack.
    holdOpenSurfaceMark(this, true, {onOutsidePress: this._onOutsidePress});
    this.sfEmit("opened", {});
    if (focus !== "none") {
      this.syncMenuItems();
      const items = this.availableMenuItems();
      const field = this.searchField();
      const row = focus === "last" ? items[items.length - 1] : items[0];
      if (field && focus !== "last") field.focus({preventScroll: true});
      else if (row) row.focus({preventScroll: true});
      // A form or a slot's own markup has no row: its first control takes
      // the focus, so the keys -- Escape among them -- reach the menu (C32
      // acceptance, 2026-11-09: the focus stayed on the trigger).
      else this.tabbables()[focus === "last" ? this.tabbables().length - 1 : 0]?.focus({preventScroll: true});
    }
    return {outcome: "applied", value: true};
  }

  // reason says why (standard 1.3.8 §19.3): escape, outside, close (the head's
  // close button) or api (a choice, Tab, a script). A listener that prevents
  // sf-menu-context-close keeps the menu open; `ask: false` closes without
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
    if (owned.onResize) window.removeEventListener("resize", owned.onResize);
    for (const name of ["--sf-context-menu--min-inline-size", "--sf-context-menu--max-inline-size", "inline-size"]) {
      owned.sizedContent?.style.removeProperty(name);
    }
    owned.kindContent?.removeAttribute("data-sf-width");
    holdOpenSurfaceMark(this, false);
    const surface = this.surface();
    if (surface) {
      owned.unswipe?.();
      if (surface.matches?.(":popover-open")) surface.hidePopover();
      surface.removeAttribute("popover");
      surface.classList.remove("sf-context-menu--open");
      surface.style.removeProperty("z-index");
      surface.style.removeProperty("--sf-context-menu-trigger-inline-size");
      surface.removeAttribute("data-sf-sheet");
      if (owned.density !== undefined) {
        if (owned.density === null) surface.removeAttribute("data-sf-density");
        else surface.setAttribute("data-sf-density", owned.density);
      }
    }
    const {anchor} = owned;
    if (owned.haspopup === null) anchor.removeAttribute("aria-haspopup");
    else anchor.setAttribute("aria-haspopup", owned.haspopup);
    if (owned.expanded === null) anchor.setAttribute("aria-expanded", "false");
    else anchor.setAttribute("aria-expanded", owned.expanded);
    if (restoreFocus) {
      if (owned.lent && owned.returnTo?.isConnected) focusLent(owned.returnTo, {preventScroll: true});
      else (owned.returnTo?.isConnected ? owned.returnTo : anchor)?.focus?.({preventScroll: true});
    }
    if (this._targets?.length) {
      this._targets = [];
      this.requestComponentUpdate("targets");
    }
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
    const child = document.createElement("sf-menu-context");
    child.setAttribute("aria-label", entry.text ?? "");
    child.setAttribute("popup", "");
    // A submenu is the size of the menu it opens from.
    if (this.size === "1") child.setAttribute("size", "1");
    child.entries = entry.submenu;
    if (entry.search) child.search = entry.search;
    // A submenu's width, as the menu's own setting reads it (C32 kinds or a
    // length): a submenu of language rows is the panel (C142 (7)), so the
    // second name beside each name is not cut.
    if (entry.width) child.setAttribute("width", entry.width);
    // Selections in the submenu are the parent's to announce: a host listens
    // on one element whatever depth the item sits at.
    child.addEventListener("sf-menu-context-select", (event) => {
      event.stopPropagation();
      const forwarded = this.sfEmit("select", event.detail, {cancelable: true});
      if (!forwarded) event.preventDefault();
    });
    child.addEventListener("sf-menu-context-closed", () => {
      if (this._submenu === child) {
        this._submenu = null;
        child.remove();
      }
    });
    // In the density of the menu it opens from, wherever it is placed (C22).
    followDensity(child, this.surface() ?? this);
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
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!this.contains(event.target)) return;
    const rtl = getComputedStyle(this.surface() ?? document.documentElement).direction === "rtl";
    const inward = rtl ? "ArrowLeft" : "ArrowRight", outward = rtl ? "ArrowRight" : "ArrowLeft";
    // A drilling panel the page placed: nothing to close and no walk of its
    // own, but the way out of a level is the same as in an opened menu. The
    // side arrows stay the slider's and the search field's.
    if (!this._owned) {
      const editing = event.target?.classList?.contains("sf-context-menu-range-input") || event.target === this.searchField();
      if (event.key === "Enter" && event.target === this.searchField()) {
        this.chooseFirstMatch(event);
        return;
      }
      if (this._drill?.length && (event.key === "Escape" || (event.key === outward && !editing))) {
        event.preventDefault();
        event.stopPropagation();
        this.drillBack();
      }
      return;
    }
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
    // ArrowDown goes on to the rows, Enter chooses the first row the query
    // left, as a combobox does (simai/ui-source#72), and Escape still closes.
    if (event.target === this.searchField() && event.key !== "Escape" && event.key !== "Tab") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.syncMenuItems();
        this.availableMenuItems()[0]?.focus();
      }
      if (event.key === "Enter") this.chooseFirstMatch(event);
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
    if (event.key === "Escape" || (event.key === outward && this._owned.parentMenu && !editable(event.target))) {
      event.preventDefault();
      event.stopPropagation();
      this.close({reason: event.key === "Escape" ? "escape" : "api"});
      return;
    }
    // In a form or a panel Tab walks its controls. Past the last (or before
    // the first) it leaves a popup for the page; a sheet, which covers the
    // page, takes it round to the other end.
    if (event.key === "Tab" && !this.menuItems().includes(event.target) && this.tabbables().length > 1) {
      const controls = this.tabbables();
      const at = controls.indexOf(event.target);
      const edge = event.shiftKey ? 0 : controls.length - 1;
      if (at !== edge && at >= 0) return;
      if (this._owned.sheet) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
        return;
      }
    }
    if (event.key === "Tab") {
      // Tab leaves the menu for the page; the menu does not trap it.
      this.closeAll({restoreFocus: true});
      return;
    }
    const entry = this.entryOf(event.target);
    if (event.key === inward && (this.drill ? drillable(entry) : submenuOf(entry)) && event.target.getAttribute?.("aria-disabled") !== "true") {
      event.preventDefault();
      const row = event.target.closest(".sf-context-menu-item");
      if (this.drill) this.drillInto(row);
      else this.openSubmenu(row, entry, {focus: "first"});
      return;
    }
    // Letters typed into a form's field are the field's.
    if (event.key.length === 1 && event.key !== " " && !editable(event.target)) this.typeahead(event);
  }

  // Enter in the search field: the first row the query left is chosen, as a
  // press on it would choose it -- a command row selects and closes, a
  // submenu row opens, a drilling row goes a level in. A word still being
  // composed (an input method) is the field's Enter, and a query that left no
  // row does nothing. The key is taken (preventDefault) and still bubbles, so
  // a host that once answered Enter itself can tell the menu did.
  chooseFirstMatch(event) {
    if (event.isComposing || event.keyCode === 229) return;
    this.syncMenuItems();
    const first = this.availableMenuItems()[0];
    if (!first) return;
    event.preventDefault();
    first.click();
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
      // The menu's size, a step on the region's ladder (C79): "1/2" by
      // default (owner decision C134: 32px rows on a page, 28 in a compact
      // region, 44 under a finger on a phone) or "1" (40, 32 compact).
      size: { default: "1/2" },
      // How wide the menu opens: "content" (its longest line, the default),
      // "trigger" (exactly the control that opened it), a kind of decision
      // C32 ("list", "panel", "form", "form-wide") or a CSS length.
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

  // A panel with tabs is a former name until 2027-01-01 (owner decision
  // C106): a list's view settings are sf-settings look="panel". It is still
  // drawn; a page that asks for deprecation notes hears it once.
  get panel() {
    const panel = this.tabs.length > 0;
    if (panel) noteDeprecated({component: "sf-menu-context", tag: this.localName, kind: "setting", attribute: "tabs", from: "tabs",
      to: 'sf-settings look="panel"', since: "2026-11-12", remove_after: "2027-01-01"});
    return panel;
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
      // The older list form set as a property (`.items=${…}`, sf-admin-menu's
      // settings menu) is kept by the manifest's accessor, which the props
      // above do not read: they gave the default, an empty list, and the menu
      // drew an empty panel. JSON in the attribute is still the props' reading.
      items: this.hasAttribute("items") ? props.items : this.items,
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
      // The ids of the icon options' name tooltips (C160 (1)): one prefix per menu.
      tipPrefix: this._tipPrefix ??= `sf-menu-tip-${++menuTips}`,
      level,
      role: this.menuRole,
      panel: this.panel,
      position: this.position,
      size: this.size,
      component: this,
      rootClass: this.getRootClass(),
      // On a selection the menu acts on every selected row and says how many
      // (C164 (3)).
      selectionLabel: this.targets.length > 1 ? this.sfWord("selected", {vars: {count: this.targets.length}}) : "",
    });
  }

  template() {
    return renderContextMenuTemplate(this.templateContext());
  }
}

SfContextMenu.define("sf-menu-context");
