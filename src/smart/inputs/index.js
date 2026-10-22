import {
  bindInput,
  unbindInput,
} from '../../component/inputs/js/_inputs';
import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { renderInputTemplate } from './js/templates/default';

const INPUT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url']);
const INPUT_MODES = new Set(['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
const INPUT_VARIANTS = new Set(['bordered', 'filled', 'hidden']);

const boundedValue = (value, allowed, fallback) => allowed.has(value) ? value : fallback;

class SfInput extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: {default: 'bordered', values: ['bordered', 'filled', 'hidden'], aliases: ['type']},
      label: { default: '' },
      required: { type: Boolean, default: false },
      placeholder: { default: '' },
      inputType: { default: 'text' },
      autocomplete: { default: '' },
      inputmode: { default: '' },
      minlength: { default: '' },
      maxlength: { default: '' },
      pattern: { default: '' },
      hint: { default: '' },
      value: { default: '' },
      defaultValue: { default: '' },
      name: { default: '' },
      iconStart: {type: String, default: null},
      textEnd: {type: String, default: null},
      leftIcon: { default: '' },
      rightText: { default: '' },
      hintIcon: { default: '' },
      rootClass: { default: '' },
      disabled: { type: Boolean, default: false },
      readonly: { type: Boolean, default: false },
      error: { type: Boolean, default: false },
      invalid: { type: Boolean, default: false },
      errorMessage: { default: '' },
      mask: { type: Boolean, default: false },
      maskPattern: { default: '' },
      maskLazy: { default: '' },
      maskPlaceholderChar: { default: '' },
      maskOptions: { default: '' },
      ariaLabel: { attribute: 'aria-label', default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-input');
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

  get inputType() {
    return boundedValue(this.getAttribute('input-type') || 'text', INPUT_TYPES, 'text');
  }

  get autocomplete() {
    return this.getAttribute('autocomplete') || '';
  }

  get inputmode() {
    return boundedValue(this.getAttribute('inputmode') || '', INPUT_MODES, '');
  }

  get minlength() {
    return this.getAttribute('minlength') || '';
  }

  get maxlength() {
    return this.getAttribute('maxlength') || '';
  }

  get pattern() {
    return this.getAttribute('pattern') || '';
  }

  get hint() {
    return this.getAttribute('hint') || '';
  }

  get value() {
    const input = this.getInputElement();
    return input ? input.value : this.getAttribute('value') || '';
  }

  set value(nextValue) {
    const input = this.getInputElement();
    const normalizedValue = String(nextValue ?? '');
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', normalizedValue);
    }
    const mask = this.querySelector('.sf-input')?.__sfInputMask;
    if (mask) mask.value = normalizedValue;
    else if (input && input.value !== normalizedValue) input.value = normalizedValue;
  }

  get defaultValue() {
    return this.getAttribute('default-value') ?? this.getAttribute('value') ?? '';
  }

  set defaultValue(nextValue) {
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('default-value');
      return;
    }

    this.setAttribute('default-value', String(nextValue));
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  get leftIcon() {
    return this.getAttribute('icon-start') ?? this.getAttribute('left-icon') ?? '';
  }

  get rightText() {
    return this.getAttribute('text-end') ?? this.getAttribute('right-text') ?? '';
  }

  get iconStart() {
    return this.leftIcon;
  }

  get textEnd() {
    return this.rightText;
  }

  get hintIcon() {
    return this.getAttribute('hint-icon') || '';
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

  get maskLazy() {
    return this.hasAttribute('mask-lazy')
      ? this.getBooleanAttr('mask-lazy', true)
      : '';
  }

  get maskPlaceholderChar() {
    return this.getAttribute('mask-placeholder-char') || '';
  }

  get maskOptions() {
    return this.getAttribute('mask-options') || '';
  }

  // A field whose label is drawn outside the control -- a record panel prints
  // it, a toolbar has no room for one -- still owes a name. The host's
  // aria-label reaches the native input, which is what assistive technology
  // reads: on the host it named nothing, because the host is not the control.
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
  }

  templateContext() {
    const props = this.getPropsContext();
    const hasControlledValue = this.hasAttribute('value');
    const input = this.getInputElement();

    return this.createTemplateContext({
      ...props,
      leftIcon: props.iconStart ?? props.leftIcon,
      rightText: props.textEnd ?? props.rightText,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      textEnd: this.textEnd,
      type: this.type,
      maskLazy: this.maskLazy,
      value: hasControlledValue ? props.value : (input ? input.value : this.defaultValue),
      defaultValue: this.defaultValue,
      hasControlledValue,
      component: this,
    });
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindInput(this._boundRoot);
      this._boundRoot = null;
    }
  }

  afterRender() {
    if (this._boundRoot) {
      unbindInput(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-input');
    if (this._boundRoot) {
      bindInput(this._boundRoot);
    }
  }

  getInputElement() {
    return this.querySelector('.sf-input-field input, input');
  }

  template() {
    return renderInputTemplate(this.templateContext());
  }

  get state() {
    const root = this.querySelector('.sf-input');
    const input = this.getInputElement();
    return {
      value: input?.value || '',
      disabled: !!input?.disabled,
      invalid: input?.getAttribute('aria-invalid') === 'true',
      error: root?.classList?.contains('error') || input?.classList?.contains('error') || false,
    };
  }

  onInput(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('input', handler, options);
    }

    return this;
  }

  onChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('change', handler, options);
    }

    return this;
  }

  onKeyUp(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('keyup', handler, options);
    }

    return this;
  }

  onKeyDown(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('keydown', handler, options);
    }

    return this;
  }

  onFocus(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusin', handler, options);
    }

    return this;
  }

  onBlur(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusout', handler, options);
    }

    return this;
  }
}

SfInput.define('sf-input');
