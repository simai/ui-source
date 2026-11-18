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
// optionally a supporting line, an icon, a date or a group key, a picture
// (avatar), a count, a badge and pinned. The list draws each one as the
// Framework's row, sf-list-item, with the Framework's own parts in its leading
// and trailing places -- sf-avatar, sf-badge -- and interprets none of it: it
// has no renderer a host could hand it (1.1.0, owner decision q-3b313e2246,
// 2026-11-06: sf-chat-threads becomes a thin wrapper of this list).
//
// It owns the arrangement and nothing else:
//   - groups by the calendar day of each item's date in the reader's time
//     zone («Сегодня», «Вчера», a weekday, the date -- core's
//     formatRelativeDay), or by a key the host names, or none; pinned items
//     lead, under their own heading «Закреплённые» when the list is grouped;
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
// Shift+F10 or the menu key opens the row's actions; so does a right click,
// at the pointer (1.19.0, C164 (1)).
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8,
// §11, §18): the settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, the actions
// answer outcomes, and the events take the vocabulary's verbs (open, apply,
// rename, load-more).
import SfBaseElement from "../../core/js/smart-base";
import {elementFromManifest} from "../../core/js/element-manifest";
import {calendarDayOffset, formatRelativeDay, msUntilNextDay, toDate} from "../../core/js/format.js";
import {EDGE_MARGIN, scrollerOf, watchEdge} from "../../core/js/reading-position.js";
import {menuOpen} from "../../core/js/menu-open.js";
import {rowsWindow, ROWS_WINDOW_FROM, ROWS_VISIBILITY_FROM} from "../../core/js/rows-window.js";
import {filesDrop} from "../../core/js/files-drop.js";
import {noteDeprecated} from "../../core/js/deprecations";

// Is the end within watchEdge's margin of the box that scrolls the list (or
// of the window)? Read once, on the scroll that arms the watch.
const EDGE_REACH = parseFloat(EDGE_MARGIN) || 0;
function endInReach(sentinel, root) {
    const end = sentinel.getBoundingClientRect();
    const view = sentinel.ownerDocument.defaultView;
    const box = root ? root.getBoundingClientRect() : {top: 0, bottom: view?.innerHeight ?? 0};
    return end.top <= box.bottom + EDGE_REACH && end.bottom >= box.top - EDGE_REACH;
}
import {renderListTemplate} from "./js/templates/default.js";
import {watchLongPress} from "../list-item/js/long-press.js";
import manifest from "./component.json";
import {files as languageFiles} from "./lang/index.mjs";
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// A text longer than this is not a name; the rename field stops there, as the
// server that stores it most likely does.
const TEXT_LIMIT = 200;

const applied = () => ({outcome: "applied"});
const refused = (reason) => ({outcome: "refused", reason});

// One item as the list holds it: id a string, the rest as given.
const normalItem = (item) => ({...item, id: String(item.id)});

const word = (value) => (typeof value === "string" ? value.trim() : "");
const SHAPES = new Set(["circle", "square"]);
// The skeleton's leading place by the setting leading (1.17.0).
const LEADING = new Set(["auto", "none", "icon", "avatar"]);
// The skeleton rows' line count by the setting lines (1.18.0).
const LINES = new Set(["auto", "1", "2"]);
// The badge's tone is a word of the Framework's status set
// (contracts/public-api-axes.json status_vocabulary); neutral is no status.
const TONES = new Set(["neutral", "info", "success", "warning", "error"]);
// The largest count drawn as a number; a larger one reads «99+», as
// sf-avatar's badge-cap does by default.
const COUNT_CAP = 99;
// Below this many rem of the list's own width a row's badge and count stand
// under its text (C47; the width the owner's prototype drew it at).
const NARROW_REM = 20;
// A wider list goes narrow too when a row's title would keep less than half
// of the row's text column, or less than this many rem (C47 follow-up: a
// long badge on a 366 px phone column left the title 55 px, «Порта…»).
const TITLE_MIN_REM = 10;
const NARROW = "data-sf-list-narrow";
// 1.14.0: a frame in a shrink-to-fit place, taken out of the container query.
const FIT = "data-sf-list-fit";

// The frame's content box width: what the container query reads.
const contentWidth = (frame, style) => frame.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);

/**
 * The item's picture, or null: {image-url?, text?, shape?, icon?}. A sign
 * (icon without an image) is a glyph in the avatar's place -- a channel, an
 * agent, a bot; an image or initials are sf-avatar's.
 */
function avatarOf(item) {
    const avatar = item?.avatar;
    if (!avatar || typeof avatar !== "object" || Array.isArray(avatar)) return null;
    const imageUrl = word(avatar["image-url"]);
    const icon = word(avatar.icon);
    return {
        kind: icon && !imageUrl ? "sign" : "avatar",
        shape: SHAPES.has(avatar.shape) ? avatar.shape : "circle",
        imageUrl,
        text: word(avatar.text),
        icon,
    };
}

/** The item's count as a whole number above 0, else 0. */
function countOf(item) {
    const count = Number(item?.count);
    return Number.isFinite(count) && count >= 1 ? Math.floor(count) : 0;
}

/**
 * Is the row unread? A count says so (owner decision C167 (3)); a letter
 * without one says it with unread: true (1.15.0, C189 (8)). A number above 0
 * is read as true -- sf-chat-threads spells its unread count unread -- and
 * draws no number: the number is count's.
 */
function unreadOf(item) {
    if (countOf(item)) return true;
    const unread = item?.unread;
    return unread === true || (typeof unread === "number" && unread > 0);
}

/** The item's date as an ISO moment for sf-time, or "" when it has none. */
function momentOf(item) {
    const moment = item?.date == null || item.date === "" ? null : toDate(item.date);
    return moment && Number.isFinite(moment.getTime()) ? moment.toISOString() : "";
}

/** The item's badge, {text, tone}, or null: a badge with no text draws nothing. */
function badgeOf(item) {
    const badge = item?.badge;
    if (!badge || typeof badge !== "object" || Array.isArray(badge)) return null;
    const text = word(badge.text);
    if (!text) return null;
    return {text, tone: TONES.has(badge.tone) ? badge.tone : "neutral"};
}

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
    lang: languageFiles,
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
        // The shape of the rows last shown, for the skeleton (skeletonShape()).
        this._shownShape = null;
        this._actions = [];
        this._groups = [];
        this._loadingMore = false;
        this._editing = null;
        this._menuFor = null;
        this._focusAfter = null;
        this._stopEdge = null;
        this._edge = null;
        this._dayTimer = 0;
        // A long list draws the rows in view (FO-2, core/js/rows-window.js):
        // a list of 1 000 entries or more (C308), the entries a person can see and 20
        // on each side, two spacers standing for the rest. A grouped list is
        // one run of «heading, its rows» (FO2-1); a range never starts inside
        // a group without its heading. Each entry's height is kept by its id
        // (FO2-4). rows-window="off" draws every row (FO2-3).
        this._entries = [];
        this._rowsWindow = rowsWindow({
            body: () => this.querySelector(":scope > .sf-list__frame [data-sf-rows-window]"),
            rows: () => [...this.querySelectorAll([
                ":scope > .sf-list__frame .sf-list__rows[data-sf-rows-window] > .sf-list__row",
                ":scope > .sf-list__frame .sf-list__body[data-sf-rows-window] > .sf-list__group > .sf-list__heading",
                ":scope > .sf-list__frame .sf-list__body[data-sf-rows-window] > .sf-list__group > .sf-list__rows > .sf-list__row",
            ].join(", "))],
            onMove: () => this.requestComponentUpdate("window"),
            key: (index) => this._entries[index]?.key,
            snap: (index) => this._entries[index]?.head ?? index,
            // A sticky heading reads where it stuck (sticky-headings): its
            // place in the flow is the top of its group's content box.
            place: (element) => {
                if (!element.classList.contains("sf-list__heading")) return element.getBoundingClientRect().top;
                const group = element.parentElement;
                const style = getComputedStyle(group);
                return group.getBoundingClientRect().top + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0) + (parseFloat(getComputedStyle(element).marginTop) || 0);
            },
            guess: 40,
        });
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

    // The list's own «Показать ещё» and its scroll request (has-more) are
    // retired in favour of sf-pagination appearance="more" after the list
    // (owner decision C167 (1): the end of a list is that button, with «Показано
    // X из Y»). They still work until 2027-01-01, noted once per element in
    // SF.deprecations (journal attribute-list-has-more-to-pagination-more).
    ownMore() {
        if (!this.hasMore) return false;
        if (!this._ownMoreNoted) {
            this._ownMoreNoted = true;
            noteDeprecated({
                component: "sf-list", tag: "sf-list", kind: "attribute", from: "has-more",
                to: "sf-pagination appearance=\"more\"", since: "2026-11-16", remove_after: "2027-01-01",
            });
        }
        return true;
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
        if (!item) return refused("unknown");
        const entries = this.menuEntries(item);
        if (!entries.length) return refused("no-actions");
        const row = this.rowFor(id);
        // A point {x, y} in the window: where a right click was (C164 (1)).
        const point = anchorGiven && !(anchorGiven instanceof Element)
            && Number.isFinite(Number(anchorGiven.x)) && Number.isFinite(Number(anchorGiven.y))
            ? {x: Number(anchorGiven.x), y: Number(anchorGiven.y)} : null;
        const anchor = anchorGiven instanceof Element ? anchorGiven : row?.closest(".sf-list__row")?.querySelector(".sf-list__actions") ?? row ?? this;
        this._menuFor = id;
        // The page's one menu (core SF.menu.open, owner decision C184 (4)),
        // fetched by the Loader the first time: the «⋯», Shift+F10 and a right
        // click open the same list, and the focus goes back to the row.
        const opening = menuOpen({
            ...(point ?? {anchor}),
            entries,
            label: this.sfWord("actions-label", {vars: {text: item.text || this.sfWord("untitled-text")}}),
            returnTo: row ?? null,
        });
        this._menuOpening = opening;
        opening.then((choice) => {
            if (this._menuOpening === opening) this._menuOpening = null;
            if (choice) this.onMenu({id: choice.id, entry: choice.entry}, id);
        });
        return applied();
    }

    // ── words and what is drawn ──────────────────────────────────────────────

    // The page's one menu while it holds this list's actions (C184 (4)).
    get menu() {
        return this.ownerDocument.querySelector("[data-sf-menu-shared]");
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
    //
    // Pinned items lead, in the host's order: under their own heading
    // («Закреплённые») before the day or key groups; ungrouped, first in the
    // one list.
    arranged() {
        const by = this.groupBy;
        const pinned = this._items.filter((item) => item.pinned === true);
        const rest = pinned.length ? this._items.filter((item) => item.pinned !== true) : this._items;
        if (by !== "day" && by !== "key") return [{key: "all", heading: "", items: [...pinned, ...rest]}];
        const groups = new Map();
        const now = new Date();
        for (const item of rest) {
            let key;
            let heading;
            let date = "";
            if (by === "day") {
                const moment = toDate(item.date);
                const offset = moment ? calendarDayOffset(moment, {now}) : NaN;
                key = Number.isFinite(offset) ? `day:${offset}` : "day:none";
                heading = Number.isFinite(offset)
                    ? formatRelativeDay(moment, {now, capital: true, node: this})
                    : this.sfWord("undated-text");
                // Today and yesterday say the date beside the word (C40).
                date = offset === 0 || offset === -1 ? moment.toISOString() : "";
            } else {
                key = `key:${item.group ?? ""}`;
                const declared = this._groups.find((group) => group.key === String(item.group ?? ""));
                heading = declared?.text ?? (item.group == null || item.group === "" ? this.sfWord("ungrouped-text") : String(item.group));
            }
            if (!groups.has(key)) groups.set(key, {key, heading, date, items: []});
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
        if (pinned.length) list.unshift({key: "pinned", heading: this.sfWord("pinned-text"), items: pinned});
        return list;
    }

    // The leading place of the rows: none when no item has an avatar and the
    // rows are all with an icon or all without. When one has an avatar, every
    // row keeps the place, so the titles start at one line; a row without an
    // avatar shows its icon there, or nothing. Its width is the avatar of a
    // two-line row when any row of the list has a second line, else the row's
    // line: a one-line row keeps its control height. A row without an icon
    // among rows with one keeps the icon's place too (owner C105), at the
    // row's line. (1.17.0: named leadingPlace(), the setting leading is the
    // skeleton's.)
    leadingPlace() {
        if (this._items.some((item) => avatarOf(item))) {
            return {wide: this._items.some((item) => Boolean(item.supporting))};
        }
        const icon = (item) => typeof item?.icon === "string" && item.icon.trim() !== "";
        if (this._items.some(icon) && !this._items.every(icon)) return {wide: false};
        return null;
    }

    // The format of a row's time (1.15.0), as sf-list-timeline's time-format
    // reads: under a day heading the clock time, since the heading names the
    // day; elsewhere -- ungrouped, by key, the pinned group -- the moment in
    // full. null: time-format none, no time.
    timeFormatFor(group) {
        const asked = this.timeFormat;
        if (asked !== "auto" && asked !== "relative" && asked !== "exact") return null;
        if (asked === "relative") return "relative";
        const underDay = this.groupBy === "day" && typeof group?.key === "string" && group.key.startsWith("day:");
        if (asked === "exact") return underDay ? "time" : "datetime";
        return underDay ? "time" : "auto";
    }

    // The shape of the skeleton rows (1.16.0, C130, C148 (1)): the shape of
    // the rows the list has shown -- one line or the caption row, and the
    // leading place they draw: an avatar's (wide when a row has a second
    // line, its shape), an icon's, or none. It is kept when the rows are
    // taken away for a reload (items = [] and loading), so the rows that come
    // back find their place; until the list has shown rows it is the caption
    // row with no leading place -- the list does not guess one.
    //
    // 1.17.0: the setting leading says the place instead of the rows shown
    // (C130, C148 (1)): icon, avatar or none hold from the first frame, so a
    // list whose rows will carry icons or avatars has its title bar start
    // where the title will before it has shown any; auto is the shape of the
    // rows shown. The line count, and an avatar's shape and width, still
    // come from the rows shown; before any, the caption row's: an avatar of
    // the control height, a circle.
    //
    // 1.18.0: the setting lines says the line count instead of the rows shown
    // (C130): 1 or 2 hold from the first frame, so a one-line list's first
    // skeleton row is as tall as its rows (40, not the caption row's 48 at
    // 1440) and an avatar's box is the one-line box; auto is the line count
    // of the rows shown, the caption row before any. A declared count also
    // gives the avatar its width: the control height with a second line,
    // else the row's line.
    skeletonShape() {
        const items = this._items;
        if (items.length) {
            const avatar = items.map((item) => avatarOf(item)).find(Boolean);
            const icon = items.some((item) => typeof item?.icon === "string" && item.icon.trim() !== "");
            this._shownShape = {
                twoLine: items.some((item) => Boolean(item.supporting)),
                lead: avatar
                    ? {kind: "avatar", wide: items.some((item) => Boolean(item.supporting)), shape: avatar.shape}
                    : icon ? {kind: "icon"} : null,
            };
        }
        const shown = this._shownShape ?? {twoLine: true, lead: null};
        const lines = LINES.has(this.lines) ? this.lines : "auto";
        const twoLine = lines === "auto" ? shown.twoLine : lines === "2";
        const declared = LEADING.has(this.leading) ? this.leading : "auto";
        const learned = shown.lead?.kind === "avatar" ? shown.lead : null;
        const wide = learned && lines === "auto" ? learned.wide : twoLine;
        if (declared === "none") return {twoLine, lead: null};
        if (declared === "icon") return {twoLine, lead: {kind: "icon"}};
        if (declared === "auto") return {twoLine, lead: learned ? {...learned, wide} : shown.lead};
        return {twoLine, lead: {kind: "avatar", wide, shape: learned ? learned.shape : "circle"}};
    }

    // The range a long list draws, or null (FO-2): a list that is not
    // loading and has no row being renamed. An ungrouped list is its rows; a
    // grouped one is one run of each group's heading and rows (FO2-1), and the
    // range says, per group, the rows it draws (parts: group key -> [from,
    // to], rows of the group). rows-window="off" draws every row (FO2-3).
    windowOf(sections, loading) {
        // C308 FO-2: from 1 000 entries, or the list's own rows-window-from;
        // rows-window="off" never.
        const own = Number.parseInt(this.getAttribute("rows-window-from") ?? "", 10);
        this._rowsWindow.from = this.getAttribute("rows-window") === "off" ? Infinity : (own > 0 ? own : ROWS_WINDOW_FROM);
        const flat = sections.length === 1 && sections[0].key === "all";
        const entries = [];
        for (const group of sections) {
            const head = entries.length;
            if (!flat) entries.push({key: `head:${group.key}`, head, group: group.key, row: -1});
            group.items.forEach((item, row) => entries.push({key: `row:${item.id}`, head: flat ? entries.length : head, group: group.key, row}));
        }
        this._entries = entries;
        if (loading || this._editing) {
            this._rowsWindow.slice(0);
            return null;
        }
        const slice = this._rowsWindow.slice(entries.length);
        if (!slice) return null;
        const parts = new Map();
        for (let index = slice.first; index <= slice.last; index += 1) {
            const entry = entries[index];
            if (!entry) continue;
            const part = parts.get(entry.group) ?? [Infinity, -1];
            if (entry.row >= 0) parts.set(entry.group, [Math.min(part[0], entry.row), Math.max(part[1], entry.row)]);
            else parts.set(entry.group, part);
        }
        return {...slice, flat, parts};
    }

    // Home and End in a long list go to the whole list's first and last row,
    // which may not be drawn: the range is put there first (FO-2). The
    // arrows find the next row drawn, since the range keeps rows beyond the
    // visible ones and moves as the focused row scrolls into view.
    onWindowKey = (event) => {
        if (!this._rowsWindow.windowed || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key !== "Home" && event.key !== "End") return;
        const row = event.target?.closest?.(".sf-list-item[data-sf-list-roving]");
        if (!row || event.target !== row || !this.contains(row)) return;
        const sections = this.arranged();
        const items = sections.flatMap((group) => group.items);
        const item = event.key === "Home" ? items[0] : items.at(-1);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        const at = this._entries.findIndex((entry) => entry.key === `row:${item.id}`);
        this._rowsWindow.reveal(event.key === "Home" ? 0 : Math.max(0, at));
        // The row is drawn with the moved range and draws itself a frame or
        // more later: it is waited for longer than a renamed row.
        this.focusRow(item.id, 30);
    };

    templateContext() {
        const loading = this.loading;
        const sections = this.arranged();
        const empty = !loading && this._items.length === 0;
        const range = this.windowOf(sections, loading);
        return {
            component: this,
            uid: this._uid,
            label: this.label,
            headingLevel: this.headingLevel,
            stickyHeadings: this.stickyHeadings === true,
            size: this.size,
            noWrap: this.noWrap === true,
            divided: this.divided === true,
            sections,
            window: range,
            // Drawn whole, a long list's rows skip layout and paint off
            // screen (content-visibility, C308 FO-2); find and print reach them.
            rowsAll: !range && !loading && this._entries.length >= ROWS_VISIBILITY_FROM,
            leading: this.leadingPlace(),
            avatarOf,
            countOf,
            unreadOf,
            momentOf,
            // The row's time (1.15.0): sf-time's format for the rows of a
            // group, or null when the list draws no time (timeFormatFor).
            timeFormat: (group) => this.timeFormatFor(group),
            unreadText: this.sfWord("unread-text"),
            badgeOf,
            countCap: COUNT_CAP,
            countLabel: (count) => this.sfWord("count-label", {count}),
            grouped: this.groupBy === "day" || this.groupBy === "key",
            selected: this.selected,
            editing: this._editing,
            loading,
            // The skeleton's rows take the shape of the rows the list has
            // shown, else the caption row with no leading place (template
            // skeleton()).
            skeleton: this.skeletonShape(),
            loadingText: this.sfWord("loading-text"),
            empty,
            emptyHeading: this.emptyText,
            emptyContent: this.hasSlotContent("empty") ? this.getSlotContent("empty") : null,
            showMore: this.ownMore() && !loading,
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

    // The rows are drawn; the list's sheets may still be on their way. The
    // width is watched from now (C47): when the sheet comes, the observer
    // measures the frame before it is painted with it, so no frame of a
    // squeezed title is shown first.
    whenRenderedStylesReady(target) {
        this.watchWidth();
        return super.whenRenderedStylesReady(target);
    }

    afterRender(changed) {
        super.afterRender?.(changed);
        if (this._rowsWindow.windowed) {
            this._rowsWindow.start();
            this._rowsWindow.sync();
        } else {
            this._rowsWindow.stop();
        }
        this.watchEnd();
        this.watchWidth();
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
        // Files from the computer on the whole list (owner decision C308
        // FO-1): a folder, a chat, attachments, when the list's owner turns it
        // on (accept-files); the one drop overlay of the page says where they
        // go; a zone inside the list (a row's own) wins. The list uploads
        // nothing itself: attach asks the host.
        this._filesDrop ??= filesDrop(this, {
            target: () => (this.acceptFiles === true || this.hasAttribute("accept-files") ? this : null),
            overlay: () => this.sfWord("files-drop-text", {vars: {target: this.label || this.sfWord("label")}}),
            onFiles: (files, {skipped}) => {
                if (files.length || skipped.length) this.sfEmit("attach", {files, skipped});
            },
        });
        this.addEventListener("keydown", this.onWindowKey, true);
        // A long press on a row under a finger opens its menu, as its «⋯»
        // does (owner decision C148 (6)); the click its release sends opens
        // nothing. No swipe.
        if (!this._longPress) {
            this._longPress = watchLongPress(this, {
                accepts: (event) => {
                    const row = event.target.closest?.(".sf-list-item[data-sf-list-roving]");
                    if (!row || !this.contains(row) || event.target.closest(".sf-list__actions, .sf-list__rename")) return false;
                    const item = this._items.find((one) => one.id === this.idOf(row));
                    return Boolean(item) && this.hasMenu(item);
                },
                press: (event) => {
                    const row = event.target.closest?.(".sf-list-item[data-sf-list-roving]");
                    const id = this.idOf(row);
                    if (id != null) this.openMenu(id);
                },
            });
            this.addEventListener("click", (event) => {
                if (!this._longPress.swallowed()) return;
                event.preventDefault();
                event.stopPropagation();
            }, true);
            // A right click on a row opens its menu at the pointer, the same
            // list as its «⋯» (owner decision C164 (1), defect TL-2).
            this.addEventListener("contextmenu", (event) => this.onRowContextMenu(event));
        }
    }

    // The right button on a row with a menu: the row's menu where the pointer
    // is. Shift with it leaves the browser's own menu; a finger's long press
    // is the long-press watch's (it has opened the menu already); the menu key
    // and Shift+F10 are onKey's (their keydown opened it at the row's «⋯»).
    onRowContextMenu(event) {
        if (event.shiftKey || event.defaultPrevented) return;
        const row = event.target.closest?.(".sf-list-item[data-sf-list-roving]");
        if (!row || !this.contains(row) || event.target.closest(".sf-list__rename")) return;
        const id = this.idOf(row);
        const item = this._items.find((one) => one.id === id);
        if (!item || !this.hasMenu(item)) return;
        event.preventDefault();
        if (event.button !== 2 || event.pointerType === "touch") return;
        this.moveTo(row);
        this.openMenu(id, {x: event.clientX, y: event.clientY});
    }

    onDisconnected() {
        this._filesDrop?.stop();
        this._filesDrop = null;
        this.unwatchEnd();
        this._rowsWindow.stop();
        this.removeEventListener("keydown", this.onWindowKey, true);
        this._widthObserver?.disconnect();
        this._widthObserver = null;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = 0;
        this._widthFrame = null;
        this._widthMetas = null;
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

    // A narrow list (owner decision C47, 2026-11-10): below 20rem of its own
    // width a row's badge and count go under its second line, at the text's
    // start, so the title keeps the row's width and the badge stays whole. A
    // wider list is narrow too when, laid out on one line, a row's title would
    // keep less than half of the row's text column or less than 10rem (a long
    // badge in a phone column). No page breakpoint and no setting.
    // 1.14.0: the 20rem is a container query on the frame (the sheet's
    // container sf-list), so a printed first paint is narrow before any
    // script (DEV, ui-chat chat-threads at 390: CLS 0.09 when the code
    // adopted). The code marks the frame (data-sf-list-narrow) only for what
    // the sheet cannot know: a squeezed title; and, for a frame in a
    // shrink-to-fit place (a popover, an auto-width flex item), whose
    // inline-size container would take no width from its rows and fold to
    // nothing, it takes the frame out of the query (data-sf-list-fit) and
    // marks it below 20rem by measuring, as before. It watches the frame's
    // width and every row's badge and count, and is started as soon as the
    // rows are drawn, before the list's sheet is in: the observer reports
    // before the frame is painted, so the frame painted with the sheet is
    // already laid out narrow or wide. The marks are attributes the template
    // does not bind, so a redraw keeps them.
    // 1.5.1: the frame's width is read from .sf-list__width, a box of no
    // height across the frame, not from the frame. The narrow layout changes
    // the frame's height; a frame observed itself then changed size inside the
    // observer's own callback, at the shallowest depth it reports, and the
    // browser raised «ResizeObserver loop completed with undelivered
    // notifications» on every page with a narrow list. The width box keeps its
    // size whatever the layout; the badges and counts sit deeper and are
    // reported in the same frame.
    watchWidth() {
        const frame = this.querySelector(":scope > .sf-list__frame");
        if (!frame) return;
        const width = frame.querySelector(":scope > .sf-list__width") ?? frame;
        if (this._widthFrame !== frame) {
            this._widthObserver?.disconnect();
            this._widthObserver = null;
            this._widthFrame = frame;
            this._widthMetas = new Set();
            if (typeof ResizeObserver !== "function") return;
            this._widthObserver = new ResizeObserver(() => {
                this.watchMetas();
                this.measureNarrow();
            });
            this._widthObserver.observe(width);
        }
        this.watchMetas();
    }

    // The badges and counts drawn now are watched, the ones gone are let go:
    // a row drawn later, or a badge whose sheet came late, measures again.
    watchMetas() {
        const observer = this._widthObserver;
        const frame = this._widthFrame;
        if (!observer || !frame) return;
        const now = new Set(frame.querySelectorAll(".sf-list__row .sf-list__meta"));
        for (const meta of this._widthMetas) {
            if (!now.has(meta)) observer.unobserve(meta);
        }
        for (const meta of now) {
            if (!this._widthMetas.has(meta)) observer.observe(meta);
        }
        this._widthMetas = now;
    }

    // Narrow below 20rem of the frame's content width, or when a row's title
    // would keep less than half of its text column (or 10rem) beside its
    // badge and count. The one-line layout is measured with the mark taken
    // off and put back in the same task, so nothing of it is painted and the
    // answer does not depend on the layout it chooses. Below 20rem the
    // sheet's container query lays the rows out narrow; the mark is written
    // only where the query does not answer (no sheet yet, or a fitted frame).
    measureNarrow() {
        const frame = this._widthFrame;
        if (!frame?.isConnected) return;
        this.checkFit(frame);
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const style = getComputedStyle(frame);
        const width = contentWidth(frame, style);
        if (!(width > 0)) {
            frame.removeAttribute(NARROW);
            return;
        }
        const queried = style.containerType === "inline-size";
        let narrow = width < NARROW_REM * rem;
        if (narrow && queried) {
            frame.removeAttribute(NARROW);
            return;
        }
        if (!narrow) {
            const was = frame.hasAttribute(NARROW);
            if (was) frame.removeAttribute(NARROW);
            // A two-line row keeps its badge and count in its end column
            // (owner decision C148 (2)): only one-line rows are measured.
            narrow = [...frame.querySelectorAll(".sf-list__row .sf-list-item:not(.sf-list-item--two-line) > .sf-list-item-wrap > .sf-list__meta:not(:empty)")]
                .some((meta) => this.titleSqueezed(meta, rem));
            if (was && !narrow) return;
        }
        frame.toggleAttribute(NARROW, narrow);
    }

    // A frame whose inline-size container folds it: in a shrink-to-fit place
    // the contained frame is narrower than its rows would make it (no content
    // width at all), and it is taken out of the query. Measured with the mark
    // flipped and put back in the same task, so the observer's callback ends
    // on the layout it began with (a size changed inside it would be a
    // ResizeObserver loop); the change itself is made in the next frame.
    checkFit(frame) {
        const had = frame.hasAttribute(FIT);
        const style = getComputedStyle(frame);
        if (!had && (style.containerType !== "inline-size" || contentWidth(frame, style) >= 1)) return;
        const now = frame.getBoundingClientRect().width;
        frame.toggleAttribute(FIT, !had);
        const other = frame.getBoundingClientRect().width;
        frame.toggleAttribute(FIT, had);
        const fit = (had ? now : other) > (had ? other : now) + 0.5;
        if (fit === had) return;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => {
            this._fitFrame = 0;
            if (!frame.isConnected || frame !== this._widthFrame) return;
            frame.toggleAttribute(FIT, fit);
            this.measureNarrow();
        });
    }

    // On one line: the title's room is what the badge and count leave of the
    // text column, the row's gap before them kept (their own start padding is
    // in their box).
    titleSqueezed(meta, rem) {
        const wrap = meta.parentElement;
        const text = wrap?.querySelector(":scope > .sf-list-item-container");
        if (!text) return false;
        const wrapStyle = getComputedStyle(wrap);
        const textStyle = getComputedStyle(text);
        const rtl = wrapStyle.direction === "rtl";
        const box = wrap.getBoundingClientRect();
        const textBox = text.getBoundingClientRect();
        const metaBox = meta.getBoundingClientRect();
        // An end part with only the screen-reader word takes no place (1.15.0).
        if (!(metaBox.width > 0)) return false;
        const gap = parseFloat(wrapStyle.columnGap) || 0;
        const inset = (parseFloat(textStyle.paddingLeft) || 0) + (parseFloat(textStyle.paddingRight) || 0);
        const end = rtl
            ? box.left + (parseFloat(wrapStyle.borderLeftWidth) || 0) + (parseFloat(wrapStyle.paddingLeft) || 0)
            : box.right - (parseFloat(wrapStyle.borderRightWidth) || 0) - (parseFloat(wrapStyle.paddingRight) || 0);
        const column = (rtl ? textBox.right - end : end - textBox.left) - inset;
        const title = (rtl ? textBox.right - metaBox.right : metaBox.left - textBox.left) - gap - inset;
        if (!(column > 0)) return false;
        return title < Math.max(column / 2, TITLE_MIN_REM * rem);
    }

    // The end of the list asks for the next page when a person brings it
    // within reach (core/js/reading-position.js watchEdge), not when it is
    // there already: a list whose end shows on load waits for «Show more» or
    // for the first scroll (list and feed study LF-8: the next page was asked
    // for on load, with «Show more» on screen as well -- two answers to one
    // question). The first scroll of the box that scrolls the list, after a
    // page is drawn, arms the watch; if the end is in reach then, that scroll
    // brought it there. The scroll is listened to once, to arm, never to
    // measure the edge on every move.
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
        // watchEdge reports the end coming into reach; its first report, before
        // any scroll, says only that it is there already (reached). The first
        // scroll then asks if the end is still in reach -- no new report comes
        // for an end that never left; an end that comes into reach later is
        // the watch's own report, asked once.
        const root = scrollerOf(sentinel);
        const scroller = root ?? this.ownerDocument;
        let moved = false;
        let reached = false;
        const onScroll = () => {
            moved = true;
            scroller.removeEventListener("scroll", onScroll);
            if (reached && endInReach(sentinel, root)) this.requestMore();
        };
        scroller.addEventListener("scroll", onScroll, {passive: true});
        const stopEdge = watchEdge(sentinel, () => {
            if (moved) this.requestMore();
            else reached = true;
        }, {root});
        this._stopEdge = () => {
            stopEdge();
            scroller.removeEventListener("scroll", onScroll);
        };
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
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        // The «⋯» of a row is reached from the row (owner decision C148 (3),
        // as the APG layout grid): ArrowRight (ArrowLeft right to left) from
        // the row to it, the other arrow, Escape, ArrowUp or ArrowDown back.
        // It is no Tab stop of its own.
        const rtl = getComputedStyle(this.querySelector(":scope > .sf-list__frame") ?? this).direction === "rtl";
        const forward = rtl ? "ArrowLeft" : "ArrowRight";
        const actions = event.target.closest?.(".sf-list__actions");
        if (actions) {
            if (event.shiftKey || ![rtl ? "ArrowRight" : "ArrowLeft", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            const back = actions.closest(".sf-list__row")?.querySelector(".sf-list-item[data-sf-list-roving]");
            if (!back) return;
            event.preventDefault();
            // The Escape is the row's: a panel around the list stays open.
            event.stopPropagation();
            back.focus();
            return;
        }
        const row = event.target.closest?.(".sf-list-item[data-sf-list-roving]");
        if (!row || event.target !== row) return;
        if (event.key === forward && !event.shiftKey) {
            const button = row.closest(".sf-list__row")?.querySelector(":scope > .sf-list__actions");
            if (button) {
                event.preventDefault();
                button.focus();
            }
            return;
        }
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

    onMenu(detail = {}, forId = null) {
        const id = forId ?? this._menuFor;
        const choice = String(detail.id ?? detail.entry?.id ?? "");
        if (!id || !choice) return;
        if (choice === "rename") setTimeout(() => this.rename(id), 0);
        // A row's action is apply {action, scope: entry, ids} (vocabulary §5, §18.3).
        else if (choice.startsWith("action:")) this.sfEmit("apply", {action: choice.slice("action:".length), scope: "entry", ids: [id]});
    }

    closeMenu() {
        const menu = this.menu;
        if (this._menuOpening && menu?.isOpen) menu.close({restoreFocus: false, reason: "api"});
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
