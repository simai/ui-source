// How a stored file reads to people: its size in the page's language and its
// name when nobody gave it one. sf-image-field wrote these first (its
// value.mjs re-exports them); the Composition renderer draws content.file with
// the same rule, so a size reads the same in a field and on a page. No DOM.

// The size rule is core's number format (core/js/format.js, reuse audit
// 2026-11-02 finding 7), re-exported under the names this module published:
// formatFileSize(size, units, locale) still reads as it did. Imported through
// format.js on purpose: the builder ships a source module's relative imports
// beside it, and this import is what lays core/js/format.js and its parts
// (format-*.js) in the distribution for products that import them. None of
// them has a top-level side effect, so a bundle keeps only what it calls.
export {FILE_SIZE_UNITS, fileSizeUnits, formatFileSize} from '../format.js';

// The last part of an address, decoded, without its query and fragment: the
// name a file is shown under when it has no label.
export function fileNameFromAddress(href) {
  const tail = String(href).split(/[?#]/u)[0].split('/').pop() || '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}
