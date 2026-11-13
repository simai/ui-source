// The upload core's checks (C81: one core, five views), as pure functions:
// which files an accept list names, why one file is refused before any count
// is taken, and how the formats read in a message. sf-file-upload's intake
// (_file_upload.js takeFiles) and sf-input-image (src/smart/input-image) both
// read them from here, so a file is refused for the same reasons and in the
// same words in a list and in an image field. This module binds nothing and
// reads no page: _file_upload.js binds every .sf-file-upload as it loads,
// which a page with only an image field has no use for, so the field imports
// these and not that.

// Whether a file is one the accept list names: `.ext`, `type/*` or `type/sub`,
// as the platform dialog reads it. The dialog filters what a person may pick;
// a drop (or a paste, or the dialog's «All files») goes past it.
export function acceptsFile(accept, file) {
  const tokens = String(accept || '').split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

// A limit in bytes, pixels or files: a positive number, else none (0).
export function positiveLimit(value) {
  const number = Number(value ?? '');
  return Number.isFinite(number) && number > 0 ? number : 0;
}

// Why one file is refused on its own, before the list's counts: '' when it
// passes; else 'type' (accept does not name it), 'empty' (no bytes), 'size'
// (past maxSize) or 'min-size' (under minSize). The order is the order a
// person fixes them in: the kind of file first, then its size.
export function fileRejection(file, {accept = '', maxSize = 0, minSize = 0} = {}) {
  if (!acceptsFile(accept, file)) return 'type';
  const bytes = Number(file?.size) || 0;
  if (bytes === 0) return 'empty';
  if (maxSize && bytes > maxSize) return 'size';
  if (minSize && bytes < minSize) return 'min-size';
  return '';
}

// The names people know a format by, where its media subtype is not one:
// image/jpeg is a JPG, image/svg+xml an SVG.
export const FORMAT_NAMES = Object.freeze({
  jpeg: 'JPG',
  pjpeg: 'JPG',
  'svg+xml': 'SVG',
  webp: 'WebP',
  'x-icon': 'ICO',
  'vnd.microsoft.icon': 'ICO',
});

// The formats an accept list names, as people read them: «PDF, DOCX»,
// «JPG, PNG», «изображения». `kindWord(kind)` gives the word of a whole kind
// (`image/*`, `video/*`, `audio/*`) in the page's language.
export function acceptFormats(accept, kindWord = (kind) => kind) {
  const parts = String(accept || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const wild = /^(image|video|audio)\/\*$/iu.exec(part);
      if (wild) return kindWord(wild[1].toLowerCase());
      const bare = part.replace(/^\./u, '');
      const sub = (bare.includes('/') ? bare.split('/').pop() || bare : bare).toLowerCase();
      return FORMAT_NAMES[sub] ?? sub.toUpperCase();
    });
  return [...new Set(parts)].join(', ');
}
