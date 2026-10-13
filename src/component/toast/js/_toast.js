import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { dismissToastElement } from '../dismiss';
import { pageText } from '../../../core/js/page-language';

const TOAST_TEXT = { en: { close: 'Close message' }, ru: { close: 'Закрыть сообщение' } };

const TOAST_SELECTOR = '.sf-toast';
const TOAST_BOUND_FLAG = 'sfToastBound';
// The shared status vocabulary (neutral, info, success, warning, error). The
// words this component used before -- default and primary -- are still taken
// and mean neutral and info (journal class-status-aliases); SF.Toast.show
// refused the new words and drew them as default.
const TOAST_TYPES = new Set(['neutral', 'info', 'success', 'warning', 'error']);
const LEGACY_TOAST_TYPES = { default: 'neutral', primary: 'info' };

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function normalizeType(value) {
  const status = LEGACY_TOAST_TYPES[value] ?? value;
  return TOAST_TYPES.has(status) ? status : 'neutral';
}

function readDuration(root) {
  const duration = Number(root.getAttribute('data-duration'));
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function clearToastTimer(root) {
  if (root.__sfToastTimer) window.clearTimeout(root.__sfToastTimer);
  root.__sfToastTimer = null;
}

function startToastTimer(root) {
  clearToastTimer(root);
  if (!root.__sfToastRemaining || root.__sfToastPauseReasons?.size) return;
  root.__sfToastStartedAt = performance.now();
  root.__sfToastTimer = window.setTimeout(() => {
    dismissToast(root, root.__sfToastRemovalTarget || root);
  }, root.__sfToastRemaining);
}

function pauseToastTimer(root, reason) {
  root.__sfToastPauseReasons?.add(reason);
  if (!root.__sfToastTimer) return;
  root.__sfToastRemaining = Math.max(
    0,
    root.__sfToastRemaining - (performance.now() - root.__sfToastStartedAt),
  );
  clearToastTimer(root);
}

function resumeToastTimer(root, reason) {
  root.__sfToastPauseReasons?.delete(reason);
  startToastTimer(root);
}

function bindToast(root, removalTarget = root) {
  if (!(root instanceof HTMLElement)) return;

  root.__sfToastRemovalTarget = removalTarget instanceof Element ? removalTarget : root;
  if (root.dataset[TOAST_BOUND_FLAG] === '1') return;

  const handleClick = (event) => {
    const trigger = event.target?.closest?.(
      '[data-close], [data-toast-close], [data-action], [data-toast-action]',
    );
    if (!trigger || !root.contains(trigger) || trigger.closest(TOAST_SELECTOR) !== root) return;
    if (trigger.matches(':disabled, [aria-disabled="true"]')) return;

    if (trigger.matches('[data-close], [data-toast-close]')) {
      event.preventDefault();
      dismissToast(root, root.__sfToastRemovalTarget || root, trigger);
      return;
    }

    root.dispatchEvent(
      new CustomEvent('sf-toast-action', {
        bubbles: true,
        composed: true,
        detail: {
          action:
            trigger.getAttribute('data-action')
            || trigger.getAttribute('data-toast-action')
            || '',
          toast: root,
          trigger,
        },
      }),
    );
  };

  const handlePointerEnter = () => pauseToastTimer(root, 'pointer');
  const handlePointerLeave = () => resumeToastTimer(root, 'pointer');
  const handleFocusIn = () => pauseToastTimer(root, 'focus');
  const handleFocusOut = (event) => {
    if (!root.contains(event.relatedTarget)) resumeToastTimer(root, 'focus');
  };

  root.addEventListener('click', handleClick);
  root.addEventListener('pointerenter', handlePointerEnter);
  root.addEventListener('pointerleave', handlePointerLeave);
  root.addEventListener('focusin', handleFocusIn);
  root.addEventListener('focusout', handleFocusOut);
  root.__sfToastHandlers = {
    handleClick,
    handlePointerEnter,
    handlePointerLeave,
    handleFocusIn,
    handleFocusOut,
  };
  root.__sfToastPauseReasons = new Set();
  root.__sfToastRemaining = readDuration(root);
  root.dataset[TOAST_BOUND_FLAG] = '1';
  startToastTimer(root);
}

function unbindToast(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const handlers = root.__sfToastHandlers;
  if (handlers) {
    root.removeEventListener('click', handlers.handleClick);
    root.removeEventListener('pointerenter', handlers.handlePointerEnter);
    root.removeEventListener('pointerleave', handlers.handlePointerLeave);
    root.removeEventListener('focusin', handlers.handleFocusIn);
    root.removeEventListener('focusout', handlers.handleFocusOut);
  }

  clearToastTimer(root);
  delete root.__sfToastHandlers;
  delete root.__sfToastPauseReasons;
  delete root.__sfToastRemaining;
  delete root.__sfToastStartedAt;
  delete root.__sfToastRemovalTarget;
  delete root.dataset[TOAST_BOUND_FLAG];
}

// The removal target is read after the guard: as a default parameter it was
// read first, and dismiss(null) threw instead of answering false.
function dismissToast(root, removalTarget = null, trigger = null) {
  if (!(root instanceof HTMLElement) || root.classList.contains('closing')) return false;
  removalTarget = removalTarget || root.__sfToastRemovalTarget || root;

  unbindToast(root);
  root.dispatchEvent(
    new CustomEvent('sf-toast-close', {
      bubbles: true,
      composed: true,
      detail: { toast: root, trigger },
    }),
  );
  return dismissToastElement(root, removalTarget);
}

// What a toast reports is its status (journal record attribute-type-to-status);
// `type` is still read, as the attribute is, until that record leaves. Code
// that had moved to `status` got a default toast from the JS API.
function createToastElement(options = {}) {
  const {
    status,
    type = 'default',
    icon = '',
    title = '',
    supportingText = '',
    actionText = '',
    action = '',
    closable = true,
    closeLabel = pageText(TOAST_TEXT, 'close', document.documentElement),
    duration = 0,
    role = '',
  } = options;

  const root = document.createElement('div');
  root.className = joinClasses(
    'sf-toast',
    `sf-toast--${normalizeType(status ?? type)}`,
    'flex',
    'items-cross-start',
  );
  if (Number.isFinite(Number(duration)) && Number(duration) > 0) {
    root.dataset.duration = String(Number(duration));
  }
  if (role === 'status' || role === 'alert') root.setAttribute('role', role);

  if (icon) {
    const iconNode = document.createElement('i');
    iconNode.className = 'sf-icon';
    iconNode.setAttribute('aria-hidden', 'true');
    iconNode.textContent = icon;
    root.append(iconNode);
  }

  const container = document.createElement('div');
  container.className = 'sf-toast-container flex flex-col flex-1';

  const wrap = document.createElement('div');
  wrap.className = 'sf-toast-wrap flex flex-col';

  if (title) {
    const titleNode = document.createElement('div');
    titleNode.className = 'sf-toast-text';
    titleNode.textContent = title;
    wrap.append(titleNode);
  }

  if (supportingText) {
    const supportingTextNode = document.createElement('div');
    supportingTextNode.className = 'sf-toast-supporting-text';
    supportingTextNode.textContent = supportingText;
    wrap.append(supportingTextNode);
  }

  container.append(wrap);

  if (actionText) {
    const bottom = document.createElement('div');
    bottom.className = 'sf-toast-bottom flex items-center';

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'sf-button sf-button--primary sf-button--link sf-button--size-1';
    actionButton.setAttribute('data-action', action || 'action');
    actionButton.setAttribute('data-toast-action', action || 'action');

    const actionTextNode = document.createElement('span');
    actionTextNode.className = 'sf-button-text-container';
    actionTextNode.textContent = actionText;

    actionButton.append(actionTextNode);
    bottom.append(actionButton);
    container.append(bottom);
  }

  root.append(container);

  if (closable) {
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = joinClasses(
      'sf-icon-button',
      'sf-icon-button--variant-close',
      'sf-icon-button--on-surface',
      'sf-icon-button--link',
      'sf-icon-button--size-1/3',
    );
    closeButton.setAttribute('aria-label', closeLabel);
    closeButton.setAttribute('data-close', '');
    closeButton.setAttribute('data-toast-close', '');

    const close = document.createElement('span');
    close.className = 'sf-close sf-close--size-1/3 flex justify-center items-center';
    close.setAttribute('aria-hidden', 'true');
    const closeIcon = document.createElement('span');
    closeIcon.className = 'sf-close-icon';
    close.append(closeIcon);
    closeButton.append(close);
    root.append(closeButton);
  }

  bindToast(root);
  return root;
}

function showToast(target, options = {}) {
  const root =
    typeof target === 'string' ? document.querySelector(target) : target instanceof Element ? target : null;

  if (!(root instanceof Element)) {
    return null;
  }

  const toast = createToastElement(options);
  root.append(toast);
  return toast;
}

function initToastTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(TOAST_SELECTOR)) {
    bindToast(target);
  }

  target.querySelectorAll?.(TOAST_SELECTOR).forEach(bindToast);
}

class Toast extends ComponentObserver {
  static componentName = 'Toast';
  html = null;

  constructor(props) {
    super(props);

    const {
      status,
      type = 'default',
      icon = '',
      title = '',
      supportingText = '',
      actionText = '',
      action = '',
      closable = true,
    } = this.params || {};

    this.template = createToastElement({
      status,
      type,
      icon,
      title,
      supportingText,
      actionText,
      action,
      closable,
      closeLabel: this.params?.closeLabel,
      duration: this.params?.duration,
      role: this.params?.role,
    });

    if (this.id) {
      this.template.id = this.id;
    }
  }

  init() {
    bindToast(this.template);
  }

  destroyInternal() {
    if (!this.template) return;
    unbindToast(this.template);
  }
}

registerComponent('Toast', Toast);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Toast = window.SF.Toast || {};
  window.SF.Toast.bind = bindToast;
  window.SF.Toast.unbind = unbindToast;
  window.SF.Toast.dismiss = dismissToast;
  window.SF.Toast.create = createToastElement;
  window.SF.Toast.show = showToast;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initToastTree(document));
} else {
  initToastTree(document);
}

const toastObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initToastTree(node);
    });
  });
});

toastObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindToast, createToastElement, dismissToast, showToast, unbindToast };
