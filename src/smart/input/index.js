import {
  bindInput,
  unbindInput,
} from '../../component/inputs/js/_inputs';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { fieldSize } from '../../component/field-size';
import { InheritedValueField } from '../helpers/inherited-value';
import { FormField, innerControlName } from '../helpers/form-field';
import { renderInputTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-input from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §17, §20). The settings are made by core/js/element-manifest.js; the
// legacy names `type` (appearance), `error` (invalid, §17.2), `left-icon`
// (icon-start) and `right-text` (text-end) are dated aliases (aliases.json),
// and so is the trait's old event sf-field:reset (sf-field-reset). The host is
// the form control through ElementInternals: it submits the text, reports the
// native input's validity, and the native input carries no name (§17.1).
const InputElement = elementFromManifest(manifest, {
  base: InheritedValueField(SfBaseElement),
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfInput extends FormField(InputElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: { default: '' },
      ariaLabel: { attribute: 'aria-label', default: '' },
      // What the field falls back to while it holds nothing (simai/ui-source#28):
      // shown as inherited, with a reset back to it once a value is typed.
      inheritedValue: { attribute: 'inherited-value', default: '' },
      inheritedText: { attribute: 'inherited-text', default: '' },
      resetLabel: { attribute: 'reset-label', default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-input');
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
    this.sfSyncFormState?.();
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

  get iconStart() {
    return this.getAttribute('icon-start') ?? '';
  }

  get textEnd() {
    return this.getAttribute('text-end') ?? '';
  }

  get maskLazy() {
    return this.hasAttribute('mask-lazy')
      ? this.getBooleanAttr('mask-lazy', true)
      : '';
  }

  // A field whose label is drawn outside the control -- a record panel prints
  // it, a toolbar has no room for one -- still owes a name. The host's
  // aria-label reaches the native input, which is what assistive technology
  // reads: on the host it named nothing, because the host is not the control.
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
  }

  // The inherited-value seam: the native input is the value, the focus and
  // what carries the description.
  inheritedFocusTarget() {
    return this.getInputElement();
  }

  // A reset is a change the person made, so it is said the way typing is: input,
  // then change, from the native input -- every listener on the host hears it
  // as it hears an edit.
  clearOwnValue() {
    const input = this.getInputElement();
    // A field without a `value` attribute keeps none: writing one would switch
    // the template to its controlled input, a new element, and the focus the
    // reset gives back would land on the one taken away.
    if (this.hasAttribute('value')) {
      this.value = '';
    } else {
      const mask = this.querySelector('.sf-input')?.__sfInputMask;
      if (mask) mask.value = '';
      else if (input) input.value = '';
    }
    input?.dispatchEvent(new Event('input', {bubbles: true}));
    input?.dispatchEvent(new Event('change', {bubbles: true}));
  }

  // The browser's restore of a form (back, reload) gives the text back.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }

  templateContext() {
    const props = this.getPropsContext();
    const hasControlledValue = this.hasAttribute('value');
    const input = this.getInputElement();

    return this.createTemplateContext({
      ...props,
      // The size the field draws: a retired size (1/3) is the one it keeps,
      // as the props' closed list alone would read it as the default.
      size: this.size,
      leftIcon: this.iconStart,
      rightText: this.textEnd,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      textEnd: this.textEnd,
      type: this.appearance,
      maskLazy: this.maskLazy,
      // The host is the form control where the browser has ElementInternals,
      // so the native input carries no name (§17.1 item 6).
      controlName: innerControlName(this, props.name),
      value: hasControlledValue ? props.value : (input ? input.value : this.defaultValue),
      defaultValue: this.defaultValue,
      hasControlledValue,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
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
      // The host's invalid is the state; the classes follow it. The template
      // draws the root's class, but the native input's `error` class is put
      // there by the binding (syncFieldContract) and no render takes it off --
      // and the binding read it back as "still invalid", so removing `invalid`
      // cleared the message while the red border and aria-invalid="true" came
      // back (Larena acceptance, 2026-10-22: the datetime's time field after
      // «Укажите время» and then 10:30).
      const invalid = this.invalid;
      this._boundRoot.classList.toggle('error', invalid);
      this.getInputElement()?.classList.toggle('error', invalid);
      bindInput(this._boundRoot);
    }
    this.syncInheritedState();
    this.sfSyncFormState();
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
