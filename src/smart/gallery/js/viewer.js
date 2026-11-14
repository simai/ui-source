// The full-screen viewer of SIMAI Framework (owner decisions C150 (7), (8) and
// C149 (6)): one viewer per page for pictures, videos and PDF files, shared by
// sf-gallery, the page's data-sf-gallery links, sf-file-preview and any page
// code. It is sf-gallery's part, not a component of its own (C149 (6)), and
// its script API is SF.Gallery:
//
//   SF.Gallery.view(items, options) -> handle
//     items    a list of {src, type?, alt?, caption?, name?, meta?, width?,
//              height?, download?, open?}; a single item or a string (an
//              address) is a list of one. type is image (the default), video
//              or pdf; without it the address's extension or mime says.
//     options  {start = 1, opener, label, counter: 'slash' | 'words', loop,
//              zoom = true, labels: {previous, next}, onChange, onClose}
//     handle   {close(), goTo(n), next(), prev(), current, total, open}
//   SF.Gallery.close()
//
// start and current are one-based, as sf-gallery's current. Black in both
// themes (the pictures are judged on black); the bar «3 / 12» at its start,
// the actions at its end 8 apart, the arrows at the sides (none on a phone:
// swipe), the caption under the picture; ← → (mirrored right to left), Home,
// End, + and −, Escape; double click or double tap zooms to the picture's own
// pixels at that point and back, a drag pans, a pinch zooms on a phone; a
// swipe down closes. Closing gives the focus back to the opener: an element,
// or a function of the current one-based position that returns one.
//
// One copy per page: every bundle that imports this module asks the shared
// global first (memory: bundles each carry their own module copy), so a second
// copy never draws a second viewer.

import { html, nothing, render } from 'lit';
import { pageWord } from '../../../core/js/page-language.js';
import en from '../lang/en.json';
import ru from '../lang/ru.json';

const WORDS = { en: en.runtime || {}, ru: ru.runtime || {} };
const VIDEO = /\.(?:mp4|m4v|webm|ogv|ogg|mov)(?:[?#]|$)/iu;
const PDF = /\.pdf(?:[?#]|$)/iu;
// A move shorter than this is a press, not a swipe (CSS px).
const SLOP = 10;
// A horizontal swipe pages past this, a downward one closes past that.
const PAGE_SWIPE = 48;
const CLOSE_SWIPE = 96;
// Two taps this close in time and place are a double tap.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24;
// The zoom of a picture already shown at its own pixels or larger.
const MIN_ZOOM_STEP = 2;

function word(key, node, vars) {
  return pageWord(WORDS, key, node || globalThis.document?.documentElement, {
    component: 'sf-gallery', source: 'ru', vars,
  });
}

function kindOf(item) {
  const type = String(item.type || '').toLowerCase();
  if (type === 'image' || type === 'video' || type === 'pdf') return type;
  const mime = String(item.mime || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  const src = String(item.src || item.href || '');
  if (VIDEO.test(src)) return 'video';
  if (PDF.test(src)) return 'pdf';
  return 'image';
}

export function normalizeItems(items) {
  const list = Array.isArray(items) ? items : (items === undefined || items === null ? [] : [items]);
  return list.map((raw) => {
    const item = typeof raw === 'string' ? { src: raw } : { ...(raw || {}) };
    item.src = String(item.src || item.href || '');
    item.kind = kindOf(item);
    return item;
  }).filter((item) => item.src);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class Viewer {
  constructor() {
    this.items = [];
    this.index = 0;
    this.options = {};
    this.dialog = null;
    this.zoom = { scale: 1, x: 0, y: 0 };
    this.pointers = new Map();
    this.gesture = null;
    this.lastTap = null;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onClose = this._onClose.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  get open() {
    return Boolean(this.dialog?.open);
  }

  get current() {
    return this.items.length ? this.index + 1 : 0;
  }

  get total() {
    return this.items.length;
  }

  _ensureDialog() {
    if (this.dialog?.isConnected) return this.dialog;
    const dialog = document.createElement('dialog');
    dialog.className = 'sf-gallery-viewer sf-surface-media';
    dialog.setAttribute('data-sf-gallery-viewer', '');
    dialog.addEventListener('keydown', this._onKeyDown);
    dialog.addEventListener('close', this._onClose);
    dialog.addEventListener('cancel', this._onCancel);
    document.body.append(dialog);
    this.dialog = dialog;
    return dialog;
  }

  view(items, options = {}) {
    const list = normalizeItems(items);
    if (!list.length || typeof document === 'undefined') return null;
    const dialog = this._ensureDialog();
    const wasOpen = dialog.open;
    if (!wasOpen) {
      const active = document.activeElement;
      this.returnTo = options.opener ?? (active && active !== document.body ? active : null);
    } else if (options.opener) {
      this.returnTo = options.opener;
    }
    this.items = list;
    this.options = options;
    const start = Number.parseInt(String(options.start ?? 1), 10);
    this.index = clamp(Number.isFinite(start) ? start - 1 : 0, 0, list.length - 1);
    this._resetZoom();
    dialog.setAttribute('aria-label', options.label || word('viewer-label', this.returnTo));
    this._draw();
    if (!wasOpen) {
      dialog.showModal();
      // The close button takes the focus: the keys work from the first moment
      // and Enter or Space never pages by surprise.
      this._focusClose();
    }
    this._preload();
    return this.handle();
  }

  handle() {
    const viewer = this;
    return {
      close: () => viewer.close(),
      goTo: (n) => viewer.goTo(n),
      next: () => viewer.goTo(viewer.current + 1),
      prev: () => viewer.goTo(viewer.current - 1),
      get current() { return viewer.current; },
      get total() { return viewer.total; },
      get open() { return viewer.open; },
    };
  }

  _focusClose() {
    // sf-button-close's host draws no box (display: contents): the focus
    // goes to its button, which exists once the element has drawn.
    const close = this.dialog?.querySelector('[data-sf-gallery-viewer-close]');
    const button = () => close?.querySelector('button');
    const focus = () => (button() || close)?.focus?.({ preventScroll: true });
    const idle = () => document.activeElement === this.dialog || !this.dialog.contains(document.activeElement);
    focus();
    if (close && !button()) {
      customElements.whenDefined(close.localName).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this.open && idle()) focus();
      })));
    }
  }

  close() {
    if (!this.open) return false;
    this.dialog.close();
    return true;
  }

  goTo(n) {
    const total = this.items.length;
    if (!total || !this.open) return false;
    let next = Number.parseInt(String(n), 10) - 1;
    if (!Number.isFinite(next)) return false;
    if (this.options.loop) next = ((next % total) + total) % total;
    next = clamp(next, 0, total - 1);
    if (next === this.index) return false;
    const previous = this.index + 1;
    this.index = next;
    this._resetZoom();
    this._draw();
    this._preload();
    this.options.onChange?.({ current: next + 1, previous, total });
    return true;
  }

  _onCancel(event) {
    // Escape: a zoomed picture first goes back to the screen, then the viewer closes.
    if (this.zoom.scale > 1) {
      event.preventDefault();
      this._resetZoom();
      this._applyZoom();
    }
  }

  _onClose() {
    this.dialog?.querySelectorAll('video').forEach((video) => video.pause?.());
    const current = this.current;
    const target = typeof this.returnTo === 'function' ? this.returnTo(current) : this.returnTo;
    this.returnTo = null;
    this.pointers.clear();
    this.gesture = null;
    const onClose = this.options.onClose;
    this.options = { ...this.options, onClose: undefined, onChange: undefined };
    if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
    onClose?.({ current, total: this.items.length });
  }

  _rtl() {
    return getComputedStyle(this.dialog).direction === 'rtl';
  }

  _onKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    // A video's or a frame's own keys stay theirs.
    if (target?.closest?.('video, iframe, input, textarea, select')) return;
    const rtl = this._rtl();
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    if (step && this.zoom.scale > 1) {
      this._pan(-step * this._panStep(), 0);
    } else if (step) {
      this.goTo(this.current + step);
    } else if (event.key === 'ArrowUp' && this.zoom.scale > 1) {
      this._pan(0, this._panStep());
    } else if (event.key === 'ArrowDown' && this.zoom.scale > 1) {
      this._pan(0, -this._panStep());
    } else if (event.key === 'Home') {
      this.goTo(1);
    } else if (event.key === 'End') {
      this.goTo(this.items.length);
    } else if (event.key === '+' || event.key === '=') {
      this._zoomTo(true);
    } else if (event.key === '-' || event.key === '_') {
      this._zoomTo(false);
    } else {
      return;
    }
    event.preventDefault();
  }

  // ── zoom and pan ──
  _picture() {
    return this.dialog?.querySelector('.sf-gallery-viewer-media > img') || null;
  }

  _canZoom() {
    return this.options.zoom !== false && this.items[this.index]?.kind === 'image';
  }

  // The scale of the picture's own pixels, at least two steps.
  _fullScale(img) {
    const shown = img?.offsetWidth || 0;
    const own = img?.naturalWidth || Number(this.items[this.index]?.width) || 0;
    return Math.max(shown && own ? own / shown : 0, MIN_ZOOM_STEP);
  }

  _resetZoom() {
    this.zoom = { scale: 1, x: 0, y: 0 };
  }

  _limit() {
    const img = this._picture();
    const stage = this.dialog?.querySelector('.sf-gallery-viewer-stage');
    if (!img || !stage) return { x: 0, y: 0 };
    const { scale } = this.zoom;
    return {
      x: Math.max((img.offsetWidth * scale - stage.clientWidth) / 2, 0),
      y: Math.max((img.offsetHeight * scale - stage.clientHeight) / 2, 0),
    };
  }

  _applyZoom() {
    const img = this._picture();
    const stage = this.dialog?.querySelector('.sf-gallery-viewer-stage');
    if (!img || !stage) return;
    const limit = this._limit();
    this.zoom.x = clamp(this.zoom.x, -limit.x, limit.x);
    this.zoom.y = clamp(this.zoom.y, -limit.y, limit.y);
    const zoomed = this.zoom.scale > 1;
    stage.toggleAttribute('data-zoomed', zoomed);
    stage.style.setProperty('--sf-gallery-viewer--scale', String(this.zoom.scale));
    stage.style.setProperty('--sf-gallery-viewer--x', `${this.zoom.x}px`);
    stage.style.setProperty('--sf-gallery-viewer--y', `${this.zoom.y}px`);
    this._drawBar();
  }

  // At a point (client coordinates) or at the centre.
  _zoomTo(on, clientX, clientY) {
    if (!this._canZoom()) return;
    const img = this._picture();
    if (!img) return;
    if (!on) {
      this._resetZoom();
      this._applyZoom();
      return;
    }
    const scale = this._fullScale(img);
    // The picture's box at rest is centred in the media box, which never moves.
    const box = img.parentElement.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const px = clientX === undefined ? cx : clientX;
    const py = clientY === undefined ? cy : clientY;
    // The point under the pointer stays under it: (p - c)(1 - s).
    this.zoom = { scale, x: (px - cx) * (1 - scale), y: (py - cy) * (1 - scale) };
    this._applyZoom();
  }

  _panStep() {
    return (this._picture()?.offsetWidth || 0) / 8;
  }

  _pan(dx, dy) {
    this.zoom.x += dx;
    this.zoom.y += dy;
    this._applyZoom();
  }


  _onPointerDown(event) {
    if (event.target.closest?.('.sf-gallery-viewer-side, video, iframe')) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (this.pointers.size === 2 && this._canZoom()) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { pinch: true, distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: this.zoom.scale };
      return;
    }
    if (this.pointers.size === 1) {
      this.gesture = { x: event.clientX, y: event.clientY, zx: this.zoom.x, zy: this.zoom.y, onPicture: event.target.localName === 'img', moved: false };
    }
  }

  _onPointerMove(event) {
    if (!this.pointers.has(event.pointerId) || !this.gesture) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = this.gesture;
    if (gesture.pinch) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const img = this._picture();
      this.zoom.scale = clamp(gesture.scale * (distance / gesture.distance), 1, Math.max(this._fullScale(img), MIN_ZOOM_STEP));
      if (this.zoom.scale === 1) this.zoom.x = this.zoom.y = 0;
      this._applyZoom();
      return;
    }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > SLOP) gesture.moved = true;
    if (this.zoom.scale > 1) {
      this.zoom.x = gesture.zx + dx;
      this.zoom.y = gesture.zy + dy;
      this._applyZoom();
      return;
    }
    // Not zoomed: the picture follows a downward swipe a little, so the
    // close reads as a gesture.
    const stage = this.dialog.querySelector('.sf-gallery-viewer-stage');
    stage?.style.setProperty('--sf-gallery-viewer--drag', `${Math.max(dy, 0) / 2}px`);
  }

  _onPointerUp(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    const gesture = this.gesture;
    const stage = this.dialog?.querySelector('.sf-gallery-viewer-stage');
    stage?.style.removeProperty('--sf-gallery-viewer--drag');
    if (!gesture) return;
    if (gesture.pinch) {
      if (!this.pointers.size) this.gesture = null;
      return;
    }
    this.gesture = null;
    if (event.type === 'pointercancel') return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (this.zoom.scale > 1) {
      if (!gesture.moved) this._tap(event, gesture);
      return;
    }
    if (Math.abs(dx) > PAGE_SWIPE && Math.abs(dx) > Math.abs(dy)) {
      const forward = this._rtl() ? dx > 0 : dx < 0;
      this.goTo(this.current + (forward ? 1 : -1));
      return;
    }
    if (dy > CLOSE_SWIPE && dy > Math.abs(dx)) {
      this.close();
      return;
    }
    if (!gesture.moved) this._tap(event, gesture);
  }

  // A press: two presses on the picture close in time and place -- a double
  // click or a double tap, read from the pointer for both, since a touch also
  // fires the browser's dblclick -- zoom in and back; a press on the empty
  // field around the picture closes.
  _tap(event, gesture) {
    if (gesture.onPicture) {
      const last = this.lastTap;
      const now = event.timeStamp;
      if (last && now - last.time < DOUBLE_TAP_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_SLOP) {
        this.lastTap = null;
        this._zoomTo(this.zoom.scale === 1, event.clientX, event.clientY);
        return;
      }
      this.lastTap = { time: now, x: event.clientX, y: event.clientY };
      return;
    }
    // The empty field: the stage or the media box around the picture itself.
    if (!gesture.onPicture && this.zoom.scale === 1 && event.target.matches?.('.sf-gallery-viewer-stage, .sf-gallery-viewer-media')) {
      this.close();
    }
  }

  // ── drawing ──
  _preload() {
    [this.index - 1, this.index + 1].forEach((at) => {
      const item = this.items[at];
      if (item?.kind === 'image') {
        const picture = new Image();
        picture.decoding = 'async';
        picture.src = item.src;
      }
    });
  }

  _counter() {
    const vars = { n: this.current, total: this.items.length };
    return this.options.counter === 'words' ? word('viewer-count-words', this.returnTo, vars) : word('viewer-count', this.returnTo, vars);
  }

  _drawBar() {
    const bar = this.dialog?.querySelector('.sf-gallery-viewer-bar');
    if (!bar) return;
    const item = this.items[this.index] || {};
    const node = this.returnTo instanceof Node ? this.returnTo : undefined;
    const zoomed = this.zoom.scale > 1;
    const named = Boolean(item.name);
    const downloadName = typeof item.download === 'string' ? item.download : '';
    render(html`
      <div class="sf-gallery-viewer-title">
        ${named ? html`<span class="sf-gallery-viewer-name">${item.name}</span>` : nothing}
        <span class="sf-gallery-viewer-count" aria-live="polite">${item.meta ? `${item.meta} · ` : ''}${this._counter()}</span>
      </div>
      <div class="sf-gallery-viewer-actions">
        ${this._canZoom() ? html`<sf-button-icon class="sf-gallery-viewer-control" data-sf-gallery-viewer-zoom appearance="ghost" scheme="on-surface"
          icon=${zoomed ? 'zoom_out' : 'zoom_in'} aria-label=${word(zoomed ? 'viewer-zoom-out' : 'viewer-zoom-in', node)}
          @click=${() => this._zoomTo(!zoomed)}></sf-button-icon>` : nothing}
        ${item.download ? html`<sf-button-icon class="sf-gallery-viewer-control" data-sf-gallery-viewer-download appearance="ghost" scheme="on-surface"
          icon="download" href=${item.href || item.src} download=${downloadName}
          aria-label=${word('viewer-download', node, { name: item.name || downloadName || '' }).trim()}></sf-button-icon>` : nothing}
        ${item.open ? html`<sf-button-icon class="sf-gallery-viewer-control" data-sf-gallery-viewer-open appearance="ghost" scheme="on-surface"
          icon="open_in_new" href=${item.href || item.src} target="_blank" rel="noopener"
          aria-label=${word('viewer-open-tab', node)}></sf-button-icon>` : nothing}
        <sf-button-close class="sf-gallery-viewer-control" data-sf-gallery-viewer-close appearance="media" size="1"
          aria-label=${word('viewer-close', node)} @click=${() => this.close()}></sf-button-close>
      </div>
    `, bar);
  }

  _media(item) {
    if (item.kind === 'video') {
      return html`<video class="sf-gallery-viewer-video" src=${item.src} controls preload="metadata" playsinline
        aria-label=${item.alt || item.name || nothing}></video>`;
    }
    if (item.kind === 'pdf') {
      return html`<iframe class="sf-gallery-viewer-frame" src=${item.src} title=${item.name || item.alt || word('viewer-document', this.returnTo)}></iframe>`;
    }
    return html`<img src=${item.src} alt=${item.alt ?? ''} width=${item.width || nothing} height=${item.height || nothing}
      decoding="async" draggable="false">`;
  }

  _draw() {
    const dialog = this.dialog;
    if (!dialog) return;
    const item = this.items[this.index];
    const node = this.returnTo instanceof Node ? this.returnTo : undefined;
    const labels = this.options.labels || {};
    const many = this.items.length > 1;
    const loop = Boolean(this.options.loop);
    const first = !loop && this.index === 0;
    const last = !loop && this.index === this.items.length - 1;
    render(html`
      <div class="sf-gallery-viewer-bar"></div>
      <div class="sf-gallery-viewer-stage"
        @pointerdown=${this._onPointerDown} @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp} @pointercancel=${this._onPointerUp}>
        ${many ? html`<span class="sf-gallery-viewer-side sf-gallery-viewer-side--previous">
          <sf-button-icon class="sf-gallery-viewer-control" data-sf-gallery-viewer-previous appearance="ghost" scheme="on-surface" icon="chevron_left"
            ?disabled=${first} aria-label=${labels.previous || word('viewer-previous', node)}
            @click=${() => this.goTo(this.current - 1)}></sf-button-icon></span>` : nothing}
        <div class="sf-gallery-viewer-media" data-kind=${item.kind}>${this._media(item)}</div>
        ${many ? html`<span class="sf-gallery-viewer-side sf-gallery-viewer-side--next">
          <sf-button-icon class="sf-gallery-viewer-control" data-sf-gallery-viewer-next appearance="ghost" scheme="on-surface" icon="chevron_right"
            ?disabled=${last} aria-label=${labels.next || word('viewer-next', node)}
            @click=${() => this.goTo(this.current + 1)}></sf-button-icon></span>` : nothing}
      </div>
      <div class="sf-gallery-viewer-caption">${item.caption || ''}</div>
    `, dialog);
    this._drawBar();
    this._applyZoom();
  }
}

// The one viewer of the page, on the shared global.
export function installViewer() {
  const root = (globalThis.SF = globalThis.SF || {});
  if (root.Gallery?.view) return root.Gallery;
  const viewer = new Viewer();
  const api = {
    view: (items, options) => viewer.view(items, options),
    close: () => viewer.close(),
  };
  Object.defineProperty(api, 'current', { get: () => viewer.current, enumerable: true });
  Object.defineProperty(api, 'open', { get: () => viewer.open, enumerable: true });
  root.Gallery = api;
  return api;
}
