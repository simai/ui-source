import {noteDeprecated} from '../../../core/js/deprecations.js';

// One name per look (DEV letter on plain group 1, IR-2, 2026-11-14): the
// documentation's name stays, the second name of each look is an alias until
// 2027-01-01. The sheet draws both; this notes each alias once in
// SF.deprecations (a console line under data-sf-deprecations="warn", and
// after the date whatever the page opted into). Journal:
// class-featured-icon-look-aliases.
const DEPRECATED = Object.freeze({since: '2026-11-14', remove_after: '2027-01-01'});
// Owner decision C188 (8), same day: two looks, tonal (soft) and solid;
// medium draws tonal and elevated retires, so both and their second names
// point to soft.
export const FEATURED_ICON_LOOK_ALIASES = Object.freeze({
  light: 'soft',
  medium: 'soft',
  mid: 'soft',
  elevated: 'soft',
  modern: 'soft',
  dark: 'solid',
  clear: 'neutral',
});

const pending = new Set(Object.keys(FEATURED_ICON_LOOK_ALIASES));
const selector = () => [...pending].map((name) => `.sf-featured-icon--${name}`).join(',');

function noteAliases(target = document) {
  if (pending.size === 0) return;
  const query = selector();
  const found = [];
  if (target instanceof Element && target.matches?.(query)) found.push(target);
  target.querySelectorAll?.(query).forEach((element) => found.push(element));
  for (const element of found) {
    for (const name of [...pending]) {
      if (!element.classList.contains(`sf-featured-icon--${name}`)) continue;
      pending.delete(name);
      noteDeprecated({
        component: 'featured-icon',
        kind: 'class',
        from: `sf-featured-icon--${name}`,
        to: `sf-featured-icon--${FEATURED_ICON_LOOK_ALIASES[name]}`,
        ...DEPRECATED,
      });
    }
    if (pending.size === 0) break;
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => noteAliases(), {once: true});
  } else {
    noteAliases();
  }
  // Watches until every alias was seen once, then lets go.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') noteAliases(mutation.target);
      else mutation.addedNodes.forEach((node) => { if (node instanceof Element) noteAliases(node); });
      if (pending.size === 0) { observer.disconnect(); return; }
    }
  });
  observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
}

export {noteAliases};
