// The floating-surface engine of C59 (owner decision 2026-11-11), internal to
// the Framework: sf-popover uses it now, the tooltip, the «?» toggletip and the
// hover card are meant to sit on it in stages S2-S4. It is not on window.SF and
// not in the public JS API contract (dispatcher 2026-11-11: a public engine
// name is an owner-level API decision, taken once the later kinds prove the
// shape).
//
// It places a panel by CSS anchor positioning (anchor-name, position-area,
// position-try-fallbacks) where the browser has it and the panel stands in the
// top layer, and by SF.Position (Floating UI) everywhere else: no CSS anchor
// positioning, a reference with no box of its own, a panel outside the top
// layer -- and, for the rest of an opening, when no CSS area keeps the panel
// inside the window (CSS has no shift). It builds on SF.Position's public API
// only; position.js itself is not changed here.
//
// Both engines say the side the panel took in data-sf-side (block-start,
// block-end, inline-start, inline-end) and, asked (arrow: true), where the
// reference's centre is in the panel's box: --sf-position-arrow-x and -y, in
// px, kept arrowPadding from the panel's corners.
import BundledPosition from './position.js';

const positioning = () => globalThis.SF?.Position || BundledPosition;

// <html data-sf-position-engine="script"> keeps the script on a page (a
// diagnostic, and the tests' way to drive the fallback).
const ENGINE_ATTRIBUTE = 'data-sf-position-engine';

// Anchor names are document-wide: every bundle that carries this module counts
// on one shared counter, not on a module-scope one of its own.
const COUNTER = Symbol.for('sf.float-anchor.names');

function nextAnchorName() {
  globalThis[COUNTER] = (globalThis[COUNTER] || 0) + 1;
  return `--sf-anchor-${globalThis[COUNTER]}`;
}

// The name is given by a rule, not by the reference's inline style: a Smart
// host's \`style\` is its author style, handed to its template root (an inline
// anchor-name never reached the host's box), and its style attribute is
// rewritten on every render. The reference carries the names in
// data-sf-float-anchor; one adopted sheet per document or shadow root holds a
// rule per name, kept on a shared global as the counter is.
const ANCHOR_ATTRIBUTE = 'data-sf-float-anchor';
const SHEETS = Symbol.for('sf.float-anchor.sheets');

function anchorSheet(root) {
  if (!root || !('adoptedStyleSheets' in root)) return null;
  const sheets = globalThis[SHEETS] || (globalThis[SHEETS] = new WeakMap());
  let entry = sheets.get(root);
  if (!entry) {
    const view = (root.ownerDocument || root).defaultView || globalThis;
    if (typeof view.CSSStyleSheet !== 'function') return null;
    entry = {sheet: new view.CSSStyleSheet(), rules: new Map()};
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, entry.sheet];
    sheets.set(root, entry);
  }
  return entry;
}

function writeAnchorRules(entry) {
  entry.sheet.replaceSync([...entry.rules.values()].join('\n'));
}

export function supportsCssAnchoring() {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('anchor-name: --sf-a')
      && CSS.supports('position-area: bottom span-right') && CSS.supports('position-try-fallbacks: flip-block')
      && CSS.supports('justify-self: anchor-center');
  } catch {
    return false;
  }
}

function inTopLayer(element) {
  try {
    return element.matches(':popover-open') || element.matches(':modal');
  } catch {
    return false;
  }
}

const drawsNoBox = (element) => getComputedStyle(element).display === 'contents';

// What the CSS engine re-reads on: a scroll anywhere (capture), a resize, a
// size change of the panel or the reference -- one read per frame. The browser
// moves the panel itself; this only says the side and the arrow again. (Floating
// UI stays the shared helper's alone: tests/pure-runtime-dependencies.)
function watch(reference, floating, run) {
  const view = floating.ownerDocument.defaultView;
  let frame = 0;
  const soon = () => {
    if (frame) return;
    frame = view.requestAnimationFrame(() => { frame = 0; run(); });
  };
  view.addEventListener('scroll', soon, {capture: true, passive: true});
  view.addEventListener('resize', soon, {passive: true});
  const sizes = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(soon) : null;
  sizes?.observe(floating);
  sizes?.observe(reference);
  run();
  return () => {
    view.removeEventListener('scroll', soon, {capture: true});
    view.removeEventListener('resize', soon);
    sizes?.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
  };
}

/** The engine a panel is placed by: 'css' or 'script'. */
export function floatEngine(reference, floating, options = {}) {
  if (floating?.ownerDocument?.documentElement?.getAttribute(ENGINE_ATTRIBUTE) === 'script') return 'script';
  if (!supportsCssAnchoring()) return 'script';
  if (options.fitHeight || options.matchWidth || options.alignmentOffset) return 'script';
  if (!(reference instanceof Element) || drawsNoBox(reference)) return 'script';
  if (!anchorSheet(reference.getRootNode())) return 'script';
  if (reference.getRootNode() !== floating.getRootNode() || !inTopLayer(floating)) return 'script';
  return 'css';
}

// The area a placement takes around its anchor, in physical words: the side,
// and across it the span that keeps the panel's start (or end) edge on the
// anchor's; a centred panel spans the whole cross axis and centres on the
// anchor. The tactics try the other alignment first (a shift along the edge),
// then the other side, then both, as Floating UI's shift and flip do; they
// carry the gap (a margin) and the window's padding (insets) with them.
function cssArea(placement) {
  const [side, align] = placement.split('-');
  const across = side === 'top' || side === 'bottom';
  const span = !align ? 'span-all'
    : across ? (align === 'start' ? 'span-right' : 'span-left')
      : (align === 'start' ? 'span-bottom' : 'span-top');
  const fallbacks = !align ? (across ? 'flip-block' : 'flip-inline')
    : across ? 'flip-inline, flip-block, flip-block flip-inline' : 'flip-block, flip-inline, flip-block flip-inline';
  return {side, area: `${side} ${span}`, fallbacks, centred: !align, across};
}

// Floating UI mirrors start/end alignment for a right-to-left element; the CSS
// area is physical, so the mirrored placement is written out.
function mirroredPlacement(placement, rtl) {
  const [side, align] = placement.split('-');
  if (!rtl || !align || (side !== 'top' && side !== 'bottom')) return placement;
  return `${side}-${align === 'start' ? 'end' : 'start'}`;
}

const OPPOSITE = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};

function measuredSide(box, panel) {
  if (panel.bottom <= box.top + 1) return 'top';
  if (panel.top >= box.bottom - 1) return 'bottom';
  if (panel.right <= box.left + 1) return 'left';
  return 'right';
}

const CSS_WRITTEN = ['position', 'top', 'right', 'bottom', 'left', 'margin', 'max-width', 'position-anchor', 'position-area',
  'position-try-fallbacks', 'justify-self', 'align-self'];
const ARROW_WRITTEN = ['--sf-position-arrow-x', '--sf-position-arrow-y'];

/**
 * Keeps `floating` anchored to `reference`, by CSS where it can and by
 * SF.Position.anchor() where it cannot. options: SF.Position.anchor()'s
 * (side, align, offset, padding, flip, shift, fitHeight, matchWidth,
 * alignmentOffset, topLayer, onPosition) plus arrow and arrowPadding.
 * Returns {update(), stop(), side, engine}.
 */
export function anchorFloating(reference, floating, options = {}) {
  const Position = positioning();
  const settings = {side: 'block-end', align: 'start', offset: 'var(--sf-space-1\\/4)', padding: 'var(--sf-space-1\\/2)',
    arrow: false, arrowPadding: 'var(--sf-space-1)', ...options};
  const style = floating.style;
  const saved = [...CSS_WRITTEN, ...ARROW_WRITTEN].map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]);
  const restore = (names) => {
    for (const [name, value, priority] of saved) {
      if (!names.includes(name)) continue;
      if (value) style.setProperty(name, value, priority);
      else style.removeProperty(name);
    }
  };
  const controller = {side: settings.side, engine: floatEngine(reference, floating, settings), stopped: false};
  let script = null;
  let cleanup = null;
  let anchorName = '';

  const writeArrow = (box, panel) => {
    if (!settings.arrow) return;
    const inset = Position.resolveLength(settings.arrowPadding, reference.parentElement);
    const clamp = (value, whole) => {
      const edge = Math.min(inset, whole / 2);
      return Math.max(edge, Math.min(whole - edge, value));
    };
    style.setProperty('--sf-position-arrow-x', `${Math.round(clamp(box.left + box.width / 2 - panel.left, panel.width))}px`);
    style.setProperty('--sf-position-arrow-y', `${Math.round(clamp(box.top + box.height / 2 - panel.top, panel.height))}px`);
  };

  // The panel's anchor: its name in the reference's data-sf-float-anchor and
  // a rule that gives the reference that name, beside any it already has. If
  // something takes the attribute away, it is written again before the next
  // paint (a MutationObserver runs in the same task's microtasks).
  const holdAnchorName = () => {
    const entry = anchorSheet(reference.getRootNode());
    if (!entry) return;
    if (!anchorName) {
      anchorName = nextAnchorName();
      const current = getComputedStyle(reference).getPropertyValue('anchor-name').trim();
      const names = current && current !== 'none' ? current.split(',').map((name) => name.trim()).filter(Boolean) : [];
      entry.rules.set(anchorName, `[${ANCHOR_ATTRIBUTE}~="${anchorName}"] { anchor-name: ${[...names, anchorName].join(', ')}; }`);
      writeAnchorRules(entry);
    }
    const held = (reference.getAttribute(ANCHOR_ATTRIBUTE) || '').split(/\s+/u).filter(Boolean);
    if (!held.includes(anchorName)) reference.setAttribute(ANCHOR_ATTRIBUTE, [...held, anchorName].join(' '));
  };

  const releaseAnchorName = () => {
    if (!anchorName) return;
    const entry = anchorSheet(reference.getRootNode());
    if (entry?.rules.delete(anchorName)) writeAnchorRules(entry);
    const rest = (reference.getAttribute(ANCHOR_ATTRIBUTE) || '').split(/\s+/u).filter((name) => name && name !== anchorName);
    if (rest.length) reference.setAttribute(ANCHOR_ATTRIBUTE, rest.join(' '));
    else reference.removeAttribute(ANCHOR_ATTRIBUTE);
    anchorName = '';
  };

  // The script: SF.Position.anchor(), which writes data-sf-side itself; the
  // arrow is read after each placement.
  const startScript = () => {
    controller.engine = 'script';
    script = Position.anchor(reference, floating, {
      ...settings,
      onPosition: (position) => {
        controller.side = position.side;
        writeArrow(Position.referenceRect(reference), floating.getBoundingClientRect());
        settings.onPosition?.({...position, engine: 'script'});
      },
    });
    controller.update = () => script.update();
  };

  // CSS: the browser places it; each run writes the area again (idempotent)
  // and reads where it went -- the side, the arrow, and whether it stayed in
  // the window. If not, the script takes over for the rest of this anchoring.
  const runCss = () => {
    if (controller.stopped || controller.engine !== 'css') return;
    const rtl = getComputedStyle(reference).direction === 'rtl';
    // The gap and the window's padding are written as the lengths they were
    // given (var(--sf-space-…) follows a density change at once, with no
    // resize and no reopen); only the width cap needs a number.
    const length = (value) => (typeof value === 'number' ? `${value}px` : String(value || 0));
    const gap = length(settings.offset);
    const padding = length(settings.padding);
    const placement = mirroredPlacement(Position.physicalPlacement(settings.side, settings.align, rtl), rtl);
    const {side, area, fallbacks, centred, across} = cssArea(placement);
    holdAnchorName();
    const insets = {top: padding, right: padding, bottom: padding, left: padding};
    insets[OPPOSITE[side]] = '0px';
    if (!centred) {
      if (across) insets[placement.endsWith('-start') ? 'left' : 'right'] = '0px';
      else insets[placement.endsWith('-start') ? 'top' : 'bottom'] = '0px';
    }
    style.position = 'fixed';
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      style.setProperty(edge, insets[edge]);
      style.setProperty(`margin-${edge}`, edge === OPPOSITE[side] ? gap : '0px');
    }
    style.setProperty('position-anchor', anchorName);
    style.setProperty('position-area', area);
    style.setProperty('position-try-fallbacks', fallbacks);
    if (centred) style.setProperty(across ? 'justify-self' : 'align-self', 'anchor-center');
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const room = `max(0px, ${width}px - 2 * ${padding})`;
    style.maxWidth = Number.isFinite(controller.widthCap) ? `min(${controller.widthCap}px, ${room})` : room;
    const box = Position.referenceRect(reference);
    const panel = floating.getBoundingClientRect();
    const out = panel.left < -0.5 || panel.top < -0.5 || panel.right > width + 0.5 || panel.bottom > height + 0.5;
    const visible = box.bottom > 0 && box.top < height && box.right > 0 && box.left < width;
    if (out && visible) {
      // No area of the four keeps it in the window: Floating UI shifts it.
      cleanup?.();
      cleanup = null;
      restore(CSS_WRITTEN);
      releaseAnchorName();
      startScript();
      return;
    }
    const physical = measuredSide(box, panel);
    controller.side = Position.logicalSide(physical, rtl);
    floating.dataset.sfSide = controller.side;
    writeArrow(box, panel);
    settings.onPosition?.({side: controller.side, placement: physical, x: panel.left, y: panel.top, engine: 'css'});
  };

  controller.stop = () => {
    controller.stopped = true;
    cleanup?.();
    script?.stop();
    releaseAnchorName();
    delete floating.dataset.sfSide;
    restore([...CSS_WRITTEN, ...ARROW_WRITTEN]);
  };

  if (controller.engine === 'css') {
    // The author's width cap, read before anything is written inline.
    const cap = parseFloat(getComputedStyle(floating).maxWidth);
    controller.widthCap = Number.isFinite(cap) && !String(getComputedStyle(floating).maxWidth).endsWith('%') ? cap : Infinity;
    controller.update = () => { runCss(); return Promise.resolve(null); };
    // The browser moves the panel with its anchor; this only re-reads the side
    // and the arrow on a scroll, a resize or a size change.
    const unwatch = watch(reference, floating, runCss);
    const view = reference.ownerDocument.defaultView;
    const restyled = typeof view.MutationObserver === 'function'
      ? new view.MutationObserver(() => { if (!controller.stopped && controller.engine === 'css') holdAnchorName(); }) : null;
    restyled?.observe(reference, {attributes: true, attributeFilter: [ANCHOR_ATTRIBUTE]});
    cleanup = () => { restyled?.disconnect(); unwatch(); };
  } else {
    startScript();
  }
  return controller;
}
