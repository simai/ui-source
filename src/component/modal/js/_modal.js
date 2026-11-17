import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
import { focusModalInitial, trapModalFocus, windowFields } from './_focus';
import { noteDeprecated } from '../../../core/js/deprecations.js';
import { breakpointMedia } from '../../../core/js/breakpoints.js';
import { inHandleRow, startsOnControl, trackSwipe } from '../../../core/js/sheet-swipe';
import { freezeModalContent } from './_closing';
import { scheduleModalClose, scheduleModalFrame } from './_motion';
import { createInlineSpinner } from '../../spinner/js/_spinner-draw';

// A box that holds its own overlays; a modal in it covers the box, not the
// viewport, and leaves the page scrollable (sf-modal and sf-drawer read the
// same attribute; the drawer's older name until 2026-12-01).
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';
import { getTopModalLayer, getModalLayerIndex, updateModalLayers, addModalLayer,
  removeModalLayer, raiseModalLayer, captureModalFocusAncestors, restoreModalLayerFocus,
  isTopModalLayer } from './_stack';
import { layerZIndexAt, lockPageScroll, openLayers } from '../../../core/js/layer-stack';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ').trim();
}

function normalizePosition(value = 'center') {
  const normalized = String(value || 'center')
    .trim()
    .toLowerCase();
  return [
    'center',
    'left',
    'right',
    'inline-start',
    'inline-end',
    'top',
    'bottom',
  ].includes(normalized)
    ? normalized
    : 'center';
}

// The window's size by name (owner decision C159 (1), followed by the class
// window under C224): question 28rem, form 36rem, wide 48rem, full the whole
// screen; no size, `auto` or anything else is a form, as on <sf-modal>.
const SIZES = ['question', 'form', 'wide', 'full'];

function normalizeSize(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SIZES.includes(normalized) ? normalized : 'form';
}

// A side window or a sheet is sf-drawer's (owner decision C157 (1)): these
// positions are its old names until this date, noted once per value, as
// <sf-modal> notes them.
const EDGE_POSITIONS = ['inline-start', 'inline-end', 'left', 'right', 'bottom'];
const OLD_NAMES_UNTIL = '2027-01-01';
const OLD_NAMES_SINCE = '2026-11-16';

function normalizeBlurType(value = 'medium') {
  const normalized = String(value || 'medium')
    .trim()
    .toLowerCase();
  return ['none', 'small', 'medium', 'large'].includes(normalized)
    ? normalized
    : 'medium';
}

function getBlurClass(type = 'medium') {
  return `backdrop-blur-${normalizeBlurType(type)}`;
}

function isBlurTypeValue(value) {
  return ['none', 'small', 'medium', 'large'].includes(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
}

function normalizeCssValue(value) {
  return String(value || '').trim();
}

function normalizeMode(value) {
  const normalized = String(value || 'inline')
    .trim()
    .toLowerCase();
  return ['inline', 'ajax', 'iframe'].includes(normalized)
    ? normalized
    : 'inline';
}

function normalizeDisplay(value) {
  const normalized = String(value || 'modal')
    .trim()
    .toLowerCase();
  return ['modal', 'inline'].includes(normalized) ? normalized : 'modal';
}

// An untitled window was headed and named «Modal» on every page; it takes the
// page language's word instead, as the Smart window does.
// The loading state and its failure speak the page's language too: they said
// "Loading..." and "Failed to load content" on every page (simai/ui-source#11
// follow-up). The words are sf-modal's, so one registration covers both.
const UNTITLED = LANG_WORDS;
// The node the words are looked up from: the modal once it is on the page,
// else the document, which is where a modal not yet attached will be.
const modalText = (key, node) => pageText(UNTITLED, key, node?.isConnected ? node : document.documentElement, 'sf-modal');
const untitled = (root) => pageText(UNTITLED, 'title', root, 'sf-modal');

class Modal extends ComponentObserver {
  static componentName = 'Modal';
  static registry = new Map();
  static globalBound = false;
  static stack = [];
  static openCount = 0;
  static uid = 0;
  static lockState = null;
  // Kept for code that reads it; the z-index comes from the core's one layer
  // scale (--sf-z-index-layer, default 9000).
  static baseZIndex = 9000;

  static getTopModal() {
    return getTopModalLayer();
  }

  // Whether this modal is the top layer of the document (layer-stack.js): a
  // drawer or a list opened from it stands above it.
  static isTopModal(modal) {
    return isTopModalLayer(modal);
  }

  static addToStack(modal) {
    if (!modal || modal.display === 'inline') {
      return;
    }

    Modal.stack = Modal.stack.filter((item) => item !== modal);
    Modal.stack.push(modal);
    Modal.openCount = Modal.stack.length;

    addModalLayer(modal);
  }

  static removeFromStack(modal) {
    if (!modal || modal.display === 'inline') {
      return;
    }

    Modal.stack = Modal.stack.filter((item) => item !== modal);
    Modal.openCount = Modal.stack.length;

    removeModalLayer(modal);
  }

  static bringToFront(modal) {
    if (!modal || modal.display === 'inline' || !Modal.stack.includes(modal)) {
      return;
    }

    Modal.stack = Modal.stack.filter((item) => item !== modal);
    Modal.stack.push(modal);
    raiseModalLayer(modal);
  }

  static updateStackStyles() {
    updateModalLayers();
  }

  constructor(props) {
    super(props);

    const params = this.params || {};
    this.modalId = this.id || params.id || `sf-modal-${++Modal.uid}`;
    this.isOpen = false;
    this.lastActive = null;
    this.root = params.root || null;
    // The box the modal covers: an element or a selector. Without one the
    // modal covers the viewport -- or, when it is opened from inside an
    // overlay container, that box (DEV, 2026-10-18).
    this.container = params.container || null;
    this.overlay = this.toBoolean(params.overlay, true);
    this.unclose = this.toBoolean(params.unclose, false);
    this.showClose = this.toBoolean(params.showClose, true) && !this.unclose;
    this.showFooter = this.toBoolean(params.showFooter, true);
    this.closeOnEsc = this.toBoolean(params.closeOnEsc, true) && !this.unclose;
    this.closeOnOverlay =
      this.toBoolean(params.closeOnOverlay, true) && !this.unclose;
    this.preserveScrollGap = this.toBoolean(params.preserveScrollGap, true);
    this.autoload = this.toBoolean(params.autoload, false);
    this.position = normalizePosition(params.position);
    this.size = normalizeSize(params.size);
    this.fullscreen = this.toBoolean(params.fullscreen, false);
    this.mode = normalizeMode(params.mode);
    this.display = normalizeDisplay(params.display);
    this.src = params.src || '';
    this.preload = this.toBoolean(params.preload, true);
    this._fetchController = null;
    this._contentLoaded = false;
    this._contentError = null;
    this._loadingTimer = null;
    this._loadingShown = false;
    this._loadingDebounceMs = 500;
    this.blur = isBlurTypeValue(params.blur)
      ? true
      : this.toBoolean(params.blur, false);
    this.hasCustomBlurType =
      isBlurTypeValue(params.blurType) || isBlurTypeValue(params.blur);
    this.blurType = normalizeBlurType(
      params.blurType || (isBlurTypeValue(params.blur) ? params.blur : ''),
    );
    // The scrim, as <sf-modal> draws it (C224): default, the shared black 64;
    // focus, the same with the small backdrop blur (C159 (7), C157 (6): one
    // scrim). `blur` -- true or a strength -- is the focus scrim: blur: true
    // laid the overlay surface with a 64 px blur and 'large' 8 px, weaker
    // than true (study Ok6). The strengths and blurType are old names until
    // 2027-01-01.
    this.overlayPreset = String(params.overlayPreset || '').trim().toLowerCase() === 'focus' || this.blur
      ? 'focus'
      : 'default';
    this.noteOldNames(params);

    this.onOverlayClick = this.onOverlayClick.bind(this);
    this.onSheetPointerDown = this.onSheetPointerDown.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this._modalState = 'closed';
    this._stackIndex = -1;
    this._closeTimer = null;
    this._closeTransitionAbort = null;

    this.template = this.buildTemplate(params);
    this.template.id = this.modalId;
    this.template.setAttribute('data-sf-modal-id', this.modalId);
    this.template.setAttribute('aria-hidden', 'true');
    this.init();
  }

  // The box given as `container`, or the overlay container `opener` stands in,
  // or the body.
  overlayHomeFor(opener = null) {
    let box = this.container;
    if (typeof box === 'string') box = document.querySelector(box);
    if (box instanceof Element) {
      if (!box.matches(OVERLAY_CONTAINER)) box.setAttribute('data-sf-overlay-container', '');
      return box;
    }
    const from = opener instanceof Element ? opener.closest(OVERLAY_CONTAINER) : null;
    return from || document.body;
  }

  get overlayHome() {
    return this.overlayHomeFor();
  }

  get inContainer() {
    return Boolean(this.template?.parentElement?.closest(OVERLAY_CONTAINER));
  }

  placeIn(home) {
    if (this.display === 'inline' || this.root || !this.template || !home) return;
    if (this.template.parentElement !== home) home.append(this.template);
  }

  emitEvent(eventName, { cancelable = false, detail = {} } = {}) {
    const payload = {
      modal: this,
      id: this.modalId,
      isOpen: this.isOpen,
      ...detail,
    };

    let prevented = false;

    if (this.template) {
      const event = new CustomEvent(eventName, {
        bubbles: true,
        cancelable,
        detail: payload,
      });
      this.template.dispatchEvent(event);
      prevented = prevented || event.defaultPrevented;
    }

    if (typeof window !== 'undefined') {
      const windowEvent = new CustomEvent(eventName, {
        cancelable: false,
        detail: payload,
      });
      window.dispatchEvent(windowEvent);
    }

    return !prevented;
  }

  runCallback(callbackName, payload = {}) {
    const handler = this.params?.[callbackName];
    if (typeof handler === 'function') {
      return handler({
        modal: this,
        id: this.modalId,
        isOpen: this.isOpen,
        ...payload,
      });
    }
    return undefined;
  }

  emitBeforeOpen() {
    const modernAllowed = this.emitEvent('modal:before-open', {
      cancelable: true,
      detail: { phase: 'before-open' },
    });
    const legacyAllowed = this.emitEvent('SFModalBeforeOpenWindow', {
      cancelable: true,
      detail: { phase: 'before-open' },
    });

    if (!modernAllowed || !legacyAllowed) {
      return false;
    }

    const beforeOpenResult = this.runCallback('beforeOpen', {
      phase: 'before-open',
    });
    const beforeOpenWindowResult = this.runCallback('beforeOpenWindow', {
      phase: 'before-open',
    });
    return beforeOpenResult !== false && beforeOpenWindowResult !== false;
  }

  emitAfterOpen() {
    this.emitEvent('modal:after-open', { detail: { phase: 'after-open' } });
    this.emitEvent('SFModalAfterOpenWindow', {
      detail: { phase: 'after-open' },
    });
    this.runCallback('afterOpen', { phase: 'after-open' });
    this.runCallback('afterOpenWindow', { phase: 'after-open' });
  }

  emitBeforeClose() {
    const modernAllowed = this.emitEvent('modal:before-close', {
      cancelable: true,
      detail: { phase: 'before-close' },
    });
    const legacyAllowed = this.emitEvent('SFModalBeforeCloseWindow', {
      cancelable: true,
      detail: { phase: 'before-close' },
    });

    if (!modernAllowed || !legacyAllowed) {
      return false;
    }

    const beforeCloseResult = this.runCallback('beforeClose', {
      phase: 'before-close',
    });
    const beforeCloseWindowResult = this.runCallback('beforeCloseWindow', {
      phase: 'before-close',
    });
    return beforeCloseResult !== false && beforeCloseWindowResult !== false;
  }

  emitAfterClose() {
    this.emitEvent('modal:after-close', { detail: { phase: 'after-close' } });
    this.emitEvent('SFModalAfterCloseWindow', {
      detail: { phase: 'after-close' },
    });
    this.runCallback('afterClose', { phase: 'after-close' });
    this.runCallback('afterCloseWindow', { phase: 'after-close' });
  }

  toBoolean(value, fallback) {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = `${value}`.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
    return fallback;
  }

  getBlurClasses() {
    return this.hasCustomBlurType ? [getBlurClass(this.blurType)] : [];
  }

  // The scrim's classes: the preset's marker, and the focus preset's small
  // blur (the Smart template's overlayClasses). Its colour is the sheet's
  // shared scrim (--sf-scrim-color), not a utility, so the window over
  // another lays none (C159 (7)).
  overlayClasses() {
    return joinClasses(
      `sf-modal-overlay--${this.overlayPreset}`,
      this.overlayPreset === 'focus' ? getBlurClass('small') : '',
    );
  }

  // The names the class window keeps for a while (SF.deprecations): a side
  // or bottom position (sf-drawer's, C157 (1)), and the blur strengths.
  noteOldNames(params = {}) {
    const dated = { tag: 'sf-modal', since: OLD_NAMES_SINCE, remove_after: OLD_NAMES_UNTIL };
    if (EDGE_POSITIONS.includes(this.position)) {
      noteDeprecated({
        component: 'modal', kind: 'value', attribute: 'position', from: this.position,
        to: this.position === 'bottom' ? 'sf-drawer placement="bottom"' : 'sf-drawer', ...dated,
      });
    }
    if (isBlurTypeValue(params.blur)) {
      noteDeprecated({ component: 'modal', kind: 'value', attribute: 'blur', from: String(params.blur).trim().toLowerCase(), to: "blur: true (overlayPreset: 'focus')", ...dated });
    }
    if (isBlurTypeValue(params.blurType)) {
      noteDeprecated({ component: 'modal', kind: 'value', attribute: 'blurType', from: String(params.blurType).trim().toLowerCase(), to: "overlayPreset: 'focus'", ...dated });
    }
  }

  // On a phone (below sm, owner decision C159 (2)) a window left at the
  // centre is a sheet at the bottom, the screen's width, its answers sharing
  // the row; a wide or full window and a form of more than three fields take
  // the whole screen. The class window stayed a card the width of its text
  // (332 of 390, study Ok2). The same rule as <sf-modal> (C224).
  get onPhone() {
    return this.display !== 'inline' && Boolean(this._phoneQuery?.matches);
  }

  contentFields() {
    const body = this.template?.querySelector('[data-sf-modal-body-scroll]');
    return body ? windowFields(body) : [];
  }

  get phoneFullScreen() {
    if (!this.onPhone || this.position !== 'center') return false;
    return this.size === 'wide' || this.size === 'full' || (this.size === 'form' && this.contentFields().length > 3);
  }

  get shownPosition() {
    if (this.position === 'center' && this.onPhone && !this.phoneFullScreen) return 'bottom';
    return this.position;
  }

  get shownFullscreen() {
    return Boolean(this.fullscreen) || this.size === 'full' || this.phoneFullScreen;
  }

  // Writes where the window stands now: its position (with the old misspelt
  // alias class) and whether it takes the whole screen.
  applyPlacement() {
    const root = this.template;
    if (!root) return;
    const position = this.display === 'inline' ? this.position : this.shownPosition;
    for (const name of [...root.classList]) {
      if (/^sf-modal--posit(?:i)?on-/.test(name)) root.classList.remove(name);
    }
    root.classList.add(`sf-modal--position-${position}`, `sf-modal--positon-${position}`);
    root.setAttribute('data-sf-modal-position', position);
    root.setAttribute('data-sf-modal-fullscreen', String(this.display === 'inline' ? this.fullscreen : this.shownFullscreen));
  }

  watchPhone() {
    if (this.display === 'inline' || this._phoneQuery) return;
    const query = breakpointMedia('sm', { below: true });
    if (!query) return;
    this._phoneQuery = query;
    this._onPhoneChange = () => this.applyPlacement();
    query.addEventListener?.('change', this._onPhoneChange);
  }

  // A window at the bottom is the one sheet (C157 (5)): a swipe down from its
  // handle row closes it as the x does. The class window drew the grab bar
  // and did not follow the finger.
  onSheetPointerDown(event) {
    if (event.button !== 0 || !this.isOpen || this.shownPosition !== 'bottom' || this.shownFullscreen) return;
    const surface = this.template?.querySelector('[data-sf-modal-surface]');
    const panel = this.template?.querySelector('[data-sf-modal-panel]');
    if (!surface || !panel || !surface.contains(event.target) || startsOnControl(event.target)) return;
    if (!inHandleRow(event, surface)) return;
    trackSwipe(event, {
      surface: panel,
      direction: 'down',
      variable: '--sf-sheet--drag',
      onEnd: ({ dismiss }) => {
        if (dismiss && !this.unclose) this.close();
      },
    });
  }

  setOverlay(nextValue) {
    this.overlay = this.toBoolean(nextValue, true);

    const overlay = this.template?.querySelector('[data-sf-modal-overlay]');
    if (!overlay) {
      return this;
    }

    overlay.classList.toggle('hidden', !this.overlay || this.display === 'inline');
    return this;
  }

  buildTemplate(params) {
    const isInline = this.display === 'inline';

    const root = document.createElement('div');
    // sf-modal--positon-* is the legacy misspelt alias of sf-modal--position-*,
    // written beside it until contracts/changes/journal.json removes it.
    root.className = isInline
      ? `sf-modal sf-modal--size-${this.size} sf-modal--inline sf-modal--position-${this.position} sf-modal--positon-${this.position} inline-block w-full`
      : `sf-modal sf-modal--size-${this.size} sf-modal--position-${this.position} sf-modal--positon-${this.position} hidden fixed top-0 inline-start-0 w-full h-full z-9 p-3 items-cross-center content-main-center`;
    root.setAttribute('role', isInline ? 'region' : 'dialog');
    root.setAttribute('aria-modal', isInline ? 'false' : 'true');
    root.setAttribute('data-sf-modal-position', this.position);
    root.setAttribute('data-sf-modal-size', this.size);
    root.setAttribute('data-sf-modal-fullscreen', String(this.fullscreen || this.size === 'full'));
    root.setAttribute('data-sf-modal-display', this.display);
    root.setAttribute('data-sf-modal-overlay-preset', this.overlayPreset);
    root.setAttribute('data-sf-modal-state', isInline ? 'inline' : 'closed');

    const overlay = document.createElement('div');
    overlay.className = joinClasses(
      'absolute top-0 inline-start-0 w-full h-full',
      this.overlayClasses(),
      params.overlayClass,
    );
    overlay.setAttribute('data-sf-modal-overlay', '');
    overlay.setAttribute('data-sf-modal-overlay-preset', this.overlayPreset);
    if (!this.overlay || isInline) {
      overlay.classList.add('hidden');
    }

    const panel = document.createElement('section');
    panel.className = joinClasses(
      'relative overflow-visible',
      params.panelClass,
    );
    panel.setAttribute('data-sf-modal-panel', '');

    const width = normalizeCssValue(params.width);
    const height = normalizeCssValue(params.height);

    if (width) {
      panel.style.setProperty('--sf-modal-width', width);
      panel.setAttribute('data-sf-modal-has-width', '');
    }

    if (height) {
      panel.style.setProperty('--sf-modal-height', height);
      panel.setAttribute('data-sf-modal-has-height', '');
    }

    // The window's frame is the question window's (decision C39; dispatcher
    // decision d, docs pre-check 2026-11-10): the frame -- since C105 a
    // window's inset, --sf-space-2 with the edge inside it, drawn by the
    // sheet (sf.base, so a surfaceClass padding utility still wins) -- the
    // title --sf-space-1 above the content, no line under the header, and the
    // close button on the frame's corner, the title centred on its line. The
    // frame was --sf-space-2 with a line under the header.
    // The surface is <sf-modal>'s (C224): the modal surface, and over the
    // page the elevated one -- the popup place with the modal shadow (C16,
    // C20). It was the bg-surface utility, in the dark theme 26·27·31 next
    // to a 15·17·21 page (study Ok4), and its frame variables were the Smart
    // surface's alone, so a side window lost its frame (Ok3).
    const surface = document.createElement('div');
    surface.className = joinClasses(
      'sf-modal-surface flex flex-col min-w-0',
      !isInline && 'sf-modal-surface--elevated',
      params.surfaceClass,
    );
    surface.setAttribute('data-sf-modal-surface', '');

    const header = document.createElement('header');
    header.className = joinClasses(
      'sf-modal-header flex items-start min-w-0 gap-1',
      params.headerClass,
    );

    if (Array.isArray(params.headerNodes) && params.headerNodes.length) {
      root.setAttribute('aria-label', params.title || untitled(root));
      params.headerNodes.forEach((node) => {
        if (node instanceof Node) {
          header.append(node);
        }
      });
    } else {
      const title = document.createElement('h2');
      title.id = `${this.modalId}-title`;
      root.setAttribute('aria-labelledby', title.id);
      title.className = 'sf-modal-header-content sf-modal-title m-0';
      title.textContent = params.title || untitled(root);

      header.append(title);

      if (this.showClose) {
        // The close button is sf-button-close's class markup (C14, C15), as
        // <sf-modal> draws it: it was the icon button's old link look.
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = joinClasses(
          // The close is sf-button-close, ghost (owner decision C14, RG-CL-3):
          // the class markup of the Smart window's header close.
          'sf-icon-button sf-icon-button--size-1/3 sf-icon-button--close sf-button-close sf-button-close--ghost sf-button-close--on-surface flex items-cross-center sf-modal-header-action sf-modal-close-button sf-modal-close-button--inline-end m-0',
          params.closeClass,
        );
        // The page language's word, as the Smart window has; the glyph inside is
        // decoration and carries no name of its own.
        closeButton.setAttribute('aria-label', pageText(UNTITLED, 'close', closeButton.isConnected ? closeButton : document.documentElement, 'sf-modal'));
        closeButton.setAttribute('data-sf-modal-close', this.modalId);
        closeButton.innerHTML = '            <span\n' +
            '              class="sf-close sf-close--size-1/3 flex content-main-center items-center pointer-events-none"\n' +
            '              aria-hidden="true"\n' +
            '            >\n' +
            '              <span class="sf-close-icon"></span>\n' +
            '            </span>';

        header.append(closeButton);
      }
    }

    const body = document.createElement('div');
    body.className =
      'sf-modal-body flex flex-col gap-1 min-w-0 overflow-visible';
    body.setAttribute('data-sf-modal-body', '');

    const bodyViewport = document.createElement('div');
    bodyViewport.className = 'sf-modal-body-viewport min-w-0 overflow-visible';
    bodyViewport.setAttribute('data-sf-modal-body-viewport', '');

    const bodyScroll = document.createElement('div');
    bodyScroll.className = joinClasses(
      'sf-modal-body-scroll h-full min-w-0 overflow-y-auto flex flex-col gap-1',
      params.bodyClass,
    );
    bodyScroll.setAttribute('data-sf-modal-body-scroll', '');

    // Placeholder для ajax-контента (loading/error)
    const contentPlaceholder = document.createElement('div');
    contentPlaceholder.className =
      'sf-modal-content-placeholder flex flex-col gap-2 min-h-8 items-cross-center content-main-center';
    contentPlaceholder.setAttribute('data-sf-modal-content-placeholder', '');

    if ((this.mode === 'ajax' || this.mode === 'iframe') && this.src) {
      // Ajax/iframe-режим: показываем loading с debounce, контент загрузится в init()
      this._scheduleLoading(contentPlaceholder);
      bodyScroll.append(contentPlaceholder);
    } else if (
      Array.isArray(params.contentNodes) &&
      params.contentNodes.length
    ) {
      const content = document.createElement('div');
      content.className = joinClasses(
        'sf-modal-content flex flex-col gap-2',
        params.contentClass,
      );
      params.contentNodes.forEach((node) => {
        if (node instanceof Node) {
          content.append(node);
        }
      });
      bodyScroll.append(content);
    }

    if (Array.isArray(params.footerNodes) && params.footerNodes.length && this.showFooter) {
      const footer = document.createElement('div');
      footer.className = joinClasses(
        'sf-modal-footer flex flex-wrap',
        params.footerClass,
      );
      params.footerNodes.forEach((node) => {
        if (node instanceof Node) {
          footer.append(node);
        }
      });
      body.append(footer);
    } else if (typeof params.html === 'string' && params.html.trim()) {
      bodyScroll.innerHTML = params.html;
    } else if (
      (this.mode === 'ajax' && this.src) ||
      (this.mode === 'iframe' && this.src)
    ) {
      // Для ajax/iframe-режима текст не показываем — там loading/error
    } else {
      const text = document.createElement('p');
      text.className = 'm-0 text-2';
      text.textContent = params.text || '';
      bodyScroll.append(text);
    }

    bodyViewport.append(bodyScroll);
    body.prepend(bodyViewport);
    surface.append(header, body);
    panel.append(surface);
    root.append(overlay, panel);
    return root;
  }

  // --- Ajax API ---

  _scheduleLoading(container) {
    this._cancelLoadingTimer();
    this._loadingShown = false;
    this._loadingTimer = setTimeout(() => {
      this._showLoading(container);
      this._loadingShown = true;
    }, this._loadingDebounceMs);
  }

  _cancelLoadingTimer() {
    if (this._loadingTimer) {
      clearTimeout(this._loadingTimer);
      this._loadingTimer = null;
    }
  }

  _finishLoading() {
    this._cancelLoadingTimer();
  }

  _showLoading(container) {
    container.innerHTML = '';
    const loading = document.createElement('div');
    loading.className =
      'sf-modal-loading flex flex-col gap-2 items-cross-center content-main-center p-4';
    loading.setAttribute('data-sf-modal-state', 'loading');
    const words = modalText('loading', this.template);
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-label', words);
    const text = document.createElement('p');
    text.className = 'm-0 text-2 color-on-surface-variant';
    text.textContent = words;
    loading.append(text);
    // The Framework's one spinner, in the page's look (simai/ui-source#11);
    // the modal sheet draws its slot.
    loading.prepend(createInlineSpinner({ className: 'sf-modal-spinner' }));
    container.append(loading);
  }

  _showError(container, message) {
    container.innerHTML = '';
    const error = document.createElement('div');
    error.className =
      'sf-modal-error flex flex-col gap-2 items-cross-center content-main-center p-4';
    error.setAttribute('data-sf-modal-state', 'error');
    error.innerHTML = `
      <div class="sf-modal-error-icon text-4 color-error">⚠</div>
      <p class="sf-modal-error-text m-0 text-2 color-error">${this.escapeHtml(message || modalText('loadFailed', this.template))}</p>
    `;
    container.append(error);
  }

  _abortFetch() {
    if (this._fetchController) {
      this._fetchController.abort();
      this._fetchController = null;
    }
  }

  async _loadContent() {
    if (!this.src) {
      return;
    }

    if (this.mode === 'iframe') {
      this._loadIframe();
      return;
    }

    if (this.mode === 'ajax') {
      this._loadAjax();
    }
  }

  async _loadAjax() {
    // Проверяем, является ли src DOM-селектором
    if (this.src.startsWith('#')) {
      const sourceEl = document.querySelector(this.src);
      if (sourceEl) {
        this._emitBeforeContentUpload();
        const cloned = sourceEl.cloneNode(true);
        cloned.removeAttribute('id');
        this._finishLoading();
        this._replaceContentWithNode(cloned);
        this._contentLoaded = true;
        this._emitAfterContentUpload();
      } else {
        this._contentError = `Element not found: ${this.src}`;
        this._finishLoading();
        this._showContentError();
      }
      return;
    }

    // Fetch по URL
    this._abortFetch();
    const controller = new AbortController();
    this._fetchController = controller;

    try {
      this._emitBeforeContentUpload();
      const response = await fetch(this.src, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      this._contentLoaded = true;
      this._finishLoading();
      this._replaceContentWithHtml(html);
      this._fetchController = null;
      this._emitAfterContentUpload();
    } catch (error) {
      if (error.name === 'AbortError') {
        // Aborted by a newer load (open() reloads what the constructor began
        // to preload): the loading state is that load's, and cancelling its
        // timer here meant a modal opened during the preload never showed it.
        if (!this._fetchController || this._fetchController === controller) {
          this._finishLoading();
        }
        return; // The load was cancelled: no error is shown
      }
      this._contentError = error.message;
      this._finishLoading();
      this._showContentError();
    }
  }

  _loadIframe() {
    this._emitBeforeContentUpload();
    const bodyScroll = this.template?.querySelector(
      '[data-sf-modal-body-scroll]',
    );
    if (!bodyScroll) {
      return;
    }

    // Удаляем предыдущий контент (включая placeholder)
    bodyScroll.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.className = 'sf-modal-iframe w-full border-0 radius-surface';
    iframe.src = this.src;
    iframe.setAttribute('data-sf-modal-iframe', '');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.minHeight = 'var(--sf-modal-iframe-min-height)';
    iframe.style.height = '100%';

    iframe.addEventListener('load', () => {
      this._contentLoaded = true;
      this._finishLoading();
      this._emitAfterContentUpload();
    });

    iframe.addEventListener('error', () => {
      this._contentError = modalText('frameFailed', this.template);
      this._finishLoading();
      this._showContentError();
    });

    bodyScroll.append(iframe);
  }

  _replaceContentWithNode(node) {
    const bodyScroll = this.template?.querySelector(
      '[data-sf-modal-body-scroll]',
    );
    if (!bodyScroll) {
      return;
    }

    bodyScroll.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'sf-modal-content flex flex-col gap-2';
    wrapper.append(node);
    bodyScroll.append(wrapper);
  }

  _replaceContentWithHtml(html) {
    const bodyScroll = this.template?.querySelector(
      '[data-sf-modal-body-scroll]',
    );
    if (!bodyScroll) {
      return;
    }

    bodyScroll.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'sf-modal-content flex flex-col gap-2';
    wrapper.innerHTML = html;
    bodyScroll.append(wrapper);
  }

  _showContentError() {
    const bodyScroll = this.template?.querySelector(
      '[data-sf-modal-body-scroll]',
    );
    if (!bodyScroll) {
      return;
    }

    bodyScroll.innerHTML = '';
    const error = document.createElement('div');
    error.className =
      'sf-modal-error flex flex-col gap-2 items-cross-center content-main-center p-4';
    error.setAttribute('data-sf-modal-state', 'error');
    error.innerHTML = `
      <div class="sf-modal-error-icon text-4 color-error">⚠</div>
      <p class="sf-modal-error-text m-0 text-2 color-error">${this.escapeHtml(this._contentError || modalText('loadFailed', this.template))}</p>
    `;
    bodyScroll.append(error);
  }

  _emitBeforeContentUpload() {
    this.emitEvent('modal:before-content-upload', {
      detail: { src: this.src },
    });
    this.runCallback('beforeContentUpload', { src: this.src });
  }

  _emitAfterContentUpload() {
    this.emitEvent('modal:after-content-upload', { detail: { src: this.src } });
    this.runCallback('afterContentUpload', { src: this.src });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  init() {
    // Inline mode — рендерим прямо в контейнер sf-modal, не переносим в body
    if (this.display === 'inline') {
      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'open');
      this.template.classList.remove('hidden');

      // Если open="false" — скрываем сразу
      if (!this.toBoolean(this.params?.open, true)) {
        this.isOpen = false;
        this._modalState = 'closed';
        this.template.setAttribute('data-sf-modal-state', 'closed');
        this.template.classList.add('hidden');
      } else {
        this.isOpen = true;
      }
      this.template.setAttribute('aria-hidden', String(!this.isOpen));

      if (this.root) {
        this.root.append(this.template);
      }
      Modal.registry.set(this.modalId, this);
      // Загружаем контент если нужно
      if (
        (this.mode === 'ajax' || this.mode === 'iframe') &&
        this.src &&
        this.preload !== false
      ) {
        this._loadContent();
      }
      return;
    }

    if (!this.template.isConnected) {
      this.overlayHome.append(this.template);
    }

    // Inline mode — не привязываем глобальные события, не добавляем в body
    if (this.display === 'inline') {
      this.isOpen = true;
      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'inline');
      this.template.classList.remove('hidden');
      Modal.registry.set(this.modalId, this);
      // Загружаем контент если нужно
      if (
        (this.mode === 'ajax' || this.mode === 'iframe') &&
        this.src &&
        this.preload !== false
      ) {
        this._loadContent();
      }
      return;
    }

    // Escape and Tab come through the document layer stack, to the top layer.
    this.template.addEventListener('click', this.onOverlayClick);
    this.template.addEventListener('pointerdown', this.onSheetPointerDown);
    this.watchPhone();
    this.applyPlacement();

    Modal.registry.set(this.modalId, this);
    Modal.bindGlobalEvents();

    const shouldOpen =
      this.toBoolean(this.params?.open, false) || this.autoload;
    if (shouldOpen) {
      requestAnimationFrame(() => {
        this.open({ animate: false });
      });
    }

    // Загружаем ajax/iframe-контент только если preload !== false
    if (
      (this.mode === 'ajax' || this.mode === 'iframe') &&
      this.src &&
      this.preload !== false
    ) {
      this._loadContent();
    }
  }

  destroyInternal() {
    this._abortFetch();
    this._cancelLoadingTimer();
    this.cancelCloseTransition();
    // Inline mode — не делаем finishClose
    if (this.display !== 'inline' && (this.isOpen || this._modalState === 'closing')) {
      this._modalState = 'closing';
      this.finishClose();
    }
    Modal.removeFromStack(this);
    this.template.removeEventListener('click', this.onOverlayClick);
    this.template.removeEventListener('pointerdown', this.onSheetPointerDown);
    this._phoneQuery?.removeEventListener?.('change', this._onPhoneChange);
    this._phoneQuery = null;
    Modal.registry.delete(this.modalId);
  }

  onOverlayClick(event) {
    const isOverlay =
      event.target === this.template.querySelector('[data-sf-modal-overlay]');
    if (isOverlay && this.closeOnOverlay && Modal.isTopModal(this)) {
      this.close();
    }
  }

  // Handed Escape and Tab by the layer stack while this is the top layer.
  // Answers true when it took Escape.
  onKeyDown(event) {
    if (!this.isOpen && this._modalState !== 'closing') {
      return false;
    }

    if (!Modal.isTopModal(this)) {
      return false;
    }

    if (event.key === 'Escape' && this.closeOnEsc && this._modalState !== 'closing' && !event.defaultPrevented) {
      this.close();
      return true;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
    return false;
  }

  trapFocus(event) {
    if (!Modal.isTopModal(this)) {
      return;
    }

    const panel = this.template.querySelector('[data-sf-modal-panel]');
    trapModalFocus(panel, event);
  }

  focusFirst() {
    if (this.display !== 'inline' && !Modal.isTopModal(this)) {
      return;
    }

    const panel = this.template.querySelector('[data-sf-modal-panel]');
    if (!panel) {
      return;
    }
    panel.setAttribute('tabindex', '-1');
    // The page's [autofocus] inside the window first (decision C25), else the panel.
    focusModalInitial(panel);
  }

  applyStackPosition(index = getModalLayerIndex(this)) {
    this._stackIndex = index;

    if (!this.template || this.display === 'inline') {
      return this;
    }

    if (index < 0) {
      this.template.style.removeProperty('z-index');
      this.template.style.removeProperty('--sf-modal-stack-index');
      this.template.removeAttribute('data-sf-modal-stacked');
      return this;
    }

    this.template.style.setProperty('--sf-modal-stack-index', String(index));
    this.template.style.zIndex = String(layerZIndexAt(index));
    // One scrim (owner decision C159 (7)), as <sf-modal> keeps it: a window
    // over another open window -- a class one or a Smart one, the document's
    // one stack -- lays none of its own. Two class windows laid two, the page
    // at about 87 % (study Ok5).
    const windows = openLayers('modal');
    this.template.toggleAttribute('data-sf-modal-stacked', windows.indexOf(this) > 0);
    return this;
  }

  open(options = {}) {
    const { animate = true } =
      typeof options === 'boolean' ? { animate: options } : options;

    // Inline mode — не скрываем, не делаем scroll lock
    if (this.display === 'inline') {
      if (this.isOpen) {
        return;
      }
      if (!this.emitBeforeOpen()) {
        return;
      }
      this.isOpen = true;
      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'open');
      this.template.classList.remove('hidden');
      this.template.setAttribute('aria-hidden', 'false');
      this.emitAfterOpen();
      return;
    }

    if (this.isOpen) {
      Modal.bringToFront(this);
      this.cancelCloseTransition();
      return;
    }
    if (!this.emitBeforeOpen()) {
      return;
    }

    // Если src был изменён пока модалка была закрыта — загружаем контент
    if ((this.mode === 'ajax' || this.mode === 'iframe') && this.src && !this._contentLoaded && !this._contentError) {
      const bodyScroll = this.template?.querySelector(
        '[data-sf-modal-body-scroll]',
      );
      if (bodyScroll) {
        this._scheduleLoading(bodyScroll);
      }
      this._loadContent();
    }

    // Reopening cancels a pending close, not the original focus-return target.
    this._releaseClosingContent?.();
    this._releaseClosingContent = null;
    if (this._modalState !== 'closing') {
      this.lastActive = document.activeElement;
      this._focusReturnAncestors = captureModalFocusAncestors(this.lastActive);
      this.placeIn(this.overlayHomeFor(this.lastActive));
    }
    this.cancelCloseTransition();
    // Where it stands now: a sheet or the whole screen on a phone (C159 (2)),
    // read as it opens, since the fields that decide may have come since.
    this.applyPlacement();
    this.template.classList.remove('hidden');
    this.template.classList.add('flex');
    this.template.setAttribute('aria-hidden', 'false');
    this.template.classList.toggle('animate', Boolean(animate));
    this.template.setAttribute('data-sf-modal-state', 'opening');
    this.isOpen = true;

    Modal.addToStack(this);

    if (!animate) {
      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'open');
      this.focusFirst();
      this.emitAfterOpen();
      return;
    }

    scheduleModalFrame(() => {
      if (!this.isOpen || this._modalState === 'closing') {
        return;
      }

      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'open');
      this.focusFirst();
      this.emitAfterOpen();
    });
  }

  close() {
    // Inline mode — просто скрываем через hidden + события
    if (this.display === 'inline') {
      if (!this.emitBeforeClose()) {
        return;
      }
      this.isOpen = false;
      this._modalState = 'closed';
      this.template.setAttribute('data-sf-modal-state', 'closed');
      this.template.classList.add('hidden');
      this.template.setAttribute('aria-hidden', 'true');
      this.emitAfterClose();
      return;
    }

    if (!this.isOpen || this._modalState === 'closing') {
      return;
    }
    if (!this.emitBeforeClose()) {
      return;
    }

    this._modalState = 'closing';
    this.template.setAttribute('data-sf-modal-state', 'closing');
    this.isOpen = false;

    const panel = this.template.querySelector('[data-sf-modal-panel]');
    this._releaseClosingContent = freezeModalContent(panel, Modal.isTopModal(this));
    this._closeTransitionAbort = scheduleModalClose(
      () => this.template, () => this.finishClose(),
    );
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setSrc(newSrc) {
    this.src = newSrc || '';
    this._contentLoaded = false;
    this._contentError = null;
    this._loadingShown = false;
    this._abortFetch();

    // Если модалка не открыта — загрузка произойдёт при open()
    if (!this.template || !this.isOpen) {
      return this;
    }

    // Показываем loading в bodyScroll при повторной загрузке (с debounce)
    const bodyScroll = this.template?.querySelector(
      '[data-sf-modal-body-scroll]',
    );
    if (bodyScroll) {
      this._scheduleLoading(bodyScroll);
    }

    if (
      (this.mode === 'ajax' || this.mode === 'iframe') &&
      this.src &&
      this.preload !== false
    ) {
      this._loadContent();
    }
    return this;
  }

  reloadContent() {
    if ((this.mode === 'ajax' || this.mode === 'iframe') && this.src) {
      this._contentLoaded = false;
      this._contentError = null;
      this._loadingShown = false;
      this._abortFetch();

      const bodyScroll = this.template?.querySelector(
        '[data-sf-modal-body-scroll]',
      );
      if (bodyScroll) {
        this._scheduleLoading(bodyScroll);
      }

      this._loadContent();
    }
    return this;
  }

  cancelCloseTransition() {
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    if (this._closeTransitionAbort) {
      this._closeTransitionAbort();
      this._closeTransitionAbort = null;
    }

    if (this._modalState === 'closing') {
      this._modalState = 'open';
      this.template.setAttribute('data-sf-modal-state', 'open');
    }
  }

  finishClose() {
    if (this._modalState !== 'closing') {
      return;
    }

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    if (this._closeTransitionAbort) {
      this._closeTransitionAbort();
      this._closeTransitionAbort = null;
    }

    this.template.classList.remove('flex');
    this.template.classList.add('hidden');
    this.template.setAttribute('data-sf-modal-state', 'closed');
    this.template.setAttribute('aria-hidden', 'true');
    this._releaseClosingContent?.();
    this._releaseClosingContent = null;
    this._modalState = 'closed';

    const wasTop = Modal.isTopModal(this);
    Modal.removeFromStack(this);
    restoreModalLayerFocus(wasTop, this.lastActive, this._focusReturnAncestors);

    this.emitAfterClose();
  }

  static bindGlobalEvents() {
    if (Modal.globalBound || typeof document === 'undefined') {
      return;
    }

    document.addEventListener('click', (event) => {
      const openEl = event.target.closest('[data-sf-modal-open]');
      if (openEl) {
        const id = openEl.getAttribute('data-sf-modal-open');
        const modal = Modal.registry.get(id);
        if (modal) {
          modal.open();
        }
        return;
      }

      const closeEl = event.target.closest('[data-sf-modal-close]');
      if (!closeEl) {
        return;
      }

      const id = closeEl.getAttribute('data-sf-modal-close');
      if (id) {
        const modal = Modal.registry.get(id);
        if (modal) {
          modal.close();
        }
        return;
      }

      const modalRoot = closeEl.closest('.sf-modal');
      if (!modalRoot) {
        return;
      }
      const modalId = modalRoot.getAttribute('data-sf-modal-id');
      const modal = Modal.registry.get(modalId);
      if (modal) {
        modal.close();
      }
    });

    Modal.globalBound = true;
  }

  // Kept for code that calls them: the layer stack takes the page lock itself
  // now, with its default lockPageScroll, while any layer that locks is open.
  static lockPage(preserveScrollGap = true) {
    if (!Modal.lockState) Modal.lockState = lockPageScroll({ preserveScrollGap });
  }

  static unlockPage() {
    Modal.lockState?.();
    Modal.lockState = null;
  }
}

registerComponent('Modal', Modal);

export { Modal };
