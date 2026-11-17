import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { noteDeprecated } from '../../../core/js/deprecations.js';
import { percentText } from '../../../core/js/format-number.js';
import { pageText } from '../../../core/js/page-language';
import { STATUS_RANK } from '../../progress-threshold';
// The words live in the component's language files, the Smart bar's words
// under the same name (sf-progress-bar), so a pack serves both.
import LANG_WORDS from '../lang/index.mjs';

const PAUSED_WORDS = { en: LANG_WORDS.en, ru: LANG_WORDS.ru };

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

// Writes a text into a node of the bar without taking out what a renderer
// keeps there. The Smart element draws the label and the value with Lit, which
// marks each text with a comment and writes later values into its own text
// node; textContent removed both, so the element's next drawing wrote into a
// removed node and failed («Cannot set properties of null (setting 'data')»,
// RG-R-53, three bars of sf-file-upload in the file-upload recipe). The text
// goes into the node's one text node; a node without one (class markup) takes
// textContent as before.
function writeText(node, text) {
  if (node.textContent === text) return;
  const texts = Array.from(node.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE);
  const kept = Array.from(node.childNodes).some((child) => child.nodeType === Node.COMMENT_NODE);
  if (kept && texts.length >= 1) {
    texts[0].data = text;
    texts.slice(1).forEach((child) => { child.data = ''; });
    return;
  }
  node.textContent = text;
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
  // The inline look is an inline box (its sheet: inline-flex), so it leaves
  // the block-level flex utility off.
  root.classList.add('sf-progress-bar');
  root.classList.toggle('flex', !isInline(root));
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

// A paused bar is at least a warning, as the Smart bar draws it (C34; examples
// pass EX-2): an error stays an error. The page's status stays in data-tone,
// so the bar takes it back when the work goes on.
function pausedTone(tone, paused) {
  return paused && (STATUS_RANK[tone] ?? 0) < STATUS_RANK.warning ? 'warning' : tone;
}

// What a screen reader hears for a paused bar, as the Smart bar says it:
// «35 %, на паузе», or «на паузе» while the size of the work is not known.
function pausedValueText(root, value) {
  if (isIndeterminate(root)) return pageText(PAUSED_WORDS, 'paused', root, 'sf-progress-bar');
  return pageText(PAUSED_WORDS, 'paused-value', root, 'sf-progress-bar').replace('{value}', String(Math.round(value * 100) / 100));
}

// Meter (owner decision C131 (7)): an amount within a known range (a quota
// used), not a task's progress: role meter. A meter always has a value.
function isMeter(root) {
  return root.dataset.meter === 'true';
}

// Inline (owner decision C203): the row-end look -- a track of its own width,
// the number before it and always shown. The text stands at inline-end in the
// markup; the sheet puts it before the track.
function isInline(root) {
  return root.dataset.inline === 'true';
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

  // What a screen reader hears: the page's value text, else the per cent the
  // bar shows, «72 %» (C203 (3)); nothing while the size is not known.
  const valueText = root.dataset.valueText
    || (isPaused(root) ? pausedValueText(root, value) : '')
    || (isIndeterminate(root) ? '' : percentText(value, root));
  if (valueText) {
    root.setAttribute('aria-valuetext', valueText);
  } else {
    root.removeAttribute('aria-valuetext');
  }
}

// One status class at most; no status has none. The class drawn is the
// paused bar's warning (pausedTone); data-tone keeps the page's status.
function syncTone(root, tone) {
  const drawn = pausedTone(tone, isPaused(root));
  ['primary', ...TONES].forEach((name) => {
    root.classList.toggle(`sf-progress-bar--${name}`, name === drawn);
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
  // An inline bar always shows its number (C203 (3)): at inline-end in the
  // markup, before the track on screen.
  const inline = isInline(root);
  const textPosition = inline ? 'inline-end' : normalizeTextPosition(
    root.dataset.position ?? root.dataset.textPosition ?? root.getAttribute('data-text-position'),
    detectTextPosition(root),
  );
  const tone = normalizeTone(root.dataset.tone);

  syncRootLayout(root, textPosition);
  syncTone(root, tone);
  root.classList.toggle('sf-progress-bar--inline', inline);
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
      writeText(labelNode, label);
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
      writeText(textNode, percentText(value, root));
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
  writeText(textNode, percentText(value, root));
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

  if (Object.prototype.hasOwnProperty.call(state, 'inline')) {
    if (state.inline) root.dataset.inline = 'true';
    else delete root.dataset.inline;
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
    inline: isInline(root),
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
      inline = false,
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
    if (inline) root.dataset.inline = 'true';

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
