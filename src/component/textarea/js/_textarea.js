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

// Auto-grow (simai/ui-source#17). The field follows its text between min-rows
// and max-rows and scrolls inside only past max-rows. CSS does it where the
// browser has `field-sizing: content`; the stylesheet also holds the limits, on
// the size ladder (one row is the height of an input of the same size, each
// further row adds the text line height of that size). Elsewhere the script
// below sets the height from scrollHeight on input, on a value set from code,
// on form reset and when the width changes -- never in the middle of an IME
// composition, which is measured once it ends.
const AUTO_GROW_CLASS = 'sf-textarea--auto-grow';

function supportsFieldSizing() {
  return typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content') === true;
}

function rowCount(value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const normalized = Math.trunc(Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

// A bare data-auto-grow (or the root class written in markup) turns it on;
// data-auto-grow="false" turns it off.
function autoGrowFlag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (value === '') return true;
  return toBoolean(value, fallback);
}

function resolveAutoGrow(root, textarea) {
  const enabled = autoGrowFlag(
    textarea.dataset.autoGrow ?? root.dataset.autoGrow,
    root.classList.contains(AUTO_GROW_CLASS),
  );
  if (!enabled) return null;
  const minRows = rowCount(textarea.dataset.minRows ?? root.dataset.minRows) ?? 1;
  const maxRows = rowCount(textarea.dataset.maxRows ?? root.dataset.maxRows);
  return { minRows, maxRows: maxRows === null ? null : Math.max(maxRows, minRows) };
}

// The height the text needs, written as the block size; min-block-size and
// max-block-size in the stylesheet keep it between the two limits. The root
// holds its height while the field is measured, so the page below does not
// move and the window does not scroll; the field keeps its own scroll.
function growTextarea(root, textarea) {
  if (!textarea.isConnected || textarea.clientWidth === 0) return;
  const heldMinBlockSize = root.style.minBlockSize;
  root.style.minBlockSize = `${root.getBoundingClientRect().height}px`;
  const { scrollTop } = textarea;
  textarea.style.blockSize = 'auto';
  const style = getComputedStyle(textarea);
  const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  textarea.style.blockSize = `${textarea.scrollHeight + border}px`;
  // Only a scroll the measuring lost is put back: writing scrollTop cancels the
  // browser's own pending move of the caret into view after a paste.
  if (textarea.scrollTop !== scrollTop) textarea.scrollTop = scrollTop;
  root.style.minBlockSize = heldMinBlockSize;
}

function bindAutoGrow(root, textarea) {
  const config = resolveAutoGrow(root, textarea);
  if (!config) return;

  const addedClass = !root.classList.contains(AUTO_GROW_CLASS);
  root.classList.add(AUTO_GROW_CLASS);
  textarea.rows = config.minRows;
  textarea.style.setProperty('--sf-textarea--min-rows', String(config.minRows));
  if (config.maxRows === null) textarea.style.removeProperty('--sf-textarea--max-rows');
  else textarea.style.setProperty('--sf-textarea--max-rows', String(config.maxRows));

  const state = { addedClass, fallback: null };
  root.__sfTextareaAutoGrow = state;
  if (supportsFieldSizing()) return;

  let composing = false;
  let width = -1;
  const grow = () => {
    if (!composing) growTextarea(root, textarea);
  };
  const onInput = (event) => {
    if (event.isComposing) return;
    grow();
  };
  const onCompositionStart = () => { composing = true; };
  const onCompositionEnd = () => {
    composing = false;
    grow();
  };
  textarea.addEventListener('input', onInput);
  textarea.addEventListener('compositionstart', onCompositionStart);
  textarea.addEventListener('compositionend', onCompositionEnd);

  // A value set from code fires no input event: the field's own value setter
  // measures after it, so el.value = '...' grows and shrinks the field too.
  const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(textarea, 'value', {
    configurable: true,
    enumerable: true,
    get() { return native.get.call(this); },
    set(next) {
      native.set.call(this, next);
      grow();
    },
  });

  // Text wraps differently at another width; the height follows it. The block
  // size the script writes changes nothing here, so this cannot loop.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
    const next = Math.round(entries[entries.length - 1].contentRect.width);
    if (next === width) return;
    width = next;
    grow();
  });
  observer?.observe(textarea);
  grow();

  state.fallback = { grow, onInput, onCompositionStart, onCompositionEnd, observer };
}

function unbindAutoGrow(root, textarea) {
  const state = root.__sfTextareaAutoGrow;
  if (!state) return;
  delete root.__sfTextareaAutoGrow;
  if (state.addedClass) root.classList.remove(AUTO_GROW_CLASS);
  if (!textarea) return;
  textarea.style.removeProperty('--sf-textarea--min-rows');
  textarea.style.removeProperty('--sf-textarea--max-rows');
  const { fallback } = state;
  if (!fallback) return;
  textarea.removeEventListener('input', fallback.onInput);
  textarea.removeEventListener('compositionstart', fallback.onCompositionStart);
  textarea.removeEventListener('compositionend', fallback.onCompositionEnd);
  fallback.observer?.disconnect();
  delete textarea.value;
  textarea.style.removeProperty('block-size');
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
    root.__sfTextareaAutoGrow?.fallback?.grow();
  });
  bindAutoGrow(root, textarea);
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
  unbindAutoGrow(root, textarea);
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
      autoGrow = false,
      minRows,
      maxRows,
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
    if (toBoolean(autoGrow, false)) {
      textarea.dataset.autoGrow = 'true';
      const normalizedMinRows = rowCount(minRows);
      const normalizedMaxRows = rowCount(maxRows);
      if (normalizedMinRows !== null) textarea.dataset.minRows = String(normalizedMinRows);
      if (normalizedMaxRows !== null) textarea.dataset.maxRows = String(normalizedMaxRows);
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
