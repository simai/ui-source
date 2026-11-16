// The watch of an ignored region's glyphs for an element not on the Smart
// base (core.runtime 1.54.0, 2026-11-11), called by element-manifest.js's
// connectedCallback. Not a shared runtime module and not a public name.

// A region the Loader's page scan passes by (loader.js OBSERVER_IGNORE_SELECTOR).
const IGNORED_REGION = '[data-sf-observer="ignore"]';

// Two class lists that differ in sf-icon-loaded alone, the Loader's own mark.
function sameClasses(before, after) {
  const tokens = (value) => String(value ?? '').split(/\s+/u).filter((token) => token && token !== 'sf-icon-loaded').sort().join(' ');
  return tokens(before) === tokens(after);
}

/**
 * The class-markup glyphs (<i class="sf-icon">) of an element that is not on
 * the Smart base -- sf-sortable, sf-editor-inline, sf-editor-overlay,
 * sf-resizer -- inside a data-sf-observer="ignore" region. The Loader's page
 * scan and mutation observer pass such a region by, and these elements have no
 * drawing the Smart base could hand over (smart-base.js adoptIgnoredGlyphs),
 * so they draw when they like: the sortable's inserter, a toolbar on a
 * selection. While the element is placed in such a region, what it holds now
 * and every glyph added or renamed under it later goes to
 * SF.Loader.adoptStaticIcons, which asks for it and marks it loaded. A
 * rename is any of the ways the Loader's page observer sees one: the glyph's
 * text, its data-icon (read before the text, iconSubsetRuntime.js
 * getTrackedStaticIconAttrs), and its class -- an element that becomes an
 * sf-icon, or a weight or size class. sf-icon-loaded, which the Loader itself
 * writes, is no change, so marking a glyph never asks for it again. Outside a
 * region the page scan finds them, and nothing is watched. Answers the
 * observer to stop, or null. Its own module, outside the shared runtime's
 * exports, so the unit test (tests/ignored-region-glyphs.contract.test.mjs)
 * can drive it; element-manifest.js calls it.
 */
export function watchIgnoredGlyphs(element) {
  if (!element.closest?.(IGNORED_REGION)) return null;
  const Observer = globalThis.MutationObserver;
  const adopt = (root) => {
    const loader = globalThis.SF?.Loader;
    if (typeof loader?.adoptStaticIcons === 'function') {
      loader.adoptStaticIcons(root);
      return;
    }
    // Placed before the Loader is ready: the whole element once it is.
    if (element.__sfGlyphsAwaitLoader) return;
    element.__sfGlyphsAwaitLoader = true;
    globalThis.addEventListener?.('sf-loader-ready', () => {
      element.__sfGlyphsAwaitLoader = false;
      if (element.isConnected && element.closest?.(IGNORED_REGION)) adopt(element);
    }, {once: true});
  };
  adopt(element);
  if (typeof Observer !== 'function') return null;
  const observer = new Observer((records) => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'attributes') {
        const glyph = record.target;
        if (!glyph.classList?.contains?.('sf-icon')) continue;
        const now = glyph.getAttribute(record.attributeName);
        if (record.attributeName === 'class' ? sameClasses(record.oldValue, now) : record.oldValue === now) continue;
        roots.add(glyph);
        continue;
      }
      if (record.type === 'characterData') {
        const glyph = record.target.parentElement?.closest?.('.sf-icon');
        if (glyph) roots.add(glyph);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) roots.add(node);
        else if (node.nodeType === 3 && node.parentElement?.classList?.contains('sf-icon')) roots.add(node.parentElement);
      }
    }
    for (const root of roots) if (root.isConnected) adopt(root);
  });
  observer.observe(element, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'data-icon'], attributeOldValue: true,
  });
  return observer;
}

export default { watchIgnoredGlyphs };
