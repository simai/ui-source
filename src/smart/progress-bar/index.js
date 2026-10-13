import {
  bindProgressBar,
  setProgressBarState,
  unbindProgressBar,
} from '../../component/progress-bar/js/_progressbar';
import SfBaseElement from '../../core/js/smart-base';
import { renderProgressBarTemplate } from './js/templates/default';

class SfProgressBar extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1' },
      value: { default: '0' },
      textPosition: { default: 'none' },
      // The axis is called status, and speaks the shared vocabulary. `tone`
      // and its value `primary` keep working: see contracts/public-api-axes.json.
      status: {default: 'neutral', values: ['neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {neutral: ['primary']}},
      label: { default: '' },
      valueText: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get value() {
    return this.getAttribute('value') || '0';
  }

  set value(nextValue) {
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
      return;
    }

    this.setAttribute('value', String(nextValue));
  }

  get textPosition() {
    return this.getAttribute('text-position') || 'none';
  }

  get status() {
    return this.getProp('status');
  }

  // The legacy name, kept so a consumer reading el.tone still gets an answer.
  get tone() {
    return this.status;
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get valueText() {
    return this.getAttribute('value-text') || '';
  }

  set textPosition(nextValue) {
    if (nextValue === null || nextValue === undefined || nextValue === '') {
      this.removeAttribute('text-position');
      return;
    }

    this.setAttribute('text-position', String(nextValue));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
    });
  }

  template() {
    return renderProgressBarTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      value: Number(this.value || 0),
      textPosition: this.textPosition,
      status: this.status,
      tone: this.tone,
      label: this.label,
      valueText: this.valueText,
    };
  }

  getProgress() {
    return Number(this.value || 0);
  }

  setProgress(nextValue) {
    this.value = nextValue;
    return this;
  }

  setTextPosition(nextValue) {
    this.textPosition = nextValue;
    return this;
  }

  resolveUpdateMode(changedAttributes = []) {
    const directPatchAttributes = ['value', 'text-position', 'tone', 'label', 'value-text'];
    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) => directPatchAttributes.includes(attr))
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom() {
    const root = this.querySelector('.sf-progress-bar');
    if (!root) return false;
    return setProgressBarState(root, {
      value: this.value,
      textPosition: this.textPosition,
      tone: this.tone,
      label: this.label,
      valueText: this.valueText,
    });
  }

  afterRender() {
    if (this._boundRoot) {
      unbindProgressBar(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-progress-bar');
    if (this._boundRoot) {
      bindProgressBar(this._boundRoot);
    }
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindProgressBar(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfProgressBar.define('sf-progress-bar');
