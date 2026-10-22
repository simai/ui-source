import {html, nothing, render} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-drawer", code, words).
const DRAWER_TEXT = {
  en: {
    closeLabel: 'Close drawer',
    handleLabel: 'Resize the panel',
  },
  ru: {
    closeLabel: 'Закрыть панель',
    handleLabel: 'Изменить высоту панели',
  },
};

import './scss/index.scss';

const DRAWER_SELECTOR = 'sf-drawer';
// Only the edge. A foot area was tried and taken out: lit inserts a node that
// appears later beside the markers of its siblings, and those markers move with
// any node the drawer has already projected -- so a bar that appeared when a
// record became editable landed inside the body, above everything. The panel
// scrolls now, so a bar can simply stick to its bottom where it is.
const DRAWER_AREAS = ['edge'];
const asksFor = (node, slot) => node.nodeType === 1 && node.getAttribute('slot') === slot;
const asksForArea = (node) => DRAWER_AREAS.some((slot) => asksFor(node, slot));
const PORTAL_ATTRIBUTE = 'data-sf-drawer-portal';
// A box that holds its own overlays (sf-drawer, sf-modal); the drawer's own
// name came first and is read until the change journal retires it.
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const drawerStack = [];
// Below this width of the dock host (or of the window, when the page names no
// host) docked panels overlay the page instead of
// narrowing it.
const DOCK_MIN_REM = 48;
const DOCK_MEDIA_QUERY = `(min-width: ${DOCK_MIN_REM}rem)`;
const PLACEMENTS = ['left', 'right', 'inline-start', 'inline-end', 'bottom'];
// The heights a bottom sheet rests at, smallest first: its content (auto, up
// to the room it has), half the room, and all of it.
const SNAPS = ['auto', 'half', 'full'];
// A drag of the sheet farther than this share of its height, or faster than
// this, is a decision: down closes (or steps full down to half), up opens to full.
const SWIPE_SHARE = 0.25;
const SWIPE_SPEED = 0.5;

function joinClasses(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

function escapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

const drawerManager = {
  globalBound: false,
  lockState: null,

  add(drawer) {
    this.remove(drawer, false);
    drawerStack.push(drawer);
    this.sync();
    this.syncPageLock();
  },

  remove(drawer, unlock = true) {
    const index = drawerStack.indexOf(drawer);
    if (index >= 0) drawerStack.splice(index, 1);
    this.sync();
    if (unlock) this.syncPageLock();
  },

  bringToFront(drawer) {
    if (!drawerStack.includes(drawer)) return;
    this.remove(drawer, false);
    drawerStack.push(drawer);
    this.sync();
  },

  isTop(drawer) {
    return drawerStack.at(-1) === drawer;
  },

  sync() {
    drawerStack.forEach((drawer, index) => drawer.applyStackPosition(index));
    this.syncDock();
  },

  // Docked drawers reserve page space: the summed widths of open docked panels
  // per logical side are published as CSS custom properties on the root; any
  // element with data-sf-drawer-dock-host pads itself by them.
  syncDock() {
    const root = document.documentElement;
    if (!root) return;
    this.bindDockMedia();
    const sides = {start: 0, end: 0};
    const reserve = this.reservesDock();
    for (const drawer of reserve ? drawerStack : []) {
      if (!drawer.openState || !drawer.docked) continue;
      const panel = drawer.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
      const width = panel ? Math.round(panel.getBoundingClientRect().width) : 0;
      sides[drawer.dockSide] += width;
    }
    for (const side of ['start', 'end']) {
      const name = `--sf-drawer-dock-inline-${side}`;
      if (sides[side] > 0) root.style.setProperty(name, `${sides[side]}px`);
      else root.style.removeProperty(name);
    }
  },

  bindDockMedia() {
    if (this.dockMedia === undefined) {
      this.dockMedia = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DOCK_MEDIA_QUERY) : null;
      this.dockMedia?.addEventListener?.('change', () => this.syncDock());
    }
    // The host's own width decides, when the page names a host: a docked
    // drawer inside an editor pane or a documentation example docks by the
    // room that box has, not by the window's (DEV, 2026-10-18).
    const host = document.querySelector('[data-sf-drawer-dock-host]');
    if (host !== this.dockHost) {
      this.dockHostObserver?.disconnect();
      this.dockHost = host;
      this.dockHostObserver = host && typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
          // Only a change of the answer redraws: syncDock pads the host, and
          // the padding must not wake this observer into a loop.
          const before = this.dockReserved;
          if (this.reservesDock() !== before) this.syncDock();
        })
        : null;
      this.dockHostObserver?.observe(host, {box: 'border-box'});
    }
  },

  // Whether docked drawers take room from the page: the dock host is at least
  // 48rem wide, or -- with no host on the page -- the window is.
  reservesDock() {
    const host = this.dockHost;
    let reserve;
    if (host?.isConnected) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      reserve = host.getBoundingClientRect().width >= DOCK_MIN_REM * rem;
    } else {
      reserve = this.dockMedia ? this.dockMedia.matches : true;
    }
    this.dockReserved = reserve;
    return reserve;
  },

  syncPageLock() {
    // A drawer inside an overlay container covers that box, not the page.
    const modalDrawer = drawerStack.find(drawer => drawer.openState && drawer.modal && !drawer.closest(OVERLAY_CONTAINER));
    if (modalDrawer) this.lockPage(modalDrawer.preserveScrollGap);
    else this.unlockPage();
  },

  lockPage(preserveScrollGap) {
    const htmlElement = document.documentElement;
    const body = document.body;
    if (!htmlElement || !body || this.lockState) return;
    const gap = Math.max(0, window.innerWidth - htmlElement.clientWidth);
    this.lockState = {
      htmlOverflow: htmlElement.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingInlineEnd: body.style.paddingInlineEnd,
    };
    htmlElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (preserveScrollGap && gap > 0) body.style.paddingInlineEnd = `${gap}px`;
  },

  unlockPage() {
    if (!this.lockState) return;
    const htmlElement = document.documentElement;
    const body = document.body;
    htmlElement.style.overflow = this.lockState.htmlOverflow;
    body.style.overflow = this.lockState.bodyOverflow;
    body.style.paddingInlineEnd = this.lockState.bodyPaddingInlineEnd;
    this.lockState = null;
  },

  bindGlobalEvents() {
    if (this.globalBound || typeof document === 'undefined') return;
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const conciseTrigger = event.target.closest('[data-drawer]');
      const openTrigger = event.target.closest('[data-sf-drawer-open]');
      const toggleTrigger = event.target.closest('[data-sf-drawer-toggle]');
      const closeTrigger = event.target.closest('[data-sf-drawer-close]');
      const conciseOperation = conciseTrigger?.getAttribute('data-drawer') || '';
      const operation = ['open', 'toggle', 'close'].includes(conciseOperation)
        ? conciseOperation
        : openTrigger ? 'open' : toggleTrigger ? 'toggle' : closeTrigger ? 'close' : '';
      const trigger = conciseTrigger || openTrigger || toggleTrigger || closeTrigger;
      if (!operation || !trigger) return;
      const id = trigger.getAttribute('aria-controls')
        || trigger.getAttribute(`data-sf-drawer-${operation}`)
        || trigger.closest('[data-sf-drawer-id]')?.getAttribute('data-sf-drawer-id');
      if (!id) return;
      customElements.whenDefined(DRAWER_SELECTOR).then(() => {
        document.getElementById(id)?.[operation]?.();
      });
    });
    this.globalBound = true;
  },
};

class SfDrawer extends SfBaseElement {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      opened: {attribute: 'open', type: Boolean, default: false},
      placement: {
        default: 'right',
        values: PLACEMENTS,
      },
      // A bottom sheet's resting height (placement="bottom").
      snap: {default: 'auto', values: SNAPS},
      // An outside switch opens and closes the panel: the close button stands
      // down while that switch is on screen (simai/ui-source#29).
      controlled: {type: Boolean, default: false},
      // Where the panels start from the top: the height of an app bar they
      // must not cover (simai/ui-source#29). A length; empty for the
      // --sf-drawer-block-start variable, else 0.
      blockStart: {attribute: 'block-start', default: ''},
      overlay: {type: Boolean, default: true},
      modal: {type: Boolean, default: true},
      docked: {type: Boolean, default: false},
      // The shared size ladder. The words are legacy values, still accepted:
      // see contracts/public-api-axes.json. `full` is not a step of the ladder —
      // it means as wide as the viewport, and drops the radius with it.
      size: {
        default: '1',
        values: ['1/2', '1', '2', 'full'],
        valueAliases: {'1/2': ['small'], 1: ['medium'], 2: ['large']},
      },
      closeOnEsc: {attribute: 'close-on-esc', type: Boolean, default: true},
      closeOnOverlay: {attribute: 'close-on-overlay', type: Boolean, default: true},
      preserveScrollGap: {attribute: 'preserve-scroll-gap', type: Boolean, default: true},
      showClose: {attribute: 'show-close', type: Boolean, default: true},
      closePlacement: {
        attribute: 'close-placement',
        default: 'inside',
        values: ['inside', 'outside'],
      },
      title: {default: ''},
      label: {default: ''},
      closeLabel: {attribute: 'close-label', default: ''},
      width: {default: ''},
      stackOffset: {attribute: 'stack-offset', default: ''},
      gutter: {default: ''},
      zIndex: {attribute: 'z-index', default: ''},
      overlayClass: {attribute: 'overlay-class', default: ''},
      panelClass: {attribute: 'panel-class', default: ''},
      // The panel is the drawer's own surface, and what colour it is belongs to
      // whoever opened it: a consumer painting its content a different colour
      // than the panel leaves the head and the gutters in the other one.
      panelStyle: {attribute: 'panel-style', default: ''},
      headerClass: {attribute: 'header-class', default: ''},
      bodyClass: {attribute: 'body-class', default: ''},
      closeClass: {attribute: 'close-class', default: ''},
    };
  }

  static get defaultTrueAttributes() {
    return new Set([
      'overlay',
      'modal',
      'close-on-esc',
      'close-on-overlay',
      'preserve-scroll-gap',
      'show-close',
    ]);
  }

  constructor() {
    super();
    this.drawerId = '';
    this._portalRoot = null;
    this._contentNodes = null;
    this._lastActive = null;
    this._syncingOpenAttribute = false;
    this._hasEmittedReady = false;
    this._stackIndex = -1;
    this._focusAfterRender = false;
    this._emitAfterOpen = false;
    this._dockObserver = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.handleRootClick = this.handleRootClick.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onSheetPointerDown = this.onSheetPointerDown.bind(this);
    this.onHandleKeyDown = this.onHandleKeyDown.bind(this);
    this._switchVisible = false;
  }

  connectedCallback() {
    if (!this._contentNodes) this._contentNodes = Array.from(this.childNodes);
    this.drawerId = this.resolveDrawerId();
    super.connectedCallback();
    drawerManager.bindGlobalEvents();
    document.addEventListener('keydown', this.onKeyDown);
    globalThis.addEventListener?.('resize', this.onWindowResize, {passive: true});
    if (this.openState) {
      this._focusAfterRender = this.modal;
      drawerManager.add(this);
    }
  }

  disconnectedCallback() {
    this._areaObserver?.disconnect();
    this._areaObserver = null;
    document.removeEventListener('keydown', this.onKeyDown);
    globalThis.removeEventListener?.('resize', this.onWindowResize);
    this._dockObserver?.disconnect();
    this._dockObserver = null;
    drawerManager.remove(this);
    this.clearPortal();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'open' && !this._syncingOpenAttribute && this._isMounted) {
      this.syncExternalOpenState(newValue !== null);
      return;
    }
    if ((name === 'modal' || name === 'docked') && this.openState) drawerManager.syncPageLock();
    if ((name === 'docked' || name === 'placement' || name === 'size' || name === 'width') && this.openState) {
      requestAnimationFrame(() => { drawerManager.syncDock(); drawerManager.sync(); });
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  get openState() {
    return this.hasAttribute('open');
  }

  get placement() {
    return this.getEnumAttr('placement', PLACEMENTS, 'right');
  }

  get sheet() {
    return this.placement === 'bottom';
  }

  get snap() {
    return this.getEnumAttr('snap', SNAPS, 'auto');
  }

  get controlled() {
    return this.getBooleanAttr('controlled', false);
  }

  // The switch outside the panel that names it in aria-controls, on screen:
  // while it is, it is the way to close the panel and the panel draws no
  // second one.
  hasVisibleSwitch() {
    const id = this.drawerId || this.id;
    if (!id || typeof document === 'undefined') return false;
    const root = this.getDrawerRoot();
    return [...document.querySelectorAll('[aria-controls]')].some((element) => {
      if (!element.getAttribute('aria-controls').split(/\s+/u).includes(id)) return false;
      if (root?.contains(element) || this.contains(element)) return false;
      if (element.getClientRects().length === 0) return false;
      return getComputedStyle(element).visibility !== 'hidden';
    });
  }

  onWindowResize() {
    if (!this.controlled || !this._isMounted) return;
    const visible = this.hasVisibleSwitch();
    if (visible !== this._switchVisible) this.requestComponentUpdate('controlled');
  }

  get overlay() {
    return this.getBooleanAttr('overlay', true);
  }

  get modal() {
    // A docked drawer is part of the page layout and is always modeless.
    return !this.docked && this.getBooleanAttr('modal', true);
  }

  // A bottom sheet floats over the page; it is never a column of it.
  get docked() {
    return this.getBooleanAttr('docked', false) && !this.sheet;
  }

  // The inline gutter the head and the body share: a length, empty for the
  // drawer's own (space-1).
  get gutter() {
    return this.getAttribute('gutter') || '';
  }

  // How much of each drawer below shows past the one above it at the same
  // edge: a length, empty for none (the drawers lie flush, as before).
  get stackOffset() {
    return this.getAttribute('stack-offset') || '';
  }

  // The physical edge the panel opens from, so left and inline-start count as
  // one edge in a left-to-right page and as two in a right-to-left one.
  get stackEdge() {
    const placement = this.placement;
    if (!placement.startsWith('inline')) return placement;
    const rtl = (this.closest('[dir]')?.getAttribute('dir') || document.documentElement.dir) === 'rtl';
    return (placement === 'inline-start') !== rtl ? 'left' : 'right';
  }

  get dockSide() {
    const placement = this.placement;
    if (placement === 'inline-start') return 'start';
    if (placement === 'inline-end') return 'end';
    const rtl = globalThis.getComputedStyle?.(document.documentElement).direction === 'rtl';
    if (placement === 'left') return rtl ? 'end' : 'start';
    return rtl ? 'start' : 'end';
  }

  get size() {
    return this.getProp('size');
  }

  get closeOnEsc() {
    return this.getBooleanAttr('close-on-esc', true);
  }

  get closeOnOverlay() {
    return this.getBooleanAttr('close-on-overlay', true);
  }

  get preserveScrollGap() {
    return this.getBooleanAttr('preserve-scroll-gap', true);
  }

  get showClose() {
    return this.getBooleanAttr('show-close', true);
  }

  get closePlacement() {
    return this.getEnumAttr('close-placement', ['inside', 'outside'], 'inside');
  }

  resolveDrawerId() {
    const existing = this.id || this.getAttribute('drawer-id');
    if (existing) {
      if (!this.id) this.id = existing;
      return existing;
    }
    const generated = `sf-drawer-${Math.random().toString(36).slice(2, 10)}`;
    this.id = generated;
    this.setAttribute('drawer-id', generated);
    return generated;
  }

  templateContext() {
    this._switchVisible = this.controlled && this.hasVisibleSwitch();
    return this.createTemplateContext({
      drawerId: this.drawerId || this.resolveDrawerId(),
      open: this.openState,
      placement: this.placement,
      overlay: this.overlay,
      modal: this.modal,
      docked: this.docked,
      size: this.size,
      showClose: this.showClose && !this._switchVisible,
      controlled: this.controlled,
      sheet: this.sheet,
      snap: this.snap,
      handleLabel: pageText(DRAWER_TEXT, 'handleLabel', this),
      blockStart: this.getAttribute('block-start') || '',
      closePlacement: this.closePlacement,
      title: this.getAttribute('title') || '',
      label: this.getAttribute('label') || this.getAttribute('title') || '',
      closeLabel: this.getAttribute('close-label') || this.defaultCloseLabel,
      width: this.getAttribute('width') || '',
      stackOffset: this.stackOffset,
      gutter: this.gutter,
      zIndex: this.drawerZIndex,
      overlayClass: this.getAttribute('overlay-class') || '',
      panelClass: this.getAttribute('panel-class') || '',
      panelStyle: this.getAttribute('panel-style') || '',
      headerClass: this.getAttribute('header-class') || '',
      bodyClass: this.getAttribute('body-class') || '',
      closeClass: this.getAttribute('close-class') || '',
    });
  }

  get drawerZIndex() {
    return this.getAttribute('z-index')
      || `calc(var(--sf-drawer-z-index, var(--sf-z-index-9)) + ${Math.max(0, this._stackIndex) * 2})`;
  }

  // The shared rule, not a second reading of it. This asked the document
  // directly, which misses a region that names its own language and leaves a
  // product unable to register a third -- the same two faults admin-menu had.
  get defaultCloseLabel() {
    return pageText(DRAWER_TEXT, 'closeLabel', this);
  }

  async renderComponent(changedAttributes = []) {
    const token = ++this._renderToken;
    const result = await this.resolveTemplateResult(changedAttributes);
    if (!this._isMounted || token !== this._renderToken) return;
    render(result, this.resolvePortalRoot());
    this.afterRender();
  }

  // The panel is rendered at the end of the body, above the page -- or, when the
  // drawer stands inside a [data-sf-overlay-container] (or the older
  // [data-sf-drawer-container]), at the end of that box,
  // which then frames it (contain: layout makes it the panel's containing
  // block): an editor pane or a documentation example holds its own drawer
  // without a stage of its own (DEV, 2026-10-18).
  resolvePortalRoot() {
    if (this._portalRoot?.isConnected) return this._portalRoot;
    const home = this.closest(OVERLAY_CONTAINER) || document.body;
    const selector = `[${PORTAL_ATTRIBUTE}="${escapeSelector(this.drawerId)}"]`;
    this._portalRoot = home.querySelector(selector) || document.createElement('div');
    this._portalRoot.setAttribute(PORTAL_ATTRIBUTE, this.drawerId);
    if (!this._portalRoot.isConnected) home.append(this._portalRoot);
    return this._portalRoot;
  }

  // A consumer's bar or edge control may appear long after the drawer connected
  // -- when a record becomes editable, say. The content is captured once, and
  // the drawer renders on its own schedule, so without watching for new children
  // such a node stands where the drawer's own children render: above everything.
  watchForAreaChildren() {
    if (this._areaObserver) return;
    this._areaObserver = new MutationObserver(() => {
      const root = this.getDrawerRoot();
      if (root) this.projectAreas(root);
    });
    this._areaObserver.observe(this, {childList: true});
  }

  projectAreas(root) {
    for (const [slot, selector] of [['edge', '[data-sf-drawer-edge]']]) {
      const area = root.querySelector(selector);
      if (!area) continue;
      const waiting = [
        ...this._contentNodes.filter((node) => asksFor(node, slot) && node.parentElement !== area),
        ...[...this.children].filter((node) => asksFor(node, slot)),
      ];
      if (waiting.length) area.append(...new Set(waiting));
    }
  }

  afterRender() {
    const root = this.getDrawerRoot();
    if (!root) return;
    // A child may ask for the edge, which stands beside the panel, or for the
    // foot, which holds the bottom of it and does not scroll with the body.
    // Everything else is the drawer's content, as before.
    //
    // This runs on every render, not only on the first: the content is captured
    // once, when the element connects, and a consumer whose bar appears later --
    // when a record becomes editable, say -- would otherwise leave it standing
    // where the drawer's own children render, above everything.
    this.projectAreas(root);
    this.watchForAreaChildren();
    const body = root.querySelector('[data-sf-drawer-body]');
    if (body && body.dataset.sfDrawerContentReady !== '1') {
      // A child asking for the edge goes beside the panel, not into it. Every
      // other child is the drawer's content, as before.
      body.replaceChildren(...this._contentNodes.filter((node) => !asksForArea(node)));
      body.dataset.sfDrawerContentReady = '1';
    }
    root.removeEventListener('click', this.handleRootClick);
    root.addEventListener('click', this.handleRootClick);
    const handle = root.querySelector('[data-sf-drawer-handle]');
    const head = root.querySelector('.sf-drawer-head');
    for (const grip of [handle, head]) {
      grip?.removeEventListener('pointerdown', this.onSheetPointerDown);
      grip?.addEventListener('pointerdown', this.onSheetPointerDown);
    }
    handle?.removeEventListener('keydown', this.onHandleKeyDown);
    handle?.addEventListener('keydown', this.onHandleKeyDown);
    this.applyStackPosition();
    this.observeDock(root);
    const eventName = this._hasEmittedReady ? 'drawer:update' : 'drawer:ready';
    this.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      detail: {component: this, drawer: this, drawerId: this.drawerId, root},
    }));
    this._hasEmittedReady = true;
    if (this._focusAfterRender || this._emitAfterOpen) {
      this._focusAfterRender = false;
      requestAnimationFrame(() => {
        if (this.openState && this.modal) this.focusFirst();
        if (this._emitAfterOpen) this.emitDrawerEvent('drawer:after-open');
        this._emitAfterOpen = false;
      });
    }
  }

  template() {
    const context = this.templateContext();
    const closeButton = context.showClose
      ? html`<button
          type="button"
          class=${joinClasses(
            'sf-icon-button sf-drawer-close sf-icon-button--close sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1/3 m-0',
            context.closePlacement === 'outside' && 'sf-drawer-close--outside',
            context.closeClass,
          )}
          aria-label=${context.closeLabel}
          data-drawer="close"
          data-sf-drawer-close=${context.drawerId}
        >
          <span class="sf-close sf-close--size-1/3 flex justify-center items-center" aria-hidden="true">
            <span class="sf-close-icon"></span>
          </span>
        </button>`
      : nothing;
    return html`<div
      class=${joinClasses('sf-drawer', context.open && 'is-open', context.rootClass)}
      style=${`z-index:${context.zIndex};${context.width ? `--sf-drawer-width:${context.width};` : ''}${context.stackOffset ? `--sf-drawer-stack-offset:${context.stackOffset};` : ''}${context.blockStart ? `--sf-drawer-block-start:${context.blockStart};` : ''}${context.rootStyle || ''}`}
      data-sf-drawer-root
      data-sf-drawer-id=${context.drawerId}
      data-sf-drawer-placement=${context.placement}
      data-sf-drawer-size=${context.size}
      data-sf-drawer-modal=${context.modal ? 'true' : 'false'}
      data-sf-drawer-docked=${context.docked ? 'true' : 'false'}
      data-sf-drawer-snap=${context.sheet ? context.snap : nothing}
      aria-hidden=${context.open ? 'false' : 'true'}
    >
      <div class=${joinClasses('sf-drawer-overlay', context.overlayClass)} data-sf-drawer-overlay ?hidden=${!context.modal || !context.overlay}></div>
      <section
        class=${joinClasses('sf-drawer-panel', context.panelClass)}
        style=${`${context.width ? `--sf-drawer-width:${context.width};` : ''}${context.stackOffset ? `--sf-drawer-stack-offset:${context.stackOffset};` : ''}${context.gutter ? `--sf-drawer-gutter:${context.gutter};` : ''}${context.panelStyle || ''}`}
        role=${context.docked ? 'region' : 'dialog'}
        aria-modal=${context.modal ? 'true' : nothing}
        aria-label=${context.label || nothing}
        aria-labelledby=${context.title ? `${context.drawerId}-title` : nothing}
        tabindex="-1"
        ?inert=${!context.open}
        data-sf-drawer-panel
      >
        ${context.sheet ? html`<button type="button" class="sf-drawer-handle" aria-label=${context.handleLabel}
            data-sf-drawer-handle><span class="sf-drawer-handle-bar" aria-hidden="true"></span></button>` : nothing}
        ${context.title || (context.showClose && context.closePlacement === 'inside') || context.headerClass
                ? html`
                  <header class=${joinClasses('sf-drawer-head', context.headerClass)}>
                    ${context.title ? html`<div class="sf-drawer-title" id=${`${context.drawerId}-title`}>${context.title}</div>` : nothing}
                    ${context.closePlacement === 'inside' ? closeButton : nothing}
                  </header>`
                : nothing}
        <div class=${joinClasses('sf-drawer-body', context.bodyClass)} data-sf-drawer-body></div>
      </section>
      <div class="sf-drawer-edge" data-sf-drawer-edge>
        ${context.closePlacement === 'outside' ? closeButton : nothing}
      </div>
    </div>`;
  }

  open(options = {}) {
    if (this.openState) {
      drawerManager.bringToFront(this);
      return this;
    }
    if (options.emit !== false && !this.emitDrawerEvent('drawer:before-open', true)) return this;
    this._lastActive = document.activeElement;
    this.syncOpenAttribute(true);
    drawerManager.add(this);
    this._focusAfterRender = this.modal;
    this._emitAfterOpen = options.emit !== false;
    this.requestComponentUpdate('open');
    return this;
  }

  close(options = {}) {
    if (!this.openState) return this;
    if (options.emit !== false && !this.emitDrawerEvent('drawer:before-close', true)) return this;
    this.syncOpenAttribute(false);
    drawerManager.remove(this);
    this.requestComponentUpdate('close');
    this.restoreFocus();
    if (options.emit !== false) this.emitDrawerEvent('drawer:after-close');
    return this;
  }

  toggle() {
    return this.openState ? this.close() : this.open();
  }

  setState(state = {}) {
    if (state && typeof state === 'object' && Object.prototype.hasOwnProperty.call(state, 'open')) {
      const {open: requestedOpen, ...rest} = state;
      requestedOpen ? this.open() : this.close();
      return super.setState(rest);
    }
    return super.setState(state);
  }

  getState() {
    return {...this.templateContext(), open: this.openState};
  }

  syncExternalOpenState(open) {
    if (open) {
      this._lastActive = document.activeElement;
      this._focusAfterRender = this.modal;
      drawerManager.add(this);
    } else {
      drawerManager.remove(this);
      this.restoreFocus();
    }
    this.requestComponentUpdate(open ? 'open' : 'close');
  }

  syncOpenAttribute(open) {
    this._syncingOpenAttribute = true;
    this.toggleAttribute('open', open);
    this._syncingOpenAttribute = false;
  }

  getDrawerRoot() {
    return this._portalRoot?.querySelector('[data-sf-drawer-root]') || null;
  }

  observeDock(root) {
    const panel = root.querySelector('[data-sf-drawer-panel]');
    if (!this.docked || !panel || typeof ResizeObserver !== 'function') {
      this._dockObserver?.disconnect();
      this._dockObserver = null;
      if (this.docked) drawerManager.syncDock();
      return;
    }
    if (!this._dockObserver) this._dockObserver = new ResizeObserver(() => drawerManager.syncDock());
    this._dockObserver.disconnect();
    this._dockObserver.observe(panel);
    drawerManager.syncDock();
  }

  applyStackPosition(index = drawerStack.indexOf(this)) {
    this._stackIndex = index;
    const root = this.getDrawerRoot();
    if (root) {
      root.style.zIndex = this.drawerZIndex;
      // Depth is the number of open, undocked drawers below this one at the
      // same edge; the panel stands that many stack offsets in from the edge.
      const edge = this.stackEdge;
      const depth = this.docked || index < 0 ? 0 : drawerStack
        .slice(0, index)
        .filter((drawer) => drawer.openState && !drawer.docked && drawer.stackEdge === edge)
        .length;
      root.style.setProperty('--sf-drawer-stack-depth', String(depth));
    }
    return this;
  }

  // The panel takes the focus, not the first control inside it. A modal has to
  // hold the focus, which is why this exists -- but handing it to whatever
  // control happens to be first put a focus ring on a star nobody had pressed,
  // and a person reading the panel saw a control announced instead of the panel.
  // A consumer that wants a field focused says so with `autofocus`.
  focusFirst() {
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    const wanted = panel?.querySelector('[autofocus]');
    (wanted || panel)?.focus?.();
  }

  restoreFocus() {
    const target = this._lastActive;
    if (!(target instanceof HTMLElement) || !target.isConnected || target.matches(':disabled,[hidden],[inert]')) return;
    target.focus();
  }

  // The sheet's resting height. Set by the handle, a swipe or the attribute;
  // drawer:snap says where it came to rest.
  setSnap(snap) {
    if (!SNAPS.includes(snap) || snap === this.snap) return this;
    this.setAttribute('snap', snap);
    this.emitDrawerEvent('drawer:snap');
    return this;
  }

  // The handle is a button: a press or Enter toggles half and full, the arrows
  // step up and down through the resting heights. Escape still closes.
  onHandleKeyDown(event) {
    const at = SNAPS.indexOf(this.snap);
    const step = {ArrowUp: 1, ArrowDown: -1}[event.key];
    if (step === undefined) return;
    event.preventDefault();
    this.setSnap(SNAPS[Math.min(SNAPS.length - 1, Math.max(0, at + step))]);
  }

  // A swipe on the handle or the head: the sheet follows the finger down, and
  // on release either closes (or steps down from full), opens to full when
  // pushed up, or settles back. Controls inside the head keep their presses.
  onSheetPointerDown(event) {
    if (!this.sheet || !this.openState || event.button !== 0) return;
    const grip = event.currentTarget;
    if (grip.classList.contains('sf-drawer-head') && event.target.closest('button, a[href], input, select, textarea, [tabindex]')) return;
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    if (!panel) return;
    const startY = event.clientY;
    const startTime = event.timeStamp;
    const height = panel.getBoundingClientRect().height || 1;
    let moved = false;
    let delta = 0;
    grip.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      delta = moveEvent.clientY - startY;
      if (!moved && Math.abs(delta) < 4) return;
      moved = true;
      panel.classList.add('is-dragging');
      panel.style.setProperty('--sf-drawer-sheet-drag', `${Math.max(0, delta)}px`);
    };
    const end = (endEvent) => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      panel.classList.remove('is-dragging');
      panel.style.removeProperty('--sf-drawer-sheet-drag');
      if (!moved || endEvent.type === 'pointercancel') return;
      // A drag that ends on the handle is not also a press of it.
      grip.addEventListener('click', (clickEvent) => clickEvent.stopImmediatePropagation(), {capture: true, once: true});
      const speed = delta / Math.max(1, endEvent.timeStamp - startTime);
      if (delta > height * SWIPE_SHARE || speed > SWIPE_SPEED) {
        if (this.snap === 'full') this.setSnap('half');
        else this.close();
      } else if (-delta > height * SWIPE_SHARE || speed < -SWIPE_SPEED) {
        this.setSnap('full');
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  handleRootClick(event) {
    const root = this.getDrawerRoot();
    if (event.target instanceof Element && event.target.closest('[data-sf-drawer-handle]')) {
      this.setSnap(this.snap === 'full' ? 'half' : 'full');
      return;
    }
    if (event.target === root?.querySelector('[data-sf-drawer-overlay]') && this.closeOnOverlay) {
      this.close();
      return;
    }
    if (event.target instanceof Element && event.target.closest('[data-sf-drawer-close]')) {
      event.preventDefault();
      this.close();
    }
  }

  onKeyDown(event) {
    // An editor or drag operation that handled Escape keeps it.
    if (event.defaultPrevented || !this.openState || !drawerManager.isTop(this)) return;
    // An open popover takes Escape first; the drawer behind it stays.
    if (event.key === 'Escape' && this.closeOnEsc && !document.documentElement?.dataset?.sfPopoverOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
      return;
    }
    if (!this.modal) return;
    if (event.key !== 'Tab') return;
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    const focusable = Array.from(panel?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      .filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      panel?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!panel?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  emitDrawerEvent(type, cancelable = false) {
    // Drawer events bubble like other sf-* events, so hosts can listen on the
    // document. detail.drawer names the panel; nested drawers bubble through
    // their ancestors.
    return this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      cancelable,
      detail: {
        component: this,
        drawer: this,
        drawerId: this.drawerId,
        root: this.getDrawerRoot(),
      },
    }));
  }

  // The on* helpers keep their original meaning: only this drawer's events,
  // not those bubbling up from a nested drawer.
  ownDrawerHandler(handler) {
    return (event) => {
      if (event.detail?.drawer === this) handler.call(this, event);
    };
  }

  onBeforeOpen(handler, options) {
    if (typeof handler === 'function') this.addEventListener('drawer:before-open', this.ownDrawerHandler(handler), options);
    return this;
  }

  onAfterOpen(handler, options) {
    if (typeof handler === 'function') this.addEventListener('drawer:after-open', this.ownDrawerHandler(handler), options);
    return this;
  }

  onBeforeClose(handler, options) {
    if (typeof handler === 'function') this.addEventListener('drawer:before-close', this.ownDrawerHandler(handler), options);
    return this;
  }

  onAfterClose(handler, options) {
    if (typeof handler === 'function') this.addEventListener('drawer:after-close', this.ownDrawerHandler(handler), options);
    return this;
  }

  clearPortal() {
    if (!this._portalRoot) return;
    render(nothing, this._portalRoot);
    this._portalRoot.remove();
    this._portalRoot = null;
  }
}

SfDrawer.define(DRAWER_SELECTOR);
