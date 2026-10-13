const timeInMs = value => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number * (value.trim().endsWith('ms') ? 1 : 1000) : 0;
};

// Hidden/offscreen documents may throttle requestAnimationFrame indefinitely.
// Modal state changes must still complete, so the first scheduled channel wins.
export function scheduleModalFrame(callback, view = window) {
  let complete = false;
  let frame = null;
  let timer = null;
  const run = () => {
    if (complete) return;
    complete = true;
    if (frame !== null) {
      view.cancelAnimationFrame(frame);
      frame = null;
    }
    if (timer !== null) {
      view.clearTimeout(timer);
      timer = null;
    }
    callback();
  };
  frame = view.requestAnimationFrame(run);
  timer = view.setTimeout(run, 50);
  if (typeof view.queueMicrotask === 'function') view.queueMicrotask(run);
  return () => {
    complete = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    if (timer !== null) view.clearTimeout(timer);
  };
}

// CSS lists repeat to match transition-property, not the longest input list.
export function modalTransitionDuration(style) {
  const properties = style.transitionProperty.split(',').map(value => value.trim());
  const durations = style.transitionDuration.split(',').map(timeInMs);
  const delays = style.transitionDelay.split(',').map(timeInMs);
  return Math.max(0, ...properties.map((property, index) => {
    if (!['all', 'opacity', 'transform', '-webkit-transform'].includes(property)) return 0;
    return Math.max(0, durations[index % durations.length]) + delays[index % delays.length];
  }));
}

// Measure after the Smart projection has applied the closing state. A bounded
// timer also completes when no transitionend fires (unchanged or hidden panel).
// Never finish on the first property/descendant transitionend.
export function scheduleModalClose(getRoot, finalize, view = window) {
  let timer = null, cancelled = false;
  const cancelFrame = scheduleModalFrame(() => {
    if (cancelled) return;
    const root = getRoot();
    const nodes = root?.querySelectorAll('[data-sf-modal-panel], [data-sf-modal-overlay]') || [];
    const duration = Math.max(0, ...Array.from(nodes, node => {
      const style = view.getComputedStyle(node);
      return style.display === 'none' ? 0 : modalTransitionDuration(style);
    }));
    timer = view.setTimeout(() => { if (!cancelled) finalize(); }, duration);
  }, view);
  return () => {
    cancelled = true;
    cancelFrame();
    if (timer !== null) view.clearTimeout(timer);
  };
}
