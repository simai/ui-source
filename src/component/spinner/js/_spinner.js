import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
import { noteDeprecated } from '../../../core/js/deprecations.js';
import {
  SPINNER_DOTS,
  SPINNER_DOTS_FILLED,
  SPINNER_LOOKS,
  createLadderSpinnerSvg,
  createSpinnerSvg,
  createSvgNode,
} from './_spinner-draw';

const SPINNER_TEXT = { en: { label: 'Loading…' }, ru: { label: 'Загрузка…' } };

const SPINNER_SELECTOR = '.sf-loader-container';
const SPINNER_BOUND_FLAG = 'sfSpinnerBound';

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

// The size ladder decides a spinner's diameter and stroke (simai/ui-source#10).
// The pixel attributes that let a page draw its own spinner -- data-width (and
// its short data-w), data-height (data-h), data-stroke-width and
// data-dot-radius, and the sf-spinner attributes that write them -- are still
// read until the sweep of journal attribute-spinner-pixel-geometry, and noted
// in SF.deprecations whenever a spinner is drawn with them.
const PIXEL_ATTRIBUTES = [
  ['width', 'data-width', 'width'],
  ['w', 'data-w', 'width'],
  ['height', 'data-height', 'height'],
  ['h', 'data-h', 'height'],
  ['strokeWidth', 'data-stroke-width', 'stroke-width'],
  ['dotRadius', 'data-dot-radius', 'dot-radius'],
];

function notePixelAttributes(root) {
  const smart = root.closest?.('sf-spinner');
  const written = PIXEL_ATTRIBUTES.filter(([key]) => {
    const value = root.dataset[key];
    return value !== undefined && value !== '';
  });
  written.forEach(([, attribute, smartAttribute]) => {
    noteDeprecated({
      component: smart ? 'sf-spinner' : 'spinner',
      kind: 'attribute',
      from: smart ? smartAttribute : attribute,
      // sf-spinner takes size; the ordinary spinner a sf-loader--size-* class.
      to: smart ? 'size' : null,
    });
  });
  return written.length > 0;
}

// Without pixel options the spinner is drawn on the icon grid, its size and
// stroke set by the ladder; with any of them it is drawn as before, in pixels.
// Either way the drawing holds every look (simai/ui-source#11), and the sheet
// shows the page's.
function createSpinnerArcSvg(options = {}) {
  const pixel = ['width', 'height', 'strokeWidth'].some((key) => {
    const value = options?.[key];
    return value !== undefined && value !== null && value !== '';
  });
  return pixel ? createPixelSpinnerSvg(options) : createLadderSpinnerSvg(options);
}

function createPixelSpinnerSvg({
  width = 58,
  height = 58,
  strokeWidth = 4,
  dots = SPINNER_DOTS,
  filled = SPINNER_DOTS_FILLED,
  dotRadius = null,
  direction = 'clockwise',
} = {}) {
  const safeWidth = clamp(toNumber(width, 58), 16, 256);
  const safeHeight = clamp(toNumber(height, safeWidth), 16, 256);
  const safeStroke = clamp(
    toNumber(strokeWidth, 4),
    1,
    Math.min(safeWidth, safeHeight) / 2,
  );
  return createSpinnerSvg({
    width: safeWidth,
    height: safeHeight,
    stroke: safeStroke,
    dots,
    filled,
    dotRadius,
    direction,
    pixel: true,
  });
}

function createSpinnerDotsSvg({
  width = 58,
  height = 58,
  dots = 16,
  filled = 6,
  dotRadius = null,
  direction = 'clockwise',
} = {}) {
  const safeWidth = clamp(toNumber(width, 58), 16, 256);
  const safeHeight = clamp(toNumber(height, safeWidth), 16, 256);
  const count = clamp(Math.floor(toNumber(dots, 16)), 3, 32);
  const activeDots = clamp(Math.floor(toNumber(filled, 6)), 1, count);
  const resolvedDotRadius =
    dotRadius === null
      ? Math.max(1.5, Math.min(safeWidth, safeHeight) * 0.06)
      : clamp(toNumber(dotRadius, 1), 1, Math.min(safeWidth, safeHeight) / 4);
  const orbitRadius = Math.max(
    resolvedDotRadius,
    Math.min(safeWidth, safeHeight) / 2 - resolvedDotRadius - 1,
  );
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;

  const svg = createSvgNode('svg', {
    class: 'sf-loader-svg',
    viewBox: `0 0 ${safeWidth} ${safeHeight}`,
    width: safeWidth,
    height: safeHeight,
    'aria-hidden': 'true',
    style: `--sf-loader-dot-count:${count}; --sf-loader-dot-filled:${activeDots};`,
  });

  for (let index = 0; index < count; index += 1) {
    const angle = ((Math.PI * 2) / count) * index - Math.PI / 2;
    const dotCx = cx + orbitRadius * Math.cos(angle);
    const dotCy = cy + orbitRadius * Math.sin(angle);
    const animationIndex =
      direction === 'counterclockwise' ? index : (count - index) % count;
    const dot = createSvgNode('circle', {
      class: `sf-loader-dot${index < activeDots ? ' sf-loader-dot--active' : ''}`,
      cx: dotCx,
      cy: dotCy,
      r: resolvedDotRadius,
      style: `--sf-loader-dot-index:${index}; --sf-loader-dot-step:${animationIndex};`,
    });

    svg.append(dot);
  }

  return svg;
}

function getSpinnerConfig(root) {
  const indicator = root.querySelector('.sf-loader--loading-indicator');
  const circles = root.querySelector('.sf-loader--circles');
  const labelNode = root.querySelector('.sf-loader--text');
  const hasExplicitWidth =
    Object.prototype.hasOwnProperty.call(root.dataset, 'width') ||
    Object.prototype.hasOwnProperty.call(root.dataset, 'w');
  const hasExplicitHeight =
    Object.prototype.hasOwnProperty.call(root.dataset, 'height') ||
    Object.prototype.hasOwnProperty.call(root.dataset, 'h');
  const pixel = notePixelAttributes(root);

  const width = clamp(
    toNumber(root.dataset.width, toNumber(root.dataset.w, 58)),
    16,
    256,
  );
  const height = clamp(
    toNumber(root.dataset.height, toNumber(root.dataset.h, width)),
    16,
    256,
  );
  const strokeWidth = root.dataset.strokeWidth
    ? clamp(
        toNumber(root.dataset.strokeWidth, 4),
        1,
        Math.min(width, height) / 2,
      )
    : null;
  // The dots look on the ladder (simai/ui-source#11): eight dots, three of them
  // lit, as big as the ring allows; data-dots and data-filled still choose.
  const dots = clamp(Math.floor(toNumber(root.dataset.dots, SPINNER_DOTS)), 3, 32);
  const filled = clamp(Math.floor(toNumber(root.dataset.filled, SPINNER_DOTS_FILLED)), 1, dots);
  const dotRadius = root.dataset.dotRadius
    ? clamp(
        toNumber(root.dataset.dotRadius, 1),
        1,
        Math.min(width, height) / 4,
      )
    : null;
  const direction = normalizeChoice(
    root.dataset.direction,
    ['clockwise', 'counterclockwise'],
    'clockwise',
  );
  // The look is the page's (data-sf-spinner on an ancestor) unless the spinner
  // names its own in data-variant; the sheet resolves both. Markup that brought
  // its own .sf-loader--circles part and no variant was a dots spinner, and
  // says so now that every look is drawn in the one indicator.
  const variant = root.dataset.variant
    ? normalizeChoice(root.dataset.variant, SPINNER_LOOKS, 'arc')
    : circles ? 'dots' : '';

  return {
    pixel,
    width,
    height,
    strokeWidth,
    dots,
    filled,
    dotRadius,
    direction,
    variant,
    hasExplicitWidth,
    hasExplicitHeight,
    infinite: root.dataset.infinite === 'true',
    announce: root.dataset.announce === 'true',
    label:
      root.dataset.label !== undefined
        ? root.dataset.label
        : labelNode?.textContent?.trim?.() || '',
    indicator,
    circles,
    labelNode,
  };
}

function syncSpinnerAccessibility(root, config) {
  const hasLabel = Boolean(config.label);
  root.toggleAttribute('aria-hidden', !hasLabel);

  if (config.announce && hasLabel) {
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    root.dataset.sfSpinnerSemantics = 'status';
    return;
  }

  if (root.dataset.sfSpinnerSemantics === 'status') {
    root.removeAttribute('role');
    root.removeAttribute('aria-live');
    root.removeAttribute('aria-atomic');
    delete root.dataset.sfSpinnerSemantics;
  }
}

function ensureSpinnerPart(root, selector, className) {
  let node = root.querySelector(selector);
  if (node) {
    node.innerHTML = '';
    return node;
  }

  node = document.createElement('div');
  node.className = className;
  node.dataset.sfSpinnerPart = className;
  root.append(node);
  return node;
}

function renderSpinner(root) {
  if (!(root instanceof HTMLElement)) return root;

  const config = getSpinnerConfig(root);
  root.classList.add('sf-loader-container');
  if (config.infinite) {
    root.classList.add('sf-loader--infinite');
  } else {
    root.classList.remove('sf-loader--infinite');
  }
  if (config.pixel && config.hasExplicitWidth) {
    root.style.setProperty('--sf-loader-svg-width', `${config.width}px`);
  } else {
    root.style.removeProperty('--sf-loader-svg-width');
  }

  if (config.pixel && (config.hasExplicitHeight || config.hasExplicitWidth)) {
    root.style.setProperty('--sf-loader-svg-height', `${config.height}px`);
  } else {
    root.style.removeProperty('--sf-loader-svg-height');
  }
  if (config.strokeWidth !== null) {
    root.style.setProperty('--sf-loader-stroke-width', `${config.strokeWidth}px`);
  } else {
    root.style.removeProperty('--sf-loader-stroke-width');
  }
  // A spinner drawn in pixels keeps the pixel strokes it had; one on the ladder
  // strokes on the icon grid.
  root.classList.toggle('sf-loader--pixel-geometry', config.pixel);

  if (config.variant && root.dataset.variant !== config.variant) {
    root.dataset.variant = config.variant;
  }
  // A .sf-loader--circles part written into the markup gives its place to the
  // indicator, which draws every look.
  const circles = root.querySelector('.sf-loader--circles');
  if (circles && !root.querySelector('.sf-loader--loading-indicator')) {
    const indicator = document.createElement('div');
    indicator.className = 'sf-loader--loading-indicator';
    indicator.dataset.sfSpinnerPart = 'sf-loader--loading-indicator';
    circles.replaceWith(indicator);
  }
  const visual = ensureSpinnerPart(root, '.sf-loader--loading-indicator', 'sf-loader--loading-indicator');
  const label =
    config.label || config.labelNode
      ? ensureSpinnerPart(root, '.sf-loader--text', 'sf-loader--text')
      : null;

  const svg = config.pixel
    ? createPixelSpinnerSvg({...config, strokeWidth: config.strokeWidth ?? 4})
    : createLadderSpinnerSvg(config);

  visual.append(svg);

  if (label) {
    label.textContent = config.label || '';
  }

  syncSpinnerAccessibility(root, config);

  return root;
}

function bindSpinner(root) {
  if (
    !(root instanceof HTMLElement) ||
    root.dataset[SPINNER_BOUND_FLAG] === '1'
  ) {
    return root;
  }

  renderSpinner(root);
  root.dataset[SPINNER_BOUND_FLAG] = '1';
  return root;
}

function unbindSpinner(root) {
  if (!(root instanceof HTMLElement)) return;
  delete root.dataset[SPINNER_BOUND_FLAG];
}

function initSpinnerTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(SPINNER_SELECTOR)) {
    bindSpinner(target);
  }

  target.querySelectorAll?.(SPINNER_SELECTOR).forEach(bindSpinner);
}

class Spinner extends ComponentObserver {
  static componentName = 'Spinner';

  constructor(props) {
    super(props);

    const {
      // No size unless one is asked for: a written 58 counted as explicit and
      // overrode every size class.
      width,
      height,
      label = pageText(SPINNER_TEXT, 'label', props?.root ?? document.documentElement),
      // No look unless one is asked for: the page's (data-sf-spinner) applies.
      variant,
      dots = SPINNER_DOTS,
      filled = SPINNER_DOTS_FILLED,
      strokeWidth = null,
      dotRadius = null,
      infinite = false,
      announce = false,
      direction = 'clockwise',
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;

    this.template = document.createElement('div');
    if (this.id) {
      this.template.id = this.id;
    }
    this.template.classList.add('sf-loader-container');

    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    Object.entries(this.attrs)
      .filter(([attr]) => !['class', 'className'].includes(attr))
      .forEach(([attr, value]) => {
        if (value === undefined || value === null) return;
        this.template.setAttribute(attr, value);
      });

    if (width !== undefined && width !== null && width !== '') this.template.dataset.width = String(width);
    if (height !== undefined && height !== null && height !== '') this.template.dataset.height = String(height);
    this.template.dataset.label = String(label ?? '');
    if (variant !== undefined && variant !== null && variant !== '') {
      this.template.dataset.variant = String(variant);
    }
    this.template.dataset.dots = String(dots);
    this.template.dataset.filled = String(filled);
    if (strokeWidth !== null && strokeWidth !== undefined && strokeWidth !== '') {
      this.template.dataset.strokeWidth = String(strokeWidth);
    }
    this.template.dataset.infinite = String(infinite);
    this.template.dataset.announce = String(announce);
    this.template.dataset.direction = String(direction);
    if (dotRadius !== null && dotRadius !== undefined) {
      this.template.dataset.dotRadius = String(dotRadius);
    }
  }

  init() {
    bindSpinner(this.template);
  }

  destroyInternal() {
    unbindSpinner(this.template);
  }
}

registerComponent('Spinner', Spinner);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Spinner = window.SF.Spinner || {};
  window.SF.Spinner.bind = bindSpinner;
  window.SF.Spinner.render = renderSpinner;
  window.SF.Spinner.unbind = unbindSpinner;
  window.SF.Spinner.createArcSvg = createSpinnerArcSvg;
  window.SF.Spinner.createDotsSvg = createSpinnerDotsSvg;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () =>
    initSpinnerTree(document),
  );
} else {
  initSpinnerTree(document);
}

const spinnerObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initSpinnerTree(node);
    });
  });
});

spinnerObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindSpinner,
  createSpinnerArcSvg,
  createSpinnerDotsSvg,
  renderSpinner,
  unbindSpinner,
};
