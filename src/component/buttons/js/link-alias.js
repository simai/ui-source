import {noteDeprecated} from '../../../core/js/deprecations.js';

// sf-button--link is the former name of sf-button--ghost (decision C15,
// journal class-button-link-to-ghost): the sheets draw both the same until
// 2027-01-01, and a page that still writes the former name alone is noted in
// SF.deprecations (with a console line when data-sf-deprecations="warn").
// The Smart sf-button, sf-segmented and sf-alert write both classes until the
// date, so a button that carries ghost as well is not the page's spelling and
// is not noted. noteDeprecated keeps one record per name, so one note is
// enough: the watch stops after it.

export const BUTTON_LINK_ALIAS = Object.freeze({
  component: 'buttons',
  kind: 'class',
  from: 'sf-button--link',
  to: 'sf-button--ghost',
  since: '2026-11-11',
  remove_after: '2027-01-01',
});

const FORMER_ONLY = '.sf-button.sf-button--link:not(.sf-button--ghost)';

export function isFormerLinkOnly(element) {
  return Boolean(element?.classList?.contains('sf-button')
    && element.classList.contains('sf-button--link')
    && !element.classList.contains('sf-button--ghost'));
}

export function noteButtonLink() {
  noteDeprecated(BUTTON_LINK_ALIAS);
}

function found(root) {
  if (!root) return false;
  if (root.nodeType === 1 && isFormerLinkOnly(root)) return true;
  return Boolean(root.querySelector?.(FORMER_ONLY));
}

export function watchButtonLinks(doc = globalThis.document) {
  const view = doc?.defaultView || globalThis;
  if (!doc?.documentElement || view.__sfButtonLinkWatch) return;
  Object.defineProperty(view, '__sfButtonLinkWatch', {value: true, configurable: true});
  let observer = null;
  const done = () => {
    noteButtonLink();
    observer?.disconnect();
    observer = null;
  };
  if (found(doc.documentElement)) {
    done();
    return;
  }
  if (typeof view.MutationObserver !== 'function') return;
  observer = new view.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' ? isFormerLinkOnly(record.target) : [...record.addedNodes].some(found)) {
        done();
        return;
      }
    }
  });
  observer.observe(doc.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
}
