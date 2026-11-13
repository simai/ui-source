import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {fieldOptions, holdsValue, itemValue, matches} from '../settings.js';

// sf-settings' panel look (owner decision C106, 2026-11-12): the settings of a
// list's view -- its fields, their order, the density -- in a panel of its own,
// not in the action menu. The panel is this element's markup and its sheet
// (scss/_smart__settings.scss); the other looks stay sf-menu-context's.
//
//   head     the title, or the groups as tabs; the close button of a popup
//   search   the setting search: a header over the rows (C06), «from ten rows»
//   body     the groups as sections in one scroll, or the chosen tab's rows;
//            the only part that scrolls (the scroll-area inset rule)
//   footer   apply="instant": one «Сбросить»; apply="button" (a filter):
//            «Сбросить» and «Применить (N)»
//
// A row is a plate (.sf-settings-row) with the control a person works
// (.sf-settings-row-main, the role) and, in a fields list that pins, the pin
// button beside it. A selected row is the theme's light fill with a check in
// one column at the inline end (C106 (2)); a choice of one is the fill alone
// (C106 (3)); the handle stands at the row's start (C106 (6)). The rows of one
// list are one Tab stop with the arrows inside (DP-4); index.js keeps the
// roving tabindex and the keys.

const icon = (name, className) => html`<span class=${className} aria-hidden="true"><i class="sf-icon">${name}</i></span>`;

// What a row shows after its text: the check of a checked row (a fields list,
// C106 (2)), the switch of a switch, nothing for a choice (the fill alone).
function mark(kind, checked) {
    if (kind === 'switch') {
        return html`<sf-switch class="sf-settings-row-switch" size="1/2" ?checked=${checked} inert aria-hidden="true"></sf-switch>`;
    }
    if (kind === 'field') return icon('check', 'sf-settings-row-check');
    return nothing;
}

// One row. `row` is {key, kind: field|switch|option, role, checked, text,
// caption, disabled, hidden, current, setting, option, handle, pin, pinned}.
function renderRow(row, context) {
    const {words} = context;
    const main = html`<span class="sf-settings-row-main" role=${row.role}
            aria-checked=${row.checked ? 'true' : 'false'}
            aria-disabled=${row.disabled ? 'true' : nothing}
            tabindex=${row.current ? '0' : '-1'}
            data-sf-setting=${row.setting}
            data-sf-option=${row.option ?? nothing}>
            ${row.handle ? icon('drag_indicator', 'sf-settings-row-handle') : nothing}
            <span class="sf-settings-row-text">
                <span class="sf-settings-row-label">${row.text}</span>
                ${row.caption ? html`<span class="sf-settings-row-caption">${row.caption}</span>` : nothing}
            </span>
            ${row.pin ? html`<span class="sf-settings-row-pin-place" aria-hidden="true"></span>` : nothing}
            ${mark(row.kind, row.checked)}
        </span>`;
    const pin = row.pin
        ? html`<button type="button" class="sf-settings-row-pin" tabindex="-1"
                aria-pressed=${row.pinned ? 'true' : 'false'}
                aria-label=${`${row.pinned ? words.unpin : words.pin}: ${row.text}`}
                title=${row.pinned ? words.unpin : words.pin}
                data-sf-setting=${row.setting} data-sf-option=${row.option}>
                <i class="sf-icon" aria-hidden="true">push_pin</i>
            </button>`
        : nothing;
    return html`<div class=${['sf-settings-row', `sf-settings-row--${row.kind}`, row.pin ? 'sf-settings-row--pins' : ''].filter(Boolean).join(' ')}
            ?hidden=${row.hidden}
            ?data-checked=${row.checked}
            ?data-pinned=${row.pinned}
            ?data-disabled=${row.disabled}>${main}${pin}</div>`;
}

// The rows of one list, and whether each is the list's Tab stop: the one the
// person last stood on (index.js remembers it by its key), else the first one
// shown -- for a choice, the chosen one (a radio group's stop is its checked
// radio).
function withCurrent(rows, remembered) {
    const shown = rows.filter((row) => !row.hidden && !row.disabled);
    const current = shown.find((row) => row.key === remembered)
        ?? (rows[0]?.kind === 'option' ? shown.find((row) => row.checked) : null)
        ?? shown[0];
    return rows.map((row) => ({...row, current: row === current}));
}

function listOf(key, role, label, rows, context, {sortable = false} = {}) {
    const marked = withCurrent(rows, context.current.get(key));
    if (!marked.length) return nothing;
    const empty = marked.every((row) => row.hidden);
    return html`<div class="sf-settings-list" role=${role} aria-label=${label || nothing}
            data-sf-list=${key} ?hidden=${empty}
            aria-description=${sortable ? context.words.moveHint : nothing}>
            ${repeat(marked, (row) => row.key, (row) => renderRow(row, context))}
        </div>`;
}

// The rows a group's settings make, in their lists: the switches standing
// together are one list, a choice is a radio group, a fields list is a list
// of its own; a heading heads the rows under it, a separator is a line.
function renderItems(items, context) {
    const parts = [];
    let switches = [];
    const flush = () => {
        if (!switches.length) return;
        const key = `switches:${switches[0].setting}`;
        parts.push(listOf(key, 'group', '', switches, context));
        switches = [];
    };
    for (const item of items) {
        if (item.type === 'heading') {
            flush();
            parts.push(html`<div class="sf-settings-panel-label" role="presentation">${item.text ?? ''}</div>`);
            continue;
        }
        if (item.type === 'separator') {
            flush();
            parts.push(html`<div class="sf-settings-panel-separator" role="separator"></div>`);
            continue;
        }
        if (!holdsValue(item)) continue;
        if (item.type === 'switch') {
            switches.push({key: item.id, kind: 'switch', role: 'switch', setting: item.id, checked: itemValue(item),
                text: item.text ?? '', caption: item.caption, disabled: Boolean(item.disabled),
                hidden: !matches(context.query, item.text, item.caption, item.keywords)});
            continue;
        }
        flush();
        if (item.type === 'choice') {
            const value = itemValue(item);
            const hit = matches(context.query, item.text);
            const rows = (Array.isArray(item.options) ? item.options : []).filter((option) => option && option.id !== undefined && option.id !== null)
                .map((option) => ({key: String(option.id), kind: 'option', role: 'radio', setting: item.id, option: String(option.id),
                    checked: option.id === value, text: option.text ?? '', disabled: Boolean(item.disabled || option.disabled),
                    hidden: !hit && !matches(context.query, option.text)}));
            if (item.text) parts.push(html`<div class="sf-settings-panel-label" role="presentation" ?hidden=${rows.every((row) => row.hidden)}>${item.text}</div>`);
            parts.push(listOf(`choice:${item.id}`, 'radiogroup', item.text, rows, context));
            continue;
        }
        if (item.type === 'fields') {
            const rows = fieldOptions(item).map((option) => ({key: String(option.id), kind: 'field', role: 'checkbox', setting: item.id,
                option: String(option.id), checked: Boolean(option.checked), pinned: Boolean(option.pinned),
                text: option.text ?? '', disabled: Boolean(item.disabled || option.disabled),
                handle: Boolean(item.sortable), pin: Boolean(item.pinnable),
                hidden: !matches(context.query, option.text, option.keywords)}));
            if (item.text && context.layout !== 'tabs') parts.push(html`<div class="sf-settings-panel-label" role="presentation" ?hidden=${rows.every((row) => row.hidden)}>${item.text}</div>`);
            parts.push(listOf(`fields:${item.id}`, 'group', item.text, rows, context, {sortable: Boolean(item.sortable)}));
            continue;
        }
        if (item.type === 'range') {
            parts.push(html`<label class="sf-settings-row sf-settings-row--range" ?hidden=${!matches(context.query, item.text)}>
                <span class="sf-settings-row-text"><span class="sf-settings-row-label">${item.text ?? ''}</span></span>
                <input class="sf-settings-row-range" type="range" data-sf-setting=${item.id}
                    min=${item.min ?? 0} max=${item.max ?? 100} step=${item.step ?? 1} .value=${String(itemValue(item))}
                    ?disabled=${Boolean(item.disabled)} aria-valuetext=${`${itemValue(item)}${item.unit ?? ''}`}>
                <output class="sf-settings-row-value">${itemValue(item)}${item.unit ?? ''}</output>
            </label>`);
        }
    }
    flush();
    return parts;
}

// A section: its heading over its rows. The untitled group of the settings
// between groups has no heading.
function renderSection(group, context) {
    return html`<section class="sf-settings-panel-section" aria-label=${group.text || nothing}>
        ${group.text ? html`<div class="sf-settings-panel-heading">${group.text}</div>` : nothing}
        ${renderItems(group.items, context)}
    </section>`;
}

function renderHead(context) {
    const {groups, layout, tab, size, words} = context;
    const tabs = layout === 'tabs'
        ? html`<sf-tabs class="sf-settings-panel-tabs" type="underline" size=${size === '1' ? '1' : '1/2'}
                items=${groups.map((group) => group.text || words.label).join('|')}
                active-index=${String(tab)}
                @sf-tabs-change=${(event) => {
                    event.stopPropagation();
                    context.component.chooseGroup(Number(event.detail?.current ?? 0));
                }}></sf-tabs>`
        : html`<span class="sf-settings-panel-title">${context.label}</span>`;
    const close = context.popup
        ? html`<sf-button-icon class="sf-settings-panel-close" appearance="ghost" scheme="on-surface" size="1/2" icon="close"
                aria-label=${words.close} title=${words.close} data-sf-close></sf-button-icon>`
        : nothing;
    return html`<div class="sf-settings-panel-head">${tabs}${close}</div>`;
}

function renderSearch(context) {
    if (!context.search) return nothing;
    return html`<label class="sf-settings-panel-search">
        <span class="sf-settings-panel-search-icon" aria-hidden="true"><i class="sf-icon">search</i></span>
        <input type="search" class="sf-settings-panel-search-input" autocomplete="off" spellcheck="false"
            placeholder=${context.words.search} aria-label=${context.words.search} .value=${context.query} data-sf-search>
    </label>`;
}

function renderFooter(context) {
    const {words, apply, count} = context;
    const reset = html`<sf-button size="1/2" appearance="outline" scheme="on-surface" text=${words.reset} data-sf-reset></sf-button>`;
    if (apply !== 'button') return html`<div class="sf-settings-panel-footer">${reset}</div>`;
    const label = count ? `${words.apply} (${count})` : words.apply;
    return html`<div class="sf-settings-panel-footer">${reset}<sf-button size="1/2" text=${label} data-sf-apply></sf-button></div>`;
}

export function renderPanel(context) {
    const {groups, layout, tab, query} = context;
    const shown = layout === 'tabs' ? [groups[tab] ?? groups[0]].filter(Boolean) : groups;
    const body = shown.map((group) => (layout === 'tabs' ? renderItems(group.items, context) : renderSection(group, context)));
    return html`<div class=${['sf-settings-panel', `sf-settings-panel--size-${context.size === '1' ? '1' : '1-2'}`, context.popup ? 'sf-settings-panel--popup' : '', context.rootClass].filter(Boolean).join(' ')}
            role=${context.popup ? 'dialog' : 'group'}
            aria-label=${context.label}
            ?hidden=${context.popup && !context.open}>
        ${renderHead(context)}
        ${renderSearch(context)}
        <div class="sf-settings-panel-body" role=${layout === 'tabs' ? 'tabpanel' : nothing}
            aria-label=${layout === 'tabs' ? (shown[0]?.text || context.label) : nothing}>
            ${body}
            <p class="sf-settings-panel-empty" role="status" ?hidden=${!query || !context.nothingFound}>${context.words.empty}</p>
        </div>
        ${renderFooter(context)}
        <span class="sf-settings-panel-live" aria-live="polite" aria-atomic="true"></span>
    </div>`;
}
