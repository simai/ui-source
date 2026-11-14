// sf-input-code: a one-time code -- from a message, an authenticator, an email
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
// code is the fact `completed` (sf-input-code-completed; the old
// sf-code-input-completed and sf-code-input:complete follow it through
// aliases.json, as `error` follows
// `invalid`, §17.2), the ids come from the field's instance path and never a
// counter (§7.1.1, simai/ui-source#41), and the host is the form control
// through ElementInternals: it submits the code and reports the input's
// validity, and the input carries no name (§17.1).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {ladderSize} from '../../component/field-size';
import {createFieldContract} from '../../component/field-contract';
import {FormField, innerControlName, syncFieldValidity} from '../helpers/form-field';
import {renderCodeInputTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import {
  MASK_GLYPH,
  applyEdit,
  applyPaste,
  codeCharset,
  codeGroups,
  codeInputMode,
  codeKind,
  codeLength,
  codeMode,
  currentCell,
  normaliseCode,
  positionWords,
  separatorAfter,
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
    // The cell a mouse drag started on, or -1, and whether the click that
    // ends a mouse press is already handled (K2).
    this._dragFrom = -1;
    this._mousePressed = false;
    // The cell the mouse is over, or -1 (K4).
    this._hover = -1;
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
    this.addEventListener('pointerdown', this.onPointerDown);
    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('pointerup', this.onPointerUp);
    this.addEventListener('pointercancel', this.onPointerUp);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.addEventListener('dblclick', this.onDoubleClick);
    this.addEventListener('copy', this.onCopy);
  }

  get length() {
    return codeLength(this.getAttribute('length'));
  }

  get mode() {
    return codeMode(this.getAttribute('mode'));
  }

  // An own alphabet (C82): only these characters are kept; set, it takes the
  // place of the mode.
  get charset() {
    return codeCharset(this.getAttribute('charset'));
  }

  // Cells per group, a separator between the groups (C82: 3 + 3, 4 + 4), or 0.
  get groups() {
    return codeGroups(this.getAttribute('groups'), this.length);
  }

  // What the code is made of: the mode, the alphabet and whether letters
  // become capitals (C82), as code.mjs reads it.
  // (The setting is copied in by member, not as an object key: the loader
  // reads a bare word of this file as a utility class, and the bare
  // `uppercase` asked for utility.font-transform.)
  get kind() {
    const settings = {mode: this.mode, charset: this.charset};
    settings.uppercase = this.uppercase;
    return codeKind(settings);
  }

  get numeric() {
    return codeInputMode(this.kind) === 'numeric';
  }

  get size() {
    return ladderSize(this.getAttribute('size'));
  }

  get ariaLabel() { return this.getProp('ariaLabel') || ''; }

  // The code: the native input's, kept to the mode and the length.
  get value() {
    const input = this.getInputElement();
    return normaliseCode(input ? input.value : (this.getAttribute('value') ?? this.defaultValue), this.kind, this.length);
  }

  // Setting the value writes the field and its cells, as the native input's
  // own value does: no input, change or complete event, which are the
  // person's.
  set value(next) {
    const value = next === null || next === undefined ? '' : normaliseCode(next, this.kind, this.length);
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
    return positionWords(this.text(this.numeric ? 'digit' : 'character'), cell, this.length);
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
      && event.data.length > 0 && normaliseCode(event.data, this.kind, this.length) === '') {
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
      mode: this.kind,
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
      mode: this.kind,
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
    this.markCell();
    this.syncCells();
    if (value.length === this.length) {
      if (this._completed !== value) {
        this._completed = value;
        // After the input event has reached every listener, so a host reads
        // the whole code in both. sf-input-code-completed, then the old
        // sf-code-input-completed and sf-code-input:complete with the same
        // detail (aliases.json).
        setTimeout(() => this.sfEmit('completed', {value}), 0);
      }
    } else {
      this._completed = '';
    }
  }

  // The keys are the field's own: Backspace clears the marked cell, or the
  // one before a bare caret, and steps back; Delete clears the marked cell;
  // the arrows move a cell at a time (a native arrow only collapses the
  // one-cell mark, and the mark would come back on the same cell), Shift
  // with them grows the selection by a cell. Home and End go to the first
  // cell and past the last character on every platform: a Mac field leaves
  // them to the page, and scrolls. The caret's cell is read once the key has
  // done its work.
  onKeydown = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const length = input.value.length;
    if ((event.key === 'Home' || event.key === 'End') && plain) {
      event.preventDefault();
      const at = event.key === 'Home' ? 0 : length;
      if (event.shiftKey) input.setSelectionRange(Math.min(at, start), Math.max(at, end), at < start ? 'backward' : 'forward');
      else input.setSelectionRange(at, at);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && plain) {
      event.preventDefault();
      const back = event.key === 'ArrowLeft';
      if (event.shiftKey) {
        if (back) input.setSelectionRange(Math.max(0, start - 1), end, 'backward');
        else input.setSelectionRange(start, Math.min(length, end + 1), 'forward');
      } else {
        const at = back ? Math.max(0, start - 1) : Math.min(length, start + 1);
        input.setSelectionRange(at, at);
      }
      this.onCaret();
    }
    setTimeout(this.onCaret, 0);
  };

  // The cell under a point: the input lies transparent over the cells and its
  // own caret position knows nothing of them.
  cellAt(x) {
    const cells = this.cells();
    const index = cells.findIndex((cell) => x < cell.getBoundingClientRect().right);
    return index === -1 ? cells.length - 1 : Math.max(index, 0);
  }

  // A tap or a click lands in the cell under the pointer. A mouse press has
  // placed the caret already (onPointerDown), and its click must not collapse
  // what a drag or a double click selected (K2: the click reset a drag of
  // cells 2-5 to a caret at 4); a selection of more than one cell is kept.
  onClick = (event) => {
    const input = this.ownInput(event.target);
    if (!input || input.disabled) return;
    if (this._mousePressed) {
      this._mousePressed = false;
      return;
    }
    if ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0) > 1) return;
    const at = Math.min(this.cellAt(event.clientX), input.value.length);
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
    input.closest('.sf-verification')?.classList.remove('sf-verification--pointer-focus');
    this.syncCells();
    // While focusout runs the input may still be the active element.
    setTimeout(this.onCaret, 0);
  };

  // A press on the field: its focus is the pointer's, so the sheet draws no
  // ring on the active cell, only its primary border, until the focus leaves
  // (K1, as sf-input's .sf-input--pointer-focus).
  // A mouse selects by cells (K2): a press puts the caret in the cell under
  // it, a drag selects the cells it crosses, a double click the whole code.
  // The browser's own selection would follow the transparent input's text,
  // not the cells. A touch is left to the browser (its caret, long-press menu
  // and paste), then the click puts the caret in the cell.
  onPointerDown = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    input.closest('.sf-verification')?.classList.add('sf-verification--pointer-focus');
    this._mousePressed = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || input.disabled) return;
    event.preventDefault();
    this._mousePressed = true;
    if (input.ownerDocument?.activeElement !== input) input.focus({preventScroll: true});
    const at = Math.min(this.cellAt(event.clientX), input.value.length);
    this._dragFrom = -1;
    input.setSelectionRange(at, at);
    this.markCell();
    this._dragFrom = at;
    try { input.setPointerCapture(event.pointerId); } catch { /* a synthetic press */ }
    this.syncCells();
  };

  // A double click selects the whole code, as a word in a field.
  onDoubleClick = (event) => {
    const input = this.ownInput(event.target);
    if (!input || input.disabled) return;
    this._dragFrom = -1;
    input.setSelectionRange(0, input.value.length, 'forward');
    this.syncCells();
  };

  // The pointer marks the one cell it is over (K4: the whole group lit up on
  // hover, and hid the current cell's mark); a drag selects.
  onPointerMove = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    const at = this.cellAt(event.clientX);
    if (event.pointerType === 'mouse') {
      const hover = input.disabled ? -1 : at;
      if (hover !== this._hover) {
        this._hover = hover;
        this.syncCells();
      }
    }
    if (this._dragFrom < 0 || !(event.buttons & 1)) return;
    const from = Math.min(this._dragFrom, at);
    const to = Math.min(Math.max(this._dragFrom, at) + 1, input.value.length);
    if (to > from && (input.selectionStart !== from || input.selectionEnd !== to)) {
      input.setSelectionRange(from, to, at < this._dragFrom ? 'backward' : 'forward');
      this.syncCells();
    }
  };

  onPointerLeave = () => {
    if (this._hover === -1) return;
    this._hover = -1;
    this.syncCells();
  };

  onPointerUp = () => {
    if (this._dragFrom < 0) return;
    this._dragFrom = -1;
    this.onCaret();
  };

  // Copy gives the code that is selected, never a masked one (K2).
  onCopy = (event) => {
    const input = this.ownInput(event.target);
    if (!input) return;
    if (this.mask) {
      event.preventDefault();
      return;
    }
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (end <= start || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', input.value.slice(start, end));
  };

  onCaret = () => {
    this.markCell();
    this.syncCells();
  };

  // A bare caret inside the code becomes a one-cell selection (input-otp's
  // rule): what is marked is what typing replaces and Backspace or Delete
  // clears (K3). A caret after the last character stays bare: the next
  // character goes there.
  markCell() {
    const input = this.getInputElement();
    if (!input || input.ownerDocument?.activeElement !== input || this._dragFrom >= 0) return;
    const start = input.selectionStart;
    if (start === null || start !== input.selectionEnd || start >= input.value.length) return;
    input.setSelectionRange(start, start + 1, 'forward');
  }

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
  // filled ones `active`, the caret's `current` -- only while the field has
  // the focus: a field at rest marked the next cell and looked focused (K6);
  // the sheet gates it on focus too. A bare caret is drawn in its cell
  // (`caret`; `caret-end` after the last character of a whole code, K3): the
  // input itself is transparent. A selection of more than one cell paints
  // its cells `selected` (K2). The position line says the caret's cell,
  // spoken once each time it moves.
  syncCells() {
    const input = this.getInputElement();
    if (!input) return;
    const value = input.value;
    const focused = input.ownerDocument?.activeElement === input;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const one = end - start <= 1;
    const current = this.caretCell(input);
    const bare = focused && start === end && !this.readonly;
    this.cells().forEach((cell, index) => {
      const character = value[index] || '';
      const shown = character && this.mask ? MASK_GLYPH : character;
      if (cell.textContent !== shown) cell.textContent = shown;
      cell.classList.toggle('active', index < value.length);
      cell.classList.toggle('current', focused && one && index === current);
      const selected = focused && !one && index >= start && index < end;
      cell.classList.toggle('selected', selected);
      // Hover marks one cell, never over the current cell's mark or a
      // selection (K4).
      cell.classList.toggle('hover', index === this._hover && !selected && !(focused && one && index === current));
      cell.classList.toggle('caret', bare && index === current);
      cell.classList.toggle('caret-end', bare && index === current && start >= this.length);
    });
    // A live line: a screen reader says it each time the caret changes cell,
    // and reads it with the field when the field takes focus.
    const position = this.querySelector(':scope .sf-code-input-position');
    const words = this.positionText(current);
    if (position && position.textContent !== words) position.textContent = words;
  }

  // A code that is not whole is too short. The inner input carries no
  // pattern: its mismatch was the browser's English tooltip over the cells
  // («Please match the requested format.», K5), and the characters are already
  // kept to the mode. The host says it through ElementInternals, in the page's
  // words; a custom error and an empty required field come first, as before.
  sfSyncValidity() {
    const input = this.getInputElement();
    const value = input?.value ?? '';
    const short = Boolean(input) && !input.disabled && value.length > 0 && value.length < this.length;
    syncFieldValidity(this, input, short ? {tooShort: this.text('too-short')} : {});
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
    const defaultCode = normaliseCode(this.defaultValue, this.kind, this.length);
    const value = hasControlledValue
      ? normaliseCode(this.getAttribute('value'), this.kind, this.length)
      : (input ? normaliseCode(input.value, this.kind, this.length) : defaultCode);

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
      inputMode: codeInputMode(this.kind),
      // Letters become capitals: the keyboard offers them (C82). Not named
      // after the setting: the loader reads template words as utility classes.
      capitals: this.kind.uppercase,
      groups: this.groups,
      // The cells a group separator follows (C82).
      separators: Array.from({length: this.length}, (_, index) => index)
        .filter((index) => separatorAfter(index, this.groups, this.length)),
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

SfCodeInput.define('sf-input-code');

export {SfCodeInput};
