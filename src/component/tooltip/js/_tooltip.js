
import registerComponent from '../../register-helper';
import BundledPosition from '../../../core/js/position.js';

// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;
const ARROW_CLASS = /(?:^|\s)sf-tooltip--arrow-([a-z-]+)/;
// The arrow names the tooltip side: a bottom arrow points down at the trigger,
// so the tooltip sits above it. Flipping swaps to the mirrored arrow.
const ARROW_FLIP = {
  'bottom-center': 'top-center', 'top-center': 'bottom-center',
  'bottom-inline-start': 'top-inline-start', 'top-inline-start': 'bottom-inline-start',
  'bottom-inline-end': 'top-inline-end', 'top-inline-end': 'bottom-inline-end',
  'inline-start': 'inline-end', 'inline-end': 'inline-start',
  'bottom-left': 'top-left', 'top-left': 'bottom-left',
  'bottom-right': 'top-right', 'top-right': 'bottom-right',
  left: 'right', right: 'left',
};

function arrowPlacement(arrow, rtl) {
  const start = rtl ? 'end' : 'start';
  const end = rtl ? 'start' : 'end';
  switch (arrow) {
    case 'bottom-center': return {side: 'block-start', align: 'center'};
    case 'top-center': return {side: 'block-end', align: 'center'};
    case 'bottom-inline-start': return {side: 'block-start', align: 'start'};
    case 'bottom-inline-end': return {side: 'block-start', align: 'end'};
    case 'top-inline-start': return {side: 'block-end', align: 'start'};
    case 'top-inline-end': return {side: 'block-end', align: 'end'};
    case 'inline-end': return {side: 'inline-start', align: 'center'};
    case 'inline-start': return {side: 'inline-end', align: 'center'};
    // Legacy physical arrows keep their visual side in either direction.
    case 'bottom-left': return {side: 'block-start', align: start};
    case 'bottom-right': return {side: 'block-start', align: end};
    case 'top-left': return {side: 'block-end', align: start};
    case 'top-right': return {side: 'block-end', align: end};
    case 'left': return {side: rtl ? 'inline-start' : 'inline-end', align: 'center'};
    case 'right': return {side: rtl ? 'inline-end' : 'inline-start', align: 'center'};
    default: return {side: 'block-end', align: 'center'};
  }
}

const tooltipInstances = new WeakMap();
const TRIGGER_SELECTOR = '[data-tooltip]';
const SURFACE_SELECTOR = '.sf-tooltip, sf-tooltip';
let tooltipId = 0;

function descriptionTokens(trigger) {
  return (trigger.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean);
}

class SfTooltipController {
  static componentName = 'Tooltip';

  constructor(trigger) {
    this.trigger = trigger;
    this.anchor = trigger?.closest?.('.sf-tooltip-anchor') || null;
    this.surface = null;
    this.pointerInside = false;
    this.focusInside = false;
    this.dismissed = false;
    this.originalDescription = null;
    this.originalRole = null;
    this.originalHidden = false;
    this.onPointerEnter = this.handlePointerEnter.bind(this);
    this.onPointerLeave = this.handlePointerLeave.bind(this);
    this.onFocusIn = this.handleFocusIn.bind(this);
    this.onFocusOut = this.handleFocusOut.bind(this);
    this.onDocumentKeydown = this.handleDocumentKeydown.bind(this);
  }

  resolveSurface() {
    const reference = this.trigger?.getAttribute?.('data-tooltip')?.trim();
    if (reference) {
      const candidate = this.trigger.ownerDocument.getElementById(reference);
      return candidate?.matches?.(SURFACE_SELECTOR) ? candidate : null;
    }

    if (!this.anchor) return null;
    return [...this.anchor.children].find(
      (child) => child !== this.trigger && child.matches?.(SURFACE_SELECTOR),
    ) || null;
  }

  init() {
    if (!this.trigger || tooltipInstances.has(this.trigger)) return;

    this.surface = this.resolveSurface();
    if (!this.surface) return;

    if (!this.surface.id) {
      tooltipId += 1;
      this.surface.id = `sf-tooltip-${tooltipId}`;
    }

    this.originalDescription = this.trigger.getAttribute('aria-describedby');
    this.originalRole = this.surface.getAttribute('role');
    this.originalHidden = this.surface.hidden;

    const descriptions = new Set(descriptionTokens(this.trigger));
    descriptions.add(this.surface.id);
    this.trigger.setAttribute('aria-describedby', [...descriptions].join(' '));
    this.trigger.setAttribute('data-tooltip', this.surface.id);
    this.surface.setAttribute('role', 'tooltip');
    this.surface.hidden = true;
    this.surface.classList.remove('active');

    const pointerRoot = this.anchor || this.trigger;
    pointerRoot.addEventListener('pointerenter', this.onPointerEnter);
    pointerRoot.addEventListener('pointerleave', this.onPointerLeave);
    this.trigger.addEventListener('focusin', this.onFocusIn);
    this.trigger.addEventListener('focusout', this.onFocusOut);
    tooltipInstances.set(this.trigger, this);
  }

  destroy() {
    if (!this.trigger || !this.surface) return;
    this.stopPosition();

    const pointerRoot = this.anchor || this.trigger;
    pointerRoot.removeEventListener('pointerenter', this.onPointerEnter);
    pointerRoot.removeEventListener('pointerleave', this.onPointerLeave);
    this.trigger.removeEventListener('focusin', this.onFocusIn);
    this.trigger.removeEventListener('focusout', this.onFocusOut);
    this.trigger.ownerDocument.removeEventListener(
      'keydown',
      this.onDocumentKeydown,
    );

    if (this.originalDescription === null) {
      this.trigger.removeAttribute('aria-describedby');
    } else {
      this.trigger.setAttribute('aria-describedby', this.originalDescription);
    }
    if (this.originalRole === null) {
      this.surface.removeAttribute('role');
    } else {
      this.surface.setAttribute('role', this.originalRole);
    }
    this.surface.hidden = this.originalHidden;
    this.surface.classList.remove('active');
    tooltipInstances.delete(this.trigger);
  }

  handlePointerEnter(event) {
    if (event.pointerType === 'touch') return;
    this.pointerInside = true;
    if (!this.dismissed) this.open();
  }

  handlePointerLeave() {
    this.pointerInside = false;
    if (!this.focusInside) {
      this.dismissed = false;
      this.close();
    }
  }

  handleFocusIn() {
    this.focusInside = true;
    if (!this.dismissed) this.open();
  }

  handleFocusOut() {
    Promise.resolve().then(() => {
      this.focusInside = this.anchor
        ? this.anchor.contains(this.trigger.ownerDocument.activeElement)
        : this.trigger === this.trigger.ownerDocument.activeElement;
      if (!this.focusInside && !this.pointerInside) {
        this.dismissed = false;
        this.close();
      }
    });
  }

  handleDocumentKeydown(event) {
    if (event.key !== 'Escape' || this.surface?.hidden) return;
    this.dismissed = true;
    this.close();
  }

  open() {
    if (!this.surface || !this.surface.hidden) return;
    this.surface.hidden = false;
    this.surface.classList.add('active');
    this.startPosition();
    this.trigger.ownerDocument.addEventListener(
      'keydown',
      this.onDocumentKeydown,
    );
  }

  // Shared Framework geometry (SF.Position): the arrow chooses the side, the
  // tooltip flips (with a mirrored arrow) and shifts inside the viewport.
  startPosition() {
    this.stopPosition();
    const reference = this.anchor || this.trigger;
    // A Smart <sf-tooltip> host has no box of its own (display: contents); the
    // rendered .sf-tooltip inside it is what gets positioned.
    const box = this.surface.localName === 'sf-tooltip'
      ? this.surface.querySelector('.sf-tooltip')
      : this.surface;
    if (!box) return;
    const tail = box.matches('[class*="sf-tooltip--arrow-"]')
      ? box
      : box.querySelector('[class*="sf-tooltip--arrow-"]');
    const arrow = tail?.className.match(ARROW_CLASS)?.[1] || 'none';
    const rtl = getComputedStyle(reference).direction === 'rtl';
    const {side, align} = arrowPlacement(arrow, rtl);
    const offset = arrow === 'none'
      ? 'var(--sf-space-1\\/4)'
      : positioning().resolveLength('var(--sf-tooltip-tail-half)', tail);
    const translate = [box.style.getPropertyValue('translate'), box.style.getPropertyPriority('translate')];
    const tailNode = tail?.querySelector('.sf-tooltip-tail') || null;
    const tailTranslate = tailNode ? [tailNode.style.getPropertyValue('translate'), tailNode.style.getPropertyPriority('translate')] : null;
    // The static layout centres with translate; anchored coordinates are exact.
    box.style.translate = 'none';
    let shown = arrow;
    const anchor = positioning().anchor(reference, box, {
      side, align, offset, fitHeight: false,
      onPosition: ({side: actual}) => {
        if (!tail || arrow === 'none') return;
        const next = actual === side ? arrow : (ARROW_FLIP[arrow] || arrow);
        if (next !== shown) {
          tail.classList.replace(`sf-tooltip--arrow-${shown}`, `sf-tooltip--arrow-${next}`);
          shown = next;
        }
        // A shifted tooltip keeps its tail on the trigger: centred tails move by
        // the shift, limited so they stay clear of the rounded corners.
        if (!tailNode || !/center|^inline-|^left$|^right$/.test(shown)) return;
        const target = reference.getBoundingClientRect();
        const own = box.getBoundingClientRect();
        const vertical = actual === 'block-start' || actual === 'block-end';
        const corner = positioning().resolveLength('var(--sf-tooltip-tail-corner-offset)', tail);
        const limit = Math.max(0, (vertical ? own.width : own.height) / 2 - corner);
        const delta = vertical
          ? (target.left + target.width / 2) - (own.left + own.width / 2)
          : (target.top + target.height / 2) - (own.top + own.height / 2);
        const move = Math.max(-limit, Math.min(limit, delta));
        tailNode.style.translate = vertical ? `${move}px 0` : `0 ${move}px`;
      },
    });
    this.position = {anchor, box, tail, tailNode, tailTranslate, arrow, translate, shown: () => shown};
  }

  stopPosition() {
    if (!this.position) return;
    const {anchor, box, tail, tailNode, tailTranslate, arrow, translate} = this.position;
    anchor.stop();
    if (tailNode) {
      if (tailTranslate[0]) tailNode.style.setProperty('translate', tailTranslate[0], tailTranslate[1]);
      else tailNode.style.removeProperty('translate');
    }
    const shown = this.position.shown();
    if (tail && shown !== arrow) tail.classList.replace(`sf-tooltip--arrow-${shown}`, `sf-tooltip--arrow-${arrow}`);
    if (translate[0]) box.style.setProperty('translate', translate[0], translate[1]);
    else box.style.removeProperty('translate');
    this.position = null;
  }

  close() {
    if (!this.surface) return;
    this.stopPosition();
    this.surface.hidden = true;
    this.surface.classList.remove('active');
    this.trigger.ownerDocument.removeEventListener(
      'keydown',
      this.onDocumentKeydown,
    );
  }
}

function initTooltipTriggers(root = document) {
  if (!root?.querySelectorAll) return;

  if (root.matches?.(TRIGGER_SELECTOR)) {
    new SfTooltipController(root).init();
  }
  root.querySelectorAll(TRIGGER_SELECTOR).forEach((trigger) => {
    if (!tooltipInstances.has(trigger)) {
      new SfTooltipController(trigger).init();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTooltipTriggers(), {
    once: true,
  });
} else {
  initTooltipTriggers();
}

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    let retryDocument = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        initTooltipTriggers(node);
        if (node.matches?.(SURFACE_SELECTOR)
          || node.querySelector?.(SURFACE_SELECTOR)) {
          retryDocument = true;
        }
      });
    });

    if (retryDocument) initTooltipTriggers();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

registerComponent('Tooltip', SfTooltipController);

export default SfTooltipController;
