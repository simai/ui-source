// sf-input-quantity: a number field with «−» and «+» (owner, 2026-10-25). The class
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
// behaviour is its own, and the class binder leaves a root inside sf-input-quantity
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
// focus: then it is rounded to the field's digits and written back in the
// page's format. A number past a bound or off the step is kept as typed, not
// clamped (QR-1): the field shows its error under the box -- the standard
// invalid state, aria-invalid, the range word, said once by a polite status --
// and the form will not submit it (§17.2: the invalid state is shown when the
// validity fails after the person touched the field). The steppers and the
// keys still stop at the bounds.
//
// Since standard simai.smart-component 1.3.8 it is built from its
// component.json (§3, §4, §17, §20): the settings are made by
// core/js/element-manifest.js, the words are lang/<locale>.json, clear,
// step-up, step-down and set-error are actions that answer an outcome (§4.4),
// `error` is a dated alias of `invalid` (§17.2) and sf-field:reset of
// sf-field-reset (aliases.json). The host is the form control through
// ElementInternals: it submits the number with a point (§17.1 item 2),
// reports value-missing, range and step validity, and says on itself when
// the value stands at a bound (data-at-min, data-at-max, §5.3,
// simai/ui-source#46 item 4).
import SfBaseElement from '../../core/js/smart-base';
import {camelName, elementFromManifest} from '../../core/js/element-manifest';
import {pageLocale} from '../../core/js/page-language';
import {createFieldContract} from '../../component/field-contract';
import {ladderSize} from '../../component/field-size';
import {bindFormReset} from '../../component/form-reset-helper';
import {InheritedValueField} from '../helpers/inherited-value';
import {FormField, innerControlName, syncFieldValidity} from '../helpers/form-field';
import {renderQuantityTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
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

// A held stepper waits, then repeats: long enough that a click is one step,
// fast enough that a hundred steps take a few seconds.
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;
// PageUp and PageDown move this many steps unless the field names its own.
const PAGE_STEPS = 10;

// The remove mode for a cart line (owner decision C122). PROVISIONAL NAMES:
// the setting, its label and the event are the research's proposal and wait
// for the owner's word. The code reads them from here only, so a rename is
// this map plus the keys of component.json and lang/*.json (`events.<event>`),
// then generate-component-files. The DOM name of the event follows §8:
// `sf-input-quantity-<event>`.
const REMOVE_MODE = Object.freeze({
  setting: 'removable',
  label: 'remove-label',
  event: 'remove',
});

// The actions (§4.4): each answers an outcome, and none is a person's change,
// so none sends an event, as a native field's stepUp() does not.
const actions = {
  clear() {
    this.setValue(null);
  },
  'step-up'({count} = {}) {
    this.setValue(stepFrom(this.currentValue(), Number(count) || 1, this.stepOptions()));
  },
  'step-down'({count} = {}) {
    this.setValue(stepFrom(this.currentValue(), -(Number(count) || 1), this.stepOptions()));
  },
  // The error message shown in place of the hint, and a custom error the form
  // will not submit over (§17.2: it used to paint only). An empty message
  // clears both.
  'set-error'({message} = {}) {
    const text = String(message ?? '');
    if (text) {
      this.setAttribute('error-message', text);
      this.setAttribute('invalid', '');
    } else {
      this.removeAttribute('error-message');
      this.removeAttribute('invalid');
    }
    this.setCustomValidity(text);
  },
};

const QuantityElement = elementFromManifest(manifest, {
  base: InheritedValueField(SfBaseElement),
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions,
});

class SfQuantity extends FormField(QuantityElement) {
  static get props() {
    return {
      ...super.props,
      templateName: {attribute: 'template', default: 'default'},
      // The value's attribute is its default (§4.3); observed, so writing it
      // moves the field. The manifest's value has no default (empty is no
      // number), so the generated props leave it out.
      value: {default: ''},
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
    // A press that began on the trash (C122): only such a press removes, never
    // the click that ends a held «−» run reaching the bound.
    this._removePress = false;
    // The range or step error a commit showed (QR-1), and what the status
    // says: shown until the value is valid again or the form is reset.
    this._rangeShown = false;
    this._announcement = '';
    this._releaseReset = null;
    this._resetControl = null;
    this.__sfStopHold = () => this.stopHold();
    // The browser's own check (a submit, checkValidity(), reportValidity())
    // fires invalid on the host: a range or step error it found is shown too.
    this.addEventListener('invalid', () => this.showRangeError());
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

  get size() { return ladderSize(this.getAttribute('size')); }
  get ariaLabel() { return this.getProp('ariaLabel') || ''; }
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

  // The look (owner decision C53): steppers on both sides for a quantity, or
  // none for an exact value (a year, a weight, a price), where the keys still
  // step.
  get steppers() {
    return this.getAttribute('steppers') === 'none' ? 'none' : 'sides';
  }

  // A unit written after the number, inside the box («кг», «%»).
  get unit() {
    return (this.getAttribute('unit') || '').trim();
  }

  // The value as the spinbutton says it: the number and its unit.
  get valueText() {
    const text = this.text;
    return text && this.unit ? `${text} ${this.unit}` : text;
  }

  // The characters the number place holds (C53, F1): the attribute, else the
  // longest of the bounds, the value and the inherited value written at the
  // field's digits, at least 2, and 6 when the field has no upper bound. The
  // box is as wide as that number, not as its container.
  get digits() {
    const own = readNumber(this.getAttribute('digits'));
    return own !== null && own >= 1 ? Math.min(20, Math.floor(own)) : null;
  }

  get autoDigits() {
    const options = this.numberOptions;
    const lengths = [this.min, this.max, this.value, readNumber(this.inheritedValue)]
      .filter((number) => typeof number === 'number' && Number.isFinite(number))
      .map((number) => formatNumber(number, options).length);
    let digits = Math.max(2, ...lengths);
    if (this.max === null) digits = Math.max(digits, 6);
    return Math.min(20, digits);
  }

  // The width is written on the box, from the own setting or the reckoned
  // number (F6: a column of fields gives each the same digits). The
  // quantity's public variables are at the ten the standard allows, so the
  // width is a setting, not an eleventh variable.
  get digitsStyle() {
    const own = this.digits;
    return `--sf-quantity--digits: ${own ?? this.autoDigits}`;
  }

  setValue(next) {
    this._value = this.readValue(next);
    this._draft = null;
    this._reported = this._value;
    this._committed = this._value;
    this.requestComponentUpdate('value');
    this.syncControlState();
    return this;
  }

  // ---- The form (§17.1, §17.2) ---------------------------------------------

  // The number with a point and no grouping, '' when empty; nothing while
  // disabled.
  sfFormValue() {
    if (this.disabled) return null;
    return this.formValue;
  }

  // value-missing is the box's own (required, and empty -- an inherited value
  // is a hint and does not count, §20.2); the range and the step are read off
  // the value, which a person may type past a bound and commit: it is kept, and
  // the error is shown (QR-1).
  sfSyncFormState() {
    this.sfSyncForm();
    syncFieldValidity(this, this.getInputElement(), this.ownValidity());
  }

  // What the value breaks that the text box cannot know: {flag: message} for
  // the range and the step, empty while the value keeps them.
  ownValidity(value = this.value) {
    const own = {};
    if (value === null) return own;
    if (this.min !== null && value < this.min) own.rangeUnderflow = this.sfWord('range-underflow', {vars: {min: formatNumber(this.min, this.numberOptions)}});
    if (this.max !== null && value > this.max) own.rangeOverflow = this.sfWord('range-overflow', {vars: {max: formatNumber(this.max, this.numberOptions)}});
    const base = this.min ?? 0;
    const steps = (value - base) / this.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-7) own.stepMismatch = this.sfWord('step-mismatch', {vars: {step: formatNumber(this.step, this.numberOptions)}});
    return own;
  }

  // The first word of what the value breaks, '' while it keeps the rules.
  get rangeMessage() {
    return Object.values(this.ownValidity())[0] || '';
  }

  // The invalid state the field draws: the page's, or the range error a
  // commit showed. The page's message wins; the range word fills in when the
  // page says invalid without one.
  get shownInvalid() {
    return this.invalid || this._rangeShown;
  }

  get shownErrorMessage() {
    if (this.invalid && this.errorMessage) return this.errorMessage;
    return this._rangeShown ? this.rangeMessage : this.errorMessage;
  }

  // A commit, or the browser's own check (a submit, checkValidity()), shows
  // the range error while the value breaks the range or the step, and the
  // status says it once. A valid value takes it away.
  showRangeError() {
    const message = this.rangeMessage;
    const shown = Boolean(message);
    if (shown === this._rangeShown && (!shown || this._announcement === message)) return;
    this._rangeShown = shown;
    this._announcement = message;
    this.requestComponentUpdate('invalid');
  }

  hideRangeError() {
    if (!this._rangeShown) return;
    this._rangeShown = false;
    this._announcement = '';
    this.requestComponentUpdate('invalid');
  }

  // The browser's restore of a form (back, reload): the submitted number.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.setValue(state);
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

  // Focus selects the whole number (C53, F4), so a new one is typed at once,
  // without erasing the old. A pointer that focuses the box would drop the
  // selection on its mouseup: that one mouseup is held back. A second press
  // places the caret as usual.
  onInputMouseDown(event) {
    this._selectOnUp = event.currentTarget !== document.activeElement;
  }

  onInputMouseUp(event) {
    if (this._selectOnUp) event.preventDefault();
    this._selectOnUp = false;
  }

  onInputFocus(event) {
    const input = event.currentTarget;
    if (input?.value) input.select();
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

  // ---- The remove mode (C122) ------------------------------------------------

  // Off by default: a shop may not want removal made easier (a product page).
  // Read through the map, not by its own name, so the generated accessors of
  // the two settings stay the manifest's.
  get removeModeOn() {
    return Boolean(this[camelName(REMOVE_MODE.setting)]);
  }

  get removeModeLabel() {
    return this[camelName(REMOVE_MODE.label)] || '';
  }

  // The «−» is the trash while the mode is on, the field can change and the
  // value stands on its lower bound; a field with no lower bound never shows it.
  removeShown(value = this.value) {
    return this.removeModeOn && this.interactive && this.steppers !== 'none' && this.atMin(value);
  }

  // «0» typed and committed with Enter asks for removal too (Baymard: people
  // type 0 to remove), while 0 is below the bound; with the mode off it is the
  // ordinary out-of-range commit (QR-1).
  typedRemove() {
    if (!this.removeModeOn || !this.interactive || this._draft === null) return false;
    if (this.min === null || !(this.min > 0)) return false;
    return parseNumber(this._draft, this.numberOptions) === 0;
  }

  // The field never removes itself: it asks, and the page removes the line and
  // offers «Вернуть» (C25). Cancelable; answers whether nobody refused.
  requestRemove(source, value = this.value) {
    return this.sfEmit(REMOVE_MODE.event, {value, name: this.name, source}, {cancelable: true});
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

  // `input` and `change` on the host, as sf-input-image sends them: detail
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

  // The typed text, made the value: rounded and written back, kept as typed
  // past a bound (QR-1); the error shows instead of a silent clamp.
  commitDraft(source = 'commit') {
    if (this._draft === null) return false;
    const typed = parseNumber(this._draft, this.numberOptions);
    const next = typed === null || !Number.isFinite(typed)
      ? (typed === null ? null : this.value)
      : roundTo(typed, this.precision);
    this.writeValue(next, source);
    this.showRangeError();
    return true;
  }

  // ---- Native events of the text box ---------------------------------------

  // The text box's own input and change bubble out as plain Events with no
  // detail -- a second event for each one this sends -- so they stop here, as
  // sf-input-image's and sf-input-color's do.
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
      if (this.typedRemove()) {
        // Not refused: the typing is taken back -- the page removes the line.
        // Refused: the «0» goes the ordinary way, kept with its error (QR-1).
        // Either way no implicit submit of the form.
        event.preventDefault();
        if (this.requestRemove('typing', 0)) this.revertDraft();
        else this.commitDraft('commit');
        return;
      }
      this.commitDraft('commit');
      return;
    }
    if (event.key === 'Escape' && this._draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      this.revertDraft();
    }
  }

  // The typing taken back to the committed value.
  revertDraft() {
    this._draft = null;
    this._value = this._committedValue();
    this._reported = this._value;
    this.syncInputText(true);
    this.syncControlState();
    // Back to a committed number past a bound: its error shows again.
    this.showRangeError();
  }

  // ---- The steppers ---------------------------------------------------------

  // A pointer press steps at once and repeats while held; the click that
  // follows it is the same press and is left alone. A click with no pointer
  // behind it (Enter or Space on the button, a screen reader's activation,
  // button.click()) steps once.
  onStepPointerDown(event, direction) {
    this._removePress = false;
    if (event.button !== 0 || !this.interactive) return;
    if (event.currentTarget.disabled) return;
    // The trash takes a press of its own (C122): no step, no hold; the click
    // that follows asks for removal.
    if (direction < 0 && this.removeShown()) {
      this._removePress = true;
      return;
    }
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
    if (direction < 0 && this.removeShown()) {
      // A pointer press that began on the trash, or a click with no pointer
      // behind it (Enter, Space). The click that ends a held «−» run which
      // reached the bound began on the minus and removes nothing.
      const asked = this._removePress || event.detail === 0;
      this._removePress = false;
      if (asked) this.requestRemove('button');
      return;
    }
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

  // The ring follows :focus-visible (standard 1.3.8 §5.3, §16 item 9): the
  // element writes no pointer-focus class. The class component's binder still
  // does, for markup written by hand.

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
        input.setAttribute('aria-valuetext', this.valueText);
      }
    }
    const [minus, plus] = this.querySelectorAll(':scope .sf-quantity-count');
    if (minus) minus.disabled = !this.interactive || (this.atMin(value) && !this.removeShown(value));
    if (plus) plus.disabled = !this.interactive || this.atMax(value);
    // At a bound, said on the host (§5.3, simai/ui-source#46 item 4).
    this.sfHostState('data-at-min', this.atMin(value));
    this.sfHostState('data-at-max', this.atMax(value));
    // A value longer than the bounds foresaw (no upper bound) widens the box
    // without a redraw.
    const wrap = this.querySelector(':scope .sf-quantity-wrap');
    if (wrap && this.digits === null) wrap.style.setProperty('--sf-quantity--digits', String(this.autoDigits));
    const hidden = this.querySelector(':scope .sf-quantity-value');
    if (hidden) hidden.value = this.formValue;
    this.sfSyncFormState();
    // The shown range error goes as soon as the value keeps the rules again,
    // whatever moved it: typing, a step, a value set from script.
    if (this._rangeShown && !this.rangeMessage) this.hideRangeError();
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
        this._rangeShown = false;
        this._announcement = '';
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
    const invalid = this.shownInvalid;
    const errorMessage = this.shownErrorMessage;
    const field = createFieldContract(this, {
      prefix: 'sf-quantity',
      required: this.required,
      invalid,
      hint: this.hint,
      errorMessage,
    });
    const errorContent = this.hasSlotContent?.('error') && !(this._rangeShown && !this.invalid)
      ? this.getSlotContent('error')
      : errorMessage;
    const hintContent = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    const value = this.value;

    return this.createTemplateContext({
      ...props,
      component: this,
      id: field.base,
      field,
      value,
      text: this.text,
      valueText: this.valueText,
      steppers: this.steppers,
      unit: this.unit,
      digitsStyle: this.digitsStyle,
      formValue: this.formValue,
      size: this.size,
      // The host is the form control where the browser has ElementInternals:
      // no hidden input then (§17.1 item 6).
      controlName: innerControlName(this, this.name),
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
      invalid,
      errorMessage,
      announcement: this._announcement,
      ariaLabel: this.ariaLabel,
      decrementLabel: this.decrementLabel,
      incrementLabel: this.incrementLabel,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
      interactive: this.interactive,
      atMin: this.atMin(value),
      atMax: this.atMax(value),
      removeShown: this.removeShown(value),
      removeLabel: this.removeModeLabel,
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

SfQuantity.define('sf-input-quantity');

export {SfQuantity};
