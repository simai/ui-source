// A list a person acts on: a person's conversations, letters, templates,
// files, members, versions -- rows from data, each one a title and a quiet
// second line, which one is open, a few things one can do to a row. The block
// list of SIMAI Framework (duplication audit 2026-11-03, A-7; owner decision
// 2026-11-03, component sets, point 13): sf-chat-threads, sf-mail-letters,
// sf-mail-library, the chat window's files and members and ui-mail's versions
// each wrote the same row model again. sf-list-feed is the block's feed
// variant, for a column a person reads.
//
// What a row *is* stays with the host. An item is data: an id, a text, and
// optionally a supporting line, an icon, a date or a group key. The list draws
// each one as the Framework's row, sf-list-item, and interprets none of it.
//
// It owns the arrangement and nothing else:
//   - groups by the calendar day of each item's date in the reader's time
//     zone («Сегодня», «Вчера», a weekday, the date -- core's
//     formatRelativeDay), or by a key the host names, or none;
//   - which row is open (`selected`), told by more than a tint;
//   - one Tab stop for the whole list, arrows between rows, across groups
//     (the row's own roving, sf-list-item);
//   - the row's actions in one menu the whole list shares, renaming in place;
//   - asking for the next page when its end comes into reach (core's
//     watchEdge), with a «Show more» button for the keyboard and for a page
//     without IntersectionObserver;
//   - sf-empty-state when there is nothing.
// It never fetches anything: every request leaves as an event.
//
// Keyboard: arrows, Home and End move between rows, Enter opens, F2 renames,
// Shift+F10 or the menu key opens the row's actions.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8,
// §11, §18): the settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, the actions
// answer outcomes, and the events take the vocabulary's verbs (open, apply,
// rename, load-more).
import SfBaseElement from "../../core/js/smart-base";
import {elementFromManifest} from "../../core/js/element-manifest";
import {calendarDayOffset, formatRelativeDay, msUntilNextDay, toDate} from "../../core/js/format.js";
import {scrollerOf, watchEdge} from "../../core/js/reading-position.js";
import {renderListTemplate} from "./js/templates/default.js";
import manifest from "./component.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// A text longer than this is not a name; the rename field stops there, as the
// server that stores it most likely does.
const TEXT_LIMIT = 200;

const applied = () => ({outcome: "applied"});
const refused = (reason) => ({outcome: "refused", reason});

// One item as the list holds it: id a string, the rest as given.
const normalItem = (item) => ({...item, id: String(item.id)});

// set-items(list, {hasMore}) or set-items({items, has-more}) (§4.4: one object
// in declared order).
const pageArguments = (first, second) => {
    if (first && !Array.isArray(first) && typeof first === "object" && Array.isArray(first.items)) {
        return {items: first.items, hasMore: Boolean(first["has-more"] ?? first.hasMore ?? first.options?.hasMore)};
    }
    return {items: Array.isArray(first) ? first : [], hasMore: Boolean(second?.hasMore ?? second?.["has-more"])};
};

const ListElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: "ru",
});

let listCount = 0;

class SfList extends ListElement {
    static get props() {
        return {...super.props, templateName: {attribute: "template", default: "default"}};
    }

    constructor() {
        super();
        this._items = [];
        this._actions = [];
        this._groups = [];
        this._loadingMore = false;
        this._editing = null;
        this._menuFor = null;
        this._focusAfter = null;
        this._stopEdge = null;
        this._edge = null;
        this._dayTimer = 0;
        listCount += 1;
        this._uid = `sf-list-${listCount}`;
        // A value set as a property before the element was defined is an own
        // property that would hide the accessor; it is taken through it.
        for (const name of ["items", "actions", "groups"]) {
            if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
            const early = this[name];
            delete this[name];
            this[name] = early;
        }
    }

    // ── state the host sets ──────────────────────────────────────────────────

    // A printed skeleton (data-sf-first-paint="skeleton") stays until the host
    // gives the items (standard 1.3.8 §5.4): the first render then draws them
    // over it in one frame. An empty list given is an answer too -- the empty
    // state draws -- where the base's test counts it as not yet given.
    sfAwaitingData() {
        return this.getAttribute("data-sf-first-paint") === "skeleton" && !this._sfDataGiven;
    }

    /** The items shown, in the host's order (§18.4: entries by id). */
    get items() {
        return this._items.map((item) => ({...item}));
    }

    set items(value) {
        this._sfDataGiven = true;
        const seen = new Set();
        this._items = (Array.isArray(value) ? value : [])
            .filter((item) => item && item.id != null && !seen.has(String(item.id)) && seen.add(String(item.id)))
            .map(normalItem);
        if (this._editing && !seen.has(this._editing)) this._editing = null;
        this.requestComponentUpdate("items");
    }

    /**
     * The row actions, in the shared menu after «Rename»: [{id, text, icon?,
     * destructive?}]. Chosen, one leaves as sf-list-apply {action, scope:
     * entry, ids}. An item narrows them with `actions: [ids]`, or takes them
     * away with `actions: false`.
     */
    get actions() {
        return this._actions.map((action) => ({...action}));
    }

    set actions(value) {
        this._actions = Array.isArray(value)
            ? value.filter((action) => action && action.id && action.text).map((action) => ({...action, id: String(action.id)}))
            : [];
        this.requestComponentUpdate("actions");
    }

    /** The groups of group-by="key", in order: [{key, text}]. A key not listed follows, its key as its heading. */
    get groups() {
        return this._groups.map((group) => ({...group}));
    }

    set groups(value) {
        this._groups = Array.isArray(value)
            ? value.filter((group) => group && group.key != null).map((group) => ({key: String(group.key), text: String(group.text ?? group.key)}))
            : [];
        this.requestComponentUpdate("groups");
    }

    // ── actions (§4.4) ───────────────────────────────────────────────────────

    /** The whole list and whether more follows, together; ends a page request. */
    setItems(first = [], second = {}) {
        const {items, hasMore} = pageArguments(first, second);
        this.items = items;
        this._loadingMore = false;
        if (this.loading) this.loading = false;
        this.hasMore = hasMore;
        // A new end is watched again: a watch that starts on an end in reach
        // reports it at once, which is the next page when there is one.
        this.unwatchEnd();
        this.requestComponentUpdate("page");
        return applied();
    }

    /** The next page after what is shown; ends the page request. */
    appendItems(first = [], second = {}) {
        const {items, hasMore} = pageArguments(first, second);
        const known = new Set(this._items.map((item) => item.id));
        return this.setItems([...this._items, ...items.filter((item) => item && item.id != null && !known.has(String(item.id)))], {hasMore});
    }

    /** A new item at the start, or a changed one in its place. */
    upsert(params) {
        const item = params?.item && typeof params.item === "object" && params.id === undefined ? params.item : params;
        if (!item || item.id == null) return refused("no-id");
        const next = normalItem(item);
        const at = this._items.findIndex((one) => one.id === next.id);
        const list = [...this._items];
        if (at >= 0) list[at] = next;
        else list.unshift(next);
        this._items = list;
        this._sfDataGiven = true;
        this.requestComponentUpdate("upsert");
        return applied();
    }

    /** Take one item off. */
    detach(params) {
        const id = String(params && typeof params === "object" ? params.id : params ?? "");
        if (!this._items.some((item) => item.id === id)) return refused("unknown");
        const rows = this.rows();
        const at = rows.findIndex((row) => this.idOf(row) === id);
        // The focus that was on the row goes to its neighbour, not to the page.
        if (at >= 0 && rows[at].contains(this.ownerDocument.activeElement)) {
            this._focusAfter = this.idOf(rows[at + 1] ?? rows[at - 1] ?? null);
        }
        this._items = this._items.filter((item) => item.id !== id);
        if (this._editing === id) this._editing = null;
        this.requestComponentUpdate("detach");
        return applied();
    }

    /** The next page could not be loaded: reaching the end, or «Show more», asks again. */
    moreFailed() {
        this._loadingMore = false;
        this.unwatchEnd();
        this.requestComponentUpdate("more");
        return applied();
    }

    /** Ask the host for the next page, as reaching the end and «Show more» do. */
    requestMore() {
        if (this._loadingMore) return refused("loading");
        if (this.loading) return refused("loading");
        if (!this.hasMore) return refused("no-more");
        this._loadingMore = true;
        this.requestComponentUpdate("more");
        if (!this.sfEmit("load-more", {direction: "after", after: this._items.at(-1)?.id ?? null})) {
            this._loadingMore = false;
            this.requestComponentUpdate("more");
            return refused("prevented");
        }
        return applied();
    }

    /** Rename in place: Enter keeps, Escape gives up, leaving the field keeps. */
    rename(params) {
        const id = String(params?.id ?? params ?? "");
        if (!this.renamable) return refused("not-renamable");
        const item = this._items.find((one) => one.id === id);
        if (!item) return refused("unknown");
        if (item.disabled === true) return refused("disabled");
        this.closeMenu();
        this._editing = id;
        this.requestComponentUpdate("rename");
        return applied();
    }

    /** Open the row's actions, as the «⋯» button and Shift+F10 do. */
    openMenu(params, anchorGiven = null) {
        const id = String(params?.id ?? params ?? "");
        const item = this._items.find((one) => one.id === id);
        const menu = this.menu;
        if (!item || !menu) return refused("unknown");
        const entries = this.menuEntries(item);
        if (!entries.length) return refused("no-actions");
        const row = this.rowFor(id);
        const anchor = anchorGiven instanceof Element ? anchorGiven : row?.closest(".sf-list__row")?.querySelector(".sf-list__actions") ?? row ?? this;
        this._menuFor = id;
        menu.setAttribute("aria-label", this.sfWord("actions-label", {vars: {text: item.text || this.sfWord("untitled-text")}}));
        menu.entries = entries;
        // The Loader brings sf-menu-context when it is first needed (a lazy
        // relation); a press before that waits for it.
        customElements.whenDefined("sf-menu-context").then(() => menu.toggleFor(anchor));
        return applied();
    }

    // ── words and what is drawn ──────────────────────────────────────────────

    get menu() {
        return this.querySelector(":scope > .sf-list__frame > .sf-list__menu");
    }

    // The menu of one row: «Rename» when the list renames, then the host's
    // actions the item allows.
    menuEntries(item) {
        if (item.disabled === true) return [];
        const allowed = item.actions === false ? [] : Array.isArray(item.actions) ? new Set(item.actions.map(String)) : null;
        const own = this._actions.filter((action) => !allowed || allowed.has(action.id));
        return [
            ...(this.renamable ? [{id: "rename", text: this.sfWord("rename-text"), icon: "edit", shortcut: "F2"}] : []),
            ...own.map((action) => ({
                id: `action:${action.id}`,
                text: action.text,
                ...(action.icon ? {icon: action.icon} : {}),
                ...(action.destructive ? {status: "error"} : {}),
            })),
        ];
    }

    hasMenu(item) {
        return this.menuEntries(item).length > 0;
    }

    keyShortcuts(item) {
        return [this.hasMenu(item) ? "Shift+F10" : "", this.renamable && item.disabled !== true ? "F2" : ""].filter(Boolean).join(" ");
    }

    // The groups in the order their first item comes: the host sorts, the list
    // does not. By day, each item's calendar day in the reader's time zone, an
    // unreadable date its own last group; by key, the order of `groups`, then
    // any key it does not list.
    arranged() {
        const by = this.groupBy;
        if (by !== "day" && by !== "key") return [{key: "all", heading: "", items: this._items}];
        const groups = new Map();
        const now = new Date();
        for (const item of this._items) {
            let key;
            let heading;
            if (by === "day") {
                const moment = toDate(item.date);
                const offset = moment ? calendarDayOffset(moment, {now}) : NaN;
                key = Number.isFinite(offset) ? `day:${offset}` : "day:none";
                heading = Number.isFinite(offset)
                    ? formatRelativeDay(moment, {now, capital: true, node: this})
                    : this.sfWord("undated-text");
            } else {
                key = `key:${item.group ?? ""}`;
                const declared = this._groups.find((group) => group.key === String(item.group ?? ""));
                heading = declared?.text ?? (item.group == null || item.group === "" ? this.sfWord("ungrouped-text") : String(item.group));
            }
            if (!groups.has(key)) groups.set(key, {key, heading, items: []});
            groups.get(key).items.push(item);
        }
        const list = [...groups.values()];
        if (by === "key" && this._groups.length) {
            const order = this._groups.map((group) => `key:${group.key}`);
            const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length);
            list.sort((a, b) => rank(a.key) - rank(b.key));
        }
        if (by === "day") {
            const undated = list.findIndex((group) => group.key === "day:none");
            if (undated >= 0) list.push(...list.splice(undated, 1));
        }
        return list;
    }

    templateContext() {
        const loading = this.loading;
        const empty = !loading && this._items.length === 0;
        return {
            component: this,
            uid: this._uid,
            label: this.label,
            headingLevel: this.headingLevel,
            size: this.size,
            sections: this.arranged(),
            grouped: this.groupBy === "day" || this.groupBy === "key",
            selected: this.selected,
            editing: this._editing,
            loading,
            loadingText: this.sfWord("loading-text"),
            empty,
            emptyHeading: this.emptyText,
            emptyContent: this.hasSlotContent("empty") ? this.getSlotContent("empty") : null,
            showMore: this.hasMore && !loading,
            loadingMore: this._loadingMore,
            // The label stays while the page is on its way, so the button keeps
            // its width; the wait is said by the status beside it.
            moreText: this.sfWord("more-text"),
            loadingMoreText: this.sfWord("loading-more-text"),
            renameLabel: this.sfWord("rename-label"),
            untitledText: this.sfWord("untitled-text"),
            actionsLabel: (text) => this.sfWord("actions-label", {vars: {text}}),
            hasMenu: (item) => this.hasMenu(item),
            textLimit: TEXT_LIMIT,
        };
    }

    template() {
        return renderListTemplate(this.templateContext());
    }

    afterRender(changed) {
        super.afterRender?.(changed);
        this.watchEnd();
        // The keys a row answers, said to assistive technology on the row itself
        // (sf-list-item draws the row; an attribute it does not bind stays).
        for (const row of this.rows()) {
            const item = this._items.find((one) => one.id === this.idOf(row));
            const keys = item ? this.keyShortcuts(item) : "";
            if (keys) row.setAttribute("aria-keyshortcuts", keys);
            else row.removeAttribute("aria-keyshortcuts");
        }
        if (this._editing) {
            const input = this.querySelector(".sf-list__rename");
            if (input && !input.dataset.focused) {
                input.dataset.focused = "true";
                input.focus();
                input.select();
            }
            return;
        }
        if (this._focusAfter !== null) {
            const id = this._focusAfter;
            this._focusAfter = null;
            this.focusRow(id);
        }
    }

    // A row drawn again (the rename field gave its place back) is a new
    // sf-list-item that draws itself a frame later: wait for it a few frames.
    focusRow(id, frames = 4) {
        const row = this.rowFor(id);
        if (row) this.moveTo(row);
        else if (frames > 0 && this.isConnected) requestAnimationFrame(() => this.focusRow(id, frames - 1));
    }

    onConnected() {
        super.onConnected?.();
        this.watchDay();
    }

    onDisconnected() {
        this.unwatchEnd();
        clearTimeout(this._dayTimer);
        this._dayTimer = 0;
        super.onDisconnected?.();
    }

    // «Сегодня» said yesterday is wrong by morning: at the reader's midnight
    // the day groups are drawn again.
    watchDay() {
        clearTimeout(this._dayTimer);
        this._dayTimer = 0;
        if (!this.isConnected) return;
        this._dayTimer = setTimeout(() => {
            this.watchDay();
            if (this.groupBy === "day") this.requestComponentUpdate("day");
        }, msUntilNextDay() + 1000);
    }

    // The end of the list asks for the next page when it comes within reach,
    // never from a scroll handler (core/js/reading-position.js watchEdge).
    watchEnd() {
        const sentinel = this.querySelector(":scope > .sf-list__frame .sf-list__end");
        if (!this.hasMore || this.loading || !sentinel) {
            this.unwatchEnd();
            return;
        }
        if (this._edge === sentinel && this._stopEdge) return;
        this.unwatchEnd();
        this._edge = sentinel;
        // Inside the box that scrolls the list, so the margin reaches ahead there.
        this._stopEdge = watchEdge(sentinel, () => this.requestMore(), {root: scrollerOf(sentinel)});
    }

    unwatchEnd() {
        this._stopEdge?.();
        this._stopEdge = null;
        this._edge = null;
    }

    // ── rows ─────────────────────────────────────────────────────────────────

    rows() {
        return [...this.querySelectorAll(":scope > .sf-list__frame .sf-list-item[data-sf-list-roving]")];
    }

    idOf(row) {
        return row?.closest?.(".sf-list__row")?.dataset.id ?? null;
    }

    rowFor(id) {
        if (id == null) return null;
        return this.rows().find((row) => this.idOf(row) === String(id)) ?? null;
    }

    // The row's own roving keeps one Tab stop (sf-list-item); a row the list
    // moves the focus to is marked the current one there.
    moveTo(row) {
        for (const other of this.rows()) delete other.dataset.sfListCurrent;
        row.dataset.sfListCurrent = "true";
        for (const other of this.rows()) other.tabIndex = other === row ? 0 : -1;
        row.focus();
    }

    // ── what a person does ───────────────────────────────────────────────────

    // A press or Enter on a row: sf-list-item asks open {id, trigger}; the
    // list says it as its own (selected is controlled, §4.3: the host opens
    // the item and writes selected back).
    onRowOpen(event) {
        event.stopPropagation();
        const id = String(event.detail?.id ?? "");
        if (!id || !this._items.some((item) => item.id === id)) return;
        this.sfEmit("open", {id, trigger: event.detail?.trigger ?? "pointer"});
    }

    onKey(event) {
        const row = event.target.closest?.(".sf-list-item[data-sf-list-roving]");
        if (!row || event.target !== row || event.defaultPrevented) return;
        const id = this.idOf(row);
        const item = this._items.find((one) => one.id === id);
        if (!item) return;
        if (event.key === "F2" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            if (this.rename(id).outcome === "applied") event.preventDefault();
            return;
        }
        if ((event.key === "F10" && event.shiftKey) || event.key === "ContextMenu") {
            event.preventDefault();
            this.openMenu(id);
        }
    }

    onMenu(detail = {}) {
        const id = this._menuFor;
        const choice = String(detail.id ?? detail.entry?.id ?? "");
        if (!id || !choice) return;
        if (choice === "rename") setTimeout(() => this.rename(id), 0);
        // A row's action is apply {action, scope: entry, ids} (vocabulary §5, §18.3).
        else if (choice.startsWith("action:")) this.sfEmit("apply", {action: choice.slice("action:".length), scope: "entry", ids: [id]});
    }

    closeMenu() {
        const menu = this.menu;
        if (menu?.isOpen) menu.close({restoreFocus: false, reason: "api"});
    }

    finishRename(keep, input) {
        const id = this._editing;
        if (!id) return;
        this._editing = null;
        const item = this._items.find((one) => one.id === id);
        const text = String(input?.value ?? "").trim().slice(0, TEXT_LIMIT);
        this._focusAfter = id;
        if (keep && item && text && text !== item.text) {
            // Shown at once; a host that refuses it cancels the event (the old
            // text comes back) or upserts the item with the text it kept.
            const before = item.text;
            item.text = text;
            if (!this.sfEmit("rename", {id, text})) item.text = before;
        }
        this.requestComponentUpdate("rename");
    }
}

SfList.define("sf-list");
