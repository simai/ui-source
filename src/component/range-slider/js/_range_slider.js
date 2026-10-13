import { createNativeSlider } from './native-slider';

const RANGE_SLIDER_SELECTOR = '.sf-range-slider';
const RANGE_SLIDER_BOUND_FLAG = 'sfRangeSliderBound';
// Instance-owned state is shared by separately bundled Component/Smart code.
const SLIDER_ACCESSIBILITY_STATE = '__sfRangeSliderAccessibility';
const SLIDER_LABEL_STATE = '__sfRangeSliderLabels';
const accessibleAttributes = ['aria-label', 'aria-labelledby', 'aria-describedby'];
const handleLabelAttributes = ['data-lower-label', 'data-upper-label'];

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'disabled'].includes(
    String(value).toLowerCase(),
  );
}

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNormalizedRange(root) {
  let min = toNumber(root.getAttribute('data-min'), 0);
  let max = toNumber(root.getAttribute('data-max'), 100);

  if (min > max) {
    [min, max] = [max, min];
  }

  if (!(max > min) || !Number.isFinite(max - min)) {
    return {min: 0, max: 100};
  }

  return {min, max};
}

function clampValue(value, min, max, fallback) {
  const numeric = toNumber(value, fallback);
  return Math.min(max, Math.max(min, numeric));
}

function getConnect(root, multiple) {
  const fallback = multiple ? true : 'lower';
  if (!root.hasAttribute('data-connect')) return fallback;

  const value = String(root.getAttribute('data-connect') ?? '')
    .trim()
    .toLowerCase();

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'lower' || value === 'upper') return value;
  return fallback;
}

function getDecimalPlaces(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || !Number.isFinite(Number(normalized))) return 0;
  const [coefficient, exponent = '0'] = normalized.split('e');
  const fraction = coefficient.split('.')[1]?.replace(/0+$/, '').length || 0;
  return Math.min(100, Math.max(0, fraction - Number(exponent)));
}

function getValueDecimals(root) {
  const decimalsAttr = root.getAttribute('data-decimals');
  if (decimalsAttr !== null && decimalsAttr !== '') {
    return Math.min(100, Math.max(0, Math.trunc(toNumber(decimalsAttr, 0))));
  }

  return getDecimalPlaces(root.getAttribute('data-step'));
}

function isMultipleRoot(root) {
  return toBoolean(root.getAttribute('data-multiple'), false);
}

function parseStart(root) {
  const raw =
    root.getAttribute('data-start') || root.getAttribute('data-value') || '0';
  const parts = String(raw).split(',');
  const {min, max} = getNormalizedRange(root);

  if (parts.length > 1 && isMultipleRoot(root)) {
    return [
      clampValue(parts[0].trim(), min, max, min),
      clampValue(parts[1].trim(), min, max, max),
    ].sort((a, b) => a - b);
  }

  return [clampValue(parts[0].trim(), min, max, min)];
}

function getHandleLabelMode(root) {
  const mode = String(root.getAttribute('data-label') || 'none').toLowerCase();
  return ['none', 'text', 'tooltip'].includes(mode) ? mode : 'none';
}

function getHandleLabelPosition(root, mode = 'none') {
  const specificAttribute =
    mode === 'tooltip' ? 'data-tooltip-position' : 'data-text-position';
  const raw =
    root.getAttribute(specificAttribute) ||
    root.getAttribute('data-label-position') ||
    '';
  const normalized = String(raw).toLowerCase();

  if (['top', 'bottom'].includes(normalized)) {
    return normalized;
  }

  return mode === 'text' ? 'bottom' : 'top';
}

function formatValue(root, value) {
  const decimals = getValueDecimals(root);
  const prefix = root.getAttribute('data-prefix') || '';
  const suffix = root.getAttribute('data-suffix') || '';
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return `${prefix}${value ?? ''}${suffix}`;
  }

  const baseValue = numeric.toFixed(decimals);

  return `${prefix}${baseValue}${suffix}`;
}

function createVisualNode(mode = 'none', position = 'top') {
  const visual = document.createElement('div');
  visual.classList.add(
    'sf-range-slider-visual',
    'flex',
    'flex-col',
    `sf-thumb--position-${position}`,
  );

  if (mode === 'tooltip') {
    visual.classList.add('sf-thumb--label-tooltip', 'items-cross-center');

    const tooltip = document.createElement('div');
    tooltip.className =
      'sf-tooltip sf-tooltip--light sf-tooltip--arrow-none sf-tooltip--size-1/3 relative';

    const tooltipContent = document.createElement('div');
    tooltipContent.className = 'sf-tooltip-content flex flex-col';

    const tooltipText = document.createElement('div');
    tooltipText.className = 'sf-tooltip-text';

    const tooltipTail = document.createElement('div');
    tooltipTail.className = 'sf-tooltip-tail';

    tooltipContent.append(tooltipText);
    tooltip.append(tooltipContent, tooltipTail);
    visual.append(tooltip);
  }

  const handleRow = document.createElement('div');
  handleRow.className = 'flex';

  const handle = document.createElement('span');
  handle.className =
    'sf-thumb-handle flex items-cross-center content-main-center';

  const inner = document.createElement('div');
  inner.className = 'sf-thumb-inner';
  handle.append(inner);
  handleRow.append(handle);
  visual.append(handleRow);

  if (mode === 'text') {
    visual.classList.add('sf-thumb--label-text');
    const text = document.createElement('span');
    text.className = 'sf-thumb-text';
    visual.append(text);
  }

  return visual;
}

function ensureTrack(base) {
  if (!(base instanceof HTMLElement)) return;

  let track = base.querySelector(':scope > .sf-range-slider-track');
  if (track) return track;

  track = document.createElement('div');
  track.className = 'sf-range-slider-track';
  base.prepend(track);
  return track;
}

function getHandles(root) {
  return Array.from(root.querySelectorAll('.sf-range-slider-handle'));
}

function bindSliderAccessibility(root, owner = root) {
  const state = root[SLIDER_ACCESSIBILITY_STATE] || { assigned: new WeakMap() };
  state.observer?.disconnect();
  const handles = getHandles(root);
  const sync = () => getHandles(root).forEach((handle, index) => {
    const previous = state.assigned.get(handle) || {};
    Object.entries(previous).forEach(([name, value]) => {
      if (handle.getAttribute(name) === value) handle.removeAttribute(name);
    });
    const explicitName = handle.hasAttribute('aria-label') || handle.hasAttribute('aria-labelledby');
    const next = {};
    const specificName = handles.length > 1
      ? root.getAttribute(handleLabelAttributes[index]) ||
        owner.getAttribute(index === 0 ? 'lower-label' : 'upper-label')
      : null;
    if (!explicitName && specificName) {
      handle.setAttribute('aria-label', specificName);
      next['aria-label'] = specificName;
    }
    accessibleAttributes.forEach((name) => {
      if (
        handle.hasAttribute(name) ||
        ((explicitName || specificName) && name !== 'aria-describedby')
      ) return;
      const value = owner.getAttribute(name);
      if (value !== null) {
        handle.setAttribute(name, value);
        next[name] = value;
      }
    });
    if (isDisabledRoot(root)) {
      handle.setAttribute('aria-disabled', 'true');
      next['aria-disabled'] = 'true';
    }
    state.assigned.set(handle, next);
  });
  sync();
  state.observer = new MutationObserver(sync);
  const ownerFilter = owner === root
    ? [...accessibleAttributes, ...handleLabelAttributes]
    : [...accessibleAttributes, 'lower-label', 'upper-label'];
  if (owner === root) {
    state.observer.observe(root, {
      attributes: true,
      attributeFilter: [...ownerFilter, 'disabled', 'class'],
    });
  } else {
    state.observer.observe(owner, { attributes: true, attributeFilter: ownerFilter });
    state.observer.observe(root, {
      attributes: true,
      attributeFilter: [...handleLabelAttributes, 'disabled', 'class'],
    });
  }
  root[SLIDER_ACCESSIBILITY_STATE] = state;
}

function decorateHandles(root) {
  const mode = getHandleLabelMode(root);
  const position = getHandleLabelPosition(root, mode);
  getHandles(root).forEach((handle) => {
    if (!(handle instanceof HTMLElement)) return;

    const touchArea = handle.querySelector(':scope > .sf-range-slider-touch-area');
    if (!(touchArea instanceof HTMLElement)) return;
    touchArea.classList.add('sf-thumb');
    let visual = touchArea.querySelector(':scope > .sf-range-slider-visual');
    if (!visual) {
      // noUiSlider owns the focusable slider handle; its touch area is decoration.
      visual = createVisualNode(mode, position);
      touchArea.append(visual);
    }

    visual.classList.remove('sf-thumb--position-top', 'sf-thumb--position-bottom');
    visual.classList.add(`sf-thumb--position-${position}`);
    handle.classList.toggle('disabled', isDisabledRoot(root));
  });
}

function planLabelPositions(width, centers, sizes, gap = 0) {
  const positions = centers.map((center, index) =>
    Math.max(0, Math.min(width - sizes[index], center - sizes[index] / 2)));
  const order = positions.map((left, index) => ({left, index})).sort((a, b) => a.left - b.left);
  const merged = order.length === 2 &&
    order[0].left + sizes[order[0].index] + gap > order[1].left;
  return {positions, merged};
}

function bindHandleLabels(root) {
  const mode = getHandleLabelMode(root);
  if (mode === 'none') return;
  const position = getHandleLabelPosition(root, mode);
  const base = root.querySelector('.sf-range-slider-base');
  const row = document.createElement('div');
  row.className = `sf-range-slider-labels sf-thumb sf-thumb--label-${mode} sf-range-slider-labels--${position}`;
  // Each handle exposes its exact value and units through ARIA already.
  row.setAttribute('aria-hidden', 'true');
  const entries = getHandles(root).map((handle) => {
    const label = handle.querySelector(mode === 'tooltip' ? '.sf-tooltip' : '.sf-thumb-text');
    const text = mode === 'tooltip' ? label.querySelector('.sf-tooltip-text') : label;
    row.append(label);
    return {handle, label, text};
  });
  if (position === 'top') root.insertBefore(row, base);
  else root.append(row);
  const state = {entries, row, values: [], frame: null, active: true};
  const layout = () => {
    if (!state.active || !root.isConnected || !state.values.length) return;
    const bounds = row.getBoundingClientRect();
    if (!bounds.width) return;
    entries.forEach(({label, text}, index) => {
      label.style.display = '';
      text.textContent = state.values[index];
    });
    const centers = entries.map(({handle}) => {
      const rect = handle.getBoundingClientRect();
      return rect.left + rect.width / 2 - bounds.left;
    });
    const sizes = entries.map(({label}) => label.getBoundingClientRect().width);
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
    const plan = planLabelPositions(bounds.width, centers, sizes, gap);
    if (plan.merged) {
      entries[0].text.textContent = state.values.join(' – ');
      entries[1].label.style.display = 'none';
      const size = entries[0].label.getBoundingClientRect().width;
      entries[0].label.style.left = `${Math.max(0, Math.min(bounds.width - size, (centers[0] + centers[1] - size) / 2))}px`;
    } else {
      entries.forEach(({label}, index) => { label.style.left = `${plan.positions[index]}px`; });
    }
    const height = Math.max(...entries.map(({label}) => label.getBoundingClientRect().height));
    const blockSize = `${height}px`;
    if (row.style.blockSize !== blockSize) row.style.blockSize = blockSize;
  };
  const schedule = () => {
    if (!state.active || state.frame !== null) return;
    state.frame = requestAnimationFrame(() => { state.frame = null; layout(); });
  };
  state.layout = layout;
  if (typeof ResizeObserver !== 'undefined') {
    state.observer = new ResizeObserver(schedule);
    state.observer.observe(base);
    entries.forEach(({label}) => state.observer.observe(label));
  }
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  state.release = () => {
    state.active = false;
    state.observer?.disconnect();
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    document.fonts?.removeEventListener('loadingdone', schedule);
    row.remove();
  };
  root[SLIDER_LABEL_STATE] = state;
}

function updateHandleLabels(root, values = []) {
  const state = root[SLIDER_LABEL_STATE];
  if (!state) return;
  state.values = values.map((value) => formatValue(root, value));
  state.layout();
}

function isDisabledRoot(root) {
  if (!(root instanceof HTMLElement)) return false;
  return root.hasAttribute('disabled') || root.classList.contains('disabled');
}

function createSliderOptions(root) {
  const {min, max} = getNormalizedRange(root);
  const multiple = isMultipleRoot(root);
  const parsedStart = parseStart(root);
  const start = multiple
    ? [parsedStart[0] ?? min, parsedStart[1] ?? max]
    : [parsedStart[0] ?? min];
  const handleCount = multiple ? 2 : 1;

  return {
    start: handleCount > 1 ? start : [start[0]],
    direction: getComputedStyle(root).direction === 'rtl' ? 'rtl' : 'ltr',
    ariaFormat: {
      to: (value) => `${root.getAttribute('data-prefix') || ''}${value}${root.getAttribute('data-suffix') || ''}`,
    },
    connect: getConnect(root, multiple),
    step: root.hasAttribute('data-step') &&
      toNumber(root.getAttribute('data-step'), 0) > 0
      ? toNumber(root.getAttribute('data-step'), 1)
      : undefined,
    margin: multiple && root.hasAttribute('data-margin') &&
      toNumber(root.getAttribute('data-margin'), 0) > 0
      ? Math.min(max - min, toNumber(root.getAttribute('data-margin'), 0))
      : undefined,
    range: { min, max },
    keyboardSupport:
      !root.hasAttribute('data-keyboard') ||
      toBoolean(root.getAttribute('data-keyboard'), true),
    cssPrefix: '',
    cssClasses: {
      target: 'sf-range-slider-target',
      base: 'sf-range-slider-base',
      origin: 'sf-range-slider-origin',
      handle: 'sf-range-slider-handle',
      handleLower: 'sf-range-slider-handle-lower',
      handleUpper: 'sf-range-slider-handle-upper',
      touchArea: 'sf-range-slider-touch-area',
      horizontal: 'sf-range-slider-horizontal',
      vertical: 'sf-range-slider-vertical',
      background: 'sf-range-slider-background',
      connects: 'sf-range-slider-progress',
      connect: 'sf-range-slider-progress-line',
      ltr: 'sf-range-slider-ltr',
      rtl: 'sf-range-slider-rtl',
      textDirectionLtr: 'sf-range-slider-txt-dir-ltr',
      textDirectionRtl: 'sf-range-slider-txt-dir-rtl',
      draggable: 'sf-range-slider-draggable',
      drag: 'sf-range-slider-state-drag',
      tap: 'sf-range-slider-state-tap',
      active: 'active',
      tooltip: 'sf-range-slider-tooltip',
      pips: 'sf-range-slider-pips',
      pipsHorizontal: 'sf-range-slider-pips-horizontal',
      pipsVertical: 'sf-range-slider-pips-vertical',
      marker: 'sf-range-slider-marker',
      markerHorizontal: 'sf-range-slider-marker-horizontal',
      markerVertical: 'sf-range-slider-marker-vertical',
      markerNormal: 'sf-range-slider-marker-normal',
      markerLarge: 'sf-range-slider-marker-large',
      markerSub: 'sf-range-slider-marker-sub',
      value: 'sf-range-slider-value',
      valueHorizontal: 'sf-range-slider-value-horizontal',
      valueVertical: 'sf-range-slider-value-vertical',
      valueNormal: 'sf-range-slider-value-normal',
      valueLarge: 'sf-range-slider-value-large',
      valueSub: 'sf-range-slider-value-sub',
    },
  };
}

function getNumericValues(unencoded = []) {
  return (Array.isArray(unencoded) ? unencoded : [unencoded]).map(Number);
}

function dispatchSliderEvent(root, name, unencoded = [], meta = {}, eventName = `sf-range-slider-${name}`) {
  const values = getNumericValues(unencoded);
  const eventValues = isMultipleRoot(root) ? values.slice(0, 2) : values.slice(0, 1);
  const eventValue = isMultipleRoot(root) ? eventValues : eventValues[0];

  root.dataset.value = Array.isArray(eventValue)
    ? eventValue.join(',')
    : String(eventValue ?? '');

  root.dispatchEvent(
    new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      detail: {
        component: root,
        values: eventValues,
        value: eventValue,
        handleCount: eventValues.length,
        ...meta,
      },
    }),
  );
}

function bindRangeSlider(root, accessibilityOwner) {
  if (
    !(root instanceof HTMLElement) ||
    root.dataset[RANGE_SLIDER_BOUND_FLAG] === 'true'
  ) {
    if (root?._sfRangeSliderInstance && accessibilityOwner instanceof HTMLElement) {
      bindSliderAccessibility(root, accessibilityOwner);
    }
    return root?._sfRangeSliderInstance || null;
  }

  const options = createSliderOptions(root);
  const slider = createNativeSlider(root, options);
  if (!slider) {
    return null;
  }

  const base = root.querySelector('.sf-range-slider-base');
  ensureTrack(base);
  decorateHandles(root);
  bindHandleLabels(root);
  bindSliderAccessibility(root, accessibilityOwner instanceof HTMLElement ? accessibilityOwner : root);

  if (isDisabledRoot(root)) {
    slider.disable();
  }

  slider.on('update', (values, handle, unencoded) => {
    const numericValues = getNumericValues(unencoded);
    // noUiSlider rounds numeric ARIA bounds to one decimal. Keep the exact
    // supported linear range and adjacent-handle margin for fractional ranges.
    const { range, margin = 0 } = slider.options;
    getHandles(root).forEach((node, index) => {
      node.setAttribute('aria-valuenow', String(numericValues[index]));
      node.setAttribute('aria-valuemin', String(index > 0 ? Math.max(range.min, numericValues[index - 1] + margin) : range.min));
      node.setAttribute('aria-valuemax', String(index < numericValues.length - 1 ? Math.min(range.max, numericValues[index + 1] - margin) : range.max));
    });
    updateHandleLabels(root, numericValues);
    dispatchSliderEvent(root, 'update', numericValues, { handle });
  });

  slider.on('set', (values, handle, unencoded) => {
    dispatchSliderEvent(root, 'set', unencoded, { handle });
    dispatchSliderEvent(root, 'change', unencoded, { handle });
    // `change` is the name every form value control reports a committed change
    // by; sf-range-slider-change is its legacy name with the same detail. Like
    // a native control, a value set from code is not a change. It bubbles to a
    // Smart host, which does not repeat it.
    if (!root._sfSettingValue) {
      dispatchSliderEvent(root, 'change', unencoded, { handle }, 'change');
    }
  });

  slider.on('start', (values, handle, unencoded) => {
    dispatchSliderEvent(root, 'start', unencoded, { handle });
  });

  slider.on('end', (values, handle, unencoded) => {
    dispatchSliderEvent(root, 'end', unencoded, { handle });
  });

  root.dataset[RANGE_SLIDER_BOUND_FLAG] = 'true';
  root._sfRangeSliderInstance = slider;
  return slider;
}

function unbindRangeSlider(root) {
  root?.[SLIDER_LABEL_STATE]?.release();
  if (root) delete root[SLIDER_LABEL_STATE];
  root?.[SLIDER_ACCESSIBILITY_STATE]?.observer.disconnect();
  if (root) delete root[SLIDER_ACCESSIBILITY_STATE];
  if (!(root instanceof HTMLElement) || !root.noUiSlider) {
    delete root?.dataset?.[RANGE_SLIDER_BOUND_FLAG];
    delete root?._sfRangeSliderInstance;
    return;
  }

  root.noUiSlider.destroy();
  delete root.dataset[RANGE_SLIDER_BOUND_FLAG];
  delete root._sfRangeSliderInstance;
}

function initRangeSliderTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(RANGE_SLIDER_SELECTOR)) {
    bindRangeSlider(target);
  }

  target.querySelectorAll?.(RANGE_SLIDER_SELECTOR).forEach((root) => bindRangeSlider(root));
}

function initExistingRangeSliders(scope = document) {
  initRangeSliderTree(scope);
}

function getRangeSliderValue(root) {
  if (!(root instanceof HTMLElement) || !root.noUiSlider) return null;
  const values = root.noUiSlider.get(true);
  return Array.isArray(values) && values.length === 1 ? values[0] : values;
}

function setRangeSliderValue(root, value) {
  if (!(root instanceof HTMLElement) || !root.noUiSlider) return false;
  const multiple = isMultipleRoot(root);
  const nextValue = multiple && typeof value === 'string' && value.includes(',')
    ? value.split(',').map((item) => item.trim())
    : !multiple && Array.isArray(value) ? value[0] : value;
  root._sfSettingValue = true;
  try {
    root.noUiSlider.set(nextValue);
  } finally {
    root._sfSettingValue = false;
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.RangeSlider = window.SF.RangeSlider || {};
  window.SF.RangeSlider.bind = bindRangeSlider;
  window.SF.RangeSlider.unbind = unbindRangeSlider;
  window.SF.RangeSlider.getValue = getRangeSliderValue;
  window.SF.RangeSlider.setValue = setRangeSliderValue;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () =>
    initExistingRangeSliders(),
  );
} else {
  initExistingRangeSliders();
}

const rangeSliderObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initRangeSliderTree(node);
    });
    mutation.removedNodes.forEach((node) => {
      if (!(node instanceof Element) || node.isConnected) return;
      if (node.matches(RANGE_SLIDER_SELECTOR)) unbindRangeSlider(node);
      node.querySelectorAll(RANGE_SLIDER_SELECTOR).forEach((root) => {
        if (!root.isConnected) unbindRangeSlider(root);
      });
    });
  });
});

rangeSliderObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindRangeSlider,
  getRangeSliderValue,
  initExistingRangeSliders,
  setRangeSliderValue,
  unbindRangeSlider,
};
