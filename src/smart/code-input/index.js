// sf-code-input: a one-time code -- from a message, an authenticator, an email
// -- as a form field with its own value, paste and errors, drawn as the class
// verification (src/component/verification) so its styles apply and nothing
// of them is forked (owner, 2026-10-25).
//
// One native input holds the whole code, as the class's canonical contract
// does: it is the form value, the focus, what autofill from a message
// (autocomplete="one-time-code"), WebOTP and a paste write to, and the one
// thing a screen reader edits. The cells are a picture of it. A field per
// character would split paste, autofill and the editing target (the class
// docs retired that markup for new pages), so the element gives the one field
// what cells have: a character typed into a filled cell takes its place,
// Backspace clears the cell before the caret and steps back (the code has no
// gaps: what follows moves up), the arrows, Home and End move between the cells, a click puts the caret in the cell clicked,
// and a polite line the input is described by says which cell the caret is in
// («цифра 3 из 6», in the page's language).
//
// The class runtime is loaded with the sheet; the drawn field carries
// data-sf-verification-owner, so it binds nothing to it and the code has one
// owner.
//
// Since standard simai.smart-component 1.3.8 it is built from its
// component.json (§3, §4, §17): the settings are made by
// core/js/element-manifest.js, the words are lang/<locale>.json, the whole
// code is the fact `completed` (sf-code-input-completed; the old
// sf-code-input:complete follows it through aliases.json, as `error` follows
// `invalid`, §17.2), the ids come from the field's instance path and never a
// counter (§7.1.1, simai/ui-source#41), and the host is the form control
// through ElementInternals: it submits the code and reports the input's
// validity, and the input carries no name (§17.1).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {fieldSize} from '../../component/field-size';
import {createFieldContract} from '../../component/field-contract';
import {FormField, innerControlName} from '../helpers/form-field';
import {renderCodeInputTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import {
  MASK_GLYPH,
  applyEdit,
  applyPaste,
  codeInputMode,
  codeLength,
  codeMode,
  codePattern,
  currentCell,
  normaliseCode,
  positionWords,
} from './code.mjs';
import './scss/index.scss';

const CodeInputElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

class SfCodeInput extends FormField(CodeInputElement) {
  static get props() {
    return {
      ...super.props,
      templateName: {attribute: 'template', default: 'default'},
      ariaLabel: {attribute: 'aria-label', default: ''},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    // The value the last complete event was sent for: one event per code.
    this._completed = '';
    // Where the selection stood before an edit (beforeinput), so typing over
    // a selection replaces it and typing into a cell takes the cell's place.
    this._selection = null;
    // What the field held when it took focus, and whether the native change
    // spoke for it: an edit the element rewrote may leave the browser with
    // nothing to report, and a commit is said once either way.
    this._focusValue = null;
    this._changeSent = false;
    this._form = null;
    this.addEventListener('beforeinput', this.onBeforeInput);
    this.addEventListener('input', this.onInput, true);
    this.addEventListener('paste', this.onPaste);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('click', this.onClick);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    this.addEventListener('change', this.onNativeChange, true);
    this.addEventListener('select', this.onCaret);
    this.addEventListener('selectionchange', this.onCaret);
    this.addEventListener('keyup', this.onCaret);
  }

  get length() {
    return codeLength(this.getAttribute('length'));
  }

  get mode() {
    return codeMode(this.getAttribute('mode'));
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-code-input');
  }

  get ariaLabel() { return this.getProp('ariaLabel') || ''; }

  // The code: the native input's, kept to the mode and the length.
  get value() {
    const input = this.getInputElement();
    return normaliseCode(input ? input.value : (this.getAttribute('value') ?? this.defaultValue), this.mode, this.length);
  }

  // Setting the value writes the field and its cells, as the native input's
  // own value does: no input, change or complete event, which are the
  // person's.
  set value(next) {
    const value = next === null || next === undefined ? '' : normaliseCode(next, this.mode, this.length);
    if (next === null || next === undefined) this.removeAttribute('value');
    else this.setAttribute('value', value);
    const input = this.getInputElement();
    if (input && input.value !== value) input.value = value;
    this._lastValue = value;
    this._completed = value.length === this.length ? value : '';
    this.syncCells();
    this.sfSyncFormState?.();
  }

  get defaultValue() {
    return this.getAttribute('default-value') ?? this.getAttribute('value') ?? '';
  }

  set defaultValue(next) {
    if (next === null || next === undefined) this.removeAttribute('default-value');
    else this.setAttribute('default-value', String(next));
  }

  // Whether every cell holds a character.
  get complete() {
    return this.value.length === this.length;
  }

  getInputElement() {
    return this.querySelector(':scope .sf-verification-input');
  }

  focusDelegate() {
    return this.getInputElement();
  }

  text(key) {
    return this.sfWord(key);
  }

  // «цифра 3 из 6» -- the cell the caret is in, in the page's language.
  positionText(cell) {
    return positionWords(this.text(this.mode === 'numeric' ? 'digit' : 'character'), cell, this.length);
  }

  ownInput(target) {
    const input = this.getInputElement();
    return input && target === input ? input : null;
  }

  editable(input) {
    return input && !input.disabled && !input.readOnly;
  }

  onBeforeInput = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    this._selection = {start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0};
    // A typed character the mode does not keep is not written at all.
    if (event.inputType === 'insertText' && typeof event.data === 'string'
      && event.data.length > 0 && normaliseCode(event.data, this.mode, this.length) === '') {
      event.preventDefault();
    }
  };

  // Every edit, read after the browser applied it and set right: the value
  // kept to the mode and length, a typed character in its cell. The native
  // input event goes on to the host's listeners with the value already right.
  onInput = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    const previous = this._lastValue ?? '';
    const {value, caret} = applyEdit({
      previous,
      raw: input.value,
      caret: input.selectionStart ?? input.value.length,
      data: event.data ?? null,
      inputType: event.inputType || '',
      selection: this._selection,
      mode: this.mode,
      length: this.length,
    });
    this._selection = null;
    if (input.value !== value) {
      input.value = value;
      if (document.activeElement === input) input.setSelectionRange(caret, caret);
    }
    this.afterEdit(input);
  };

  // A paste writes the code, kept to the mode: a whole code fills every cell
  // wherever the caret was, a part goes in at the caret.
  onPaste = (event) => {
    const input = this.ownInput(event.target);
    if (!this.editable(input)) return;
    const text = event.clipboardData?.getData('text') ?? '';
    event.preventDefault();
    const next = applyPaste({
      previous: input.value,
      text,
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
      mode: this.mode,
      length: this.length,
    });
    if (!next || next.value === input.value) return;
    input.value = next.value;
    input.setSelectionRange(next.caret, next.caret);
    input.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertFromPaste'}));
  };

  afterEdit(input) {
    const value = input.value;
    this._lastValue = value;
    if (this.hasAttribute('value')) {
      // A controlled field follows the person; the attribute says what they typed.
      this._writingValue = true;
      this.setAttribute('value', value);
      this._writingValue = false;
    }
    this.syncCells();
    if (value.length === this.length) {
      if (this._completed !== value) {
        this._completed = value;
        // After the input event has reached every listener, so a host reads
        // the whole code in both. sf-code-input-completed, then the old
        // sf-code-input:complete with the same detail (aliases.json).
        setTimeout(() => this.sfEmit('completed', {value}), 0);
      }
    } else {
      this._completed = '';
    }
  }

  // The keys are the field's own: Backspace clears the cell before the caret
  // and steps back, Delete clears the one after it, the arrows move between
  // the cells. Home and End go to the first cell and past the last character
  // on every platform: a Mac field leaves them to the page, and scrolls. The
  // caret's cell is read once the key has done its work.
  onKeydown = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    if ((event.key === 'Home' || event.key === 'End') && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const at = event.key === 'Home' ? 0 : input.value.length;
      if (event.shiftKey) input.setSelectionRange(Math.min(at, input.selectionStart ?? 0), Math.max(at, input.selectionEnd ?? 0));
      else input.setSelectionRange(at, at);
    }
    setTimeout(this.onCaret, 0);
  };

  // A click lands in the cell under the pointer: the input lies transparent
  // over the cells and its own caret position knows nothing of them.
  onClick = (event) => {
    const input = this.ownInput(event.target);
    if (!input || input.disabled) return;
    const cells = this.cells();
    const x = event.clientX;
    let index = cells.findIndex((cell) => {
      const box = cell.getBoundingClientRect();
      return x < box.right;
    });
    if (index === -1) index = cells.length - 1;
    const at = Math.min(Math.max(index, 0), input.value.length);
    input.setSelectionRange(at, at);
    this.onCaret();
  };

  onFocusIn = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    this._focusValue = input.value;
    this._changeSent = false;
    setTimeout(this.onCaret, 0);
  };

  onNativeChange = (event) => {
    if (this.ownInput(event.target)) this._changeSent = true;
  };

  // A commit is said once: the browser's change, or the element's when the
  // browser had nothing to report for an edit the element rewrote.
  onFocusOut = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    const changed = this._focusValue !== null && input.value !== this._focusValue;
    if (changed && !this._changeSent) input.dispatchEvent(new Event('change', {bubbles: true}));
    this._focusValue = null;
    this._changeSent = false;
    this.syncCells();
  };

  onCaret = () => {
    this.syncCells();
  };

  cells() {
    return Array.from(this.querySelectorAll(':scope .sf-verification-cell'));
  }

  // The cell the caret is in: the caret's while the field has focus, else the
  // one the next character goes to, as the class runtime draws it.
  caretCell(input) {
    const focused = input && input.ownerDocument?.activeElement === input;
    const at = focused ? (input.selectionStart ?? input.value.length) : (input?.value.length ?? 0);
    return currentCell(at, this.length);
  }

  // The cells show the code (or a dot for each character when masked), the
  // filled ones `active`, the caret's `current`; the position line says the
  // caret's cell, spoken once each time it moves.
  syncCells() {
    const input = this.getInputElement();
    if (!input) return;
    const value = input.value;
    const current = this.caretCell(input);
    this.cells().forEach((cell, index) => {
      const character = value[index] || '';
      const shown = character && this.mask ? MASK_GLYPH : character;
      if (cell.textContent !== shown) cell.textContent = shown;
      cell.classList.toggle('active', index < value.length);
      cell.classList.toggle('current', index === current);
    });
    // A live line: a screen reader says it each time the caret changes cell,
    // and reads it with the field when the field takes focus.
    const position = this.querySelector(':scope .sf-code-input-position');
    const words = this.positionText(current);
    if (position && position.textContent !== words) position.textContent = words;
  }

  onFormReset = () => {
    // The browser writes the default back after the reset event.
    requestAnimationFrame(() => {
      this._lastValue = this.getInputElement()?.value ?? '';
      this._completed = '';
      this.syncCells();
      this.sfSyncFormState();
    });
  };

  // The browser's restore of a form (back, reload) gives the code back.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && this._writingValue) return;
    super.attributeChangedCallback(name, previous, next);
  }

  onDisconnected() {
    this._form?.removeEventListener('reset', this.onFormReset);
    this._form = null;
  }

  templateContext() {
    const props = this.getPropsContext();
    const component = this;
    const input = this.getInputElement();
    const invalid = this.invalid;
    const field = createFieldContract(this, {
      prefix: 'sf-code-input',
      required: this.required,
      invalid,
      hint: this.hint,
      errorMessage: this.errorMessage,
    });
    const hasLabel = Boolean(this.hasSlotContent?.('label') || this.label);
    const labelContent = this.hasSlotContent?.('label') ? this.getSlotContent('label') : this.label;
    const hint = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    const errorContent = this.hasSlotContent?.('error') ? this.getSlotContent('error') : this.errorMessage;
    const messageIsError = Boolean(field.invalid && errorContent);
    const hasControlledValue = this.hasAttribute('value');
    // The template's defaultValue is the component's, as written; what the
    // native input starts from is that code cleaned to the mode and length,
    // under its own name, so a template never reads a resolved prop changed.
    const defaultCode = normaliseCode(this.defaultValue, this.mode, this.length);
    const value = hasControlledValue
      ? normaliseCode(this.getAttribute('value'), this.mode, this.length)
      : (input ? normaliseCode(input.value, this.mode, this.length) : defaultCode);

    return this.createTemplateContext({
      ...props,
      component,
      // The field's ids come from its instance path (§7.1.1, #41).
      id: field.base,
      field,
      size: this.size,
      filled: this.appearance === 'filled',
      label: this.label,
      hasLabel,
      labelContent,
      required: this.required,
      disabled: this.disabled,
      readonly: this.readonly,
      // The host is the form control where the browser has ElementInternals,
      // so the input carries no name (§17.1 item 6).
      controlName: innerControlName(this, this.name),
      value,
      defaultValue: this.defaultValue,
      defaultCode,
      mode: this.mode,
      length: this.length,
      mask: this.mask,
      inputMode: codeInputMode(this.mode),
      pattern: codePattern(this.mode, this.length),
      ariaLabel: this.ariaLabel,
      groupLabel: this.ariaLabel || this.text('group'),
      messageContent: messageIsError ? errorContent : hint,
      messageIsError,
      rootClass: this.getRootClass(),
    });
  }

  afterRender() {
    const input = this.getInputElement();
    this._lastValue = input?.value ?? '';
    if (input && input.value.length === this.length && !this._completed) this._completed = input.value;
    const form = input?.form ?? null;
    if (form !== this._form) {
      this._form?.removeEventListener('reset', this.onFormReset);
      form?.addEventListener('reset', this.onFormReset);
      this._form = form;
    }
    this.syncCells();
    this.sfSyncFormState();
  }

  template() {
    return renderCodeInputTemplate(this.templateContext());
  }
}

SfCodeInput.define('sf-code-input');

export {SfCodeInput};
