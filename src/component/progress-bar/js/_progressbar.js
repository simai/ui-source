import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { noteDeprecated } from '../../../core/js/deprecations.js';

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

// The text stands over the bar (top: the name at the start, the value at the
// end) or at the end of its row (inline-end), or is not shown (owner decision
// C131 (4)). bottom and right are the former words for top and inline-end,
// read until 2027-01-01 (journal record value-progress-text-position).
const TEXT_POSITIONS = ['none', 'top', 'inline-end'];
const FORMER_TEXT_POSITIONS = { bottom: 'top', right: 'inline-end' };

function normalizeTextPosition(value, fallback = 'none') {
  const normalized = String(value || fallback).toLowerCase();
  const named = FORMER_TEXT_POSITIONS[normalized] ?? normalized;
  if (named !== normalized) {
    noteDeprecated({component: 'progress-bar', kind: 'value', attribute: 'data-position', from: normalized, to: named,
      since: '2026-11-13', remove_after: '2027-01-01'});
  }
  return TEXT_POSITIONS.includes(named) ? named : fallback;
}

// The shared status words (owner decision C131 (1)): no status draws the
// theme's primary and carries no class; neutral is grey, as in sf-dot and
// sf-badge. `primary` is the former word for no status.
const TONES = ['neutral', 'info', 'success', 'warning', 'error'];

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

function getHeadNode(root) {
  return root?.querySelector?.(':scope > .sf-progress-bar-head') || null;
}

function getMainNode(root) {
  return root?.querySelector?.('.sf-progress-bar-main') || null;
}

function detectTextPosition(root) {
  if (!getTextNode(root)) {
    return 'none';
  }

  if (getHeadNode(root) || root.classList.contains('flex-col')) {
    return 'top';
  }

  return 'inline-end';
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

  if (textPosition === 'top') {
    root.classList.add('flex-col');
    return;
  }

  if (textPosition === 'inline-end') {
    root.classList.add('flex-row', 'items-cross-center');
  }
}

// Indeterminate (C34): the size of the work is not known, so the bar has no
// value to say: aria-valuenow is left out (WAI-ARIA progressbar), and the
// value text, when the page gives one, says what is going on.
// A meter always has a value, so it is never indeterminate.
function isIndeterminate(root) {
  if (root.dataset.meter === 'true') return false;
  return root.classList.contains('sf-progress-bar--indeterminate') || root.dataset.indeterminate === 'true';
}

// Paused (C34): the work stands still, so an indeterminate segment stops.
function isPaused(root) {
  return root.classList.contains('sf-progress-bar--paused') || root.dataset.paused === 'true';
}

// Meter (owner decision C131 (7)): an amount within a known range (a quota
// used), not a task's progress: role meter. A meter always has a value.
function isMeter(root) {
  return root.dataset.meter === 'true';
}

function syncProgressAccessibility(root, value) {
  root.setAttribute('role', isMeter(root) ? 'meter' : 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  if (isIndeterminate(root)) root.removeAttribute('aria-valuenow');
  else root.setAttribute('aria-valuenow', String(value));

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

// One status class at most; no status has none.
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
  const indeterminate = isIndeterminate(root);
  root.classList.toggle('sf-progress-bar--indeterminate', indeterminate);
  root.classList.toggle('sf-progress-bar--paused', isPaused(root));
  syncProgressAccessibility(root, value);
  if (indeterminate) progress.style.removeProperty('width');
  else progress.style.width = `${value}%`;
  root.dataset.value = String(value);
  root.dataset.position = textPosition;

  // Top: one line over the bar, the name at the start and the value at the
  // end. The line is a picture of what the role already says (name and
  // value), so it is hidden from the accessibility tree.
  if (textPosition === 'top') {
    let head = getHeadNode(root);
    if (!head) {
      head = document.createElement('div');
      head.className = 'sf-progress-bar-head';
      root.insertBefore(head, main);
    }
    head.setAttribute('aria-hidden', 'true');
    let labelNode = head.querySelector('.sf-progress-bar-label');
    const label = root.dataset.label || '';
    if (label) {
      if (!labelNode) {
        labelNode = document.createElement('span');
        labelNode.className = 'sf-progress-bar-label';
        head.prepend(labelNode);
      }
      if (labelNode.textContent !== label) labelNode.textContent = label;
    } else if (labelNode) {
      labelNode.remove();
    }
    let textNode = head.querySelector('.sf-progress-bar-text');
    if (indeterminate) {
      textNode?.remove();
    } else {
      if (!textNode) {
        textNode = getTextNode(root) || document.createElement('span');
        textNode.className = 'sf-progress-bar-text';
        head.append(textNode);
      }
      if (textNode.textContent !== `${value}%`) textNode.textContent = `${value}%`;
    }
    root.querySelectorAll(':scope > .sf-progress-bar-text').forEach((node) => node.remove());
    return true;
  }

  getHeadNode(root)?.remove();

  if (textPosition === 'none' || indeterminate) {
    const textNode = getTextNode(root);
    if (textNode) {
      textNode.remove();
    }
    return true;
  }

  const textNode = ensureTextNode(root);
  if (textNode.textContent !== `${value}%`) textNode.textContent = `${value}%`;
  textNode.setAttribute('aria-hidden', 'true');

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

  if (Object.prototype.hasOwnProperty.call(state, 'indeterminate')) {
    if (state.indeterminate) root.dataset.indeterminate = 'true';
    else delete root.dataset.indeterminate;
    root.classList.toggle('sf-progress-bar--indeterminate', Boolean(state.indeterminate));
  }

  if (Object.prototype.hasOwnProperty.call(state, 'meter')) {
    if (state.meter) root.dataset.meter = 'true';
    else delete root.dataset.meter;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'paused')) {
    if (state.paused) root.dataset.paused = 'true';
    else delete root.dataset.paused;
    root.classList.toggle('sf-progress-bar--paused', Boolean(state.paused));
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
    indeterminate: isIndeterminate(root),
    paused: isPaused(root),
    meter: isMeter(root),
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
      tone = '',
      label = '',
      valueText = '',
      indeterminate = false,
      paused = false,
      meter = false,
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
    if (indeterminate) root.dataset.indeterminate = 'true';
    if (paused) root.dataset.paused = 'true';
    if (meter) root.dataset.meter = 'true';

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
