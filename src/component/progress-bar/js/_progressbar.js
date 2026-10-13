import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

const PROGRESS_BAR_SELECTOR = '.sf-progress-bar';
const PROGRESS_BAR_BOUND_FLAG = 'sfProgressBarBound';

function normalizeSize(value) {
  const normalized = String(value || '').toLowerCase();
  const supported = ['1/3', '1/2', '1', '2', '3'];
  return supported.includes(normalized) ? normalized : '1';
}

function normalizeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, parsed));
}

function normalizeTextPosition(value, fallback = 'none') {
  const normalized = String(value || fallback).toLowerCase();
  return ['none', 'right', 'inline-end', 'bottom'].includes(normalized)
    ? normalized
    : fallback;
}

// The shared status words. `primary` was the old word for no status: it has no
// colour of its own and draws the default, as before; `info` was turned into it.
const TONES = ['info', 'success', 'warning', 'error'];

function normalizeTone(value) {
  const normalized = String(value || '').toLowerCase();
  return TONES.includes(normalized) ? normalized : '';
}

function getProgressNode(root) {
  return root?.querySelector?.('.sf-progress-bar-progress') || null;
}

function getTextNode(root) {
  return root?.querySelector?.('.sf-progress-bar-text') || null;
}

function getMainNode(root) {
  return root?.querySelector?.('.sf-progress-bar-main') || null;
}

function detectTextPosition(root) {
  if (!getTextNode(root)) {
    return 'none';
  }

  if (root.classList.contains('flex-col')) {
    return 'bottom';
  }

  return 'right';
}

function ensureTextNode(root) {
  let textNode = getTextNode(root);
  if (textNode) return textNode;

  textNode = document.createElement('div');
  textNode.className = 'sf-progress-bar-text';
  root.append(textNode);
  return textNode;
}

function syncRootLayout(root, textPosition = 'none') {
  root.classList.add('sf-progress-bar', 'flex');
  root.classList.remove('flex-col', 'flex-row', 'items-cross-end', 'items-cross-center');

  if (textPosition === 'bottom') {
    root.classList.add('flex-col', 'items-cross-end');
    return;
  }

  if (textPosition === 'right' || textPosition === 'inline-end') {
    root.classList.add('flex-row', 'items-cross-center');
  }
}

function syncProgressAccessibility(root, value) {
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', String(value));

  const label = root.dataset.label;
  if (label) {
    root.setAttribute('aria-label', label);
  }

  const valueText = root.dataset.valueText;
  if (valueText) {
    root.setAttribute('aria-valuetext', valueText);
  } else {
    root.removeAttribute('aria-valuetext');
  }
}

function syncTone(root, tone) {
  ['primary', ...TONES].forEach((name) => {
    root.classList.toggle(`sf-progress-bar--${name}`, name === tone);
  });
  if (tone) root.dataset.tone = tone;
  else delete root.dataset.tone;
}

function renderProgressBar(root) {
  if (!root) return false;

  const progress = getProgressNode(root);
  const main = getMainNode(root);
  if (!progress || !main) return false;

  const value = normalizeValue(root.dataset.value ?? root.getAttribute('data-value') ?? 0);
  const textPosition = normalizeTextPosition(
    root.dataset.position ?? root.dataset.textPosition ?? root.getAttribute('data-text-position'),
    detectTextPosition(root),
  );
  const tone = normalizeTone(root.dataset.tone);

  syncRootLayout(root, textPosition);
  syncTone(root, tone);
  syncProgressAccessibility(root, value);
  progress.style.width = `${value}%`;
  root.dataset.value = String(value);
  root.dataset.position = textPosition;

  if (textPosition === 'none') {
    const textNode = getTextNode(root);
    if (textNode) {
      textNode.remove();
    }
    return true;
  }

  const textNode = ensureTextNode(root);
  textNode.textContent = `${value}%`;
  if (textPosition === 'bottom' && textNode.parentElement !== root) {
    root.append(textNode);
  }

  return true;
}

function bindProgressBar(root) {
  if (!root || root.dataset[PROGRESS_BAR_BOUND_FLAG] === '1') return;
  renderProgressBar(root);
  root.dataset[PROGRESS_BAR_BOUND_FLAG] = '1';
}

function unbindProgressBar(root) {
  if (!root || root.dataset[PROGRESS_BAR_BOUND_FLAG] !== '1') return;
  delete root.dataset[PROGRESS_BAR_BOUND_FLAG];
}

function initExistingProgressBars(target = document) {
  target.querySelectorAll(PROGRESS_BAR_SELECTOR).forEach(bindProgressBar);
}

function setProgressBarState(target, state = {}) {
  const root =
    target instanceof HTMLElement
      ? target.closest(PROGRESS_BAR_SELECTOR) || target
      : null;

  if (!root) return false;

  if (Object.prototype.hasOwnProperty.call(state, 'value')) {
    root.dataset.value = String(normalizeValue(state.value));
  }

  if (Object.prototype.hasOwnProperty.call(state, 'textPosition')) {
    root.dataset.position = normalizeTextPosition(state.textPosition);
  }

  // A progress indicator's colour role is its status (journal record
  // attribute-tone-to-status); tone is still read until that record leaves.
  if (Object.prototype.hasOwnProperty.call(state, 'status') || Object.prototype.hasOwnProperty.call(state, 'tone')) {
    root.dataset.tone = normalizeTone(state.status ?? state.tone);
  }

  if (Object.prototype.hasOwnProperty.call(state, 'label')) {
    const label = String(state.label || '').trim();
    if (label) {
      root.dataset.label = label;
      root.setAttribute('aria-label', label);
    } else {
      delete root.dataset.label;
      root.removeAttribute('aria-label');
    }
  }

  if (Object.prototype.hasOwnProperty.call(state, 'valueText')) {
    const valueText = String(state.valueText || '').trim();
    if (valueText) root.dataset.valueText = valueText;
    else delete root.dataset.valueText;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'size')) {
    const currentSizeClass = Array.from(root.classList).find((cls) =>
      cls.startsWith('sf-progress-bar--size-'),
    );
    if (currentSizeClass) {
      root.classList.remove(currentSizeClass);
    }
    root.classList.add(`sf-progress-bar--size-${normalizeSize(state.size)}`);
  }

  return renderProgressBar(root);
}

function getProgressBarState(target) {
  const root =
    target instanceof HTMLElement
      ? target.closest(PROGRESS_BAR_SELECTOR) || target
      : null;

  if (!root) return null;

  return {
    value: normalizeValue(root.dataset.value ?? 0),
    textPosition: normalizeTextPosition(root.dataset.position ?? root.dataset.textPosition, detectTextPosition(root)),
    status: normalizeTone(root.dataset.tone),
    tone: normalizeTone(root.dataset.tone),
    label: root.getAttribute('aria-label') || '',
    valueText: root.getAttribute('aria-valuetext') || '',
  };
}

class ProgressBar extends ComponentObserver {
  static componentName = 'ProgressBar';
  html = null;

  constructor(props) {
    super(props);

    const {
      size = '1',
      value = 0,
      textPosition = 'none',
      status,
      tone = 'primary',
      label = '',
      valueText = '',
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    const root = document.createElement('div');
    if (this.id) {
      root.id = this.id;
    }

    root.classList.add(
      'sf-progress-bar',
      `sf-progress-bar--size-${normalizeSize(size)}`,
      'flex',
    );
    if (className) {
      root.classList.add(...String(className).split(' ').filter(Boolean));
    }

    root.dataset.value = String(normalizeValue(value));
    root.dataset.position = normalizeTextPosition(textPosition);
    root.dataset.tone = normalizeTone(status ?? tone);
    if (String(label).trim()) root.dataset.label = String(label).trim();
    if (String(valueText).trim()) root.dataset.valueText = String(valueText).trim();

    const main = document.createElement('div');
    main.className = 'sf-progress-bar-main';

    const progress = document.createElement('div');
    progress.className = 'sf-progress-bar-progress transition';
    main.append(progress);
    root.append(main);

    this.template = root;
  }

  init() {
    bindProgressBar(this.template);
  }

  destroyInternal() {
    unbindProgressBar(this.template);
  }
}

registerComponent('ProgressBar', ProgressBar);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.ProgressBar = window.SF.ProgressBar || {};
  window.SF.ProgressBar.getState = getProgressBarState;
  window.SF.ProgressBar.setState = setProgressBarState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingProgressBars(), {
    once: true,
  });
} else {
  initExistingProgressBars();
}

const progressBarObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(PROGRESS_BAR_SELECTOR)) {
        bindProgressBar(node);
      }
      initExistingProgressBars(node);
    });
  });
});

progressBarObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindProgressBar,
  unbindProgressBar,
  initExistingProgressBars,
  setProgressBarState,
  getProgressBarState,
};
