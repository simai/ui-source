// The distribution path of sf-header-site (formerly sf-site-header) until 2027-01-01 (change
// journal path-smart-site-header-to-header-site). The folder took the new tag's name: sf-header-site is
// served from smart/header-site/ (js/header-site.js). A page or a doc that still names
// smart/site-header/js/site-header.js keeps loading a working element, under either tag:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second class here would be a second
//   class for one tag); it notes the old path in SF.deprecations and adds the
//   script of smart/header-site/ beside its own, unless sf-header-site is defined or that
//   script is already on the page;
// - the Loader forwards the old bundle name, cl-site-header, to cl-header-site
//   (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
// Written by scripts/rename-smart-tag.mjs.
import {noteDeprecated} from '../../core/js/deprecations.js';

const FROM = 'smart/site-header/';
const TO = 'smart/header-site/';
const OWN = /\/site-header\/js\/site-header(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-header-site',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-header-site',
    since: '2026-11-03',
    remove_after: '2027-01-01',
  });
  if (customElements.get('sf-header-site')) return;
  // The old path this file was loaded by: document.currentScript while a
  // classic script runs, else the page's script element that names it (a
  // module script has no currentScript).
  const own = [doc.currentScript?.src || '', ...[...doc.querySelectorAll('script[src]')].map((script) => script.src)]
    .find((src) => OWN.test(src)) || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/header-site/js/header-site$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/header-site/js/header-site.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/header-site\/js\/header-site(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
