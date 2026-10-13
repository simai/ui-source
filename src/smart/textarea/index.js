import {
  bindTextarea,
  setTextareaState,
  unbindTextarea,
} from '../../component/textarea/js/_textarea';
import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { renderTextareaTemplate } from './js/templates/default';

const TEXTAREA_VARIANTS = new Set(['bordered', 'filled']);
const TEXTAREA_INPUT_MODES = new Set(['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
const TEXTAREA_WRAP_VALUES = new Set(['soft', 'hard']);

function boundedValue(value, allowed, fallback) {
  const normalized = String(value || fallback);
  return allowed.has(normalized) ? normalized : fallback;
}

class SfTextarea extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: {default: 'bordered', values: ['bordered', 'filled'], aliases: ['type']},
      label: { default: '' },
      required: { type: Boolean, default: false },
      placeholder: { default: '' },
      autocomplete: { default: '' },
      inputmode: { default: '' },
      minlength: { type: Number, default: null },
      maxlength: { type: Number, default: null },
      spellcheck: { type: Boolean, default: true },
      wrap: { default: 'soft' },
      hint: { default: '' },
      value: { default: '' },
      name: { default: '' },
      rows: { type: Number, default: 3 },
      disabled: { type: Boolean, default: false },
      readonly: { type: Boolean, default: false },
      error: { type: Boolean, default: false },
      invalid: { type: Boolean, default: false },
      errorMessage: { default: '' },
      mask: { type: Boolean, default: false },
      maskPattern: { default: '' },
      maskOptions: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-textarea');
  }

  get appearance() {
    return this.getProp('appearance');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.appearance;
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get required() {
    return this.getBooleanAttr('required', false);
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  get autocomplete() {
    return this.getAttribute('autocomplete') || '';
  }

  get inputmode() {
    return boundedValue(this.getAttribute('inputmode'), TEXTAREA_INPUT_MODES, '');
  }

  get minlength() {
    const value = this.getNumberAttr('minlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  get maxlength() {
    const value = this.getNumberAttr('maxlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  get spellcheck() {
    return this.getBooleanAttr('spellcheck', true);
  }

  get wrap() {
    return boundedValue(this.getAttribute('wrap'), TEXTAREA_WRAP_VALUES, 'soft');
  }

  get hint() {
    return this.getAttribute('hint') || '';
  }

  get value() {
    const textarea = this.querySelector('.sf-textarea textarea');
    return textarea ? textarea.value : this.getAttribute('value') || '';
  }

  set value(nextValue) {
    const normalizedValue = String(nextValue ?? '');
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', normalizedValue);
    }
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector('textarea');
    if (root?.__sfTextareaMask) root.__sfTextareaMask.value = normalizedValue;
    else if (textarea) textarea.value = normalizedValue;
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  get rows() {
    const value = Math.trunc(this.getNumberAttr('rows', 3));
    return value > 0 ? value : 3;
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get readonly() {
    return this.getBooleanAttr('readonly', false);
  }

  get error() {
    return this.getBooleanAttr('error', false);
  }

  get invalid() {
    return this.getBooleanAttr('invalid', false);
  }

  get errorMessage() {
    return this.getAttribute('error-message') || '';
  }

  get mask() {
    return this.getBooleanAttr('mask', false);
  }

  get maskPattern() {
    return this.getAttribute('mask-pattern') || '';
  }

  get maskOptions() {
    return this.getAttribute('mask-options') || '';
  }

  templateContext() {
    const props = this.getPropsContext();
    const textarea = this.querySelector('textarea');

    return this.createTemplateContext({
      ...props,
      value: this.hasAttribute('value') || !textarea ? props.value : textarea.value,
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
      minlength: this.minlength,
      maxlength: this.maxlength,
    });
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }
  }

  afterRender() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-textarea');
    if (this._boundRoot) {
      bindTextarea(this._boundRoot);
    }
  }

  template() {
    return renderTextareaTemplate(this.templateContext());
  }

  get state() {
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector?.('textarea') || null;
    return {
      value: textarea?.value || '',
      disabled: !!textarea?.disabled,
      invalid: textarea?.getAttribute('aria-invalid') === 'true',
      error: root?.classList?.contains('error') || textarea?.classList?.contains('error') || false,
    };
  }

  setState(nextState = {}) {
    const root = this.querySelector('.sf-textarea');
    return setTextareaState(root, nextState);
  }
}

SfTextarea.define('sf-textarea');
