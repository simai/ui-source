import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { bindSpinner, renderSpinner, unbindSpinner } from '../../component/spinner/js/_spinner';
import { SPINNER_LOOKS } from '../../component/spinner/js/_spinner-draw';
import { renderSpinnerTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-spinner from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §4.8): its settings are attributes and properties made by
// core/js/element-manifest.js, its one word («Загрузка…») is lang/<locale>.json
// (a product adds a language through SF.language.register("sf-spinner", code,
// words)), and variant, the pixel geometry and getSpinnerRoot are dated rows
// of aliases.json.
const SpinnerElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
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

class SfSpinner extends SpinnerElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json. Unset, the
      // spinner takes the page's look (data-sf-spinner on html, body or any
      // block; simai/ui-source#11), the arc when the page names none.
      kind: {default: '', values: ['', ...SPINNER_LOOKS], aliases: ['variant']},
      rootClass: { default: '' },
    };
  }

  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, ...PIXEL_GEOMETRY])];
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
