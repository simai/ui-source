// sf-quantity: a number field with «−» and «+» (owner, 2026-10-25). The class
// component `quantity` draws the stepper and a page could already write its
// markup by hand, but a form built from Smart elements -- the property view
// and the data view among them -- had no field for an integer that steps: an
// sf-input with inputmode="numeric" takes text and leaves the bounds, the
// steps and the keys to the host.
//
// It is a form field like sf-input and sf-textarea: label, hint, error,
// required, disabled, read-only, the three field sizes and the inherited value
// (helpers/inherited-value.js) are the ones every field has. It draws the class
// component's markup, so the quantity sheet is what it looks like; the
// behaviour is its own, and the class binder leaves a root inside sf-quantity
// alone, as the country code's binder leaves its Smart owner's.
//
// The control is the WAI-ARIA spinbutton: a text box with role="spinbutton"
// carrying aria-valuenow, -valuemin, -valuemax and -valuetext. Not a native
// number input, which takes neither the page's decimal comma nor grouped
// thousands and draws spinners of its own. The keys are the pattern's:
// ArrowUp/ArrowDown a step, PageUp/PageDown ten, Home/End the bounds. The two
// steppers are real buttons named «Уменьшить значение» / «Увеличить значение»,
// out of the tab order as the pattern has them -- the keys already do what they
// do -- disabled at the bounds, and a held stepper repeats.
//
// Typing is strict: a character that cannot be part of a number is refused as
// it is typed or pasted. The decimal mark is the page's language's (a comma in
// Russian; the other of «.» and «,» is taken as one too unless the language
// groups with it). The value is committed on Enter and when the field loses
// focus: then it is rounded to the field's digits, clamped to the bounds and
// written back in the page's format.
import SfBaseElement from '../../core/js/smart-base';
import {pageLocale, pageText} from '../../core/js/page-language';
import {createFieldContract} from '../../component/field-contract';
import {FIELD_SIZES, fieldSize} from '../../component/field-size';
import {bindFormReset} from '../../component/form-reset-helper';
import {InheritedValueField} from '../helpers/inherited-value';
import {renderQuantityTemplate} from './js/templates/default';
import {
  clamp,
  formValue,
  formatNumber,
  inferPrecision,
  isEditableText,
  parseNumber,
  readNumber,
  roundTo,
  stepFrom,
} from './value.mjs';

// Every word this component says. A product adds any other language through
// SF.language.register('sf-quantity', code, words).
const QUANTITY_TEXT = {
  en: {decrement: 'Decrease value', increment: 'Increase value'},
  ru: {decrement: 'Уменьшить значение', increment: 'Увеличить значение'},
};

// A held stepper waits, then repeats: long enough that a click is one step,
// fast enough that a hundred steps take a few seconds.
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;
// PageUp and PageDown move this many steps unless the field names its own.
const PAGE_STEPS = 10;

let sequence = 0;

class SfQuantity extends InheritedValueField(SfBaseElement) {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      value: {default: ''},
      name: {default: ''},
      label: {default: ''},
      hint: {default: ''},
      placeholder: {default: ''},
      min: {default: ''},
      max: {default: ''},
      step: {default: '1'},
      pageStep: {attribute: 'page-step', default: ''},
      precision: {default: ''},
      grouping: {type: Boolean, default: true},
      locale: {default: ''},
      size: {default: '1', values: FIELD_SIZES},
      required: {type: Boolean, default: false},
      disabled: {type: Boolean, default: false},
      readonly: {type: Boolean, default: false},
      error: {type: Boolean, default: false},
      invalid: {type: Boolean, default: false},
      errorMessage: {attribute: 'error-message', default: ''},
      decrementLabel: {attribute: 'decrement-label', default: ''},
      incrementLabel: {attribute: 'increment-label', default: ''},
      // The control's name when no label is drawn: a field renderer's panel
      // prints the label beside the field (tests/field-control-accessible-name).
      ariaLabel: {attribute: 'aria-label', default: ''},
      // What the field falls back to while it holds nothing (simai/ui-source#28).
      inheritedValue: {attribute: 'inherited-value', default: ''},
      inheritedText: {attribute: 'inherited-text', default: ''},
      resetLabel: {attribute: 'reset-label', default: ''},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    this._id = `sf-quantity-${++sequence}`;
    // undefined: follow the attribute. Set by the property, a step, a commit or
    // a reset; an attribute written later takes over again.
    this._value = undefined;
    // A value set as a property before the element was defined (a lit `.value`
    // binding on a tag the loader had not upgraded yet) is an own property that
    // would hide the accessor; it is taken through it, as sf-image-field does.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const early = this.value;
      delete this.value;
      this._value = this.readValue(early);
    }
    // The text being typed, until it is committed; null while nobody types.
    this._draft = null;
    // The last value `input` and `change` reported, so each fires once per
    // change: a commit that only reformats the text fires neither.
    this._reported = undefined;
    this._committed = undefined;
    this._hold = null;
    this._releaseReset = null;
    this._resetControl = null;
    this.__sfStopHold = () => this.stopHold();
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next) {
      this._value = undefined;
      this._draft = null;
      this._reported = undefined;
      this._committed = undefined;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  get size() { return fieldSize(this.getAttribute('size') || '1', 'sf-quantity'); }
  get name() { return this.getAttribute('name') || ''; }
  get label() { return this.getAttribute('label') || ''; }
  get hint() { return this.getAttribute('hint') || ''; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get required() { return this.getBooleanAttr('required', false); }
  get disabled() { return this.getBooleanAttr('disabled', false); }
  get readonly() { return this.getBooleanAttr('readonly', false); }
  get error() { return this.getBooleanAttr('error', false); }
  get invalid() { return this.getBooleanAttr('invalid', false); }
  get errorMessage() { return this.getAttribute('error-message') || ''; }
  get ariaLabel() { return this.getProp('ariaLabel') || ''; }
  get grouping() { return this.getBooleanAttr('grouping', true); }
  get locale() { return this.getAttribute('locale') || pageLocale(this); }

  // The bounds: a number, or null when the field has none on that side.
  get min() { return readNumber(this.getAttribute('min')); }
  get max() { return readNumber(this.getAttribute('max')); }

  // A step is positive; anything else is the default, one.
  get step() {
    const step = readNumber(this.getAttribute('step'));
    return step !== null && step > 0 ? step : 1;
  }

  get pageStep() {
    const page = readNumber(this.getAttribute('page-step'));
    return page !== null && page > 0 ? page : this.step * PAGE_STEPS;
  }

  // Digits after the decimal mark: the attribute, else what the step implies
  // (0.25 shows two). An integer field has none and refuses a decimal mark.
  get precision() {
    const own = readNumber(this.getAttribute('precision'));
    if (own !== null && own >= 0) return Math.min(20, Math.floor(own));
    return inferPrecision(this.getAttribute('step') || '1');
  }

  get decrementLabel() { return this.getAttribute('decrement-label') || pageText(QUANTITY_TEXT, 'decrement', this, 'sf-quantity'); }
  get incrementLabel() { return this.getAttribute('increment-label') || pageText(QUANTITY_TEXT, 'increment', this, 'sf-quantity'); }

  get interactive() {
    return !this.disabled && !this.readonly;
  }

  // A negative number may be typed when the field allows one: no lower bound,
  // or one below zero.
  get allowNegative() {
    const {min} = this;
    return min === null || min < 0;
  }

  get numberOptions() {
    return {
      locale: this.locale,
      allowDecimal: this.precision > 0,
      allowNegative: this.allowNegative,
      precision: this.precision,
      grouping: this.grouping,
    };
  }

  // A value from code or an attribute: a number, numeric text written with a
  // point, or nothing. Anything else is nothing, as an unparseable value of a
  // native number field is.
  readValue(raw) {
    const number = readNumber(raw);
    return number === null ? null : roundTo(number, this.precision);
  }

  // The number the field holds, or null when it is empty.
  get value() {
    if (this._value !== undefined) return this._value;
    return this.readValue(this.getAttribute('value'));
  }

  // Set from code, the value is not a change: no event, as for a native field.
  set value(next) {
    this.setValue(next);
  }

  // The value as the form submits it: a point, no grouping, the field's digits.
  get formValue() {
    return formValue(this.value, this.precision);
  }

  // The value as the field writes it: the page's language and digits.
  get text() {
    return formatNumber(this.value, this.numberOptions);
  }

  setValue(next) {
    this._value = this.readValue(next);
    this._draft = null;
    this._reported = this._value;
    this._committed = this._value;
    this.requestComponentUpdate('value');
    return this;
  }

  clear() {
    return this.setValue(null);
  }

  // Steps from code, like a native field's stepUp(): no event.
  stepUp(count = 1) {
    return this.setValue(stepFrom(this.currentValue(), Number(count) || 1, this.stepOptions()));
  }

  stepDown(count = 1) {
    return this.setValue(stepFrom(this.currentValue(), -(Number(count) || 1), this.stepOptions()));
  }

  // The error message shown in place of the hint, or none, as sf-image-field's.
  setError(message = '') {
    const text = String(message ?? '');
    if (text) {
      this.setAttribute('error-message', text);
      this.setAttribute('invalid', '');
    } else {
      this.removeAttribute('error-message');
      this.removeAttribute('invalid');
    }
    return this;
  }

  stepOptions() {
    return {step: this.step, min: this.min, max: this.max, precision: this.precision};
  }

  getInputElement() {
    return this.querySelector(':scope .sf-quantity-wrap input');
  }

  focusDelegate() {
    return this.getInputElement();
  }

  get state() {
    const input = this.getInputElement();
    return {
      value: this.value,
      text: input?.value ?? this.text,
      disabled: this.disabled,
      readonly: this.readonly,
      invalid: input?.getAttribute('aria-invalid') === 'true',
    };
  }

  // The value the field stands on now: a draft that reads as a number counts,
  // so a step taken while typing steps from what was typed.
  currentValue() {
    if (this._draft !== null) {
      const typed = parseNumber(this._draft, this.numberOptions);
      if (typed === null) return null;
      if (Number.isFinite(typed)) return clamp(roundTo(typed, this.precision), this.min, this.max);
    }
    return this.value;
  }

  atMin(value = this.value) {
    return value !== null && this.min !== null && value <= this.min;
  }

  atMax(value = this.value) {
    return value !== null && this.max !== null && value >= this.max;
  }

  // ---- The inherited-value seam -------------------------------------------

  inheritedOwnValue() {
    return this.value === null ? '' : String(this.value);
  }

  inheritedDisplayValue() {
    const number = readNumber(this.inheritedValue);
    return number === null ? this.inheritedValue : formatNumber(number, this.numberOptions);
  }

  inheritedFocusTarget() {
    return this.getInputElement();
  }

  // A reset is a change the person made: input, then change.
  clearOwnValue() {
    this.writeValue(null, 'reset', {change: true});
  }

  // ---- Changes the person makes ---------------------------------------------

  // Writes a value the person chose and says so: `input` when it differs from
  // the last one reported, `change` (when asked) when it differs from the last
  // one committed. Returns whether the value moved.
  writeValue(next, source, {change = true} = {}) {
    const previous = this.value;
    this._value = next;
    this._draft = null;
    // The box, the numbers and the form value now, not at the next frame: Enter
    // commits and submits the form in one press, and the form must read the
    // committed number.
    this.syncInputText(true);
    this.syncControlState();
    this.requestComponentUpdate('value');
    if (next !== this._reportedValue()) {
      this._reported = next;
      this._emit('input', source);
    }
    if (change) this.commitChange(source);
    return next !== previous;
  }

  commitChange(source) {
    const value = this.value;
    if (value === this._committedValue()) return false;
    this._committed = value;
    this._emit('change', source);
    return true;
  }

  _reportedValue() {
    return this._reported === undefined ? this.readValue(this.getAttribute('value')) : this._reported;
  }

  _committedValue() {
    return this._committed === undefined ? this.readValue(this.getAttribute('value')) : this._committed;
  }

  // `input` and `change` on the host, as sf-image-field sends them: detail
  // carries the number (null when empty), the text the field shows, the form
  // name and what made the change -- typing, commit, button, keyboard or reset.
  _emit(type, source) {
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail: {value: this.value, text: this.text, name: this.name, source},
    }));
  }

  // A step by the steppers or the keys: from what is typed, if anything is.
  stepBy(count, source, {change = true} = {}) {
    if (!this.interactive) return false;
    const next = stepFrom(this.currentValue(), count, this.stepOptions());
    if (next === this.value && this._draft === null) {
      if (change) this.commitChange(source);
      return false;
    }
    return this.writeValue(next, source, {change});
  }

  // The typed text, made the value: rounded, clamped, written back.
  commitDraft(source = 'commit') {
    if (this._draft === null) return false;
    const typed = parseNumber(this._draft, this.numberOptions);
    const next = typed === null || !Number.isFinite(typed)
      ? (typed === null ? null : this.value)
      : clamp(roundTo(typed, this.precision), this.min, this.max);
    this.writeValue(next, source);
    return true;
  }

  // ---- Native events of the text box ---------------------------------------

  // The text box's own input and change bubble out as plain Events with no
  // detail -- a second event for each one this sends -- so they stop here, as
  // sf-image-field's and sf-color's do.
  onNativeInput(event) {
    event.stopPropagation();
    const input = event.target;
    this._draft = input.value;
    const typed = parseNumber(this._draft, this.numberOptions);
    const value = typed === null ? null : Number.isFinite(typed) ? roundTo(typed, this.precision) : undefined;
    // Text that is not a number yet («-», «1,») keeps the last value.
    if (value === undefined) return;
    this._value = value;
    this.syncControlState();
    if (value !== this._reportedValue()) {
      this._reported = value;
      this._emit('input', 'typing');
    }
    this.syncInheritedState();
  }

  onNativeChange(event) {
    event.stopPropagation();
    this.commitDraft('commit');
  }

  // Strict typing: what would leave the box holding text that can never be a
  // number is refused before it lands. A paste is taken whole or not at all.
  onBeforeInput(event) {
    if (!this.interactive) return;
    if (!event.inputType?.startsWith('insert')) return;
    const data = event.data ?? event.dataTransfer?.getData?.('text') ?? '';
    if (!data) return;
    const input = event.target;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + data + input.value.slice(end);
    if (!isEditableText(next, this.numberOptions)) event.preventDefault();
  }

  onPaste(event) {
    if (!this.interactive) return;
    const text = (event.clipboardData?.getData('text') ?? '').trim();
    const input = event.target;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + text + input.value.slice(end);
    if (!text || !isEditableText(next, this.numberOptions)) event.preventDefault();
  }

  // The spinbutton's keys (WAI-ARIA APG): a step, a page, the bounds. Enter
  // commits what is typed; Escape takes the typing back.
  onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = {ArrowUp: 1, ArrowDown: -1};
    if (event.key in keys) {
      event.preventDefault();
      this.stepBy(keys[event.key], 'keyboard');
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const pages = this.pageStep / this.step;
      this.stepBy(event.key === 'PageUp' ? pages : -pages, 'keyboard');
      return;
    }
    // Home and End go to the bounds only when there is one; otherwise they
    // stay the caret's keys.
    if (event.key === 'Home' && this.min !== null) {
      event.preventDefault();
      if (this.interactive) this.writeValue(this.min, 'keyboard');
      return;
    }
    if (event.key === 'End' && this.max !== null) {
      event.preventDefault();
      if (this.interactive) this.writeValue(this.max, 'keyboard');
      return;
    }
    if (event.key === 'Enter') {
      this.commitDraft('commit');
      return;
    }
    if (event.key === 'Escape' && this._draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      this._draft = null;
      this._value = this._committedValue();
      this._reported = this._value;
      this.syncInputText(true);
      this.syncControlState();
    }
  }

  // ---- The steppers ---------------------------------------------------------

  // A pointer press steps at once and repeats while held; the click that
  // follows it is the same press and is left alone. A click with no pointer
  // behind it (Enter or Space on the button, a screen reader's activation,
  // button.click()) steps once.
  onStepPointerDown(event, direction) {
    if (event.button !== 0 || !this.interactive) return;
    if (event.currentTarget.disabled) return;
    this.stopHold();
    this.commitDraft('commit');
    this._hold = {direction, moved: false, timer: 0, interval: 0};
    this._hold.moved = this.stepBy(direction, 'button', {change: false});
    if (this.atBound(direction)) {
      this.stopHold();
      return;
    }
    this._hold.timer = setTimeout(() => {
      if (!this._hold) return;
      this._hold.interval = setInterval(() => {
        if (!this._hold) return;
        if (this.stepBy(direction, 'button', {change: false})) this._hold.moved = true;
        if (this.atBound(direction) || !this.interactive) this.stopHold();
      }, REPEAT_INTERVAL);
    }, REPEAT_DELAY);
    for (const type of ['pointerup', 'pointercancel', 'blur']) {
      globalThis.addEventListener?.(type, this.__sfStopHold, {once: true});
    }
  }

  // The button takes no focus from a pointer: the person keeps typing in the
  // box, and a button disabled at a bound has no focus to drop.
  onStepMouseDown(event) {
    event.preventDefault();
  }

  onStepClick(event, direction) {
    event.preventDefault();
    if (event.detail > 0) return;
    this.commitDraft('commit');
    this.stepBy(direction, 'button');
  }

  atBound(direction) {
    return direction > 0 ? this.atMax() : this.atMin();
  }

  // The end of a hold: one change for the whole run of steps.
  stopHold() {
    const hold = this._hold;
    if (!hold) return;
    this._hold = null;
    clearTimeout(hold.timer);
    clearInterval(hold.interval);
    for (const type of ['pointerup', 'pointercancel', 'blur']) {
      globalThis.removeEventListener?.(type, this.__sfStopHold);
    }
    this.commitChange('button');
  }

  // ---- Focus look -------------------------------------------------------------

  // The class sheet draws the field's ring for the keyboard and none for a
  // pointer, by the root's sf-quantity--pointer-focus, as its own binder sets it.
  onPointerFocus() {
    this.querySelector(':scope .sf-quantity')?.classList.add('sf-quantity--pointer-focus');
  }

  onKeyboardFocus() {
    this.querySelector(':scope .sf-quantity')?.classList.remove('sf-quantity--pointer-focus');
  }

  onFocusOut(event) {
    if (event.relatedTarget && this.contains(event.relatedTarget)) return;
    this.querySelector(':scope .sf-quantity')?.classList.remove('sf-quantity--pointer-focus');
  }

  // ---- Drawing ----------------------------------------------------------------

  // The text box shows the draft while someone types, the value written in the
  // page's format otherwise. Written here, not bound in the template, so a
  // redraw while typing never moves the caret.
  syncInputText(force = false) {
    const input = this.getInputElement();
    if (!input) return;
    if (this._draft !== null && !force) return;
    const text = this._draft ?? this.text;
    if (input.value !== text) input.value = text;
  }

  // The spinbutton's numbers and the steppers' bounds, without a redraw.
  syncControlState() {
    const input = this.getInputElement();
    const value = this.value;
    if (input) {
      if (value === null) {
        input.removeAttribute('aria-valuenow');
        input.removeAttribute('aria-valuetext');
      } else {
        input.setAttribute('aria-valuenow', String(value));
        input.setAttribute('aria-valuetext', this.text);
      }
    }
    const [minus, plus] = this.querySelectorAll(':scope .sf-quantity-count');
    if (minus) minus.disabled = !this.interactive || this.atMin(value);
    if (plus) plus.disabled = !this.interactive || this.atMax(value);
    const hidden = this.querySelector(':scope .sf-quantity-value');
    if (hidden) hidden.value = this.formValue;
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.syncInputText();
    this.syncControlState();
    const input = this.getInputElement();
    if (input !== this._resetControl) {
      this._releaseReset?.();
      this._resetControl = input;
      // A form reset puts the attribute's value back, without events.
      this._releaseReset = input ? bindFormReset(input, () => {
        this._value = undefined;
        this._draft = null;
        this._reported = undefined;
        this._committed = undefined;
        this.requestComponentUpdate('reset');
      }) : null;
    }
    this.syncInheritedState();
    return undefined;
  }

  onDisconnected() {
    this.stopHold();
    this._releaseReset?.();
    this._releaseReset = null;
    this._resetControl = null;
    super.onDisconnected();
  }

  templateContext() {
    const props = this.getPropsContext();
    const field = createFieldContract(this, {
      prefix: 'sf-quantity',
      required: this.required,
      invalid: this.invalid || this.error,
      hint: this.hint,
      errorMessage: this.errorMessage,
    });
    const errorContent = this.hasSlotContent?.('error') ? this.getSlotContent('error') : this.errorMessage;
    const hintContent = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    const value = this.value;

    return this.createTemplateContext({
      ...props,
      component: this,
      id: this._id,
      field,
      value,
      text: this.text,
      formValue: this.formValue,
      size: this.size,
      name: this.name,
      label: this.label,
      hint: this.hint,
      placeholder: this.placeholder,
      min: this.min,
      max: this.max,
      step: this.step,
      pageStep: this.pageStep,
      precision: this.precision,
      grouping: this.grouping,
      locale: this.locale,
      required: this.required,
      disabled: this.disabled,
      readonly: this.readonly,
      error: this.error,
      invalid: this.invalid,
      errorMessage: this.errorMessage,
      ariaLabel: this.ariaLabel,
      decrementLabel: this.decrementLabel,
      incrementLabel: this.incrementLabel,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
      interactive: this.interactive,
      atMin: this.atMin(value),
      atMax: this.atMax(value),
      shownPlaceholder: this.hasInheritedValue ? this.inheritedDisplayValue() : this.placeholder,
      message: field.invalid && errorContent ? errorContent : hintContent,
      messageKind: field.invalid && errorContent ? 'error' : 'hint',
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderQuantityTemplate(this.templateContext());
  }
}

SfQuantity.define('sf-quantity');

export {SfQuantity};
