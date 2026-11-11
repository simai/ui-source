import {html, nothing} from "lit";
import {repeat} from "lit/directives/repeat.js";
import "./default.css";

// The list, drawn in the component's light DOM on the Framework's plain list
// surface (the class unit .sf-list): the rows in their groups, the end of the
// list («Show more» and the sentinel the next page is asked by), the empty
// state, and one context menu shared by every row.
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

// hue auto picks the initials' hue from the row's title (sf-avatar reads its
// aria-label), so a conversation keeps its colour whatever its initials.
const leadContent = (context, item) => {
    const avatar = context.avatarOf(item);
    const size = context.size;
    const wide = Boolean(context.leading?.wide) && Boolean(item.supporting);
    if (avatar?.kind === "avatar") {
        return html`<sf-avatar
                aria-hidden="true"
                aria-label=${String(item.text ?? "") || nothing}
                hue="auto"
                size=${wide ? size : "1"}
                line=${wide ? nothing : size}
                shape=${avatar.shape}
                image-url=${avatar.imageUrl || nothing}
                text=${avatar.text || nothing}
                ?disabled=${item.disabled === true}
        ></sf-avatar>`;
    }
    if (avatar?.kind === "sign") {
        return html`<span class="sf-list__sign sf-avatar ${wide ? `sf-avatar--size-${size}` : `sf-avatar--size-1 sf-avatar--line-${size}`} sf-avatar--placeholder ${avatar.shape === "square" ? "sf-avatar--square" : ""} inline-flex flex-none items-cross-center content-main-center"
                          aria-hidden="true"><sf-icon icon=${avatar.icon} aria-hidden="true"></sf-icon></span>`;
    }
    const icon = typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "";
    return icon ? html`<sf-icon class="sf-list__glyph" icon=${icon} aria-hidden="true"></sf-icon>` : nothing;
};

const metaContent = (context, item) => {
    const count = context.countOf(item);
    const badge = context.badgeOf(item);
    const line = context.size;
    // A row is a dense place: its badge and count keep the tight side room
    // (sf-badge tight), so the wider default of sf-badge 1.3.0 does not push
    // the row's text aside.
    return html`${badge
        ? html`<sf-badge class="sf-list__badge" line=${line} appearance="tonal" tight
                         status=${BADGE_STATUS[badge.tone]} text=${badge.text}></sf-badge>`
        : nothing}${count
        ? html`<sf-badge class="sf-list__count" line=${line} scheme="primary" tight
                         text=${count > context.countCap ? `${context.countCap}+` : String(count)}
                         aria-label=${context.countLabel(count)}></sf-badge>`
        : nothing}`;
};

const row = (context, item) => {
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
            ><span slot="leading" class="sf-list__lead">${leadContent(context, item)}</span><span
                    slot="trailing" class="sf-list__meta">${metaContent(context, item)}</span></sf-list-item>`
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
            ><span slot="trailing" class="sf-list__meta">${metaContent(context, item)}</span></sf-list-item>`;
    return html`
        <li class="sf-list__row ${current ? "sf-list__row--current" : ""}" data-id=${item.id}>
            ${listItem}
            ${menu
                ? html`<button
                        type="button"
                        class="sf-list__actions sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-${context.size} flex items-cross-center content-main-center flex-none"
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

const rows = (context, items, labelled) => html`
    <ul class="sf-list__rows" aria-labelledby=${labelled ?? nothing} aria-label=${labelled ? nothing : context.label}>
        ${repeat(items, (item) => item.id, (item) => row(context, item))}
    </ul>
`;

export function renderListTemplate(context) {
    const {component} = context;
    return html`
        <div class="sf-list sf-list__frame sf-list--size-${context.size}${context.leading?.wide ? " sf-list--lead-wide" : ""}${context.noWrap ? " sf-list--no-wrap" : ""} ${context.empty ? "sf-list--empty" : ""}"
             role=${context.grouped ? "group" : nothing}
             aria-label=${context.grouped ? context.label : nothing}
             aria-busy=${context.loading ? "true" : "false"}>
            ${context.loading
                ? html`<div class="sf-list__skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
                       <p class="sr-only" role="status">${context.loadingText}</p>`
                : nothing}
            <div class="sf-list__body"
                 data-sf-list
                 ?hidden=${context.empty || context.loading}
                 @keydown=${(event) => component.onKey(event)}
                 @sf-list-item-open=${(event) => component.onRowOpen(event)}>
                ${repeat(context.sections, (group) => group.key, (group) => context.grouped
                    ? html`
                        <section class="sf-list__group" data-group=${group.key}>
                            <div class=${`sf-group-heading sf-list__heading${context.size === "1" ? "" : ` sf-group-heading--size-${context.size}`}${context.stickyHeadings ? " sf-group-heading--sticky" : ""}`}
                                 role="heading" aria-level=${context.headingLevel}
                                 id=${`${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`}>${group.heading}${group.date
                                ? html` <sf-time class="sf-group-heading-date" format="date" tooltip="none" datetime=${group.date}></sf-time>`
                                : nothing}</div>
                            ${rows(context, group.items, `${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`)}
                        </section>`
                    : rows(context, group.items, null))}
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
            <sf-menu-context
                    class="sf-list__menu"
                    popup
                    @sf-menu-context-select=${(event) => {
                        event.stopPropagation();
                        component.onMenu(event.detail);
                    }}
            ></sf-menu-context>
        </div>
    `;
}
