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
    // (menuitem, menuitemcheckbox or menuitemradio).
    if (this.entries.length) return Array.from(content?.querySelectorAll(".sf-context-menu-item") || []);
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
      if (!item.classList.contains("sf-context-menu-item")) this.ownItemAttribute(item, "role", "menuitem");
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
    this.requestComponentUpdate("entries");
  }

  entryOf(element) {
    const row = element?.closest?.(".sf-context-menu-item");
    if (!row || !this.contains(row)) return null;
    return this.entries[Number(row.dataset.sfEntry)] ?? null;
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
  // not committed.
  chooseOption(row, entry) {
    const at = Number(row.dataset.sfOption);
    const option = entry.options?.[at];
    if (!option || option.disabled) return;
    const selected = this.sfEmit("select", {id: option.id ?? null, entry: option, checked: true, group: entry.id ?? null}, {cancelable: true});
    if (!selected) return;
    const index = this.entries.indexOf(entry);
    const next = {...entry, options: entry.options.map((item, i) => ({...item, checked: i === at}))};
    this.entries = this.entries.map((item, i) => (i === index ? next : item));
    if (entry.keepOpen === false) this.closeAll();
  }

  handleEntryClick(event) {
    const row = event.target?.closest?.(".sf-context-menu-item");
    if (!row || !this.contains(row) || row.matches(":disabled")) return;
    const entry = this.entryOf(row);
    if (!entry) return;
    if (row.dataset.sfOption !== undefined) {
      this.chooseOption(row, entry);
      return;
    }
    if (Array.isArray(entry.submenu) && entry.submenu.length) {
      event.preventDefault();
      // A pointer leaves the focus where it is, unless the submenu is a search:
      // whoever opened a list to find something is about to type.
      this.openSubmenu(row, entry, {focus: event.detail === 0 || entry.search ? "first" : "none"});
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
      const entry = this.entryOf(row);
      if (entry && Array.isArray(entry.submenu) && entry.submenu.length && !row.matches(":disabled")) {
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
    if (event.key === inward && entry && Array.isArray(entry.submenu) && entry.submenu.length) {
      event.preventDefault();
      this.openSubmenu(event.target.closest(".sf-context-menu-item"), entry, {focus: "first"});
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

    return this.createTemplateContext({
      ...props,
      entries: this.entries,
      search: this.search,
      query: this.query,
      tabs: this.tabs,
      activeTab: this.activeTab,
      closable: this.closable,
      closeLabel: this.sfWord("close"),
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
