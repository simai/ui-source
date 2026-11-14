// A picture's address as a quoted CSS url() for an inline style (docs precheck
// 2026-11-10, smart content LI-01). Written bare -- url(${address}) -- an
// address with a space, a quote or a bracket made the whole declaration
// invalid, and the avatar drew empty: a data URI of an SVG has spaces. The
// quote and the backslash are escaped; a line break cannot stand in a CSS
// string and is dropped.
export function cssUrl(value) {
  const text = String(value ?? '').replace(/[\n\r\f]/gu, '').replace(/["\\]/gu, (ch) => `\\${ch}`);
  return `url("${text}")`;
}
