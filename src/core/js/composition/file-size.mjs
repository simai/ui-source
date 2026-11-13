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
// name a file is shown under when it has no label. A data: or blob: address
// has no name in it -- the last «/» of `data:image/svg+xml,<svg …>` falls
// inside the content, and the name read «>» (image field study IF-14) -- so it
// gives none, and the caller says what the file is instead.
export function fileNameFromAddress(href) {
  if (/^\s*(?:data|blob):/iu.test(String(href ?? ''))) return '';
  const tail = String(href).split(/[?#]/u)[0].split('/').pop() || '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

// The icon of a file's kind, by its media type: sf-download-file's own glyph
// (download) when the type says nothing a reader would recognise. The
// Composition renderer draws content.file with it; an editor that draws the
// same row (sf-content-editor) imports it from here rather than keeping a copy.
// Each entry is [pattern, icon]; the first pattern that matches wins.
export const FILE_ICONS = Object.freeze([
  [/^application\/pdf$/u, 'picture_as_pdf'],
  [/^image\//u, 'image'],
  [/^video\//u, 'movie'],
  [/^audio\//u, 'audio_file'],
  [/^application\/(?:zip|x-zip-compressed|x-7z-compressed|x-rar-compressed|vnd\.rar|x-tar|gzip|x-gzip)$/u, 'folder_zip'],
  [/^(?:text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.[a-z.]+|application\/vnd\.oasis\.opendocument\.spreadsheet)$/u, 'table_chart'],
  [/^(?:application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.[a-z.]+|application\/vnd\.oasis\.opendocument\.presentation)$/u, 'slideshow'],
  [/^(?:text\/|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.[a-z.]+$|application\/vnd\.oasis\.opendocument\.text$|application\/rtf$)/u, 'description'],
].map((entry) => Object.freeze(entry)));

// The icon name for a media type; download when there is none or nothing matches.
export function fileIcon(mime) {
  if (typeof mime !== 'string' || !mime) return 'download';
  return FILE_ICONS.find(([pattern]) => pattern.test(mime))?.[1] ?? 'download';
}
