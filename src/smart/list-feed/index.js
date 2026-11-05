// A feed: a scrolling column of entries read from the newest at the end --
// a conversation, the comments under a record, an activity history, an audit
// log, a run's activity. The feed variant of block list in SIMAI Framework
// (duplication audit 2026-11-03, A-6; owner decision 2026-11-03, component
// sets, point 13): it takes over the behaviour of ui-pro's sf-message-log,
// which was written for the chat and is needed by every column of the kind.
//
// What an entry *is* stays with the host. The feed draws each one through a
// render function the host gives it (`renderItem`), or, when none is given, as
// plain text with its author's name -- never as HTML. Who wrote an entry is
// data (`author`, `own`), not a role the component interprets: the feed only
// groups consecutive entries of one author into a run and tells the renderer
// where a run starts and ends, which is what an avatar beside the first entry
// and a tail on the last need.
//
// What the feed owns is the reading position, which is the hard part and the
// reason it is a component at all. The rule itself is core's
// (core/js/reading-position.js, SF.readingPosition):
//   - earlier history is prepended without moving what is being read;
//   - a new entry follows the end only if the person was already there, or if
//     it is their own;
//   - «To the latest» brings them back and can take focus there;
//   - reaching the top while there is more asks the host for it, once.
// It fetches nothing and decides nothing: every request leaves as an event.
//
// An entry that grows -- an assistant's reply arriving in parts -- is a stream
// (standard simai.smart-component 1.3.8 §10.8, vocabulary 1.1.5 §5.2): the
// entry carries `growing` while the other side writes it, and the feed reports
// begun, one chunk per change it draws, and exactly one of completed, failed or
// cancelled. cancel {id} stops drawing the growth at once and ends the stream
// cancelled; telling the other side to stop is the host's.
//
// The items are built by hand and kept, not diffed by lit. A changed entry is
// drawn again *in place* (§18.4): its item element stays, and while the focus
// or a selection is inside it the new drawing is laid over the old nodes
// instead of replacing them, so a button the person is on keeps the focus
// through every chunk. The frame (the earlier button, the jump button, the
// live region) is the template; the column of items is one node the template
// places and never replaces.
//
// From its component.json (§3, §4, §8, §11, §18.4): the settings are
// attributes and properties made by core/js/element-manifest.js, the words are
// lang/<locale>.json, the actions answer outcomes.
import SfBaseElement from "../../core/js/smart-base";
import {elementFromManifest} from "../../core/js/element-manifest";
import {readingPosition} from "../../core/js/reading-position.js";
import {renderListFeedTemplate} from "./js/templates/default.js";
import manifest from "./component.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// A finished entry is announced whole only up to this length; a screen
// reader reading a long answer in one breath is not a summary of it.
const ANNOUNCE_LIMIT = 240;

const applied = () => ({outcome: "applied"});
const refused = (reason) => ({outcome: "refused", reason});

// What decides whether an entry is drawn again. The host typically hands the
// feed a fresh object for every poll, so identity says nothing; the data does.
// An entry is plain data by contract (the renderer gets the nodes), so its JSON
// is its content. Keys are sorted so that the same entry serialised by two
// servers in two orders is one entry.
const stable = (value) => JSON.stringify(value, (key, item) => (item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]]))
    : item));

const keyOf = (entry) => String(entry?.id ?? "");

// Vocabulary 1.1.5 §2.2: `growing` -- the other side is still writing this entry.
const isGrowing = (entry) => entry?.growing === true;

const authorName = (entry) => String(entry?.["author-name"] ?? "");

const authorOf = (entry) => String(entry?.author ?? authorName(entry));

// `wait` (vocabulary §5.1): delayed | stopped | network | none; null is none.
const waitOf = (entry, view) => {
    const value = view?.wait ?? entry?.wait ?? null;
    return value === null || value === undefined || value === "" ? "none" : String(value);
};

// How a stream ended, read from the entry the host gave last: stopped is
// cancelled, an error is failed, anything else is completed.
const endOf = (entry, view) => {
    if (waitOf(entry, view) === "stopped") return {fact: "cancelled"};
    const error = entry?.error;
    if (error || entry?.status === "failed" || entry?.status === "error") {
        return {
            fact: "failed",
            reason: String((error && typeof error === "object" ? error.reason : error) || entry?.reason || "failed"),
            message: String((error && typeof error === "object" ? error.message : "") || entry?.message || ""),
        };
    }
    return {fact: "completed"};
};

// set-items(list, {hasMore}) or set-items({items, has-more}) (§4.4: one object
// in declared order).
const pageArguments = (first, second) => {
    if (first && !Array.isArray(first) && typeof first === "object" && Array.isArray(first.items)) {
        return {items: first.items, options: first.options ?? first};
    }
    return {items: Array.isArray(first) ? first : [], options: second ?? {}};
};

const hasMoreOf = (options) => Boolean(options?.hasMore ?? options?.["has-more"]);

// Lays a new drawing over the nodes already shown, keeping every node whose
// place and kind did not change -- the one with the focus among them. Text
// is written, attributes are brought level, extra nodes go, missing ones come.
function overlay(target, source) {
    if (target.nodeType !== source.nodeType || target.nodeName !== source.nodeName) {
        target.replaceWith(source);
        return;
    }
    if (target.nodeType === 3 || target.nodeType === 8) {
        if (target.data !== source.data) target.data = source.data;
        return;
    }
    if (target.nodeType === 1) {
        for (const {name} of [...target.attributes]) if (!source.hasAttribute(name)) target.removeAttribute(name);
        for (const {name, value} of [...source.attributes]) if (target.getAttribute(name) !== value) target.setAttribute(name, value);
        if ("value" in target && "value" in source && target.value !== source.value && target !== target.ownerDocument.activeElement) target.value = source.value;
    }
    const kept = [...target.childNodes];
    const given = [...source.childNodes];
    given.forEach((node, index) => {
        if (kept[index]) overlay(kept[index], node);
        else target.append(node);
    });
    for (const extra of kept.slice(given.length)) extra.remove();
}

const FeedElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: "ru",
});

class SfListFeed extends FeedElement {
    static get props() {
        return {...super.props, templateName: {attribute: "template", default: "default"}};
    }

    constructor() {
        super();
        // id -> {entry, view, node, flags, fingerprint}. Insertion order is not
        // display order; the column's children are.
        this._items = new Map();
        // id -> {cancelled}: the streams that have begun and not ended.
        this._streams = new Map();
        this._loadingEarlier = false;
        this._pendingLatest = null;
        this._announced = new Map();
        this._renderItem = null;
        this._announceItem = null;
        this._column = null;
        this._position = readingPosition(null, {onStart: () => this.requestEarlier()});
        // A value set as a property before the element was defined is an own
        // property that would hide the accessor; it is taken through it.
        for (const name of ["items", "renderItem", "announceItem"]) {
            if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
            const early = this[name];
            delete this[name];
            this[name] = early;
        }
    }

    // ── words ────────────────────────────────────────────────────────────────

    get regionLabel() {
        return this.getAttribute("label") || this.sfWord("region-label");
    }

    // ── host-provided rendering ──────────────────────────────────────────────

    /**
     * (entry, context) => Node | string | null. context: {view, previous,
     * next, first, last, own, growing, index, document, feed}. A string is
     * drawn as text, never parsed. Setting it redraws every entry.
     */
    get renderItem() {
        return this._renderItem;
    }

    set renderItem(value) {
        this._renderItem = typeof value === "function" ? value : null;
        this.redraw();
    }

    /**
     * (entry, context) => string | null: what a screen reader hears when this
     * entry is finished. Called when an entry arrives or changes; the same
     * words for the same entry are said once.
     */
    get announceItem() {
        return this._announceItem;
    }

    set announceItem(value) {
        this._announceItem = typeof value === "function" ? value : null;
    }

    // ── the stable column ────────────────────────────────────────────────────

    get column() {
        if (!this._column) {
            const column = this.ownerDocument.createElement("div");
            column.className = "sf-list-feed__column";
            // The feed is a log; what is new is said once by the standing
            // announcer, so the log itself stays quiet. A log that spoke for
            // itself read a whole answer every time it was redrawn.
            column.setAttribute("role", "log");
            column.setAttribute("aria-live", "off");
            column.addEventListener("keydown", (event) => this.onItemKey(event));
            this._column = column;
        }
        return this._column;
    }

    get scroller() {
        return this.querySelector(":scope > .sf-list-feed");
    }

    get announcer() {
        return this.querySelector(":scope > .sf-list-feed .sf-list-feed__announcer");
    }

    templateContext() {
        return {
            component: this,
            column: this.column,
            regionLabel: this.regionLabel,
            logLabel: this.sfWord("log-label"),
            earlierText: this._loadingEarlier ? this.sfWord("loading-earlier-text") : this.sfWord("earlier-text"),
            latestLabel: this.sfWord("latest-label"),
            hasMore: this.hasMore,
            loadingEarlier: this._loadingEarlier,
            empty: this._items.size === 0,
            emptyContent: this.hasSlotContent("empty") ? this.getSlotContent("empty") : null,
        };
    }

    template() {
        return renderListFeedTemplate(this.templateContext());
    }

    afterRender(changed) {
        super.afterRender?.(changed);
        this._position.element = this.scroller;
        this.column.setAttribute("aria-label", this.sfWord("log-label"));
        if (this._pendingLatest) {
            const options = this._pendingLatest;
            this._pendingLatest = null;
            this.scrollToLatest(options);
        }
        this.syncJump();
    }

    // ── the feed as a setting (§18.4) ────────────────────────────────────────

    /** The entries in display order, as the host gave them. */
    get items() {
        return [...this.column.children].map((node) => this._items.get(node.dataset.id)?.entry).filter(Boolean);
    }

    /**
     * The whole feed, as a binding carries it. Compared by key with what is
     * shown: an entry that left is taken off, a new or changed one is drawn in
     * its place (changed by `changes`: revision or content), the rest keep
     * their nodes. An empty feed takes it as setItems does.
     */
    set items(value) {
        const list = (Array.isArray(value) ? value : []).filter((entry) => keyOf(entry));
        if (!this._items.size) {
            this.setItems(list, {hasMore: this.hasMore});
            return;
        }
        this._sfDataGiven = true;
        const wanted = new Set(list.map(keyOf));
        for (const key of [...this._items.keys()]) if (!wanted.has(key)) this.detach({id: key});
        let previous = null;
        for (const entry of list) {
            const key = keyOf(entry);
            if (this._items.has(key)) this.upsert(entry);
            else this.insertAfter(entry, previous);
            previous = this._items.get(key)?.node ?? previous;
        }
    }

    // A new entry the setting carries in the middle of what is shown stands
    // where the list puts it, not at the end.
    insertAfter(entry, previousNode) {
        const atEnd = !previousNode || previousNode === this.column.lastElementChild;
        if (atEnd) {
            this.upsert(entry);
            return;
        }
        const node = this.place(entry, {});
        previousNode.after(node);
        this.syncRuns();
        this.track(this._items.get(keyOf(entry)), null);
        this.maybeAnnounce(this._items.get(keyOf(entry)));
        this.refreshFrame("insert");
    }

    // Two entries are the same by `changes` (§18.4): revision -- the host
    // raises it with every change, a growing entry with every chunk -- or
    // content, the entry's fields and its view. An entry without a revision
    // is compared by content either way.
    same(existing, entry, view) {
        // A stream's end is never an equal write, whatever the revision says.
        if (isGrowing(entry) !== isGrowing(existing.entry)) return false;
        if (this.changes === "revision" && entry?.revision !== undefined && existing.entry?.revision !== undefined) {
            return String(entry.revision) === String(existing.entry.revision) && stable(view) === stable(existing.view);
        }
        return existing.fingerprint === stable([entry, view]);
    }

    // ── actions (§4.4) ───────────────────────────────────────────────────────

    // A printed skeleton (data-sf-first-paint="skeleton") stays until the host
    // gives the entries (standard 1.3.8 §5.4): the first render then draws them
    // over it in one frame. An empty list given is an answer too -- the empty
    // state draws -- where the base's test counts it as not yet given.
    sfAwaitingData() {
        return this.getAttribute("data-sf-first-paint") === "skeleton" && !this._sfDataGiven;
    }

    /** Replace the whole feed and show its end. */
    setItems(first = [], second = {}) {
        const {items, options} = pageArguments(first, second);
        this._sfDataGiven = true;
        // Another feed: nothing said about the last one stays to be found, and
        // nothing said about it is said again.
        this._announced.clear();
        const announcer = this.announcer;
        if (announcer) announcer.textContent = "";
        for (const key of this._streams.keys()) this.endStream(key, {fact: "cancelled"});
        this._items.clear();
        this.column.replaceChildren();
        for (const entry of items) {
            if (!keyOf(entry) || this._items.has(keyOf(entry))) continue;
            this.column.append(this.place(entry, {}));
        }
        // What a feed holds when it opens has been said already, by whoever
        // wrote it; only what changes from now on is news.
        for (const item of this._items.values()) {
            this._announced.set(keyOf(item.entry), this.announcementOf(item));
            this.track(item, null);
        }
        this.syncRuns();
        this._loadingEarlier = false;
        this.hasMore = hasMoreOf(options);
        this.refreshFrame("items");
        // Until the end of the new feed is in view, reaching the top is not a
        // request for earlier history: the column starts at the top for one
        // frame, and that frame used to ask for a page nobody wanted.
        this.scrollToLatest({instant: true, settle: true});
        return applied();
    }

    /** Earlier history above, without moving what is being read. Ends the earlier request. */
    prependItems(first = [], second = {}) {
        const {items, options} = pageArguments(first, second);
        const fragment = this.ownerDocument.createDocumentFragment();
        for (const entry of items) {
            const key = keyOf(entry);
            if (!key || this._items.has(key)) continue;
            fragment.append(this.place(entry, {}));
            this._announced.set(key, this.announcementOf(this._items.get(key)));
        }
        this._position.element = this.scroller;
        this._position.keep(() => {
            this.column.prepend(fragment);
            this.syncRuns();
        });
        this._loadingEarlier = false;
        this.hasMore = hasMoreOf(options);
        this.refreshFrame("prepend");
        return applied();
    }

    /**
     * Add or update one entry. `view` is what the host knows that the entry
     * does not (a wait it stopped, the person's own rating); it reaches the
     * renderer and is kept until replaced. `replaces` names the id the entry
     * had before -- one sent with a local key that the server has now numbered
     * -- so it keeps its place instead of moving to the end.
     */
    upsert(entry, view, {replaces = null} = {}) {
        if (entry && entry.item && typeof entry.item === "object" && entry.id === undefined) {
            ({item: entry, view, options: {replaces = null} = {}} = entry);
        }
        const key = keyOf(entry);
        if (!key) return refused("no-id");
        this._sfDataGiven = true;
        const previousKey = replaces != null && this._items.has(String(replaces)) ? String(replaces) : key;
        const existing = this._items.get(previousKey);
        const stream = this._streams.get(previousKey);
        // A stream the person cancelled draws nothing more of it, its end
        // included: what they stopped at stays (vocabulary §5.1, the server may
        // still finish the reply). A write after the end is drawn as any is.
        if (existing && stream?.cancelled) {
            if (!isGrowing(entry)) this._streams.delete(previousKey);
            return refused("cancelled");
        }
        const nextView = view ?? existing?.view ?? {};
        this._position.element = this.scroller;
        const atEnd = this._position.atEnd();
        if (existing && previousKey !== key) {
            this._items.delete(previousKey);
            this._announced.set(key, this._announced.get(previousKey));
            this._announced.delete(previousKey);
            if (stream) {
                this._streams.delete(previousKey);
                this._streams.set(key, stream);
            }
            existing.node.dataset.id = key;
            this._items.set(key, existing);
        }
        if (existing && this.same(existing, entry, nextView)) {
            existing.entry = entry;
            return applied();
        }
        const before = existing ? {entry: existing.entry, view: existing.view} : null;
        if (existing) {
            existing.entry = entry;
            existing.view = nextView;
            existing.fingerprint = stable([entry, nextView]);
            this.syncItem(existing);
            // In place (§18.4): the item element stays, only its drawing changes.
            this.draw(existing, ...this.neighbours(existing));
            this.syncRuns();
        } else {
            this.column.append(this.place(entry, nextView));
            this.syncRuns();
        }
        const item = this._items.get(key);
        this.track(item, before);
        this.maybeAnnounce(item);
        this.refreshFrame("upsert");
        const followed = atEnd || (!existing && entry.own === true);
        if (followed) this.scrollToLatest();
        else this.syncJump();
        return applied();
    }

    /** Merge into the view of an entry already shown. */
    setView(id, view = {}) {
        if (id && typeof id === "object") ({id, view = {}} = id);
        const item = this._items.get(String(id));
        if (!item) return refused("unknown");
        return this.upsert(item.entry, {...item.view, ...view});
    }

    /** Take one entry off. A stream it was ends cancelled. */
    detach(params) {
        const key = String(params && typeof params === "object" ? params.id : params);
        const item = this._items.get(key);
        if (!item) return refused("unknown");
        if (this._streams.has(key)) this.endStream(key, {fact: "cancelled"});
        item.node.remove();
        this._items.delete(key);
        this._announced.delete(key);
        this.syncRuns();
        this.refreshFrame("detach");
        return applied();
    }

    /**
     * Stop drawing a growing entry (vocabulary §5.2 cancel {id}): what the
     * person sees stays where it is, its busy mark goes, and the stream ends
     * cancelled now. Telling the other side to stop writing is the host's.
     */
    cancel(params) {
        const key = String(params && typeof params === "object" ? params.id : params ?? "");
        const stream = this._streams.get(key);
        if (!stream) return refused(this._items.has(key) ? "not-growing" : "unknown");
        if (stream.cancelled) return refused("cancelled");
        stream.cancelled = true;
        const item = this._items.get(key);
        if (item) {
            item.view = {...item.view, wait: "stopped"};
            item.fingerprint = stable([item.entry, item.view]);
            item.node.removeAttribute("aria-busy");
            this.draw(item, ...this.neighbours(item));
        }
        this.sfEmit("cancelled", {id: key});
        return applied();
    }

    /** Draw one entry, or every one, again: after the renderer's own inputs changed. */
    redraw(params = null) {
        const id = params && typeof params === "object" ? params.id : params;
        const keys = id == null ? [...this._items.keys()] : [String(id)];
        for (const key of keys) {
            const item = this._items.get(key);
            if (item) this.draw(item, ...this.neighbours(item));
        }
        this.syncRuns();
        return applied();
    }

    // ── streams (§10.8, vocabulary §5.2) ─────────────────────────────────────

    // After an entry arrived or changed: a growing entry not yet followed has
    // begun; a followed one that changed is a chunk; one that stopped growing
    // has ended. A stream the person cancelled has ended already.
    track(item, before) {
        if (!item) return;
        const key = keyOf(item.entry);
        const growing = isGrowing(item.entry);
        const stream = this._streams.get(key);
        if (!stream) {
            if (!growing) return;
            this._streams.set(key, {cancelled: false, chunks: 0});
            this.sfEmit("begun", {id: key});
            return;
        }
        if (growing) {
            if (before && !stream.cancelled) {
                stream.chunks += 1;
                const detail = {id: key};
                if (item.entry.revision !== undefined) detail.revision = item.entry.revision;
                this.sfEmit("chunk", detail);
            }
            return;
        }
        if (stream.cancelled) {
            this._streams.delete(key);
            return;
        }
        this.endStream(key, endOf(item.entry, item.view));
    }

    endStream(key, {fact, reason, message}) {
        const stream = this._streams.get(key);
        if (!stream) return;
        this._streams.delete(key);
        if (stream.cancelled) return;
        if (fact === "failed") this.sfEmit("failed", {id: key, reason: reason || "failed", message: message || ""});
        else if (fact === "cancelled") this.sfEmit("cancelled", {id: key});
        else this.sfEmit("completed", {id: key});
    }

    // ── items ────────────────────────────────────────────────────────────────

    place(entry, view) {
        const key = keyOf(entry);
        const node = this.ownerDocument.createElement("div");
        node.className = "sf-list-feed__item";
        node.dataset.id = key;
        const item = {entry, view: view ?? {}, node, flags: null, fingerprint: stable([entry, view ?? {}])};
        this._items.set(key, item);
        this.syncItem(item);
        return node;
    }

    // What the item element itself says: whose side it is on, and whether the
    // other side is still writing it (aria-busy, vocabulary §2.2 growing).
    syncItem(item) {
        item.node.classList.toggle("sf-list-feed__item--own", item.entry.own === true);
        const busy = isGrowing(item.entry) && !this._streams.get(keyOf(item.entry))?.cancelled;
        if (busy) item.node.setAttribute("aria-busy", "true");
        else item.node.removeAttribute("aria-busy");
    }

    neighbours(item) {
        return [
            this._items.get(item.node.previousElementSibling?.dataset.id)?.entry ?? null,
            this._items.get(item.node.nextElementSibling?.dataset.id)?.entry ?? null,
        ];
    }

    // Runs are consecutive entries of one author. They are computed over the
    // whole column after every change, because one entry arriving changes its
    // neighbour: the entry that was the last of a run is no longer. An entry
    // is drawn (or drawn again) here, when its place in its run is known --
    // the renderer is told first and last, and an avatar that belongs beside
    // the first entry of a run would otherwise be drawn beside every one until
    // the next redraw.
    syncRuns() {
        const nodes = [...this.column.children];
        const items = nodes.map((node) => this._items.get(node.dataset.id)).filter(Boolean);
        items.forEach((item, index) => {
            const previous = items[index - 1]?.entry ?? null;
            const next = items[index + 1]?.entry ?? null;
            const sameAuthor = (other) => other && authorOf(other) === authorOf(item.entry) && (other.own === true) === (item.entry.own === true);
            const flags = {
                first: !sameAuthor(previous),
                last: !sameAuthor(next),
                index,
                end: index === items.length - 1,
            };
            const changed = !item.flags || item.flags.first !== flags.first || item.flags.last !== flags.last;
            item.node.classList.toggle("sf-list-feed__item--first", flags.first);
            item.node.classList.toggle("sf-list-feed__item--last", flags.last);
            item.node.classList.toggle("sf-list-feed__item--end", flags.end);
            item.flags = flags;
            if (changed || !item.node.firstChild) this.draw(item, previous, next);
        });
    }

    draw(item, previous, next) {
        if (!item.flags) return;
        const context = {
            view: item.view,
            previous,
            next,
            first: item.flags.first,
            last: item.flags.last,
            own: item.entry.own === true,
            growing: isGrowing(item.entry),
            index: item.flags.index,
            document: this.ownerDocument,
            feed: this,
        };
        let content = null;
        try {
            content = this._renderItem ? this._renderItem(item.entry, context) : this.renderDefault(item.entry, context);
        } catch (error) {
            // One entry the host's renderer cannot draw must not take the feed
            // down with it; it is reported and left as its text.
            this.reportComponentError?.(error, "render-item");
            content = this.renderDefault(item.entry, context);
        }
        const node = content instanceof Node ? content : this.ownerDocument.createTextNode(content == null ? "" : String(content));
        const shown = item.node.firstChild;
        // The person is inside this entry -- the focus on its button, a
        // selection in its text: the new drawing is laid over the old nodes,
        // which stay, and the focus and the selection with them (§18.4).
        const active = this.ownerDocument.activeElement;
        const selection = this.ownerDocument.getSelection?.();
        const inside = (active && active !== item.node && item.node.contains(active))
            || (selection && selection.rangeCount > 0 && !selection.isCollapsed && item.node.contains(selection.anchorNode));
        if (shown && inside && item.node.childNodes.length === 1 && !(node instanceof DocumentFragment)) overlay(shown, node);
        else item.node.replaceChildren(node);
    }

    // Without a renderer an entry is its author and its text: enough for a
    // feed of people, and the shape a renderer replaces. Text only; a host
    // that has markup draws it itself, with its own sanitiser.
    renderDefault(entry, {first, own}) {
        const doc = this.ownerDocument;
        const article = doc.createElement("article");
        article.className = "sf-list-feed__entry";
        const name = own ? this.sfWord("you-text") : authorName(entry);
        if (name) article.setAttribute("aria-label", name);
        if (first && name && !own) {
            const author = doc.createElement("p");
            author.className = "sf-list-feed__author";
            author.textContent = name;
            article.append(author);
        }
        const bubble = doc.createElement("p");
        bubble.className = "sf-list-feed__text";
        bubble.textContent = String(entry.text ?? "");
        article.append(bubble);
        return article;
    }

    // ── announcing ───────────────────────────────────────────────────────────

    announcementOf(item) {
        if (!item) return "";
        const context = {view: item.view, own: item.entry.own === true, feed: this};
        if (this._announceItem) {
            try {
                return String(this._announceItem(item.entry, context) ?? "");
            } catch {
                return "";
            }
        }
        // By default: a finished entry from someone else, its author and its
        // words. One's own entry is not news to oneself; a growing one is not
        // finished.
        if (item.entry.own === true || isGrowing(item.entry)) return "";
        const words = String(item.entry.text ?? "").replace(/\s+/g, " ").trim();
        if (!words) return "";
        const author = authorName(item.entry).trim();
        return author ? `${author}: ${words}` : words;
    }

    maybeAnnounce(item) {
        if (!item || this.live === "off") return;
        const key = keyOf(item.entry);
        const said = this.announcementOf(item);
        if (!said || this._announced.get(key) === said) return;
        this._announced.set(key, said);
        this.announce(said);
    }

    /** Say something once through the feed's polite live region. */
    announce(params) {
        const words = params && typeof params === "object" ? params.text : params;
        const announcer = this.announcer;
        if (!announcer) return refused("not-drawn");
        const whole = String(words ?? "").replace(/\s+/g, " ").trim();
        const said = whole.length > ANNOUNCE_LIMIT ? `${whole.slice(0, ANNOUNCE_LIMIT)}…` : whole;
        // A changed text is what a screen reader hears; clearing first makes a
        // second identical sentence heard as well.
        announcer.textContent = "";
        setTimeout(() => {
            announcer.textContent = said;
        }, 60);
        return applied();
    }

    // ── position (core/js/reading-position.js) ───────────────────────────────

    /** Is the end of the feed in view? */
    isAtLatest() {
        this._position.element = this.scroller;
        return this._position.atEnd();
    }

    syncJump() {
        const jump = this.scroller?.querySelector(".sf-list-feed__jump");
        if (jump) jump.hidden = this.isAtLatest();
    }

    onScroll() {
        this.syncJump();
        if (this.hasMore && !this._loadingEarlier) this._position.check();
    }

    /** Ask the host for earlier history; the earlier button and reaching the top do this. */
    requestEarlier() {
        if (this._loadingEarlier) return refused("loading");
        if (!this.hasMore) return refused("no-more");
        const before = this.column.firstElementChild?.dataset.id ?? null;
        this._loadingEarlier = true;
        this.refreshFrame("earlier");
        // Vocabulary §5 load-more {direction: before}; `before` names the first
        // entry shown.
        if (!this.sfEmit("load-more", {direction: "before", before})) {
            this.earlierFailed();
            return refused("prevented");
        }
        return applied();
    }

    /** The host could not load earlier history: the button is pressable again. */
    earlierFailed() {
        this._loadingEarlier = false;
        this.refreshFrame("earlier");
        return applied();
    }

    scrollToLatest(params = {}) {
        const {instant = false, focus = false, settle = false} = params?.options ?? params ?? {};
        const scroller = this.scroller;
        if (!scroller) {
            this._pendingLatest = {instant, focus, settle};
            return applied();
        }
        this._position.element = scroller;
        this._position.toEnd({
            instant,
            settle,
            then: () => {
                const jump = scroller.querySelector(".sf-list-feed__jump");
                if (jump) jump.hidden = true;
                if (focus) this.focusItem(this.column.lastElementChild);
            },
        });
        return applied();
    }

    // ── keyboard ─────────────────────────────────────────────────────────────

    // What takes focus for an entry: the host's own article when it drew one,
    // else the item. It is reachable by script and by the arrows, not by Tab:
    // a feed of three hundred entries is not three hundred Tab stops.
    focusTarget(node) {
        if (!node) return null;
        const own = node.querySelector(":scope > article, :scope > [role='article']");
        const target = own ?? node;
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        return target;
    }

    focusItem(node) {
        const target = this.focusTarget(node);
        target?.focus({preventScroll: false});
        return target;
    }

    // From a focused entry: arrows go to the neighbour, Home and End to the
    // first and last entry loaded. Keys pressed inside an entry's own controls
    // are theirs, so only a key whose target is the entry counts.
    onItemKey(event) {
        const item = event.target.closest?.(".sf-list-feed__item");
        if (!item || this.focusTarget(item) !== event.target) return;
        let next = null;
        if (event.key === "ArrowUp") next = item.previousElementSibling;
        if (event.key === "ArrowDown") next = item.nextElementSibling;
        if (event.key === "Home") next = this.column.firstElementChild;
        if (event.key === "End") next = this.column.lastElementChild;
        if (!next) {
            // Up from the first loaded entry is a request for what is above.
            if (event.key === "ArrowUp" && !item.previousElementSibling && this.hasMore) {
                event.preventDefault();
                this.requestEarlier();
            }
            return;
        }
        event.preventDefault();
        this.focusItem(next);
    }

    // The frame is the template; the items are not in it, so a change to them
    // redraws only the buttons and the empty state around them.
    refreshFrame(reason) {
        this.requestComponentUpdate(reason);
    }
}

SfListFeed.define("sf-list-feed");
