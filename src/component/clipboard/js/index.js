import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

const COPY_SELECTOR = '.sf-clipboard, .btn-clipboard';
const BOUND_FLAG = 'sfCopyBound';
const ICON_SELECTOR = 'sf-icon, .sf-icon';
const COPY_SIZES = new Set(['1/3', '1/2', '1', '2', '3']);
const COPY_TYPES = new Set(['default', 'tonal', 'outline', 'link']);
const COPY_SCHEMES = new Set(['primary', 'secondary', 'on-surface']);
const SOURCE_ERROR_CODES = new Set([
  'ambiguous_source',
  'empty_source',
  'missing_source',
  'missing_target',
]);

function normalizeChoice(value, choices, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return choices.has(normalized) ? normalized : fallback;
}

function normalizeDuration(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5000;
  return Math.min(10000, Math.max(1000, parsed));
}

function normalizeCopyError(error) {
  if (SOURCE_ERROR_CODES.has(error?.message)) return error.message;
  if (error?.message === 'copy_unsupported') return 'copy_unsupported';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'copy_denied';
  }
  return 'copy_failed';
}

function resolveIdTarget(button, value) {
  const normalized = String(value || '').trim();
  if (!/^#[A-Za-z][\w:.-]*$/.test(normalized)) return null;
  return button.ownerDocument.getElementById(normalized.slice(1));
}

function readTargetText(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  // A numbered code block (Highlight data-lines) copies its code: one line per
  // row and none of the numbers. Its text content ran the numbers into the
  // code and the rows into one line («1.card {2  padding…»).
  const rows = target?.querySelectorAll?.(':scope .sf-code-lines > .sf-code-line > .sf-code-line__content');
  // An empty line is drawn as a space so its row keeps a height; it copies empty.
  if (rows?.length) return Array.from(rows, row => (row.textContent === ' ' ? '' : row.textContent)).join('\n');
  return target?.textContent || '';
}

function resolveCopySource(button) {
  const hasValue = button.hasAttribute('data-copy');
  const targetValues = [button.getAttribute('data-target'), button.getAttribute('data-clipboard-target')]
    .filter(value => value !== null && String(value).trim() !== '');
  const uniqueTargets = [...new Set(targetValues)];

  if ((hasValue && uniqueTargets.length) || uniqueTargets.length > 1) {
    throw new Error('ambiguous_source');
  }
  if (hasValue) return String(button.getAttribute('data-copy') || '');
  if (uniqueTargets.length === 1) {
    const target = resolveIdTarget(button, uniqueTargets[0]);
    if (!target) throw new Error('missing_target');
    return readTargetText(target);
  }
  throw new Error('missing_source');
}

function legacyWriteText(text, documentRef) {
  const textarea = documentRef.createElement('textarea');
  textarea.className = 'sf-clipboard-fallback';
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  documentRef.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try {
    copied = documentRef.execCommand('copy');
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error('copy_unsupported');
}

async function writeText(text, documentRef = document) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'native';
    } catch {
      // A secure page whose clipboard permission is denied -- a policy, an
      // embedded frame, a browser that asks and was answered no. The API being
      // present was read as the API being allowed, so the fallback that exists
      // for exactly this was never reached and the copy simply failed.
    }
  }
  legacyWriteText(text, documentRef);
  return 'legacy';
}

function ensureStatus(button) {
  const selector = button.getAttribute('data-status');
  const authored = selector ? resolveIdTarget(button, selector) : null;
  if (authored) {
    authored.setAttribute('role', 'status');
    authored.setAttribute('aria-live', 'polite');
    authored.setAttribute('aria-atomic', 'true');
    return { element: authored, generated: false };
  }
  const status = button.ownerDocument.createElement('span');
  status.className = 'sf-clipboard-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  button.after(status);
  return { element: status, generated: true };
}

function setIcon(button, name) {
  const icon = button.querySelector(ICON_SELECTOR);
  if (!icon) return;
  if (icon.tagName.toLowerCase() === 'sf-icon') icon.setAttribute('icon', name);
  else icon.textContent = name;
}

function setCopyFeedback(button, controller, state, message) {
  window.clearTimeout(controller.resetTimer);
  button.dataset.copyState = state;
  controller.status.element.textContent = message;
  setIcon(button, state === 'success' ? 'check' : state === 'error' ? 'error' : 'content_copy');
  if (state === 'success' || state === 'error') {
    controller.resetTimer = window.setTimeout(() => {
      delete button.dataset.copyState;
      controller.status.element.textContent = '';
      setIcon(button, 'content_copy');
    }, normalizeDuration(button.dataset.duration));
  }
}

async function activateCopy(button, controller) {
  if (controller.pending) return;
  controller.pending = true;
  button.setAttribute('aria-disabled', 'true');
  button.dataset.copyState = 'pending';
  try {
    const text = resolveCopySource(button);
    if (!text) throw new Error('empty_source');
    const method = await writeText(text, button.ownerDocument);
    setCopyFeedback(button, controller, 'success', button.dataset.success || '');
    button.dispatchEvent(new CustomEvent('sf:copy-success', {
      bubbles: true,
      detail: { method, text },
    }));
  } catch (error) {
    const code = normalizeCopyError(error);
    setCopyFeedback(button, controller, 'error', button.dataset.error || '');
    button.dispatchEvent(new CustomEvent('sf:copy-error', {
      bubbles: true,
      detail: { code },
    }));
  } finally {
    controller.pending = false;
    button.removeAttribute('aria-disabled');
  }
}

function bindCopyButton(button) {
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.dataset[BOUND_FLAG] === 'true') return button._sfCopyController;
  const controller = {
    pending: false,
    resetTimer: null,
    status: ensureStatus(button),
  };
  controller.onClick = () => activateCopy(button, controller);
  button.addEventListener('click', controller.onClick);
  button.dataset[BOUND_FLAG] = 'true';
  button._sfCopyController = controller;
  return controller;
}

function unbindCopyButton(button) {
  const controller = button?._sfCopyController;
  if (!controller) return;
  button.removeEventListener('click', controller.onClick);
  window.clearTimeout(controller.resetTimer);
  if (controller.status.generated) controller.status.element.remove();
  delete button._sfCopyController;
  delete button.dataset[BOUND_FLAG];
  delete button.dataset.copyState;
  button.removeAttribute('aria-disabled');
}

function initCopyTree(target = document) {
  if (target instanceof Element && target.matches?.(COPY_SELECTOR)) bindCopyButton(target);
  target.querySelectorAll?.(COPY_SELECTOR).forEach(bindCopyButton);
}

class Copy extends ComponentObserver {
  static componentName = 'Copy';

  constructor(props) {
    super(props);
    const {
      size = '1', type = 'link', scheme = 'on-surface', text = '', copy = text,
      done = '', error = '', label = '',
    } = this.params || {};
    const normalizedSize = normalizeChoice(size, COPY_SIZES, '1');
    const normalizedType = normalizeChoice(type, COPY_TYPES, 'link');
    const normalizedScheme = normalizeChoice(scheme, COPY_SCHEMES, 'on-surface');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('sf-clipboard', `sf-clipboard-${normalizedSize}`, 'm-0');
    button.dataset.copy = String(copy || '');
    if (done) button.dataset.success = done;
    if (error) button.dataset.error = error;
    const hasText = Boolean(String(text).trim());
    const accessibleLabel = String(this.attrs['aria-label'] || label || '').trim();
    if (accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
    else if (!hasText) button.disabled = true;
    button.classList.add(
      hasText ? 'sf-button' : 'sf-icon-button',
      'flex',
      'items-cross-center',
      hasText ? `sf-button--size-${normalizedSize}` : 'sf-icon-button--icon',
      hasText ? `sf-button--${normalizedScheme}` : `sf-icon-button--size-${normalizedSize}`,
      hasText ? `sf-button--${normalizedType}` : `sf-icon-button--${normalizedScheme}`,
    );
    if (!hasText) button.classList.add(`sf-icon-button--${normalizedType}`);
    const icon = document.createElement('sf-icon');
    icon.setAttribute('icon', 'content_copy');
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);
    if (hasText) {
      const span = document.createElement('span');
      span.className = 'sf-button-text-container';
      span.textContent = text;
      button.append(span);
    }
    this.template = button;
  }

  init() { bindCopyButton(this.html); }
  destroyInternal() { unbindCopyButton(this.html); }
}

registerComponent('Copy', Copy);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Clipboard = {
    bind: bindCopyButton,
    copy: button => activateCopy(button, button?._sfCopyController || bindCopyButton(button)),
    unbind: unbindCopyButton,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCopyTree(), { once: true });
} else {
  initCopyTree();
}

new MutationObserver((mutations) => mutations.forEach((mutation) => {
  mutation.addedNodes.forEach((node) => {
    if (node instanceof Element) initCopyTree(node);
  });
})).observe(document.documentElement, { childList: true, subtree: true });

export {
  activateCopy,
  bindCopyButton,
  initCopyTree,
  resolveCopySource,
  normalizeCopyError,
  unbindCopyButton,
  writeText,
};
