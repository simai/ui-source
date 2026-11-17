import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { bindSpinner, renderSpinner, unbindSpinner } from '../../component/spinner/js/_spinner';

// The kind values: the arc (or none, which is the arc).
const SPINNER_KINDS = ['', 'arc'];
import { renderSpinnerTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// sf-spinner from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §4.8): its settings are attributes and properties made by
// core/js/element-manifest.js, its one word («Загрузка…») is lang/<locale>.json
// (a product adds a language through SF.language.register("sf-spinner", code,
// words)), and variant, the pixel geometry and getSpinnerRoot are dated rows
// of aliases.json.
const SpinnerElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  aliases,
  actions: {
    'refresh-spinner'() {
      if (this._boundRoot) renderSpinner(this._boundRoot);
      return { outcome: 'applied' };
    },
  },
});

// The pixel geometry deprecated since 1.1.0 (journal
// attribute-spinner-pixel-geometry): no longer settings, still drawn by the
// shared spinner, which notes each use, until the sweep.
const PIXEL_GEOMETRY = ['width', 'height', 'stroke-width', 'dot-radius'];

// The dots look's settings, retired with the look (owner decision C130 (5);
// Smart joint pass SM-SP-3, 2026-11-17; journal
// attribute-spinner-dots-settings-retired): the arc has no dots, so dots,
// filled and direction draw nothing. Accepted and noted until the date.
const DOTS_SETTINGS = ['dots', 'filled', 'direction'];
const DOTS_RETIRED = {since: '2026-11-17', remove_after: '2027-01-01'};

class SfSpinner extends SpinnerElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json. One look,
      // the arc (owner decision C130 (5)): breathing, comet and dots are dated
      // value aliases of arc (aliases.json) and draw the arc.
      kind: {default: '', values: SPINNER_KINDS, aliases: ['variant']},
      rootClass: { default: '' },
    };
  }

  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, ...PIXEL_GEOMETRY, ...DOTS_SETTINGS])];
  }

  constructor() {
    super();
    this._boundRoot = null;
  }

  get kind() {
    return this.getProp('kind');
  }

  set kind(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('kind');
    else this.setAttribute('kind', String(value));
  }

  templateContext() {
    const props = this.getPropsContext();
    for (const name of DOTS_SETTINGS) {
      if (this.hasAttribute(name)) {
        noteDeprecated({ component: 'sf-spinner', tag: 'sf-spinner', kind: 'attribute', from: name, to: null, ...DOTS_RETIRED });
      }
    }

    return this.createTemplateContext({
      ...props,
      // label="" is a spinner with no words -- the table's, which names its
      // busy state elsewhere; only an absent label takes the language file's.
      label: this.label,
      width: this.getAttribute('width') || '',
      height: this.getAttribute('height') || '',
      strokeWidth: this.getAttribute('stroke-width') || '',
      dotRadius: this.getAttribute('dot-radius') || '',
      component: this,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderSpinnerTemplate(this.templateContext());
  }

  afterRender() {
    if (this._boundRoot) {
      unbindSpinner(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-loader-container');
    if (this._boundRoot) {
      bindSpinner(this._boundRoot);
    }
  }

  afterUpdate() {
    if (this._boundRoot) {
      renderSpinner(this._boundRoot);
    }
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindSpinner(this._boundRoot);
      this._boundRoot = null;
    }
  }

  // §4.4: a reader retires; kept until the date and noted on each call.
  getSpinnerRoot() {
    noteDeprecated({ component: 'sf-spinner', tag: 'sf-spinner', kind: 'action', from: 'getSpinnerRoot', to: null,
      since: aliases.since, remove_after: aliases.remove_after });
    return this.querySelector('.sf-loader-container');
  }
}

SfSpinner.define('sf-spinner');
