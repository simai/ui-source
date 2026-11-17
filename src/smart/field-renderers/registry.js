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

export const PROPERTY_TYPES = Object.freeze([
    {type: 'string', label: typeLabel('type-string'),
        // password: write-only. The host never sends the password; the value it
        // sends is {set: true} or {set: false} (null reads as not set), and the
        // set shows only «задан»/«не задан». An edit writes the typed text through
        // setFieldValue and writes nothing for a field nobody typed in.
        variants: [{id: 'phone', label: typeLabel('variant-string-phone')},
            {id: 'password', label: typeLabel('variant-string-password'), writeOnly: true}],
        // mask (property-view port 1.16.0): the Framework mask grammar of
        // sf-input's mask-pattern; the value is the text as shown, fixed parts
        // included, and an incomplete one is reported, not written as a value.
        // nullable: false makes a cleared masked field write "" instead of null.
        // Read by the plain string alone: phone and password keep their controls.
        // defaultCountry (FL-7): the phone variant's country while it is empty,
        // ISO 3166 alpha-2; without it, the page's.
        params: ['placeholder', 'mask', 'nullable', 'defaultCountry', 'required', 'readonly']},
    {type: 'text', label: typeLabel('type-text'),
        variants: [],
        params: ['placeholder', 'required', 'readonly']},
    // html (property-view port 1.17.0): formatted text, an HTML string of
    // sf-input-rich's subset. Edited with sf-input-rich, shown cleaned by that
    // component's own rule, a cell its text on one line, filtered as text.
    {type: 'html', label: typeLabel('type-html'),
        variants: [],
        params: ['placeholder', 'required', 'readonly']},
    // stepper: edited with sf-quantity, «−» and «+» and the arrow keys; min,
    // max and step (and a number's precision) are read by that variant alone.
    // numeric (C294, MP-12): a number a table aligns to the end of the line
    // with figures of one width -- integer, number, money and percent -- read
    // from here by any table instead of each keeping its own list.
    {type: 'integer', label: typeLabel('type-integer'), numeric: true,
        variants: [{id: 'stepper', label: typeLabel('variant-integer-stepper')}],
        params: ['unit', 'min', 'max', 'step', 'required', 'readonly']},
    {type: 'number', label: typeLabel('type-number'), numeric: true,
        variants: [{id: 'scale', label: typeLabel('variant-number-scale')},
            // meter (owner decision C203 (5)): a share of a limit, 0..100, as
            // the inline sf-progress-bar meter; the scale stays for levels.
            {id: 'meter', label: typeLabel('variant-number-meter')},
            {id: 'stepper', label: typeLabel('variant-number-stepper')}],
        params: ['unit', 'min', 'max', 'step', 'precision', 'required', 'readonly']},
    // date (PD-2, PD-3): min and max bound the day, an ISO date (the day of a
    // date and time is read); format is the length the view and the cell print
    // the date in, Intl's dateStyle: short, medium (the default), long, full.
    {type: 'date', label: typeLabel('type-date'),
        variants: [],
        params: ['min', 'max', 'format', 'required', 'readonly']},
    // datetime and time: sf-input-date in mode datetime and time (1.4.0). min
    // and max bound the value -- an ISO date or date and time for a datetime,
    // hh:mm for a time -- and step is the minute step, 1 to 60. A datetime's
    // format is its date's length, as a date's; the clock stays short.
    {type: 'datetime', label: typeLabel('type-datetime'),
        variants: [],
        params: ['min', 'max', 'step', 'format', 'required', 'readonly']},
    {type: 'time', label: typeLabel('type-time'),
        variants: [],
        params: ['min', 'max', 'step', 'required', 'readonly']},
    {type: 'boolean', label: typeLabel('type-boolean'),
        variants: [],
        params: ['trueText', 'falseText', 'required', 'readonly']},
    // buttons (property-view port 1.16.0): one segmented button group, a
    // button per option, sized by `size` on the ladder ("1/2", "1", "2"; absent,
    // the field's); pressing the chosen one again clears a field that is not
    // required. The dropdown stays the default.
    {type: 'choice', label: typeLabel('type-choice'),
        variants: [{id: 'buttons', label: typeLabel('variant-choice-buttons')}],
        params: ['options', 'badgeAppearance', 'size', 'required', 'readonly']},
    {type: 'choices', label: typeLabel('type-choices'),
        // badges: the view; checklist and select: the edit control (a list of
        // 13 or more is a checklist unless select is asked for).
        variants: [{id: 'badges', label: typeLabel('variant-choices-badges')},
            {id: 'checklist', label: typeLabel('variant-choices-checklist')},
            {id: 'select', label: typeLabel('variant-choices-select')}],
        params: ['options', 'badgeAppearance', 'required', 'readonly']},
    {type: 'user', label: typeLabel('type-user'),
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'record', label: typeLabel('type-record'),
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'relation', label: typeLabel('type-relation'),
        variants: [],
        params: ['placeholder', 'searchPlaceholder', 'required', 'readonly']},
    // lookup: a value chosen from a reference list the host keeps -- a country,
    // a status, a contract type (Larena, 2026-10-23). It is not a record: the
    // value is {value, label} and nothing opens from it. Small lists arrive as
    // `options` and are chosen from in place; anything larger is paged and
    // searched by the host, from the source the field names (`source`, which the
    // host reads and no renderer does).
    {type: 'lookup', label: typeLabel('type-lookup'),
        variants: [],
        params: ['options', 'multiple', 'placeholder', 'searchPlaceholder', 'required', 'readonly']},
    {type: 'file', label: typeLabel('type-file'),
        variants: [
            {id: 'image', label: typeLabel('variant-file-image')},
            {id: 'image-card', label: typeLabel('variant-file-image-card')},
            {id: 'image-list', label: typeLabel('variant-file-image-list')},
        ],
        // required: read by the image variant alone, whose control is
        // sf-image-field -- a required, empty one keeps its form from submitting.
        params: ['accept', 'multiple', 'formats', 'uploadText', 'uploadSupportingText', 'uploadHint', 'required', 'readonly']},
    {type: 'color', label: typeLabel('type-color'),
        variants: [],
        params: ['swatches', 'required', 'readonly']},
    {type: 'include', label: typeLabel('type-include'),
        variants: [],
        params: ['language', 'required', 'readonly']},
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
    // its digits after the point are `precision`, else those of `step`.
    {type: 'money', label: typeLabel('type-money'), numeric: true,
        variants: [],
        params: ['currency', 'currencies', 'currencyDisplay', 'min', 'max', 'placeholder', 'required', 'readonly']},
    {type: 'percent', label: typeLabel('type-percent'), numeric: true,
        variants: [],
        params: ['min', 'max', 'step', 'precision', 'placeholder', 'required', 'readonly']},
    // The types a component set draws (property-view port 1.18.0; Larena
    // property types standard, notes of 2026-11-03): `set` names the set whose
    // components show and edit them -- the View set's sf-view-properties -- and
    // the Framework draws their table cells and filters (items by its number
    // of rows). `params` are the keys the type reads, in the set's renderers
    // and in these.
    {type: 'items', label: typeLabel('type-items'), set: 'view',
        variants: [],
        params: ['columns', 'minRows', 'maxRows', 'required', 'readonly']},
    {type: 'compound', label: typeLabel('type-compound'), set: 'view',
        variants: [],
        params: ['parts', 'required', 'readonly']},
    {type: 'ru.requisites', label: typeLabel('type-ru.requisites'), set: 'view',
        variants: [],
        params: ['parts', 'required', 'readonly']},
]);

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
