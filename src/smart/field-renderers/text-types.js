// The text types Larena stores and the Framework drew as plain strings until
// step 3 of the type-template catalogue (owner decisions C302, C303,
// 2026-11-17; ui-control research 2026-11-17-type-template-catalogue): a web
// address (`url`), a link with its text (`link`) and a Russian taxpayer number
// (`ru.inn`). Each checks its value; the renderers in index.js draw them.
//
// No DOM and no Lit: a host's server test reads the same rules.

// url: an absolute http or https address, at most 2048 bytes, without a login
// or a password in it (Larena url@1).
export const URL_MOST_BYTES = 2048;

function byteLength(text) {
    try {
        return new TextEncoder().encode(text).length;
    } catch {
        return text.length;
    }
}

function parsedUrl(text) {
    try {
        return new URL(text);
    } catch {
        return null;
    }
}

/** Whether a text is a web address this type stores. */
export function isWebAddress(value) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (!text || text !== value || /\s/u.test(text) || byteLength(text) > URL_MOST_BYTES) return false;
    if (!/^https?:\/\//iu.test(text)) return false;
    const url = parsedUrl(text);
    return Boolean(url && (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username && !url.password);
}

// A bare domain is an address (dispatcher decision, field orders FO-5,
// 2026-11-18): «simai.io» or «simai.io/docs» typed without a scheme is read as
// https://simai.io/…, and the field shows and writes that. Only a text with no
// scheme at all is completed -- «javascript:…», «mailto:…», «ftp://…» keep
// theirs and are refused -- and only when it starts with a host name that has
// a dot («localhost» or «/path» are not addresses of this type). A port after
// the host («simai.io:8080») is not a scheme.
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/iu;
const BARE_HOST = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,}(?::\d{1,5})?(?:[/?#]|$)/u;

/**
 * The address a typed text stands for: the text itself when it has a scheme
 * or is not a bare domain, else https:// before it. Trimmed; isWebAddress()
 * still decides whether the result is one.
 */
export function completeWebAddress(value) {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!text || SCHEME.test(text) || text.startsWith('/') || !BARE_HOST.test(text)) return text;
    return `https://${text}`;
}

/**
 * An address as a row shows it: the host and the start of the path, without
 * the scheme, a trailing slash or «www.», cut with «…» past `most` characters.
 */
export function shortAddress(value, most = 40) {
    const url = isWebAddress(value) ? parsedUrl(value) : null;
    if (!url) return typeof value === 'string' ? value : '';
    const host = url.hostname.replace(/^www\./u, '');
    const rest = `${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`;
    const text = `${host}${url.port ? `:${url.port}` : ''}${rest}`;
    return text.length > most ? `${text.slice(0, most - 1)}…` : text;
}

// link: {href, text?}. href is an http(s) address, a path from the site's
// root («/about», never «//host») or an anchor («#prices»); text is at most
// 255 characters (Larena link@1).
export const LINK_TEXT_MOST = 255;

export function isLinkAddress(value) {
    if (typeof value !== 'string' || !value || value !== value.trim() || /\s/u.test(value)) return false;
    if (value.startsWith('#')) return value.length > 1;
    if (value.startsWith('/')) return !value.startsWith('//') && !value.startsWith('/\\');
    return isWebAddress(value);
}

/** A stored link read: {href, text}, or null for none; a bare string is its href. */
export function readLink(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') return {href: value, text: ''};
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    const href = typeof value.href === 'string' ? value.href : '';
    const text = typeof value.text === 'string' ? value.text : '';
    return href || text ? {href, text} : null;
}

/**
 * What an edit of the two parts writes: {value} -- {href, text} without an
 * empty text, null when both are empty -- or {error}: linkNeedsAddress,
 * linkInvalid, linkTextLong (the set's words).
 */
export function composeLink(href, text) {
    const address = String(href ?? '').trim();
    const words = String(text ?? '').trim();
    if (!address && !words) return {value: null};
    if (!address) return {error: 'linkNeedsAddress'};
    if (!isLinkAddress(address)) return {error: 'linkInvalid'};
    if ([...words].length > LINK_TEXT_MOST) return {error: 'linkTextLong'};
    return {value: words ? {href: address, text: words} : {href: address}};
}

// ru.inn: 10 digits for an organisation, 12 for a person, with the check
// digits of the Federal Tax Service. `holder` -- any (default),
// organization, person -- is fixed when the field is created.
const INN_WEIGHTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN_WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN_WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
export const INN_HOLDERS = Object.freeze(['any', 'organization', 'person']);

function checkDigit(digits, weights) {
    const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
    return (sum % 11) % 10;
}

export function innHolder(field = {}) {
    const asked = String(field?.holder ?? '').trim();
    return INN_HOLDERS.includes(asked) ? asked : 'any';
}

/**
 * Why a text is not an INN of the field, or null when it is one (an empty
 * text is null too: no value). The reasons are the set's words: innDigits,
 * innOrganization, innPerson, innChecksum.
 */
export function innError(value, holder = 'any') {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (!/^\d+$/u.test(text) || (text.length !== 10 && text.length !== 12)) {
        return holder === 'organization' ? 'innOrganization' : holder === 'person' ? 'innPerson' : 'innDigits';
    }
    if (holder === 'organization' && text.length !== 10) return 'innOrganization';
    if (holder === 'person' && text.length !== 12) return 'innPerson';
    if (text.length === 10) return checkDigit(text, INN_WEIGHTS_10) === Number(text[9]) ? null : 'innChecksum';
    return checkDigit(text, INN_WEIGHTS_11) === Number(text[10]) && checkDigit(text, INN_WEIGHTS_12) === Number(text[11])
        ? null : 'innChecksum';
}
