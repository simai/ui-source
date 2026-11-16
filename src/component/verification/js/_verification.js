import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import verificationUtility from '../json/verification.utility.json';
import verificationFormUtility from '../json/verification-form.utility.json';

const FORM_SELECTOR = '.sf-verification-form';
const CONTROL_SELECTOR = '.sf-verification';
const INPUT_SELECTOR = '.sf-verification-input';
const states = new WeakMap();

function getRoot(target) {
  return target instanceof Element ? target.closest(FORM_SELECTOR) || target : null;
}

function getMode(root) {
  return String(root?.dataset?.mode || 'numeric').toLowerCase();
}

function getLength(root, input) {
  const requested = Number.parseInt(root?.dataset?.length || input?.maxLength || '6', 10);
  return Number.isFinite(requested) && requested > 0 ? Math.min(requested, 12) : 6;
}

function normalize(value, mode, length) {
  let result = String(value || '');
  if (mode === 'numeric') result = result.replace(/\D/g, '');
  else if (mode === 'alphanumeric') result = result.replace(/[^a-z0-9]/gi, '');
  else result = result.replace(/\s/g, '');
  return result.slice(0, length);
}

function canonicalInput(root) {
  return root?.querySelector?.(INPUT_SELECTOR) || null;
}

function legacyInputs(root) {
  if (canonicalInput(root)) return [];
  return Array.from(root?.querySelectorAll?.(`${CONTROL_SELECTOR} input`) || []);
}

// The cells draw the real caret and selection of the input (C82, RG-VR-1/2):
// it was drawn after the last character whatever the caret did, so after
// Left Left a 9 went in at 1 while cell 4 blinked. While the field has the
// focus the cell is the one at selectionStart; a selection of more than one
// character paints its cells `selected`. At rest the current cell is the one
// the next character goes to; the sheet shows it only with the focus.
function caretCell(input, value, length, focused) {
  const at = focused ? (input.selectionStart ?? value.length) : value.length;
  return Math.max(0, Math.min(at, length - 1));
}

// `fromUser`: verification:complete answers what the person typed or pasted
// only; a field that loads, resets or is set already holding a whole code
// says nothing (it fired on page load before).
function renderCanonical(root, state, fromUser = false) {
  const { input } = state;
  const value = normalize(input.value, state.mode, state.length);
  if (input.value !== value) input.value = value;
  const focused = input.ownerDocument?.activeElement === input;
  const start = focused ? (input.selectionStart ?? value.length) : value.length;
  const end = focused ? (input.selectionEnd ?? start) : start;
  const one = end - start <= 1;
  const current = caretCell(input, value, state.length, focused);
  // The caret is drawn in its cell while the field has the focus (K3): the
  // input is transparent and draws none. A whole code puts it after the last
  // character (caret-end).
  const bare = focused && start === end && !input.readOnly;
  state.cells.forEach((cell, index) => {
    const character = value[index] || '';
    if (cell.textContent !== character) cell.textContent = character;
    cell.classList.toggle('active', index < value.length);
    cell.classList.toggle('current', one && index === current);
    const selected = focused && !one && index >= start && index < end;
    cell.classList.toggle('selected', selected);
    // Hover marks the one cell under the pointer, never over the current
    // cell's mark or a selection (K4, RG-VR-3).
    cell.classList.toggle('hover', index === state.hover && !selected && !(focused && one && index === current));
    cell.classList.toggle('caret', bare && index === current);
    cell.classList.toggle('caret-end', bare && index === current && start >= state.length);
  });
  root.classList.toggle('active', Boolean(value));

  if (value.length === state.length) {
    if (state.completedValue !== value) {
      state.completedValue = value;
      if (fromUser) {
        root.dispatchEvent(new CustomEvent('verification:complete', {
          bubbles: true,
          detail: { value },
        }));
      }
    }
  } else {
    state.completedValue = '';
  }
}

// A bare caret inside the code becomes a one-cell selection (sf-input-code's
// rule, K3): what is marked is what typing replaces and Backspace or Delete
// clears. A caret after the last character stays bare: the next character
// goes there.
function markCell(state) {
  const { input } = state;
  if (input.ownerDocument?.activeElement !== input || state.dragFrom >= 0) return;
  const start = input.selectionStart;
  if (start === null || start !== input.selectionEnd || start >= input.value.length) return;
  input.setSelectionRange(start, start + 1, 'forward');
}

// The cell under a point: the input lies transparent over the cells and its
// own caret position knows nothing of them.
function cellAt(state, x) {
  const index = state.cells.findIndex((cell) => x < cell.getBoundingClientRect().right);
  return index === -1 ? state.cells.length - 1 : Math.max(index, 0);
}

function bindCanonical(root, input) {
  const control = input.closest(CONTROL_SELECTOR);
  if (!control) return null;
  const length = getLength(root, input);
  const mode = getMode(root);
  input.maxLength = length;
  if (!input.inputMode && mode === 'numeric') input.inputMode = 'numeric';
  if (!input.autocomplete) input.autocomplete = 'one-time-code';
  input.dir = 'ltr';

  let cellsRoot = control.querySelector('.sf-verification-cells');
  if (!cellsRoot) {
    cellsRoot = document.createElement('span');
    cellsRoot.className = 'sf-verification-cells';
    cellsRoot.setAttribute('aria-hidden', 'true');
    control.appendChild(cellsRoot);
  }
  cellsRoot.replaceChildren();
  const cells = Array.from({ length }, () => {
    const cell = document.createElement('span');
    cell.className = 'sf-verification-cell';
    cellsRoot.appendChild(cell);
    return cell;
  });

  // A field that loads holding a whole code is not completed by anyone.
  const loaded = normalize(input.value, mode, length);
  const state = {
    input, cells, length, mode,
    completedValue: loaded.length === length ? loaded : '',
    hover: -1,
    dragFrom: -1,
    mousePressed: false,
  };
  const sync = () => renderCanonical(root, state);
  const onCaret = () => {
    markCell(state);
    sync();
  };
  const onInput = () => {
    root.classList.remove('error');
    input.removeAttribute('aria-invalid');
    markCell(state);
    renderCanonical(root, state, true);
  };
  const onPaste = (event) => {
    const value = normalize(event.clipboardData?.getData('text'), mode, length);
    if (!value) return;
    event.preventDefault();
    input.value = value;
    onInput();
  };
  const onReset = () => requestAnimationFrame(() => {
    state.completedValue = '';
    sync();
  });
  // The arrows move a cell at a time (a native arrow only collapses the
  // one-cell mark, and the mark would come back on the same cell), Shift with
  // them grows the selection by a cell; Home and End go to the first cell and
  // past the last character on every platform. The caret's cell is read once
  // the key has done its work.
  const onKeydown = (event) => {
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const size = input.value.length;
    if ((event.key === 'Home' || event.key === 'End') && plain) {
      event.preventDefault();
      const at = event.key === 'Home' ? 0 : size;
      if (event.shiftKey) input.setSelectionRange(Math.min(at, start), Math.max(at, end), at < start ? 'backward' : 'forward');
      else input.setSelectionRange(at, at);
      onCaret();
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && plain) {
      event.preventDefault();
      const back = event.key === 'ArrowLeft';
      if (event.shiftKey) {
        if (back) input.setSelectionRange(Math.max(0, start - 1), end, 'backward');
        else input.setSelectionRange(start, Math.min(size, end + 1), 'forward');
      } else {
        const at = back ? Math.max(0, start - 1) : Math.min(size, start + 1);
        input.setSelectionRange(at, at);
      }
      onCaret();
    }
    setTimeout(onCaret, 0);
  };
  // A mouse press puts the caret in the cell under it and a drag selects the
  // cells it crosses (K2): the browser's own selection would follow the
  // transparent text, not the cells. A touch is left to the browser (its
  // caret, long-press menu and paste), then the click puts the caret in the
  // cell. The focus by pointer and by keys is one look (C153 (4)); the class
  // stays for a page that reads it.
  const onPointerDown = (event) => {
    control.classList.add('sf-verification--pointer-focus');
    state.mousePressed = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || input.disabled) return;
    event.preventDefault();
    state.mousePressed = true;
    if (input.ownerDocument?.activeElement !== input) input.focus({ preventScroll: true });
    const at = Math.min(cellAt(state, event.clientX), input.value.length);
    state.dragFrom = -1;
    input.setSelectionRange(at, at);
    markCell(state);
    state.dragFrom = at;
    try { input.setPointerCapture(event.pointerId); } catch { /* a synthetic press */ }
    sync();
  };
  const onPointerMove = (event) => {
    const at = cellAt(state, event.clientX);
    if (event.pointerType === 'mouse') {
      const hover = input.disabled ? -1 : at;
      if (hover !== state.hover) {
        state.hover = hover;
        sync();
      }
    }
    if (state.dragFrom < 0 || !(event.buttons & 1)) return;
    const from = Math.min(state.dragFrom, at);
    const to = Math.min(Math.max(state.dragFrom, at) + 1, input.value.length);
    if (to > from && (input.selectionStart !== from || input.selectionEnd !== to)) {
      input.setSelectionRange(from, to, at < state.dragFrom ? 'backward' : 'forward');
      sync();
    }
  };
  const onPointerLeave = () => {
    if (state.hover === -1) return;
    state.hover = -1;
    sync();
  };
  const onPointerUp = () => {
    if (state.dragFrom < 0) return;
    state.dragFrom = -1;
    onCaret();
  };
  // A click (a touch's) lands in the cell under it; a mouse press placed the
  // caret already, and its click must not collapse a drag's selection.
  const onClick = (event) => {
    if (input.disabled) return;
    if (state.mousePressed) {
      state.mousePressed = false;
      return;
    }
    if ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0) > 1) return;
    const at = Math.min(cellAt(state, event.clientX), input.value.length);
    input.setSelectionRange(at, at);
    onCaret();
  };
  // A double click selects the whole code, as a word in a field.
  const onDoubleClick = () => {
    if (input.disabled) return;
    state.dragFrom = -1;
    input.setSelectionRange(0, input.value.length, 'forward');
    sync();
  };
  const onFocus = () => setTimeout(onCaret, 0);
  const onBlur = () => {
    control.classList.remove('sf-verification--pointer-focus');
    sync();
  };
  const listeners = [
    ['input', onInput],
    ['paste', onPaste],
    ['keydown', onKeydown],
    ['select', sync],
    ['selectionchange', sync],
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerleave', onPointerLeave],
    ['pointerup', onPointerUp],
    ['click', onClick],
    ['dblclick', onDoubleClick],
    ['focus', onFocus],
    ['blur', onBlur],
  ];
  listeners.forEach(([type, listener]) => input.addEventListener(type, listener));
  input.form?.addEventListener('reset', onReset);
  state.destroy = () => {
    listeners.forEach(([type, listener]) => input.removeEventListener(type, listener));
    input.form?.removeEventListener('reset', onReset);
    control.classList.remove('sf-verification--pointer-focus');
  };
  sync();
  return state;
}

function syncLegacy(root, inputs) {
  inputs.forEach((input) => {
    const control = input.closest(CONTROL_SELECTOR);
    control?.classList.toggle('active', Boolean(input.value));
  });
}

function bindLegacy(root, inputs) {
  const mode = getMode(root);
  const onInput = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    input.value = normalize(input.value, mode, 1);
    root.classList.remove('error');
    syncLegacy(root, inputs);
    if (input.value) inputs[inputs.indexOf(input) + 1]?.focus();
  };
  const onPaste = (event) => {
    const value = normalize(event.clipboardData?.getData('text'), mode, inputs.length);
    if (!value) return;
    event.preventDefault();
    inputs.forEach((input, index) => { input.value = value[index] || ''; });
    syncLegacy(root, inputs);
    inputs[Math.min(value.length, inputs.length - 1)]?.focus();
  };
  const onKeydown = (event) => {
    const input = event.target;
    const index = inputs.indexOf(input);
    if (event.key === 'Backspace' && !input.value && index > 0) {
      event.preventDefault();
      inputs[index - 1].value = '';
      inputs[index - 1].focus();
      syncLegacy(root, inputs);
    }
  };
  inputs.forEach((input) => {
    input.maxLength = 1;
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);
  });
  root.addEventListener('paste', onPaste);
  syncLegacy(root, inputs);
  return {
    inputs,
    mode,
    destroy() {
      inputs.forEach((input) => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeydown);
      });
      root.removeEventListener('paste', onPaste);
    },
  };
}

// A field another owner draws and runs -- sf-code-input (src/smart/code-input)
// writes its cells and sends its events itself -- carries this mark, and the
// class runtime binds nothing to it, so two owners never write one code.
function ownedElsewhere(root) {
  return Boolean(root?.dataset?.sfVerificationOwner);
}

function bind(root) {
  if (!root || ownedElsewhere(root)) return null;
  if (states.has(root)) return states.get(root);
  const input = canonicalInput(root);
  const inputs = legacyInputs(root);
  const state = input ? bindCanonical(root, input) : (inputs.length ? bindLegacy(root, inputs) : null);
  if (state) states.set(root, state);
  return state;
}

function unbind(root) {
  const state = states.get(root);
  if (!state) return;
  state.destroy?.();
  states.delete(root);
}

function initAll(target = document) {
  if (target.matches?.(FORM_SELECTOR)) bind(target);
  target.querySelectorAll?.(FORM_SELECTOR).forEach(bind);
}

function getValue(target) {
  const root = getRoot(target);
  if (!root) return '';
  const input = canonicalInput(root);
  if (input) return normalize(input.value, getMode(root), getLength(root, input));
  return legacyInputs(root).map((item) => item.value).join('');
}

function setValue(target, value = '') {
  const root = getRoot(target);
  if (!root) return false;
  const state = bind(root);
  const input = canonicalInput(root);
  if (input && !state) return false;
  if (input) {
    input.value = normalize(value, state.mode, state.length);
    renderCanonical(root, state);
    return true;
  }
  const inputs = legacyInputs(root);
  const normalized = normalize(value, getMode(root), inputs.length);
  inputs.forEach((item, index) => { item.value = normalized[index] || ''; });
  syncLegacy(root, inputs);
  return Boolean(inputs.length);
}

const SIZES = ['1/2', '1', '2'];
const MODES = ['numeric', 'alphanumeric', 'text'];

// The classes built nothing: template stayed null, so render() returned null and
// `new SF.VerificationForm({...}).render()` put no field on the page. They now
// build the canonical markup -- one native input, the cells projected by bind().
function settingsOf(params = {}) {
  const size = SIZES.includes(String(params.size)) ? String(params.size) : '1';
  const mode = MODES.includes(String(params.mode)) ? String(params.mode) : 'numeric';
  const length = Math.min(12, Math.max(1, Number.parseInt(params.length, 10) || 6));
  return { ...params, size, mode, length, filled: params.appearance === 'filled' || params.filled === true };
}

function buildControl(settings, id) {
  const control = document.createElement('div');
  control.className = `sf-verification sf-verification--size-${settings.size}`;
  if (settings.filled) control.classList.add('sf-verification--filled');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sf-verification-input';
  if (id) input.id = id;
  if (settings.name) input.name = settings.name;
  if (settings.mode === 'numeric') input.inputMode = 'numeric';
  input.autocomplete = 'one-time-code';
  input.maxLength = settings.length;
  if (settings.value) input.value = String(settings.value);
  if (settings.disabled) input.disabled = true;
  if (settings.required) input.required = true;
  control.append(input);
  return control;
}

function applyAttrs(node, attrs = {}) {
  const className = attrs.class || attrs.className;
  if (className) node.classList.add(...String(className).split(' ').filter(Boolean));
}

class Verification extends ComponentObserver {
  static componentName = 'Verification';

  constructor(props) {
    super(props);
    const settings = settingsOf(this.params || {});
    this.template = buildControl(settings, this.id);
    this.template.dataset.length = String(settings.length);
    this.template.dataset.mode = settings.mode;
    // Without a visible label the input is named by what the host passes.
    if (settings.label) this.template.querySelector('input').setAttribute('aria-label', settings.label);
    applyAttrs(this.template, this.attrs);
  }

  init() { bind(this.template); }
  destroyInternal() { unbind(this.template); }
}
Verification.utilityMap = verificationUtility;
registerComponent('Verification', Verification);

class VerificationForm extends ComponentObserver {
  static componentName = 'VerificationForm';

  constructor(props) {
    super(props);
    const settings = settingsOf(this.params || {});
    const root = document.createElement('label');
    root.className = `sf-verification-form sf-verification-form--size-${settings.size}`;
    if (settings.filled) root.classList.add('sf-verification-form--filled');
    root.dataset.length = String(settings.length);
    root.dataset.mode = settings.mode;
    if (settings.label) {
      const label = document.createElement('span');
      label.className = 'sf-verification-form-label';
      label.textContent = settings.label;
      root.append(label);
    }
    root.append(buildControl(settings, this.id));
    if (settings.hint) {
      const hint = document.createElement('span');
      hint.className = 'sf-verification-form-hint';
      hint.textContent = settings.hint;
      root.append(hint);
    }
    applyAttrs(root, this.attrs);
    this.template = root;
  }

  init() { bind(this.template); }
  destroyInternal() { unbind(this.template); }
}
VerificationForm.utilityMap = verificationFormUtility;
registerComponent('VerificationForm', VerificationForm);

function install() {
  if (window.SF?.Verification?.contract === 'single-input') return window.SF.Verification;
  window.SF = window.SF || {};
  const api = { contract: 'single-input', initAll, getValue, setValue };
  window.SF.Verification = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(), { once: true });
  } else initAll();
  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(FORM_SELECTOR)) unbind(node);
      node.querySelectorAll?.(FORM_SELECTOR).forEach(unbind);
    });
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) initAll(node);
    });
  }));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return api;
}

if (typeof window !== 'undefined') install();
