// The distribution path of sf-icon-button until 2026-12-01 (change journal
// path-smart-icon-buttons-to-icon-button). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-icon-button is served from smart/icon-button/
// (js/icon-button.js, css/icon-button.css). A page or a doc that still names
// smart/icon-buttons/js/icon-buttons.js keeps loading a working sf-icon-button:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-icon-button here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/icon-button/ beside its own, unless sf-icon-button is
//   defined or that script is already on the page;
// - its sheet, css/icon-buttons.css, is sf-icon-button's sheet, built from the same
//   sources as css/icon-button.css.
//
// The Loader forwards the old bundle name, cl-icon-buttons, to cl-icon-button
// (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';
import '../icon-button/js/templates/default.css';

const FROM = 'smart/icon-buttons/';
const TO = 'smart/icon-button/';
const OWN = /\/icon-buttons\/js\/icon-buttons(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-icon-button',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-icon-button',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-icon-button')) return;
  // The old path this file was loaded by: document.currentScript while a
  // classic script runs, else the page's script element that names it (a
  // module script has no currentScript).
  const own = [doc.currentScript?.src || '', ...[...doc.querySelectorAll('script[src]')].map((script) => script.src)]
    .find((src) => OWN.test(src)) || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/icon-button/js/icon-button$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/icon-button/js/icon-button.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/icon-button\/js\/icon-button(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
