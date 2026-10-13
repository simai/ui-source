import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import inputUtility from '../json/input.utility.json';
import { syncFieldContract } from '../../field-contract';
import { fieldSize, retireFieldSizeClass } from '../../field-size';
import { bindFormReset } from '../../form-reset-helper';
import { maskService } from '../../mask-service';

const INPUT_SELECTOR = 'label.sf-input';
const INPUT_BOUND_FLAG = 'sfInputBound';
const INPUT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url']);
const INPUT_MODES = new Set(['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
const INPUT_VARIANTS = new Set(['bordered', 'filled', 'hidden']);

function boundedValue(value, allowed, fallback) {
  const normalized = String(value || fallback);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeInputType(value) {
  const normalized = String(value || 'text').toLowerCase();
  return INPUT_TYPES.has(normalized) ? normalized : 'text';
}

function normalizeInputMode(value) {
  const normalized = String(value || '').toLowerCase();
  return INPUT_MODES.has(normalized) ? normalized : '';
}

function normalizeLength(value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getInputNode(root) {
  return root?.querySelector?.('.sf-input-field input, input') || null;
}

function getMessageNode(root) {
  return root?.querySelector?.('.sf-input-hint-text-wrap') || null;
}

function ensureMessageNode(root) {
  const existing = getMessageNode(root);
  if (existing) return existing;

  const messageNode = document.createElement('span');
  messageNode.classList.add('sf-input-hint-text-wrap');
  root.append(messageNode);
  return messageNode;
}

function messageState(root) {
  const messageNode = getMessageNode(root);
  return {
    messageNode,
    errorMessage: messageNode?.dataset.fieldMessage === 'error'
      ? messageNode.textContent?.trim() || ''
      : '',
  };
}

function parseMaskOptions(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function resolveMaskConfig(root, input) {
  const enabled = toBoolean(input.dataset.mask ?? root.dataset.mask, false);
  if (!enabled) return null;

  const fromInput = parseMaskOptions(input.dataset.maskOptions);
  const fromRoot = parseMaskOptions(root.dataset.maskOptions);
  if (fromInput) return applyMaskOptionAttributes(fromInput, root, input);
  if (fromRoot) return applyMaskOptionAttributes(fromRoot, root, input);

  const pattern = input.dataset.maskPattern ?? root.dataset.maskPattern;
  if (pattern) {
    return applyMaskOptionAttributes({ mask: String(pattern) }, root, input);
  }

  return null;
}

function applyMaskOptionAttributes(config, root, input) {
  const nextConfig = { ...config };
  const lazy = input.dataset.maskLazy ?? root.dataset.maskLazy;
  const placeholderChar =
    input.dataset.maskPlaceholderChar ?? root.dataset.maskPlaceholderChar;

  if (typeof lazy !== 'undefined' && lazy !== '') {
    nextConfig.lazy = toBoolean(lazy, true);
  }

  if (typeof placeholderChar !== 'undefined' && placeholderChar !== '') {
    nextConfig.placeholderChar = String(placeholderChar);
  }

  return nextConfig;
}

async function bindMask(root, input) {
  const config = resolveMaskConfig(root, input);
  if (!config) return;
  const request = {};
  root.__sfInputMaskRequest = request;

  try {
    const service = await maskService();
    if (root.__sfInputMaskRequest !== request) return;
    const instance = await service.create(input, config);
    if (!instance) return;
    if (root.dataset[INPUT_BOUND_FLAG] !== '1' || root.__sfInputMaskRequest !== request || getInputNode(root) !== input) {
      service.destroy(instance);
      return;
    }
    root.__sfInputMask = instance;
  } catch (error) {
    console.warn('SF.Input mask init failed', error);
  }
}

function bindInput(root) {
  retireFieldSizeClass(root, 'sf-input');
  if (!root || root.dataset[INPUT_BOUND_FLAG] === '1') return;
  const input = getInputNode(root);
  if (!input) return;

  // Placeholder for shared behaviors (masking/validation hooks).
  const noopHandler = () => {};
  const pointerFocusHandler = () => root.classList.add('sf-input--pointer-focus');
  const blurHandler = () => root.classList.remove('sf-input--pointer-focus');
  input.addEventListener('input', noopHandler);
  input.addEventListener('pointerdown', pointerFocusHandler);
  input.addEventListener('blur', blurHandler);
  root.__sfInputNoopHandler = noopHandler;
  root.__sfInputPointerFocusHandler = pointerFocusHandler;
  root.__sfInputBlurHandler = blurHandler;

  root.dataset[INPUT_BOUND_FLAG] = '1';
  const message = messageState(root);
  syncFieldContract(root, input, {
    prefix: 'sf-input',
    labelNode: root.querySelector('.sf-input-text'),
    required: input.required || Boolean(root.querySelector('.sf-input-required')),
    invalid: root.classList.contains('error') || input.classList.contains('error'),
    ...message,
  });
  root.__sfInputReleaseReset = bindFormReset(input, () => {
    if (root.__sfInputMask) root.__sfInputMask.value = input.value;
  });
  bindMask(root, input);
}

function unbindInput(root) {
  if (!root || root.dataset[INPUT_BOUND_FLAG] !== '1') return;
  delete root.__sfInputMaskRequest;
  const input = getInputNode(root);
  if (input && root.__sfInputNoopHandler) {
    input.removeEventListener('input', root.__sfInputNoopHandler);
  }
  if (input && root.__sfInputPointerFocusHandler) {
    input.removeEventListener('pointerdown', root.__sfInputPointerFocusHandler);
  }
  if (input && root.__sfInputBlurHandler) {
    input.removeEventListener('blur', root.__sfInputBlurHandler);
  }
  if (root.__sfInputMask) {
    window.SF?.Mask?.destroy?.(root.__sfInputMask);
  }
  root.__sfInputReleaseReset?.();
  delete root.__sfInputReleaseReset;
  delete root.__sfInputMask;
  delete root.__sfInputNoopHandler;
  delete root.__sfInputPointerFocusHandler;
  delete root.__sfInputBlurHandler;
  root.classList.remove('sf-input--pointer-focus');
  delete root.dataset[INPUT_BOUND_FLAG];
}

function initExistingInputs(target = document) {
  target.querySelectorAll(INPUT_SELECTOR).forEach(bindInput);
}

function setInputState(target, state = {}) {
  const root =
    target instanceof HTMLElement
      ? target.closest(INPUT_SELECTOR) || target
      : null;
  if (!root) return false;

  const input = getInputNode(root);
  if (!input) return false;

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    input.disabled = toBoolean(state.disabled);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'error')) {
    const invalid = toBoolean(state.error);
    root.classList.toggle('error', invalid);
    input.classList.toggle('error', invalid);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'invalid')) {
    const invalid = toBoolean(state.invalid);
    root.classList.toggle('error', invalid);
    input.classList.toggle('error', invalid);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'errorMessage')) {
    const value = String(state.errorMessage ?? '');
    const messageNode = value ? ensureMessageNode(root) : getMessageNode(root);
    if (messageNode) {
      messageNode.textContent = value;
      // The text is an error only on a field left invalid. Restoring a hint
      // with {invalid: false, errorMessage: hint} marked it an error, and a
      // later error with no text of its own pointed aria-errormessage at it.
      const invalid = root.classList.contains('error') || input.classList.contains('error');
      messageNode.dataset.fieldMessage = value && invalid ? 'error' : 'hint';
    }
  }
  if (Object.prototype.hasOwnProperty.call(state, 'value')) {
    input.value = String(state.value ?? '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  syncFieldContract(root, input, {
    prefix: 'sf-input',
    labelNode: root.querySelector('.sf-input-text'),
    required: input.required || Boolean(root.querySelector('.sf-input-required')),
    invalid: root.classList.contains('error') || input.classList.contains('error'),
    ...messageState(root),
  });

  return true;
}

class Inputs extends ComponentObserver {
  static componentName = 'Inputs';
  html = null;

  constructor(props) {
    super(props);

    const {
      size = '1',
      type = 'bordered',
      // No invented defaults: a field built from code had «Label», «placeholder»
      // and required set unless the caller said otherwise.
      label = '',
      required = false,
      placeholder = '',
      inputType = 'text',
      autocomplete = '',
      inputMode = '',
      minLength = '',
      maxLength = '',
      pattern = '',
      hint = '',
      value = '',
      name = '',
      leftIcon = '',
      rightText = '',
      hintIcon = '',
      disabled = false,
      readonly = false,
      error = false,
      invalid = false,
      errorMessage = '',
      mask = false,
      maskPattern = '',
      maskLazy = '',
      maskPlaceholderChar = '',
      maskOptions = '',
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    const normalizedSize = fieldSize(size, 'sf-input');
    const normalizedVariant = boundedValue(type, INPUT_VARIANTS, 'bordered');

    this.template = document.createElement('label');
    if (this.id) this.template.id = this.id;
    this.template.classList.add(
      'sf-input',
      `sf-input--size-${normalizedSize}`,
      `sf-input--${normalizedVariant}`,
    );
    this.template.classList.toggle('error', toBoolean(invalid || error, false));
    this.template.dataset.mask = String(toBoolean(mask, false));
    this.template.dataset.maskPattern = String(maskPattern || '');
    this.template.dataset.maskLazy = String(maskLazy ?? '');
    this.template.dataset.maskPlaceholderChar = String(maskPlaceholderChar || '');
    this.template.dataset.maskOptions = String(maskOptions || '');
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    const labelWrap = document.createElement('span');
    labelWrap.classList.add('sf-input-label');

    const labelText = document.createElement('span');
    labelText.classList.add('sf-input-text');
    labelText.textContent = label;
    labelWrap.append(labelText);

    if (toBoolean(required, true)) {
      const requiredMark = document.createElement('span');
      requiredMark.classList.add('sf-input-required');
      requiredMark.textContent = '*';
      labelWrap.append(requiredMark);
    }

    const field = document.createElement('span');
    field.classList.add('sf-input-field');

    if (leftIcon) {
      const icon = document.createElement('i');
      icon.classList.add('sf-icon');
      icon.textContent = String(leftIcon);
      field.append(icon);
    }

    const input = document.createElement('input');
    input.type = normalizeInputType(inputType);
    input.placeholder = String(placeholder ?? '');
    if (autocomplete) input.autocomplete = String(autocomplete);
    input.inputMode = normalizeInputMode(inputMode);
    const normalizedMinLength = normalizeLength(minLength);
    const normalizedMaxLength = normalizeLength(maxLength);
    if (normalizedMinLength !== null) input.minLength = normalizedMinLength;
    if (normalizedMaxLength !== null) input.maxLength = normalizedMaxLength;
    if (pattern) input.pattern = String(pattern);
    input.value = String(value ?? '');
    input.defaultValue = String(value ?? '');
    if (name) input.name = String(name);
    input.disabled = toBoolean(disabled, false);
    input.readOnly = toBoolean(readonly, false);
    input.required = toBoolean(required, true);
    input.dataset.mask = String(toBoolean(mask, false));
    input.dataset.maskPattern = String(maskPattern || '');
    input.dataset.maskLazy = String(maskLazy ?? '');
    input.dataset.maskPlaceholderChar = String(maskPlaceholderChar || '');
    input.dataset.maskOptions = String(maskOptions || '');
    input.classList.toggle('error', toBoolean(invalid || error, false));
    field.append(input);

    if (rightText) {
      const right = document.createElement('span');
      right.classList.add('sf-input-right');
      right.textContent = String(rightText);
      field.append(right);
    }

    if (hintIcon) {
      const iconHint = document.createElement('i');
      iconHint.classList.add('sf-icon', 'sf-icon-hint');
      iconHint.textContent = String(hintIcon);
      field.append(iconHint);
    }

    this.template.append(labelWrap, field);

    const message = toBoolean(invalid || error, false) && errorMessage
      ? errorMessage
      : hint;
    if (message) {
      const hintWrap = document.createElement('span');
      hintWrap.classList.add('sf-input-hint-text-wrap');
      hintWrap.textContent = String(message);
      hintWrap.dataset.fieldMessage = toBoolean(invalid || error, false) && errorMessage
        ? 'error'
        : 'hint';
      this.template.append(hintWrap);
    }

    this.applyLayoutUtilities(this.template, '.sf-input');
    this.applyLayoutUtilities(labelWrap, '.sf-input .sf-input-label');
    this.applyLayoutUtilities(field, '.sf-input .sf-input-field');
    this.applyLayoutUtilities(input, '.sf-input .sf-input-field input');
  }

  init() {
    bindInput(this.template);
  }

  destroyInternal() {
    unbindInput(this.template);
  }
}

Inputs.utilityMap = inputUtility;

registerComponent('Inputs', Inputs);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Input = window.SF.Input || {};
  window.SF.Input.setState = setInputState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingInputs());
} else {
  initExistingInputs();
}

const inputObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(INPUT_SELECTOR)) {
        bindInput(node);
      }
      initExistingInputs(node);
    });
  });
});

inputObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindInput, setInputState, unbindInput };
