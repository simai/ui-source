// The former names of the text-flow utilities (owner decision C186 (8),
// 2026-11-14). One family for one job: text-nowrap, text-break,
// text-break-normal and text-hyphens, beside truncate and line-clamp-N. The
// names below did the same jobs under other families; they keep drawing what
// they drew until remove_after, and the Loader notes each one once in
// SF.deprecations the first time a page uses it (a console line under
// data-sf-deprecations="warn", and after the date whatever the page opted
// into). Journal: class-text-flow-utility-aliases.
import {noteDeprecated} from './deprecations.js';

export const UTILITY_CLASS_ALIASES = Object.freeze({
  'wrap-none': 'text-nowrap',
  'text-break-word': 'text-break',
  'text-break-all': 'text-break',
  't-ellipsis': 'truncate',
  't-clip': 'truncate',
});

export const UTILITY_CLASS_ALIAS_DATES = Object.freeze({since: '2026-11-14', remove_after: '2027-01-01'});

const expiredAt = (now) => now > Date.parse(`${UTILITY_CLASS_ALIAS_DATES.remove_after}T23:59:59.999Z`);

/**
 * Notes `token` when it is a former utility name; returns the current name or
 * null. The Loader calls it once per distinct class token of the page.
 */
export function noteUtilityClassAlias(token, now = Date.now()) {
  if (!Object.hasOwn(UTILITY_CLASS_ALIASES, token)) return null;
  const to = UTILITY_CLASS_ALIASES[token];
  noteDeprecated({
    component: 'utility',
    kind: 'class',
    from: token,
    to,
    ...UTILITY_CLASS_ALIAS_DATES,
    ...(expiredAt(now) ? {expired: true} : {}),
  });
  return to;
}
