// Where a failed row draws «Повторить» (owner decision C88, prototype
// prototypes/file-download-row-composition.html variant B, dispatcher rules
// F1 and F2 of 2026-11-12). The element measures the row and asks this; a pure
// module, so a contract reads it.
//
// narrow -- «Повторить» goes under the text, from the text's edge: in a
//   column narrower than 22.5rem (360 px, C88), and also wherever the name's
//   column beside the button with its words would hold fewer than 16
//   characters (ch) at the name's own text size (F2). The width alone did not
//   fit sizes 2 and 3: at 360 px their wide button left the name 90.7 and
//   41.6 px, and it broke letter by letter.
// retryIcon -- the icon alone, its name in aria-label and a tooltip: only
//   while narrow, and only when the button with its words is wider than the
//   room under the text. That room is the text column, plus the button's own
//   padding before it (the plate reaches into the gap, so its words line up
//   with the text), plus the same again after it as prototype B allows (F1),
//   but never past the row's own padding there: on the phone ladder at sizes 2
//   and 3 the button's padding is the wider one, and the plate would cross the
//   frame (0.8 px past a 200 px box at 390, measured).

export const NARROW_BELOW_REM = 22.5;
export const NAME_KEEPS_CHARS = 16;

/**
 * @param {object} row
 * @param {number} row.width      the column's content width
 * @param {number} row.rem        the root font size
 * @param {number} row.textColumn the text column at the column's whole width
 * @param {number} row.gap        the row's column gap
 * @param {number} row.retryWidth the button with its words (max-content)
 * @param {number} row.reach      the button's inline padding
 * @param {number} row.padEnd     the row's inline-end padding
 * @param {number} row.chars      NAME_KEEPS_CHARS characters (ch) at the name's size
 * @returns {{narrow: boolean, retryIcon: boolean}}
 */
export function errorFit({width, rem, textColumn, gap, retryWidth, reach, padEnd, chars}) {
  const nameBeside = textColumn - gap - retryWidth;
  const narrow = width < NARROW_BELOW_REM * rem || nameBeside < chars - 0.5;
  const room = textColumn + reach + Math.min(reach, padEnd);
  return {narrow, retryIcon: narrow && retryWidth > room + 0.5};
}
