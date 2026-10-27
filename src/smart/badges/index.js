// The distribution path of sf-badge until 2026-12-01 (change journal
// path-smart-badges-to-badge). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-badge is served from smart/badge/
// (js/badge.js). A page or a doc that still names
// smart/badges/js/badges.js keeps loading a working sf-badge:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-badge here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/badge/ beside its own, unless sf-badge is
//   defined or that script is already on the page;
// - sf-badge has no sheet of its own in the bundle (the class component's sheet
//   is fetched by the rule), so there is no css/badges.css to keep.
//
// The Loader forwards the old bundle name, cl-badges, to cl-badge
// (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';

const FROM = 'smart/badges/';
const TO = 'smart/badge/';
const OWN = /\/badges\/js\/badges(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-badge',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-badge',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-badge')) return;
  const own = doc.currentScript?.src || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/badge/js/badge$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/badge/js/badge.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/badge\/js\/badge(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
