import {html, nothing} from "lit";
import {repeat} from "lit/directives/repeat.js";
import "./default.css";
import {avatarPicture} from "../../../avatar/js/picture";

// The list, drawn in the component's light DOM on the Framework's plain list
// surface (the class unit .sf-list): the rows in their groups, the end of the
// list («Show more» and the sentinel the next page is asked by), the empty
// state. The row actions open in the page's one menu (core SF.menu.open,
// owner decision C184 (4)), not in a menu of the list's own.
//
// A row is the Framework's row, sf-list-item, interactive: the rows of the
// whole list -- every group -- are one Tab stop, the arrows move between them
// (the row's own roving: [data-sf-list] marks the list). When the row has
// actions, a «⋯» stands beside it; it is not a Tab stop of its own (tabindex
// -1): a list of forty rows would be eighty stops. It is reached from its row
// with Shift+F10 or the menu key, and by pointer.
//
// Grouped, the frame is a group named by the list's label and each group's
// rows a list named by its heading; ungrouped, the one list takes the label.
// A group's heading is block list's shared heading (.sf-group-heading, C40):
// the words at the list's text size, medium; for today and yesterday the date
// beside them in sf-time; sticky with sticky-headings.
//
// The rows are keyed by id, so a row that moves keeps its node and a redraw
// does not take the focus from the row a person is on.
//
// A row's own parts (1.1.0) stand in sf-list-item's leading and trailing
// places: the avatar (sf-avatar, or a sign -- a glyph in sf-avatar's class
// markup, as sf-chat-window draws its members' signs), the badge and the
// count (sf-badge). The row takes its slot elements once, when it connects,
// and draws those very nodes in its own markup. So the slot elements are
// fixed in the row's template and only what is inside them changes: a count
// that comes and goes keeps the row, and the focus on it. A list that gains
// its first avatar draws its rows from the other template, anew.

// The steps of a row's parts beside a row of each size: a one-line row's
// avatar takes the row's line, as its icon does, and a two-line row's avatar
// the control height of the row's step (sf-avatar size) -- a one-line row
// in that list keeps the line, centred in the wider place; the count and the
// badge take the row's line (sf-badge line), so they never make a row taller.
const BADGE_STATUS = {neutral: nothing, info: "info", success: "success", warning: "warning", error: "error"};

// hue auto picks the initials' hue from the row's title, so a conversation
// keeps its colour whatever its initials.
//
// The avatar is a picture of the row, not a control of its own (list item
// study LI-10): sf-avatar's one drawing (avatar js/picture.js) in a span
// hidden from assistive technology, the row's title naming the person. It was
// an sf-avatar element, which draws a button: hidden from a screen reader but
// still a Tab stop, so a list of conversations was one stop per avatar plus
// the list's own. An avatar with its own action is the page's to place.
const leadContent = (context, item) => {
    const avatar = context.avatarOf(item);
    const size = context.size;
    const wide = Boolean(context.leading?.wide) && Boolean(item.supporting);
    if (avatar?.kind === "avatar") {
        return avatarPicture({
            size: wide ? size : "1",
            line: wide ? "" : size,
            shape: avatar.shape,
            imageUrl: avatar.imageUrl,
            text: avatar.text,
            name: String(item.text ?? ""),
            hue: "auto",
            lazy: true,
            disabled: item.disabled === true,
        });
    }
    if (avatar?.kind === "sign") {
        // sf-avatar's placeholder with the sign's glyph (avatar js/picture.js,
        // the one avatar drawing; avatar study AV-8).
        return avatarPicture({
            size: wide ? size : "1",
            line: wide ? "" : size,
            shape: avatar.shape,
            icon: avatar.icon,
            extraClass: "sf-list__sign",
        });
    }
    const icon = typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "";
    return icon ? html`<sf-icon class="sf-list__glyph" icon=${icon} aria-hidden="true"></sf-icon>` : nothing;
};

// The row's time (1.15.0, time-format; C189 (8)) leads the end part: in a
// two-line row it stands on the title's line, above the badge and the count
// (sf-list-item's end column, C148 (2)), and reads first. It is sf-time (C40)
// without a tooltip: the row is the list's one Tab stop (C148 (3)), and a
// time with a tooltip outside a button would be a stop of its own. A row
// unread without a count says so to a screen reader at its end (the count's
// own words say it where there is one); the word is the only thing it adds,
// so the end part of a row with nothing else stays out of the layout (CSS).
const metaContent = (context, item, group) => {
    const count = context.countOf(item);
    const badge = context.badgeOf(item);
    const format = context.timeFormat(group);
    const moment = format ? context.momentOf(item) : "";
    const unreadWord = !count && context.unreadOf(item);
    // A two-line row's badge and count stand on its caption's line, in the
    // row's end column (owner decision C148 (2)): the line of the text they
    // stand in. A one-line row's take the row's line.
    const line = item.supporting ? "text" : context.size;
    // A row is a dense place: its badge and count keep the tight side room
    // (sf-badge tight), so the wider default of sf-badge 1.3.0 does not push
    // the row's text aside. The count is a quantity: sf-badge tonal, grey
    // (owner decision C140 (3); list item study LI-8). It was sf-badge scheme
    // primary, the filled blue count; the filled look is the attention
    // count's alone (red), which a list row does not draw.
    return html`${moment
        ? html`<sf-time class="sf-list__time" datetime=${moment} format=${format} tooltip="none"></sf-time>`
        : nothing}${badge
        ? html`<sf-badge class="sf-list__badge" line=${line} appearance="tonal" tight
                         status=${BADGE_STATUS[badge.tone]} text=${badge.text}></sf-badge>`
        : nothing}${count
        ? html`<sf-badge class="sf-list__count" line=${line} appearance="tonal" tight
                         text=${count > context.countCap ? `${context.countCap}+` : String(count)}
                         aria-label=${context.countLabel(count)}></sf-badge>`
        : nothing}${unreadWord
        ? html`<span class="sf-list__unread sr-only">${context.unreadText}</span>`
        : nothing}`;
};

// Choosing several rows (1.22.0, owner decision C167 (5) by the rule of
// C150 (9), Larena LF-10): with selection="many" each row has a check box at
// its start, shown under the pointer and on the focused row, and on every row
// once anything is chosen. It is the class checkbox, not a Tab stop of its own
// (the rows stay one stop; Space on a row chooses it). Its change is the
// list's, never the page's change.
const pick = (context, item, text) => {
    if (!context.selecting) return nothing;
    const {component} = context;
    return html`<label class="sf-list__pick sf-checkbox sf-checkbox--size-${context.size === "1/2" ? "1/2" : "1"} flex"
            @click=${(event) => event.stopPropagation()}>
        <span class="sf-checkbox-box flex">
            <input type="checkbox" tabindex="-1" .checked=${context.chosen.has(item.id)}
                   ?disabled=${item.disabled === true}
                   aria-label=${context.pickLabel(text)}
                   @change=${(event) => {
                       event.stopPropagation();
                       component.toggleChosen(item.id, component.takeShift());
                   }}>
            <span class="sf-icon" aria-hidden="true"></span>
        </span>
    </label>`;
};

const row = (context, item, group, place = null) => {
    const {component} = context;
    const text = String(item.text ?? "") || context.untitledText;
    const supporting = item.supporting ? String(item.supporting) : "";
    const current = item.id === context.selected;
    const disabled = item.disabled === true;
    const icon = typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "";

    if (context.editing === item.id) {
        return html`
            <li class="sf-list__row sf-list__row--editing" data-id=${item.id}>
                <input
                        class="sf-list__rename"
                        .value=${text === context.untitledText ? "" : text}
                        maxlength=${context.textLimit}
                        aria-label=${context.renameLabel}
                        @keydown=${(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                component.finishRename(true, event.currentTarget);
                            }
                            if (event.key === "Escape") {
                                // The Escape is the field's: a panel around the
                                // list must not close on it as well.
                                event.preventDefault();
                                event.stopPropagation();
                                component.finishRename(false, event.currentTarget);
                            }
                        }}
                        @blur=${(event) => component.finishRename(true, event.currentTarget)}
                />
            </li>
        `;
    }

    const menu = context.hasMenu(item);
    // no-wrap (1.2.0): the row's text may be cut, so the whole of it is the
    // row's tooltip. It stands on the row's host, an ancestor of everything
    // the pointer can rest on but the «⋯», which has its own; the text itself
    // stays in the row for a screen reader, so the tooltip is not its name.
    const tip = context.noWrap ? (supporting ? `${text} · ${supporting}` : text) : "";
    // Two templates, with the leading place and without; the slot elements
    // are the template's own, never a value of it (see above).
    const listItem = context.leading
        ? html`<sf-list-item
                    interactive
                    kind="icon"
                    size=${context.size}
                    value=${item.id}
                    text=${text}
                    supporting=${supporting || nothing}
                    title=${tip || nothing}
                    ?selected=${current}
                    ?disabled=${disabled}
                    ?divided=${context.divided}
            ><span slot="leading" class="sf-list__lead">${leadContent(context, item)}</span><span
                    slot="trailing" class="sf-list__meta">${metaContent(context, item, group)}</span></sf-list-item>`
        : html`<sf-list-item
                    interactive
                    kind=${icon ? "icon" : "text"}
                    icon=${icon || nothing}
                    size=${context.size}
                    value=${item.id}
                    text=${text}
                    supporting=${supporting || nothing}
                    title=${tip || nothing}
                    ?selected=${current}
                    ?disabled=${disabled}
                    ?divided=${context.divided}
            ><span slot="trailing" class="sf-list__meta">${metaContent(context, item, group)}</span></sf-list-item>`;
    const chosen = context.selecting && context.chosen.has(item.id);
    return html`
        <li class="sf-list__row ${current ? "sf-list__row--current" : ""} ${context.unreadOf(item) ? "sf-list__row--unread" : ""} ${chosen ? "sf-list__row--chosen" : ""}" data-id=${item.id}
            aria-posinset=${place ? place.at : nothing} aria-setsize=${place ? place.of : nothing}>
            ${pick(context, item, text)}
            ${listItem}
            ${menu
                ? html`<button
                        type="button"
                        class="sf-list__actions sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-${context.size} flex items-cross-center content-main-center flex-none"
                        tabindex="-1"
                        aria-haspopup="menu"
                        aria-label=${context.actionsLabel(text)}
                        title=${context.actionsLabel(text)}
                        @click=${(event) => component.openMenu(item.id, event.currentTarget)}
                ><sf-icon icon="more_horiz" aria-hidden="true"></sf-icon></button>`
                : nothing}
        </li>
    `;
};

// A long list draws the rows in view (FO-2, core/js/rows-window.js): the
// range, and two spacers standing for the rows above and below it, so the
// scroll bar and the scroll position are the whole list's. A drawn row says
// its place in its list (aria-posinset, aria-setsize); the spacers are not
// read. An ungrouped list's spacers stand in its rows; a grouped list
// (FO2-1) draws the groups the range reaches, each with its heading and the
// rows of it in the range, between two spacers in the list's body.
const spacer = (height, edge, tag = "li") => tag === "li"
    ? html`<li class="sf-list__spacer" data-sf-rows-spacer=${edge} aria-hidden="true"
        style=${`block-size: ${Math.max(0, Math.round(height))}px`}></li>`
    : html`<div class="sf-list__spacer" data-sf-rows-spacer=${edge} aria-hidden="true"
        style=${`block-size: ${Math.max(0, Math.round(height))}px`}></div>`;

const rows = (context, group, labelled) => {
    const win = context.window?.flat && group.key === "all" ? context.window : null;
    const part = context.window && !context.window.flat ? context.window.parts.get(group.key) : null;
    const from = win ? win.first : part ? part[0] : 0;
    const items = win
        ? group.items.slice(win.first, win.last + 1)
        : part ? (part[1] < 0 ? [] : group.items.slice(part[0], part[1] + 1)) : group.items;
    const placed = Boolean(win || part);
    return html`
    <ul class="sf-list__rows" aria-labelledby=${labelled ?? nothing} aria-label=${labelled ? nothing : context.label}
        data-sf-rows-window=${win ? `${win.first}-${win.last}` : nothing}>
        ${win ? spacer(win.before, "before") : nothing}
        ${repeat(items, (item) => item.id, (item, index) => row(context, item, group, placed ? {at: from + index + 1, of: group.items.length} : null))}
        ${win ? spacer(win.after, "after") : nothing}
    </ul>
`;
};

// The rows on their way (owner decision C130; list and feed study LF-2): the
// list's own rows, sf-list-item of the list's size, so a skeleton row is as
// tall as the row that replaces it -- one line, or the caption row (C49: 48,
// compact 44, 60 under a finger) -- and nothing moves when the rows arrive.
// The words are core's first-paint bars (C136: as tall as the capitals, in the
// middle of the line, the control radius at the ends, the skeleton fill and
// its pulse, C130 (3), (4)); the title a shorter bar than its caption line.
// Until a page has shown rows the list draws the caption row, the shape of
// the lists it serves (conversations, letters, files, versions); a list that
// has shown rows keeps their shape. aria-hidden: the status beside it says
// the wait.
//
// 1.16.0 (C130, C148 (1)): the skeleton row keeps the leading place of the
// rows it stands for, so its title bar starts where the title will. The
// place is the one the rows draw (leadingPlace() and the row's own icon): an icon
// is the row's line square with the control radius (C130 (1)); an avatar is
// sf-avatar's own box of the step the rows give it -- the control height in a
// list with a second line, else the row's line -- and its shape; a list with
// neither keeps no place. The shape is read from the rows the list has shown
// (context.skeleton.lead), never guessed: with none shown yet there is no
// place (a printed first paint, data-sf-first-paint="skeleton", carries the
// rows' own picture) -- unless the list's setting leading says it (1.17.0:
// icon, avatar or none, from the first frame).
const SKELETON_ROWS = 3;

const skeletonLead = (context) => {
    const lead = context.skeleton.lead;
    if (!lead) return nothing;
    if (lead.kind === "avatar") {
        const wide = lead.wide && context.skeleton.twoLine;
        const box = wide ? `sf-avatar--size-${context.size}` : `sf-avatar--size-1 sf-avatar--line-${context.size}`;
        const shape = lead.shape === "square" ? " sf-avatar--square" : "";
        return html`<span slot="leading" class="sf-list__lead"><span
                class=${`sf-avatar sf-avatar--picture ${box}${shape} sf-first-paint-fill sf-list__lead-skeleton`}></span></span>`;
    }
    return html`<span slot="leading" class="sf-list__lead"><span
            class="sf-first-paint-fill sf-list__lead-skeleton sf-list__lead-skeleton--icon"></span></span>`;
};

const skeleton = (context) => {
    const {twoLine, lead} = context.skeleton;
    const bar = (part) => html`<span class=${`sf-first-paint-bar sf-list__bar sf-list__bar--${part}`}>\u00a0</span>`;
    const wide = lead?.kind === "avatar" && lead.wide && twoLine;
    return html`
        <ul class="sf-list__rows sf-list__skeleton${wide ? " sf-list__skeleton--lead-wide" : ""}" aria-hidden="true">
            ${Array.from({length: SKELETON_ROWS}, () => html`
                <li class="sf-list__row sf-list__row--skeleton">
                    <sf-list-item
                            kind=${lead ? "icon" : "text"}
                            size=${context.size}
                            text="\u00a0"
                            supporting=${twoLine ? "\u00a0" : nothing}
                    >${skeletonLead(context)}<span slot="text">${bar("title")}</span>${twoLine
                        ? html`<span slot="supporting">${bar("supporting")}</span>`
                        : nothing}</sf-list-item>
                </li>`)}
        </ul>`;
};

export function renderListTemplate(context) {
    const {component} = context;
    return html`
        <div class="sf-list sf-list__frame sf-list--size-${context.size}${context.leading?.wide ? " sf-list--lead-wide" : ""}${context.noWrap ? " sf-list--no-wrap" : ""} ${context.empty ? "sf-list--empty" : ""}${context.selecting ? " sf-list--selecting" : ""}${context.chosen.size ? " sf-list--choosing" : ""}"
             role=${context.grouped ? "group" : nothing}
             aria-label=${context.grouped ? context.label : nothing}
             aria-busy=${context.loading ? "true" : "false"}>
            <span class="sf-list__width" aria-hidden="true"></span>
            ${context.loading
                ? html`${skeleton(context)}<p class="sr-only" role="status">${context.loadingText}</p>`
                : nothing}
            <div class="sf-list__body"
                 data-sf-list
                 data-sf-rows-window=${context.window && !context.window.flat ? `${context.window.first}-${context.window.last}` : nothing}
                 ?data-sf-rows-all=${context.rowsAll === true}
                 ?hidden=${context.empty || context.loading}
                 @keydown=${(event) => component.onKey(event)}
                 @sf-list-item-open=${(event) => component.onRowOpen(event)}>
                ${context.window && !context.window.flat && context.window.before > 0 ? spacer(context.window.before, "before", "div") : nothing}
                ${repeat(context.window && !context.window.flat ? context.sections.filter((group) => context.window.parts.has(group.key)) : context.sections, (group) => group.key, (group) => context.grouped
                    ? html`
                        <section class="sf-list__group" data-group=${group.key}>
                            <div class=${`sf-group-heading sf-list__heading${context.size === "1" ? "" : ` sf-group-heading--size-${context.size}`}${context.stickyHeadings ? " sf-group-heading--sticky" : ""}`}
                                 role="heading" aria-level=${context.headingLevel}
                                 id=${`${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`}>${group.heading}${group.date
                                ? html` <sf-time class="sf-group-heading-date" format="date" tooltip="none" datetime=${group.date}></sf-time>`
                                : nothing}</div>
                            ${rows(context, group, `${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`)}
                        </section>`
                    : rows(context, group, null))}
                ${context.window && !context.window.flat && context.window.after > 0 ? spacer(context.window.after, "after", "div") : nothing}
            </div>
            ${context.emptyContent
                // The page's own empty state stays in the document while the
                // list has rows, hidden: a page that looks it up by id to give
                // it its actions finds it whatever the list shows (ui-doc
                // «Рецепты», 2026-11-10). The list's own is drawn only when empty.
                ? html`<div class="sf-list__empty" ?hidden=${!context.empty}>${context.emptyContent}</div>`
                : context.empty
                    ? html`<div class="sf-list__empty"><sf-empty-state kind="no-data" size="1/2" heading=${context.emptyHeading}></sf-empty-state></div>`
                    : nothing}
            <div class="sf-list__next" ?hidden=${!context.showMore}>
                <sf-button
                        appearance="ghost"
                        scheme="on-surface"
                        size="1/2"
                        icon="expand_more"
                        text=${context.moreText}
                        ?disabled=${context.loadingMore}
                        aria-busy=${context.loadingMore ? "true" : "false"}
                        data-action="more"
                        @click=${() => component.requestMore()}
                ></sf-button>
                <span class="sr-only" role="status">${context.loadingMore ? context.loadingMoreText : ""}</span>
                <span class="sf-list__end" aria-hidden="true"></span>
            </div>
            ${context.selecting
                // The bar of the choice is sf-bulk-actions (C295): at the
                // list's bottom, at its width, sticking to the bottom of the
                // scroll; hidden while nothing is chosen. Its action is the
                // list's apply {action, scope: selection, ids}; its × and
                // Escape clear the choice.
                ? html`<sf-bulk-actions
                        class="sf-list__bulk"
                        place="dock"
                        size=${context.size}
                        count=${String(context.chosen.size)}
                        page-count=${String(context.rowCount)}
                        .actions=${context.selectionActions}
                        @sf-bulk-actions-action=${(event) => component.onBulkAction(event)}
                        @sf-bulk-actions-clear=${(event) => component.onBulkClear(event)}
                ></sf-bulk-actions>`
                : nothing}
        </div>
    `;
}
