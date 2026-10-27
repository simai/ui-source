// The distribution path of sf-button until 2026-12-01 (change journal
// path-smart-buttons-to-button). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-button is served from smart/button/
// (js/button.js). A page or a doc that still names
// smart/buttons/js/buttons.js keeps loading a working sf-button:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-button here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/button/ beside its own, unless sf-button is
//   defined or that script is already on the page;
// - sf-button has no sheet of its own in the bundle (the class component's sheet
//   is fetched by the rule), so there is no css/buttons.css to keep.
//
// The Loader forwards the old bundle name, cl-buttons, to cl-button
// (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';

const FROM = 'smart/buttons/';
const TO = 'smart/button/';
const OWN = /\/buttons\/js\/buttons(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-button',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-button',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-button')) return;
  const own = doc.currentScript?.src || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/button/js/button$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/button/js/button.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/button\/js\/button(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
