// Formatted text (property-view port 1.17.0, propertyType `html`; Larena,
// 2026-10-30): a value that is an HTML string of sf-rich-text's subset. The
// subset's rule is sf-rich-text's own module, not a second one written here:
// what the editor writes and what a record shows are cleaned by the same
// function, so the two cannot disagree about what a value may hold.
//
// A value is never drawn as it arrives. The host's value may have been stored
// by something other than this editor -- an import, an API, an older site --
// so the view draws only what `cleanHtml` returns, and a table cell draws only
// the text. Both take any value: a string, {value, text} as a host formats a
// scalar, or nothing.
import {plainText, sanitizeRichText} from '../rich-text/js/rich-text-html.mjs';

const source = (value) => {
    const raw = value && typeof value === 'object' && !Array.isArray(value) && 'value' in value ? value.value : value;
    return typeof raw === 'string' ? raw : '';
};

/** The value in the subset: everything else removed, every text escaped; "" when there is no text. */
export function cleanHtml(value) {
    const html = source(value);
    return html ? sanitizeRichText(html, {mode: 'value'}) : '';
}

/** The value's visible text on one line, for a table cell: blocks and line breaks become spaces. */
export function htmlText(value) {
    const html = source(value);
    return html ? plainText(html).replace(/\s+/gu, ' ').trim() : '';
}
