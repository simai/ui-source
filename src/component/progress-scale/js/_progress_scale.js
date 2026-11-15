import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { effectiveStatus, readThreshold } from '../../progress-threshold';

const PROGRESS_SCALE_SELECTOR = '.sf-progress-scale';
const BOUND_FLAG = 'sfProgressScaleBound';
const SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
// The shared status words (owner decision C131 (1)): no status draws the
// theme's primary and carries no class; neutral is grey, as in sf-dot and
// sf-badge. `primary` is the former word for no status.
const TONE_VALUES = ['neutral', 'info', 'success', 'warning', 'error'];

function normalizeProgressScaleValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

// The blocks never show more than is done (PG-12): 61 % lights 6 of 10, not 7;
// a block lights only once its tenth is reached. The epsilon keeps a value
// that is a whole tenth in decimal (70) from falling a block short in binary.
function normalizeProgressScaleStep(value) {
  return Math.floor(normalizeProgressScaleValue(value) / 10 + 1e-9) * 10;
}

// A level of N (owner decision C185 (5)): the scale draws 2 to 10 steps, 10
// when none is given. A scale given its steps is a level -- «4 из 5», a
// password's strength -- and says so at the end of its row.
const STEPS_DEFAULT = 10;

function normalizeProgressScaleSteps(value) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return STEPS_DEFAULT;
  return Math.max(2, Math.min(10, parsed));
}

// The steps a value lights, rounded down as the tenths are (PG-12): 79 % of
// 5 steps lights 3, not 4.
function progressScaleLit(value, steps) {
  return Math.floor((normalizeProgressScaleValue(value) / 100) * steps + 1e-9);
}

// «4 из 5» in the page's language: the scale's own words, as the Smart
// element's (lang/*.json «of-steps»).
function levelWords(lit, steps) {
  const lang = String(globalThis.document?.documentElement?.lang || '').toLowerCase();
  return lang.startsWith('ru') ? `${lit} из ${steps}` : `${lit} of ${steps}`;
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

function ensureScaleStructure(root, steps = STEPS_DEFAULT) {
  let container = root.querySelector('.sf-progress-scale-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'sf-progress-scale-container grid overflow-hidden';
    root.prepend(container);
  }
  container.setAttribute('aria-hidden', 'true');
  // Ten steps keep the grid utility they always had; any other count lays
  // its blocks out by the component's own columns (one per block).
  container.classList.toggle('grid-col-10', steps === STEPS_DEFAULT);

  const blocks = [...container.querySelectorAll('.sf-progress-scale-block')];
  for (let index = blocks.length; index < steps; index += 1) {
    const block = document.createElement('div');
    block.className = 'sf-progress-scale-block';
    container.append(block);
  }
  blocks.slice(steps).forEach((block) => block.remove());
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
  // A level scale is one given its steps (C185 (5)).
  const level = root.dataset.steps !== undefined && root.dataset.steps !== '';
  const steps = level ? normalizeProgressScaleSteps(root.dataset.steps) : STEPS_DEFAULT;
  ensureScaleStructure(root, steps);

  const value = normalizeProgressScaleValue(root.dataset.value);
  const lit = progressScaleLit(value, steps);
  // The class lights the first n blocks (sf-progress-scale--<n*10>).
  const step = lit * 10;
  const size = normalizeProgressScaleSize(root.dataset.size);
  const tone = normalizeProgressScaleTone(root.dataset.tone);
  // The thresholds (C131 (7)), as sf-progress-scale's warning-at and
  // error-at: from data-warning-at on the scale is a warning by itself, from
  // data-error-at an error; the more serious of that and data-tone is drawn.
  // The page's tone stays in data-tone, so a value that falls back below the
  // threshold draws it again.
  const drawn = normalizeProgressScaleTone(
    effectiveStatus(tone, value, readThreshold(root.dataset.warningAt), readThreshold(root.dataset.errorAt)),
  );
  const showText = normalizeBoolean(root.dataset.showText, true);

  // A scale on a text line, and a level scale, lay their track and value out
  // in a row, the value at the row's end (C185 (5)); any other scale stands
  // its value under the track.
  const onRow = level || /(^|\s)sf-progress-scale--line-/.test(root.className);
  root.classList.add('sf-progress-scale', 'flex', onRow ? 'flex-row' : 'flex-col');
  root.classList.remove(onRow ? 'flex-col' : 'flex-row');
  root.classList.toggle('sf-progress-scale--level', level);
  syncScaleClasses(root, step, size, drawn);
  root.dataset.value = String(value);
  root.dataset.size = size;
  root.dataset.tone = tone;
  root.dataset.showText = String(showText);
  // Meter (C131 (7)): an amount within a known range, not a task's progress.
  root.setAttribute('role', root.dataset.meter === 'true' ? 'meter' : 'progressbar');
  // A level is read in its steps: «4 из 5», or the page's level word.
  const words = level ? levelWords(lit, steps) : '';
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', level ? String(steps) : '100');
  root.setAttribute('aria-valuenow', level ? String(lit) : String(value));

  if (root.dataset.label) root.setAttribute('aria-label', root.dataset.label);
  if (root.dataset.valueText || words) root.setAttribute('aria-valuetext', root.dataset.valueText || words);
  else root.removeAttribute('aria-valuetext');

  const text = ensureScaleText(root);
  text.textContent = level ? (root.dataset.valueText || words) : `${value}%`;
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
  // The thresholds in per cent; null or an empty value takes one away.
  [['warningAt', 'warningAt'], ['errorAt', 'errorAt']].forEach(([key, data]) => {
    if (!Object.prototype.hasOwnProperty.call(state, key)) return;
    const threshold = readThreshold(state[key]);
    if (threshold === null) delete root.dataset[data];
    else root.dataset[data] = String(threshold);
  });
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
  if (Object.prototype.hasOwnProperty.call(state, 'meter')) {
    if (state.meter) root.dataset.meter = 'true';
    else delete root.dataset.meter;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'steps')) {
    if (state.steps === null || state.steps === undefined || state.steps === '') delete root.dataset.steps;
    else root.dataset.steps = String(normalizeProgressScaleSteps(state.steps));
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
    // The status drawn: the tone, or the threshold the value reached.
    drawnStatus: normalizeProgressScaleTone(effectiveStatus(
      normalizeProgressScaleTone(root.dataset.tone),
      normalizeProgressScaleValue(root.dataset.value),
      readThreshold(root.dataset.warningAt),
      readThreshold(root.dataset.errorAt),
    )),
    warningAt: readThreshold(root.dataset.warningAt),
    errorAt: readThreshold(root.dataset.errorAt),
    showText: normalizeBoolean(root.dataset.showText, true),
    label: root.getAttribute('aria-label') || '',
    valueText: root.getAttribute('aria-valuetext') || '',
    meter: root.dataset.meter === 'true',
    steps: root.dataset.steps ? normalizeProgressScaleSteps(root.dataset.steps) : null,
  };
}

class ProgressScale extends ComponentObserver {
  static componentName = 'ProgressScale';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1', value = 0, status, tone = '', showText = true,
      label = '', valueText = '', meter = false, steps = null,
      warningAt = null, errorAt = null,
    } = this.params || {};
    const root = document.createElement('div');
    root.className = 'sf-progress-scale flex flex-col';
    root.dataset.size = normalizeProgressScaleSize(size);
    root.dataset.value = String(normalizeProgressScaleValue(value));
    root.dataset.tone = normalizeProgressScaleTone(status ?? tone);
    root.dataset.showText = String(normalizeBoolean(showText, true));
    if (String(label).trim()) root.dataset.label = String(label).trim();
    if (String(valueText).trim()) root.dataset.valueText = String(valueText).trim();
    if (meter) root.dataset.meter = 'true';
    if (steps !== null && steps !== undefined && steps !== '') root.dataset.steps = String(normalizeProgressScaleSteps(steps));
    if (readThreshold(warningAt) !== null) root.dataset.warningAt = String(readThreshold(warningAt));
    if (readThreshold(errorAt) !== null) root.dataset.errorAt = String(readThreshold(errorAt));
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
  normalizeProgressScaleSteps,
  progressScaleLit,
};
