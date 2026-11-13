// The parts of sf-input-code that are about the code, not the page: which
// characters a mode keeps, how long a code is, what an edit makes of the value
// and how a cell is spoken. Kept apart from the element so the contract tests
// run them in Node, as sf-accordion's sections.mjs is.

// The class verification's own bounds: one to twelve cells, six by default.
export const CODE_LENGTH_DEFAULT = 6;
export const CODE_LENGTH_MAX = 12;
// What a code is made of: digits, or Latin letters and digits. The class also
// knows `text` (anything but spaces); a one-time code is never that.
export const CODE_MODES = Object.freeze(['numeric', 'alphanumeric']);
// What a masked cell shows in place of its character.
export const MASK_GLYPH = '•';

const MODE_FILTER = {
  numeric: /[^0-9]/gu,
  alphanumeric: /[^A-Za-z0-9]/gu,
};
// The cells per group a separator is drawn between (C82: 3 + 3, 4 + 4).
export const CODE_GROUPS_MAX = 6;

export function codeMode(value) {
  const raw = value && typeof value === 'object' ? value.mode : value;
  const mode = String(raw ?? '').trim().toLowerCase();
  return CODE_MODES.includes(mode) ? mode : 'numeric';
}

// An own alphabet (owner C82, for example Steam Guard's
// 23456789BCDFGHJKMNPQRTVWXY, without 0 O 1 I): each character once, no
// spaces, as written. Empty when there is none.
export function codeCharset(value) {
  return [...new Set([...String(value ?? '')].filter((character) => !/\s/u.test(character)))].join('');
}

// What a code is made of, from the settings: {mode, charset, uppercase}. A
// mode string alone is a kind without an alphabet or capitals. The charset,
// when there is one, takes the place of the mode; uppercase turns letters
// into capitals before the characters are kept.
export function codeKind(value = 'numeric') {
  if (value && typeof value === 'object') {
    return {mode: codeMode(value.mode), charset: codeCharset(value.charset), uppercase: Boolean(value.uppercase)};
  }
  return {mode: codeMode(value), charset: '', uppercase: false};
}

// Only the characters the kind keeps, in order.
export function keepCharacters(text, kind = 'numeric') {
  const {mode, charset, uppercase} = codeKind(kind);
  const source = uppercase ? String(text ?? '').toUpperCase() : String(text ?? '');
  if (charset) return [...source].filter((character) => charset.includes(character)).join('');
  return source.replace(MODE_FILTER[mode], '');
}

// Cells per group, or 0 for none: a group is two cells or more and shorter
// than the code, so a separator always has cells on both sides.
export function codeGroups(value, length = CODE_LENGTH_DEFAULT) {
  const groups = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(groups) || groups < 2 || groups > CODE_GROUPS_MAX) return 0;
  return groups < codeLength(length) ? groups : 0;
}

// Whether a separator follows the cell: the end of a group, not the code.
export function separatorAfter(index, groups, length) {
  return groups > 0 && index + 1 < codeLength(length) && (index + 1) % groups === 0;
}

export function codeLength(value) {
  const length = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(length) || length < 1) return CODE_LENGTH_DEFAULT;
  return Math.min(length, CODE_LENGTH_MAX);
}

// Only the characters the mode keeps, no longer than the code: what typing,
// pasting and autofill leave in the field.
export function normaliseCode(value, mode = 'numeric', length = CODE_LENGTH_DEFAULT) {
  return keepCharacters(value, mode).slice(0, codeLength(length));
}

// What the keyboard offers: digits for a numeric code or an alphabet of
// digits only, letters otherwise.
export function codeInputMode(mode) {
  const {mode: base, charset} = codeKind(mode);
  if (charset) return /^[0-9]+$/u.test(charset) ? 'numeric' : 'text';
  return base === 'numeric' ? 'numeric' : 'text';
}

// The cell the next character goes to: the caret's, never past the last cell.
export function currentCell(caret, length) {
  const at = Number.isFinite(caret) ? caret : 0;
  return Math.max(0, Math.min(at, codeLength(length) - 1));
}

// `mode` below is a mode string or a kind ({mode, charset, uppercase}).
//
// One edit the person made, as the field sees it after the browser applied it:
// `previous` is the code before, `raw` the field's text now, `caret` where the
// browser left the caret and `data` what was inserted (InputEvent.data).
//
// - A whole code -- autofill from a message, a paste, WebOTP writing it in --
//   replaces the value, whatever was there and wherever the caret was.
// - A character typed into a filled cell takes that cell's place, as a cell
//   would: the code is not pushed along and nothing falls off its end. Typed
//   at the end of a whole code, it takes the last cell. Typed over a
//   selection, it replaces the selection, as in any field.
// - Anything else (deleting, cutting, a part of a code pasted at the caret)
//   is the browser's own edit, with the characters the mode does not keep
//   taken out.
//
// `selection` is where the selection stood before the edit ({start, end},
// from beforeinput); without it the edit is read from the caret after it.
// Returns {value, caret}.
export function applyEdit({previous = '', raw = '', caret = 0, data = null, inputType = '', selection = null, mode = 'numeric', length = CODE_LENGTH_DEFAULT}) {
  const size = codeLength(length);
  const kept = normaliseCode(previous, mode, size);
  const typed = data === null || data === undefined ? null : String(data);
  const inserted = typed === null ? '' : keepCharacters(typed, mode);

  if (inserted.length >= size) {
    const value = inserted.slice(0, size);
    return {value, caret: value.length};
  }

  if (inputType === 'insertText' && typed !== null) {
    const from = selection ? Math.max(0, Math.min(selection.start, kept.length)) : Math.max(0, Math.min(caret - typed.length, kept.length));
    const to = selection ? Math.max(from, Math.min(selection.end, kept.length)) : from;
    if (!inserted) {
      // Nothing the mode keeps: the field goes back to what it was.
      return {value: kept, caret: from};
    }
    if (to > from) {
      const value = (kept.slice(0, from) + inserted + kept.slice(to)).slice(0, size);
      return {value, caret: Math.min(from + inserted.length, value.length)};
    }
    const start = from >= size ? size - inserted.length : from;
    const value = (kept.slice(0, start) + inserted + kept.slice(start + inserted.length)).slice(0, size);
    return {value, caret: Math.min(start + inserted.length, value.length)};
  }

  const before = String(raw ?? '').slice(0, Math.max(0, caret));
  const value = normaliseCode(raw, mode, size);
  return {value, caret: Math.min(normaliseCode(before, mode, size).length, value.length)};
}

// What a pasted text makes of the code: a whole code replaces it; a part goes
// in at the caret, over what the selection held. Returns {value, caret}, or
// null when the text holds nothing the mode keeps.
export function applyPaste({previous = '', text = '', start = 0, end = start, mode = 'numeric', length = CODE_LENGTH_DEFAULT}) {
  const size = codeLength(length);
  const pasted = keepCharacters(text, mode);
  if (!pasted) return null;
  if (pasted.length >= size) {
    const value = pasted.slice(0, size);
    return {value, caret: value.length};
  }
  const kept = normaliseCode(previous, mode, size);
  const from = Math.max(0, Math.min(start, kept.length));
  const to = Math.max(from, Math.min(end, kept.length));
  const value = (kept.slice(0, from) + pasted + kept.slice(to)).slice(0, size);
  return {value, caret: Math.min(from + pasted.length, value.length)};
}

// The words the element speaks, in the languages it ships; a product adds more
// through SF.language (src/core/js/page-language.js). `{n}` is the cell, `{m}`
// the length.
export const CODE_INPUT_TEXT = {
  en: {
    digit: 'digit {n} of {m}',
    character: 'character {n} of {m}',
    group: 'Code',
    'too-short': 'Enter the whole code',
  },
  ru: {
    digit: 'цифра {n} из {m}',
    character: 'символ {n} из {m}',
    group: 'Код',
    'too-short': 'Введите код целиком',
  },
};

export function positionWords(template, cell, length) {
  return String(template).replace('{n}', String(cell + 1)).replace('{m}', String(codeLength(length)));
}
