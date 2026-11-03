// The distribution path of sf-button-icon (formerly sf-icon-button) until 2027-01-01 (change
// journal path-smart-icon-button-to-button-icon). The folder took the new tag's name: sf-button-icon is
// served from smart/button-icon/ (js/button-icon.js). A page or a doc that still names
// smart/icon-button/js/icon-button.js keeps loading a working element, under either tag:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second class here would be a second
//   class for one tag); it notes the old path in SF.deprecations and adds the
//   script of smart/button-icon/ beside its own, unless sf-button-icon is defined or that
//   script is already on the page;
// - the Loader forwards the old bundle name, cl-icon-button, to cl-button-icon
//   (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
// Written by scripts/rename-smart-tag.mjs.
import {noteDeprecated} from '../../core/js/deprecations.js';
import '../button-icon/js/templates/default.css';

const FROM = 'smart/icon-button/';
const TO = 'smart/button-icon/';
const OWN = /\/icon-button\/js\/icon-button(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-button-icon',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-button-icon',
    since: '2026-11-03',
    remove_after: '2027-01-01',
  });
  if (customElements.get('sf-button-icon')) return;
  // The old path this file was loaded by: document.currentScript while a
  // classic script runs, else the page's script element that names it (a
  // module script has no currentScript).
  const own = [doc.currentScript?.src || '', ...[...doc.querySelectorAll('script[src]')].map((script) => script.src)]
    .find((src) => OWN.test(src)) || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/button-icon/js/button-icon$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/button-icon/js/button-icon.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/button-icon\/js\/button-icon(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
