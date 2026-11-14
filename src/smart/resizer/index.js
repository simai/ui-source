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
import {language} from '../../core/js/page-language';
import {elementFromManifest} from '../../core/js/element-manifest';
import {installAliases} from '../../core/js/aliases.js';
import BundledPreferences from '../../core/js/preferences.js';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The words are lang/<locale>.json, read through the shared reader, so
// SF.language.use() chooses the language and SF.language.register('sf-resizer',
// ...) adds one the Framework has never heard of (ui-mail feedback
// ui-mail.resizer-language, 2026-10-21; standard 1.3.8 §11).

// The handle draws nothing, so it is no Smart renderer: a plain element with
// the instance's scope (standard 1.3.8 §7.7) and its dated aliases (§16.20).
class ResizerHost extends HTMLElement {
  get sfScope() {
    if (!this.__sfScope || this.__sfScope.signal.aborted) this.__sfScope = new AbortController();
    return this.__sfScope.signal;
  }

  connectedCallback() {
    if (this.constructor.aliases && !this.__sfAliases) {
      this.__sfAliases = installAliases(this, this.constructor.aliases, {tag: this.localName, signal: this.sfScope});
    }
  }

  disconnectedCallback() {
    // Removed and not placed again before the next task: the scope ends.
    setTimeout(() => {
      if (this.isConnected) return;
      this.__sfScope?.abort();
      this.__sfAliases = null;
    }, 0);
  }
}

// From its component.json: settings are attributes and properties made by
// core/js/element-manifest.js; sf-resize is a dated alias of sf-resizer-resize.
const ResizerElement = elementFromManifest(manifest, {base: ResizerHost, lang: {en, ru}, source: 'ru', aliases});

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

// The handle placed outside a target that clips: absolute (against an
// ancestor) or fixed (against the viewport); the measured place it is given.
const OUTSIDE = 'data-sf-resizer-outside';
const PLACE = ['--sf-resizer--x', '--sf-resizer--y', '--sf-resizer--h'];
// The overflow values that clip (all but the initial one); named so, the
// template-utility reader takes no class from an overflow value.
const CLIPPING = new Set(['hidden', 'clip', 'auto', 'scroll']);

// The widest the target may be and leave the content beside it at least
// `reserve` (min) wide: the target's width plus the widest such sibling's,
// less the reserve. The content beside is an in-flow sibling on the same row
// that gives way when the target widens -- in a flex row one that may shrink
// or grow; a column of fixed width (the admin menu's second column, flex
// 0 0 auto) is another panel, not content. Infinity when nothing stands beside
// it (a stacked layout, an absolute drawer, panels only).
function roomBeside(target, reserve) {
  const parent = target.parentElement;
  if (!parent) return Infinity;
  const own = getComputedStyle(target).position;
  if (own === 'absolute' || own === 'fixed') return Infinity;
  const box = target.getBoundingClientRect();
  if (!box.width && !box.height) return Infinity;
  const flex = getComputedStyle(parent).display.includes('flex');
  let widest = -1;
  for (const sibling of parent.children) {
    if (sibling === target) continue;
    const style = getComputedStyle(sibling);
    if (style.display === 'none' || style.display === 'contents' || style.position === 'absolute' || style.position === 'fixed') continue;
    if (flex && !(Number.parseFloat(style.flexShrink) > 0 || Number.parseFloat(style.flexGrow) > 0)) continue;
    const other = sibling.getBoundingClientRect();
    if (!other.width || !other.height) continue;
    if (other.top >= box.bottom || other.bottom <= box.top) continue;
    widest = Math.max(widest, other.width);
  }
  return widest < 0 ? Infinity : box.width + widest - reserve;
}

export class SfResizer extends ResizerElement {
  static get observedAttributes() { return ['min', 'max', 'label', 'disabled', 'value']; }

  constructor() {
    super();
    this._onWindowResize = () => this.schedule();
    // An element that scrolls and holds the target moves the target's edge;
    // a handle placed outside the target's clip follows it.
    this._onScroll = (event) => {
      if (!this.hasAttribute(OUTSIDE)) return;
      const target = this.target();
      if (event.target !== target && (event.target === document || event.target?.contains?.(target))) this.schedule();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    // The handle is a Tab stop of its own making; a disabled one is none
    // (syncLabel), and a tabindex the page wrote stays the page's.
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
      this._ownTabIndex = true;
    }
    this.syncLabel();
    // The gesture is the shared one (attachResizer): the element only says
    // what the width is the width of and where it is kept.
    this._detach = attachResizer(this, {session: () => (this.disabled ? null : this.session())});
    globalThis.addEventListener('resize', this._onWindowResize);
    document.addEventListener?.('scroll', this._onScroll, {capture: true, passive: true});
    // A language announced after the handle drew itself -- SF.language.use(),
    // or a word registered for it -- renames it where it stands. A Lit
    // component gets this from smart-base; this one is an ordinary element, so
    // it listens for itself, as the anchored badges do.
    this._languageOff = language.onChange(() => {
      if (this.isConnected) this.syncLabel();
    });
    // A width the host keeps for the person (value) wins over this
    // browser's memory of it. It is written now, while the element connects,
    // so the frame that first draws the handle draws the panel at that width:
    // written a frame later, the remembered 288 landed ~52 ms after a first
    // paint of 256 (study RS-8, 2026-11-14). Reading a limit forces the
    // layout it needs, so a percentage limit is still read against a real
    // width.
    this._wanted = Number(this.getAttribute('value')) || readStored(this.storageKey) || null;
    if (this.target()) {
      this.layout();
      this.syncValue();
    }
    // The panel and its container may still be growing (a parser that has
    // not reached the content beside it, a sheet on its way): the layout is
    // read again when they change size, and once more in the next frame.
    if (globalThis.ResizeObserver) {
      this._observer = new ResizeObserver(() => this.schedule());
      const target = this.target();
      if (target) this._observer.observe(target);
      if (target?.parentElement) this._observer.observe(target.parentElement);
    }
    this.schedule();
  }

  // One layout pass per frame, whatever asked for it.
  schedule() {
    if (this._scheduled) return;
    this._scheduled = true;
    requestAnimationFrame(() => {
      this._scheduled = false;
      if (this.isConnected) this.layout();
    });
  }

  // The width within its limits (fit), then the handle on the target's edge
  // (place).
  layout() {
    if (!this._dragging) this.fit();
    this.place();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._detach?.();
    this._detach = null;
    this._languageOff?.();
    this._languageOff = null;
    this._observer?.disconnect();
    this._observer = null;
    globalThis.removeEventListener('resize', this._onWindowResize);
    document.removeEventListener?.('scroll', this._onScroll, {capture: true});
  }

  attributeChangedCallback(name, before, after) {
    if (name === 'value' && after && after !== before && this.isConnected) {
      this.restore(after);
      return;
    }
    if (this.isConnected) {
      this.syncLabel();
      this.syncValue();
      // New limits fit the width again.
      if (name === 'min' || name === 'max') this.schedule();
    }
  }

  get step() { return Math.max(1, Number(this.getAttribute('step')) || 16); }
  set step(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('step');
    else this.setAttribute('step', String(value));
  }

  // The panel it resizes: its parent, or the closest ancestor matching the
  // setting target. The method keeps the property name it has had since 1.0.0.
  target() {
    const selector = this.getAttribute('target');
    return (selector ? this.parentElement?.closest(selector) : this.parentElement) ?? null;
  }

  // min and max as the page wrote them, in pixels; max also stops where the
  // content beside the panel would be left narrower than min (room), so the
  // handle never takes the content's width: on a 390 phone a 14rem menu left
  // its text 116 px (study RS-9, 2026-11-14).
  limits() {
    const target = this.target();
    const context = target?.parentElement ?? document.body;
    const min = pixels(this.getAttribute('min') || '12rem', context) ?? 0;
    const max = pixels(this.getAttribute('max') || '40rem', context) ?? Infinity;
    const room = target ? roomBeside(target, min) : Infinity;
    return {min, max: Math.max(min, Math.min(max, room)), room};
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
      // A drag owns the width while it lasts: a layout pass does not fit it.
      start: () => { this._dragging = true; },
      end: () => {
        this._dragging = false;
        this.schedule();
      },
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

  // resize {width, phase} (§8 own verb); sf-resize follows with the same detail.
  announce(width, phase) {
    this.sfEmit('resize', {width, phase});
  }

  commit(width) {
    this._wanted = width;
    this._fitted = false;
    this._pageWidth = '';
    writeStored(this.storageKey, width);
    this.announce(width, 'end');
  }

  // Back to the width the page's stylesheet gives, and forgotten.
  reset() {
    if (this.disabled) return;
    const target = this.target();
    if (!target) return;
    this._wanted = null;
    this._fitted = false;
    this._pageWidth = '';
    this.unwrite(target);
    writeStored(this.storageKey, null);
    requestAnimationFrame(() => {
      this.layout();
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
    this._wanted = number;
    this._fitted = false;
    this._pageWidth = '';
    const written = this.apply(number);
    if (written !== null) writeStored(this.storageKey, written);
    return written;
  }

  unwrite(target = this.target()) {
    if (!target) return;
    if (this.property) target.style.removeProperty(this.property);
    else target.style.removeProperty('inline-size');
  }

  written(target = this.target()) {
    if (!target) return '';
    return this.property ? target.style.getPropertyValue(this.property).trim() : target.style.inlineSize;
  }

  // The width within the limits as they are now. The width the person or the
  // host wants is written again, clamped: a narrowed window takes it in, a
  // widened one gives it back. Without one, the stylesheet's width stands
  // unless the content beside it would be left narrower than min; then the
  // panel is narrowed for as long as that lasts, and nothing is remembered.
  fit() {
    const target = this.target();
    if (!target) return;
    if (this._wanted) {
      this.apply(this._wanted);
      return;
    }
    // A narrowing of our own is undone first: what the page wrote, or
    // nothing, is the width the limits are measured against again.
    if (this._fitted) {
      if (this._pageWidth) {
        if (this.property) target.style.setProperty(this.property, this._pageWidth);
        else target.style.inlineSize = this._pageWidth;
      } else this.unwrite(target);
      this._fitted = false;
      this._pageWidth = '';
    }
    const written = this.written(target);
    const {min, max, room} = this.limits();
    if (written) {
      // A width the page wrote itself (a length, tokens included): the value
      // written is what is clamped, not the panel as measured: in a stacked
      // layout the panel is the window's width whatever is written, and
      // clamping that measurement wrote the maximum over the remembered width
      // (docs trial 4, 2026-10-15). Read in pixels: 16rem is 256, not 16.
      const value = pixels(written, target.parentElement);
      if (value === null || (value <= max + 0.5 && value >= min - 0.5)) return;
      this._pageWidth = written;
      this.apply(value);
      this._fitted = true;
      return;
    }
    if (room < Infinity && this.width() > Math.max(min, room) + 0.5) {
      this.apply(room);
      this._fitted = true;
    }
  }

  // The handle on the target's edge. A target that clips its overflow (an
  // .sf-workspace region scrolls, so does many a panel) cut a handle placed
  // inside it in half: 4 of its 8 px caught, and the panel gained a sideways
  // scroll (study RS-2, 2026-11-14). Such a handle stands outside the clip:
  // positioned against an ancestor of the target (the target is not made
  // relative), or against the viewport when the page positioned the target
  // itself, at the target's measured edge. The look is the same.
  place() {
    const target = this.target();
    if (!target) return;
    const style = getComputedStyle(target);
    const clips = CLIPPING.has(style.overflowX) || CLIPPING.has(style.overflowY);
    if (!clips) {
      if (this.hasAttribute(OUTSIDE)) {
        this.removeAttribute(OUTSIDE);
        for (const name of PLACE) this.style.removeProperty(name);
      }
      if (style.position === 'static') {
        target.style.position = 'relative';
        this._madeRelative = true;
      }
      return;
    }
    if (this._madeRelative) {
      target.style.removeProperty('position');
      this._madeRelative = false;
    }
    const mode = getComputedStyle(target).position === 'static' ? 'absolute' : 'fixed';
    if (this.getAttribute(OUTSIDE) !== mode) this.setAttribute(OUTSIDE, mode);
    const box = target.getBoundingClientRect();
    const own = this.getBoundingClientRect();
    const placed = getComputedStyle(this);
    // Where left: 0 / top: 0 stand: the containing block, wherever it is.
    const originX = own.left - (Number.parseFloat(placed.left) || 0);
    const originY = own.top - (Number.parseFloat(placed.top) || 0);
    const rtl = placed.direction === 'rtl';
    const startEdge = this.getAttribute('edge') === 'inline-start';
    const edge = rtl === startEdge ? box.right : box.left;
    this.style.setProperty('--sf-resizer--x', `${Math.round((edge - originX - own.width / 2) * 100) / 100}px`);
    this.style.setProperty('--sf-resizer--y', `${Math.round((box.top - originY) * 100) / 100}px`);
    this.style.setProperty('--sf-resizer--h', `${Math.round(box.height * 100) / 100}px`);
  }

  syncLabel() {
    const label = this.sfWord('label');
    const hint = this.sfWord('hint');
    if (!this.getAttribute('aria-label') || this._ownLabel) {
      this.setAttribute('aria-label', this.getAttribute('label') || label);
      this._ownLabel = true;
    }
    this.title = this.getAttribute('label') ? `${this.getAttribute('label')}. ${hint}` : hint;
    // A disabled handle says so and leaves the Tab order: it kept tabindex=0
    // and was a stop that did nothing (study RS-6, 2026-11-14). A tabindex
    // the page wrote is put back when the handle is enabled again.
    if (this.disabled) {
      this.setAttribute('aria-disabled', 'true');
      if (this._ownTabIndex) this.removeAttribute('tabindex');
      else if (this.hasAttribute('tabindex') && this._pageTabIndex === undefined) {
        this._pageTabIndex = this.getAttribute('tabindex');
        this.setAttribute('tabindex', '-1');
      }
    } else {
      this.removeAttribute('aria-disabled');
      if (this._pageTabIndex !== undefined) {
        this.setAttribute('tabindex', this._pageTabIndex);
        this._pageTabIndex = undefined;
      } else if (this._ownTabIndex && !this.hasAttribute('tabindex')) this.tabIndex = 0;
    }
  }

  syncValue(width = this.width()) {
    setResizerValue(this, {limits: () => this.limits(), measure: () => width}, width);
  }
}

if (!customElements.get('sf-resizer')) customElements.define('sf-resizer', SfResizer);

globalThis.SF = globalThis.SF || {};
// attach: the same gesture on any handle -- a table's column edges use it.
globalThis.SF.Resizer = Object.freeze({SfResizer, attach: attachResizer, attachResizer});
