import {html, nothing} from "lit";
import {unsafeHTML} from "lit/directives/unsafe-html.js";
import {optionBadgeProps} from "../helpers/option-badge.js";
import {pageLocale, pageText, pageWord} from "../../core/js/page-language";
import {formatDate} from "../../core/js/format-date.js";
import {PLACES, PROPERTY_TYPES, TEMPLATE_ALIASES, TYPE_ALIASES, modesOf} from "./registry.js";
import {resolveField, templateParam, typeEntry} from "./templates.js";
import {composeDateTime, composeTime, normalizeTime, splitDateTime as readDateTime, splitTime} from "./datetime.js";
import {maskPattern, maskState} from "./mask.js";
import {cleanHtml, htmlText} from "./html.js";
import {noteDeprecated} from "../../core/js/deprecations.js";
import {addDecimal, compareDecimal, currencyCodes, currencyDisplayOf, currencyOf, formatDecimal, formatMoney, formatPercent, fractionDigits, isRtlLocale, moneyParts, moneyTotals, readDecimal, readTypedDecimal, restingDecimal} from "./decimal.js";
import {formatPhone, phoneE164, splitPhone} from "./phone.js";
// The set's words and the property types' names live in its language files
// (localization study LC-5), as a Smart component keeps them.
import LANG_WORDS from './lang/index.mjs';
import {DATE_FUTURE_PERIODS, DATE_PERIODS, LEGACY_DATE_OPERATORS, buildFilterRequest, dateConditionLabel, dateConditionOf,
    dateConditionValue, dateFilterChipText, dateFilterConditions, dateFilterKind, dateGroupLabel, filterRequestContext,
    isEmptyFilterEntry, normalizeFilterEntry, resolveDatePeriod} from './date-filter.js';

// The Framework's field renderers, addressed by a property type and a template
// rather than by a control name.
//
// Larena asked for one set of renderers shared by the record view and the
// table's cells (their request of 2026-10-05, part B6). The Framework already
// had type-aware rendering in exactly one place -- the table's filter controls
// -- and a second map would have drifted from it, so this module is that map
// with the filter controls moved into it unchanged. The table now asks the set
// instead of answering itself.
//
// The renderers take a host rather than `this`: a small interface the caller
// implements, so the same function serves a table's filter window, a record
// view and anything else that renders a field.
//
//   getFilterControlValue(key)            the value a control shows
//   patchTempFilterValue(key, patch)      the value a control writes
//   getFilterOperatorLabel(operator)      the word for an operator
//   getFilterOptionSearch(key)            what is typed in an option search
//   patchTempFilterOptionSearch(key, s)   what that search writes
//   getVisibleFilterOptions(field)        the options to draw
//   renderFilterOption(field, option)     one option row
//   getEndpointFilterPage(field)          the page of options a host returned
//   loadEndpointFilterPage(field, cursor, search)   ask the host for a page
//
// Every prop below names the axis it answers -- appearance, status, kind -- and
// never `type`, which contracts/public-api-axes.json retires. The names were
// read from each component's description rather than from the property's name:
// `size` on sf-file-preview is the file's size as text, not a rung of the
// ladder, and `type` on sf-list-item answers `kind` while on sf-input it
// answers `appearance`.

// The filter controls take the size of the list they filter: the table's
// size, when it has one. They were written at 1, so a table at the dense
// step 1/2 opened filter fields, buttons and tabs a step larger than itself.
function filterSize(host) {
    const size = String(host?.size || '').trim();
    return size || '1';
}

function renderTextFilterControl(field, host) {
    const value = host.getFilterControlValue(field.key);

    return html`
        <sf-input
                size=${filterSize(host)}
                appearance="filled"
                placeholder="${setText(host, 'containsText')}"
                value="${value.value || ''}"
                name="sf_filter_${field.key || 'text'}"
                @change=${(event) => {
                    host.patchTempFilterValue(field.key, {
                        value: event.target?.value || '',
                        operator: value.operator || field.filter?.defaultOperator || 'contains',
                    });
                }}
        ></sf-input>
    `;
}

function renderRangeFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key);
    const operators = field.filter?.operators || ['eq'];
    const selectedOperator = control.operator || field.filter?.defaultOperator || operators[0];
    const isBetween = selectedOperator === 'between';
    const rangeValue = isBetween
        ? control.value
        : Array.isArray(control.value)
            ? control.value[0]
            : control.value;

    return html`
        <div class="flex gap-1/3 flex-col">
            <div class="sf-filter-operator-range flex gap-1/3 items-cross-center">
                <sf-slider-range
                        id="smart-range-slider-single"
                        min="0"
                        label="tooltip"
                        suffix="%"
                        max="100"
                        multiple=${String(isBetween)}
                        .value=${rangeValue}
                        @onSliderEnd=${(e) => {
                            host.patchTempFilterValue(field.key, {
                                value: isBetween
                                    ? e.detail.values || []
                                    : e.detail.value,
                                operator: selectedOperator,
                            });
                        }}
                ></sf-slider-range>
            </div>
            <sf-dropdown
                    size=${filterSize(host)}
                    appearance="bordered"
                    mode="select"
                    placeholder="${setText(host, 'operator')}"
                    root-class="flex-1"
                    search="false"
                    @change=${(event) => {
                        const operator =
                                event.detail?.values?.[0] ||
                                event.detail?.value ||
                                selectedOperator;
                        host.patchTempFilterValue(field.key, {operator});
                    }}
            >
                ${operators.map((operator) => html`
                    <sf-list-item
                            kind="text"
                            size=${filterSize(host)}
                            text="${host.getFilterOperatorLabel(operator)}"
                            value="${operator}"
                            ?selected=${operator === selectedOperator}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
        </div>
    `;
}

// The number filter (owner decision C294, MP-6, MP-7; the same order as the
// date filter): the condition comes first and under it exactly what it needs
// -- one number, two («Между», both ends included) or nothing («Пусто», «Не
// пусто», whose value is true). The nine conditions are the ones AG Grid, MUI
// X and spreadsheets agree on; a field's `filter.operators` may name fewer.
// The value is typed with the decimal keyboard and the sign in the field (a
// fixed currency's sign where the language writes it, «%» after a percent),
// pasted text is read as a person means it («1 234,50 ₽», «$1,234.50») and
// the request carries a decimal string, never the typed text. A money field
// whose currency lives in the value adds a currency choice (q-mp-mix): the
// request carries `currency` and compares amounts within it. A new condition
// of another shape drops the old value.
export const NUMBER_FILTER_OPERATORS = Object.freeze(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty']);
const NUMBER_NO_VALUE_OPERATORS = new Set(['empty', 'not-empty']);
const operatorShape = (operator) => (NUMBER_NO_VALUE_OPERATORS.has(operator) ? 'none' : operator === 'between' ? 'two' : 'one');

function numberOperatorLabel(host, operator) {
    return NUMBER_FILTER_OPERATORS.includes(operator) ? setText(host, `numberOperator_${operator}`) : host.getFilterOperatorLabel(operator);
}

function renderNumberFilterControl(field, host, look = {}) {
    const control = host.getFilterControlValue(field.key) || {};
    const locale = pageLocale(host ?? null);
    const operators = field.filter?.operators || NUMBER_FILTER_OPERATORS;
    const selectedOperator = control.operator || field.filter?.defaultOperator || operators[0];
    const shape = operatorShape(selectedOperator);
    const rawValue = control.value;
    const rangeValue = Array.isArray(rawValue) ? rawValue : [rawValue ?? '', ''];
    const currencies = look.currencies || null;
    const currency = currencies ? (currencies.includes(control.currency) ? control.currency : currencies[0]) : (look.currency || null);
    const sign = look.money && currency ? currencyOf(currency, locale, currencyDisplayOf(field)) : null;
    const textStart = isolatedSign(sign?.before ? sign.sign : '', locale);
    const textEnd = look.percent ? '%' : isolatedSign(sign && !sign.before ? sign.sign : '', locale);
    const minDigits = look.money && currency ? currencyOf(currency, locale).minor : 0;
    const shown = (value) => restingDecimal(value, locale, value === '' || value === null || value === undefined ? 0 : minDigits);
    const withCurrency = (patch) => (currencies ? {...patch, currency} : patch);
    const patch = (next) => host.patchTempFilterValue(field.key, withCurrency({operator: selectedOperator, ...next}));
    const typed = (index, event) => {
        const input = event.currentTarget ?? event.target;
        const text = String(input?.value ?? '');
        const read = readTypedDecimal(text, {locale, currency});
        if (input) {
            input.toggleAttribute('invalid', !read.ok);
            if (read.ok) input.removeAttribute('error-message');
            else input.setAttribute('error-message', setText(host, 'notNumber'));
        }
        if (!read.ok) return;
        const value = read.value ?? '';
        if (shape !== 'two') {
            patch({value});
            return;
        }
        const next = [...rangeValue];
        next[index] = value;
        patch({value: next});
    };
    const input = (index, label, value) => html`
        <sf-input
                size=${filterSize(host)}
                appearance="bordered"
                root-class="flex-1 min-w-0"
                label=${label}
                value=${shown(value)}
                inputmode=${look.integer || resolveField(field).decimals === 0 ? 'numeric' : 'decimal'}
                text-start=${textStart || nothing}
                text-end=${textEnd || nothing}
                name="sf_filter_${field.key || 'number'}${index ? '_second' : ''}"
                @change=${(event) => typed(index, event)}
        ></sf-input>`;
    const valueWord = setText(host, look.money ? 'filterAmount' : look.percent ? 'filterPercent' : 'filterNumber');

    return html`
        <div class="flex gap-1/3 flex-col">
            <sf-dropdown
                    size=${filterSize(host)}
                    appearance="bordered"
                    mode="select"
                    label=${setText(host, 'condition')}
                    placeholder=${setText(host, 'condition')}
                    root-class="flex-1"
                    search="false"
                    data-sf-filter-part="operator"
                    @change=${(event) => {
                        if (event.target !== event.currentTarget) return;
                        const operator = event.detail?.values?.[0] || event.detail?.value || selectedOperator;
                        if (operator === selectedOperator) return;
                        const next = operatorShape(operator);
                        // A new condition of another shape drops the old value:
                        // one amount and two amounts are not the same question.
                        const value = next === 'none' ? true
                            : next === shape ? rawValue
                                : next === 'two' ? ['', ''] : '';
                        host.patchTempFilterValue(field.key, withCurrency({operator, value}));
                    }}
            >
                ${operators.map((operator) => html`
                    <sf-list-item
                            kind="text"
                            size=${filterSize(host)}
                            text="${numberOperatorLabel(host, operator)}"
                            value="${operator}"
                            ?selected=${operator === selectedOperator}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
            ${shape === 'none' ? nothing : shape === 'two' ? html`
                <div class="sf-filter-operator-inputs flex gap-1/3 items-cross-start">
                    ${input(0, setText(host, 'rangeFrom'), rangeValue[0])}
                    ${input(1, setText(host, 'rangeTo'), rangeValue[1])}
                </div>` : html`
                <div class="sf-filter-operator-inputs flex gap-1/3 items-cross-start">
                    ${input(0, valueWord, Array.isArray(rawValue) ? rawValue[0] : rawValue)}
                </div>`}
            ${currencies && shape !== 'none' ? html`
                <sf-dropdown
                        size=${filterSize(host)}
                        appearance="bordered"
                        mode="select"
                        label=${setText(host, 'currency')}
                        root-class="flex-1"
                        search=${currencies.length > 12 ? 'true' : 'false'}
                        data-sf-filter-part="currency"
                        .options=${currencies.map((code) => ({type: 'text', size: filterSize(host), value: code, text: code, selected: code === currency}))}
                        @change=${(event) => {
                            if (event.target !== event.currentTarget) return;
                            const code = event.detail?.values?.[0] || event.detail?.value;
                            if (!code || code === currency) return;
                            host.patchTempFilterValue(field.key, {operator: selectedOperator, value: rawValue, currency: code});
                        }}
                ></sf-dropdown>` : nothing}
        </div>
    `;
}

function renderIntegerFilterControl(field, host) {
    return renderNumberFilterControl(field, host, {integer: true});
}

// Money and percent are filtered as numbers with their own sign in the field
// (owner decisions C291 (2), C294): «%» after a percent, a fixed currency's
// sign where the locale writes it. A money field whose currency lives in the
// value chooses the currency in the filter, from the field's `currencies`.
function renderMoneyFilterControl(field, host) {
    const fixed = fixedCurrency(field);
    return renderNumberFilterControl(field, host, {money: true, currency: fixed, currencies: fixed ? null : fieldCurrencies(field)});
}

function renderPercentFilterControl(field, host) {
    return renderNumberFilterControl(field, host, {percent: true});
}

// The date filter (owner decision C293, 2026-11-17; it replaces the operator
// words and quick ranges of PD-6/PD-7). A condition first, then exactly what it
// needs: nothing (a period by name, «Пусто», «Не пусто»), one day, two days (a
// range calendar whose quick ranges are the whole periods; pressing one makes
// the condition that period by name), a number of days, or -- for a period
// field -- «when»: a period by name or two days of one's own. The list is
// grouped: Дата, Период, Заполнено (a period field: Период записи,
// Заполнено). Choosing a condition writes its own starting value, so a stale
// day never travels with a period (DF-2); a period, «Пусто» and «Не пусто»
// carry a value of their own, so the table keeps them (DF-1). The rules and
// the words are date-filter.js; this draws them. The day controls keep PD-4,
// PD-5 and PD-8: the table's size, the page's language, the condition above.
function dateFilterPresets(field) {
    const presets = field.filter?.presets;
    if (presets === undefined || presets === null) {
        return [...DATE_PERIODS, ...(field.filter?.future === true ? DATE_FUTURE_PERIODS : [])].join(',');
    }
    return Array.isArray(presets) ? presets : String(presets);
}

function defaultDateCondition(field, list) {
    const asked = field.filter?.defaultOperator;
    if (asked) {
        const one = dateConditionOf(field, {operator: asked, value: LEGACY_DATE_OPERATORS[asked] || asked});
        const named = list.find((item) => item.key === asked);
        if (named || one) return named || one;
    }
    // One date: «Между» (the list's second, after the exact day); a period
    // field: «Идёт в».
    return list.find((item) => item.operator === (dateFilterKind(field) === 'period' ? 'overlaps' : 'between')) ?? list[0];
}

function dateFilterContext(host) {
    return filterRequestContext(host ?? null, host?.getFilterContext?.() || {});
}

function renderDateFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key) || {};
    const list = dateFilterConditions(field);
    const asked = control.operator ? dateConditionOf(field, control) : null;
    const current = asked ?? defaultDateCondition(field, list);
    const value = asked ? normalizeFilterEntry(control).value : control.value;
    const size = filterSize(host);
    const patch = (next) => host.patchTempFilterValue(field.key, next);
    const isDateTime = (field.propertyType || field.type) === 'datetime';

    return html`
        <div class="flex flex-col gap-1/3">
            <sf-dropdown
                    size=${size}
                    appearance="bordered"
                    mode="select"
                    label="${setText(host, 'dateCondition')}"
                    .value=${current.key}
                    hint=${isDateTime ? setWord(host, 'dateByDayIn', {zone: dateFilterContext(host).timeZone}) : nothing}
                    root-class="flex-1"
                    search="false"
                    @change=${(event) => {
                        const key = event.detail?.values?.[0] || event.detail?.value || current.key;
                        const next = list.find((item) => item.key === key);
                        // The condition shown before any is chosen is the default;
                        // choosing it writes it, with its own starting value.
                        if (!next || (asked && next.key === current.key)) return;
                        patch({operator: next.operator, value: dateConditionValue(next, {value})});
                    }}
            >
                ${list.map((item) => html`
                    <sf-list-item
                            kind="text"
                            size=${size}
                            group=${dateGroupLabel(host, item.group)}
                            text="${dateConditionLabel(host, item)}"
                            value="${item.key}"
                            ?selected=${item.key === current.key}
                    ></sf-list-item>
                `)}
            </sf-dropdown>
            ${renderDateConditionValue(field, host, current, value, patch)}
        </div>
    `;
}

function renderDateConditionValue(field, host, current, value, patch) {
    const size = filterSize(host);
    const name = `sf_filter_${field.key || 'date'}`;
    if (current.need === 'none') return nothing;
    if (current.need === 'count') {
        return html`
            <sf-input-quantity
                    size=${size}
                    label="${setText(host, current.operator === 'next-days' ? 'dateCountNext' : 'dateCountLast')}"
                    min="1"
                    max="366"
                    unit="${setText(host, 'dateCountUnit')}"
                    name="${name}_count"
                    .value=${Number(value) > 0 ? Number(value) : 30}
                    @change=${(event) => {
                        if (event.target !== event.currentTarget) return;
                        const count = Math.round(Number(event.detail?.value));
                        patch({operator: current.operator, value: count > 0 ? count : null});
                    }}
            ></sf-input-quantity>`;
    }
    if (current.need === 'day') {
        return html`
            <sf-input-date
                    size=${size}
                    label="${setText(host, current.operator === 'contains' ? 'dateValueDay' : 'dateValueDate')}"
                    .value=${typeof value === 'string' ? value.slice(0, 10) : ''}
                    name="${name}"
                    @change=${(event) => {
                        if (event.target !== event.currentTarget) return;
                        patch({operator: current.operator, value: event.detail?.value || null});
                    }}
            ></sf-input-date>`;
    }
    if (current.need === 'days') return renderDateRangeValue(field, host, current, value, patch);
    // «when» (a period field): a period by name, or two days of one's own.
    const own = Array.isArray(value);
    const periods = [...DATE_PERIODS, ...(field.filter?.future === true ? DATE_FUTURE_PERIODS : [])];
    return html`
        <sf-dropdown
                size=${size}
                appearance="bordered"
                mode="select"
                label="${setText(host, 'dateWhen')}"
                .value=${own ? 'own' : (typeof value === 'string' ? value : '')}
                root-class="flex-1"
                search="false"
                @change=${(event) => {
                    const key = event.detail?.values?.[0] || event.detail?.value;
                    if (!key) return;
                    if (key === 'own') {
                        if (!own) patch({operator: current.operator, value: ['', '']});
                        return;
                    }
                    if (key !== value) patch({operator: current.operator, value: key});
                }}
        >
            ${periods.map((period) => html`
                <sf-list-item kind="text" size=${size} text="${dateConditionLabel(host, {period})}" value="${period}"
                        ?selected=${!own && value === period}></sf-list-item>
            `)}
            <sf-list-item kind="text" size=${size} text="${setText(host, 'dateOwnDays')}" value="own" ?selected=${own}></sf-list-item>
        </sf-dropdown>
        ${own ? renderDateRangeValue(field, host, current, value, patch) : nothing}`;
}

// Two days on a range calendar. Its quick ranges are the whole periods: one
// pressed is the period by name -- in «Между» the condition becomes that
// period (C293 (4)), in a period field's «when» the value is its name.
function renderDateRangeValue(field, host, current, value, patch) {
    const days = Array.isArray(value) ? value.map((day) => (typeof day === 'string' ? day.slice(0, 10) : '')) : ['', ''];
    return html`
        <sf-input-date
                size=${filterSize(host)}
                range
                label="${setText(host, 'dateValuePeriod')}"
                .value=${days}
                .presets=${dateFilterPresets(field)}
                name="sf_filter_${field.key || 'date'}"
                @change=${(event) => {
                    if (event.target !== event.currentTarget) return;
                    const preset = event.detail?.preset?.id;
                    if (preset && (DATE_PERIODS.includes(preset) || DATE_FUTURE_PERIODS.includes(preset))) {
                        patch(current.operator === 'between' ? {operator: 'period', value: preset} : {operator: current.operator, value: preset});
                        return;
                    }
                    const next = Array.isArray(event.detail?.value) ? event.detail.value : [event.detail?.startValue || '', event.detail?.endValue || ''];
                    patch({operator: current.operator, value: next});
                }}
        ></sf-input-date>`;
}

function renderMultiSelectFilterControl(field, host) {
    const endpointPage = host.getEndpointFilterPage(field);
    const options = host.getVisibleFilterOptions(field);
    const value = host.getFilterControlValue(field.key);
    const search = host.getFilterOptionSearch(field.key);
    const selected = new Set(value.values || []);

    // A list of options scrolls down, never sideways: a checkbox's ring a pixel
    // or two past the edge drew a horizontal bar under the list (owner,
    // 2026-10-15).
    return html`
        <div class="flex flex-col gap-1/2 overflow-x-hidden">
            ${field.filter?.searchable && (!endpointPage || endpointPage.searchable) ? html`
                <sf-input
                        size=${filterSize(host)}
                        appearance="filled"
                        placeholder="${setText(host, 'searchInList')}"
                        value="${search}"
                        name="sf_filter_${field.key || 'list'}_search"
                        @input=${(event) => {
                            host.patchTempFilterOptionSearch(
                                    field.key,
                                    event.target?.value || '',
                            );
                        }}
                        @change=${(event) => {
                            host.patchTempFilterOptionSearch(
                                    field.key,
                                    event.target?.value || '',
                            );
                        }}
                ></sf-input>
            ` : ''}
            <div class="flex flex-col gap-1/2 overflow-x-hidden" data-size="4.5">
                ${options.map((option) => host.renderFilterOption(field, option, selected))}
            </div>
            ${!options.length && endpointPage?.status !== 'loading' && endpointPage?.status !== 'error' ? html`
                <!-- A list with nothing in it says why, in one line, as every
                     list does (simai.interaction-rules, five states). -->
                <sf-empty-state layout="inline" size="1/2" kind=${search ? 'nothing-found' : 'no-data'}></sf-empty-state>` : ''}
            ${endpointPage ? html`
                <div role="status" aria-live="polite" class="sf-text-1">
                    ${endpointPage.status === 'loading' ? setText(host, 'loadingOptions') : ''}
                </div>
                ${endpointPage.status === 'error' ? html`<sf-empty-state layout="inline" size="1/2" kind="error" text=${setText(host, 'optionsError')}
                    @sf-empty-state-action=${(event) => { if (event.detail?.id === 'retry') host.loadEndpointFilterPage(field, null, search); }}></sf-empty-state>` : ''}
                ${endpointPage.nextCursor && endpointPage.status !== 'error' ? html`<sf-button appearance="outline" size=${filterSize(host)} text="${setText(host, 'loadMore')}"
                    ?disabled=${endpointPage.status === 'loading'}
                    @click=${() => host.loadEndpointFilterPage(field, endpointPage.nextCursor, search)}></sf-button>` : ''}
            ` : ''}
        </div>
    `;
}

function renderEntityMultiSelectFilterControl(field, host) {
    // The host travels with the call. It was lost here when these functions were
    // moved out of the table: as a method, `this.renderMultiSelectFilterControl(field)`
    // carried the receiver by itself, and as a function it has to be handed on.
    // The source suite renders no entity control, so nothing in it noticed; the
    // filter-endpoint probe did, with "Cannot read properties of undefined".
    return renderMultiSelectFilterControl(field, host);
}

// The filter template, addressed by the property type. The nine control names
// the table used are kept as aliases of the types they serve, so a host that
// declares a control by name keeps working while a host that declares a
// property type gets the same renderer.
// A file is filtered by its kind, a colour by the field's palette (owner,
// 2026-10-15): both fell back to a text search. The filter's values are the
// kinds -- image, document, archive, other -- or the colours, with the
// operator «in»; what a kind holds is the host's to say.
function renderFileFilterControl(field, host) {
    const options = field.filter?.options ?? ['image', 'document', 'archive', 'other']
        .map((kind) => ({value: kind, label: setText(host, `fileKind_${kind}`)}));
    return renderMultiSelectFilterControl({...field, filter: {...(field.filter || {}), options, defaultOperator: field.filter?.defaultOperator ?? 'in'}}, host);
}

function renderColorFilterControl(field, host) {
    const palette = field.filter?.options ?? (Array.isArray(field.swatches) ? field.swatches : [])
        .map((swatch) => (typeof swatch === 'string' ? {value: swatch, label: swatch} : swatch))
        .filter((swatch) => swatch?.value)
        .map((swatch) => ({value: swatch.value, label: swatch.label ?? swatch.value, color: swatch.value}));
    // No palette, nothing to choose from: the value is searched as text.
    if (!palette.length) return renderTextFilterControl(field, host);
    return renderMultiSelectFilterControl({...field, filter: {...(field.filter || {}), options: palette, optionRenderer: field.filter?.optionRenderer ?? 'swatch',
        defaultOperator: field.filter?.defaultOperator ?? 'in'}}, host);
}

export const FILTER_RENDERERS = {
    text: renderTextFilterControl,
    string: renderTextFilterControl,
    number: renderNumberFilterControl,
    integer: renderIntegerFilterControl,
    date: renderDateFilterControl,
    datetime: renderDateFilterControl,
    range: renderRangeFilterControl,
    'date-range': renderDateFilterControl,
    // A period field (a start and an end, C293): its own conditions -- overlaps,
    // within, starts, ends, contains a day.
    period: renderDateFilterControl,
    'multi-select': renderMultiSelectFilterControl,
    'single-select': renderMultiSelectFilterControl,
    choice: renderMultiSelectFilterControl,
    choices: renderMultiSelectFilterControl,
    boolean: renderMultiSelectFilterControl,
    // phone: its digits, as a text (C302); password: set or not set.
    phone: renderTextFilterControl,
    password: renderPasswordFilterControl,
    user: renderMultiSelectFilterControl,
    'entity-multi-select': renderEntityMultiSelectFilterControl,
    'entity-single-select': renderEntityMultiSelectFilterControl,
    record: renderEntityMultiSelectFilterControl,
    relation: renderEntityMultiSelectFilterControl,
    lookup: renderEntityMultiSelectFilterControl,
    file: renderFileFilterControl,
    color: renderColorFilterControl,
    // A money amount and a percent are filtered as decimals with their sign
    // (C291 (2)); an items field, which the View set draws, by its number of
    // rows (property-view port 1.18.0).
    money: renderMoneyFilterControl,
    percent: renderPercentFilterControl,
    items: renderIntegerFilterControl,
};

// What a field asks to be filtered by: its own declared control if it has one,
// otherwise its property type, otherwise text.
// The date filter's rules for a host that builds the request or draws the
// chips itself (sf-view-table): the same functions as SF.fieldRenderers.dateFilter.
export {buildFilterRequest, dateFilterChipText, dateFilterConditions, filterRequestContext, isEmptyFilterEntry,
    normalizeFilterEntry, resolveDatePeriod, DATE_PERIODS, DATE_FUTURE_PERIODS};

export function renderFilterField(field = {}, host) {
    const asked = field.filter?.control || resolveField(field).type || 'text';
    const renderer = FILTER_RENDERERS[asked] || FILTER_RENDERERS.text;

    return renderer(field, host);
}


// The cell template. A cell is text unless the Framework has a component that
// says more than the text would, and the set renders one only when it can state
// the shape the value must have. Anything else falls back to the value itself,
// so a host that stores a plain string keeps seeing a plain string.
//
// The value shapes are the consumer's, agreed with Larena on 2026-10-06: a
// renderer cannot turn an opaque reference into a name, and resolving one needs
// an access check, so the host sends what it has resolved.
//
//   choice              a value matching one of the column's options
//   integer / number    a number, and with the `scale` variant a number 0..100
//   boolean             true or false
//   user                {value, label, avatarText}
//   record / relation   {value, label, href?} -- href only when it may be opened
//   lookup              {value, label}, or a list of them when multiple; the
//                       labels on one line
//   file                {value, label, mime?, href?} -- an icon from the mime
//                       type and the label, a link when it may be opened
//   choices             a list of option values; one tag per value on the line
//   html                an HTML string of sf-input-rich's subset; its text, on one line
//
// Every element here takes `line`, not `size`: a line element is the row's text
// line, where a control height would make the row grow. That was measured --
// with size-1/2 components a default row went from 57 to 61 on desktop and 45 to
// 51 on mobile.
const CELL_LINE = '1/2';

// A choice badge in a cell is tonal (sf-badge's default since 1.6.0, C140; it
// was main, so the cells shipped filled and the consumer's owner asked for the
// calmer one) -- and a table row is the place for it: a column of
// filled badges reads as a column of buttons. A field may still ask for another
// of the three, which is the same arrangement as the boolean's words: the set
// carries a sensible default, not a decision nobody can change.
//
// It composes with colour rather than replacing it. A scheme name reaches the
// scheme's tonal badge; a hue or a hex colour writes the public
// --sf-badge-background-color as the nearest palette hue's fill step (BG-7,
// C140 (2)) and its own text colour, so the tint survives the appearance
// untouched. Both are measured on the built bytes.
const CELL_BADGE_APPEARANCE = 'tonal';

// The template parameter badge (C302; badgeAppearance before it): tonal or
// outline. main is the attention count's alone (C140 (4)): sf-badge draws it
// tonal on any colour but error, so a value badge reads main as tonal here
// and never asks the badge for it (FW-1).
const VALUE_BADGE_APPEARANCES = new Set(['tonal', 'outline']);

function badgeAppearanceOf(field) {
    const asked = String(templateParam(field, 'badge') ?? '');
    return VALUE_BADGE_APPEARANCES.has(asked) ? asked : CELL_BADGE_APPEARANCE;
}

// A file cell is a reference link with an icon chosen from the mime type: the
// consumer asked for an icon and the label and nothing else -- no size as text
// and no download button, which the record view will carry -- and the component
// that owns that shape already exists. sf-file-preview detects only image/*, so
// this small map lives here until a second caller needs it, which is the session
// that owns that component's own judgement.
const FILE_ICONS = [
    [/^image\//u, 'image'],
    [/^video\//u, 'movie'],
    [/^audio\//u, 'audiotrack'],
    [/^text\/(csv|tab-separated-values)$/u, 'table'],
    [/^text\//u, 'description'],
    [/pdf$/u, 'picture_as_pdf'],
    [/(zip|compressed|tar|rar|7z)/u, 'folder_zip'],
    [/(sheet|excel|spreadsheet)/u, 'table'],
    [/(word|document)$/u, 'description'],
    [/(presentation|powerpoint)/u, 'slideshow'],
];

function fileIcon(mime) {
    const value = String(mime || '').toLowerCase();
    const match = FILE_ICONS.find(([pattern]) => pattern.test(value));

    return match ? match[1] : 'attach_file';
}

// A colour has the same four faces as every other property. It was absent while a
// running Larena site declares fourteen colours, so a theme colour had nowhere to
// be shown and nowhere to be changed.
//
// `inheritedValue` matters here as much as the value: the site's own colours are
// inherited from the theme until somebody chooses one, and a cell that drew the
// inherited colour as the value would say a record had decided something it had
// not.
function renderColorCell(field, value) {
    const hex = scalarValue(value);
    if (!hex) return nothing;
    // The component, not a span with classes of its own: the renderer set has no
    // stylesheet, so markup invented here would reach no rules at all -- and a
    // colour should look the same in a cell as it does in a card, which is what a
    // general part is for.
    return html`
        <sf-input-color size="1/2" appearance="plain" value=${String(hex)}
                  aria-label=${field.label || field.key || ''} readonly></sf-input-color>
    `;
}

// Reads what port 1.8.0 declares: `inherited` says a value comes from somewhere
// else, `inheritedValue` says what it is. A view that drew the inherited colour as
// the value would make «not set» and «set to the same colour» look identical, and
// only the first follows the theme when the theme moves. The view and the cell
// draw the field read-only (sf-input-color 1.17.0): the value in the text's ink;
// disabled drew it in the disabled ink, as a field nobody may use.
function renderColorView(field, value) {
    const hex = scalarValue(value);
    const inherited = field.inheritedValue ?? '';
    if (!hex && !inherited) return nothing;
    return html`
        <sf-input-color
                size="1"
                appearance="plain"
                value=${hex ? String(hex) : nothing}
                inherited-value=${inherited ? String(inherited) : nothing}
                aria-label=${field.label || field.key || ''}
                readonly
        ></sf-input-color>
    `;
}

function renderColorEdit(field, value, host) {
    const hex = scalarValue(value);
    const inherited = field.inheritedValue ?? '';
    return html`
        <sf-input-color
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${hex ? String(hex) : nothing}
                inherited-value=${inherited ? String(inherited) : nothing}
                swatches=${templateParam(field, 'swatches') ? String(templateParam(field, 'swatches')) : nothing}
                ?clearable=${Boolean(inherited) || field.required !== true}
                ?readonly=${field.readonly === true}
                aria-label=${field.label || field.key || ''}
                @change=${(event) => host.setFieldValue(field, event.detail?.value ?? '')}
        ></sf-input-color>
    `;
}

function renderFileCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;
    // A column the host says holds images shows each as a thumbnail; any other
    // file as a tile with its extension. Which files are images is the host's
    // to say through the variant, never guessed from a name.
    if (isImageField(field)) return renderFilePreviewCell(value);

    return {
        component: {
            type: 'reference-link',
            props: {
                line: CELL_LINE,
                label: String(value.label),
                icon: fileIcon(value.mime),
                ...(value.href ? {href: String(value.href)} : {}),
            },
        },
    };
}

// A file as a thumbnail on the row's line: the image when the host gave its
// address and its type is an image, the extension in a tile otherwise. It is
// sf-file-preview told to show nothing but its leading visual, so a file looks
// the same in a row as in the record that holds it.
function renderFilePreviewCell(value) {
    const mime = String(value.mime ?? value.mimeType ?? '');
    const image = Boolean(value.href) && /^image\//u.test(mime);
    return {
        component: {
            type: 'file-preview',
            props: {
                compact: true,
                fileName: String(value.label),
                mimeType: mime,
                icon: fileIcon(mime),
                ...(value.href ? {href: String(value.href)} : {}),
                ...(image ? {imageUrl: String(value.href), kind: 'image'} : {kind: 'icon'}),
                actions: false,
                downloadAction: false,
                removeAction: false,
            },
        },
    };
}

// Several values in one cell: one tag per value, each on the row's text line.
// The tag's `line` resolves its own size and inline mode, so neither is passed
// -- the session that owns it fixed the template to read the resolved values
// rather than the attributes, which is what makes that true.
function renderChoicesCell(field, value) {
    if (!Array.isArray(value) || !value.length) return null;
    if (templateOf(field) === 'badges') return renderChoicesBadgesCell(field, value);
    const options = field.options || field.filter?.options || field.constraints?.options;
    const label = (item) => {
        const option = Array.isArray(options)
            ? options.find((candidate) => String(candidate?.value) === String(item))
            : null;

        return String(option?.label ?? option?.text ?? item);
    };

    return value.map((item) => ({
        component: {type: 'tag', props: {line: CELL_LINE, kind: 'default', text: label(item)}},
    }));
}

// Several values as tonal badges, each coloured by its option's scheme -- a
// page's publication in each language. A value may be {value, text}: the host
// says more in that one cell than the option's label («ru · 14.10 09:00»), which
// is the host's to format, so the set does not.
function renderChoicesBadgesCell(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    return value.map((item) => {
        const key = item && typeof item === 'object' ? item.value : item;
        const option = Array.isArray(options)
            ? options.find((candidate) => String(candidate?.value) === String(key))
            : null;
        const badge = option ? optionBadgeProps(option) : null;
        const text = item && typeof item === 'object' && item.text !== undefined
            ? String(item.text)
            : String(option?.label ?? option?.text ?? key);
        return {
            component: {
                type: 'badge',
                props: {
                    line: CELL_LINE,
                    text,
                    appearance: badgeAppearanceOf(field),
                    ...(badge?.scheme ? {scheme: badge.scheme} : {}),
                    ...(badge?.rootStyle ? {rootStyle: badge.rootStyle} : {}),
                },
            },
        };
    });
}

const CELL_RENDERERS = {
    // A string is its own text in a row -- except a password, which is never
    // shown anywhere: a row says whether one is set.
    string: renderStringCell,
    phone: renderPhoneCell,
    password: renderPasswordCell,
    // A date in a row used to be whatever the host had stored, printed --
    // «2026-09-25T07:12:00+03:00» beside the same value reading «25 сентября
    // 2026» in the record panel, with no way for a consumer to change the
    // first. These two ask the host and fall through to the stored value when
    // it has nothing to say.
    date: renderDateCell,
    datetime: renderDateCell,
    time: renderHostFormattedCell,
    boolean: renderBooleanCell,
    choices: renderChoicesCell,
    file: renderFileCell,
    color: renderColorCell,
    include: renderIncludeCell,
    choice: renderChoiceCell,
    number: renderNumericCell,
    user: renderUserCell,
    record: renderReferenceCell,
    relation: renderReferenceCell,
    lookup: renderLookupCell,
    html: renderHtmlCell,
    money: renderMoneyCell,
    percent: renderPercentCell,
    items: renderItemsCell,
};

// A consumer found this on their stand: the words were written into the set, so
// an English admin saw «Да». The set must not decide what a value is called in
// anyone's language. They come from the field, which is where the rest of the
// Framework keeps its text -- sf-view-table declares fourteen such inputs -- and the
// Russian stays only as the fallback, so nothing already published changes.
// The field's own words win, as they must: what «true» is called belongs to
// whoever owns the interface. The fallback used to be Russian whatever the page
// was -- an English admin saw «Да» -- so it follows the page's language now.
function booleanWords(field, host) {
    return {
        yes: templateParam(field, 'trueText') ?? field.labels?.true ?? setText(host, 'yes'),
        no: templateParam(field, 'falseText') ?? field.labels?.false ?? setText(host, 'no'),
    };
}

function renderBooleanCell(field, value, host) {
    if (typeof value !== 'boolean') return null;

    const words = booleanWords(field, host);

    return value ? words.yes : words.no;
}

function renderChoiceCell(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    if (!Array.isArray(options)) return null;
    const option = options.find((item) => String(item?.value) === String(value));
    if (!option) return null;

    const badge = optionBadgeProps(option);

    return {
        component: {
            type: 'badge',
            props: {
                line: CELL_LINE,
                text: option.label ?? option.text ?? String(value),
                appearance: badgeAppearanceOf(field),
                ...(badge?.scheme ? {scheme: badge.scheme} : {}),
                ...(badge?.rootStyle ? {rootStyle: badge.rootStyle} : {}),
            },
        },
    };
}

// The scale is the `scale` variant of a number, and sf-progress-scale takes a
// value between 0 and 100 with no bounds of its own -- which is why the request
// asks for the variant on a field declaring exactly min 0 and max 100. A value
// outside that range is left as text rather than clamped: a clamped number is a
// wrong number drawn confidently.
// A cell the host has formatted. Null when it has not, so the value falls
// through to the plain one the table already prints: the set does not invent a
// format, and «798700» is a better answer than a thousands separator somebody
// did not ask for. What it does not do is leave a consumer no way to say
// «798 700 ₽» -- which was the state of a list until the host reached the cells.
function renderHostFormattedCell(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    return typeof formatted === 'string' && formatted !== '' ? formatted : null;
}

// The types a component set draws (property-view port 1.18.0) have their
// cells here, so a table shows them wherever the set's editors live. A host's
// formatFieldValue wins, as for a date; otherwise the page's language:
//
//   money     {amount, currency} or a bare amount under a fixed `currency`;
//             «1 500,50 ₽», every digit the amount has and at least the
//             currency's minor units, formatted from the digits, never a float
//   percent   a decimal string of the percent, «12,5 %»
//   items     a list of rows; how many, «3 строки»
//
// A value that is not one of these shapes falls through to the plain value.
function renderMoneyCell(field, value, host) {
    const formatted = renderHostFormattedCell(field, value, host);
    if (formatted !== null) return formatted;
    const text = formatMoney(scalarValue(value), field, pageLocale(host ?? null));
    return text || null;
}

function renderPercentCell(field, value, host) {
    const formatted = renderHostFormattedCell(field, value, host);
    if (formatted !== null) return formatted;
    const text = formatPercent(scalarValue(value), pageLocale(host ?? null));
    return text || null;
}

function renderItemsCell(field, value, host) {
    const formatted = renderHostFormattedCell(field, value, host);
    if (formatted !== null) return formatted;
    if (!Array.isArray(value)) return null;
    return value.length ? pageWord(SET_TEXT, 'rowCount', host ?? null, {component: SET_NAME, count: value.length}) : '';
}

// A date in a row reads as it does in the record panel: the host's text, else
// the page's reading of the day (simai/ui-source#34); null for a value that is
// not a date, which the table prints as it came.
function renderDateCell(field, value, host) {
    const formatted = renderHostFormattedCell(field, value, host);
    if (formatted !== null) return formatted;
    return defaultDateText(field, value, host);
}

// A share of a limit (owner decision C203 (5), IM-8): the `meter` variant of a
// number 0..100 is the inline sf-progress-bar meter -- a 64 track, the number
// «72 %» before it -- named by the field's label. The scale stays for levels
// («4 из 5», C185 (5)). Out of range it is left as text, as the scale is.
function meterProps(field, number) {
    const name = typeof field.label === 'string' ? field.label : (field.key || '');
    return {inline: true, meter: true, value: String(number), ...(name ? {label: name} : {})};
}

function renderNumericCell(field, value, host) {
    const variant = templateOf(field);
    const number = Number(scalarValue(value));
    if ((variant !== 'scale' && variant !== 'meter') || !Number.isFinite(number)) {
        // The host's text first; else the number in the page's language, as
        // the view prints it («12,5»), where the table printed «12.5».
        const formatted = renderHostFormattedCell(field, value, host);
        if (formatted !== null) return formatted;
        if (carriesText(value)) return value.text || null;
        return formatDecimal(scalarValue(value), pageLocale(host ?? null)) || null;
    }
    if (number < 0 || number > 100) return null;
    if (variant === 'meter') return {component: {type: 'progress-bar', props: meterProps(field, number)}};

    return {
        component: {
            type: 'progress-scale',
            props: {line: CELL_LINE, value: String(number)},
        },
    };
}

// A reference in a cell is a link and nothing else: the arrow a reference card
// carries said «goes somewhere» a second time beside a label that is already a
// link, and on a dense row it was the widest thing in the cell. Without an href
// the label is plain text -- a link that leads nowhere is not drawn as one.
function referenceLink(value) {
    return {
        component: {
            type: 'reference-link',
            props: {
                line: CELL_LINE,
                appearance: 'plain',
                icon: '',
                label: String(value.label),
                ...(value.href ? {href: String(value.href)} : {}),
            },
        },
    };
}

// A person: the avatar and the name, the name a link to the profile when the
// host gives its href.
function renderUserCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;

    return [
        // The person's name is the avatar's heading: its accessible name and
        // the source of its initials (sf-avatar 1.6.0; avatar study AV-2).
        {component: {type: 'avatar', props: {line: CELL_LINE, text: value.avatarText || '', heading: String(value.label)}}},
        value.href ? referenceLink(value) : String(value.label),
    ];
}

function renderReferenceCell(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return null;

    return referenceLink(value);
}

// A value from a reference list is its label, and several are their labels in
// a row: nothing opens from a country or a status, so there is no link to draw.
function renderLookupCell(field, value) {
    const items = lookupItems(field, value);
    return items.length ? items.map((item) => item.label).join(', ') : null;
}

// Formatted text in a row is its text, as a text cell is: the markup is for a
// record, and a row of headings and lists would not be a row. A string, so the
// table draws and cuts it exactly as it does any text value.
function renderHtmlCell(field, value) {
    return htmlText(value) || null;
}

// What a cell should hold for a field, in the same shape a host would pass: a
// string, an object with a component, or a list of those. Null means the value
// is better off as itself. Returning the host's own shape is deliberate -- the
// table renders it through the path it already had, so the set adds no second
// way to draw a cell.
export function renderCellField(field = {}, value, host) {
    const asked = resolveField(field).type;
    const renderer = CELL_RENDERERS[asked];
    if (!renderer) return null;

    // `host` is for one thing, as in the view: formatFieldValue, where a
    // consumer's own formatting of a number or a date belongs. A cell had no way
    // to reach it, so a list could not be formatted at all while the record
    // panel beside it could.
    const rendered = renderer(field, value, host);

    return rendered === null || typeof rendered === 'undefined' ? null : rendered;
}


// The edit template. A field being edited is a control of the form scale, not of
// a row: these take `size`, where the cell template takes `line`.
//
// The host supplies the value and takes the change, through two methods, because
// a renderer must not decide where a value lives:
//
//   getFieldValue(field)          what the control shows
//   setFieldValue(field, value)   what the control writes
//
// Every event bound here is `change`, and that is a rule now rather than a
// coincidence: contracts/public-api-axes.json `change_event` says every form
// value control reports a committed change as `change` on its host, once per
// change the user makes, with each older name kept as an alias the manifest
// marks `alias_of`. So the set binds the canonical name for all of them --
// sf-input, sf-textarea, sf-switch, sf-checkbox, sf-dropdown, sf-segmented and
// sf-datepicker -- where it bound three different alias names before. The one
// event this file still binds under its own name is sf-file-upload:select,
// which is not a value change but a selection; the `change` on that component
// is its inner input's.
// The size the controls are drawn at: 1, or 1/2 when the host asks for it
// with renderEditField(…, {size: '1/2'}) -- a record view beside a table at
// 1/2 read a step larger than it (owner, 2026-10-14). Set for the duration of
// one synchronous render.
let EDIT_SIZE = '1';

const EDIT_RENDERERS = {
    record: renderRecordLookup,
    relation: renderRecordLookup,
    user: renderRecordLookup,
    lookup: renderLookupEdit,
    string: renderTextEdit,
    phone: renderPhoneEdit,
    password: renderPasswordEdit,
    text: renderTextAreaEdit,
    html: renderHtmlEdit,
    number: renderNumberEdit,
    date: renderDateEdit,
    datetime: renderDateTimeEdit,
    time: renderTimeEdit,
    boolean: renderBooleanEdit,
    choice: renderChoiceEdit,
    choices: renderChoicesEdit,
    file: renderFileEdit,
    color: renderColorEdit,
    include: renderIncludeEdit,
    money: renderMoneyEdit,
    percent: renderPercentEdit,
};

function fieldName(field) {
    return `sf_field_${field.key || 'value'}`;
}

// A telephone is a type of its own (owner decision C302 (1), 2026-11-17): it
// stores E.164 and is checked as a number, where a string is any text. It was
// a `string` whose variant was `phone`, which is still read as this type until
// 2027-01-01 (templates.js). The control is sf-input-country, which knows
// country codes, dial prefixes and masks.
//
// What it writes is E.164, `+79161234567` (FL-1): the control's own form value,
// whatever the box shows -- `+7 916 123-45-67` written back changed a stored
// number on every save. It reads E.164 and the formatted strings stored before.
//
// An extension (`;ext=12`) is not the control's to edit: the number goes to
// it alone and the extension is written back after it, so a save keeps it.
//
// The country an empty field starts on (FL-7): `defaultCountry` (ISO 3166
// alpha-2, "RU") where the field names one, else the page's (ru is Russia,
// en-GB Britain; sf-input-country's own rule). A stored number names its own
// country, so the setting is passed only while the field is empty.
function renderPhoneEdit(field, value, host) {
    const {number: stored, extension} = splitPhone(scalarValue(value) ?? '');
    const preferred = String(field.defaultCountry ?? '').trim().toUpperCase();
    const iso2 = /^[A-Z]{2}$/u.test(preferred) && !String(stored).trim() ? preferred : nothing;
    return html`
        <sf-input-country
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                value=${stored}
                iso2=${iso2}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?disabled=${field.readonly === true}
                use-mask="true"
                show-code="true"
                @change=${(event) => host.setFieldValue(field, phoneWritten(event, extension))}
        ></sf-input-country>
    `;
}

// The control's form value (E.164; nothing for the dial code alone), or the
// box's text brought to E.164 where the element is not defined yet.
function phoneWritten(event, extension = '') {
    const control = event.currentTarget;
    const number = typeof control?.sfFormValue === 'function'
        ? control.sfFormValue() ?? ''
        : phoneE164(event.detail?.value ?? event.target?.value ?? '');
    return number && extension ? `${number};ext=${extension}` : number;
}

// A phone shown: the host's text first (formatFieldValue, or {value, text}),
// as for any string; else the number
// laid out by its country, left to right on a right-to-left page too (an
// Arabic page drew the groups in reverse order).
function phoneText(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    if (typeof formatted === 'string') return formatted;
    if (carriesText(value)) return value.text;
    return formatPhone(scalarValue(value), setText(host, 'phoneExtension'));
}

// A password is a type the set never shows (owner, 2026-10-19; a type of its
// own since C302 (1), a string with variant `password` before, read as it
// until 2027-01-01). The host never sends one: the value of a `password`
// field is {set: true} or {set: false}, and null or an absent value reads as
// not set. View, cell and a read-only field say «задан» or «не задан» in the
// page's language and nothing else. A host that sends a string by mistake gets
// «задан» for it, and the string is still not drawn.
//
// The edit control starts empty whatever is stored, and it writes only what a
// person types: an untouched field calls nothing, so a save carries no value for
// it and can neither clear nor echo a password. Typing and then erasing writes
// `undefined` -- the person took the change back, and a host drops the key.
// Clearing a set password is not offered: an empty field means «keep».
//
// The typed text lives in the input and nowhere else: no `value` attribute on
// sf-input, no data-*, no text node, no log. The eye that shows the password is
// sf-input's own (C123 (4): a glyph inside the field, the crossed eye after a
// press); the set drew a second one beside the field until the text inputs
// study (TI-7), so a record card showed two.
function passwordIsSet(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value.set === true;
    return typeof value === 'string' && value !== '';
}

function passwordState(host, value) {
    return setText(host, passwordIsSet(value) ? 'passwordSet' : 'passwordUnset');
}

function renderPasswordEdit(field, value, host) {
    const set = passwordIsSet(value);
    const placeholder = field.placeholder || (set ? setText(host, 'passwordKeep') : '');
    const write = (event) => {
        const typed = event.target?.value ?? '';
        host.setFieldValue(field, typed === '' ? undefined : typed);
    };
    // A set password is not required again: an empty field keeps it. Spellcheck
    // is off on the wrapper: the attribute is inherited, and sf-input does not
    // declare it (a shown password would otherwise be sent to a spellchecker).
    return html`
        <span class="sf-field-password flex items-cross-center gap-1/3 min-w-0" spellcheck="false">
            <sf-input
                    size=${EDIT_SIZE}
                    appearance="bordered"
                    root-class="flex-1 min-w-0"
                    input-type="password"
                    autocomplete="new-password"
                    name=${fieldName(field)}
                    placeholder=${placeholder || nothing}
                    ?required=${Boolean(field.required) && !set}
                    aria-label=${field.label || field.key || ''}
                    @input=${write}
                    @change=${write}
            ></sf-input>
        </span>
    `;
}

// A string in a row is its own text: the table prints the value.
function renderStringCell() {
    return null;
}

function renderStringView(field, value, host) {
    return renderTextView(field, value, host);
}

function renderPhoneCell(field, value, host) {
    const text = phoneText(field, value, host);
    return text ? html`<bdi dir="ltr">${text}</bdi>` : null;
}

function renderPhoneView(field, value, host) {
    const text = phoneText(field, value, host);
    return text ? html`<span class="sf-field-view"><bdi dir="ltr">${text}</bdi></span>` : nothing;
}

// A password is never shown anywhere: a row and a record say whether one is set.
function renderPasswordCell(field, value, host) {
    return passwordState(host, value);
}

function renderPasswordView(field, value, host) {
    return html`<span class="sf-field-view">${passwordState(host, value)}</span>`;
}

// A password is filtered by whether it is set: «Задан» is the condition
// not-empty, «Не задан» empty, each with the value true, as the number
// filter writes the two (C294).
function renderPasswordFilterControl(field, host) {
    const control = host.getFilterControlValue(field.key) || {};
    const chosen = control.operator === 'empty' ? 'unset' : control.operator === 'not-empty' ? 'set' : '';
    return html`
        <sf-dropdown
                size=${filterSize(host)}
                appearance="bordered"
                mode="select"
                search="false"
                label=${setText(host, 'condition')}
                placeholder=${setText(host, 'condition')}
                name="sf_filter_${field.key || 'password'}"
                .options=${[['set', 'passwordSet'], ['unset', 'passwordUnset']].map(([value, word]) => ({
                    type: 'text', size: filterSize(host), value, text: setText(host, word), selected: value === chosen}))}
                @change=${(event) => {
                    if (event.target !== event.currentTarget) return;
                    const next = event.detail?.values?.[0] || event.detail?.value;
                    if (!next) return;
                    host.patchTempFilterValue(field.key, {operator: next === 'set' ? 'not-empty' : 'empty', value: true});
                }}
        ></sf-dropdown>
    `;
}

// A file shown as what it is. The site keeps logos, so a file whose template
// is image, image_card or image_list is drawn as the image rather than as a
// row with a paperclip -- the same stored file, told apart by the host rather
// than guessed from a file name.
const IMAGE_TEMPLATES = new Set(['image', 'image_card', 'image_list']);

// The template a field is drawn with (C302): templates.js resolveField, which
// reads the former variant and says a fallback once.
function templateOf(field) {
    return resolveField(field).template;
}

function isImageField(field) {
    return IMAGE_TEMPLATES.has(templateOf(field));
}

// A block of text or code the host keeps in a file: six of them on a running
// Larena site -- scripts in the head, an included area. It is a property like any
// other, so it is shown and edited here rather than behind a separate screen.
//
// `language` is the host's, never guessed from the text: a component that decided
// a file was JavaScript because it saw a brace would be wrong about every template
// that contains one. Without a language it is plain text and says so by looking
// like text.
//
// No syntax colouring. That needs an editor component, which is its own part with
// its own decision; a monospace area that keeps indentation is honest, usable and
// does not pretend to be more.
function renderIncludeView(field, value) {
    const text = scalarValue(value);
    if (!text) return nothing;
    return html`
        <pre class="sf-field-include" data-language=${templateParam(field, 'language') ? String(templateParam(field, 'language')) : nothing}><code>${String(text)}</code></pre>
    `;
}

// The include editor is code (C141 (8)): sf-input-textarea's text="code" --
// the code font, spelling off, no wrapping -- at a fixed eight rows.
function renderIncludeEdit(field, value, host) {
    return html`
        <sf-input-textarea
                size=${EDIT_SIZE}
                appearance="bordered"
                class="sf-field-include-edit"
                name=${fieldName(field)}
                value=${scalarValue(value) ?? ''}
                rows=${rowsOf(field, 8)}
                text="code"
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                ?disabled=${field.readonly === true}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-input-textarea>
    `;
}

// The rows a text or a code area shows (template parameter rows, 1..50).
function rowsOf(field, fallback) {
    const asked = Number(templateParam(field, 'rows'));
    return Number.isInteger(asked) && asked >= 1 && asked <= 50 ? String(asked) : (fallback ? String(fallback) : nothing);
}

function renderIncludeCell(field, value) {
    const text = scalarValue(value);
    if (!text) return nothing;
    // One line in a cell: a script in a table row is a fact about the record, not
    // something to read there.
    const first = String(text).split('\n')[0];
    return html`<code>${first.length > 60 ? `${first.slice(0, 60)}…` : first}</code>`;
}

function renderTextEdit(field, value, host) {
    const mask = maskPattern(field);
    if (mask) return renderMaskedEdit(field, value, host, mask);
    value = scalarValue(value);
    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                placeholder=${field.placeholder || nothing}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-input>
    `;
}

// A string typed through a mask (simai.property-view-port 1.16.0, field.mask;
// consumer simai.main, agreed contract q-b0de123841). The control is the stock
// sf-input with its own mask -- the Framework grammar, the same mask-pattern a
// page writes by hand -- so the typing, the caret and the fixed parts are the
// field's and nothing here formats a character.
//
// What the set adds is the one thing sf-input does not say: whether the text
// fills the pattern (./mask.js). The value written is the text as shown, fixed
// parts included («+7 (912) 345-67-89»): the host stores what it gets. Empty is
// not incomplete -- an optional masked field may be cleared, and writes null,
// or "" for a field that declares `nullable: false`. Required stays a mark: an
// empty required field is written as cleared and the host validates it.
//
// An incomplete text is not a value. The host hears it through the optional
// setFieldError(field, message) on every keystroke -- null once the text is
// complete or empty -- so a panel can hold both of its saves while any masked
// field in it is incomplete, each field on its own. The control marks itself
// invalid with the stock message only once the person leaves it (change):
// shouting «Заполните поле полностью» at the first digit of a phone would be
// an error for typing. A completed or cleared text takes the mark off at once.
//
// What is written while incomplete depends on the host. A host that hears
// errors gets the text as typed, because it re-renders with the value it was
// given and anything else would put an older text over the person's typing (a
// value attribute that moves is written into the input). A host that does not
// hear errors cannot hold a save, so the change is withdrawn with undefined,
// as the datetime pair does: what it saves is never the half-typed text.
function renderMaskedEdit(field, value, host, mask) {
    value = scalarValue(value);
    const cleared = field.nullable === false ? '' : null;
    const write = (event, left) => {
        const input = event.currentTarget;
        const text = String(input?.value ?? '');
        const state = maskState(text, mask);
        if (state === 'incomplete') {
            const message = setText(host, 'maskIncomplete');
            if (left && input) {
                input.setAttribute('error-message', message);
                input.toggleAttribute('invalid', true);
            }
            if (typeof host.setFieldError === 'function') {
                host.setFieldError(field, message);
                host.setFieldValue(field, text);
            } else {
                host.setFieldValue(field, undefined);
            }
            return;
        }
        if (input?.hasAttribute('invalid')) {
            input.toggleAttribute('invalid', false);
            input.removeAttribute('error-message');
        }
        host.setFieldError?.(field, null);
        host.setFieldValue(field, state === 'empty' ? cleared : text);
    };
    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                placeholder=${field.placeholder || nothing}
                autocomplete="off"
                mask
                mask-pattern=${mask}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => write(event, false)}
                @change=${(event) => write(event, true)}
        ></sf-input>
    `;
}

function renderTextAreaEdit(field, value, host) {
    value = scalarValue(value);
    return html`
        <sf-input-textarea
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                rows=${rowsOf(field)}
                placeholder=${field.placeholder || nothing}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
                @change=${(event) => host.setFieldValue(field, event.target?.value ?? '')}
        ></sf-input-textarea>
    `;
}

// Formatted text (property-view port 1.17.0): sf-input-rich, named as the
// textarea is. The editor cleans its own value -- what it is given, every
// paste and every edit -- so what it writes back is already the subset. The
// value is read from the element the listener is on: sf-input-rich says input
// and change from its editing surface inside it, which has no value of its own.
function renderHtmlEdit(field, value, host) {
    value = scalarValue(value);
    const write = (event) => host.setFieldValue(field, event.currentTarget?.value ?? '');
    return html`
        <sf-input-rich
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${typeof value === 'string' ? value : ''}
                placeholder=${field.placeholder || nothing}
                ?required=${Boolean(field.required)}
                ?disabled=${EDIT_DISABLED}
                aria-label=${field.label || field.key || ''}
                @input=${write}
                @change=${write}
        ></sf-input-rich>
    `;
}

// A number edited with steps (owner, 2026-10-25): an integer or a number whose
// variant is `stepper` gets sf-input-quantity -- «−» and «+», the arrow keys, the
// bounds the field names -- and every other number keeps the plain sf-input
// below. The bounds, the step and (for a number) the digits are the field's
// own keys, read by this variant alone: a renderer still does not enforce a
// constraint, the stepper only stops at it and the host validates the record.
//
// A number's digits are its `decimals` (C303 (2); `precision` before it, an
// integer's 0), else the digits its `step` implies, else two: a number field
// whose stepper could not take a decimal mark would be a whole one.
// The value goes out as the stepper's number, or null when the field is
// emptied; the panel prints the label, so the control takes it as its
// accessible name only.
function isStepperField(field) {
    return templateOf(field) === 'stepper';
}

function stepperNumber(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    const number = Number(raw);
    return Number.isFinite(number) ? String(number) : '';
}

function renderStepperEdit(field, value, host) {
    const {decimals} = resolveField(field);
    const step = stepperNumber(field.step);
    const precision = decimals !== null ? String(decimals) : (step ? '' : '2');
    const write = (event) => host.setFieldValue(field, event.detail?.value ?? null);
    return html`
        <sf-input-quantity
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                value=${stepperNumber(scalarValue(value))}
                min=${stepperNumber(field.min) || nothing}
                max=${stepperNumber(field.max) || nothing}
                step=${step || nothing}
                precision=${precision || nothing}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?disabled=${field.readonly === true}
                @input=${write}
                @change=${write}
        ></sf-input-quantity>
    `;
}

// A number is a decimal (property-view port 1.18.0: «never a float on the
// wire»). What is typed is read with a comma or a point and spaces between
// groups. A number is one type (C303 (2)): `decimals`, fixed when the field
// is created, is how many digits it keeps after the point, 0 for a whole
// number (an integer field reads as decimals 0); more is a field error,
// never rounded, and a whole number has the digit keyboard. A number field
// whose value arrives as a string, or that declares its decimals, is a
// decimal-string field: it writes the canonical decimal string («1500.50»),
// never a float. Any other number field -- an integer field among them --
// writes a number, as before. Text that is not a number is reported as a
// masked string's incomplete entry is: through setFieldError, which holds the
// save, and under the field once the person leaves it.
function declaresDecimals(field) {
    return Number.isInteger(field.decimals) || Number.isInteger(field.precision);
}

function isDecimalStringField(field, value) {
    return typeof value === 'string' || declaresDecimals(field);
}

function renderNumberEdit(field, value, host) {
    if (isStepperField(field)) return renderStepperEdit(field, value, host);
    const {decimals} = resolveField(field);
    value = scalarValue(value);
    const asString = isDecimalStringField(field, value);
    const write = (event, left) => {
        const input = event.currentTarget ?? event.target;
        const text = String(input?.value ?? '');
        const read = readDecimal(text);
        let message = null;
        if (!read.ok) message = setText(host, 'notNumber');
        else if (read.value !== null && decimals !== null && fractionDigits(read.value) > decimals) {
            message = decimals === 0
                ? setText(host, 'wholeNumber')
                : pageWord(SET_TEXT, 'precisionMax', host ?? null, {component: SET_NAME, count: decimals});
        }
        if (message) {
            if (left && input) {
                input.setAttribute('error-message', message);
                input.toggleAttribute('invalid', true);
            }
            if (typeof host.setFieldError === 'function') {
                host.setFieldError(field, message);
                host.setFieldValue(field, text);
            } else {
                host.setFieldValue(field, undefined);
            }
            return;
        }
        if (input?.hasAttribute?.('invalid')) {
            input.toggleAttribute('invalid', false);
            input.removeAttribute('error-message');
        }
        host.setFieldError?.(field, null);
        if (read.value === null) host.setFieldValue(field, null);
        else host.setFieldValue(field, asString ? read.value : Number(read.value));
    };

    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${value ?? ''}
                inputmode=${decimals === 0 ? 'numeric' : 'decimal'}
                root-class=${EDIT_ALIGN_END ? 'text-end num-tabular' : nothing}
                ?required=${Boolean(field.required)}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => write(event, false)}
                @change=${(event) => write(event, true)}
        ></sf-input>
    `;
}

// Money and percent are the Framework's in every mode (owner decision C291
// (2), 2026-11-17; set boundary study BQ-2): the View set's editors were the
// reference, its option names kept -- `currency` (a fixed ISO 4217 code),
// `min`, `max`, `precision` (a percent's digits; money's are its currency's
// minor units, ISO 4217) and `placeholder`, as simai.property-view-port 1.18.0
// declares them. Every value is a decimal string, never a float:
//
//   percent   "12.5" -- the percent, not the share; 0 to 100 unless the
//             field bounds it otherwise
//   money     {amount: "1500.50", currency: "RUB"}; a field with a fixed
//             currency also reads a bare amount, and writes the pair
//
// One sf-input with the decimal keyboard and the sign in the field («%», a
// fixed currency's «₽» after the amount or «$» before it, as the page's
// language writes it); a money field without a fixed currency has a currency
// dropdown beside the amount. What is typed is read with a comma or a point
// and written canonical; the input shows it back in the page's language
// («1500,5»). An entry that is not a value yet -- text that is not a number,
// more digits after the point than allowed, a bound crossed, an amount without
// a currency -- is written as typed and said through setFieldError, which holds
// a save (port 1.16.0, as a masked string's), and under the field once the
// person leaves it. A host without setFieldError hears undefined, as for a
// number.
// The codes a currency choice offers when a field names no `currencies` and
// the browser cannot list ISO 4217 (Intl.supportedValuesOf).
const OFFERED_CURRENCIES = ['RUB', 'USD', 'EUR', 'CNY', 'KZT', 'BYN', 'AED', 'TRY', 'GBP', 'JPY'];

// A field's `currencies` (C294, MP-10): an array of ISO 4217 codes or a
// comma-separated string; absent, every code the browser knows.
function fieldCurrencies(field) {
    const asked = Array.isArray(field?.currencies) ? field.currencies
        : typeof field?.currencies === 'string' ? field.currencies.split(',') : [];
    const codes = asked.map((code) => String(code).trim().toUpperCase()).filter((code) => /^[A-Z]{3}$/u.test(code));
    return codes.length ? [...new Set(codes)] : currencyCodes(OFFERED_CURRENCIES);
}

// What a person is typing, per host and field: the value written is
// canonical («12.5»), and drawn back as such it would move the caret under
// «12,50» or swallow the comma of «12,». The typed text is shown while it
// still reads as the value, and forgotten when the field is left.
const DECIMAL_DRAFTS = new WeakMap();

function draftOf(host, key) {
    return host && typeof host === 'object' ? DECIMAL_DRAFTS.get(host)?.get(key) : undefined;
}

function keepDraft(host, key, text) {
    if (!host || typeof host !== 'object') return;
    let drafts = DECIMAL_DRAFTS.get(host);
    if (!drafts) {
        drafts = new Map();
        DECIMAL_DRAFTS.set(host, drafts);
    }
    if (text === undefined) drafts.delete(key);
    else drafts.set(key, text);
}

// At rest the amount shows its groups and at least `minDigits` after the
// point («1 500,50»); while it is typed, as typed (C294).
function decimalShown(host, key, value, {currency = null, minDigits = 0} = {}) {
    if (value === null || value === undefined || value === '') return '';
    const locale = pageLocale(host ?? null);
    const read = readTypedDecimal(value, {locale: 'en', currency});
    if (!read.ok) return String(value);
    const draft = draftOf(host, key);
    if (typeof draft === 'string') {
        const typed = readTypedDecimal(draft, {locale, currency});
        if (typed.ok && typed.value === read.value) return draft;
    }
    return restingDecimal(read.value, locale, minDigits);
}

const hasBound = (bound) => bound !== null && bound !== undefined && bound !== '' && readDecimal(bound).ok;

// What is wrong with a typed decimal, or '': not a number, more digits after
// the point than `digits` (never rounded away: «1500,555» is an error, while
// «1500,500» is 1500.5), outside min..max.
function decimalError(host, text, {digits = null, min = null, max = null, currency = null} = {}) {
    const read = readTypedDecimal(text, {locale: pageLocale(host ?? null), currency});
    if (!read.ok) return setText(host, 'notNumber');
    if (read.value === null) return '';
    if (Number.isInteger(digits) && fractionDigits(read.value) > digits) {
        return digits === 0
            ? setText(host, 'fractionNone')
            : pageWord(SET_TEXT, 'precisionMax', host ?? null, {component: SET_NAME, count: digits});
    }
    const low = hasBound(min) && compareDecimal(read.value, min) === -1;
    const high = hasBound(max) && compareDecimal(read.value, max) === 1;
    if (!low && !high) return '';
    const locale = pageLocale(host ?? null);
    const vars = {min: hasBound(min) ? formatDecimal(min, locale) : '', max: hasBound(max) ? formatDecimal(max, locale) : ''};
    if (hasBound(min) && hasBound(max)) return setWord(host, 'boundBetween', vars);
    return low ? setWord(host, 'boundAtLeast', vars) : setWord(host, 'boundAtMost', vars);
}

// The value goes to the host with what is wrong with it: a value that is not
// one yet is written as typed while setFieldError holds the save.
function writeDecimal(field, host, value, message) {
    if (message) {
        if (typeof host.setFieldError === 'function') {
            host.setFieldError(field, message);
            host.setFieldValue(field, value);
        } else {
            host.setFieldValue(field, undefined);
        }
        return;
    }
    host.setFieldError?.(field, null);
    host.setFieldValue(field, value);
}

function decimalInput(field, value, host, {key, check, write, currency = null, minDigits = 0, textStart = '', textEnd = '', rootClass = ''}) {
    const own = EDIT_ERROR;
    const locale = pageLocale(host ?? null);
    const typed = (event, left) => {
        const input = event.currentTarget ?? event.target;
        const text = String(input?.value ?? '');
        keepDraft(host, key, left ? undefined : text);
        const message = check(text);
        if (input && !own) {
            if (message && left) {
                input.setAttribute('error-message', message);
                input.toggleAttribute('invalid', true);
            } else if (!message && input.hasAttribute?.('invalid') && !input.hasAttribute('data-sf-form-invalid')) {
                input.toggleAttribute('invalid', false);
                input.removeAttribute('error-message');
            }
        }
        const read = readTypedDecimal(text, {locale, currency});
        write(read.ok ? read.value : text, message);
    };
    const rootClasses = [rootClass, EDIT_ALIGN_END ? 'text-end num-tabular' : ''].filter(Boolean).join(' ');
    return html`
        <sf-input
                size=${EDIT_SIZE}
                appearance="bordered"
                name=${fieldName(field)}
                value=${decimalShown(host, key, value, {currency, minDigits})}
                inputmode="decimal"
                text-start=${isolatedSign(textStart, locale) || nothing}
                text-end=${isolatedSign(textEnd, locale) || nothing}
                placeholder=${field.placeholder || nothing}
                root-class=${rootClasses || nothing}
                ?required=${Boolean(field.required)}
                ?invalid=${Boolean(own)}
                error-message=${own || nothing}
                aria-label=${field.label || field.key || ''}
                @input=${(event) => typed(event, false)}
                @change=${(event) => typed(event, true)}
        ></sf-input>
    `;
}

// A currency sign inside the field on a right-to-left page (C294 follow-up):
// «US$» or «CA$» ends in a neutral mark, and the browser drew «$US» in the
// field's affix while the display text, isolated by decimal.js, read right.
// The sign is isolated left to right (U+2066 .. U+2069) there too.
function isolatedSign(sign, locale) {
    if (!sign || !isRtlLocale(locale) || !/[A-Za-z]/u.test(sign)) return sign;
    return `\u2066${sign}\u2069`;
}

function fixedCurrency(field) {
    return typeof field?.currency === 'string' && /^[A-Z]{3}$/u.test(field.currency) ? field.currency : null;
}

// A percent's digits after the point: `precision`, else the digits its
// `step` has («0.1» is one), else as many as typed.
function percentDigits(field) {
    const {decimals} = resolveField(field);
    if (decimals !== null) return decimals;
    const step = readDecimal(field.step);
    return step.ok && step.value !== null && Number(step.value) > 0 ? fractionDigits(step.value) : null;
}

// A percent is the percent itself, «12.5» is 12,5 % (C294); it is bounded
// only by the field's min and max -- a growth of 150 % or a change of −5 % is
// a percent too (MP-11: the View set bounded it 0..100 without saying why).
function renderPercentEdit(field, value, host) {
    const key = String(field.key ?? '');
    const min = hasBound(field.min) ? field.min : null;
    const max = hasBound(field.max) ? field.max : null;
    const digits = percentDigits(field);
    return decimalInput(field, scalarValue(value), host, {
        key,
        textEnd: '%',
        check: (text) => decimalError(host, text, {digits, min, max}),
        write: (next, message) => writeDecimal(field, host, next, message),
    });
}

function renderMoneyEdit(field, value, host) {
    const locale = pageLocale(host ?? null);
    const key = String(field.key ?? '');
    const fixed = fixedCurrency(field);
    const display = currencyDisplayOf(field);
    const parts = moneyParts(scalarValue(value), fixed);
    // A currency chosen before an amount is typed waits here: a value is an
    // amount and its currency, never a currency alone.
    const currencyKey = `${key}#currency`;
    const currency = parts.currency || draftOf(host, currencyKey) || null;
    const min = hasBound(field.min) ? field.min : null;
    const max = hasBound(field.max) ? field.max : null;
    const check = (text, code) => {
        const message = decimalError(host, text, {
            digits: code ? currencyOf(code, locale).minor : null,
            min,
            max,
            currency: code,
        });
        if (message) return message;
        return readTypedDecimal(text, {locale, currency: code}).value !== null && !code ? setText(host, 'chooseCurrency') : '';
    };
    const write = (amount, message, code) => writeDecimal(field, host,
        amount === null || amount === '' ? null : {amount, currency: code ?? null}, message);
    const sign = fixed ? currencyOf(fixed, locale, display) : null;
    const amount = decimalInput(field, parts.amount, host, {
        key,
        currency,
        minDigits: currency ? currencyOf(currency, locale).minor : 0,
        textStart: sign?.before ? sign.sign : '',
        textEnd: sign && !sign.before ? sign.sign : '',
        rootClass: fixed ? '' : 'flex-1 min-w-0',
        check: (text) => check(text, currency),
        write: (next, message) => write(next, message, currency),
    });
    if (fixed) return amount;

    // The field's `currencies`, the value's own currency first when the list
    // lacks it; without a list, every ISO 4217 code with a search.
    const listed = fieldCurrencies(field);
    const offered = [...new Set([...(currency ? [currency] : []), ...listed])];
    const name = setText(host, 'currency');
    const optionText = (code) => {
        const {sign: mark} = currencyOf(code, locale, display);
        return mark === code ? code : `${code} ${mark}`;
    };
    // C294 (b): the choice is a third of the row but never narrower than its
    // longest option and the field's own chrome -- the chevron's square (the
    // control height of the size) and the insets (space-1). A third of a narrow
    // row cut «USD US$» on an ar page and «USD $» in a form column at 390.
    const longest = Math.max(3, ...offered.map((code) => [...optionText(code)].length));
    const sizeName = String(EDIT_SIZE).replace('/', '\\/');
    const currencyMin = `min-inline-size: calc(${longest + 1}ch + var(--sf-ui-${sizeName}--control-height) + var(--sf-space-1))`;
    return html`
        <div class="flex gap-1/3 items-cross-start min-w-0 w-full">
            ${amount}
            <sf-dropdown
                    size=${EDIT_SIZE}
                    appearance="bordered"
                    mode="select"
                    search=${offered.length > 12 ? 'true' : 'false'}
                    root-class="basis-1/3"
                    root-style=${currencyMin}
                    name=${`${fieldName(field)}_currency`}
                    value=${currency ?? ''}
                    placeholder=${name}
                    aria-label=${name}
                    .options=${offered.map((code) => ({type: 'text', size: '1', value: code, text: optionText(code), selected: code === currency}))}
                    @change=${(event) => {
                        const code = event.detail?.values?.[0] || event.detail?.value || null;
                        keepDraft(host, currencyKey, code ?? undefined);
                        const typed = parts.amount;
                        // The dropdown shows the code itself; a value is written
                        // only with an amount.
                        // The stored amount is checked as the page would show it.
                        if (typed !== null && typed !== undefined && typed !== '') write(typed, check(restingDecimal(typed, locale), code), code);
                    }}
            ></sf-dropdown>
        </div>
    `;
}

function renderPercentView(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    const text = typeof formatted === 'string' ? formatted
        : carriesText(value) ? value.text : formatPercent(scalarValue(value), pageLocale(host ?? null)) || viewText(field, value, null);
    return text ? html`<span class="sf-field-view">${text}</span>` : nothing;
}

function renderMoneyView(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    const text = typeof formatted === 'string' ? formatted
        : carriesText(value) ? value.text : formatMoney(scalarValue(value), field, pageLocale(host ?? null));
    return text ? html`<span class="sf-field-view">${text}</span>` : nothing;
}

// A date control has no clock. `sf-input-date` declares a format and a date,
// and its parser is anchored (`^\d{4}-\d{2}-\d{2}$`), so a datetime value
// falls through to a loose digit scan that reads `2026-11-27T13:26:00` as day
// 2026 of month 11 in year 27 -- an impossible date, which renders as an empty
// input. Split the value instead: the control edits the day, and the time the
// record already held is put back on the way out. Without that, editing the day
// of a datetime would write a value with the clock silently zeroed, which is
// worse than the empty control, because it looks like it worked. A `datetime`
// field has its own editor now (renderDateTimeEdit); this keeps the clock of a
// `date` field whose value carries one.
const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2})?$/;

function splitDateTime(value) {
    const match = typeof value === 'string' ? value.trim().match(DATE_TIME_RE) : null;
    if (!match) {
        return {date: value, suffix: ''};
    }

    return {date: match[1], suffix: `T${match[2]}${match[3] || ''}`};
}

// min and max bound the day (PD-2, as a datetime's do): an ISO date, or the
// day of an ISO date and time; the calendar disables the days outside them
// and a typed day outside them is put back. The host still validates.
function dayBound(bound) {
    const match = typeof bound === 'string' ? bound.trim().match(/^\d{4}-\d{2}-\d{2}/u) : null;
    return match ? match[0] : '';
}

function renderDateEdit(field, value, host) {
    value = scalarValue(value);
    const {date, suffix} = splitDateTime(value);
    const min = dayBound(field.min);
    const max = dayBound(field.max);
    return html`
        <sf-input-date
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                value=${date ?? ''}
                min-date=${min || nothing}
                max-date=${max || nothing}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?invalid=${Boolean(EDIT_ERROR)}
                error-message=${EDIT_ERROR || nothing}
                @change=${(event) => {
                    const next = event.detail?.value ?? event.target?.value ?? null;
                    host.setFieldValue(field, next && suffix ? `${next}${suffix}` : next);
                }}
        ></sf-input-date>
    `;
}

// A datetime is edited as what it is: a day and a time of day. The date
// editor above edits the day alone and puts the record's clock back, so a new
// record could not get a time and «15.11.2026 10:30» typed nowhere was saved
// as «15.11.2026» (Larena acceptance, 2026-10-22). The set then drew a pair --
// sf-input-date for the day and an sf-input masked to hh:mm for the time --
// because the picker had no clock, and sf-view-properties drew the same pair
// itself (duplication audit A-14). sf-input-date has a time now (1.4.0,
// mode="datetime"), so a datetime is one control: the calendar with the time
// row under it, typed as «15.11.2026 10:30», at the field's size, named by the
// label.
//
// The value round trip (datetime.js): ISO 8601 with the time; an untouched
// field writes nothing; a changed day keeps the stored time below the minute
// and the zone; a changed time keeps the zone; a new value has no zone (the
// host's local time); a cleared field writes null; coming back to what was
// stored writes undefined -- no change. The control writes only whole values
// (a day always has a time, a typed text that is not one is put back), so no
// partial entry reaches the host. The day is bound as a property, so a
// re-render with the same value does not put back what the person cleared.
//
// min and max (an ISO date, or a date and a time) are the control's min-date
// and max-date; step is its minute step (1 to 60).
function minuteStepOf(field) {
    const step = Number(field.step);
    return Number.isInteger(step) && step >= 1 && step <= 60 ? String(step) : '';
}

function renderDateTimeEdit(field, value, host) {
    const stored = readDateTime(value);
    const shown = stored.date ? `${stored.date}${stored.time ? `T${stored.time}` : ''}` : '';
    const min = typeof field.min === 'string' ? field.min : '';
    const max = typeof field.max === 'string' ? field.max : '';
    const step = minuteStepOf(field);
    return html`
        <sf-input-date
                class="sf-field-datetime"
                mode="datetime"
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                .value=${shown}
                min-date=${min || nothing}
                max-date=${max || nothing}
                minute-step=${step || nothing}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?invalid=${Boolean(EDIT_ERROR)}
                error-message=${EDIT_ERROR || nothing}
                @change=${(event) => {
                    // The picker's own change, not a native one from its field.
                    if (event.target !== event.currentTarget) return;
                    const [date = '', time = ''] = String(event.detail?.value ?? '').split('T');
                    const result = composeDateTime(stored, {date, time});
                    if (result.error) return;
                    const same = result.value === null
                        ? stored.known && !stored.date
                        : result.value === stored.raw;
                    host.setFieldValue(field, same ? undefined : result.value);
                }}
        ></sf-input-date>
    `;
}

// A time of day (hh:mm, or hh:mm:ss as a host stores it) is sf-input-date in
// time mode: the time row alone, typed as «10:30». An unchanged minute writes
// nothing and keeps the stored seconds; min and max (hh:mm) are the control's
// min-time and max-time; step is its minute step.
function renderTimeEdit(field, value, host) {
    const stored = splitTime(value);
    const min = typeof field.min === 'string' ? field.min : '';
    const max = typeof field.max === 'string' ? field.max : '';
    const step = minuteStepOf(field);
    return html`
        <sf-input-date
                class="sf-field-time"
                mode="time"
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                .value=${stored.time}
                min-time=${min || nothing}
                max-time=${max || nothing}
                minute-step=${step || nothing}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?invalid=${Boolean(EDIT_ERROR)}
                error-message=${EDIT_ERROR || nothing}
                @change=${(event) => {
                    if (event.target !== event.currentTarget) return;
                    const result = composeTime(stored, String(event.detail?.value ?? ''));
                    if (result.error) return;
                    const same = result.value === null
                        ? stored.known && !stored.time
                        : result.value === stored.raw;
                    host.setFieldValue(field, same ? undefined : result.value);
                }}
        ></sf-input-date>
    `;
}

// A yes/no is drawn by its template (owner decision C303 (4), 2026-11-17): the
// switch is the default for every field; the checkbox and the buttons «Да» |
// «Нет» are templates the administrator picks -- the buttons where «not set»
// differs from «no», since neither a switch nor a checkbox can say «не
// задано». The Framework no longer picks the control from `required` and the
// apply mode (the rule of C165 (4) and of 2026-10-06 goes; FW-4): a field
// draws the template it names. A switch or a checkbox over an absent value
// writes nothing until it is pressed. Neither carries `required`: a yes/no
// with a value is answered, and an unticked box is «Нет».
function renderBooleanEdit(field, value, host) {
    const template = templateOf(field);

    if (template === 'switch') {
        return html`
            <sf-switch
                    size=${EDIT_SIZE}
                    name=${fieldName(field)}
                    ?checked=${value === true}
                    aria-label=${field.label || field.key || ''}
                    @change=${(event) => host.setFieldValue(field, Boolean(event.target?.checked))}
            ></sf-switch>
        `;
    }

    if (template === 'checkbox') {
        return html`
            <sf-checkbox
                    size=${EDIT_SIZE}
                    name=${fieldName(field)}
                    ?checked=${value === true}
                    aria-label=${field.label || field.key || ''}
                    @change=${(event) => host.setFieldValue(field, Boolean(event.target?.checked ?? event.detail?.checked))}
            ></sf-checkbox>
        `;
    }

    const words = booleanWords(field, host);
    const items = JSON.stringify([
        {value: 'yes', label: words.yes},
        {value: 'no', label: words.no},
    ]);

    return html`
        <sf-segmented
                appearance="buttons"
                size=${EDIT_SIZE}
                items=${items}
                value=${value === true ? 'yes' : value === false ? 'no' : nothing}
                aria-label=${field.label || field.key || ''}
                @change=${(event) => {
                    const next = event.detail?.value;
                    host.setFieldValue(field, next === 'yes' ? true : next === 'no' ? false : null);
                }}
        ></sf-segmented>
    `;
}

function editOptions(field, value, multiple) {
    const options = field.options || field.filter?.options || field.constraints?.options || [];
    const chosen = multiple
        ? new Set((Array.isArray(value) ? value : []).map((item) => String(item)))
        : new Set([String(value ?? '')]);

    return options.map((option) => ({
        type: 'text',
        size: '1',
        text: option.label ?? option.text ?? String(option.value),
        value: String(option.value),
        selected: chosen.has(String(option.value)),
    }));
}

// A choice as buttons (simai.property-view-port 1.16.0, variant `buttons`;
// consumer simai.main, agreed contract q-b0de123841): one segmented
// sf-button-group, a button per option, for a short list a person reads at a
// glance -- a kind, a tier, a yes-no-maybe. The group is the stock one: Tab
// enters it, the arrows move and choose, Space and Enter choose, and it is a
// radiogroup to assistive technology. It wraps when it does not fit and is
// never replaced by a dropdown: a field that changes its control with the
// width of a window is two fields.
//
// `size` is the field's own step on the ladder ("1/2", "1", "2"), absent the
// panel's: the track of a segmented group is exactly as tall as an sf-button of
// the same size, so the buttons stand on the line the fields beside them do.
//
// The value is the option's own, in its own type -- the group speaks strings,
// so a chosen "2" is written back as the 2 the option carries -- or null.
// Pressing the chosen button again clears it when the field is not required;
// the group itself keeps a chosen button chosen (its select answers
// unchanged), so the press is read in the capture phase, before the group's
// own listener, where the value it is about to be compared with is still the
// one shown. A required field keeps the stock behaviour: the chosen button
// stays chosen.
//
// Read-only shows the chosen button chosen, in its own colours, and lets none
// be pressed: pointer events are off on the track and a key that would choose
// is stopped before the group hears it. Disabled is the group's own disabled,
// in the on-disable colours. The two are different facts -- «not yours to
// change» and «not available now» -- and drawn as the group draws them.
const CHOICE_BUTTON_SIZES = new Set(['1/2', '1', '2']);
const CHOOSING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'Enter']);

function isChoiceButtons(field) {
    return templateOf(field) === 'buttons';
}

function renderChoiceButtons(field, value, host) {
    value = scalarValue(value);
    const options = (field.options || field.filter?.options || field.constraints?.options || [])
        .filter((option) => option && option.value !== null && option.value !== undefined && String(option.value) !== '');
    const items = options.map((option) => ({
        value: String(option.value),
        label: String(option.label ?? option.text ?? option.value),
        ...(option.icon ? {icon: String(option.icon)} : {}),
        ...(option.disabled ? {disabled: true} : {}),
    }));
    const asked = String(templateParam(field, 'size') ?? '');
    const size = CHOICE_BUTTON_SIZES.has(asked) ? asked : EDIT_SIZE;
    const disabled = EDIT_DISABLED;
    const locked = !disabled && field.readonly === true;
    const clearable = field.required !== true && !locked && !disabled;
    const chosen = value === null || value === undefined ? '' : String(value);
    const optionValue = (text) => options.find((option) => String(option.value) === text)?.value ?? text;

    const press = {
        capture: true,
        handleEvent(event) {
            const group = event.currentTarget;
            const segment = event.target?.closest?.('[data-sf-button-group-value]');
            if (!group || !segment || !group.contains(segment)) return;
            if (locked) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (!clearable || segment.disabled) return;
            if (segment.getAttribute('data-sf-button-group-value') !== group.value) return;
            event.preventDefault();
            event.stopPropagation();
            group.clear?.();
        },
    };
    const keys = {
        capture: true,
        handleEvent(event) {
            if (!locked || !CHOOSING_KEYS.has(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
        },
    };

    return html`
        <sf-segmented
                class="sf-field-choice-buttons"
                appearance="track"
                size=${size}
                root-class=${locked ? 'flex-wrap pointer-events-none' : 'flex-wrap'}
                name=${fieldName(field)}
                items=${JSON.stringify(items)}
                value=${chosen || nothing}
                ?disabled=${disabled}
                data-readonly=${locked ? 'true' : nothing}
                aria-label=${field.label || field.key || ''}
                @click=${press}
                @keydown=${keys}
                @change=${(event) => {
                    const next = String(event.detail?.value ?? '');
                    host.setFieldValue(field, next === '' ? null : optionValue(next));
                }}
        ></sf-segmented>
    `;
}

function renderChoiceEdit(field, value, host) {
    if (isChoiceButtons(field)) return renderChoiceButtons(field, value, host);
    value = scalarValue(value);
    return html`
        <sf-dropdown
                size=${EDIT_SIZE}
                appearance="bordered"
                mode="select"
                search="false"
                name=${fieldName(field)}
                ?required=${Boolean(field.required)}
                value=${value ?? ''}
                placeholder=${field.placeholder || nothing}
                aria-label=${field.label || field.key || ''}
                .options=${editOptions(field, value, false)}
                @change=${(event) => host.setFieldValue(field, event.detail?.value ?? null)}
        ></sf-dropdown>
    `;
}

// A long list is chosen from as a checklist, not from a dropdown: a custom
// role's 137 rights in one dropdown were a scroll inside a scroll, and what was
// chosen could not be seen at once (Larena, 2026-10-17). The list stands in
// two columns where the field has the room for them and in one where it does
// not. `variant: 'checklist'` asks for it at any length; `variant: 'select'`
// keeps the dropdown at any length.
const CHECKLIST_FROM = 13;

function renderChoicesChecklist(field, value, host) {
    const options = field.options || field.filter?.options || field.constraints?.options || [];
    const chosen = new Set((Array.isArray(value) ? value : []).map((item) => String(item)));
    const toggle = (option, on) => {
        const next = options.filter((candidate) => (String(candidate.value) === String(option.value) ? on : chosen.has(String(candidate.value))))
            .map((candidate) => candidate.value);
        host.setFieldValue(field, next);
    };
    return html`
        <div class="sf-field-checklist grid gap-1/3 w-full min-w-0" role="group" aria-label=${field.label || field.key || ''}
             style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr))">
            ${options.map((option) => html`<sf-checkbox size=${EDIT_SIZE}
                    name=${fieldName(field)} value=${String(option.value)}
                    label=${option.label ?? option.text ?? String(option.value)}
                    .checked=${chosen.has(String(option.value))}
                    @change=${(event) => toggle(option, Boolean(event.target?.checked ?? event.detail?.checked))}></sf-checkbox>`)}
        </div>
    `;
}

function renderChoicesEdit(field, value, host) {
    const options = field.options || field.filter?.options || field.constraints?.options || [];
    // The dropdown is the default; from 13 options it is a checklist, unless
    // the field asked for the dropdown by its former name select, which kept
    // it at any length (until 2027-01-01).
    const {template, former} = resolveField(field);
    if (template === 'checklist' || (former !== 'select' && options.length >= CHECKLIST_FROM)) {
        return renderChoicesChecklist(field, value, host);
    }
    return html`
        <sf-dropdown
                size=${EDIT_SIZE}
                appearance="bordered"
                mode="select"
                multiple
                search="false"
                name=${fieldName(field)}
                ?required=${Boolean(field.required)}
                placeholder=${field.placeholder || nothing}
                aria-label=${field.label || field.key || ''}
                .options=${editOptions(field, value, true)}
                @change=${(event) => {
                    const next = event.detail?.values ?? event.detail?.value;
                    host.setFieldValue(field, Array.isArray(next) ? next : next ? [next] : []);
                }}
        ></sf-dropdown>
    `;
}

// The record picker: what a record, a relation or a user is edited with.
//
// It is the entity-select the filter already has, pointed at records instead of
// options and holding one value rather than several. The three cases that break
// a picker are the ones it is built around, and the ones the probe measures
// against the consumer's 448-target field:
//
//   search   hundreds of targets never fit a list, so the search is the way in
//   paging   a page arrives with a cursor and the next is asked for
//   off-page the chosen record is usually not on the page in front of you, so
//            the picker shows what is chosen whether or not the page holds it
//
// The host does the fetching, because a page of records is a query with an
// access check, and the renderer must not make one:
//
//   getFieldOptionsPage(field)                  the page the host holds
//   loadFieldOptions(field, {cursor, search})   ask for a page
//   getFieldOptionSearch(field) / setFieldOptionSearch(field, text)
//
// The value is the resolved object the consumer sends: {value, label}. The
// picker writes the same shape back, so a host never has to re-resolve what it
// already knew.
// The text the set shows beyond a value: a status line, a retry, a load-more, a
// remove label. These belong to whoever owns the interface, not to the set, so
// the host supplies them and the Russian is only the fallback -- the same
// arrangement as `booleanWords`, and the same reason. A host that passes nothing
// keeps exactly what was published.
const SET_TEXT = LANG_WORDS;

// The host's word wins, as it always did; the set's own fallback now follows
// the page's language instead of being Russian whatever the page is. `host` is
// the component that called the set, which is the node the rule reads from.
// The set is not an element, so it is named here rather than taken from the
// node: `host` is whichever component called it, and words registered for the
// set should apply wherever it draws rather than once per host.
const SET_NAME = 'sf-field-renderers';

function setText(host, key) {
    return host?.getFieldText?.(key) ?? pageText(SET_TEXT, key, host ?? null, SET_NAME);
}

// A word with places in it ({zone}, {n}): the host's word wins, as setText's.
function setWord(host, key, vars) {
    const own = host?.getFieldText?.(key);
    if (own !== undefined && own !== null) {
        return String(own).replace(/\{([a-z][\w-]*)\}/giu, (whole, name) => (vars && name in vars ? String(vars[name]) : whole));
    }
    return pageWord(SET_TEXT, key, host ?? null, {component: SET_NAME, vars});
}

// One job, one component (owner decision C139 (1), 2026-11-14): a record, a
// relation, a user and a paged lookup are chosen with sf-input-lookup -- the
// search the host answers, its rows with a picture and a caption, its states
// and its chips -- where they were a searchable sf-dropdown beside a status
// line of the set's own. sf-dropdown stays for a short list given whole (an
// inline lookup). The dropdown path is kept until 2027-01-01 for a host that
// asks renderEditField(…, {picker: 'dropdown'}); it is noted as deprecated.
const DROPDOWN_PICKER_UNTIL = '2027-01-01';
let EDIT_PICKER = '';

function dropdownPicker() {
    if (EDIT_PICKER !== 'dropdown') return false;
    noteDeprecated({component: 'sf-field-renderers', kind: 'value', attribute: 'picker', from: 'dropdown', to: null,
        since: '2026-11-14', remove_after: DROPDOWN_PICKER_UNTIL});
    return true;
}

// An item the lookup shows, from what the host's page holds: a user's
// avatarText is the avatar's initials, an item's own avatar ({src} or
// {initials}), icon, caption and match ranges travel as they are.
function lookupItem(item) {
    if (!item || typeof item !== 'object') return null;
    const avatar = item.avatar && typeof item.avatar === 'object' ? item.avatar
        : item.avatarText ? {initials: String(item.avatarText)} : undefined;
    return {
        value: item.value,
        label: String(item.label ?? item.text ?? item.value ?? ''),
        ...(item.caption ? {caption: String(item.caption)} : {}),
        ...(avatar ? {avatar} : {}),
        ...(item.icon ? {icon: String(item.icon)} : {}),
        ...(item.match ? {match: item.match} : {}),
    };
}

// The lookup's provider over the host's page interface (getFieldOptionsPage,
// loadFieldOptions, getFieldOptionSearch, setFieldOptionSearch): a query is
// one host search, a cursor its next page. The page the host already holds
// for the same query answers at once (a record view asks the first page as
// its group opens). A host that loads without answering a promise answers on
// its next drawing: the page is read again until it is no longer loading.
function hostProvider(field, host) {
    return async (query, {cursor = null, signal} = {}) => {
        const text = String(query ?? '');
        const held = host.getFieldOptionsPage(field) || null;
        const sameSearch = (host.getFieldOptionSearch?.(field) ?? '') === text;
        let page = held;
        let from = 0;
        let before = [];
        if (cursor === null && sameSearch && held?.status === 'ready') {
            page = held;
        } else {
            before = cursor === null || !Array.isArray(held?.items) ? [] : held.items;
            host.setFieldOptionSearch?.(field, text);
            await host.loadFieldOptions(field, {cursor, search: text});
            page = host.getFieldOptionsPage(field) || null;
            for (let wait = 0; page?.status === 'loading' && wait < 100 && !signal?.aborted; wait += 1) {
                await new Promise((done) => setTimeout(done, 50));
                page = host.getFieldOptionsPage(field) || null;
            }
        }
        if (signal?.aborted) return {items: []};
        // A host may join the next page to the ones it holds, or replace them
        // with it: only what is new is answered.
        const now = Array.isArray(page?.items) ? page.items : [];
        if (before.length && now.length > before.length && now[0]?.value === before[0]?.value) from = before.length;
        if (page?.status === 'unsupported') return {status: 'unavailable'};
        if (!page || page.status === 'error' || page.status === 'loading') throw new Error(setText(host, 'recordsError'));
        const items = (Array.isArray(page.items) ? page.items : []).slice(from).map(lookupItem).filter(Boolean);
        return {items, nextCursor: page.nextCursor ?? null};
    };
}

// The page a host pages answers a hundred at most: the lookup cuts an answer
// to max-results, and a host page is the host's own size.
const HOST_PAGE_MOST = 100;

function renderHostLookup(field, value, host, {multiple, placeholder}) {
    // What the lookup says it chose, in the shape the set writes: {value,
    // label}, or a list of them when multiple.
    const resolved = (item) => ({value: item.value, label: String(item.label ?? item.value)});
    const write = (event) => {
        if (event.target !== event.currentTarget) return;
        const next = event.detail?.value ?? event.target?.value;
        if (multiple) {
            host.setFieldValue(field, (Array.isArray(next) ? next : []).map(resolved));
            return;
        }
        host.setFieldValue(field, next && typeof next === 'object' ? resolved(next) : null);
    };
    return html`
        <div class="sf-field-picker flex flex-col gap-1/3" data-field-picker=${field.key || nothing}>
            <sf-input-lookup
                    size=${EDIT_SIZE}
                    ?multiple=${multiple}
                    suggest
                    min-length="1"
                    max-results=${String(HOST_PAGE_MOST)}
                    name=${fieldName(field)}
                    ?required=${Boolean(field.required)}
                    ?disabled=${EDIT_DISABLED}
                    placeholder=${field.placeholder || placeholder}
                    aria-label=${field.label || field.key || ''}
                    .value=${value ?? (multiple ? [] : null)}
                    .provider=${hostProvider(field, host)}
                    @change=${write}
            ></sf-input-lookup>
        </div>
    `;
}

// The record picker: a record, a relation or a user, one value, searched and
// paged by the host (C139 (1)).
function renderRecordLookup(field, value, host) {
    if (dropdownPicker()) return renderRecordPicker(field, value, host);
    if (!host.loadFieldOptions || !host.getFieldOptionsPage) return null;
    const page = host.getFieldOptionsPage(field) || null;
    // A host that refused this field's candidates has none to give: the field
    // falls back to its value, read-only, as the dropdown path did.
    if (page?.status === 'unsupported') return null;
    const chosen = value && typeof value === 'object' ? value : null;
    return renderHostLookup(field, chosen, host, {multiple: false, placeholder: setText(host, 'pickRecord')});
}

// DEPRECATED until 2027-01-01 (C139 (1)): the record picker as a searchable
// sf-dropdown, for a host that asks {picker: 'dropdown'}.
function renderRecordPicker(field, value, host) {
    if (!host.loadFieldOptions || !host.getFieldOptionsPage) return null;

    const page = host.getFieldOptionsPage(field) || null;
    // A host that refused this field's candidates has none to give, now or ever.
    // Returning nothing here puts the field on the read-only fallback, which shows
    // the value it holds -- rather than an empty picker and a retry that cannot
    // succeed, over a value that is actually there.
    if (page?.status === 'unsupported') return null;
    const search = host.getFieldOptionSearch?.(field) ?? '';
    const chosen = value && typeof value === 'object' ? value : null;
    const items = Array.isArray(page?.items) ? page.items : [];
    // What is chosen stays in the list even when the page does not hold it --
    // the common case at 448 targets, and the one that makes a picker look like
    // it has forgotten the answer.
    const options = [
        ...(chosen && !items.some((item) => String(item.value) === String(chosen.value)) ? [chosen] : []),
        ...items,
    ].map((item) => ({
        type: 'text',
        size: '1',
        text: String(item.label ?? item.value),
        value: String(item.value),
        selected: Boolean(chosen && String(chosen.value) === String(item.value)),
    }));

    const pick = (next) => {
        if (!next) {
            host.setFieldValue(field, null);
            return;
        }
        const found = [chosen, ...items].find((item) => item && String(item.value) === String(next));
        host.setFieldValue(field, found ? {value: found.value, label: found.label} : {value: next});
    };

    return html`
        <div class="sf-field-picker flex flex-col gap-1/3" data-field-picker=${field.key || nothing}>
            <sf-dropdown
                    size=${EDIT_SIZE}
                    appearance="bordered"
                    mode="select"
                    search="true"
                    name=${fieldName(field)}
                    ?required=${Boolean(field.required)}
                    value=${chosen ? String(chosen.value) : ''}
                    placeholder=${field.placeholder || setText(host, 'pickRecord')}
                    search-placeholder=${field.searchPlaceholder || setText(host, 'searchRecords')}
                    aria-label=${field.label || field.key || ''}
                    .options=${options}
                    @change=${(event) => pick(event.detail?.value ?? null)}
                    @input=${(event) => {
                        const text = event.target?.value ?? '';
                        host.setFieldOptionSearch?.(field, text);
                        host.loadFieldOptions(field, {cursor: null, search: text});
                    }}
            ></sf-dropdown>
            ${page ? html`
                <div class="sf-field-picker-state flex items-cross-center gap-1/3">
                    <div role="status" aria-live="polite" class="sf-text-1">
                        ${page.status === 'loading' && !page.quiet ? setText(host, 'loadingRecords')
                            : page.status === 'error' ? setText(host, 'recordsError') : ''}
                    </div>
                    ${page.status === 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'retry')}
                                @click=${() => host.loadFieldOptions(field, {cursor: null, search})}
                        ></sf-button>
                    ` : nothing}
                    ${page.nextCursor && page.status !== 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'loadMore')}
                                ?disabled=${page.status === 'loading'}
                                @click=${() => host.loadFieldOptions(field, {cursor: page.nextCursor, search})}
                        ></sf-button>
                    ` : nothing}
                </div>
            ` : nothing}
        </div>
    `;
}

// The lookup: a value chosen from a reference list the host keeps (Larena,
// 2026-10-23). It is the record picker's arrangement -- the host pages and
// searches, what is chosen stays shown whether or not the page holds it -- with
// the two things a reference list has that a record does not:
//
//   options   a short list arrives whole, as the field's own `options`, and is
//             chosen from in place: no page is asked for and the dropdown's own
//             search is right here, because the list in hand is the whole set.
//             A page is never searched in place -- it is not the whole set.
//   multiple  several values, each {value, label}, written back as a list.
//
// The value is {value, label}, or a list of them, and the control writes the
// same shape back: the label travels with the value so the host never resolves
// what it already knew, and a view of the value needs no second read.
function lookupItems(field, value) {
    const list = Array.isArray(value) ? value : [value];
    const options = Array.isArray(field.options) ? field.options : [];
    return list
        .filter((item) => item !== null && typeof item !== 'undefined' && item !== '')
        .map((item) => {
            if (typeof item === 'object') return {value: item.value, label: String(item.label ?? item.value ?? '')};
            // A bare value is read against the field's own list, so a host that
            // sends the inline options and the value alone is still shown a name.
            const option = options.find((candidate) => String(candidate?.value) === String(item));
            return {value: item, label: String(option?.label ?? option?.text ?? item)};
        });
}

function renderLookupEdit(field, value, host) {
    const multiple = field.multiple === true;
    const inline = Array.isArray(field.options) && field.options.length > 0;
    // A list the host pages needs a host that pages; without one the field falls
    // back to its value, read-only, as a record does.
    if (!inline && (!host.loadFieldOptions || !host.getFieldOptionsPage)) return null;
    // A paged list is the lookup's (C139 (1)); a short list given whole stays
    // the dropdown's, and so does the deprecated dropdown path.
    if (!inline && !dropdownPicker()) {
        if (host.getFieldOptionsPage(field)?.status === 'unsupported') return null;
        return renderHostLookup(field, value, host, {multiple, placeholder: setText(host, 'pickFromList')});
    }

    const page = inline ? null : host.getFieldOptionsPage(field) || null;
    if (page?.status === 'unsupported') return null;
    const search = inline ? '' : host.getFieldOptionSearch?.(field) ?? '';
    const chosen = lookupItems(field, value);
    const candidates = (inline ? field.options : Array.isArray(page?.items) ? page.items : [])
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({value: item.value, label: String(item.label ?? item.text ?? item.value)}));
    const isChosen = (item) => chosen.some((one) => String(one.value) === String(item.value));
    const options = [
        ...chosen.filter((item) => !candidates.some((candidate) => String(candidate.value) === String(item.value))),
        ...candidates,
    ].map((item) => ({
        type: 'text',
        size: '1',
        text: item.label,
        value: String(item.value),
        selected: isChosen(item),
    }));
    // What the dropdown reports is the value as a string; the label and the
    // value's own type are taken back from what was offered.
    const known = [...chosen, ...candidates];
    const resolve = (raw) => {
        const found = known.find((item) => String(item.value) === String(raw));
        return found ? {value: found.value, label: found.label} : {value: raw, label: String(raw)};
    };
    const write = (event) => {
        if (multiple) {
            const next = event.detail?.values ?? event.detail?.value;
            const values = (Array.isArray(next) ? next : next ? [next] : []).filter((item) => item !== '');
            host.setFieldValue(field, values.map(resolve));
            return;
        }
        const next = event.detail?.value ?? null;
        host.setFieldValue(field, next === null || next === '' ? null : resolve(next));
    };

    return html`
        <div class="sf-field-picker flex flex-col gap-1/3" data-field-picker=${field.key || nothing}>
            <sf-dropdown
                    size=${EDIT_SIZE}
                    appearance="bordered"
                    mode="select"
                    ?multiple=${multiple}
                    search="true"
                    name=${fieldName(field)}
                    ?required=${Boolean(field.required)}
                    value=${multiple ? nothing : chosen[0] ? String(chosen[0].value) : ''}
                    placeholder=${field.placeholder || setText(host, 'pickFromList')}
                    search-placeholder=${field.searchPlaceholder || setText(host, 'searchInList')}
                    aria-label=${field.label || field.key || ''}
                    .options=${options}
                    @change=${write}
                    @input=${inline ? nothing : (event) => {
                        const text = event.target?.value ?? '';
                        host.setFieldOptionSearch?.(field, text);
                        host.loadFieldOptions(field, {cursor: null, search: text});
                    }}
            ></sf-dropdown>
            ${page ? html`
                <div class="sf-field-picker-state flex items-cross-center gap-1/3">
                    <div role="status" aria-live="polite" class="sf-text-1">
                        ${page.status === 'loading' && !page.quiet ? setText(host, 'loadingOptions')
                            : page.status === 'error' ? setText(host, 'optionsError') : ''}
                    </div>
                    ${page.status === 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'retry')}
                                @click=${() => host.loadFieldOptions(field, {cursor: null, search})}
                        ></sf-button>
                    ` : nothing}
                    ${page.nextCursor && page.status !== 'error' ? html`
                        <sf-button appearance="outline" size="1" text=${setText(host, 'loadMore')}
                                ?disabled=${page.status === 'loading'}
                                @click=${() => host.loadFieldOptions(field, {cursor: page.nextCursor, search})}
                        ></sf-button>
                    ` : nothing}
                </div>
            ` : nothing}
        </div>
    `;
}

// The `file` edit control, composed from the two halves that already exist:
// sf-file-preview for what is stored, sf-file-upload for what is arriving. They
// are not interchangeable and the split is not cosmetic -- the preview carries
// href, download and remove, the upload zone carries progress, retry and the
// selection itself. Neither renders the other's state, so a field that both
// holds files and accepts new ones needs both.
//
// sf-file-upload transfers no bytes. It selects files, keeps an `items` list of
// {state, progress, name, fileSize, errorMessage}, and emits events; the
// transfer is the host's, which is why this renderer asks the host for it
// rather than inventing an endpoint inside the set:
//
//   host.startFieldUpload(field, items)  -- begin transferring; the host writes
//                                           the stored value when a file lands
//   host.getFieldUploads(field)          -- the items in flight, upload-shaped
//   host.retryFieldUpload(field, index)  -- optional; without it, no retry
//   host.setFieldValue(field, next)      -- as every edit renderer
//
// Without the first two the zone is not rendered at all and the stored files
// stay editable, because removing a file that is already there needs no
// transfer. A zone that cannot upload is worse than no zone.
//
// `items` has one writer, and that is the host. The component fills its own
// list the moment files are chosen, but every render writes the host's list
// over it -- so a host that records what `startFieldUpload` was handed sees the
// files it selected, and a host that ignores them watches its own selection
// disappear on the next render. The selected items arrive already in the
// component's own shape, each carrying the real File in `.file`, so recording
// them is a push and not a conversion.
function storedFiles(value) {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
    return value && typeof value === 'object' ? [value] : [];
}

// One image, edited in place (simai/ui-source#27). A `file` field whose
// variant is `image` and which holds one file -- a logo, a cover, the picture
// of a block -- is what sf-image-field is for: the thumbnail with the name and
// size, «Заменить…», «Убрать», and a file dropped on it replaces the image. The
// preview-and-zone pair below stays for everything else: a field the host
// declares `multiple`, a list that already holds several, the card and list
// variants, and a file that is not an image. Which fields are images is the
// host's to say through the variant, as in the view and the cell.
//
// sf-image-field transfers no bytes either. Its change carries the value in the
// file shape -- a chosen file with the File in `file` and an object URL in
// `href`, null after «Убрать» -- and that goes through setFieldValue as every
// other control's value does, so the record the host holds is what the person
// sees. A host that uploads (startFieldUpload) is handed the File as well, in
// an item carrying it in `.file` as the file control's selection does, and
// writes the stored value with its lasting address when the file lands. A
// value that came as a list of one goes back as a list, so a host reads back
// the shape it sent.
//
// The value is bound as a property, never as the attribute: the attribute is
// JSON, which a File does not survive, and a changed attribute releases the
// object URL the thumbnail is showing. The panel prints the label, so the field
// takes it as its accessible name only.
function isSingleImageField(field, value) {
    return templateOf(field) === 'image' && field.multiple !== true && storedFiles(value).length <= 1;
}

function renderImageEdit(field, value, host) {
    const stored = storedFiles(value)[0] ?? null;
    const asList = Array.isArray(value);
    return html`
        <sf-input-image
                size=${EDIT_SIZE}
                name=${fieldName(field)}
                accept=${field.accept ? String(field.accept) : nothing}
                hint=${field.uploadSupportingText || nothing}
                .value=${stored}
                aria-label=${field.label || field.key || ''}
                ?required=${Boolean(field.required)}
                ?readonly=${field.readonly === true}
                @change=${(event) => {
                    const next = event.detail?.value ?? null;
                    host.setFieldValue(field, asList ? (next ? [next] : []) : next);
                    const file = event.detail?.file;
                    if (file && host.startFieldUpload) {
                        host.startFieldUpload(field, [{name: file.name, state: 'process', progress: 0, file}]);
                    }
                }}
        ></sf-input-image>
    `;
}

function renderFileEdit(field, value, host) {
    if (isSingleImageField(field, value)) return renderImageEdit(field, value, host);
    const files = storedFiles(value);
    const multiple = field.multiple === true || Array.isArray(value);
    const canUpload = Boolean(host.startFieldUpload && host.getFieldUploads);
    const uploads = canUpload ? host.getFieldUploads(field) : null;
    const items = Array.isArray(uploads) ? uploads : [];

    // «×» takes a file out of the field at once, and the notice gives it back
    // with «Вернуть» (decisions C25, C149 (8)): the field's value before the
    // removal is set again.
    const drop = (index) => {
        const before = value;
        const next = files.filter((_, position) => position !== index);
        host.setFieldValue(field, multiple ? next : (next[0] ?? null));
        const removed = files[index];
        globalThis.SF?.notify?.({
            status: 'neutral',
            title: setText(host, 'fileRemoved'),
            text: String(removed?.label ?? removed?.name ?? ''),
            source: 'sf-file-preview',
            action: {label: setText(host, 'undo'), onSelect: () => host.setFieldValue(field, before)},
        });
    };
    const readonly = field.readonly === true;

    // download-action and remove-action both read true when the attribute is
    // absent, so a file with no href has to say false rather than drop it.
    return html`
        <div class="sf-field-file flex flex-col">
            ${files.map((file, index) => html`
                <sf-file-preview
                        file-name=${String(file.label ?? file.name ?? 'File')}
                        file-size=${String(file.size ?? '')}
                        icon=${fileIcon(file.mime ?? file.mimeType)}
                        mime-type=${String(file.mime ?? file.mimeType ?? '')}
                        href=${file.href ? String(file.href) : nothing}
                        download-action=${file.href ? 'true' : 'false'}
                        remove-action=${readonly ? 'false' : 'true'}
                        remove-label=${`${setText(host, 'removeFile')} ${file.label ?? file.name ?? ''}`.trim()}
                        @sf-file-preview-detach=${() => drop(index)}
                ></sf-file-preview>
            `)}

            ${canUpload
                    ? html`
                        <sf-file-upload
                                size=${EDIT_SIZE}
                                name=${fieldName(field)}
                                accept=${String(field.accept ?? '')}
                                formats=${String(field.formats ?? '')}
                                link-text=${field.uploadText || nothing}
                                text=${field.uploadHint || nothing}
                                supporting-text=${field.uploadSupportingText || nothing}
                                ?multiple=${multiple}
                                ?disabled=${field.readonly === true}
                                aria-label=${field.label || field.key || ''}
                                .items=${items}
                                @sf-file-upload:select=${(event) => {
                                    const picked = event.detail?.files;
                                    const list = Array.isArray(picked) ? picked : [];
                                    if (list.length) host.startFieldUpload(field, list);
                                }}
                                @sf-file-upload:retry=${(event) => {
                                    host.retryFieldUpload?.(field, Number(event.detail?.index ?? -1));
                                }}
                        ></sf-file-upload>
                    `
                    : nothing}
        </div>
    `;
}


// The control a field is edited with, or null when the set has none for that
// type yet.
const sizeOption = (options) => (options?.size === '1/2' ? '1/2' : '1');

// `options.density`: 'compact' or 'normal', the density the control is drawn in
// (owner decision C22; form study FM-5). Without it the control follows the
// region it stands in, as every component does; with it the host sets the
// region for this field alone -- a compact panel asks for 'compact' instead of
// shrinking the field with size '1/2', which C22 forbids. Anything else is no
// density at all.
const DENSITIES = new Set(['compact', 'normal']);
const densityOption = (options) => (DENSITIES.has(options?.density) ? options.density : '');

// `options.apply` ('instant' when a change acts at once) chose the yes/no
// control until C303 (4); the field's template chooses it now, and the option
// is accepted and not read.
//
// `options.align`: 'end' for a number edited where numbers stand at the end of
// the line -- a table cell edited in place (C294: a form starts the digits, a
// table ends them). A number, a money amount and a percent are then typed at
// the end of the field with figures of one width, as the column shows them.
let EDIT_ALIGN_END = false;

// A control that stays a control when it may not be changed: a choice as
// buttons shows which button is chosen, which is what it is for, where the
// view's badge would show a different thing (port 1.16.0).
const keepsControlWhenLocked = (asked, field) => asked === 'choice' && isChoiceButtons(field);

// `options.disabled`: the control is drawn disabled, not read-only -- a field a
// condition turns off for now (port 1.14.0 `when.enabled`), which the host
// knows and the field does not carry. Read by the controls that draw the two
// differently; for every other one a disabled field is a read-only one.
let EDIT_DISABLED = false;

// `options.error`: what is wrong with the field now, a sentence, or empty (PD-1,
// property type study «Дата»). A control that says its own error (sf-input-date
// for a date, a datetime and a time) is drawn invalid with the sentence under
// it, the error-message of the field family, so a host that is not sf-form --
// a record card -- marks the field itself instead of writing a line under a
// field with a normal border. sf-form keeps setting invalid on the controls it
// draws, as before.
let EDIT_ERROR = '';

export function renderEditField(field = {}, value, host, options = {}) {
    const asked = resolveField(field).type;
    const disabled = options?.disabled === true;
    // A field the person may not change is shown, not offered as a control that
    // refuses: the same rule for every type, so `readonly` means one thing
    // wherever the registry lists it.
    if ((field.readonly === true || disabled) && VIEW_RENDERERS[asked] && !keepsControlWhenLocked(asked, field)) {
        return renderViewField(field, value, host, options);
    }
    const renderer = EDIT_RENDERERS[asked];
    if (!renderer || !host?.setFieldValue) return null;

    const outer = EDIT_SIZE;
    const outerDisabled = EDIT_DISABLED;
    const outerPicker = EDIT_PICKER;
    const outerAlign = EDIT_ALIGN_END;
    const outerError = EDIT_ERROR;
    EDIT_SIZE = sizeOption(options);
    EDIT_ERROR = typeof options?.error === 'string' ? options.error.trim() : '';
    EDIT_DISABLED = disabled;
    // `options.picker: 'dropdown'`: the record, relation, user and paged lookup
    // fields drawn as before C139, a searchable sf-dropdown (until 2027-01-01).
    EDIT_PICKER = options?.picker === 'dropdown' ? 'dropdown' : '';
    EDIT_ALIGN_END = options?.align === 'end';
    try {
        return inDensity(renderer(field, value, host), densityOption(options));
    } finally {
        EDIT_SIZE = outer;
        EDIT_DISABLED = outerDisabled;
        EDIT_PICKER = outerPicker;
        EDIT_ALIGN_END = outerAlign;
        EDIT_ERROR = outerError;
    }
}

// A density asked for one field is a region around it that draws no box of its
// own: the variables of the density rules (core/scss/_sf_css__density.scss)
// stand on it and every part of the control inherits them, the popups it opens
// read it (core/js/density.js densityOf), and the control lays out in the
// host's flex or grid as if the wrapper were not there. No density, no wrapper:
// what a host had is unchanged.
function inDensity(content, density) {
    if (!density || content == null) return content;
    return html`<div class="sf-field-density" style="display: contents" data-sf-density=${density}>${content}</div>`;
}


// The view template: a field shown and not edited, which is the fourth of the
// four the assignment names and the last one the set was missing.
//
// It renders lit templates rather than the host-shaped values the cell template
// returns, because its consumer is a record view rendering into its own layout,
// exactly as the edit template's is. The cell template returns host shapes only
// because sf-view-table already had a path for those.
//
// `line` and not `size` for everything that sits beside a label on one text
// line -- a badge, a tag, an avatar, a reference link. A size would give those a
// control's height and stand them taller than the words next to them, which is
// the mistake the cell template already avoids one rung down. The two that are
// not inline keep their own scale: a scale bar is a control, and a file preview
// has no visual size at all, its `size` being a legacy name for the file's size
// as text.
// The line a viewed value is drawn on: 1, or 1/2 with {size: '1/2'}, as above.
let VIEW_LINE = '1';

// A scalar may arrive as the value itself or as {value, text}: the data and the
// host's own formatting of it. The consumer asked for the second and they are
// right -- the Framework has no locale and should not acquire one through a field
// renderer. They already hold the localised text, the viewer's locale and the
// format rules, and a second formatter here would disagree with theirs the first
// time a format setting changed. `text` is the formatted value alone; a unit
// stays its own field so a column of numbers can align its units.
function carriesText(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        && typeof value.text === 'string';
}

function scalarValue(value) {
    return carriesText(value) ? value.value : value;
}

function viewText(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    if (typeof formatted === 'string') return formatted;
    if (carriesText(value)) return value.text;
    const plain = scalarValue(value);
    return plain === null || typeof plain === 'undefined' ? '' : String(plain);
}

function renderTextView(field, value, host) {
    const text = viewText(field, value, host);
    return text ? html`<span class="sf-field-view">${text}</span>` : nothing;
}

// Formatted text shown: the value cleaned by sf-input-rich's own rule first,
// and only that cleaned string drawn as markup -- never the value as it came,
// which a host may have stored from anywhere. What is left is the subset:
// paragraphs, headings, emphasis, lists, quotes and links with a safe address.
function renderHtmlView(field, value) {
    const clean = cleanHtml(value);
    return clean ? html`<div class="sf-field-view sf-field-html">${unsafeHTML(clean)}</div>` : nothing;
}

// A number in the page's language (set boundary study, 2026-11-17): «12,5 кг»
// on a Russian page, «12.5 kg» on an English one, through Intl with every
// digit the value has (decimal.js formatDecimal, never through a float on the
// way). The host's formatFieldValue and a value's own text still win; what is
// not a number is shown as it came.
function numberText(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    if (typeof formatted === 'string') return formatted;
    if (carriesText(value)) return value.text;
    return formatDecimal(scalarValue(value), pageLocale(host ?? null)) || viewText(field, value, null);
}

// A number carries its unit when the field declares one, and nothing when it
// does not -- the set does not guess at a unit, and «42» with an invented «шт»
// beside it is a worse answer than «42».
function renderNumberView(field, value, host) {
    if (value === null || typeof value === 'undefined' || value === '') return nothing;
    const variant = templateOf(field);
    // The scale needs the number, not the host's text for it.
    const number = Number(scalarValue(value));

    if (variant === 'scale' && Number.isFinite(number) && number >= 0 && number <= 100) {
        return html`<sf-progress-scale size="1" value=${String(number)}></sf-progress-scale>`;
    }
    if (variant === 'meter' && Number.isFinite(number) && number >= 0 && number <= 100) {
        const {label} = meterProps(field, number);
        return html`<sf-progress-bar inline meter value=${String(number)} label=${label || nothing}></sf-progress-bar>`;
    }

    const text = numberText(field, value, host);
    return html`<span class="sf-field-view">${field.unit ? `${text} ${field.unit}` : text}</span>`;
}

// A date is the host's to format first: formatFieldValue wins, and so does a
// value that carries its own text. Without it the set used to print the stored
// form -- «2026-10-25T10:30:00+03:00» (simai/ui-source#34) -- so a host that
// formats nothing gets the page's medium reading through core format-date:
// «2 нояб. 2026 г.» / «Nov 2, 2026» for a date, «15 нояб. 2026 г., 10:30» /
// «Nov 15, 2026, 10:30 AM» for a datetime, the form the View set's table
// printed before the renderers formatted dates (C19: the set formats, the
// table inherits). The day and the clock are the record's own (datetime.js
// reads them as written, in the host's zone): nothing is moved to the reader's
// time zone, which would show a different day near midnight. A value that is
// not a date at all is shown as it came, never guessed at.
//
// `format` is the field's display setting (PD-3): the length of the date,
// Intl's dateStyle in the page's language -- short «17.11.2026» / «11/17/26»,
// medium (the default) «17 нояб. 2026 г.» / «Nov 17, 2026», long «17 ноября
// 2026 г.» / «November 17, 2026», full with the weekday. A datetime keeps its
// clock beside it. It is read by the view and the cell; the edit control
// types the locale's digits whatever it says. Any other value is medium, and
// the host's formatFieldValue or text still wins.
const DATE_FORMATS = new Set(['short', 'medium', 'long', 'full']);

function dateFormatOf(field) {
    const format = String(field?.format ?? '').trim();
    return DATE_FORMATS.has(format) ? format : 'medium';
}

function defaultDateText(field, value, host) {
    if (carriesText(value)) return null;
    const parts = readDateTime(value);
    if (!parts.known || !parts.date) return null;
    const [year, month, day] = parts.date.split('-').map(Number);
    const locale = pageLocale(host ?? null);
    try {
        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);
        const type = field?.propertyType || field?.type || field?.dataType;
        const dateStyle = dateFormatOf(field);
        if (type !== 'datetime' || !parts.time) return formatDate(date, {intl: {dateStyle, timeZone: 'UTC'}, locale}) || null;
        const [hours, minutes] = parts.time.split(':').map(Number);
        date.setUTCHours(hours, minutes, 0, 0);
        return formatDate(date, {intl: {dateStyle, timeStyle: 'short', timeZone: 'UTC'}, locale}) || null;
    } catch {
        return null;
    }
}

function dateText(field, value, host) {
    const formatted = host?.formatFieldValue?.(field, value);
    if (typeof formatted === 'string') return formatted;
    return defaultDateText(field, value, host) ?? viewText(field, value, null);
}

// The machine reading of a date (C40: every moment the Framework prints is a
// time element): the record's own day and clock as written, «2026-11-15» or
// «2026-11-15T10:30», with no zone, because the view never moves a record to
// the reader's zone. That is also why the view is not sf-time, which reads a
// moment in the reader's zone: a date near midnight would show another day.
// '' when the value is no date.
export function dateTimeAttribute(field, value) {
    const parts = readDateTime(value);
    if (!parts.known || !parts.date) return '';
    const type = field?.propertyType || field?.type || field?.dataType;
    return type === 'datetime' && parts.time ? `${parts.date}T${parts.time}` : parts.date;
}

function renderDateView(field, value, host) {
    const text = dateText(field, value, host);
    if (!text) return nothing;
    const datetime = dateTimeAttribute(field, value);
    return datetime
        ? html`<time class="sf-field-view" datetime=${datetime}>${text}</time>`
        : html`<span class="sf-field-view">${text}</span>`;
}

function renderBooleanView(field, value, host) {
    if (typeof value !== 'boolean') return nothing;
    const words = booleanWords(field, host);
    return html`<span class="sf-field-view">${value ? words.yes : words.no}</span>`;
}

function renderChoiceView(field, value) {
    const options = field.options || field.filter?.options || field.constraints?.options;
    const option = Array.isArray(options)
        ? options.find((item) => String(item?.value) === String(value))
        : null;
    if (!option) return nothing;
    const badge = optionBadgeProps(option);

    // A table cell is a dense place: the badge keeps the tight side room
    // (sf-badge tight), as it had before sf-badge 1.3.0 widened the default.
    return html`
        <sf-badge
                line=${VIEW_LINE}
                tight
                appearance=${badgeAppearanceOf(field)}
                scheme=${badge.scheme}
                style=${badge.rootStyle || nothing}
                text=${String(option.label ?? option.text ?? value)}
        ></sf-badge>
    `;
}

// The values wrap, each tag as wide as its text: on one unwrapping line a
// role's 137 rights shrank every tag to a letter and the text ran down the
// panel (Larena, 2026-10-17). The tag's painted root is the flex item (the
// host is display: contents), so it is told not to shrink through root-class.
// No disclosure for a long list here: a record's
// field in view is the button that opens its group, and a control inside a
// button is not one.
// Tags and badges of one value stand 4 apart (C105 H5 tags, --sf-space-1/4;
// FW-3: they stood 8, the buttons' gap). The badges template draws each value
// as its option's badge, in the option's colour, as the cell does.
function renderChoicesView(field, value) {
    if (!Array.isArray(value) || !value.length) return nothing;
    const options = field.options || field.filter?.options || field.constraints?.options;
    const optionOf = (item) => (Array.isArray(options)
        ? options.find((candidate) => String(candidate?.value) === String(item && typeof item === 'object' ? item.value : item))
        : null);
    const label = (item) => {
        const option = optionOf(item);
        if (item && typeof item === 'object' && item.text !== undefined) return String(item.text);
        return String(option?.label ?? option?.text ?? (item && typeof item === 'object' ? item.value : item));
    };
    const badges = templateOf(field) === 'badges';

    return html`
        <span class="sf-field-view flex flex-wrap items-cross-center gap-1/4 min-w-0">
            ${value.map((item) => {
                if (!badges) return html`<sf-tag root-class="flex-none" line=${VIEW_LINE} kind="default" text=${label(item)}></sf-tag>`;
                const option = optionOf(item);
                const badge = option ? optionBadgeProps(option) : null;
                return html`<sf-badge line=${VIEW_LINE} tight appearance=${badgeAppearanceOf(field)}
                        scheme=${badge?.scheme || nothing} style=${badge?.rootStyle || nothing} text=${label(item)}></sf-badge>`;
            })}
        </span>
    `;
}

// A person, as in a cell: the name links to the person when the host gives
// the href -- every value that points at a record opens it (owner,
// 2026-10-14). Plain, as a reference read in a record's field is.
function renderUserView(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return nothing;

    return html`
        <span class="sf-field-view flex items-cross-center gap-1/3">
            <sf-avatar line=${VIEW_LINE} text=${value.avatarText || ''} heading=${String(value.label)}></sf-avatar>
            ${value.href
                ? html`<sf-reference-link appearance="plain" icon="" line=${VIEW_LINE}
                        label=${String(value.label)} href=${String(value.href)}></sf-reference-link>`
                : html`<span>${String(value.label)}</span>`}
        </span>
    `;
}

function renderReferenceView(field, value) {
    if (!value || typeof value !== 'object' || !value.label) return nothing;

    // Plain, and without the arrow: a reference read inside a record's field is
    // a value on a line, not a card. The card's frame and fill drew a second box
    // around a value that already sits in one, and the arrow said «go» beside a
    // word that is already a link (owner, 2026-10-08).
    return html`
        <sf-reference-link
                appearance="plain"
                icon=""
                line=${VIEW_LINE}
                label=${String(value.label)}
                href=${value.href ? String(value.href) : nothing}
        ></sf-reference-link>
    `;
}

// A value from a reference list reads as its label; several read as their
// labels, each a tag as a list of choices does. Not a link: nothing opens from a
// country or a status.
function renderLookupView(field, value) {
    const items = lookupItems(field, value);
    if (!items.length) return nothing;
    if (items.length === 1 && field.multiple !== true) return html`<span class="sf-field-view">${items[0].label}</span>`;

    return html`
        <span class="sf-field-view flex flex-wrap items-cross-center gap-1/3 min-w-0">
            ${items.map((item) => html`<sf-tag root-class="flex-none" line=${VIEW_LINE} kind="default" text=${item.label}></sf-tag>`)}
        </span>
    `;
}

// The one place the view template is not a smaller edit control: a stored file
// is shown with its own preview, which carries the download the view wants and
// not the remove an edit does.
function renderFileView(field, value) {
    const files = storedFiles(value);
    if (!files.length) return nothing;

    // An image is shown as the image. `image-url` and `kind` are inputs the file
    // preview already has, so this is the same component told what it is holding
    // rather than a second way of drawing a file. Which files are images is the
    // host's to say through the variant: guessing from a file name would be wrong
    // for every stored file whose name does not end in a familiar three letters.
    const asImage = isImageField(field);
    const card = templateOf(field) === 'image_card';

    return html`
        <span class="sf-field-view flex ${card ? 'flex-row' : 'flex-col'} gap-1/3">
            ${files.map((file) => html`
                <sf-file-preview
                        file-name=${String(file.label ?? file.name ?? 'File')}
                        file-size=${String(file.size ?? '')}
                        icon=${fileIcon(file.mime ?? file.mimeType)}
                        mime-type=${String(file.mime ?? file.mimeType ?? '')}
                        href=${file.href ? String(file.href) : nothing}
                        image-url=${asImage && file.href ? String(file.href) : nothing}
                        kind=${asImage ? 'image' : nothing}
                        download-action=${file.href ? 'true' : 'false'}
                        remove-action="false"
                ></sf-file-preview>
            `)}
        </span>
    `;
}

const VIEW_RENDERERS = {
    string: renderStringView,
    phone: renderPhoneView,
    password: renderPasswordView,
    text: renderTextView,
    html: renderHtmlView,
    number: renderNumberView,
    date: renderDateView,
    datetime: renderDateView,
    time: renderDateView,
    boolean: renderBooleanView,
    choice: renderChoiceView,
    choices: renderChoicesView,
    user: renderUserView,
    record: renderReferenceView,
    relation: renderReferenceView,
    lookup: renderLookupView,
    file: renderFileView,
    color: renderColorView,
    include: renderIncludeView,
    money: renderMoneyView,
    percent: renderPercentView,
};

// A field shown rather than edited. `host` is optional and used for one thing
// only -- formatFieldValue, where a consumer's own formatting of a number or a
// date belongs. Null when the set has no view for that type.
// A column total (owner decision C294, MP-12): the table owns its totals
// row, the set gives the sum by the digits and its display. Money is summed
// per currency -- a column of dollars and euros is two lines, never one
// number -- and a number or an integer is one sum; a percent, a choice or a
// text has no total (null). `values` are the column's stored values; what is
// not a number is left out.
export function renderTotalField(field = {}, values = [], host) {
    const type = resolveField(field).type;
    const locale = pageLocale(host ?? null);
    const list = (Array.isArray(values) ? values : []).map((value) => scalarValue(value));
    if (type === 'money') {
        const totals = moneyTotals(list, field, locale);
        return totals.length ? totals.map((total) => total.text) : null;
    }
    if (type !== 'number') return null;
    const numbers = list.filter((value) => value !== null && value !== undefined && value !== '' && readTypedDecimal(value).ok);
    if (!numbers.length) return null;
    const sum = addDecimal(numbers);
    return sum === null ? null : [formatDecimal(sum, locale)];
}

// Whether a type is a number a table aligns to the end of the line with
// figures of one width (the registry's `numeric`, C294 MP-12).
export function isNumericType(type) {
    return Boolean(typeEntry(type)?.numeric);
}

// A former type name (integer, compound) has the modes of the type it reads as.
export function propertyModes(type) {
    const own = TYPE_ALIASES[type]?.type ?? type;
    return modesOf(own, {view: VIEW_RENDERERS, edit: EDIT_RENDERERS, cell: CELL_RENDERERS, filter: FILTER_RENDERERS});
}

// What a field is drawn with (C302): {type, template, params} -- the type
// after its former names, the template the field names when the type has it
// and the field fits it (else the default), and the templateParams. A host
// that offers a template switch reads it to show the template drawn.
export function fieldTemplate(field = {}) {
    const {type, template, params} = resolveField(field);
    return {type, template, params};
}

export {PROPERTY_TYPES};

export function renderViewField(field = {}, value, host, options = {}) {
    const asked = resolveField(field).type;
    const renderer = VIEW_RENDERERS[asked];
    if (!renderer) return null;

    const outer = VIEW_LINE;
    VIEW_LINE = sizeOption(options);
    try {
        return inDensity(renderer(field, value, host), densityOption(options));
    } finally {
        VIEW_LINE = outer;
    }
}


// A host has to be able to reach the set, and a module is not an element: there
// is no tag to place and no attribute to set. The Framework already has one
// place for what a page may call -- window.SF, where the base element, `html`,
// `nothing` and `render` live -- so the set publishes itself there under its own
// name. Without this the module is built, bundled and unreachable: the consumer
// could read the mapping and not call it, which was true of this set until now.
//
// This is the runtime half of the discoverability question. The other half --
// describing the module in the registry, so a host learns what it offers without
// reading our source -- is with the registry's owner.
if (typeof window !== 'undefined') {
    window.SF = window.SF || {};
    window.SF.fieldRenderers = {
        ...(window.SF.fieldRenderers || {}),
        renderCellField,
        renderEditField,
        renderFilterField,
        renderViewField,
        renderTotalField,
        FILTER_RENDERERS,
        // The nine number conditions in the filter's order (C294).
        NUMBER_FILTER_OPERATORS,
        isNumericType,
        // Decimal strings as the set reads and shows them (C294): the View
        // set's items, compound and ru.requisites call these instead of
        // keeping a copy. format(value), money(value, field), percent(value)
        // take a locale (the page's when absent); read(text, {locale,
        // currency}) reads what a person typed or pasted; add(...values) and
        // compare(a, b) work by the digits; totals(values, field) sums money
        // per currency; currency(code, locale, display) is {sign, before, minor}.
        decimal: {
            format: (value, locale) => formatDecimal(value, locale || pageLocale(null)),
            money: (value, field = {}, locale) => formatMoney(value, field, locale || pageLocale(null)),
            percent: (value, locale) => formatPercent(value, locale || pageLocale(null)),
            read: (text, options = {}) => readTypedDecimal(text, {locale: pageLocale(null), ...options}),
            add: addDecimal,
            compare: compareDecimal,
            totals: (values, field = {}, locale) => moneyTotals(values, field, locale || pageLocale(null)),
            currency: (code, locale, display) => currencyOf(code, locale || pageLocale(null), display),
        },
        // The date filter's rules (C293): the chip's words, when an entry is
        // empty, the request with its context, a period's days.
        dateFilter: {
            conditions: dateFilterConditions,
            chipText: dateFilterChipText,
            isEmptyEntry: isEmptyFilterEntry,
            normalizeEntry: normalizeFilterEntry,
            requestContext: filterRequestContext,
            buildRequest: buildFilterRequest,
            resolvePeriod: resolveDatePeriod,
            periods: DATE_PERIODS,
            futurePeriods: DATE_FUTURE_PERIODS,
        },
        // A datetime's value read and written back, for a host that draws its
        // own control: split(value), compose(stored, {date, time}),
        // normalizeTime(text); and a time of day's: splitTime(value),
        // composeTime(stored, text).
        dateTime: {split: readDateTime, compose: composeDateTime, normalizeTime, splitTime, composeTime},
        // The universal properties, each with the modes the set draws for it
        // and its templates, the default first (C302).
        registry: PROPERTY_TYPES.map((entry) => ({...entry, modes: propertyModes(entry.type)})),
        // C302, C303: the four places a template draws in; the former type and
        // template names read until 2027-01-01; what a field is drawn with.
        places: PLACES,
        aliases: {types: TYPE_ALIASES, templates: TEMPLATE_ALIASES},
        fieldTemplate,
    };
    // SF.whenFieldRenderers() settles on this, whichever bundle published the set.
    globalThis.document?.dispatchEvent?.(new CustomEvent('sf-field-renderers-ready'));
}
