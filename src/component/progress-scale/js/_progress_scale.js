import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

const PROGRESS_SCALE_SELECTOR = '.sf-progress-scale';
const BOUND_FLAG = 'sfProgressScaleBound';
const SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
// The shared status words. `primary` was the old word for no status: it has no
// colour of its own and draws the default, as before; `info` was turned into it.
const TONE_VALUES = ['info', 'success', 'warning', 'error'];

function normalizeProgressScaleValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeProgressScaleStep(value) {
  return Math.ceil(normalizeProgressScaleValue(value) / 10) * 10;
}

function normalizeProgressScaleSize(value) {
  const normalized = String(value || '').toLowerCase();
  return SIZE_VALUES.includes(normalized) ? normalized : '1';
}

function normalizeProgressScaleTone(value) {
  const normalized = String(value || '').toLowerCase();
  return TONE_VALUES.includes(normalized) ? normalized : '';
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

function ensureScaleStructure(root) {
  let container = root.querySelector('.sf-progress-scale-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'sf-progress-scale-container grid grid-col-10 overflow-hidden';
    root.prepend(container);
  }
  container.setAttribute('aria-hidden', 'true');

  const blocks = [...container.querySelectorAll('.sf-progress-scale-block')];
  for (let index = blocks.length; index < 10; index += 1) {
    const block = document.createElement('div');
    block.className = 'sf-progress-scale-block';
    container.append(block);
  }
  blocks.slice(10).forEach((block) => block.remove());
}

function ensureScaleText(root) {
  let text = root.querySelector('.sf-progress-scale-text, .sf-scale-text');
  if (!text) {
    text = document.createElement('div');
    root.append(text);
  }
  text.classList.add('sf-progress-scale-text');
  return text;
}

function syncScaleClasses(root, step, size, tone) {
  for (let current = 0; current <= 100; current += 10) {
    root.classList.toggle(`sf-progress-scale--${current}`, current === step);
  }
  SIZE_VALUES.forEach((current) => {
    root.classList.toggle(`sf-progress-scale--size-${current}`, current === size);
  });
  TONE_VALUES.forEach((current) => {
    root.classList.toggle(`sf-progress-scale--${current}`, current === tone);
  });
}

function renderProgressScale(root) {
  if (!root) return false;
  ensureScaleStructure(root);

  const value = normalizeProgressScaleValue(root.dataset.value);
  const step = normalizeProgressScaleStep(value);
  const size = normalizeProgressScaleSize(root.dataset.size);
  const tone = normalizeProgressScaleTone(root.dataset.tone);
  const showText = normalizeBoolean(root.dataset.showText, true);

  // A scale on a text line lays its track and value out in a row; any other
  // scale stands its value under the track.
  const onLine = /(^|\s)sf-progress-scale--line-/.test(root.className);
  root.classList.add('sf-progress-scale', 'flex', onLine ? 'flex-row' : 'flex-col');
  if (onLine) root.classList.remove('flex-col');
  syncScaleClasses(root, step, size, tone);
  root.dataset.value = String(value);
  root.dataset.size = size;
  root.dataset.tone = tone;
  root.dataset.showText = String(showText);
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', String(value));

  if (root.dataset.label) root.setAttribute('aria-label', root.dataset.label);
  if (root.dataset.valueText) root.setAttribute('aria-valuetext', root.dataset.valueText);
  else root.removeAttribute('aria-valuetext');

  const text = ensureScaleText(root);
  text.textContent = `${value}%`;
  text.hidden = !showText;
  return true;
}

function bindProgressScale(root) {
  if (!root || root.dataset[BOUND_FLAG] === '1') return;
  renderProgressScale(root);
  root.dataset[BOUND_FLAG] = '1';
}

function unbindProgressScale(root) {
  if (!root || root.dataset[BOUND_FLAG] !== '1') return;
  delete root.dataset[BOUND_FLAG];
}

function initExistingProgressScales(target = document) {
  target.querySelectorAll(PROGRESS_SCALE_SELECTOR).forEach(bindProgressScale);
}

function setProgressScaleState(target, state = {}) {
  const root = target instanceof HTMLElement
    ? target.closest(PROGRESS_SCALE_SELECTOR) || target
    : null;
  if (!root) return false;

  if (Object.prototype.hasOwnProperty.call(state, 'value')) {
    root.dataset.value = String(normalizeProgressScaleValue(state.value));
  }
  if (Object.prototype.hasOwnProperty.call(state, 'size')) {
    root.dataset.size = normalizeProgressScaleSize(state.size);
  }
  // A progress indicator's colour role is its status (journal record
  // attribute-tone-to-status); tone is still read until that record leaves.
  if (Object.prototype.hasOwnProperty.call(state, 'status') || Object.prototype.hasOwnProperty.call(state, 'tone')) {
    root.dataset.tone = normalizeProgressScaleTone(state.status ?? state.tone);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'showText')) {
    root.dataset.showText = String(normalizeBoolean(state.showText, true));
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

  return renderProgressScale(root);
}

function getProgressScaleState(target) {
  const root = target instanceof HTMLElement
    ? target.closest(PROGRESS_SCALE_SELECTOR) || target
    : null;
  if (!root) return null;
  return {
    value: normalizeProgressScaleValue(root.dataset.value),
    size: normalizeProgressScaleSize(root.dataset.size),
    status: normalizeProgressScaleTone(root.dataset.tone),
    tone: normalizeProgressScaleTone(root.dataset.tone),
    showText: normalizeBoolean(root.dataset.showText, true),
    label: root.getAttribute('aria-label') || '',
    valueText: root.getAttribute('aria-valuetext') || '',
  };
}

class ProgressScale extends ComponentObserver {
  static componentName = 'ProgressScale';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1', value = 0, status, tone = 'primary', showText = true,
      label = '', valueText = '',
    } = this.params || {};
    const root = document.createElement('div');
    root.className = 'sf-progress-scale flex flex-col';
    root.dataset.size = normalizeProgressScaleSize(size);
    root.dataset.value = String(normalizeProgressScaleValue(value));
    root.dataset.tone = normalizeProgressScaleTone(status ?? tone);
    root.dataset.showText = String(normalizeBoolean(showText, true));
    if (String(label).trim()) root.dataset.label = String(label).trim();
    if (String(valueText).trim()) root.dataset.valueText = String(valueText).trim();
    this.template = root;
  }

  init() { bindProgressScale(this.template); }
  destroyInternal() { unbindProgressScale(this.template); }
}

registerComponent('ProgressScale', ProgressScale);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.ProgressScale = window.SF.ProgressScale || {};
  window.SF.ProgressScale.getState = getProgressScaleState;
  window.SF.ProgressScale.setState = setProgressScaleState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingProgressScales(), { once: true });
} else {
  initExistingProgressScales();
}

const progressScaleObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(PROGRESS_SCALE_SELECTOR)) bindProgressScale(node);
      initExistingProgressScales(node);
    });
  });
});

progressScaleObserver.observe(document.documentElement, { childList: true, subtree: true });

export {
  bindProgressScale,
  unbindProgressScale,
  initExistingProgressScales,
  setProgressScaleState,
  getProgressScaleState,
  normalizeProgressScaleValue,
  normalizeProgressScaleStep,
};
