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
//
// The rows are keyed by id, so a row that moves keeps its node and a redraw
// does not take the focus from the row a person is on.

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
    return html`
        <li class="sf-list__row ${current ? "sf-list__row--current" : ""}" data-id=${item.id}>
            <sf-list-item
                    interactive
                    kind=${icon ? "icon" : "text"}
                    icon=${icon || nothing}
                    size=${context.size}
                    value=${item.id}
                    text=${text}
                    supporting=${supporting || nothing}
                    ?selected=${current}
                    ?disabled=${disabled}
            ></sf-list-item>
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
        <div class="sf-list sf-list__frame sf-list--size-${context.size} ${context.empty ? "sf-list--empty" : ""}"
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
                            <div class="sf-list__heading" role="heading" aria-level=${context.headingLevel}
                                 id=${`${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`}>${group.heading}</div>
                            ${rows(context, group.items, `${context.uid}-${group.key.replace(/[^\w-]/gu, "_")}`)}
                        </section>`
                    : rows(context, group.items, null))}
            </div>
            ${context.empty
                ? html`<div class="sf-list__empty">${context.emptyContent
                    ?? html`<sf-empty-state kind="no-data" size="1/2" heading=${context.emptyHeading}></sf-empty-state>`}</div>`
                : nothing}
            <div class="sf-list__next" ?hidden=${!context.showMore}>
                <sf-button
                        appearance="link"
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
