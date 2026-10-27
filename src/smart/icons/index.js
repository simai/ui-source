// The distribution path of sf-icon until 2026-12-01 (change journal
// path-smart-icons-to-icon). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-icon is served from smart/icon/
// (js/icon.js). A page or a doc that still names
// smart/icons/js/icons.js keeps loading a working sf-icon:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-icon here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/icon/ beside its own, unless sf-icon is
//   defined or that script is already on the page;
// - sf-icon has no sheet of its own in the bundle (the class component's sheet
//   is fetched by the rule), so there is no css/icons.css to keep.
//
// The Loader forwards the old bundle name, cl-icons, to cl-icon
// (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';

const FROM = 'smart/icons/';
const TO = 'smart/icon/';
const OWN = /\/icons\/js\/icons(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-icon',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-icon',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-icon')) return;
  const own = doc.currentScript?.src || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/icon/js/icon$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/icon/js/icon.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/icon\/js\/icon(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
