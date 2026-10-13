import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import textareaUtility from '../json/textarea.utility.json';
import { syncFieldContract } from '../../field-contract';
import { fieldSize, retireFieldSizeClass } from '../../field-size';
import { bindFormReset } from '../../form-reset-helper';
import { maskService } from '../../mask-service';

const TEXTAREA_SELECTOR = 'label.sf-textarea';
const TEXTAREA_BOUND_FLAG = 'sfTextareaBound';
const TEXTAREA_VARIANTS = new Set(['bordered', 'filled']);
const TEXTAREA_INPUT_MODES = new Set(['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
const TEXTAREA_WRAP_VALUES = new Set(['soft', 'hard']);

function boundedValue(value, allowed, fallback) {
  const normalized = String(value || fallback);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeInputMode(value) {
  const normalized = String(value || '').toLowerCase();
  return TEXTAREA_INPUT_MODES.has(normalized) ? normalized : '';
}

function normalizeLength(value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function normalizeWrap(value) {
  const normalized = String(value || 'soft').toLowerCase();
  return TEXTAREA_WRAP_VALUES.has(normalized) ? normalized : 'soft';
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getTextareaNode(root) {
  return root?.querySelector?.('textarea') || null;
}

function getMessageNode(root) {
  return root?.querySelector?.('.sf-textarea-hint-text-wrap') || null;
}

function ensureMessageNode(root) {
  const existing = getMessageNode(root);
  if (existing) return existing;

  const messageNode = document.createElement('span');
  messageNode.classList.add('sf-textarea-hint-text-wrap');
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

function resolveMaskConfig(root, textarea) {
  const enabled = toBoolean(
    textarea.dataset.mask ?? root.dataset.mask,
    false,
  );
  if (!enabled) return null;

  const fromTextarea = parseMaskOptions(textarea.dataset.maskOptions);
  const fromRoot = parseMaskOptions(root.dataset.maskOptions);
  if (fromTextarea) return fromTextarea;
  if (fromRoot) return fromRoot;

  const pattern = textarea.dataset.maskPattern ?? root.dataset.maskPattern;
  if (pattern) return { mask: String(pattern) };
  return null;
}

async function bindMask(root, textarea) {
  const config = resolveMaskConfig(root, textarea);
  if (!config) return;
  const request = {};
  root.__sfTextareaMaskRequest = request;

  try {
    const service = await maskService();
    if (root.__sfTextareaMaskRequest !== request) return;
    const instance = await service.create(textarea, config);
    if (!instance) return;
    if (root.dataset[TEXTAREA_BOUND_FLAG] !== '1' || root.__sfTextareaMaskRequest !== request || getTextareaNode(root) !== textarea) {
      service.destroy(instance);
      return;
    }
    root.__sfTextareaMask = instance;
  } catch (error) {
    console.warn('SF.Textarea mask init failed', error);
  }
}

function bindTextarea(root) {
  retireFieldSizeClass(root, 'sf-textarea');
  if (!root || root.dataset[TEXTAREA_BOUND_FLAG] === '1') return;
  const textarea = getTextareaNode(root);
  if (!textarea) return;

  const noopHandler = () => {};
  const pointerFocusHandler = () => root.classList.add('sf-textarea--pointer-focus');
  const blurHandler = () => root.classList.remove('sf-textarea--pointer-focus');
  textarea.addEventListener('input', noopHandler);
  textarea.addEventListener('pointerdown', pointerFocusHandler);
  textarea.addEventListener('blur', blurHandler);
  root.__sfTextareaNoopHandler = noopHandler;
  root.__sfTextareaPointerFocusHandler = pointerFocusHandler;
  root.__sfTextareaBlurHandler = blurHandler;

  root.dataset[TEXTAREA_BOUND_FLAG] = '1';
  const message = messageState(root);
  syncFieldContract(root, textarea, {
    prefix: 'sf-textarea',
    labelNode: root.querySelector('.sf-textarea-text'),
    required: textarea.required || Boolean(root.querySelector('.sf-textarea-required')),
    invalid: root.classList.contains('error') || textarea.classList.contains('error'),
    ...message,
  });
  root.__sfTextareaReleaseReset = bindFormReset(textarea, () => {
    if (root.__sfTextareaMask) root.__sfTextareaMask.value = textarea.value;
  });
  bindMask(root, textarea);
}

function unbindTextarea(root) {
  if (!root || root.dataset[TEXTAREA_BOUND_FLAG] !== '1') return;
  delete root.__sfTextareaMaskRequest;
  const textarea = getTextareaNode(root);
  if (textarea && root.__sfTextareaNoopHandler) {
    textarea.removeEventListener('input', root.__sfTextareaNoopHandler);
  }
  if (textarea && root.__sfTextareaPointerFocusHandler) {
    textarea.removeEventListener('pointerdown', root.__sfTextareaPointerFocusHandler);
  }
  if (textarea && root.__sfTextareaBlurHandler) {
    textarea.removeEventListener('blur', root.__sfTextareaBlurHandler);
  }
  if (root.__sfTextareaMask) {
    window.SF?.Mask?.destroy?.(root.__sfTextareaMask);
  }
  root.__sfTextareaReleaseReset?.();
  delete root.__sfTextareaReleaseReset;
  delete root.__sfTextareaMask;
  delete root.__sfTextareaNoopHandler;
  delete root.__sfTextareaPointerFocusHandler;
  delete root.__sfTextareaBlurHandler;
  root.classList.remove('sf-textarea--pointer-focus');
  delete root.dataset[TEXTAREA_BOUND_FLAG];
}

function initExistingTextareas(target = document) {
  target.querySelectorAll(TEXTAREA_SELECTOR).forEach(bindTextarea);
}

function setTextareaState(target, state = {}) {
  const root =
    target instanceof HTMLElement
      ? target.closest(TEXTAREA_SELECTOR) || target
      : null;
  if (!root) return false;

  const textarea = getTextareaNode(root);
  if (!textarea) return false;

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    textarea.disabled = toBoolean(state.disabled);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'error')) {
    const invalid = toBoolean(state.error);
    root.classList.toggle('error', invalid);
    textarea.classList.toggle('error', invalid);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'invalid')) {
    const invalid = toBoolean(state.invalid);
    root.classList.toggle('error', invalid);
    textarea.classList.toggle('error', invalid);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'errorMessage')) {
    const value = String(state.errorMessage ?? '');
    const messageNode = value ? ensureMessageNode(root) : getMessageNode(root);
    if (messageNode) {
      messageNode.textContent = value;
      // The text is an error only on a field left invalid. Restoring a hint
      // with {invalid: false, errorMessage: hint} marked it an error, and a
      // later error with no text of its own pointed aria-errormessage at it.
      const invalid = root.classList.contains('error') || textarea.classList.contains('error');
      messageNode.dataset.fieldMessage = value && invalid ? 'error' : 'hint';
    }
  }
  if (Object.prototype.hasOwnProperty.call(state, 'value')) {
    textarea.value = String(state.value ?? '');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  syncFieldContract(root, textarea, {
    prefix: 'sf-textarea',
    labelNode: root.querySelector('.sf-textarea-text'),
    required: textarea.required || Boolean(root.querySelector('.sf-textarea-required')),
    invalid: root.classList.contains('error') || textarea.classList.contains('error'),
    ...messageState(root),
  });

  return true;
}

class Textarea extends ComponentObserver {
  static componentName = 'Textarea';
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
      autocomplete = '',
      inputMode = '',
      minLength = '',
      maxLength = '',
      spellcheck = true,
      wrap = 'soft',
      hint = '',
      value = '',
      name = '',
      rows = 3,
      disabled = false,
      readonly = false,
      error = false,
      invalid = false,
      errorMessage = '',
      mask = false,
      maskOptions,
      maskPattern,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    const normalizedSize = fieldSize(size, 'sf-textarea');
    const normalizedVariant = boundedValue(type, TEXTAREA_VARIANTS, 'bordered');

    this.template = document.createElement('label');
    if (this.id) this.template.id = this.id;
    this.template.classList.add(
      'sf-textarea',
      `sf-textarea--size-${normalizedSize}`,
      `sf-textarea--${normalizedVariant}`,
    );
    this.template.classList.toggle('error', toBoolean(invalid || error, false));
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    const labelWrap = document.createElement('span');
    labelWrap.classList.add('sf-textarea-label');

    const labelText = document.createElement('span');
    labelText.classList.add('sf-textarea-text');
    labelText.textContent = String(label);
    labelWrap.append(labelText);

    if (toBoolean(required, true)) {
      const requiredMark = document.createElement('span');
      requiredMark.classList.add('sf-textarea-required');
      requiredMark.textContent = '*';
      labelWrap.append(requiredMark);
    }

    const textarea = document.createElement('textarea');
    textarea.placeholder = String(placeholder ?? '');
    if (autocomplete) textarea.autocomplete = String(autocomplete);
    textarea.inputMode = normalizeInputMode(inputMode);
    const normalizedMinLength = normalizeLength(minLength);
    const normalizedMaxLength = normalizeLength(maxLength);
    if (normalizedMinLength !== null) textarea.minLength = normalizedMinLength;
    if (normalizedMaxLength !== null) textarea.maxLength = normalizedMaxLength;
    textarea.spellcheck = toBoolean(spellcheck, true);
    textarea.wrap = normalizeWrap(wrap);
    textarea.value = String(value ?? '');
    textarea.defaultValue = String(value ?? '');
    textarea.rows = Number(rows) > 0 ? Number(rows) : 3;
    if (name) textarea.name = String(name);
    textarea.disabled = toBoolean(disabled, false);
    textarea.readOnly = toBoolean(readonly, false);
    textarea.required = toBoolean(required, true);
    textarea.classList.toggle('error', toBoolean(invalid || error, false));
    textarea.dataset.mask = String(Boolean(mask));
    if (maskPattern) textarea.dataset.maskPattern = String(maskPattern);
    if (maskOptions && typeof maskOptions === 'object') {
      textarea.dataset.maskOptions = JSON.stringify(maskOptions);
    }

    this.template.append(labelWrap, textarea);

    const message = toBoolean(invalid || error, false) && errorMessage
      ? errorMessage
      : hint;
    if (message) {
      const hintWrap = document.createElement('span');
      hintWrap.classList.add('sf-textarea-hint-text-wrap');
      hintWrap.textContent = String(message);
      hintWrap.dataset.fieldMessage = toBoolean(invalid || error, false) && errorMessage
        ? 'error'
        : 'hint';
      this.template.append(hintWrap);
    }

    this.applyLayoutUtilities(this.template, '.sf-textarea');
    this.applyLayoutUtilities(labelWrap, '.sf-textarea .sf-textarea-label');
    this.applyLayoutUtilities(textarea, '.sf-textarea textarea');
  }

  init() {
    bindTextarea(this.template);
  }

  destroyInternal() {
    unbindTextarea(this.template);
  }
}

Textarea.utilityMap = textareaUtility;

registerComponent('Textarea', Textarea);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Textarea = window.SF.Textarea || {};
  window.SF.Textarea.setState = setTextareaState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingTextareas());
} else {
  initExistingTextareas();
}

const textareaObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(TEXTAREA_SELECTOR)) {
        bindTextarea(node);
      }
      initExistingTextareas(node);
    });
  });
});

textareaObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindTextarea,
  unbindTextarea,
  setTextareaState,
};
