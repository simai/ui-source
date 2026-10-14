// sf-resizer: a handle on the edge of a panel that changes its width by a
// drag, the keyboard or a double click back to the default (owner,
// 2026-10-14: the admin menu's columns are widened and narrowed by their
// edges). It is a separator in the accessibility sense -- role="separator",
// focusable, its value the width in pixels between min and max -- and it owns
// nothing but the width it writes: on its target (its parent, or the closest
// ancestor matching `target`), as a custom property when `property` names one,
// otherwise as inline-size. With `storage-key` the width is remembered in this
// browser and restored the next time.
import {attachResizer, setResizerValue} from './engine.mjs';
import BundledPreferences from '../../core/js/preferences.js';
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

// The width is a view preference (SF.Preferences, owner 2026-10-14): kept in
// this browser, and for the person when the host keeps preferences.
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;
const preferenceKey = (key) => `sf-resizer/${String(key).replace(/[^\w.:-]+/gu, '-')}`;

function readStored(key) {
  if (!key) return null;
  const kept = preferences()?.read(preferenceKey(key));
  if (Number.isFinite(kept?.width)) return kept.width;
  // A width this browser kept before the standard, taken over once.
  try {
    const legacy = Number(globalThis.localStorage?.getItem(`sf-resizer:${key}`)) || null;
    if (legacy) {
      preferences()?.write(preferenceKey(key), {v: 1, width: legacy});
      globalThis.localStorage?.removeItem(`sf-resizer:${key}`);
    }
    return legacy;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  if (!key) return;
  if (value === null) preferences()?.remove(preferenceKey(key));
  else preferences()?.write(preferenceKey(key), {v: 1, width: Math.round(value)});
}

export class SfResizer extends HTMLElement {
  static get observedAttributes() { return ['min', 'max', 'label', 'disabled', 'value']; }

  constructor() {
    super();
    this._onWindowResize = () => this.clampToLimits();
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.syncLabel();
    // The gesture is the shared one (attachResizer): the element only says
    // what the width is the width of and where it is kept.
    this._detach = attachResizer(this, {session: () => (this.disabled ? null : this.session())});
    globalThis.addEventListener('resize', this._onWindowResize);
    // Restored after the target has laid out, so a percentage limit is read
    // against a real width.
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const target = this.target();
      if (target && getComputedStyle(target).position === 'static') target.style.position = 'relative';
      // A width the host keeps for the person (value) wins over this
      // browser's memory of it.
      const kept = Number(this.getAttribute('value')) || readStored(this.storageKey);
      if (kept) this.apply(kept);
      this.syncValue();
    });
  }

  disconnectedCallback() {
    this._detach?.();
    this._detach = null;
    globalThis.removeEventListener('resize', this._onWindowResize);
  }

  attributeChangedCallback(name, before, after) {
    if (name === 'value' && after && after !== before && this.isConnected) {
      this.restore(after);
      return;
    }
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

  session() {
    return {
      measure: () => this.width(),
      limits: () => this.limits(),
      apply: (width, phase) => {
        const written = this.apply(width);
        if (phase === 'move' && written !== null) this.announce(written, 'move');
        return written;
      },
      commit: (width) => this.commit(width),
      reset: () => this.reset(),
      // A handle on the inline end widens the panel rightwards in a
      // left-to-right page; on the start, leftwards.
      direction: () => {
        const rtl = getComputedStyle(this).direction === 'rtl';
        return (rtl ? -1 : 1) * (this.getAttribute('edge') === 'inline-start' ? -1 : 1);
      },
      step: this.step,
    };
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

  // A width the host keeps (a person's settings): written as if dragged,
  // within the limits, and remembered as the browser's too.
  restore(width) {
    const number = Number(width);
    if (!Number.isFinite(number) || number <= 0) return null;
    const written = this.apply(number);
    if (written !== null) writeStored(this.storageKey, written);
    return written;
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
    setResizerValue(this, {limits: () => this.limits(), measure: () => width}, width);
  }
}

if (!customElements.get('sf-resizer')) customElements.define('sf-resizer', SfResizer);

globalThis.SF = globalThis.SF || {};
// attach: the same gesture on any handle -- a table's column edges use it.
globalThis.SF.Resizer = Object.freeze({SfResizer, attach: attachResizer, attachResizer});
