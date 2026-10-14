// sf-resizer: a handle on the edge of a panel that changes its width by a
// drag, the keyboard or a double click back to the default (owner,
// 2026-10-14: the admin menu's columns are widened and narrowed by their
// edges). It is a separator in the accessibility sense -- role="separator",
// focusable, its value the width in pixels between min and max -- and it owns
// nothing but the width it writes: on its target (its parent, or the closest
// ancestor matching `target`), as a custom property when `property` names one,
// otherwise as inline-size. With `storage-key` the width is remembered in this
// browser and restored the next time.
import './scss/index.scss';

const TEXT = {
  en: {label: 'Resize', hint: 'Drag, or use the arrow keys; a double click restores the width.'},
  ru: {label: 'Изменить ширину', hint: 'Тяните или нажимайте стрелки; двойной щелчок возвращает ширину.'},
};

function pageLanguage(element) {
  const lang = (element.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  return TEXT[lang] ? lang : 'en';
}

// A CSS length (tokens included) in pixels, read in the target's context.
function pixels(value, context) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;block-size:0;padding:0;border:0';
  probe.style.inlineSize = String(value);
  (context?.isConnected ? context : document.body).append(probe);
  const width = parseFloat(getComputedStyle(probe).width);
  probe.remove();
  return Number.isFinite(width) ? width : null;
}

function readStored(key) {
  try { return key ? Number(globalThis.localStorage?.getItem(`sf-resizer:${key}`)) || null : null; } catch { return null; }
}

function writeStored(key, value) {
  try {
    if (!key) return;
    if (value === null) globalThis.localStorage?.removeItem(`sf-resizer:${key}`);
    else globalThis.localStorage?.setItem(`sf-resizer:${key}`, String(Math.round(value)));
  } catch { /* a private window keeps no width; the drag still works */ }
}

export class SfResizer extends HTMLElement {
  static get observedAttributes() { return ['min', 'max', 'label', 'disabled']; }

  constructor() {
    super();
    this._onPointerDown = (event) => this.pointerDown(event);
    this._onKeyDown = (event) => this.keyDown(event);
    this._onDoubleClick = () => this.reset();
    this._onWindowResize = () => this.clampToLimits();
  }

  connectedCallback() {
    this.setAttribute('role', 'separator');
    this.setAttribute('aria-orientation', 'vertical');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.syncLabel();
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('dblclick', this._onDoubleClick);
    globalThis.addEventListener('resize', this._onWindowResize);
    // Restored after the target has laid out, so a percentage limit is read
    // against a real width.
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const target = this.target();
      if (target && getComputedStyle(target).position === 'static') target.style.position = 'relative';
      const stored = readStored(this.storageKey);
      if (stored) this.apply(stored);
      this.syncValue();
    });
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('dblclick', this._onDoubleClick);
    globalThis.removeEventListener('resize', this._onWindowResize);
    this.endDrag(false);
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.syncLabel();
      this.syncValue();
    }
  }

  get storageKey() { return this.getAttribute('storage-key') || ''; }
  get property() { return this.getAttribute('property') || ''; }
  get step() { return Math.max(1, Number(this.getAttribute('step')) || 16); }
  get disabled() { return this.hasAttribute('disabled'); }

  target() {
    const selector = this.getAttribute('target');
    return (selector ? this.parentElement?.closest(selector) : this.parentElement) ?? null;
  }

  limits() {
    const context = this.target()?.parentElement ?? document.body;
    const min = pixels(this.getAttribute('min') || '12rem', context) ?? 0;
    const max = pixels(this.getAttribute('max') || '40rem', context) ?? Infinity;
    return {min, max: Math.max(min, max)};
  }

  width() {
    return this.target()?.getBoundingClientRect().width ?? 0;
  }

  // The direction a pointer moving right widens the panel: a handle on the
  // inline end widens it rightwards in a left-to-right page.
  direction() {
    const rtl = getComputedStyle(this).direction === 'rtl';
    const start = this.getAttribute('edge') === 'inline-start';
    return (rtl ? -1 : 1) * (start ? -1 : 1);
  }

  apply(value) {
    const target = this.target();
    if (!target) return null;
    const {min, max} = this.limits();
    const width = Math.round(Math.min(max, Math.max(min, value)));
    if (this.property) target.style.setProperty(this.property, `${width}px`);
    else target.style.inlineSize = `${width}px`;
    this.syncValue(width);
    return width;
  }

  announce(width, phase) {
    this.dispatchEvent(new CustomEvent('sf-resize', {bubbles: true, composed: true, detail: {width, phase}}));
  }

  commit(width) {
    writeStored(this.storageKey, width);
    this.announce(width, 'end');
  }

  // Back to the width the page's stylesheet gives, and forgotten.
  reset() {
    if (this.disabled) return;
    const target = this.target();
    if (!target) return;
    if (this.property) target.style.removeProperty(this.property);
    else target.style.removeProperty('inline-size');
    writeStored(this.storageKey, null);
    requestAnimationFrame(() => {
      const width = Math.round(this.width());
      this.syncValue(width);
      this.announce(width, 'reset');
    });
  }

  // A window narrowed under a remembered width brings it back within limits.
  clampToLimits() {
    const target = this.target();
    if (!target) return;
    const written = this.property ? target.style.getPropertyValue(this.property) : target.style.inlineSize;
    if (!written) return;
    const {min, max} = this.limits();
    const now = this.width();
    if (now > max || now < min) this.apply(now);
  }

  pointerDown(event) {
    if (this.disabled || event.button > 0) return;
    event.preventDefault();
    this.focus({preventScroll: true});
    this._drag = {pointer: event.pointerId, x: event.clientX, from: this.width(), width: this.width()};
    this.setPointerCapture?.(event.pointerId);
    this.dataset.sfResizing = '';
    document.documentElement.setAttribute('data-sf-resizer-active', '');
    const move = (next) => {
      if (!this._drag || next.pointerId !== this._drag.pointer) return;
      const width = this.apply(this._drag.from + (next.clientX - this._drag.x) * this.direction());
      if (width !== null && width !== this._drag.width) {
        this._drag.width = width;
        this.announce(width, 'move');
      }
    };
    const up = (next) => {
      if (!this._drag || next.pointerId !== this._drag.pointer) return;
      this.endDrag(true);
    };
    this._drag.listeners = {move, up};
    this.addEventListener('pointermove', move);
    this.addEventListener('pointerup', up);
    this.addEventListener('pointercancel', up);
  }

  endDrag(commit) {
    const drag = this._drag;
    if (!drag) return;
    this._drag = null;
    this.removeEventListener('pointermove', drag.listeners?.move);
    this.removeEventListener('pointerup', drag.listeners?.up);
    this.removeEventListener('pointercancel', drag.listeners?.up);
    delete this.dataset.sfResizing;
    document.documentElement.removeAttribute('data-sf-resizer-active');
    if (commit && Math.round(drag.width) !== Math.round(drag.from)) this.commit(drag.width);
  }

  keyDown(event) {
    if (this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const {min, max} = this.limits();
    const now = this.width();
    const rtl = getComputedStyle(this).direction === 'rtl';
    const wider = (rtl ? 'ArrowLeft' : 'ArrowRight');
    const narrower = (rtl ? 'ArrowRight' : 'ArrowLeft');
    const step = this.step * (event.shiftKey ? 4 : 1);
    const sign = this.getAttribute('edge') === 'inline-start' ? -1 : 1;
    let next = null;
    if (event.key === wider) next = now + step * sign;
    else if (event.key === narrower) next = now - step * sign;
    else if (event.key === 'PageUp') next = now + step * 4;
    else if (event.key === 'PageDown') next = now - step * 4;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.reset(); return; }
    if (next === null) return;
    event.preventDefault();
    const width = this.apply(next);
    if (width !== null) this.commit(width);
  }

  syncLabel() {
    const text = TEXT[pageLanguage(this)];
    if (!this.getAttribute('aria-label') || this._ownLabel) {
      this.setAttribute('aria-label', this.getAttribute('label') || text.label);
      this._ownLabel = true;
    }
    this.title = this.getAttribute('label') ? `${this.getAttribute('label')}. ${text.hint}` : text.hint;
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  syncValue(width = this.width()) {
    const {min, max} = this.limits();
    this.setAttribute('aria-valuemin', String(Math.round(min)));
    this.setAttribute('aria-valuemax', String(Math.round(max)));
    if (width) this.setAttribute('aria-valuenow', String(Math.round(width)));
  }
}

if (!customElements.get('sf-resizer')) customElements.define('sf-resizer', SfResizer);

globalThis.SF = globalThis.SF || {};
globalThis.SF.Resizer = Object.freeze({SfResizer});
