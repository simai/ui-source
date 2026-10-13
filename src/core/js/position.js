// One anchored-positioning contract for Framework floating surfaces (dropdown
// lists, date panels, menus, tooltips). Geometry comes from Floating UI; this
// module adds logical placements, Framework token lengths and the author's
// size caps, so every component opens, flips and shifts the same way.
import {autoUpdate, computePosition, flip, offset, shift, size} from '@floating-ui/dom';
import {logicalSide, physicalPlacement} from './position-placement.js';

function isRtl(element) {
  return getComputedStyle(element).direction === 'rtl';
}

/** Resolves a number or CSS length (tokens included) to pixels in context. */
export function resolveLength(value, context = document.body) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;block-size:0;padding:0;border:0';
  probe.style.inlineSize = value;
  (context?.isConnected ? context : document.body).append(probe);
  const pixels = parseFloat(getComputedStyle(probe).width) || 0;
  probe.remove();
  return pixels;
}

/**
 * Keeps `floating` anchored to `reference`.
 * options: {side, align, offset, alignmentOffset, padding, flip, shift,
 *           matchWidth, fitHeight, autoUpdate, onPosition({side, placement, x, y})}
 * Returns {update(): Promise, stop(), side}.
 */
export function anchor(reference, floating, options = {}) {
  if (!(reference instanceof Element) || !(floating instanceof HTMLElement)) {
    throw new TypeError('Anchored positioning needs a reference element and a floating element');
  }
  const settings = {
    side: 'block-end', align: 'start', offset: 'var(--sf-space-1\\/4)', alignmentOffset: 0, padding: 'var(--sf-space-1\\/2)',
    flip: true, shift: true, matchWidth: false, fitHeight: true, autoUpdate: true, onPosition: null, ...options,
  };
  // Inline styles this helper writes are restored on stop(); the author's caps
  // are kept, so viewport fitting may only tighten them.
  const written = ['position', 'left', 'top', 'right', 'bottom', 'margin', 'max-height', 'max-width', ...(settings.matchWidth ? ['width'] : [])];
  const saved = written.map((name) => [name, floating.style.getPropertyValue(name), floating.style.getPropertyPriority(name)]);
  const authored = {maxHeight: floating.style.getPropertyValue('max-height')};
  // Stylesheet caps (max-height, max-width) are read before this helper writes
  // inline values, so fitting the viewport never loosens them.
  // A percentage cap is kept as written by getComputedStyle; read as pixels,
  // max-inline-size: 100% made every tooltip 100px wide. The panel is fixed, so
  // a percentage is of the viewport.
  const floatingStyle = getComputedStyle(floating);
  const cap = (value, whole) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return Infinity;
    return String(value).trim().endsWith('%') ? number / 100 * whole : number;
  };
  const heightCap = cap(floatingStyle.maxHeight, document.documentElement.clientHeight);
  const widthCap = cap(floatingStyle.maxWidth, document.documentElement.clientWidth);
  const controller = {side: settings.side, stopped: false};
  let running = null;
  let pending = false;

  const run = async () => {
    const rtl = isRtl(reference);
    const gap = resolveLength(settings.offset, reference.parentElement);
    const padding = resolveLength(settings.padding, reference.parentElement);
    // Measure the natural size so flipping compares the real panel height.
    if (settings.fitHeight) floating.style.maxHeight = authored.maxHeight || '';
    // alignmentOffset moves a start/end-aligned panel along its edge (mirrored
    // for end), e.g. so a tail points at the middle of a small trigger.
    // The panel keeps its distance from the viewport's inline edges, but never
    // more than its field keeps. With a flat padding a field closer to the edge
    // than the padding -- every field in a documentation example, which starts
    // at the frame's edge -- had its panel pushed inward by the difference and
    // hanging past the field on the other side. The edge a field reaches is an
    // edge its own panel may reach too.
    const box = reference.getBoundingClientRect();
    const clientWidth = document.documentElement.clientWidth;
    const edges = {
      top: padding,
      bottom: padding,
      left: Math.min(padding, Math.max(0, box.left)),
      right: Math.min(padding, Math.max(0, clientWidth - box.right)),
    };
    const middleware = [offset({mainAxis: gap, alignmentAxis: resolveLength(settings.alignmentOffset, reference.parentElement)})];
    if (settings.flip) middleware.push(flip({padding, crossAxis: false}));
    // Shift before size: a panel near the inline edge moves inside the viewport
    // instead of being squeezed to the space left of its field.
    if (settings.shift) middleware.push(shift({padding: edges, crossAxis: false}));
    middleware.push(size({
      padding: edges,
      apply({availableWidth, availableHeight, rects, elements}) {
        if (controller.stopped) return;
        const viewportWidth = clientWidth - edges.left - edges.right;
        if (settings.matchWidth) elements.floating.style.width = `${Math.max(0, Math.min(rects.reference.width, viewportWidth))}px`;
        elements.floating.style.maxWidth = `${Math.max(0, Math.min(availableWidth, viewportWidth, widthCap))}px`;
        if (settings.fitHeight) elements.floating.style.maxHeight = `${Math.max(0, Math.min(availableHeight, heightCap))}px`;
      },
    }));
    const result = await computePosition(reference, floating, {
      strategy: 'fixed',
      placement: physicalPlacement(settings.side, settings.align, rtl),
      middleware,
    });
    if (controller.stopped) return result;
    // right/bottom are cleared so logical insets from the component stylesheet
    // (for example inset-inline-start in RTL) cannot over-constrain the box.
    Object.assign(floating.style, {position: 'fixed', left: `${result.x}px`, top: `${result.y}px`, right: 'auto', bottom: 'auto', margin: '0'});
    controller.side = logicalSide(result.placement, rtl);
    floating.dataset.sfSide = controller.side;
    settings.onPosition?.({side: controller.side, placement: result.placement, x: result.x, y: result.y});
    return result;
  };

  // Coalesce bursts (scroll, resize, observers) into one computation at a time.
  controller.update = () => {
    if (controller.stopped) return Promise.resolve(null);
    if (running) {
      pending = true;
      return running;
    }
    running = run().finally(() => {
      running = null;
      if (pending && !controller.stopped) {
        pending = false;
        controller.update();
      }
    });
    return running;
  };
  const cleanup = settings.autoUpdate ? autoUpdate(reference, floating, controller.update) : null;
  controller.stop = () => {
    controller.stopped = true;
    cleanup?.();
    delete floating.dataset.sfSide;
    for (const [name, value, priority] of saved) {
      if (value) floating.style.setProperty(name, value, priority);
      else floating.style.removeProperty(name);
    }
  };
  if (!settings.autoUpdate) controller.update();
  return controller;
}

const Position = Object.freeze({anchor, logicalSide, physicalPlacement, resolveLength});

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.Position) globalThis.SF.Position = Position;
}

export default Position;
