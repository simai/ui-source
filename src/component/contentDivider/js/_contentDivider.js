import {noteDeprecated} from '../../../core/js/deprecations.js';

// Owner decision C188 (3), (4), 2026-11-14: a caption on the line has no
// frame, and buttons on the line are real sf-button size 1/2 outline in
// .sf-divider-buttons. The caption's frame class and the divider's own button
// paint are aliases until 2027-01-01: the sheet still draws them (the framed
// caption as the plain one), and this notes each once in SF.deprecations (a
// console line under data-sf-deprecations="warn", and after the date whatever
// the page opted into). Journal: class-content-divider-c188-aliases.
const DEPRECATED = Object.freeze({since: '2026-11-14', remove_after: '2027-01-01'});
export const CONTENT_DIVIDER_CLASS_ALIASES = Object.freeze({
  'sf-divider-content-border': 'sf-divider-content',
  'sf-divider-button': 'sf-button',
});

const pending = new Set(Object.keys(CONTENT_DIVIDER_CLASS_ALIASES));
const selector = () => [...pending].map((name) => `.${name}`).join(',');

function noteAliases(target = document) {
  if (pending.size === 0) return;
  const query = selector();
  const found = [];
  if (target instanceof Element && target.matches?.(query)) found.push(target);
  target.querySelectorAll?.(query).forEach((element) => found.push(element));
  for (const element of found) {
    for (const name of [...pending]) {
      if (!element.classList.contains(name)) continue;
      pending.delete(name);
      noteDeprecated({
        component: 'content-divider',
        kind: 'class',
        from: name,
        to: CONTENT_DIVIDER_CLASS_ALIASES[name],
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
