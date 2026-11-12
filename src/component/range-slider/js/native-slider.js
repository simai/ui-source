function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function numericList(value) {
  return (Array.isArray(value) ? value : [value]).map(Number);
}

// Digits after the point a number is written with: 0.1 has one, 2.5e-3 four,
// 500 none. A value is rounded to the digits of its step and its minimum, so
// three steps of 0.1 are 0.3, not 0.30000000000000004 (S2).
export function decimalPlaces(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || !Number.isFinite(Number(text))) return 0;
  const [coefficient, exponent = '0'] = text.split('e');
  const fraction = coefficient.split('.')[1]?.length || 0;
  return Math.min(20, Math.max(0, fraction - Number(exponent)));
}

export function roundToDigits(value, digits) {
  const rounded = Number(Number(value).toFixed(Math.min(20, Math.max(0, digits))));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function createNode(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createNativeSlider(root, options) {
  const classes = options.cssClasses;
  const range = options.range;
  const margin = Number(options.margin || 0);
  const step = Number(options.step || 1);
  // PageUp, PageDown and Shift with an arrow move by the large step: ten
  // steps unless page-step says otherwise, as sf-input-quantity (S4; APG,
  // Radix, Carbon).
  const pageStep = Number(options.pageStep) > 0 ? Number(options.pageStep) : step * 10;
  const digits = Math.max(decimalPlaces(step), decimalPlaces(range.min));
  const listeners = new Map();
  let disabled = false;
  let values = numericList(options.start).map((value) => clamp(value, range.min, range.max));

  root.classList.add(classes.target, classes.horizontal,
    options.direction === 'rtl' ? classes.textDirectionRtl : classes.textDirectionLtr);
  root.replaceChildren();
  const base = createNode('div', classes.base);
  const track = createNode('div', 'sf-range-slider-track');
  const connects = createNode('div', classes.connects);
  const connect = createNode('div', classes.connect);
  connects.append(connect);
  base.append(track, connects);
  root.append(base);

  const handles = values.map((value, index) => {
    const origin = createNode('div', classes.origin);
    const handle = createNode('div', `${classes.handle} ${index === 0 ? classes.handleLower : classes.handleUpper}`);
    const touch = createNode('div', classes.touchArea);
    handle.setAttribute('role', 'slider');
    handle.tabIndex = options.keyboardSupport === false ? -1 : 0;
    handle.append(touch);
    origin.append(handle);
    base.append(origin);
    return {handle, origin};
  });

  const emit = (name, handle = 0) => {
    const display = values.map(String);
    for (const listener of listeners.get(name) || []) listener(display, handle, [...values]);
  };

  const boundsFor = (index) => ({
    min: index > 0 ? roundToDigits(values[index - 1] + margin, digits) : range.min,
    max: index < values.length - 1 ? roundToDigits(values[index + 1] - margin, digits) : range.max,
  });

  const normalize = (value, index) => {
    const bounds = boundsFor(index);
    const stepped = roundToDigits(range.min + Math.round((Number(value) - range.min) / step) * step, digits);
    return roundToDigits(clamp(stepped, bounds.min, bounds.max), digits);
  };

  const render = () => {
    const span = range.max - range.min;
    const percents = values.map((value) => span ? ((value - range.min) / span) * 100 : 0);
    handles.forEach(({handle, origin}, index) => {
      origin.style.insetInlineStart = `${percents[index]}%`;
      handle.setAttribute('aria-valuenow', String(values[index]));
      handle.setAttribute('aria-valuemin', String(boundsFor(index).min));
      handle.setAttribute('aria-valuemax', String(boundsFor(index).max));
      handle.setAttribute('aria-valuetext', options.ariaFormat?.to?.(values[index]) || String(values[index]));
    });
    const start = values.length > 1 ? percents[0] : options.connect === 'upper' ? percents[0] : 0;
    const end = values.length > 1 ? percents[1] : options.connect === false ? percents[0] : options.connect === 'upper' ? 100 : percents[0];
    // connect: false draws no fill at all; it drew one from the start of the
    // track, which is what connect: 'lower' means.
    const none = options.connect === false;
    connect.style.insetInlineStart = `${none ? 0 : Math.min(start, end)}%`;
    connect.style.inlineSize = `${none ? 0 : Math.abs(end - start)}%`;
  };

  const setHandle = (index, value, final = false) => {
    values[index] = normalize(value, index);
    render();
    emit('update', index);
    if (final) emit('set', index);
  };

  const valueFromPointer = (event) => {
    const bounds = base.getBoundingClientRect();
    if (!bounds.width) return range.min;
    let ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    if (options.direction === 'rtl') ratio = 1 - ratio;
    return range.min + ratio * (range.max - range.min);
  };

  const beginPointer = (event) => {
    if (disabled || event.button !== 0) return;
    const value = valueFromPointer(event);
    const index = values.length === 1 || Math.abs(values[0] - value) <= Math.abs(values[1] - value) ? 0 : 1;
    event.preventDefault();
    emit('start', index);
    setHandle(index, value);
    const move = (next) => setHandle(index, valueFromPointer(next));
    const end = (next) => {
      setHandle(index, valueFromPointer(next), true);
      emit('end', index);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  base.addEventListener('pointerdown', beginPointer);

  handles.forEach(({handle}, index) => handle.addEventListener('keydown', (event) => {
    if (disabled || options.keyboardSupport === false) return;
    const direction = options.direction === 'rtl' ? -1 : 1;
    const by = event.shiftKey ? pageStep : step;
    const delta = ({
      ArrowRight: by * direction, ArrowLeft: -by * direction, ArrowUp: by, ArrowDown: -by,
      PageUp: pageStep, PageDown: -pageStep,
    })[event.key];
    let next = delta === undefined ? null : values[index] + delta;
    if (event.key === 'Home') next = boundsFor(index).min;
    if (event.key === 'End') next = boundsFor(index).max;
    if (next === null) return;
    event.preventDefault();
    emit('start', index);
    setHandle(index, next, true);
    emit('end', index);
  }));

  const slider = {
    options,
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      if (name === 'update') listener(values.map(String), 0, [...values]);
    },
    get(raw = false) {
      const result = raw ? [...values] : values.map(String);
      return result.length === 1 ? result[0] : result;
    },
    set(next) {
      const incoming = numericList(next);
      incoming.slice(0, values.length).forEach((value, index) => {
        values[index] = normalize(value, index);
      });
      values = values.sort((a, b) => a - b);
      render();
      emit('update', 0);
      emit('set', 0);
    },
    disable() {
      disabled = true;
      handles.forEach(({handle}) => {
        handle.tabIndex = -1;
        handle.setAttribute('aria-disabled', 'true');
      });
    },
    enable() {
      disabled = false;
      handles.forEach(({handle}) => {
        handle.tabIndex = options.keyboardSupport === false ? -1 : 0;
        handle.removeAttribute('aria-disabled');
      });
    },
    destroy() {
      base.removeEventListener('pointerdown', beginPointer);
      root.replaceChildren();
      root.classList.remove(classes.target, classes.horizontal, classes.textDirectionLtr, classes.textDirectionRtl);
      delete root.noUiSlider;
    },
  };

  root.noUiSlider = slider;
  render();
  return slider;
}
