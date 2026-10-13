import SfBaseElement from '../../core/js/smart-base';
import { bindSpinner, renderSpinner, unbindSpinner } from '../../component/spinner/js/_spinner';
import { renderSpinnerTemplate } from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-spinner", code, words).
const SPINNER_TEXT = {
  en: {
    label: 'Loading...',
  },
  ru: {
    label: 'Загрузка…',
  },
};


class SfSpinner extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      width: { default: '' },
      height: { default: '' },
      label: { default: '' },
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'arc', values: ['arc', 'dots'], aliases: ['variant']},
      dots: { default: '16' },
      filled: { default: '6' },
      strokeWidth: { default: '' },
      dotRadius: { default: '' },
      infinite: { type: Boolean, default: false },
      announce: { type: Boolean, default: false },
      direction: { default: 'clockwise' },
      rootClass: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get width() {
    return this.getAttribute('width') || '';
  }

  get height() {
    return this.getAttribute('height') || '';
  }

  // label="" is a spinner with no words -- the table's, which names its busy
  // state elsewhere -- and it read as unset, so the page language's «Загрузка…»
  // appeared under it. Only an absent label takes the dictionary's.
  get label() {
    return this.hasAttribute('label') ? this.getAttribute('label') : pageText(SPINNER_TEXT, "label", this);
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.variant still gets an answer.
  get variant() {
    return this.kind;
  }

  get dots() {
    return this.getAttribute('dots') || '16';
  }

  get filled() {
    return this.getAttribute('filled') || '6';
  }

  get strokeWidth() {
    return this.getAttribute('stroke-width') || '';
  }

  get dotRadius() {
    return this.getAttribute('dot-radius') || '';
  }

  get infinite() {
    return this.getBooleanAttr('infinite', false);
  }

  get announce() {
    return this.getBooleanAttr('announce', false);
  }

  get direction() {
    return this.getAttribute('direction') || 'clockwise';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      label: this.label,
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

    this._boundRoot = this.getSpinnerRoot();
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

  getSpinnerRoot() {
    return this.querySelector('.sf-loader-container');
  }

  refreshSpinner() {
    if (this._boundRoot) {
      renderSpinner(this._boundRoot);
    }

    return this;
  }
}

SfSpinner.define('sf-spinner');
