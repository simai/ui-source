import {html, nothing} from "lit";

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(" ");
}


function renderItem(item) {
    if (item?.component === "sf-button") {
        const props = item.props || {};
        const click = props["@click"];

        return html`
            <sf-button
                    appearance=${props.type || "default"}
                    scheme=${props.scheme || "primary"}
                    size=${props.size || "1"}
                    text=${props.text || ""}
                    icon-start=${props.iconLeft || ""}
                    icon-end=${props.iconRight || ""}
                    aria-label=${props.ariaLabel || props.text || nothing}
                    ?disabled=${Boolean(props.disabled)}
                    @click=${typeof click === "function" ? click : nothing}
            ></sf-button>
        `;
    }

    return SF.__internal.litHtml(item.component, item.props);
}

function renderItems(items) {
    return html`
        ${items.map(renderItem)}
    `
}

// The standard menu: entries are data, not components. An item is a row with
// an optional icon, a label and caption, and at its end a value, a shortcut, a
// check or a submenu chevron; a separator is a rule; a heading names the group
// of items under it. The row geometry is the profile menu's (owner, 2026-10-12):
// as tall as a size-1/2 field, its content on the field's axis.
const ROLE = {check: "menuitemcheckbox", radio: "menuitemradio"};

function icon(name, className) {
    return html`<i class="sf-icon ${className}" aria-hidden="true">${name}</i>`;
}

// Initials for a person without a picture: the first letter of the first two
// words, the way an avatar draws them.
function initials(name = "") {
    return String(name).trim().split(/\s+/u).slice(0, 2).map((word) => word[0] ?? "").join("").toUpperCase();
}

// What leads a row: an icon, or a picture of the thing itself -- a site's logo,
// a person -- with its initials when there is no picture.
function renderLead(entry) {
    if (entry.avatar) return html`<img class="sf-context-menu-item-avatar" src=${entry.avatar} alt="">`;
    if (entry.initials) return html`<span class="sf-context-menu-item-avatar" aria-hidden="true">${entry.initials}</span>`;
    return entry.icon ? icon(entry.icon, "sf-context-menu-item-icon") : nothing;
}

// Who the menu is about -- the signed-in person at the top of a profile menu.
// Text, not an item: it is read, not chosen.
function renderHeader(entry) {
    const picture = entry.avatar
        ? html`<img class="sf-context-menu-header-avatar" src=${entry.avatar} alt="">`
        : html`<span class="sf-context-menu-header-avatar" aria-hidden="true">${entry.initials ?? initials(entry.text)}</span>`;
    const lines = Array.isArray(entry.caption) ? entry.caption : [entry.caption].filter(Boolean);
    return html`<div class="sf-context-menu-header" role="presentation">
        ${picture}
        <span class="sf-context-menu-header-text">
            <span class="sf-context-menu-header-name">${entry.text ?? ""}</span>
            ${lines.map((line) => html`<span class="sf-context-menu-header-caption">${line}</span>`)}
        </span>
    </div>`;
}

// A choice of a few options side by side -- the theme in a profile menu. Each
// option is a menuitemradio of the menu, so the arrows walk through them as
// through any row.
function renderChoice(entry, index) {
    return html`<div class="sf-context-menu-choice" role="group" aria-label=${entry.text ?? nothing}>
        ${(entry.options ?? []).map((option, at) => html`<button
                type="button"
                class="sf-context-menu-item sf-context-menu-choice-option"
                role="menuitemradio"
                data-sf-entry=${index}
                data-sf-option=${at}
                aria-checked=${String(Boolean(option.checked))}
                aria-label=${option.text ?? nothing}
                title=${option.text ?? nothing}
                ?disabled=${Boolean(option.disabled)}
        >${option.icon ? icon(option.icon, "") : option.text ?? ""}</button>`)}
    </div>`;
}

function renderEntry(entry, index, lead) {
    if (entry?.type === "header") return renderHeader(entry);
    if (entry?.type === "choice") return renderChoice(entry, index);
    if (entry?.type === "note") {
        return html`<p class="sf-context-menu-note">${entry.text ?? ""}</p>`;
    }
    if (entry?.type === "separator") {
        return html`<div class="sf-context-menu-separator" role="separator"></div>`;
    }
    if (entry?.type === "heading") {
        return html`<div class="sf-context-menu-heading" role="presentation">${entry.text ?? ""}</div>`;
    }
    const role = ROLE[entry.kind] ?? "menuitem";
    const checkable = role !== "menuitem";
    const submenu = Array.isArray(entry.submenu) && entry.submenu.length > 0;
    const classes = joinClasses(
        "sf-context-menu-item",
        entry.danger ? "sf-context-menu-item--danger" : "",
        entry.current ? "sf-context-menu-item--current" : "",
    );
    const body = html`
        ${lead ? html`<span class="sf-context-menu-item-lead">${renderLead(entry)}</span>` : nothing}
        <span class="sf-context-menu-item-text">
            <span class="sf-context-menu-item-label">${entry.text ?? ""}</span>
            ${entry.caption ? html`<span class="sf-context-menu-item-caption">${entry.caption}</span>` : nothing}
        </span>
        ${entry.value ? html`<span class="sf-context-menu-item-value">${entry.value}</span>` : nothing}
        ${entry.shortcut ? html`<kbd class="sf-context-menu-item-shortcut">${entry.shortcut}</kbd>` : nothing}
        ${checkable ? html`<span class="sf-context-menu-item-check">${entry.checked ? icon("check", "") : nothing}</span>` : nothing}
        ${submenu ? icon("chevron_right", "sf-context-menu-item-chevron") : nothing}
    `;
    if (entry.href && !submenu && !entry.disabled) {
        return html`<a class=${classes} href=${entry.href} role=${role} data-sf-entry=${index} lang=${entry.lang ?? nothing}>${body}</a>`;
    }
    return html`<button
            type="button"
            class=${classes}
            role=${role}
            data-sf-entry=${index}
            lang=${entry.lang ?? nothing}
            aria-checked=${checkable ? String(Boolean(entry.checked)) : nothing}
            aria-haspopup=${submenu ? "menu" : nothing}
            aria-expanded=${submenu ? "false" : nothing}
            ?disabled=${Boolean(entry.disabled)}
    >${body}</button>`;
}

const ROWS = (entry) => entry && !["separator", "heading", "header", "choice", "note"].includes(entry.type);

// What a search narrows to: the rows whose label or caption holds the query.
function matches(entry, query) {
    if (!query) return true;
    if (!ROWS(entry)) return false;
    const text = `${entry.text ?? ""} ${entry.caption ?? ""} ${entry.keywords ?? ""}`.toLowerCase();
    return text.includes(query);
}

function renderSearch(context) {
    const search = context.search;
    return html`<div class="sf-context-menu-search">
        <input
                class="sf-context-menu-search-input"
                type="search"
                autocomplete="off"
                spellcheck="false"
                placeholder=${search.placeholder ?? ""}
                aria-label=${search.placeholder || context.ariaLabel || nothing}
                .value=${context.query ?? ""}
                @input=${(event) => context.component.setQuery(event.target.value)}
        >
    </div>`;
}

function renderEntries(context) {
    const entries = context.entries;
    const query = String(context.query ?? "").trim().toLowerCase();
    // One leading column for the whole menu: when any item has an icon, every
    // item keeps the place, so the labels start on one line.
    const lead = entries.some((entry) => ROWS(entry) && (entry.icon || entry.avatar || entry.initials));
    // A search the host answers (search.remote) shows the entries as the host
    // set them for the query; a local one narrows them here.
    const remote = Boolean(context.search?.remote);
    const shown = entries.map((entry, index) => [entry, index]).filter(([entry]) => remote || matches(entry, query));
    return html`
        ${context.search ? renderSearch(context) : nothing}
        ${shown.map(([entry, index]) => renderEntry(entry, index, lead))}
        ${context.search && query && !shown.some(([entry]) => ROWS(entry)) ? html`<p class="sf-context-menu-note" role="status">${context.search.empty ?? ""}</p>` : nothing}
    `;
}

function renderContent(context) {
    if (context.entries && context.entries.length) {
        return renderEntries(context);
    }
    if (context.items && context.items.length) {
        return renderItems(context.items);
        // console.log(items);
    }
    if (context.component?.hasSlotContent?.("content")) {
        return context.component.getSlotContent("content");
    }

    return context.text || nothing;
}

// The footer of actions: what is slotted as "footer" stands under the rows,
// at the bottom while they scroll, its buttons sharing the width.
function renderFooter(context) {
    if (!context.component?.hasSlotContent?.("footer")) return nothing;
    return html`<div class="sf-context-menu-footer">${context.component.getSlotContent("footer")}</div>`;
}

// A panel's head: the tabs, and the way out at its end. It never scrolls --
// the body under it does (owner, 2026-10-15).
function renderPanelHead(context) {
    const active = context.activeTab;
    return html`<div class="sf-context-menu-head">
        <sf-tabs class="sf-context-menu-tabs" type="underline" size=${context.size === "1" ? "1" : "1/2"}
                items=${context.tabs.map((tab) => tab.label).join("|")}
                active-index=${String(active?.index ?? 0)}
                @sf-tab-change=${(event) => {
                    event.stopPropagation();
                    context.component.chooseTab(Number(event.detail?.current ?? 0));
                }}></sf-tabs>
        ${context.closable ? html`<sf-icon-button class="sf-context-menu-close" appearance="link" scheme="on-surface"
                size=${context.size === "1" ? "1" : "1/2"} icon="close"
                aria-label=${context.closeLabel} title=${context.closeLabel}
                @click=${() => context.component.requestClose()}></sf-icon-button>` : nothing}
    </div>`;
}

// No tail (owner, 2026-10-12): it never read as one piece with the panel. The
// position attribute is kept for its class and draws nothing.
function renderTooltip() {
    return nothing;
}

export function renderContextMenuTemplate(context) {
    const rootClasses = joinClasses(
        "sf-context-menu",
        context.position ? `sf-context-menu--position-${context.position}` : "",
        context.entries && context.entries.length ? "sf-context-menu--entries" : "",
        context.size === "1" ? "sf-context-menu--size-1" : "",
        context.panel ? "sf-context-menu--panel" : "",
        "flex",
        context.rootClass,
    );

    const contentClasses = joinClasses(
        "sf-context-menu-content",
        "flex",
        "flex-col",
        "flex-1",
        context.contentClass,
    );

    return html`
        <div
                class=${rootClasses}
                style=${context.rootStyle || nothing}
                role=${context.role || "menu"}
                aria-label=${context.ariaLabel || nothing}
        >
            <div class="relative">
                ${renderTooltip(context)}
                ${context.panel
                    ? html`<div class=${contentClasses}>
                        ${renderPanelHead(context)}
                        <div class="sf-context-menu-body" role="tabpanel" aria-label=${context.activeTab?.label ?? nothing}>${renderContent(context)}</div>
                        ${renderFooter(context)}
                    </div>`
                    : html`<div class=${contentClasses}>${renderContent(context)}${renderFooter(context)}</div>`}
            </div>
        </div>
    `;
}
