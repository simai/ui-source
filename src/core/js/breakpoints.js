// The Framework's breakpoints for scripts (reuse audit 2026-11-02, finding 6).
// The sheets switch at the steps of core/scss/vars/_sf_var__breakpoint.scss;
// a component that also decides in script (sf-contents, sf-site-header,
// sf-search) had copied the steps by hand, word for word, and nine such
// constants (48rem, 60rem, 1023px, 1024) had drifted apart elsewhere, so one
// admin screen switched at two points. The same values here, and
// tests/breakpoint-ladder.contract.test.mjs holds the two files equal.

/** The ladder: each name is the width it starts at, in rem as the sheets write it. */
export const BREAKPOINTS = Object.freeze({
  xs: '0rem',
  sm: '32rem',  // g6, 512px
  md: '44rem',  // h1, 704px
  lg: '60rem',  // h5, 960px
  xl: '72rem',  // h8, 1152px
  xxl: '80rem', // i0, 1280px
});

// The step under a threshold, as the sheets' media-breakpoint-down writes it:
// one pixel less, in rem (_mix__breakpoint.scss breakpoint-max).
const PIXEL_REM = 1 / 16;

/**
 * The media query of a breakpoint: from its width up, or with `below: true`
 * the widths under it -- the two sides the sheets switch on. An unknown name
 * is null, so a typo is not a query that always matches.
 *
 *   breakpointQuery('md')                  (min-width: 44rem)
 *   breakpointQuery('md', {below: true})   (max-width: 43.9375rem)
 */
export function breakpointQuery(name, {below = false} = {}) {
  if (!Object.hasOwn(BREAKPOINTS, name)) return null;
  const rem = Number.parseFloat(BREAKPOINTS[name]);
  if (below) return rem > 0 ? `(max-width: ${rem - PIXEL_REM}rem)` : 'not all';
  return `(min-width: ${rem}rem)`;
}

/** The page's MediaQueryList for a breakpoint, to read and to follow; null without matchMedia or for an unknown name. */
export function breakpointMedia(name, {below = false, view = globalThis} = {}) {
  const query = breakpointQuery(name, {below});
  return query && typeof view?.matchMedia === 'function' ? view.matchMedia(query) : null;
}

/** Whether the page is at least as wide as the breakpoint now (or under it, with `below`). */
export function matchesBreakpoint(name, options = {}) {
  return breakpointMedia(name, options)?.matches === true;
}

const Breakpoints = Object.freeze({
  ladder: BREAKPOINTS,
  query: breakpointQuery,
  media: breakpointMedia,
  matches: matchesBreakpoint,
});

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.breakpoints) globalThis.SF.breakpoints = Breakpoints;
}

export default Breakpoints;
