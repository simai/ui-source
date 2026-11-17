// A field's type and template as the renderers draw them (owner decisions C302
// and C303, 2026-11-17). The field description names a type (`propertyType`,
// or `type`, `dataType`) and one template (`template`) with its parameters
// (`templateParams`); this reads the former names on the way and settles what
// a renderer draws:
//
//   variant              read as `template` until 2027-01-01
//   string + variant phone / password      the phone / password type
//   integer              number with decimals 0
//   compound             complex
//   select, image-card, image-list         dropdown, image_card, image_list
//
// Each former name is said once per page in the console and noted in
// SF.deprecations (sf-field-renderers). A template the type does not have, or
// one that does not fit the field, draws as the type's default and is said
// once per type and template: `template_fallback:<type>.<template>` (C302 (2);
// the common property types standard §3). Larena decides which templates fit
// a field; the Framework checks only what it can read off the field.
//
// Nothing here changes the field: the host keeps the object it passed, and
// setFieldValue and getFieldValue are called with it.
import {PROPERTY_TYPES, STRING_VARIANT_TYPES, TEMPLATE_ALIASES, TYPE_ALIASES, ALIASES_UNTIL} from './registry.js';
import {noteDeprecated} from '../../core/js/deprecations.js';

const SET_NAME = 'sf-field-renderers';
const BY_TYPE = new Map(PROPERTY_TYPES.map((entry) => [entry.type, entry]));

// Every bundle carries its own copy of this module; the page hears each
// warning once whichever copy draws (memory: bundles each carry their own
// module copy), so the said keys live on one shared global.
function saidOnce(key) {
    const root = globalThis.SF = globalThis.SF || {};
    if (!(root.__fieldTemplateNotes instanceof Set)) {
        Object.defineProperty(root, '__fieldTemplateNotes', {value: new Set(), configurable: true});
    }
    if (root.__fieldTemplateNotes.has(key)) return false;
    root.__fieldTemplateNotes.add(key);
    return true;
}

function sayFormer(key, from, to, message) {
    noteDeprecated({component: SET_NAME, kind: 'value', attribute: key, from, to, since: '2026-11-17', remove_after: ALIASES_UNTIL});
    if (saidOnce(`former|${key}|${from}`)) {
        globalThis.console?.warn?.(`[SIMAI Framework] sf-field-renderers: ${message} until ${ALIASES_UNTIL}.`);
    }
}

function sayFallback(type, asked, fallback, why) {
    if (!saidOnce(`fallback|${type}|${asked}`)) return;
    globalThis.console?.warn?.(`[SIMAI Framework] template_fallback:${type}.${asked} -- ${why}; drawn as ${type}.${fallback}.`);
}

/** The type a field asks for, as written: propertyType, type, dataType. */
export function askedType(field = {}) {
    return field?.propertyType || field?.type || field?.dataType;
}

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

// What a template needs of a field that the Framework can read (the rest of
// a fit rule is Larena's): a scale or a meter draws a value 0..100, so it
// fits a field that does not bound itself otherwise.
const FITS = {
    'bounds-0-100': (field) => {
        const bound = (value) => (value === null || value === undefined || value === '' ? null : Number(value));
        const min = bound(field.min);
        const max = bound(field.max);
        return (min === null || min === 0) && (max === null || max === 100);
    },
};

/**
 * The type, the template and the template parameters a field is drawn with.
 * `type` is the registered type (or the asked one when it is not registered:
 * a filter control, a host's own); `template` is a template of that type,
 * never empty for a registered type; `decimals` is a number's digits after
 * the point when the field fixes them (an integer: 0); `former` names the
 * former spelling it came in (for a choices `select`, which keeps the
 * dropdown at any length).
 */
export function resolveField(field = {}, {quiet = false} = {}) {
    field = field || {};
    const asked = askedType(field);
    let type = asked;
    let decimals = null;
    let former = '';
    const variant = text(field.variant ?? field.filter?.variant);
    let wanted = text(field.template);

    if (TYPE_ALIASES[type]) {
        const alias = TYPE_ALIASES[type];
        if (!quiet) sayFormer('type', type, alias.type, `type "${type}" is read as ${alias.type}${type === 'integer' ? ' with decimals 0' : ''}; write propertyType "${alias.type}"${type === 'integer' ? ' and decimals: 0' : ''}`);
        if (Number.isInteger(alias.settings.decimals)) decimals = alias.settings.decimals;
        type = alias.type;
    }
    if (type === 'string' && STRING_VARIANT_TYPES[variant] && !wanted) {
        if (!quiet) sayFormer('type', `string.${variant}`, STRING_VARIANT_TYPES[variant], `a string with variant "${variant}" is read as the ${STRING_VARIANT_TYPES[variant]} type; write propertyType "${STRING_VARIANT_TYPES[variant]}"`);
        return {type: STRING_VARIANT_TYPES[variant], template: BY_TYPE.get(STRING_VARIANT_TYPES[variant]).templates[0].id, params: paramsOf(field), decimals: null, former: variant, asked};
    }
    if (!wanted && variant) {
        if (!quiet) sayFormer('field', 'variant', 'template', 'the field key "variant" is read as "template"; write template and templateParams');
        wanted = variant;
        former = variant;
    }
    const aliases = TEMPLATE_ALIASES[type];
    if (wanted && aliases?.[wanted]) {
        if (!quiet) sayFormer('template', `${type}.${wanted}`, `${type}.${aliases[wanted]}`, `template "${wanted}" of ${type} is read as "${aliases[wanted]}"`);
        former = former || wanted;
        wanted = aliases[wanted];
    }
    if (type === 'number' || type === 'percent') {
        const own = Number.isInteger(field.decimals) ? field.decimals : Number.isInteger(field.precision) ? field.precision : null;
        if (own !== null) decimals = own;
    }

    const entry = BY_TYPE.get(type);
    if (!entry) return {type, template: wanted, params: paramsOf(field), decimals, former, asked};
    const fallback = entry.templates[0].id;
    let template = fallback;
    if (wanted) {
        const known = entry.templates.find((one) => one.id === wanted);
        if (!known) {
            if (!quiet) sayFallback(type, wanted, fallback, `${type} has no template "${wanted}" in SIMAI Framework`);
        } else if (known.fits && FITS[known.fits] && !FITS[known.fits](field)) {
            if (!quiet) sayFallback(type, wanted, fallback, `the field does not fit "${wanted}" (${known.fits})`);
        } else {
            template = known.id;
        }
    }
    return {type, template, params: paramsOf(field), decimals, former, asked};
}

// templateParams, with the former field keys a template parameter had:
// badgeAppearance is badge; trueText, falseText, size, language, swatches
// stood on the field itself.
const FORMER_PARAMS = {badge: 'badgeAppearance', trueText: 'trueText', falseText: 'falseText', size: 'size', language: 'language', swatches: 'swatches', rows: 'rows'};

function paramsOf(field) {
    const own = field.templateParams && typeof field.templateParams === 'object' && !Array.isArray(field.templateParams) ? field.templateParams : {};
    return own;
}

/** A template parameter: templateParams first, then the field key it was before. */
export function templateParam(field, name) {
    const own = paramsOf(field || {});
    if (own[name] !== undefined && own[name] !== null) return own[name];
    const former = FORMER_PARAMS[name];
    return former ? field?.[former] : undefined;
}

/** The registered entry of a type (after its aliases), or null. */
export function typeEntry(type) {
    const alias = TYPE_ALIASES[type];
    return BY_TYPE.get(alias ? alias.type : type) ?? null;
}
