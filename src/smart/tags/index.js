// The distribution path of sf-tag until 2026-12-01 (change journal
// path-smart-tags-to-tag). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-tag is served from smart/tag/
// (js/tag.js, css/tag.css). A page or a doc that still names
// smart/tags/js/tags.js keeps loading a working sf-tag:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-tag here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/tag/ beside its own, unless sf-tag is
//   defined or that script is already on the page;
// - its sheet, css/tags.css, is sf-tag's sheet, built from the same
//   sources as css/tag.css.
//
// The Loader's own rule for the old bundle name, cl-tags, forwards to
// cl-tag (src/smart/tag/rule.js) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';
import '../tag/js/templates/default.css';

const FROM = 'smart/tags/';
const TO = 'smart/tag/';
const OWN = /\/tags\/js\/tags(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-tag',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-tag',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-tag')) return;
  const own = doc.currentScript?.src || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/tag/js/tag$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/tag/js/tag.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/tag\/js\/tag(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
