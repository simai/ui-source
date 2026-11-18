// The editors' elements from their manifests (standard simai.smart-component
// 1.3.8 §3, §4, §8, §16.20).
//
// sf-sortable, sf-editor-inline and sf-editor-overlay are plain custom
// elements defined by the composition modules (core/js/composition): the
// overlay's bundle carries the drag module too, and a page may define them
// before any Smart base is loaded. They draw nothing through the Smart base
// and keep their own lifecycle. What the manifest gives every component --
// the settings' attributes and properties, sfEmit through the dated aliases,
// sfWord, the declared actions -- they take from elementFromManifest over a
// plain base that answers the two callbacks the generated class calls and
// installs the component's aliases.json once the element is placed.
//
//   const base = manifestHost(manifest, {lang: {en, ru}, source: 'ru', aliases});
//   defineSortable(registry, {base});
import { elementFromManifest } from '../element-manifest.js';
import { installAliases } from '../aliases.js';

export function manifestHost(manifest, options = {}) {
  const Html = globalThis.HTMLElement;
  if (typeof Html !== 'function') return null;

  class PlainHost extends Html {
    connectedCallback() {
      // An element placed inside another element's printed first paint (a
      // list in a board's picture: the board drew the cards into it) is part
      // of that picture, as a Smart element is (smart-base renderComponent):
      // the children there are what the element around it drew, not this
      // element's own static markup. It leaves them, and the element around
      // it replaces the picture when its code comes. Clearing them took a
      // board's cards away whenever sf-sortable's code came first (view
      // round 2 board, 2026-11-18).
      if (this.sfInPicture()) return;
      // Static markup printed for the first paint (standard 1.3.8 §5.4) goes
      // as the element connects: these elements draw in the same task.
      if (!this.__sfFirstPaintEnded) {
        this.__sfFirstPaintEnded = true;
        for (const child of Array.from(this.children)) {
          if (child.hasAttribute('data-sf-static') && !child.hasAttribute('slot')) child.remove();
          else child.removeAttribute('data-sf-held');
        }
        this.removeAttribute('data-sf-first-paint');
      }
      // Installed once and kept while the element is detached, as the Smart
      // base does: a page that moves the element keeps its old names.
      if (this.constructor.aliases && !this.__sfAliases) {
        this.__sfAliases = installAliases(this, this.constructor.aliases, {
          tag: this.localName,
          adapters: this.sfAliasAdapters?.() ?? {},
        });
      }
    }

    disconnectedCallback() {}

    // True while the element stands in a printed first paint: it, or a node
    // around it, is static markup (data-sf-static). A page's own host is
    // never marked, so an element the page wrote ends its first paint.
    sfInPicture() {
      return Boolean(this.closest?.('[data-sf-static]'));
    }

    // The generated actions read the instance's scope (§7.7); a plain host's
    // ends when the page removes it.
    get sfScope() {
      if (!this.__sfScope || (this.__sfScope.signal.aborted && this.isConnected)) this.__sfScope = new AbortController();
      return this.__sfScope.signal;
    }
  }

  return elementFromManifest(manifest, { ...options, base: PlainHost });
}

export default { manifestHost };
