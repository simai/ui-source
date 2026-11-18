// The registry of universal properties (owner, 2026-10-15): every property
// type the Framework renders, or a component set renders beside it (`set`),
// its variants and the parameters a field of it reads -- one list a host
// (Larena's fields and settings), the property workbench and the documentation
// read, instead of each learning the types from the renderers' source. Which
// modes a type has is not written here: it is read from the renderer maps
// themselves (modesOf), so the registry cannot claim a mode the set does not
// draw. A contract keeps the two the same.
//
// `params` are the field keys the type's renderers read -- each one, and no
// other (the probe field-renderer-params calls them with a field that records
// what is read). A record, a relation and a user hold one value and take their
// candidates from the host, not from `options`; a constraint other than a
// choice's options is the host's to enforce, not a renderer's.

// The names of the types and variants live in the set's language files
// (localization study LC-5); `label` keeps its {ru, en} shape for the hosts
// that read it. English is built in; the Russian name is read from the words
// the ru language file registered for sf-field-renderers (owner decision
// C282), English until it is on the page.
import LANG_WORDS from './lang/index.mjs';

const registeredName = (code, key) => globalThis.__sfPageLanguage?.registered?.get?.('sf-field-renderers')?.get?.(code)?.[key];
const typeLabel = (key) => Object.freeze(Object.defineProperties({}, {
    ru: {enumerable: true, get: () => LANG_WORDS.ru?.[key] ?? registeredName('ru', key) ?? LANG_WORDS.en[key]},
    en: {enumerable: true, value: LANG_WORDS.en[key]},
}));

// Owner decisions C302 and C303 (2026-11-17; catalogue: ui-control research
// 2026-11-17-type-template-catalogue): a type stores and checks the value, a
// template only draws it and never changes the data. Each type lists the
// templates the Framework draws, the default first; a template says which of
// the four places it changes -- view (Показ), compact (Кратко, the table cell
// and the cards), edit (Правка), filter (Фильтр) -- and the template
// parameters (`templateParams`) it reads. A field names one template with
// `template`; without it, or with one the type does not have, the default
// draws (templates.js resolveField). `variants` is the former list of the
// non-default templates under their former ids, kept for hosts that read it
// until 2027-01-01.
//
// C303: a type of its own only where storage, checking or filter conditions
// differ; a setting fixed when the field is created is part of the type
// (`decimals` of a number, 0 for a whole one; `multiple`). integer is read as
// number with decimals 0, compound as complex, a string with variant phone or
// password as the phone or password type, until 2027-01-01 (TYPE_ALIASES).
export const PLACES = Object.freeze(['view', 'compact', 'edit', 'filter']);
const ALL_PLACES = PLACES;

// The filter place's conditions (step 4 of the catalogue): a type whose
// filter is a condition first and then what the condition needs lists the
// operators in the list's order and the one shown before any is chosen.
// What travels is {operator, value}. A type without `conditions` is filtered
// by its options (a choice, a user) or searched as text.
//
//   date, datetime   owner decision C293 (date-filter.js): a day, two days,
//                    a period by name, a number of days, empty / not empty;
//                    a deadline field (filter.future: true) adds `future`
//   time             a time of day «hh:mm», two of them (both ends in),
//                    earlier, later, empty / not empty
//   number, money, percent   owner decision C294: the nine number conditions
//   password         set (not-empty) or not set (empty), value true
export const DATE_FILTER_OPERATORS = Object.freeze(['eq', 'between', 'lt', 'gt', 'gte', 'lte', 'period', 'last-days', 'empty', 'not-empty']);
export const DATE_FUTURE_OPERATORS = Object.freeze(['next-days']);
export const TIME_FILTER_OPERATORS = Object.freeze(['eq', 'between', 'lt', 'gt', 'empty', 'not-empty']);
export const NUMBER_FILTER_OPERATORS = Object.freeze(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty']);
const conditions = (operators, byDefault, extra = {}) => Object.freeze({operators, default: byDefault, ...extra});
const DATE_CONDITIONS = conditions(DATE_FILTER_OPERATORS, 'between', {future: DATE_FUTURE_OPERATORS});
const NUMBER_CONDITIONS = conditions(NUMBER_FILTER_OPERATORS, 'eq');

const template = (type, id, {places = ALL_PLACES, params = [], fits = '', legacy = null, isDefault = false} = {}) => Object.freeze({
    id,
    label: typeLabel(`template-${type}-${id}`),
    default: isDefault,
    places: Object.freeze([...places]),
    params: Object.freeze([...params]),
    ...(fits ? {fits} : {}),
    ...(legacy ? {legacy} : {}),
});
const byDefault = (type, id, options = {}) => template(type, id, {...options, isDefault: true});

// The former variant list: the non-default templates under the id a host sent
// as `variant` (image-card for image_card), until 2027-01-01.
const variantsOf = (type, templates) => templates.filter((one) => !one.default)
    .map((one) => Object.freeze({id: one.legacy ?? one.id, label: typeLabel(`variant-${type}-${one.legacy ?? one.id}`)}));

const entry = (spec) => {
    const templates = Object.freeze(spec.templates);
    return Object.freeze({...spec, templates, variants: Object.freeze(spec.variants ?? variantsOf(spec.type, templates))});
};

export const PROPERTY_TYPES = Object.freeze([
    // mask (property-view port 1.16.0): the Framework mask grammar of
    // sf-input's mask-pattern; the value is the text as shown, fixed parts
    // included, and an incomplete one is reported, not written as a value.
    // nullable: false makes a cleared masked field write "" instead of null.
    entry({type: 'string', label: typeLabel('type-string'),
        templates: [byDefault('string', 'input')],
        params: ['placeholder', 'mask', 'nullable', 'required', 'readonly']}),
    // phone (C302 (1)): the number in E.164, «+79161234567», an extension
    // after «;ext=». defaultCountry (FL-7): the country an empty field starts
    // on, ISO 3166 alpha-2; without it, the page's.
    entry({type: 'phone', label: typeLabel('type-phone'),
        templates: [byDefault('phone', 'phone_input')],
        params: ['defaultCountry', 'required', 'readonly']}),
    // password (C302 (1)): write-only. The host never sends the password; the
    // value it sends is {set: true} or {set: false} (null reads as not set),
    // and the set shows only «задан»/«не задан». An edit writes the typed text
    // through setFieldValue and writes nothing for a field nobody typed in.
    entry({type: 'password', label: typeLabel('type-password'), writeOnly: true,
        templates: [byDefault('password', 'input')],
        conditions: conditions(Object.freeze(['not-empty', 'empty']), 'not-empty'),
        params: ['placeholder', 'required', 'readonly']}),
    // url, link and ru.inn (catalogue step 3): types Larena stores and checks
    // (url@1, link@1, ru.inn@1) that the Framework drew as strings. url is an
    // absolute http(s) address, at most 2048 bytes, without a login in it;
    // link is {href, text?}, href an http(s) address, a path from the site's
    // root or an #anchor; ru.inn is 10 digits (an organisation) or 12 (a
    // person) with the tax service's check digits, `holder` (any,
    // organization, person) fixed when the field is created. The rules are
    // text-types.js; each is searched as text in the filter.
    entry({type: 'url', label: typeLabel('type-url'),
        templates: [byDefault('url', 'input')],
        params: ['placeholder', 'required', 'readonly']}),
    entry({type: 'link', label: typeLabel('type-link'),
        templates: [byDefault('link', 'link')],
        params: ['required', 'readonly']}),
    entry({type: 'ru.inn', label: typeLabel('type-ru.inn'),
        templates: [byDefault('ru.inn', 'input')],
        params: ['holder', 'placeholder', 'required', 'readonly']}),
    entry({type: 'text', label: typeLabel('type-text'),
        templates: [byDefault('text', 'textarea', {params: ['rows']})],
        params: ['placeholder', 'required', 'readonly']}),
    // html (property-view port 1.17.0): formatted text, an HTML string of
    // sf-input-rich's subset. Edited with sf-input-rich, shown cleaned by that
    // component's own rule, a cell its text on one line, filtered as text.
    entry({type: 'html', label: typeLabel('type-html'),
        templates: [byDefault('html', 'editor')],
        params: ['placeholder', 'required', 'readonly']}),
    // number (C303 (2)): one type; `decimals` is fixed when the field is
    // created, 0 for a whole number (integer reads as number with decimals 0).
    // stepper: sf-input-quantity, «−» and «+» and the arrow keys; min, max and
    // step are read by it. scale and meter: a value 0..100, the level scale
    // and the share of a limit (C203 (5)); they fit a field whose bounds, when
    // it declares them, are 0 and 100.
    // numeric (C294, MP-12): a number a table aligns to the end of the line
    // with figures of one width -- number, money and percent.
    entry({type: 'number', label: typeLabel('type-number'), numeric: true,
        templates: [
            byDefault('number', 'input'),
            template('number', 'stepper', {places: ['edit']}),
            template('number', 'scale', {places: ['view', 'compact'], fits: 'bounds-0-100'}),
            template('number', 'meter', {places: ['view', 'compact'], fits: 'bounds-0-100'}),
        ],
        conditions: NUMBER_CONDITIONS,
        params: ['decimals', 'unit', 'min', 'max', 'step', 'precision', 'required', 'readonly']}),
    // date (PD-2, PD-3): min and max bound the day, an ISO date (the day of a
    // date and time is read); format is the length the view and the cell print
    // the date in, Intl's dateStyle: short, medium (the default), long, full.
    entry({type: 'date', label: typeLabel('type-date'),
        templates: [byDefault('date', 'datepicker')],
        conditions: DATE_CONDITIONS,
        params: ['min', 'max', 'format', 'required', 'readonly']}),
    // datetime and time: sf-input-date in mode datetime and time (1.4.0). min
    // and max bound the value -- an ISO date or date and time for a datetime,
    // hh:mm for a time -- and step is the minute step, 1 to 60. A datetime's
    // format is its date's length, as a date's; the clock stays short.
    entry({type: 'datetime', label: typeLabel('type-datetime'),
        templates: [byDefault('datetime', 'datepicker')],
        conditions: DATE_CONDITIONS,
        params: ['min', 'max', 'step', 'format', 'required', 'readonly']}),
    // time (step 4): its own conditions, not a text search -- «Равно»,
    // «Между» (both ends in), «Раньше», «Позже», «Пусто», «Не пусто».
    entry({type: 'time', label: typeLabel('type-time'),
        templates: [byDefault('time', 'timepicker')],
        conditions: conditions(TIME_FILTER_OPERATORS, 'between'),
        params: ['min', 'max', 'step', 'required', 'readonly']}),
    // boolean (C303 (4)): the switch is the default; the checkbox, and the
    // buttons «Да» | «Нет» where «not set» differs from «no», are templates
    // the administrator picks. trueText and falseText are the words of every
    // template's view, cell and buttons.
    entry({type: 'boolean', label: typeLabel('type-boolean'),
        templates: [
            byDefault('boolean', 'switch', {params: ['trueText', 'falseText']}),
            template('boolean', 'checkbox', {places: ['edit']}),
            template('boolean', 'buttons', {places: ['edit']}),
        ],
        variants: [],
        params: ['trueText', 'falseText', 'required', 'readonly']}),
    // buttons (property-view port 1.16.0): one segmented button group, a
    // button per option, sized by `size` on the ladder ("1/2", "1", "2"; absent,
    // the field's); it wraps when the buttons do not fit; pressing the chosen
    // one again clears a field that is not required. badge: the look of the
    // value's badge, tonal (default) or outline.
    entry({type: 'choice', label: typeLabel('type-choice'),
        templates: [
            byDefault('choice', 'dropdown', {params: ['badge']}),
            template('choice', 'buttons', {places: ['edit'], params: ['size']}),
        ],
        params: ['options', 'required', 'readonly']}),
    // choices: the dropdown is the default, and a list of 13 options or more
    // is a checklist under it; checklist asks for the checklist at any length;
    // badges draws the values as badges in their options' colours.
    entry({type: 'choices', label: typeLabel('type-choices'),
        templates: [
            byDefault('choices', 'dropdown', {params: ['badge'], legacy: 'select'}),
            template('choices', 'checklist', {places: ['edit']}),
            template('choices', 'badges', {places: ['view', 'compact'], params: ['badge']}),
        ],
        variants: [{id: 'badges', label: typeLabel('variant-choices-badges')},
            {id: 'checklist', label: typeLabel('variant-choices-checklist')},
            {id: 'select', label: typeLabel('variant-choices-select')}],
        params: ['options', 'required', 'readonly']}),
    entry({type: 'user', label: typeLabel('type-user'),
        templates: [byDefault('user', 'reference_picker')],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']}),
    entry({type: 'record', label: typeLabel('type-record'),
        templates: [byDefault('record', 'reference_picker')],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']}),
    entry({type: 'relation', label: typeLabel('type-relation'),
        templates: [byDefault('relation', 'reference_picker')],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']}),
    // lookup: a value chosen from a reference list the host keeps -- a country,
    // a status, a contract type (Larena, 2026-10-23). It is not a record: the
    // value is {value, label} and nothing opens from it. Small lists arrive as
    // `options` and are chosen from in place; anything larger is paged and
    // searched by the host, from the source the field names (`source`, which the
    // host reads and no renderer does).
    entry({type: 'lookup', label: typeLabel('type-lookup'),
        templates: [byDefault('lookup', 'source_picker')],
        params: ['options', 'multiple', 'placeholder', 'searchPlaceholder', 'required', 'readonly']}),
    // file: image, image_card and image_list are the same stored file drawn as
    // a picture (image-card and image-list are their former ids until
    // 2027-01-01). required: read by the image template alone, whose control
    // is sf-input-image -- a required, empty one keeps its form from submitting.
    entry({type: 'file', label: typeLabel('type-file'),
        templates: [
            byDefault('file', 'upload'),
            template('file', 'image', {places: ['view', 'compact', 'edit']}),
            template('file', 'image_card', {places: ['view', 'compact'], legacy: 'image-card'}),
            template('file', 'image_list', {places: ['view', 'compact'], legacy: 'image-list'}),
        ],
        params: ['accept', 'multiple', 'formats', 'uploadText', 'uploadSupportingText', 'uploadHint', 'required', 'readonly']}),
    entry({type: 'color', label: typeLabel('type-color'),
        templates: [byDefault('color', 'color_picker', {params: ['swatches']})],
        params: ['required', 'readonly']}),
    // include: code the host keeps in a file; `script` is the default (the
    // catalogue's decision), language and rows its template parameters.
    entry({type: 'include', label: typeLabel('type-include'),
        templates: [byDefault('include', 'script', {params: ['language', 'rows']})],
        params: ['required', 'readonly']}),
    // money and percent (owner decisions C291 (2) and C294, 2026-11-17): the
    // Framework's in every mode -- view, cell, edit and filter. Every number
    // is a decimal string, never a float. money is {amount, currency}:
    // `currency` fixes an ISO 4217 code (a bare amount is then read in it, and
    // no currency is offered); `currencies` lists the codes a value may carry
    // (absent: every ISO 4217 code, with a search); `currencyDisplay` is how
    // the currency is written -- symbol (default: «₽», «$», «CA$»), code or
    // name; the digits after the point are at most the currency's minor units
    // (more is a field error, never rounded); min and max bound the amount.
    // percent is the percent ("12.5" is 12,5 %), bounded only by min and max;
    // its digits after the point are `decimals` (`precision`, its former
    // name), else those of `step`.
    entry({type: 'money', label: typeLabel('type-money'), numeric: true,
        templates: [byDefault('money', 'money_input')],
        conditions: NUMBER_CONDITIONS,
        params: ['currency', 'currencies', 'currencyDisplay', 'min', 'max', 'placeholder', 'required', 'readonly']}),
    // percent (step 5): the number's templates -- stepper, scale and meter,
    // the last two for a percent 0..100 (a growth of 150 % keeps the input).
    // It had no former variants.
    entry({type: 'percent', label: typeLabel('type-percent'), numeric: true,
        templates: [
            byDefault('percent', 'input'),
            template('percent', 'stepper', {places: ['edit']}),
            template('percent', 'scale', {places: ['view', 'compact'], fits: 'bounds-0-100'}),
            template('percent', 'meter', {places: ['view', 'compact'], fits: 'bounds-0-100'}),
        ],
        variants: [],
        conditions: NUMBER_CONDITIONS,
        params: ['decimals', 'min', 'max', 'step', 'precision', 'placeholder', 'required', 'readonly']}),
    // The types a component set draws (property-view port 1.18.0; Larena
    // property types standard, notes of 2026-11-03): `set` names the set whose
    // components show and edit them -- the View set's sf-view-properties -- and
    // the Framework draws their table cells and filters (items by its number
    // of rows). `params` are the keys the type reads, in the set's renderers
    // and in these. complex is the former compound (the Bitrix name, C302
    // catalogue), read under that name until 2027-01-01.
    entry({type: 'items', label: typeLabel('type-items'), set: 'view',
        templates: [byDefault('items', 'rows')],
        params: ['columns', 'minRows', 'maxRows', 'required', 'readonly']}),
    entry({type: 'complex', label: typeLabel('type-complex'), set: 'view',
        templates: [byDefault('complex', 'parts')],
        params: ['parts', 'required', 'readonly']}),
    entry({type: 'ru.requisites', label: typeLabel('type-ru.requisites'), set: 'view',
        templates: [byDefault('ru.requisites', 'requisites')],
        params: ['parts', 'required', 'readonly']}),
]);

// Former names, read until 2027-01-01 with one console warning each (C302
// (3), C303 (2)). A type alias may carry the settings it stands for.
export const ALIASES_UNTIL = '2027-01-01';
export const TYPE_ALIASES = Object.freeze({
    integer: Object.freeze({type: 'number', settings: Object.freeze({decimals: 0})}),
    compound: Object.freeze({type: 'complex', settings: Object.freeze({})}),
});
// A string with one of these variants is that type.
export const STRING_VARIANT_TYPES = Object.freeze({phone: 'phone', password: 'password'});
// Former template ids per type: the variant names hosts sent.
export const TEMPLATE_ALIASES = Object.freeze(Object.fromEntries(PROPERTY_TYPES
    .map((one) => [one.type, Object.fromEntries(one.templates.filter((item) => item.legacy).map((item) => [item.legacy, item.id]))])
    .filter(([, map]) => Object.keys(map).length)));

// The modes a type has, read from the renderer maps: view and edit (a record),
// cell (a table) and filter -- `own` when the set has a filter control for the
// type, `text` when a filter falls back to a text search.
export function modesOf(type, maps) {
    return {
        view: Boolean(maps.view?.[type]),
        edit: Boolean(maps.edit?.[type]),
        cell: maps.cell?.[type] ? 'own' : 'text',
        filter: maps.filter?.[type] ? 'own' : 'text',
    };
}
