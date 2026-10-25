// The parts of sf-code-input that are about the code, not the page: which
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

const MODE_PATTERN = {
  numeric: '[0-9]',
  alphanumeric: '[A-Za-z0-9]',
};

export function codeMode(value) {
  const mode = String(value ?? '').trim().toLowerCase();
  return CODE_MODES.includes(mode) ? mode : 'numeric';
}

export function codeLength(value) {
  const length = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(length) || length < 1) return CODE_LENGTH_DEFAULT;
  return Math.min(length, CODE_LENGTH_MAX);
}

// Only the characters the mode keeps, no longer than the code: what typing,
// pasting and autofill leave in the field.
export function normaliseCode(value, mode = 'numeric', length = CODE_LENGTH_DEFAULT) {
  return String(value ?? '').replace(MODE_FILTER[codeMode(mode)], '').slice(0, codeLength(length));
}

// The native constraint the field carries: exactly `length` characters of the
// mode, so a required code that is not whole is invalid as the form sees it.
export function codePattern(mode, length) {
  return `${MODE_PATTERN[codeMode(mode)]}{${codeLength(length)}}`;
}

// What the keyboard offers: digits for a numeric code, letters otherwise.
export function codeInputMode(mode) {
  return codeMode(mode) === 'numeric' ? 'numeric' : 'text';
}

// The cell the next character goes to: the caret's, never past the last cell.
export function currentCell(caret, length) {
  const at = Number.isFinite(caret) ? caret : 0;
  return Math.max(0, Math.min(at, codeLength(length) - 1));
}

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
  const inserted = typed === null ? '' : typed.replace(MODE_FILTER[codeMode(mode)], '');

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
  const pasted = String(text ?? '').replace(MODE_FILTER[codeMode(mode)], '');
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
  },
  ru: {
    digit: 'цифра {n} из {m}',
    character: 'символ {n} из {m}',
    group: 'Код',
  },
};

export function positionWords(template, cell, length) {
  return String(template).replace('{n}', String(cell + 1)).replace('{m}', String(codeLength(length)));
}
