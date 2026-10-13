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

function renderCanonical(root, state) {
  const value = normalize(state.input.value, state.mode, state.length);
  if (state.input.value !== value) state.input.value = value;
  state.cells.forEach((cell, index) => {
    cell.textContent = value[index] || '';
    cell.classList.toggle('active', index < value.length);
    cell.classList.toggle('current', index === Math.min(value.length, state.length - 1));
  });
  root.classList.toggle('active', Boolean(value));

  if (value.length === state.length && state.completedValue !== value) {
    state.completedValue = value;
    root.dispatchEvent(new CustomEvent('verification:complete', {
      bubbles: true,
      detail: { value },
    }));
  } else if (value.length < state.length) {
    state.completedValue = '';
  }
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

  const state = { input, cells, length, mode, completedValue: '' };
  const onInput = () => {
    root.classList.remove('error');
    input.removeAttribute('aria-invalid');
    renderCanonical(root, state);
  };
  const onPaste = (event) => {
    const value = normalize(event.clipboardData?.getData('text'), mode, length);
    if (!value) return;
    event.preventDefault();
    input.value = value;
    onInput();
  };
  const onReset = () => requestAnimationFrame(() => renderCanonical(root, state));
  input.addEventListener('input', onInput);
  input.addEventListener('paste', onPaste);
  input.form?.addEventListener('reset', onReset);
  state.destroy = () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('paste', onPaste);
    input.form?.removeEventListener('reset', onReset);
  };
  renderCanonical(root, state);
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

function bind(root) {
  if (!root || states.has(root)) return states.get(root);
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
