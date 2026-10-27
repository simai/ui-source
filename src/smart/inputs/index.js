// The distribution path of sf-input until 2026-12-01 (change journal
// path-smart-inputs-to-input). The folder took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21: sf-input is served from smart/input/
// (js/input.js, css/input.css). A page or a doc that still names
// smart/inputs/js/inputs.js or smart/inputs/css/inputs.css keeps loading a
// working sf-input:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second copy of sf-input here would
//   be a second class for one tag); it notes the old path in SF.deprecations
//   and adds the script of smart/input/ beside its own, unless sf-input is
//   defined or that script is already on the page;
// - its sheet, css/inputs.css, is sf-input's sheet, built from the same
//   sources as css/input.css.
//
// The Loader's own rule for the old bundle name, cl-inputs, forwards to
// cl-input (src/smart/input/rule.js) and never fetches this file.
import {noteDeprecated} from '../../core/js/deprecations.js';
import '../helpers/inherited-value.css';
import '../input/js/templates/default.css';

const FROM = 'smart/inputs/';
const TO = 'smart/input/';
const OWN = /\/inputs\/js\/inputs(\.min)?\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: 'sf-input',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: 'sf-input',
    since: '2026-10-27',
    remove_after: '2026-12-01',
  });
  if (customElements.get('sf-input')) return;
  const own = doc.currentScript?.src || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/input/js/input$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\/+$/u, '');
    if (!root) return;
    src = `${root}/smart/input/js/input.js`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\/input\/js\/input(\.min)?\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
