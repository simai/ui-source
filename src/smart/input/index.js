import {
  bindInput,
  unbindInput,
} from '../../component/inputs/js/_inputs';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { inputSize } from '../../component/field-size';
import { InheritedValueField } from '../helpers/inherited-value';
import { FormField, ShownValidity, innerControlName, syncFieldValidity } from '../helpers/form-field';
import { charCount, countAnnouncement } from '../helpers/char-count';
import { renderInputTemplate } from './js/templates/default';
import { preloadControlIcons } from '../helpers/cycle';
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

class SfInput extends ShownValidity(FormField(InputElement)) {
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
    // The password reveal (C123 (5)): the field's own state, not a setting.
    this._revealed = false;
    // The clear shows while the field holds a value: typing, a paste or the
    // page's own input event say so (C123 (6)).
    this.addEventListener('input', () => {
      this.syncClearAction();
      // The count follows the text (C153 (10), C141 (1)): every edit of a
      // field with a limit redraws the count and, at a threshold, the frame.
      if (this.countLimit !== null) this.requestComponentUpdate?.('count');
    });
    // Escape empties a field that can be cleared -- clearable, or a search
    // field -- when it holds a value (C153 (6)): the clear glyph is no Tab
    // stop, so the key is the keyboard's way to it. An empty field lets the
    // key go on (a window closes, a list folds).
    this.addEventListener('keydown', (event) => this.clearFromKey(event));
    this._countLevel = '';
    this._countSaid = '';
  }

  clearFromKey(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    if (event.target !== this.getInputElement()) return;
    if (this.disabled || this.readonly) return;
    if (!(this.clearable || this.inputType === 'search')) return;
    if (!(this.getInputElement()?.value || '')) return;
    event.preventDefault();
    event.stopPropagation();
    this.clearOwnValue();
    this.syncClearAction();
  }

  // The limit the field counts against (C153 (10)): maxlength, counted and
  // never cut, as sf-input-textarea's (C141 (1)). A masked field keeps the
  // native limit: the mask decides its length.
  get countLimit() {
    if (this.mask) return null;
    const value = Math.trunc(Number(this.getAttribute('maxlength')));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  sfCount() {
    return charCount((this.getInputElement()?.value ?? this.getAttribute('value') ?? '').length, this.countLimit, { always: Boolean(this.counter) });
  }

  // What the template draws of the count, and the polite line, which changes
  // only when a threshold is crossed.
  sfCountView() {
    const count = this.sfCount();
    const words = (state) => this.sfWord('count-text', { vars: { count: state.length, max: state.limit } });
    const said = countAnnouncement(count, this._countLevel, this._countSaid, (state) => (
      state.over ? this.sfTooLongMessage(state) : words(state)
    ));
    this._countLevel = said.level;
    this._countSaid = said.said;
    return { over: count.over, text: count.shown ? words(count) : '', said: said.said };
  }

  sfTooLongMessage(count) {
    return this.sfWord('too-long', { vars: { max: count.limit } });
  }

  get maxlength() {
    return this.countLimit;
  }

  // The native input's validity, and too-long past the counted limit: the
  // native maxlength would cut the text, so the field counts itself.
  sfSyncValidity() {
    const anchor = this.sfValidityAnchor();
    const count = this.sfCount();
    const message = count.over ? this.sfTooLongMessage(count) : '';
    if (!this.sfInternals && anchor?.setCustomValidity) anchor.setCustomValidity(message);
    syncFieldValidity(this, anchor, count.over ? { tooLong: message } : {});
  }

  // The clear (C123 (6)): empties the field the way a reset does -- input,
  // then change, from the native input -- and gives the focus back to it, as
  // the button that had it is gone.
  clearFromButton(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (this.disabled || this.readonly) return;
    this.clearOwnValue();
    this.syncClearAction();
    this.getInputElement()?.focus?.();
  }

  // The password reveal (C123 (5)): a toggle button, aria-pressed, the eye
  // crossed out while the password shows. The native input's type follows;
  // the focus stays on the button.
  toggleReveal(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (this.disabled) return;
    this._revealed = !this._revealed;
    this.requestComponentUpdate('revealed');
  }

  syncClearAction() {
    const clear = this.querySelector(':scope .sf-input-clear');
    if (!clear) return;
    const empty = !(this.getInputElement()?.value || '');
    if (clear.hidden !== empty) clear.hidden = empty;
  }

  // sf-input keeps the ladder's outer steps (1/3 and 3) that the other
  // fields retired (field-size.js inputSize).
  get size() {
    return inputSize(this.getAttribute('size') || '1');
  }

  // element.focus() on the host reaches the native input.
  focusDelegate() {
    return this.getInputElement();
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
    this.syncClearAction?.();
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

  get textStart() {
    return this.getAttribute('text-start') ?? '';
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

  // A form reset puts the default text back without an input event, a task
  // later for a masked field: the clear follows it, and a revealed password
  // is hidden again.
  formResetCallback() {
    super.formResetCallback?.();
    if (this._revealed) {
      this._revealed = false;
      this.requestComponentUpdate('revealed');
    }
    Promise.resolve().then(() => this.syncClearAction());
    setTimeout(() => this.syncClearAction(), 0);
  }

  // The browser's restore of a form (back, reload) gives the text back.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }

  templateContext() {
    const props = this.getPropsContext();
    const hasControlledValue = this.hasAttribute('value');
    const input = this.getInputElement();
    const count = this.sfCountView();

    return this.createTemplateContext({
      ...props,
      // The size the field draws: a retired size is the one it keeps, as
      // the props' closed list alone would read it as the default.
      size: this.size,
      leftIcon: this.iconStart,
      rightText: this.textEnd,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      textEnd: this.textEnd,
      type: this.appearance,
      maskLazy: this.maskLazy,
      // The page's error, or the required one a failed form check shows
      // (ShownRequired, C55 acceptance F1: as sf-dropdown 1.9.0).
      invalid: this.sfShownInvalid(props.invalid || props.error) || count.over,
      error: false,
      errorMessage: this.sfShownMessage(props.invalid || props.error, props.errorMessage),
      // The host is the form control where the browser has ElementInternals,
      // so the native input carries no name (§17.1 item 6).
      controlName: innerControlName(this, props.name),
      value: hasControlledValue ? props.value : (input ? input.value : this.defaultValue),
      defaultValue: this.defaultValue,
      hasControlledValue,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
      revealed: this._revealed && props.inputType === 'password',
      // The «?» after the label (C153 (8), helpers/field-help.js).
      help: props.help || '',
      textStart: this.textStart || '',
      // The count (C153 (10)): its words when shown, over the limit (the
      // error frame), the polite line.
      countable: this.countLimit !== null,
      count: count.text,
      countOver: count.over,
      countSaid: count.said,
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
      const invalid = this.sfShownInvalid(this.invalid) || this.sfCount().over;
      this._boundRoot.classList.toggle('error', invalid);
      this.getInputElement()?.classList.toggle('error', invalid);
      bindInput(this._boundRoot);
    }
    // The reveal's other glyph is asked for with the first drawing, so the
    // crossed eye is there on the first press (as sf-button-copy's check).
    if (this.querySelector(':scope .sf-input-reveal')) preloadControlIcons(this, ['visibility', 'visibility_off']);
    this.syncInheritedState();
    this.syncClearAction();
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
