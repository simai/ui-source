// sf-resizer: a handle on the edge of a panel that changes its width by a
// drag, the keyboard or a double click back to the default (owner,
// 2026-10-14: the admin menu's columns are widened and narrowed by their
// edges). It is a separator in the accessibility sense -- role="separator",
// focusable, its value the width in pixels between min and max -- and it owns
// nothing but the width it writes: on its target (its parent, or the closest
// ancestor matching `target`), as a custom property when `property` names one,
// otherwise as inline-size. With `storage-key` the width is remembered in this
// browser and restored the next time. With `collapsible` the panel folds to
// its edge and comes back (owner decision C158 (2)).
import {attachResizer, setResizerValue} from './engine.mjs';
import {language, pageWord} from '../../core/js/page-language';
import {elementFromManifest} from '../../core/js/element-manifest';
import {installAliases} from '../../core/js/aliases.js';
import BundledPreferences from '../../core/js/preferences.js';
import manifest from './component.json';
import aliases from './aliases.json';
import enFile from './lang/en.json';
import ruFile from './lang/ru.json';
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};
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

// The kept width, and whether the panel was folded (C158 (2)): {v: 1, width,
// folded}; width is the width it comes back to.
function readFolded(key) {
  if (!key) return false;
  return preferences()?.read(preferenceKey(key))?.folded === true;
}

function readStored(key) {
  if (!key) return null;
  const kept = preferences()?.read(preferenceKey(key));
  if (Number.isFinite(kept?.width) && kept.width > 0) return kept.width;
  if (kept) return null;
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

function writeStored(key, value, folded = false) {
  if (!key) return;
  if (value === null && !folded) preferences()?.remove(preferenceKey(key));
  else if (folded) preferences()?.write(preferenceKey(key), {v: 1, width: value ? Math.round(value) : 0, folded: true});
  else preferences()?.write(preferenceKey(key), {v: 1, width: Math.round(value)});
}

// The words of the value (aria-valuetext): «27 %», or folded (C158 (3)).
const valueWords = (dictionary) => (share, folded, handle) => pageWord(dictionary, folded ? 'folded' : 'value', handle, {component: 'sf-resizer', source: 'ru', count: share});

// The panel the handle folds is said folded by data-folded (the name the
// study's prototype gives it); the «Показать» button that brings it back
// stands on its edge (data-sf-resizer-unfold), and below the layout's split
// step the handle is not there (data-sf-resizer-narrow, C158 (4)).
const FOLDED = 'data-folded';
const UNFOLD = 'data-sf-resizer-unfold';
const NARROW = 'data-sf-resizer-narrow';
// The layout split step: h0 of the size scale (40rem) of the container, the
// step .sf-workspace stacks its regions at.
const SPLIT_STEP = 'var(--sf-h0)';
let panelIds = 0;

// The place a panel's columns stand in, whose width the split step reads
// (C158 (4) on the columns' wrapper, DEV GB5 answers 2026-11-15): the panel's
// parent, unless that box only wraps the columns and takes its width from
// them -- an item of a flex row that does not grow, an inline box or a float
// (two resizable columns in one wrapper, as an admin menu's) -- then the box
// it stands in, and so on up. A container (container-type) is a place of its
// own. Two columns side by side on a wide page keep their handles; a narrow
// place, or a phone, hides them.
function columnsPlace(parent) {
  let box = parent;
  while (box.parentElement && box.parentElement !== box.ownerDocument.documentElement) {
    const style = getComputedStyle(box);
    if (style.containerType && style.containerType !== 'normal') break;
    const outer = getComputedStyle(box.parentElement);
    const flexRow = /flex/u.test(outer.display) && !/column/u.test(outer.flexDirection);
    // An inline-level box (inline-block, -flex, -grid) is as wide as its content.
    const wraps = style.display.startsWith('inline-') || style.float !== 'none'
      || (flexRow && Number(style.flexGrow) === 0 && style.position !== 'absolute' && style.position !== 'fixed');
    if (!wraps) break;
    box = box.parentElement;
  }
  return box;
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
  static get observedAttributes() { return ['min', 'max', 'label', 'disabled', 'value', 'collapsible']; }

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
    this._detach = attachResizer(this, {
      session: () => (this.disabled || this._narrow ? null : this.session()),
      text: valueWords(ResizerElement.sfWords),
    });
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
    // A host's value of 0 is a folded panel (C158 (3): 0 is folded); so is
    // a fold this browser kept.
    const value = this.getAttribute('value');
    this._wanted = Number(value) || readStored(this.storageKey) || null;
    this._folded = this.collapsible && (value === '0' || (value === null && readFolded(this.storageKey)));
    this._restore = this._wanted;
    // A panel that folds shows the «Показать» button on its edge: its code is
    // asked for when a pointer or the keyboard reaches the handle, before it
    // can fold, so the button draws whole the first time; a page that never
    // folds a panel never loads it.
    const warm = () => this.warmUnfold();
    this.addEventListener('pointerenter', warm, {once: true, signal: this.sfScope});
    this.addEventListener('focusin', warm, {once: true, signal: this.sfScope});
    if (this.target()) {
      this.control();
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
    this.narrowCheck();
    if (!this._dragging) this.fit();
    this.showFold();
    this.place();
  }

  warmUnfold() {
    if (this.collapsible) globalThis.SF?.Loader?.ensure?.(['sf-button-icon']);
  }

  // The panel the handle controls (aria-controls, C158 (3)): by its id; a
  // panel without one is named by element reference where the browser has
  // it (ariaControlsElements), so the page's markup gets no made-up id, and
  // is given an id where it does not.
  control() {
    const target = this.target();
    if (!target) return;
    if (target.id) {
      this.setAttribute('aria-controls', target.id);
      return;
    }
    if ('ariaControlsElements' in this) {
      this.removeAttribute('aria-controls');
      this.ariaControlsElements = [target];
      return;
    }
    target.id = `sf-resizer-panel-${++panelIds}`;
    this.setAttribute('aria-controls', target.id);
  }

  // Below the layout's split step (40rem of the container, C158 (4)) the
  // handle is not there: the layout shows one panel at a time, and the width
  // the person chose waits for a wide screen. A region of .sf-workspace says
  // its layout itself (--sf-workspace--layout); any other panel is measured
  // against the width of its place (columnsPlace): the columns' wrapper,
  // never the page (C181 (2), DEV GB5 answers).
  narrowCheck() {
    const target = this.target();
    let narrow = false;
    if (target?.parentElement) {
      const parent = target.parentElement;
      const layout = parent.classList.contains('sf-workspace')
        ? getComputedStyle(target).getPropertyValue('--sf-workspace--layout').trim()
        : '';
      if (layout) narrow = layout === 'narrow';
      else {
        const place = columnsPlace(parent);
        if (place !== this._place) {
          this._place = place;
          if (place !== parent) this._observer?.observe(place);
        }
        const width = place.getBoundingClientRect().width;
        const step = pixels(SPLIT_STEP, place) ?? 0;
        narrow = width > 0 && width < step;
      }
    }
    if (narrow === Boolean(this._narrow)) return;
    this._narrow = narrow;
    this.toggleAttribute(NARROW, narrow);
  }

  // A folded panel: data-folded on it, its width written 0, the «Показать»
  // button on its edge. Below the split step the panel shows as the layout
  // places it (folding is a wide screen's), and folds again when it widens.
  showFold() {
    const target = this.target();
    if (!target) return;
    const folded = Boolean(this._folded && this.collapsible && !this._narrow);
    if (folded) {
      this.warmUnfold();
      this.unfoldButton();
      target.setAttribute(FOLDED, '');
      if (this.property) target.style.setProperty(this.property, '0px');
      else target.style.inlineSize = '0px';
    } else if (target.hasAttribute(FOLDED)) {
      target.removeAttribute(FOLDED);
      this.unwrite(target);
      if (this._wanted) this.apply(this._wanted);
    }
  }

  // The «Показать» button on the folded panel's edge (C158 (2)), made the
  // first time the panel folds: an sf-button-icon in a holder of its own in
  // the panel (the holder stays where the button may redraw itself), shown
  // only while the panel is folded. The glyph shows the side the panel opens
  // from.
  unfoldButton() {
    const target = this.target();
    if (!target) return null;
    let holder = this._unfold;
    if (!holder || holder.parentElement !== target) {
      holder?.remove();
      holder = document.createElement('span');
      holder.setAttribute(UNFOLD, '');
      holder.addEventListener('click', (event) => {
        if (!event.target?.closest?.('button, sf-button-icon')) return;
        event.stopPropagation();
        this.fold(false, 'end');
        this.focus({preventScroll: true});
      });
      target.append(holder);
      this._unfold = holder;
    }
    const rtl = getComputedStyle(this).direction === 'rtl';
    const startEdge = this.getAttribute('edge') === 'inline-start';
    // A panel whose edge is on its right stands on the left of the page.
    const icon = rtl === startEdge ? 'left_panel_open' : 'right_panel_open';
    const word = this.sfWord('show');
    const key = `${icon} ${word}`;
    if (holder.__sfKey !== key) {
      holder.__sfKey = key;
      const button = document.createElement('sf-button-icon');
      button.setAttribute('size', '1/2');
      button.setAttribute('appearance', 'ghost');
      button.setAttribute('scheme', 'on-surface');
      button.setAttribute('icon', icon);
      button.setAttribute('aria-label', word);
      button.setAttribute('title', word);
      holder.replaceChildren(button);
    }
    return holder;
  }

  // Folds the panel to its edge (on) or gives back the width it had (off).
  // phase move: during a drag, said as move and not kept; end: kept and said.
  fold(on, phase = 'end') {
    if (!this.collapsible || this.disabled) return;
    const target = this.target();
    if (!target) return;
    if (on && !this._folded) {
      // A drag that folds gives back the width it started from, not the min
      // it passed on the way.
      const {min} = this.limits();
      const width = Math.max(min, Math.round(phase === 'move' && this._dragFrom ? this._dragFrom : this.width()) || 0);
      this._restore = width;
      this._folded = true;
      this.showFold();
      this.syncValue(0);
      this.announce(0, phase === 'move' ? 'move' : 'end');
    } else if (!on && this._folded) {
      this._folded = false;
      const back = this._restore || this._wanted;
      target.removeAttribute(FOLDED);
      if (back) this.apply(back);
      else this.unwrite(target);
      const width = Math.round(this.width());
      this.syncValue(width);
      this.announce(width, phase === 'move' ? 'move' : 'end');
      if (phase !== 'move') {
        this._wanted = back || null;
        if (back) writeStored(this.storageKey, back);
        else writeStored(this.storageKey, null);
      }
      return;
    } else if (on && phase !== 'move') this.announce(0, 'end');
    if (on && phase !== 'move') writeStored(this.storageKey, this._restore, true);
  }

  folded() {
    return Boolean(this._folded && this.collapsible && !this._narrow);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._detach?.();
    this._detach = null;
    this._languageOff?.();
    this._languageOff = null;
    this._observer?.disconnect();
    this._observer = null;
    this._place = null;
    globalThis.removeEventListener('resize', this._onWindowResize);
    document.removeEventListener?.('scroll', this._onScroll, {capture: true});
  }

  attributeChangedCallback(name, before, after) {
    if (name === 'value' && after === '0' && after !== before && this.isConnected && this.collapsible) {
      this.fold(true, 'move');
      return;
    }
    if (name === 'value' && after && after !== before && this.isConnected) {
      if (this._folded) {
        this._folded = false;
        this.target()?.removeAttribute(FOLDED);
      }
      this.restore(after);
      return;
    }
    if (name === 'collapsible' && this.isConnected) {
      this.schedule();
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
    const fold = this.collapsible
      ? {fold: (on, phase) => this.fold(on, phase), folded: () => this.folded()}
      : {};
    return {
      ...fold,
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
      start: () => {
        this._dragging = true;
        this._dragFrom = this.folded() ? 0 : Math.round(this.width());
      },
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
    // The default width is an open panel.
    this._folded = false;
    this._restore = null;
    target.removeAttribute(FOLDED);
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
    if (this.folded()) return;
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
    if (this._unfold) this.unfoldButton();
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
    setResizerValue(this, {limits: () => this.limits(), measure: () => width, folded: () => this.folded()}, width, valueWords(ResizerElement.sfWords));
  }
}

if (!customElements.get('sf-resizer')) customElements.define('sf-resizer', SfResizer);

globalThis.SF = globalThis.SF || {};
// attach: the same gesture on any handle -- a table's column edges use it.
// Their value says its words in the page's language, as the handle's does,
// unless the caller gives its own text().
const attach = (root, options = {}) => attachResizer(root, {text: valueWords(ResizerElement.sfWords), ...options});
globalThis.SF.Resizer = Object.freeze({SfResizer, attach, attachResizer: attach});
