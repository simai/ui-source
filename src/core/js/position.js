// One anchored-positioning contract for Framework floating surfaces (dropdown
// lists, date panels, menus, tooltips). Geometry comes from Floating UI; this
// module adds logical placements, Framework token lengths and the author's
// size caps, so every component opens, flips and shifts the same way.
import {autoUpdate, computePosition, flip, offset, platform, shift, size} from '@floating-ui/dom';
import {logicalSide, physicalPlacement} from './position-placement.js';

function isRtl(element) {
  return getComputedStyle(element).direction === 'rtl';
}

// A plain pixel length needs no probe.
const PIXELS = /^\s*(-?(?:\d+\.?\d*|\.\d+))(?:px)?\s*$/u;

/**
 * Resolves a number or CSS length (tokens included) to pixels in context.
 * Anything but a number or a plain pixel length is measured by a probe span,
 * which restyles the document: call it once per anchor, never per frame.
 */
export function resolveLength(value, context = document.body) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  const plain = PIXELS.exec(value);
  if (plain && (value.includes('px') || Number(plain[1]) === 0)) return parseFloat(plain[1]) || 0;
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
  if (given(css.transform) || given(css.translate) || given(css.scale) || given(css.rotate) || given(css.perspective)
    || given(css.filter) || given(css.backdropFilter) || WILL_CONTAIN.test(css.willChange || '')
    || CONTAINS_FIXED.test(css.contain || '')) return true;
  // A container query box is asked, not assumed. The containment it once
  // implied made it the containing block of fixed descendants, and Floating UI
  // still counts it so; current Chromium no longer does. Counting it placed
  // every panel in the docs' content column (main.docara-content is
  // container-type: inline-size) by the column's offset a second time: the
  // calendar of a field at y 516 opened at y 1336 (docs pre-check DP-01,
  // 2026-11-09). A fixed probe at 0,0 inside the box says which it is.
  return Boolean(css.containerType) && css.containerType !== 'normal' && probesFixedOrigin(element);
}

function probesFixedOrigin(element) {
  const probe = element.ownerDocument.createElement('span');
  probe.style.cssText = 'position:fixed;left:0;top:0;inline-size:0;block-size:0;padding:0;border:0;margin:0;visibility:hidden;pointer-events:none';
  element.append(probe);
  const at = probe.getBoundingClientRect();
  probe.remove();
  return Math.abs(at.left) > 0.5 || Math.abs(at.top) > 0.5;
}

function inTopLayer(element) {
  try {
    return element.matches(':popover-open') || element.matches(':modal');
  } catch {
    return false;
  }
}

// A floating surface is lifted into the top layer while it is anchored (a
// manual popover), so no ancestor can displace or clip it: a transform, a
// filter, will-change, contain: layout or paint, an overflow box, a stacking
// context under a sticky header. It stays where it is in the DOM, so it keeps
// the host's variables, theme, lang, dir and density by plain inheritance --
// what a body portal has to carry by hand (carryLayerOrigin). A surface the
// component already lifted (sf-menu-context, sf-help-mark, sf-profile-picker,
// sf-input-lookup, dropdown lists) is left as it is; a browser without
// popovers keeps the fixed panel in place, placed against its containing block.
//
// A surface inside another top-layer surface -- a tooltip, a dropdown or a
// nested popover in an open sf-popover, a modal dialog -- is lifted too, and
// so stands above its parent. Left inside it, it was a fixed box in the
// parent's stacking context, painted under the parent's later content: a
// tooltip in an open popover hid under the next field's label (C59 S1
// acceptance D1). Shown after its parent, it is drawn over it.
//
// The user-agent popover rule (inset 0, margin auto, a border, padding, Canvas
// and CanvasText, overflow auto) is taken back by a rule of no specificity in
// the lowest Framework layer, sf.reset, so the component's own sheet still
// decides each of those: unlayered, the rule outranked every layered component
// rule and took the calendar's fill, padding and border away.
const LIFTED = 'data-sf-position-layer';
const LIFTED_RULE = `@layer sf.reset{:where([${LIFTED}]){inset:auto;margin:0;padding:0;border:0 none;inline-size:auto;block-size:auto;overflow:visible;color:inherit;background-color:transparent}}`;
const sheets = new WeakMap();

function adoptLiftedRule(floating) {
  const root = floating.getRootNode();
  const target = root instanceof ShadowRoot ? root : floating.ownerDocument;
  if (sheets.has(target)) return;
  const view = floating.ownerDocument.defaultView;
  try {
    const sheet = new view.CSSStyleSheet();
    sheet.replaceSync(LIFTED_RULE);
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    sheets.set(target, sheet);
  } catch {
    const style = floating.ownerDocument.createElement('style');
    style.dataset.sfPositionLayer = '';
    style.textContent = LIFTED_RULE;
    (target === floating.ownerDocument ? target.head || target.documentElement : target).append(style);
    sheets.set(target, style);
  }
}

function liftable(floating) {
  if (typeof floating.showPopover !== 'function' || !floating.isConnected) return false;
  return !floating.hasAttribute('popover') && !inTopLayer(floating);
}

/** Lifts a floating surface into the top layer; returns a function that puts it back, or null. */
export function liftToTopLayer(floating) {
  if (!liftable(floating)) return null;
  adoptLiftedRule(floating);
  floating.setAttribute(LIFTED, '');
  floating.setAttribute('popover', 'manual');
  try {
    floating.showPopover();
  } catch {
    floating.removeAttribute('popover');
    floating.removeAttribute(LIFTED);
    return null;
  }
  return () => {
    if (floating.hasAttribute(LIFTED)) {
      try {
        if (floating.matches(':popover-open')) floating.hidePopover();
      } catch { /* already gone from the document */ }
      floating.removeAttribute('popover');
      floating.removeAttribute(LIFTED);
    }
  };
}

// The scroll positions inside a floating surface (the surface itself and every
// box in it that is scrolled), to be put back after a measurement that lifted
// its height cap. Only boxes away from their start are kept.
function scrollOffsets(floating) {
  const found = [];
  const keep = (element) => {
    if (element.scrollTop || element.scrollLeft) found.push([element, element.scrollTop, element.scrollLeft]);
  };
  keep(floating);
  for (const element of floating.querySelectorAll('*')) keep(element);
  return found;
}

// Put back at once: the Framework sheet makes every box scroll smoothly
// (* {scroll-behavior: smooth}, core scroll), and an assigned scrollTop glided
// from the start the measurement threw it to. After a page scroll the list ran
// 0 -> 800 over half a second and read 784 when the probe looked; a reposition
// during the glide kept the value it had reached (R171 follow-up, 2026-11-12).
function restoreScrollOffsets(found) {
  for (const [element, top, left] of found) {
    if (!element.isConnected) continue;
    if (element.scrollTop !== top || element.scrollLeft !== left) element.scrollTo({top, left, behavior: 'instant'});
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

// data-sf-density on the root or on a region restates the space tokens; one
// attribute filter, so nothing else on the page wakes it.
function watchDensity(doc, run) {
  const view = doc?.defaultView;
  if (typeof view?.MutationObserver !== 'function') return () => {};
  const observer = new view.MutationObserver(() => run());
  observer.observe(doc.documentElement, {attributes: true, subtree: true, attributeFilter: ['data-sf-density']});
  return () => observer.disconnect();
}

/**
 * Keeps `floating` anchored to `reference`.
 * options: {side, align, offset, alignmentOffset, padding, flip, shift,
 *           matchWidth, fitHeight, autoUpdate, topLayer, onPosition({side, placement, x, y})}
 * matchWidth: true makes the panel exactly as wide as the reference; "min"
 * makes it at least as wide (a list at a field, decision C32: it may grow with
 * its longest option up to its own cap, never narrower than the field).
 * topLayer (default true) lifts the floating element into the top layer while
 * it is anchored (see liftToTopLayer); false keeps it where it stands.
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
    flip: true, shift: true, matchWidth: false, fitHeight: true, autoUpdate: true, topLayer: true, onPosition: null, ...options,
  };
  // Inline styles this helper writes are restored on stop(); the author's caps
  // are kept, so viewport fitting may only tighten them.
  const written = ['position', 'left', 'top', 'right', 'bottom', 'margin', 'max-height', 'max-width', ...(settings.matchWidth === 'min' ? ['min-width'] : settings.matchWidth ? ['width'] : [])];
  const saved = written.map((name) => [name, floating.style.getPropertyValue(name), floating.style.getPropertyPriority(name)]);
  const authored = {maxHeight: floating.style.getPropertyValue('max-height')};
  // Stylesheet caps (max-height, max-width) are read before this helper writes
  // inline values, so fitting the viewport never loosens them.
  // A percentage cap is kept as written by getComputedStyle; read as pixels,
  // max-inline-size: 100% made every tooltip 100px wide. The panel is fixed, so
  // a percentage is of the viewport.
  // Lifted before its caps are read: the panel is measured where it is drawn.
  const lower = settings.topLayer ? liftToTopLayer(floating) : null;
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
  let pendingFull = false;

  // The cost of a position (datepicker audit P1/P2, 2026-11-11). Each
  // resolveLength of a token inserts a probe span and restyles the whole
  // document (about 9 ms on a docs page), and resetting max-height to read
  // the natural height forces another; per scroll event that made 800 px of
  // scrolling with a panel open cost 1.8-2.3 s of style recalculation. So:
  // - the lengths (offset, padding, alignmentOffset) are resolved once per
  //   anchor, and again only when the window's size changed;
  // - a full fit -- the first, a resize, the panel or its reference changing
  //   size, or update() from the component -- measures as before: direction,
  //   viewport width, containing block, natural height;
  // - a scroll or a layout shift asks for a light fit, at most once per
  //   frame: it reuses those measurements and only places the panel again.
  //   Flip, shift and the size caps run exactly as in a full fit; flipping
  //   compares the natural height measured by the last full fit (the panel's
  //   content does not change by scrolling; when it does, its size changes
  //   and that is a full fit), and max-height is not reset to read it.
  // - Inline styles and data-sf-side are written only when they change.
  // A density change (data-sf-density on the root or a region) restates
  // the space tokens without resizing the window, and the gap stayed the old
  // one until the panel was opened again (C59 S1 acceptance M1). The key also
  // carries the computed values of the tokens the lengths are written with: a
  // read of a clean style, no probe and no restyle.
  const tokens = [...new Set([settings.offset, settings.padding, settings.alignmentOffset]
    .filter((value) => typeof value === 'string')
    .flatMap((value) => [...value.matchAll(/var\(\s*(--(?:\\.|[^\s,)\\])+)/gu)].map((match) => match[1].replace(/\\(.)/gu, '$1'))))];
  let lengths = null;
  const lengthsNow = () => {
    const context = reference.parentElement;
    const values = tokens.length && context?.isConnected
      ? tokens.map((name) => getComputedStyle(context).getPropertyValue(name).trim()).join('|') : '';
    const key = `${window.innerWidth}x${window.innerHeight}|${values}`;
    if (!lengths || lengths.key !== key) {
      lengths = {
        key,
        gap: resolveLength(settings.offset, context),
        padding: resolveLength(settings.padding, context),
        alignment: resolveLength(settings.alignmentOffset, context),
      };
    }
    return lengths;
  };
  let measures = null;
  const put = (style, name, value) => {
    if (style[name] !== value) style[name] = value;
  };

  const run = async (full) => {
    // Measuring the natural height takes the cap off for a moment: a list
    // that scrolls inside the panel stops overflowing, and the browser puts
    // its scroll back to the start. Every reposition that measured -- one per
    // wheel step for a dropdown that follows the page's scroll in capture --
    // threw the list back to its top, so it never moved and shook in place
    // (owner R171, 2026-11-12), and a list scrolled to a keyboard-focused
    // option jumped back to its first row (keyboard reveal). Only a fit that
    // takes the cap off (a full fit, or the first) can clamp the scroll; a
    // light fit keeps the cap and needs nothing put back. What was scrolled
    // is put back once the cap is, and before onPosition, so a component that
    // scrolls there has the last word.
    let scrolled = settings.fitHeight && (full || !measures) ? scrollOffsets(floating) : null;
    const putBack = () => {
      if (scrolled) restoreScrollOffsets(scrolled);
      scrolled = null;
    };
    try {
      return await place(full, putBack);
    } finally {
      putBack();
    }
  };

  const place = async (full, putBack) => {
    // The panel is fixed before it is measured, so it is measured in the box
    // it will be placed in: left absolute by the stylesheet (a tooltip in its
    // anchor), its first position was taken from the anchor and written as
    // the viewport's.
    if (floating.style.position !== 'fixed') floating.style.position = 'fixed';
    if (full || !measures) {
      measures = {rtl: isRtl(reference), clientWidth: document.documentElement.clientWidth, container: null, natural: 0};
      // Measure the natural size so flipping compares the real panel height.
      if (settings.fitHeight) {
        put(floating.style, 'maxHeight', authored.maxHeight || '');
        measures.natural = floating.getBoundingClientRect().height;
      }
    }
    const {rtl, clientWidth, natural} = measures;
    const {gap, padding, alignment} = lengthsNow();
    // A light fit starts from the natural height, as a full fit does after
    // its reset; once the size middleware has written the cap, the panel is
    // measured as it is (Floating UI's own second pass).
    let naturalPass = !full && settings.fitHeight;
    // alignmentOffset moves a start/end-aligned panel along its edge (mirrored
    // for end), e.g. so a tail points at the middle of a small trigger.
    // The panel keeps its distance from the viewport's inline edges, but never
    // more than its field keeps. With a flat padding a field closer to the edge
    // than the padding -- every field in a documentation example, which starts
    // at the frame's edge -- had its panel pushed inward by the difference and
    // hanging past the field on the other side. The edge a field reaches is an
    // edge its own panel may reach too.
    const box = referenceRect(reference);
    const edges = {
      top: padding,
      bottom: padding,
      left: Math.min(padding, Math.max(0, box.left)),
      right: Math.min(padding, Math.max(0, clientWidth - box.right)),
    };
    const middleware = [offset({mainAxis: gap, alignmentAxis: alignment})];
    if (settings.flip) middleware.push(flip({padding, crossAxis: false}));
    // Shift before size: a panel near the inline edge moves inside the viewport
    // instead of being squeezed to the space left of its field.
    if (settings.shift) middleware.push(shift({padding: edges, crossAxis: false}));
    middleware.push(size({
      padding: edges,
      apply({availableWidth, availableHeight, rects, elements}) {
        naturalPass = false;
        if (controller.stopped) return;
        const viewportWidth = clientWidth - edges.left - edges.right;
        const fieldWidth = `${Math.max(0, Math.min(rects.reference.width, viewportWidth))}px`;
        if (settings.matchWidth === 'min') put(elements.floating.style, 'minWidth', fieldWidth);
        else if (settings.matchWidth) put(elements.floating.style, 'width', fieldWidth);
        put(elements.floating.style, 'maxWidth', `${Math.max(0, Math.min(availableWidth, viewportWidth, widthCap))}px`);
        if (settings.fitHeight) {
          // A panel that misses its room by less than the edge's padding takes
          // its whole height, rounded up, and stands that much nearer the edge:
          // clamped half a pixel or a few pixels short, every row showed and a
          // scrollbar still stood beside them, its thumb the whole track
          // (owner R018, 2026-11-07, a five-language menu at DPR 1).
          const room = Math.min(availableHeight, heightCap);
          const whole = Math.ceil(natural);
          const fits = whole > room && whole <= availableHeight + padding && whole <= heightCap;
          put(elements.floating.style, 'maxHeight', `${Math.max(0, fits ? whole : room)}px`);
        }
      },
    }));
    const result = await computePosition(measured, floating, {
      strategy: 'fixed',
      // The panel is fixed: its offset parent is the box it is placed in.
      platform: {
        ...platform,
        getOffsetParent: (element, polyfill) => (element === floating
          ? (measures.container ??= fixedContainingBlock(floating))
          : platform.getOffsetParent(element, polyfill)),
        getDimensions: (element) => {
          const dimensions = platform.getDimensions(element);
          return element === floating && naturalPass ? {...dimensions, height: natural} : dimensions;
        },
      },
      placement: physicalPlacement(settings.side, settings.align, rtl),
      middleware,
    });
    if (controller.stopped) return result;
    // right/bottom are cleared so logical insets from the component stylesheet
    // (for example inset-inline-start in RTL) cannot over-constrain the box.
    const placed = {position: 'fixed', left: `${result.x}px`, top: `${result.y}px`, right: 'auto', bottom: 'auto', margin: '0px'};
    for (const [name, value] of Object.entries(placed)) put(floating.style, name, value);
    controller.side = logicalSide(result.placement, rtl);
    if (floating.dataset.sfSide !== controller.side) floating.dataset.sfSide = controller.side;
    putBack();
    settings.onPosition?.({side: controller.side, placement: result.placement, x: result.x, y: result.y});
    return result;
  };

  // Coalesce bursts (scroll, resize, observers) into one computation at a
  // time; a full fit asked for while one runs is not lost to a light one.
  const request = (full) => {
    if (controller.stopped) return Promise.resolve(null);
    if (running) {
      pending = true;
      pendingFull ||= full;
      return running;
    }
    running = run(full).finally(() => {
      running = null;
      if (pending && !controller.stopped) {
        const again = pendingFull;
        pending = false;
        pendingFull = false;
        request(again);
      }
    });
    return running;
  };
  /** A full fit: measures again (the component calls it after it changed the panel). */
  controller.update = () => request(true);
  // Scroll and layout shift: a light fit, at most once per frame.
  let frame = 0;
  let armed = false;
  const follow = () => {
    if (!armed || frame || controller.stopped) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      request(false);
    });
  };
  const cleanups = settings.autoUpdate ? [
    // Resize of the window or an overflow ancestor, and of the panel or its
    // reference: a full fit (also the first one).
    autoUpdate(measured, floating, controller.update, {ancestorScroll: false, layoutShift: false}),
    // Scroll of any overflow ancestor and a moved reference: a light fit.
    autoUpdate(measured, floating, follow, {ancestorResize: false, elementResize: false}),
    // A density switch that moves no box still restates the gap: a full fit.
    ...(tokens.length ? [watchDensity(floating.ownerDocument, controller.update)] : []),
  ] : [];
  armed = true;
  controller.stop = () => {
    controller.stopped = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const cleanup of cleanups) cleanup();
    delete floating.dataset.sfSide;
    lower?.();
    for (const [name, value, priority] of saved) {
      if (value) floating.style.setProperty(name, value, priority);
      else floating.style.removeProperty(name);
    }
  };
  if (!settings.autoUpdate) controller.update();
  return controller;
}

const Position = Object.freeze({anchor, anchorReference, referenceRect, liftToTopLayer, logicalSide, physicalPlacement, resolveLength});

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.Position) globalThis.SF.Position = Position;
}

export default Position;
