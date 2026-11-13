import {html, nothing} from "lit";
import {getInitials} from "../../../helpers/text";
import {shortcutView} from "../../../../component/kbd/js/shortcut";

// A destructive row: danger: true, or status "danger" as every control writes
// it (C13), with "error" read as its alias.
function isDestructive(entry) {
    return Boolean(entry.danger) || entry.status === "danger" || entry.status === "error";
}

// An entry's shortcut: the kbd component's keys -- `mod+c` in this platform's
// words, or the text a page wrote (⇧⌘L, F2) as it is. Inside a menu the kbd
// sheet draws them as plain glyphs in the muted ink; the menu never styles
// them (owner decision 2026-11-07, docs review R030, rule C04).
function renderShortcut(value) {
    const {keys, join} = shortcutView(value);
    if (!keys.length) return nothing;
    return html`<kbd class="sf-kbd--group sf-context-menu-item-shortcut">${keys.map((key, at) => html`${at && join ? html`<span class="sf-kbd-join">+</span>` : nothing}<kbd class=${key.square ? "sf-kbd--square" : nothing}>${key.text}</kbd>`)}</kbd>`;
}

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
// an optional icon (or a check, on a row that is ticked), a label and caption,
// and at its end a value, a shortcut or a submenu chevron; a separator is a rule; a heading names the group
// of items under it. The row geometry is the profile menu's (owner, 2026-10-12):
// as tall as a size-1/2 field, its content on the field's axis.
const ROLE = {check: "menuitemcheckbox", radio: "menuitemradio"};

function icon(name, className) {
    return html`<i class="sf-icon ${className}" aria-hidden="true">${name}</i>`;
}

// A colour the row stands for -- a colour row of sf-settings (C85), a label's
// colour -- drawn as a circle in the place of an icon. `swatch` is a CSS
// colour (a code, var() of a token, light-dark() of two); anything that could
// close the declaration is not drawn.
const SWATCH = /^[#\w\s(),.%/-]+$/u;
const hasSwatch = (entry) => typeof entry?.swatch === "string" && SWATCH.test(entry.swatch);
function swatch(value) {
    return html`<span class="sf-context-menu-item-swatch" style=${`--sf-context-menu-swatch: ${value}`} aria-hidden="true"></span>`;
}

// What leads a row: an icon, or a picture of the thing itself -- a site's logo,
// a person -- with its initials when there is no picture. A row ticked on and
// off (kind: "check") leads with its check, in the column and at the width of
// the icons: nothing is kept at the row's end for it (owner R016, 2026-11-07).
// Unticked, it shows its own icon, if it has one.
function renderLead(entry) {
    if (entry.kind === "check" && entry.type !== "switch" && entry.checked) return icon("check", "sf-context-menu-item-check");
    if (entry.avatar) return html`<img class="sf-context-menu-item-avatar" src=${entry.avatar} alt="">`;
    if (entry.initials) return html`<span class="sf-context-menu-item-avatar" aria-hidden="true">${entry.initials}</span>`;
    if (hasSwatch(entry)) return swatch(entry.swatch);
    return entry.icon ? icon(entry.icon, "sf-context-menu-item-icon") : nothing;
}

// The leading column of the level: kept for every row once any row of it has
// something to lead with -- an icon, a picture, or a check it may be given --
// so the labels start on one line.
function renderLeadPlace(entry, lead) {
    return lead ? html`<span class="sf-context-menu-item-lead">${renderLead(entry)}</span>` : nothing;
}

// Who the menu is about -- the signed-in person at the top of a profile menu.
// Text, not an item: it is read, not chosen.
// Its initials, without a picture, are sf-avatar's rule (helpers/text.js
// getInitials; reuse audit 2026-11-02, finding 10): the copy here took
// word[0], half a letter outside the basic plane, and kept «по» as a word.
function renderHeader(entry) {
    const picture = entry.avatar
        ? html`<img class="sf-context-menu-header-avatar" src=${entry.avatar} alt="">`
        : html`<span class="sf-context-menu-header-avatar" aria-hidden="true">${entry.initials ?? getInitials(entry.text ?? "")}</span>`;
    const lines = Array.isArray(entry.caption) ? entry.caption : [entry.caption].filter(Boolean);
    return html`<div class="sf-context-menu-header" role="presentation">
        ${picture}
        <span class="sf-context-menu-header-text">
            <span class="sf-context-menu-header-name">${entry.text ?? ""}</span>
            ${lines.map((line) => html`<span class="sf-context-menu-header-caption">${line}</span>`)}
        </span>
    </div>`;
}

// The text of a row: its label, the value under it where the row shows one (a
// drilling row), and the caption. A long label wraps and a long value is cut
// with the whole of it in `title`, so neither widens the panel.
function renderItemText(entry, under = "") {
    return html`<span class="sf-context-menu-item-text">
            <span class="sf-context-menu-item-label">${entry.text ?? ""}</span>
            ${under ? html`<span class="sf-context-menu-item-under" title=${under}>${under}</span>` : nothing}
            ${entry.caption ? html`<span class="sf-context-menu-item-caption">${entry.caption}</span>` : nothing}
        </span>`;
}

// The options of a choice, side by side. Each is a menuitemradio of the menu,
// so the arrows walk through them as through any row.
function renderChoiceOptions(entry, path, iconsOnly) {
    return (entry.options ?? []).map((option, at) => html`<button
            type="button"
            class="sf-context-menu-item sf-context-menu-choice-option"
            role="menuitemradio"
            data-sf-entry=${path}
            data-sf-option=${at}
            aria-checked=${String(Boolean(option.checked))}
            aria-label=${option.text ?? nothing}
            title=${iconsOnly ? option.text ?? nothing : nothing}
            ?disabled=${Boolean(option.disabled)}
    >${hasSwatch(option) ? swatch(option.swatch) : option.icon ? icon(option.icon, "") : option.text ?? ""}</button>`);
}

// A choice of a few options -- the theme in a profile menu, a setting in a
// panel. The quiet form, the default since 1.5.0 (owner, 2026-10-30): the
// label on its own row with the options at its end, sized to their content,
// no frame and no dividers, the chosen one on a soft fill. `view: "band"`
// draws the framed full-width band instead, for a row that must show every
// option across the panel.
// A choice row that opens its options as a level of their own: the label, the
// chosen option under it in small dimmed text and the chevron at the end --
// the shape a row with a submenu has, because that is what it is. Only a
// drilling panel has a level to open, so a flyout menu draws the quiet row.
function renderChoiceDrill(entry, path, lead) {
    const chosen = (entry.options ?? []).find((option) => option.checked);
    const under = chosen?.text ?? "";
    return html`<button
            type="button"
            class="sf-context-menu-item"
            role="menuitem"
            data-sf-entry=${path}
            aria-haspopup="menu"
            aria-expanded="false"
            ?disabled=${Boolean(entry.disabled)}
    >
        ${renderLeadPlace(entry, lead)}
        ${renderItemText(entry, under)}
        ${icon("chevron_right", "sf-context-menu-item-chevron")}
    </button>`;
}

// The options of a drilled choice as the level's rows: each a menuitemradio of
// the menu, the chosen one on the soft fill of a chosen row and no check mark
// (owner R016, 2026-11-07: a pick-one list), found by the row's own path and
// its place in the list, as an option of the quiet row is.
function renderLevelOptions(choice, context) {
    const {entry, path} = choice;
    const options = entry.options ?? [];
    const lead = options.some((option) => option.icon || hasSwatch(option));
    const query = String(context.query ?? "").trim().toLowerCase();
    const shown = options.map((option, at) => [option, at])
        .filter(([option]) => !query || String(option.text ?? "").toLowerCase().includes(query));
    return shown.map(([option, at]) => html`<button
            type="button"
            class=${joinClasses("sf-context-menu-item", "sf-context-menu-level-option", option.checked ? "sf-context-menu-item--chosen" : "")}
            role="menuitemradio"
            data-sf-entry=${path}
            data-sf-option=${at}
            aria-checked=${String(Boolean(option.checked))}
            ?disabled=${Boolean(option.disabled)}
    >
        ${lead ? html`<span class="sf-context-menu-item-lead">${hasSwatch(option) ? swatch(option.swatch) : option.icon ? icon(option.icon, "sf-context-menu-item-icon") : nothing}</span>` : nothing}
        ${renderItemText(option)}
    </button>`);
}

function renderChoice(entry, path, lead, context) {
    const options = entry.options ?? [];
    const iconsOnly = options.length > 0 && options.every((option) => option.icon || hasSwatch(option));
    if (context?.drill && entry.view === "drill" && options.length > 0) {
        return renderChoiceDrill(entry, path, lead);
    }
    if (entry.view === "band") {
        return html`<div class="sf-context-menu-choice sf-context-menu-choice--band" role="group" aria-label=${entry.text ?? nothing}>
            ${renderChoiceOptions(entry, path, iconsOnly)}
        </div>`;
    }
    return html`<div class="sf-context-menu-value-row sf-context-menu-value-row--choice">
        ${renderLeadPlace(entry, lead)}
        ${renderItemText(entry)}
        <span class=${joinClasses("sf-context-menu-choice", iconsOnly ? "sf-context-menu-choice--icons" : "")}
                role="group" aria-label=${entry.text ?? nothing}>
            ${renderChoiceOptions(entry, path, iconsOnly)}
        </span>
    </div>`;
}

// A boolean setting's control: the Framework switch's track and thumb, drawn.
// The row itself is the menuitemcheckbox -- an input inside a button is no
// markup at all -- so the state is read from the row's aria-checked.
function renderSwitch() {
    return html`<span class="sf-context-menu-item-switch" aria-hidden="true">
        <span class="sf-context-menu-item-switch-thumb"></span>
    </span>`;
}

// How a range's value reads: the number and the unit written after it, with no
// space -- "90%", "16px" -- the way the ladder's own lengths are written.
function rangeText(entry) {
    return `${entry.value ?? entry.min ?? 0}${entry.unit ?? ""}`;
}

// A number in a range: the platform's own slider at the row's end with the
// number after it. The slider is not a menu item -- it keeps its own slider
// role, its side arrows and its announcement -- and carries
// sf-context-menu-stop, which joins it to the menu's roving tab stop.
function renderRange(entry, path, lead, context) {
    const text = rangeText(entry);
    return html`<div class="sf-context-menu-value-row sf-context-menu-value-row--range">
        ${renderLeadPlace(entry, lead)}
        ${renderItemText(entry)}
        <span class="sf-context-menu-range">
            <input
                    class="sf-context-menu-range-input sf-context-menu-stop"
                    type="range"
                    data-sf-entry=${path}
                    min=${entry.min ?? 0}
                    max=${entry.max ?? 100}
                    step=${entry.step ?? 1}
                    .value=${String(entry.value ?? entry.min ?? 0)}
                    ?disabled=${Boolean(entry.disabled)}
                    aria-label=${entry.text ?? nothing}
                    aria-valuetext=${text}
                    @input=${(event) => context?.component?.previewRange(event.target)}
                    @change=${(event) => context?.component?.commitRange(event.target)}
            >
            <span class="sf-context-menu-range-value" aria-hidden="true">${text}</span>
        </span>
    </div>`;
}

// What a tile says it is set to: a switch's state in words, the chosen option
// of a choice, otherwise the row's own value.
function tileValue(entry, context) {
    if (entry?.type === "switch") return entry.value ? context?.onLabel ?? "" : context?.offLabel ?? "";
    if (entry?.type === "choice") return (entry.options ?? []).find((option) => option.checked)?.text ?? "";
    return entry?.value ?? "";
}

// A tile of a group: a row of the menu with the row's own role, laid out as a
// plate -- the icon, the name and the current value -- so it is read without a
// tooltip. A switch tile is on when its value is.
function renderTile(entry, path, context) {
    const toggle = entry?.type === "switch";
    const value = tileValue(entry, context);
    const classes = joinClasses(
        "sf-context-menu-item",
        "sf-context-menu-tile",
        toggle && entry.value ? "sf-context-menu-tile--on" : "",
    );
    return html`<button
            type="button"
            class=${classes}
            role=${toggle ? "menuitemcheckbox" : "menuitem"}
            data-sf-entry=${path}
            aria-checked=${toggle ? String(Boolean(entry.value)) : nothing}
            aria-label=${value ? `${entry.text ?? ""}: ${value}` : nothing}
            ?disabled=${Boolean(entry.disabled)}
    >
        ${icon(entry.icon || "tune", "sf-context-menu-tile-icon")}
        <span class="sf-context-menu-tile-name">${entry.text ?? ""}</span>
        <span class="sf-context-menu-tile-value" title=${value || nothing}>${value}</span>
    </button>`;
}

// A block of rows declared as one entry: a named group of rows, or the grid of
// tiles a panel's quick settings are. Its items carry paths of their own, the
// step the submenu grammar already had, and a search narrows them as it
// narrows the level.
function renderGroup(entry, path, context, query) {
    const items = (entry.items ?? []).map((item, index) => [item, index])
        .filter(([item]) => matches(item, query));
    if (!items.length) return nothing;
    const name = entry.text ?? nothing;
    if (entry.view === "tiles") {
        const columns = items.length === 4 ? 2 : Math.min(items.length, 3);
        return html`<div class=${`sf-context-menu-tiles sf-context-menu-tiles--${columns}`} role="group" aria-label=${name}>
            ${items.map(([item, index]) => renderTile(item, `${path}/${index}`, context))}
        </div>`;
    }
    const lead = items.some(([item]) => leads(item));
    return html`<div class="sf-context-menu-group" role="group" aria-label=${name}>
        ${items.map(([item, index]) => renderEntry(item, `${path}/${index}`, lead, context, query))}
    </div>`;
}

function renderEntry(entry, path, lead, context, query) {
    if (entry?.type === "header") return renderHeader(entry);
    if (entry?.type === "choice") return renderChoice(entry, path, lead, context);
    if (entry?.type === "range") return renderRange(entry, path, lead, context);
    if (entry?.type === "group") return renderGroup(entry, path, context, query);
    if (entry?.type === "note") {
        return html`<p class="sf-context-menu-note">${entry.text ?? ""}</p>`;
    }
    if (entry?.type === "separator") {
        return html`<div class="sf-context-menu-separator" role="separator"></div>`;
    }
    if (entry?.type === "heading") {
        return html`<div class="sf-context-menu-heading" role="presentation">${entry.text ?? ""}</div>`;
    }
    // A switch row is a boolean setting (1.5.0): the row is the
    // menuitemcheckbox, its value lives in the entry and the switch is drawn.
    const toggle = entry?.type === "switch";
    const role = toggle ? "menuitemcheckbox" : ROLE[entry.kind] ?? "menuitem";
    const checkable = !toggle && role !== "menuitem";
    // One of a pick-one list (kind: "radio") is marked by the soft fill of a
    // chosen row, with no mark and no column kept for one, so the rows use the
    // whole width (owner R016, 2026-11-07).
    const chosen = role === "menuitemradio" && Boolean(entry.checked);
    const submenu = Array.isArray(entry.submenu) && entry.submenu.length > 0;
    // A drilling row shows its value under the name, where a long one is cut
    // instead of pushing the row's end about (owner, 2026-10-30).
    const under = context?.drill && submenu ? entry.value ?? "" : "";
    const classes = joinClasses(
        "sf-context-menu-item",
        toggle ? "sf-context-menu-item--switch" : "",
        isDestructive(entry) ? "sf-context-menu-item--danger" : "",
        entry.current ? "sf-context-menu-item--current" : "",
        chosen ? "sf-context-menu-item--chosen" : "",
    );
    const body = html`
        ${renderLeadPlace(entry, lead)}
        ${renderItemText(entry, under)}
        ${entry.value && !under && !toggle ? html`<span class="sf-context-menu-item-value">${entry.value}</span>` : nothing}
        ${renderShortcut(entry.shortcut)}
        ${toggle ? renderSwitch() : nothing}
        ${submenu ? icon("chevron_right", "sf-context-menu-item-chevron") : nothing}
    `;
    if (entry.href && !submenu && !entry.disabled) {
        return html`<a class=${classes} href=${entry.href} role=${role} data-sf-entry=${path} lang=${entry.lang ?? nothing}>${body}</a>`;
    }
    return html`<button
            type="button"
            class=${classes}
            role=${role}
            data-sf-entry=${path}
            lang=${entry.lang ?? nothing}
            aria-checked=${toggle ? String(Boolean(entry.value)) : checkable ? String(Boolean(entry.checked)) : nothing}
            aria-haspopup=${submenu ? "menu" : nothing}
            aria-expanded=${submenu ? "false" : nothing}
            ?disabled=${Boolean(entry.disabled)}
    >${body}</button>`;
}

// What is not a row: the blocks that stand between rows. A choice row is a
// row since 1.5.0 (the quiet form, owner 2026-10-30): it has a lead, a label
// and a value of its own, so it keeps the level's leading column and a search
// narrows to it. A group holds rows, so it counts as rows.
const BLOCKS = new Set(["separator", "heading", "header", "note"]);

const ROWS = (entry) => entry && !BLOCKS.has(entry.type);

// A row that keeps the level's leading column: one with an icon or a picture,
// and one that can be ticked, whose check stands there.
function leads(entry) {
    return Boolean(entry.icon || entry.avatar || entry.initials || hasSwatch(entry) || (entry.kind === "check" && entry.type !== "switch"));
}

// What a search narrows to: the rows whose label or caption holds the query. A
// group is kept while one of its own rows is: the block is where its rows live,
// not a thing to be found on its own.
function matches(entry, query) {
    if (!query) return true;
    if (!ROWS(entry)) return false;
    if (entry.type === "group") return (entry.items ?? []).some((item) => matches(item, query));
    const text = `${entry.text ?? ""} ${entry.caption ?? ""} ${entry.keywords ?? ""}`.toLowerCase();
    return text.includes(query);
}

function renderSearch(context) {
    const search = context.search;
    // The panel's header (owner C06, R029): the search icon over the rows'
    // icons, the text over their text, no frame.
    return html`<div class="sf-context-menu-search">
        ${icon("search", "sf-context-menu-search-icon")}
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

// The way back and the parent's label, on a drilling panel's head: the panel
// replaces its content instead of opening a second one beside it, so its width
// never grows with the depth (owner, 2026-10-30).
function renderDrillHead(context) {
    return html`<div class="sf-context-menu-drill-head">
        <sf-button-icon class="sf-context-menu-back" icon="arrow_back" appearance="ghost" scheme="on-surface"
                size=${context.size === "1" ? "1" : "1/2"}
                aria-label=${context.backLabel} title=${context.backLabel}
                @click=${() => context.component.drillBack()}></sf-button-icon>
        <span class="sf-context-menu-level-title">${context.level?.label ?? ""}</span>
    </div>`;
}

function renderEntries(context) {
    const level = context.level ?? {entries: context.entries, prefix: "", depth: 0, label: ""};
    // A level that is one choice row's options: its rows are those options,
    // under the head that says which setting they belong to.
    if (level.choice) {
        return html`
            ${renderDrillHead(context)}
            ${context.search ? renderSearch(context) : nothing}
            ${searchList(context, renderLevelOptions(level.choice, context))}
        `;
    }
    const entries = level.entries;
    const prefix = level.prefix;
    const query = String(context.query ?? "").trim().toLowerCase();
    // One leading column for the whole menu: when any item has an icon, every
    // item keeps the place, so the labels start on one line.
    // A group's rows keep a leading column of their own, inside the block.
    const lead = entries.some((entry) => ROWS(entry) && entry.type !== "group" && leads(entry));
    // A search the host answers (search.remote) shows the entries as the host
    // set them for the query; a local one narrows them here. A host that set no
    // rows has found nothing, whatever the field holds -- an answer to an older
    // query can arrive after the field was cleared -- so its note shows then too.
    const remote = Boolean(context.search?.remote);
    const shown = entries.map((entry, index) => [entry, index]).filter(([entry]) => remote || matches(entry, query));
    return html`
        ${level.depth > 0 ? renderDrillHead(context) : nothing}
        ${context.search ? renderSearch(context) : nothing}
        ${searchList(context, html`
            ${shown.map(([entry, index]) => renderEntry(entry, `${prefix}${index}`, lead, context, remote ? "" : query))}
            ${context.search && (query || remote) && !shown.some(([entry]) => ROWS(entry)) ? html`<p class="sf-context-menu-note" role="status">${context.search.empty ?? ""}</p>` : nothing}
        `)}
    `;
}

// A menu with a search keeps the field (and a drilling level's head) where it
// is and scrolls its rows alone, under it: the field scrolled away with the
// list and the scrollbar ran beside it (owner R012, 2026-11-07). Without a
// search the rows stay children of the content, as before; a panel with tabs
// already scrolls its body alone under a head that stays.
function searchList(context, rows) {
    return context.search && !context.panel ? html`<div class="sf-context-menu-list">${rows}</div>` : rows;
}

// Whether the menu draws entries. A menu with a search does while its entries
// are empty: a host that answered a query with no rows took the field, and the
// focus in it, out of the page, and the root lost its entries class -- the
// class list openFor() wrote sf-context-menu--open into was written again
// without it, so the surface hid and the menu looked closed (docs thread,
// 2026-11-07). The field stays, with the empty note under it, as a local
// search shows, and the class lists stay as they were.
function drawsEntries(context) {
    if (context.entries && context.entries.length) return true;
    return Boolean(context.search && !(context.items && context.items.length)
        && !context.component?.hasSlotContent?.("content"));
}

function renderContent(context) {
    if (drawsEntries(context)) {
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
// the body under it does (owner, 2026-10-15). The tab is chosen on sf-tabs'
// current event, sf-tabs-change; its former name sf-tab-change, which sf-tabs
// still sends after it until 2026-12-01, is only kept inside the menu (both
// stop here, the menu is not a tab strip). Remove that stopper with the alias.
function renderPanelHead(context) {
    const active = context.activeTab;
    return html`<div class="sf-context-menu-head">
        <sf-tabs class="sf-context-menu-tabs" type="underline" size=${context.size === "1" ? "1" : "1/2"}
                items=${context.tabs.map((tab) => tab.label).join("|")}
                active-index=${String(active?.index ?? 0)}
                @sf-tabs-change=${(event) => {
                    event.stopPropagation();
                    context.component.chooseTab(Number(event.detail?.current ?? 0));
                }}
                @sf-tab-change=${(event) => event.stopPropagation()}></sf-tabs>
        ${context.closable ? html`<sf-button-icon class="sf-context-menu-close" appearance="ghost" scheme="on-surface"
                size=${context.size === "1" ? "1" : "1/2"} icon="close"
                aria-label=${context.closeLabel} title=${context.closeLabel}
                @click=${() => context.component.requestClose()}></sf-button-icon>` : nothing}
    </div>`;
}

// No tail (owner, 2026-10-12): it never read as one piece with the panel. The
// position attribute is kept for its class and draws nothing.
function renderTooltip() {
    return nothing;
}

// The box is laid out by the menu's own sheet, not by utilities: the root a
// row of one, .sf-context-menu-frame the positioned frame, the content a
// column that takes the rest (component.context-menu 1.8.0). The template
// wrote flex, relative, flex-col and flex-1, and on a Docara page the Loader
// linked utility/position after the first frame (sf-menu-context 1.14.1).
export function renderContextMenuTemplate(context) {
    const rootClasses = joinClasses(
        "sf-context-menu",
        context.position ? `sf-context-menu--position-${context.position}` : "",
        drawsEntries(context) ? "sf-context-menu--entries" : "",
        context.size === "1" ? "sf-context-menu--size-1" : "",
        context.panel ? "sf-context-menu--panel" : "",
        context.drill ? "sf-context-menu--drill" : "",
        context.rootClass,
    );

    const contentClasses = joinClasses(
        "sf-context-menu-content",
        // On the content, not the root: the root's class list is the one
        // openFor() adds sf-context-menu--open to, and a level that draws a
        // search changes the list while the menu is open.
        context.search && drawsEntries(context) && !context.panel ? "sf-context-menu-content--search" : "",
        context.contentClass,
    );

    return html`
        <div
                class=${rootClasses}
                style=${context.rootStyle || nothing}
                role=${context.role || "menu"}
                aria-label=${context.ariaLabel || nothing}
        >
            <div class="sf-context-menu-frame">
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
