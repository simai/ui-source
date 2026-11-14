// The character count of a text field with a limit (owner decision C141 (1),
// the rule sf-chat-composer keeps in ui-pro): one rule for every field that
// counts, so the message box, the multi-line field and the formatted text
// say the same thing at the same moment.
//
// - The count shows from 80 % of the limit (more than 0.8 x limit
//   characters), or always when the field asks for it (`counter`).
// - Past the limit the count and the field's frame are the error colour and
//   the field is invalid (too-long), so its form is not sent; the text is
//   never cut: the person decides what to take out.
// - A polite line speaks only when a threshold is crossed (near, over, back
//   under), never on every key.
//
// The field draws the count at the end of its message line (the hint's or
// the error's), in the message's text and colour with digits of one width.

/** The share of the limit from which the count shows. */
export const COUNT_FROM = 0.8;

/** A limit as a positive whole number, or null when there is none. */
export function countLimit(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Where a text of `length` characters stands against `limit`:
 * {limit, length, near, over, shown, level}. `level` is '', 'near' or
 * 'over'; `shown` says whether the count is drawn (near, over, or `always`).
 * Without a limit nothing is counted.
 */
export function charCount(length, limit, {always = false} = {}) {
  const max = countLimit(limit);
  const count = Math.max(0, Number(length) || 0);
  if (max === null) return {limit: null, length: count, near: false, over: false, shown: false, level: ''};
  const near = count > max * COUNT_FROM;
  const over = count > max;
  return {limit: max, length: count, near, over, shown: Boolean(always) || near, level: over ? 'over' : near ? 'near' : ''};
}

/**
 * What the polite line says now: the count's words when its level changed
 * since `lastLevel`, else `lastSaid` as it was. Returns {level, said}; the
 * component keeps both for the next call.
 */
export function countAnnouncement(state, lastLevel, lastSaid, words) {
  if (state.level === (lastLevel || '')) return {level: state.level, said: lastSaid || ''};
  return {level: state.level, said: state.level ? words(state) : ''};
}
