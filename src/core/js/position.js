// One anchored-positioning contract for Framework floating surfaces (dropdown
// lists, date panels, menus, tooltips). Geometry comes from Floating UI; this
// module adds logical placements, Framework token lengths and the author's
// size caps, so every component opens, flips and shifts the same way.
import {autoUpdate, computePosition, flip, offset, platform, shift, size} from '@floating-ui/dom';
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

// A host that draws no box of its own -- every Smart element is
// `display: contents`, sf-button-icon and sf-button among them -- measures as a
// zero rectangle at 0,0, and a menu opened for it stood at the window's left
// edge (simai/ui-source#68). Such a host is measured by what it draws: the
// union of its children's boxes. The first of them stands in for it where an
// element is needed (scroll ancestors, resize).
function drawsNoBox(element) {
  return element instanceof Element && getComputedStyle(element).display === 'contents';
}

function boxesOf(element, found = []) {
  for (const child of element.children) {
    if (drawsNoBox(child)) boxesOf(child, found);
    else if (child.getClientRects().length) found.push(child);
  }
  return found;
}

// The box a fixed panel is placed in: the nearest ancestor that contains
// fixed descendants -- a transform or one of its parts, a filter, will-change
// naming one, contain: layout or paint (as [data-sf-overlay-container] has),
// a container query box -- or the viewport. Floating UI asks the same
// question but counts an element that draws no box: every Smart host is
// display: contents, and the tooltip sheet gives a placed sf-tooltip its
// translate. A box-less element contains nothing, so the browser placed the
// panel in the overlay container while Floating UI measured from the host's
// empty rectangle at 0,0 -- viewport coordinates, taken from the container:
// sf-composition-overlay's tooltips stood 48px low under a 48px bar
// (simai/ui-source#63).
const CONTAINS_FIXED = /paint|layout|strict|content/u;
const WILL_CONTAIN = /transform|translate|scale|rotate|perspective|filter/u;
const given = (value) => Boolean(value) && value !== 'none';

function containsFixed(element) {
  const css = getComputedStyle(element);
  if (css.display === 'contents') return false;
  return given(css.transform) || given(css.translate) || given(css.scale) || given(css.rotate) || given(css.perspective)
    || given(css.filter) || given(css.backdropFilter) || WILL_CONTAIN.test(css.willChange || '')
    || CONTAINS_FIXED.test(css.contain || '') || (Boolean(css.containerType) && css.containerType !== 'normal');
}

function inTopLayer(element) {
  try {
    return element.matches(':popover-open') || element.matches(':modal');
  } catch {
    return false;
  }
}

function fixedContainingBlock(element) {
  const view = element.ownerDocument.defaultView;
  if (inTopLayer(element)) return view;
  for (let node = element.parentElement; node && node !== node.ownerDocument.body && node !== node.ownerDocument.documentElement; node = node.parentElement) {
    if (containsFixed(node)) return node;
    if (inTopLayer(node)) return view;
  }
  return view;
}

/** The rectangle a reference occupies: its own, or what it draws when it has none. */
export function referenceRect(element) {
  if (!drawsNoBox(element)) return element.getBoundingClientRect();
  const boxes = boxesOf(element).map((box) => box.getBoundingClientRect());
  if (!boxes.length) return element.getBoundingClientRect();
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/** The element positioning measures: the reference itself, or for a host that draws no box a stand-in that measures what it draws. */
export function anchorReference(element) {
  if (!drawsNoBox(element)) return element;
  return {
    getBoundingClientRect: () => referenceRect(element),
    getClientRects: () => [referenceRect(element)],
    get contextElement() {
      return boxesOf(element)[0] || element.parentElement || element;
    },
  };
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
  // Measured through what it draws when the reference draws no box (#68).
  const measured = anchorReference(reference);
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
    // The panel is fixed before it is measured, so it is measured in the box
    // it will be placed in: left absolute by the stylesheet (a tooltip in its
    // anchor), its first position was taken from the anchor and written as
    // the viewport's.
    if (floating.style.position !== 'fixed') floating.style.position = 'fixed';
    const rtl = isRtl(reference);
    const gap = resolveLength(settings.offset, reference.parentElement);
    const padding = resolveLength(settings.padding, reference.parentElement);
    // Measure the natural size so flipping compares the real panel height.
    if (settings.fitHeight) floating.style.maxHeight = authored.maxHeight || '';
    const natural = settings.fitHeight ? floating.getBoundingClientRect().height : 0;
    // alignmentOffset moves a start/end-aligned panel along its edge (mirrored
    // for end), e.g. so a tail points at the middle of a small trigger.
    // The panel keeps its distance from the viewport's inline edges, but never
    // more than its field keeps. With a flat padding a field closer to the edge
    // than the padding -- every field in a documentation example, which starts
    // at the frame's edge -- had its panel pushed inward by the difference and
    // hanging past the field on the other side. The edge a field reaches is an
    // edge its own panel may reach too.
    const box = referenceRect(reference);
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
        if (settings.fitHeight) {
          // A panel that misses its room by less than the edge's padding takes
          // its whole height, rounded up, and stands that much nearer the edge:
          // clamped half a pixel or a few pixels short, every row showed and a
          // scrollbar still stood beside them, its thumb the whole track
          // (owner R018, 2026-11-07, a five-language menu at DPR 1).
          const room = Math.min(availableHeight, heightCap);
          const whole = Math.ceil(natural);
          const fits = whole > room && whole <= availableHeight + padding && whole <= heightCap;
          elements.floating.style.maxHeight = `${Math.max(0, fits ? whole : room)}px`;
        }
      },
    }));
    const result = await computePosition(measured, floating, {
      strategy: 'fixed',
      // The panel is fixed: its offset parent is the box it is placed in.
      platform: {
        ...platform,
        getOffsetParent: (element, polyfill) => (element === floating
          ? fixedContainingBlock(floating)
          : platform.getOffsetParent(element, polyfill)),
      },
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
  const cleanup = settings.autoUpdate ? autoUpdate(measured, floating, controller.update) : null;
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

const Position = Object.freeze({anchor, anchorReference, referenceRect, logicalSide, physicalPlacement, resolveLength});

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.Position) globalThis.SF.Position = Position;
}

export default Position;
