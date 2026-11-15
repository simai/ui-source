import {html, nothing, render} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {noteDeprecated} from '../../core/js/deprecations';
import {instancePath, partId} from '../../core/js/instance-path';
import {carryLayerOrigin, closeLayer, focusablesIn, isTopLayer, layerIndex, layerZIndexAt, openLayer, openLayers,
  raiseLayer, returnLayerFocus, landmarksAround, startClosedLayerContent, updateLayer} from '../../core/js/layer-stack';
import {inHandleRow, scrollsAlong, startsOnControl, trackSwipe} from '../../core/js/sheet-swipe';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-drawer from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8, §19): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product
// adds a language through SF.language.register("sf-drawer", code, words)),
// and the old names -- title and the drawer:* events -- are dated aliases.
const DrawerElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

// The public variables the manifest declares; the panel drawn at the end of the
// body carries their values from where its host stands (§19.1).
const DRAWER_VARIABLES = Object.keys(manifest['css-variables'] || {});

const OLD_EVENT_NAMES = ['drawer:before-open', 'drawer:after-open', 'drawer:before-close', 'drawer:after-close', 'drawer:snap'];

// A lifecycle copy (drawer:ready, drawer:update) is still sent until its date;
// a listener that reads it is a use (vocabulary §5.1, §16.13).
function retiredEvent(type, detail) {
  const event = new CustomEvent(type, {bubbles: true, composed: true, detail});
  let used = false;
  Object.defineProperty(event, 'detail', {
    configurable: true,
    get() {
      if (!used) {
        used = true;
        noteDeprecated({component: 'sf-drawer', tag: 'sf-drawer', kind: 'event', from: type, to: null,
          since: aliases.since, remove_after: aliases.remove_after});
      }
      return detail;
    },
  });
  return event;
}


import './scss/index.scss';

const DRAWER_SELECTOR = 'sf-drawer';
// The edge beside the panel and the foot under its body (owner decision C157
// (3), 2026-11-14: a pinned footer, the actions at its start, the main one
// first). Both are drawn empty by lit and filled by projectAreas, outside
// lit's parts: a foot lit filled itself was tried before and taken out --
// lit inserted a node that appeared later beside the markers of its
// siblings, and a bar that appeared when a record became editable landed
// inside the body, above everything.
// The head holds one action of the page's before the close (study
// control/research/2026-11-14-view-property-base.md VB-4: «Изменить» on a
// record), filled the same way.
const DRAWER_AREAS = ['edge', 'footer', 'header-action'];
// The width ladder (owner decision C157 (2)): size, the token the sheet gives
// the step, the step in words. A host width that is none of them is still
// drawn until the date and said once (noteOffLadderWidth).
const LADDER_WIDTHS = [['1/2', 'var(--sf-g0)', '20rem'], ['1', 'var(--sf-g2)', '24rem'], ['2', 'var(--sf-g5)', '30rem']];
const OFF_LADDER_SINCE = '2026-11-15';
const OFF_LADDER_UNTIL = '2027-01-01';
const AREA_SELECTORS = [['edge', '[data-sf-drawer-edge]'], ['footer', '[data-sf-drawer-foot]'], ['header-action', '[data-sf-drawer-action]']];
const asksFor = (node, slot) => node.nodeType === 1 && node.getAttribute('slot') === slot;
const asksForArea = (node) => DRAWER_AREAS.some((slot) => asksFor(node, slot));
const PORTAL_ATTRIBUTE = 'data-sf-drawer-portal';
// A box that holds its own overlays (sf-drawer, sf-modal); the drawer's own
// name came first and is read until the change journal retires it.
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';

// The open drawers, in the order they opened: the panels of the one document
// layer stack (layer-stack.js, standard 1.3.8 §19.1). The drawer kept an array
// of its own, so a modal opened from a drawer did not know it was above it
// (simai/ui-source#36) and a drawer opened from a modal was drawn under it
// (simai/ui-source#37).
const openDrawers = () => openLayers('panel').filter((owner) => owner?.localName === DRAWER_SELECTOR);
// Below this width of the dock host (or of the window, when the page names no
// host) docked panels overlay the page instead of narrowing it, unless the
// drawer names its own (dock-breakpoint, or --sf-drawer-dock-breakpoint).
const DOCK_MIN_REM = 48;
const PLACEMENTS = ['left', 'right', 'inline-start', 'inline-end', 'bottom'];
// The heights a bottom sheet rests at, smallest first: its content (auto, up
// to the room it has), half the room, and all of it.
const SNAPS = ['auto', 'half', 'full'];
// A drag of the sheet farther than a quarter of its height, or faster than
// 0.5 px/ms, is a decision: down closes (or steps full down to half), up opens
// to full (core/js/sheet-swipe.js). A side panel on a phone closes the same
// way toward its own edge (C157 (4)).
// The fields a modal panel's first focus goes to before any other control
// (focusFirst): what a person types or chooses in.
const FIELD = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])'
    + ':not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"])',
  'textarea', 'select', '[contenteditable="true"]',
  '[role="textbox"]', '[role="combobox"]', '[role="searchbox"]', '[role="spinbutton"]',
].join(',');
// How long the first focus waits for a field drawn after the panel opened.
const FIRST_FOCUS_WAIT_MS = 2000;

function joinClasses(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

// A threshold in rem, em or px, in pixels. rem and em both read the root's
// font size: the threshold is the page's, not a box's.
function lengthToPixels(value) {
  const match = /^(\d*\.?\d+)(rem|em|px)$/u.exec(String(value).trim());
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  if (!match) return DOCK_MIN_REM * rem;
  return Number(match[1]) * (match[2] === 'px' ? 1 : rem);
}

// What had focus when a layer came into the page already open: its opener,
// unless nothing did (the body) or the focus is inside the layer itself.
function layerOpener(drawer) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body || active === document.documentElement) return null;
  if (drawer.contains(active) || drawer.getDrawerRoot()?.contains(active)) return null;
  return active;
}

// A switch that names the drawer (owner decision C104 (3), (4)): aria-controls
// (a data-drawer button, a header's menu button) or the older
// data-sf-drawer-open / data-sf-drawer-toggle.
function namesDrawer(element, id) {
  if (!id || !(element instanceof Element)) return false;
  return ['aria-controls', 'data-sf-drawer-open', 'data-sf-drawer-toggle'].some((attribute) =>
    (element.getAttribute(attribute) || '').split(/\s+/u).includes(id));
}

// The box a control is seen in: a host drawn as display: contents (sf-button,
// sf-button-icon) has none of its own, its button has.
function seenBox(element) {
  const own = element.getBoundingClientRect();
  if (own.width || own.height) return own;
  const inner = element.querySelector?.('button, a[href], [tabindex]');
  return inner ? inner.getBoundingClientRect() : own;
}

// What takes the focus back for a switch: itself, or its button (the layer
// stack's one list of what takes focus).
function focusTarget(element) {
  if (!(element instanceof HTMLElement)) return null;
  return focusablesIn(element.parentElement || element).find((node) => node === element || element.contains(node)) || null;
}

// A close of the page's own in the drawer's content (data-drawer="close").
const OWN_CLOSE = '[data-drawer="close"], [data-sf-drawer-close]';

function escapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

const drawerManager = {
  globalBound: false,

  // Opening raises a drawer that is open already: it is the last opened.
  add(drawer) {
    openLayer(drawer, {
      kind: 'panel',
      ...this.declares(drawer),
      returnTo: drawer._lastActive ?? null,
      root: () => drawer.getDrawerRoot(),
      focusIn: () => drawer.focusFirst(),
      onEscape: (event) => drawer.onKeyDown(event),
      onTab: (event) => drawer.onKeyDown(event),
      place: ({index}) => drawer.applyStackPosition(index),
    });
    this.syncDock();
    drawer.syncSwitches();
  },

  // What the drawer declares to the stack (§19.1): a modal drawer locks the
  // page -- unless it stands in an overlay container, which it covers instead
  // -- with the stack's default page lock, and holds the focus. The drawer remembers what it declared, so a docked
  // drawer that starts or stops floating says so again (syncModal).
  declares(drawer) {
    const modal = drawer.modal;
    drawer._declaredModal = modal;
    return {
      locksPage: modal && !drawer.closest(OVERLAY_CONTAINER),
      preserveScrollGap: drawer.preserveScrollGap !== false,
      trapsFocus: modal,
    };
  },

  // Answers whether the drawer was the top layer.
  remove(drawer) {
    const wasTop = closeLayer(drawer, {restoreFocus: false});
    drawer.applyStackPosition(-1);
    this.sync();
    drawer.syncSwitches();
    return wasTop;
  },

  bringToFront(drawer) {
    if (layerIndex(drawer) < 0) return;
    raiseLayer(drawer);
    this.sync();
  },

  isTop(drawer) {
    return isTopLayer(drawer);
  },

  sync() {
    for (const drawer of openDrawers()) drawer.applyStackPosition(layerIndex(drawer));
    this.syncDock();
  },

  // Docked drawers reserve page space: the summed widths of open docked panels
  // per logical side are published as CSS custom properties on the root; any
  // element with data-sf-drawer-dock-host pads itself by them.
  // A docked drawer that has the room is a column of the page and says so on
  // its root (data-sf-drawer-column="true"): it takes the page's surface, not
  // the overlay's (simai/ui-source#26). Without the room it floats over the
  // page, and is drawn as a floating panel.
  syncDock() {
    const root = document.documentElement;
    if (!root) return;
    this.bindDockMedia();
    const sides = {start: 0, end: 0};
    for (const drawer of openDrawers()) {
      if (!drawer.openState || !drawer.docked) continue;
      const column = this.reservesDock(drawer);
      drawer.setDockColumn(column);
      drawer.syncModal();
      if (!column) continue;
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

  // The window's answer for a threshold, as a media query: a length in rem
  // reads the initial font size there, as every media query does.
  dockMedia(threshold) {
    if (typeof globalThis.matchMedia !== 'function') return null;
    this.dockMediaLists ??= new Map();
    let list = this.dockMediaLists.get(threshold);
    if (!list) {
      list = globalThis.matchMedia(`(min-width: ${threshold})`);
      list.addEventListener?.('change', () => this.syncDock());
      this.dockMediaLists.set(threshold, list);
    }
    return list;
  },

  // Redraws only when some open docked drawer's answer changed: syncDock pads
  // the host, and the padding must not wake the host's observer into a loop.
  syncDockIfChanged() {
    if (openDrawers().some((drawer) => drawer.openState && drawer.docked && this.reservesDock(drawer) !== drawer.dockColumn)) {
      this.syncDock();
    }
  },

  bindDockMedia() {
    // The host's own width decides, when the page names a host: a docked
    // drawer inside an editor pane or a documentation example docks by the
    // room that box has, not by the window's (DEV, 2026-10-18).
    const host = document.querySelector('[data-sf-drawer-dock-host]');
    if (host !== this.dockHost) {
      this.dockHostObserver?.disconnect();
      this.dockHost = host;
      this.dockHostObserver = host && typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => this.syncDockIfChanged())
        : null;
      this.dockHostObserver?.observe(host, {box: 'border-box'});
    }
  },

  // Whether a docked drawer takes room from the page: the dock host is at
  // least as wide as the drawer's threshold (48rem), or -- with no host on the
  // page -- the window is.
  reservesDock(drawer) {
    if (this.dockHost === undefined) this.bindDockMedia();
    const host = this.dockHost;
    const threshold = drawer.dockBreakpoint;
    if (host?.isConnected) {
      return host.getBoundingClientRect().width >= lengthToPixels(threshold);
    }
    const media = this.dockMedia(threshold);
    return media ? media.matches : true;
  },

  // The page lock is the layer stack's one lease, taken while any layer that
  // locks the page is open, a modal's too; a drawer whose `modal` or `docked`
  // changed while open says so again.
  syncPageLock() {
    for (const drawer of openDrawers()) updateLayer(drawer, this.declares(drawer));
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
        const drawer = document.getElementById(id);
        // The switch pressed is the opener, also where a press gives a
        // button no focus (Safari): the close stands on its axis and the
        // focus goes back to it (C104 (4)).
        if (drawer && operation !== 'close') drawer._openerHint = trigger;
        drawer?.[operation]?.();
        if (drawer) drawer._openerHint = null;
      });
    });
    this.globalBound = true;
  },
};

class SfDrawer extends DrawerElement {
  // A slotted child (slot="edge", or any other slot the page names) stays
  // where the page wrote it until the drawer draws, and the drawing takes it
  // to the panel in the same task (smart-base holdSlotNode, as sf-modal and
  // sf-header-site). The base took it out of the document when the drawer
  // connected, and a page that found it by id once sf-drawer was defined got
  // null (ui-control evidence 2026-11-11-modal-followups). Unslotted content
  // already stayed in the host until the drawing (_contentNodes).
  static holdsSlotNodesUntilDrawn = true;

  // The manifest's settings, and what the drawer reads more closely: the size
  // ladder's legacy words, the base's template name.
  static get props() {
    return {
      ...super.props,
      templateName: {attribute: 'template', default: 'default'},
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
      // From what width of the dock host (or the window) a docked drawer is a
      // column of the page: a length in rem, em or px; empty for the
      // --sf-drawer-dock-breakpoint variable, else 48rem.
      dockBreakpoint: {attribute: 'dock-breakpoint', default: ''},
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
      'dismissible',
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
    this.onPanelPointerDown = this.onPanelPointerDown.bind(this);
    this.onPanelScroll = this.onPanelScroll.bind(this);
    this._switchVisible = false;
    // The switch that opened the panel and what the head drew for it
    // (C104 (4)): the close's side on the switch's axis, and a close drawn
    // because the open panel covers the switch.
    this._opener = null;
    this._openerHint = null;
    this._closeAxis = '';
    this._coversOpener = false;
    this._openerRechecks = 0;
    this._dockColumn = true;
    this._declaredModal = null;
  }

  connectedCallback() {
    // Static markup is a picture of the drawer, not its content (§5.4).
    if (!this._contentNodes) this._contentNodes = Array.from(this.childNodes).filter((node) => !node.hasAttribute?.('data-sf-static'));
    this.drawerId = this.resolveDrawerId();
    super.connectedCallback();
    drawerManager.bindGlobalEvents();
    globalThis.addEventListener?.('resize', this.onWindowResize, {passive: true});
    if (this.openState) {
      // A drawer put into the page already open was opened by whatever had
      // focus then -- a button that inserted it. It remembers that, as open()
      // does, so closing gives focus back there and not to the nearest
      // landmark. A drawer open in the page's own markup has no opener.
      this._lastActive = layerOpener(this);
      this.noteOpener();
      this._focusReturnAncestors = landmarksAround(this._lastActive);
      this._focusAfterRender = this.modal;
      drawerManager.add(this);
    }
    // Switches written after the drawer in the page are there a frame later.
    globalThis.requestAnimationFrame?.(() => this.syncSwitches());
  }

  disconnectedCallback() {
    this._areaObserver?.disconnect();
    this._areaObserver = null;
    this._edgeObserver?.disconnect();
    this._edgeObserver = null;
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
    if ((name === 'docked' || name === 'dock-breakpoint' || name === 'placement' || name === 'size' || name === 'width') && this.openState) {
      requestAnimationFrame(() => { drawerManager.syncDock(); drawerManager.sync(); });
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  get openState() {
    return this.hasAttribute('open');
  }

  get sheet() {
    return this.placement === 'bottom';
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
      if (getComputedStyle(element).visibility === 'hidden') return false;
      // Under the open panel it is not on screen: a panel as wide as a phone
      // covers the switch that opened it, and a panel that drew no close then
      // had none at all (recipe admin-frame, 2026-11-15).
      return !(this.openState && this.coversElement(element));
    });
  }

  onWindowResize() {
    if (!this._isMounted) return;
    if (this.openState) {
      this.recheckOpener();
      // The room beside a panel of a fixed width changes with the window
      // alone, which no observer of the panel sees.
      this.onPanelScroll();
      this.placeCloseOnAxis();
      return;
    }
    if (!this.controlled) return;
    const visible = this.hasVisibleSwitch();
    if (visible !== this._switchVisible) this.requestComponentUpdate('controlled');
  }

  // The switches outside the panel that name it, in document order.
  namingSwitches() {
    const id = this.drawerId || this.id;
    if (!id || typeof document === 'undefined') return [];
    const root = this.getDrawerRoot();
    return [...document.querySelectorAll('[aria-controls], [data-sf-drawer-open], [data-sf-drawer-toggle]')]
      .filter((element) => namesDrawer(element, id) && !root?.contains(element) && !this.contains(element));
  }

  // Notes the switch that opens the panel (C104 (4)): the one the drawer's
  // own press handler saw, else the switch naming it that holds the focus
  // (a page's script that calls open() from its button). Any other focused
  // element -- a row of a list -- is not a switch, and the close keeps its
  // place. Where the focus was nowhere (Safari gives a pressed button none),
  // the focus goes back to the switch.
  noteOpener() {
    const id = this.drawerId || this.id;
    let opener = this._openerHint?.isConnected ? this._openerHint : null;
    const active = document.activeElement;
    for (let node = active; !opener && node instanceof Element && node !== document.body; node = node.parentElement) {
      if (namesDrawer(node, id)) opener = node;
    }
    this._opener = opener;
    this._openerRechecks = 0;
    const nowhere = !(this._lastActive instanceof HTMLElement) || this._lastActive === document.body
      || this._lastActive === document.documentElement;
    // A page's own button that calls toggle() from a press that gave it no
    // focus: the switch naming the panel on screen is the one pressed.
    const back = opener || (nowhere ? this.knownOpener() : null);
    if (nowhere && back) this._lastActive = focusTarget(back) || this._lastActive;
  }

  // The switch the close stands on the axis of: the one that opened the
  // panel while it is on the page and drawn, else the first switch naming
  // the panel that is (a panel open in the page's markup, a header's menu
  // button).
  knownOpener() {
    const drawn = (element) => element?.isConnected && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== 'hidden' && seenBox(element).width > 0;
    if (drawn(this._opener)) return this._opener;
    return this.namingSwitches().find(drawn) || null;
  }

  // The panel's box where it rests open: its slide (transform) and a
  // finger's push (translate) taken out, so a closed or opening panel
  // answers where it will stand.
  panelBox() {
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const style = getComputedStyle(panel);
    let x = 0;
    let y = 0;
    if (style.transform && style.transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
      const matrix = new DOMMatrixReadOnly(style.transform);
      x += matrix.m41;
      y += matrix.m42;
    }
    if (style.translate && style.translate !== 'none') {
      const [tx = '0', ty = '0'] = style.translate.split(/\s+/u);
      x += parseFloat(tx) || 0;
      y += parseFloat(ty) || 0;
    }
    return {left: rect.left - x, right: rect.right - x, top: rect.top - y, bottom: rect.bottom - y, width: rect.width, panel};
  }

  // Whether the open panel covers an element: its centre is on the panel.
  coversElement(element) {
    if (this.docked && this._dockColumn) return false;
    const box = this.panelBox();
    if (!box || !element) return false;
    const seen = seenBox(element);
    const x = seen.left + seen.width / 2;
    const y = seen.top + seen.height / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }

  // The open panel covers the switch that opened it.
  coversOpener() {
    if (!this.openState) return false;
    const opener = this.knownOpener();
    return Boolean(opener && this.coversElement(opener));
  }

  // A close of the page's own in the content or the foot.
  hasOwnClose() {
    const root = this.getDrawerRoot();
    if (root?.querySelector(`:is([data-sf-drawer-body], [data-sf-drawer-foot]) :is(${OWN_CLOSE})`)) return true;
    return (this._contentNodes || []).some((node) => node.nodeType === 1 && (node.matches(OWN_CLOSE) || node.querySelector(OWN_CLOSE)));
  }

  // The side of the head the close stands at on the opener's axis (owner
  // decision C104 (4), as sf-header-site): 'start' or 'end' of the head's
  // line when the switch that opened the panel stands on the panel's own
  // side of the frame (the window, or the overlay container that holds the
  // drawer); '' otherwise, and the close keeps its place at the end. A
  // bottom sheet, a nested panel (its head starts with «Назад»), a column of
  // the page and a close outside the panel keep theirs.
  closeAxisSide() {
    if (this.sheet || this.closePlacement === 'outside' || (this.docked && this._dockColumn)) return '';
    if (typeof document === 'undefined' || this.nestedUnder()) return '';
    const opener = this.knownOpener();
    if (!opener) return '';
    const seen = seenBox(opener);
    const frame = this.closest(OVERLAY_CONTAINER)?.getBoundingClientRect()
      || {left: 0, width: globalThis.innerWidth || document.documentElement.clientWidth};
    const onLeft = seen.left + seen.width / 2 < frame.left + frame.width / 2;
    const rtl = getComputedStyle(this).direction === 'rtl';
    // A panel as wide as its frame (a phone, size full) stands over both
    // sides: the close goes to the switch's side, wherever the panel came
    // from.
    const box = this.panelBox();
    const whole = Boolean(box && box.width >= frame.width - 1);
    if (!whole && onLeft !== (this.stackEdge === 'left')) return '';
    // The switch is the outermost control of its row on that side, as a
    // menu button at the edge of a bar is: a second button of a toolbar
    // («Свойства» after «Структура») would pull the close into the middle of
    // the head.
    if (!this.outermostInRow(opener, seen, onLeft)) return '';
    return onLeft !== rtl ? 'start' : 'end';
  }

  // No control of the page stands in the switch's row between it and the
  // frame's edge on its side (the layer stack's list of what takes focus).
  outermostInRow(opener, seen, onLeft) {
    const root = this.getDrawerRoot();
    const axis = seen.left + seen.width / 2;
    return !focusablesIn(document.body).some((node) => {
      if (opener.contains(node) || node.contains(opener) || root?.contains(node) || this.contains(node)) return false;
      const box = node.getBoundingClientRect();
      const middle = box.top + box.height / 2;
      if (middle < seen.top || middle > seen.bottom) return false;
      const centre = box.left + box.width / 2;
      return onLeft ? centre < axis : centre > axis;
    });
  }

  // After a drawing or a resize: what the head drew still holds (the opener
  // moved, the panel came to cover it); one more drawing per change, at most
  // a few per opening.
  recheckOpener() {
    if (!this.openState || this._openerRechecks > 3) return;
    const side = this.closeAxisSide();
    const covers = this.coversOpener();
    const visible = this.controlled && this.hasVisibleSwitch();
    if (side !== this._closeAxis || covers !== this._coversOpener || visible !== this._switchVisible) {
      this._openerRechecks += 1;
      this.requestComponentUpdate('opener');
    }
  }

  // The close on the opener's axis (C104 (4)): the head's padding on the
  // close's side is the distance from the panel's edge to the axis less half
  // the close, held inside the panel (the close and the head's padding on
  // the other side). Measured, as the edge's room is: the axis is the
  // page's, not a step of the space system.
  placeCloseOnAxis() {
    const root = this.getDrawerRoot();
    if (!root) return;
    const side = this.openState ? this._closeAxis : '';
    const head = root.querySelector('.sf-drawer-head');
    const close = head?.querySelector('.sf-drawer-close');
    const opener = side ? this.knownOpener() : null;
    const box = opener ? this.panelBox() : null;
    const whole = root.hasAttribute('data-sf-drawer-edge-in-head') && root.querySelector('[data-sf-drawer-edge]')?.childElementCount;
    if (!side || !close || !box || (side === 'end' && whole)) {
      root.removeAttribute('data-sf-drawer-close-axis');
      root.style.removeProperty('--sf-drawer--close-axis');
      return;
    }
    const seen = seenBox(opener);
    const axis = seen.left + seen.width / 2;
    const width = close.getBoundingClientRect().width;
    const panelStyle = getComputedStyle(box.panel);
    // The panel's edge on the close's side, physical.
    const onLeft = (side === 'start') !== (panelStyle.direction === 'rtl');
    const border = parseFloat(onLeft ? panelStyle.borderLeftWidth : panelStyle.borderRightWidth) || 0;
    const fromEdge = (onLeft ? axis - box.left : box.right - axis) - border;
    const headStyle = getComputedStyle(head);
    const other = parseFloat(side === 'start' ? headStyle.paddingInlineEnd : headStyle.paddingInlineStart) || 0;
    const limit = box.width - border - width - other;
    // The head's room before the close on its side.
    const room = Math.round(Math.max(0, Math.min(fromEdge - width / 2, limit)) * 100) / 100;
    root.setAttribute('data-sf-drawer-close-axis', side);
    root.style.setProperty('--sf-drawer--close-axis', `${room}px`);
  }

  // A modal drawer -- the default -- covers the page while it floats over it:
  // the scrim takes presses, Tab stays inside, the page does not scroll, and
  // focus goes back to what opened it. A docked drawer that is a column of the
  // page is part of the page layout and is modeless; without the room (the dock
  // host or the window narrower than its dock-breakpoint) it floats over the
  // page and is modal like any other drawer (q-a49e2045c1: a chat's side panel
  // on a phone). modal="false" keeps a drawer modeless everywhere.
  get modal() {
    if (!this.getBooleanAttr('modal', true)) return false;
    if (!this.docked) return true;
    return typeof document !== 'undefined' && !drawerManager.reservesDock(this);
  }

  // A docked drawer that started or stopped floating while open declares it
  // to the stack again (the trap, the page lock), redraws its scrim, role and
  // aria-modal, and -- now modal and on top -- takes the focus if it is
  // outside (§19.2).
  syncModal() {
    if (!this.openState || layerIndex(this) < 0) return;
    const modal = this.modal;
    if (modal === this._declaredModal) return;
    updateLayer(this, drawerManager.declares(this));
    this.requestComponentUpdate('modal');
    if (!modal || !drawerManager.isTop(this)) return;
    globalThis.requestAnimationFrame?.(() => {
      // The panel and its edge are the window (a focus on the edge is inside).
      const root = this.getDrawerRoot();
      const inside = ['[data-sf-drawer-panel]', '[data-sf-drawer-edge]']
        .some((area) => root?.querySelector(area)?.contains(document.activeElement));
      if (this.openState && this.modal && !inside) this.focusFirst();
    });
  }

  // Whether the open panel draws its scrim: a modal one with overlay on.
  get drawsScrim() {
    return this.modal && this.overlay !== false;
  }

  // A bottom sheet floats over the page; it is never a column of it.
  get docked() {
    return this.getBooleanAttr('docked', false) && !this.sheet;
  }

  // The physical edge the panel opens from, so left and inline-start count as
  // one edge in a left-to-right page and as two in a right-to-left one.
  get stackEdge() {
    const placement = this.placement;
    if (!placement.startsWith('inline')) return placement;
    const rtl = (this.closest('[dir]')?.getAttribute('dir') || document.documentElement.dir) === 'rtl';
    return (placement === 'inline-start') !== rtl ? 'left' : 'right';
  }

  // The width of the dock host (or of the window) from which this docked
  // drawer is a column of the page; narrower, it floats over the page. The
  // drawer's dock-breakpoint, else --sf-drawer-dock-breakpoint where it
  // stands, else 48rem (simai/ui-source#25: a chat's panel needs 64rem).
  get dockBreakpoint() {
    const own = (this.getAttribute('dock-breakpoint') || '').trim();
    if (own) return own;
    const themed = typeof getComputedStyle === 'function' && this.isConnected
      ? getComputedStyle(this).getPropertyValue('--sf-drawer-dock-breakpoint').trim()
      : '';
    return themed || `${DOCK_MIN_REM}rem`;
  }

  // A switch outside the panel that shows and hides it (data-drawer="toggle"
  // naming it in aria-controls, or data-sf-drawer-toggle) says whether the
  // panel is shown: aria-expanded follows the panel, so a button that hides a
  // docked column reads as pressed while the column is there
  // (simai/ui-source#25).
  syncSwitches() {
    const id = this.drawerId || this.id;
    if (!id || typeof document === 'undefined') return;
    const expanded = this.openState ? 'true' : 'false';
    for (const element of document.querySelectorAll('[data-drawer="toggle"][aria-controls], [data-sf-drawer-toggle]')) {
      const named = (element.getAttribute('aria-controls') || element.getAttribute('data-sf-drawer-toggle') || '').split(/\s+/u);
      if (named.includes(id)) element.setAttribute('aria-expanded', expanded);
    }
  }

  // Whether this docked drawer is, at the moment, a column of the page.
  get dockColumn() {
    return this._dockColumn;
  }

  setDockColumn(column) {
    this._dockColumn = column;
    this.getDrawerRoot()?.setAttribute('data-sf-drawer-column', column ? 'true' : 'false');
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

  resolveDrawerId() {
    const existing = this.id || this.getAttribute('drawer-id');
    if (existing) {
      // A drawer-id the page wrote is also the element's id, as it was; the
      // path id the drawer made for itself is not.
      if (!this.id && existing !== this._generatedDrawerId) this.id = existing;
      return existing;
    }
    // Its path id (§7.1.1): sf-drawer-<n> in document order, not a random one
    // (simai/ui-source#41). It names the portal and the title, not the element:
    // an id written on the element would change the order the next drawer
    // without one counts in, and two drawers would share a path.
    const generated = partId(instancePath(this));
    this._generatedDrawerId = generated;
    this.setAttribute('drawer-id', generated);
    return generated;
  }

  templateContext() {
    if (this.docked && typeof document !== 'undefined') this._dockColumn = drawerManager.reservesDock(this);
    this._switchVisible = this.controlled && this.hasVisibleSwitch();
    this._coversOpener = typeof document !== 'undefined' && this.coversOpener();
    this._closeAxis = typeof document !== 'undefined' ? this.closeAxisSide() : '';
    // A panel that covers the switch that opened it always offers a close
    // (C104): a phone-wide panel over its ☰ with show-close="false" and no
    // close of the page's own in it could be closed only by Escape.
    const coveredWithoutClose = this._coversOpener && !this.showClose && !this.hasOwnClose();
    return this.createTemplateContext({
      drawerId: this.drawerId || this.resolveDrawerId(),
      // A path id (§7.1.1): <path>--title.
      titleId: partId(instancePath(this), 'title'),
      open: this.openState,
      placement: this.placement,
      overlay: this.overlay,
      modal: this.modal,
      docked: this.docked,
      column: this.docked && this._dockColumn,
      size: this.size,
      showClose: (this.showClose && !this._switchVisible) || coveredWithoutClose,
      // The close's side on the opener's axis (C104 (4)): 'start' draws it
      // first in the head, before the title.
      closeAxis: this._closeAxis,
      controlled: this.controlled,
      sheet: this.sheet,
      snap: this.snap,
      handleLabel: this.sfWord('handle-label'),
      // Opened from a panel at the same edge: this one is drawn inside it,
      // with the way back in the head (C157 (6)).
      nested: Boolean(this.nestedUnder()),
      backLabel: this.sfWord('back-label'),
      headerAction: this.asksForHeaderAction(),
      blockStart: this.getAttribute('block-start') || '',
      closePlacement: this.closePlacement,
      title: this.getAttribute('heading') || '',
      // The name: label, else the heading the panel is labelled by (§4.8).
      label: this.getAttribute('label') || '',
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

  // The resolved z-index the panel is drawn at; the attribute replaces it.
  get zIndex() {
    return this.drawerZIndex;
  }

  set zIndex(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('z-index');
    else this.setAttribute('z-index', String(value));
  }

  // Its place in the one layer scale (--sf-z-index-layer, in opening order
  // with every other layer); a page's --sf-drawer-z-index moves the base, the
  // z-index attribute replaces it.
  get drawerZIndex() {
    const base = layerZIndexAt(0);
    const rise = this._stackIndex > 0 ? layerZIndexAt(this._stackIndex) - base : 0;
    return this.getAttribute('z-index')
      || `calc(var(--sf-drawer-z-index, ${base}) + ${rise})`;
  }

  // The shared rule, not a second reading of it. This asked the document
  // directly, which misses a region that names its own language and leaves a
  // product unable to register a third -- the same two faults admin-menu had.
  get defaultCloseLabel() {
    return this.sfWord('close-label');
  }

  async renderComponent(changedAttributes = []) {
    const token = ++this._renderToken;
    const result = await this.resolveTemplateResult(changedAttributes);
    if (!this._isMounted || token !== this._renderToken) return;
    const portal = this.resolvePortalRoot();
    // The portal stands at the end of the body; it speaks and looks as the
    // drawer does where it stands (standard 1.3.8 §19.1), with the variables
    // of its area but none of its own private --sf-drawer-* names
    // (simai/ui-source#46 item 1, as sf-modal).
    carryLayerOrigin(portal, this, {variables: DRAWER_VARIABLES, area: true, except: ['--sf-drawer-']});
    // Static markup printed for the first paint goes as the drawer draws
    // (standard 1.3.8 §5.4); the panel itself is rendered in the portal.
    if (!this.__sfFirstPaintEnded) {
      this.__sfFirstPaintEnded = true;
      this.prepareRenderContainer();
    }
    // Out of view until the drawer's sheets are applied (the base's portal
    // gate): under held-back sheets the closed panel stood in view beside
    // the page and the page moved when they came. A modal drawer that opened
    // in the meantime takes its first focus once it shows, which a hidden
    // panel could not.
    this.holdPortalUntilStyled(portal, () => {
      const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
      if (this.openState && this.modal && panel && !panel.contains(document.activeElement)) this.focusFirst();
    });
    this.drawInto(result, portal);
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
      // An action that arrives for a head that is not drawn draws it first.
      if (root && !root.querySelector('[data-sf-drawer-action]') && this.asksForHeaderAction()) this.requestComponentUpdate('header-action');
      if (root) this.projectAreas(root);
    });
    this._areaObserver.observe(this, {childList: true});
  }

  // Whether a child asks for the head's action: a head with no title and no
  // close is still drawn for it.
  asksForHeaderAction() {
    return [...(this._contentNodes || []), ...this.children].some((node) => asksFor(node, 'header-action'));
  }

  projectAreas(root) {
    for (const [slot, selector] of AREA_SELECTORS) {
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
    const panel = root.querySelector('[data-sf-drawer-panel]');
    panel?.removeEventListener('pointerdown', this.onPanelPointerDown);
    panel?.addEventListener('pointerdown', this.onPanelPointerDown);
    for (const scroller of [panel, root.querySelector('[data-sf-drawer-body]')]) {
      scroller?.removeEventListener('scroll', this.onPanelScroll);
      scroller?.addEventListener('scroll', this.onPanelScroll, {passive: true});
    }
    this.observeScrollEdges(root);
    this.applyStackPosition();
    this.noteOffLadderWidth(root);
    // The close on the opener's axis, once the head is laid out; then
    // whether the drawing still holds for the opener (C104 (4)).
    this.placeCloseOnAxis();
    globalThis.requestAnimationFrame?.(() => {
      this.placeCloseOnAxis();
      this.recheckOpener();
    });
    this.observeDock(root);
    // A closed drawer's panel content starts after the page's first paint,
    // out of view (its panel is inert, so the Loader leaves it until it
    // opens): a page that waited for a tag in it before opening it waited for
    // ever (layer-stack.js startClosedLayerContent, as sf-modal).
    if (!this.openState && !this._closedContentStarted) {
      this._closedContentStarted = true;
      startClosedLayerContent(() => this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]'));
    }
    // Lifecycle copies retire (vocabulary §5.1, §16.13): still sent until their
    // date, and a listener that reads one is noted.
    const eventName = this._hasEmittedReady ? 'drawer:update' : 'drawer:ready';
    this.dispatchEvent(retiredEvent(eventName, {component: this, drawer: this, drawerId: this.drawerId, root}));
    this._hasEmittedReady = true;
    if (this._focusAfterRender || this._emitAfterOpen) {
      this._focusAfterRender = false;
      requestAnimationFrame(() => {
        if (this.openState && this.modal) this.focusFirst();
        if (this._emitAfterOpen) this.emitDrawerEvent('opened');
        this._emitAfterOpen = false;
      });
    }
  }

  template() {
    const context = this.templateContext();
    // The close is sf-button-close (owner decision C14: one close button, its
    // own component), at the icon button's 1/3 step as before. Its button
    // carries sf-drawer-close (and close-class), the class a page and a theme
    // address; the host carries data-sf-drawer-close, which a press on the
    // button reaches as it bubbles (handleRootClick).
    // Outside the panel the close stands on the scrim (study VP-16): it takes
    // the look of a control over a picture (C14 (3), the core glass role --
    // a dark round plate, a white cross, the same in both themes). In the
    // theme's grey it stood on the scrim at about 1:1 and could not be seen.
    const outside = context.closePlacement === 'outside' && !this._edgeInHead;
    const closeButton = context.showClose
      ? html`<sf-button-close
          size="1/3"
          appearance=${outside ? 'media' : 'ghost'}
          root-class=${joinClasses(
            'sf-drawer-close m-0',
            context.closePlacement === 'outside' && 'sf-drawer-close--outside',
            context.closeClass,
          )}
          aria-label=${context.closeLabel}
          data-drawer="close"
          data-sf-drawer-close=${context.drawerId}
        ></sf-button-close>`
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
      data-sf-drawer-column=${context.column ? 'true' : 'false'}
      data-sf-drawer-snap=${context.sheet ? context.snap : nothing}
      aria-hidden=${context.open ? 'false' : 'true'}
    >
      <div class=${joinClasses('sf-drawer-overlay', context.overlayClass)} data-sf-drawer-overlay ?hidden=${!context.modal || !context.overlay}></div>
      <section
        class=${joinClasses('sf-drawer-panel', context.panelClass)}
        style=${`${context.width ? `--sf-drawer-width:${context.width};` : ''}${context.stackOffset ? `--sf-drawer-stack-offset:${context.stackOffset};` : ''}${context.gutter ? `--sf-drawer-gutter:${context.gutter};` : ''}${context.panelStyle || ''}`}
        role=${context.docked && !context.modal ? 'region' : 'dialog'}
        aria-modal=${context.modal ? 'true' : nothing}
        aria-label=${context.label || nothing}
        aria-labelledby=${context.title ? context.titleId : nothing}
        tabindex="-1"
        ?inert=${!context.open}
        data-sf-drawer-panel
      >
        ${context.sheet ? html`<button type="button" class="sf-drawer-handle" aria-label=${context.handleLabel}
            data-sf-drawer-handle><span class="sf-drawer-handle-bar" aria-hidden="true"></span></button>` : nothing}
        ${context.title || (context.showClose && context.closePlacement === 'inside') || context.headerClass || context.nested || context.headerAction
                ? html`
                  <header class=${joinClasses('sf-drawer-head', context.headerClass)}>
                    ${context.nested ? html`<sf-button-icon class="sf-drawer-back" icon="arrow_back" appearance="ghost"
                        scheme="on-surface" size="1/3" aria-label=${context.backLabel} title=${context.backLabel}
                        data-sf-drawer-back></sf-button-icon>` : nothing}
                    ${context.closePlacement === 'inside' && context.closeAxis === 'start' ? closeButton : nothing}
                    ${context.title ? html`<div class="sf-drawer-title" id=${context.titleId}>${context.title}</div>` : nothing}
                    <div class="sf-drawer-action" data-sf-drawer-action></div>
                    ${context.closePlacement === 'inside' && context.closeAxis !== 'start' ? closeButton : nothing}
                  </header>`
                : nothing}
        <div class=${joinClasses('sf-drawer-body', context.bodyClass)} data-sf-drawer-body></div>
        <footer class="sf-drawer-foot" data-sf-drawer-foot></footer>
      </section>
      <div class="sf-drawer-edge" data-sf-drawer-edge>
        ${context.closePlacement === 'outside' ? closeButton : nothing}
      </div>
    </div>`;
  }

  // Opens the panel, or raises an open one. Answers an outcome (§4.4):
  // refused when a listener prevents sf-drawer-open.
  open(options = {}) {
    options = options || {};
    if (this.openState) {
      drawerManager.bringToFront(this);
      return applied();
    }
    if (options.emit !== false && !this.emitDrawerEvent('open', true)) return refused('prevented');
    this._lastActive = document.activeElement;
    this.noteOpener();
    this._focusReturnAncestors = landmarksAround(this._lastActive);
    this.syncOpenAttribute(true);
    drawerManager.add(this);
    this._focusAfterRender = this.modal;
    this._emitAfterOpen = options.emit !== false;
    this.requestComponentUpdate('open');
    return applied();
  }

  // options.reason says why (standard 1.3.8 §19.3): close, escape, outside,
  // cancelled or api, the default.
  // A listener that prevents sf-drawer-close keeps it open, and the action
  // answers refused (§8); `unsaved` is the setting (§19.3).
  close(options = {}) {
    options = options || {};
    if (!this.openState) return refused('closed');
    const reason = typeof options.reason === 'string' ? options.reason : 'api';
    if (options.emit !== false && !this.emitDrawerEvent('close', true, {reason, unsaved: Boolean(this.unsaved)})) return refused('prevented');
    this.syncOpenAttribute(false);
    const wasTop = drawerManager.remove(this);
    this.requestComponentUpdate('close');
    this.returnFocus(wasTop);
    if (options.emit !== false) this.emitDrawerEvent('closed', false, {reason});
    return applied();
  }

  // A drawer that closes under another layer moves no focus (§19.2). A modal
  // drawer on top gives it back by the stack's rule; a modeless one to what
  // was active when it opened, as before.
  returnFocus(wasTop) {
    if (!wasTop) return;
    if (this.modal) returnLayerFocus(true, this._lastActive, this._focusReturnAncestors);
    else this.restoreFocus();
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
      this.noteOpener();
      this._focusReturnAncestors = landmarksAround(this._lastActive);
      this._focusAfterRender = this.modal;
      drawerManager.add(this);
    } else {
      this.returnFocus(drawerManager.remove(this));
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

  applyStackPosition(index = layerIndex(this)) {
    this._stackIndex = index;
    const root = this.getDrawerRoot();
    if (root) {
      root.style.zIndex = this.drawerZIndex;
      // Depth is the number of open, undocked drawers below this one at the
      // same edge; the panel stands that many stack offsets in from the edge.
      const edge = this.stackEdge;
      const drawers = openDrawers();
      // One panel at an edge (C157 (6)): a drawer opened from a floating
      // panel at the same edge is drawn inside it -- the panel below hides
      // while it is open, with no slide, and shows again when it closes; the
      // nested one draws «Назад» in its head. The stack's offsets (the
      // panel below showing past the one above, stack-offset) no longer
      // apply between them.
      // A closed drawer keeps the marks it had: a nested panel closing
      // («Назад») goes at once, as it came, rather than sliding out over the
      // panel it was drawn inside of.
      const nested = index >= 0 && Boolean(this.nestedUnder());
      if (index >= 0) {
        const under = drawers.slice(drawers.indexOf(this) + 1)
          .some((drawer) => drawer.openState && drawer.nestedUnder() === this);
        root.toggleAttribute('data-sf-drawer-nested', nested);
        root.toggleAttribute('data-sf-drawer-under', under);
        if (nested !== Boolean(this._drawnNested)) {
          this._drawnNested = nested;
          if (this._isMounted) this.requestComponentUpdate('nested');
        }
      }
      const depth = this.docked || index < 0 || nested ? 0 : drawers
        .slice(0, Math.max(0, drawers.indexOf(this)))
        .filter((drawer) => drawer.openState && !drawer.docked && drawer.stackEdge === edge)
        .length;
      root.style.setProperty('--sf-drawer-stack-depth', String(depth));
      // One scrim (C16, C20: black at 64; study DR-8): a modal drawer opened
      // above this one draws the scrim, and this one's fades out under it.
      // Each drew its own, and a nested panel stood over two -- about 87 %
      // black. The scrim under the top panel takes the press, which closes
      // the top panel only, as before.
      const above = index < 0 ? [] : drawers.slice(drawers.indexOf(this) + 1);
      const covered = above.some((drawer) => drawer.openState && drawer.drawsScrim);
      root.toggleAttribute('data-sf-drawer-covered', covered);
    }
    return this;
  }

  // The first focus of a modal panel (study DR-12, dispatcher 2026-11-14, as
  // sf-modal's initial focus does it for a window): the element the page
  // marked with `autofocus`, else the first field of the content (a text
  // field, a list, a text area), else its first control, else the panel. The
  // head's close and the edge do not count: they are the panel's, not the
  // content's. The panel itself took the focus before, so a filter panel
  // opened with its search field one Tab away. A field drawn after the panel
  // opened (an sf-input still loading) is waited for, frame by frame for up
  // to two seconds, while the focus is still on the panel; anything the
  // person does in between wins.
  focusFirst() {
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    if (!panel) return;
    const target = this.firstFocusIn(panel);
    (target || panel).focus?.({preventScroll: true});
    if (target) return;
    const until = performance.now() + FIRST_FOCUS_WAIT_MS;
    const retry = () => {
      if (document.activeElement !== panel || !panel.isConnected || !this.openState) return;
      const late = this.firstFocusIn(panel);
      if (late) late.focus({preventScroll: true});
      else if (performance.now() < until) requestAnimationFrame(retry);
    };
    requestAnimationFrame(retry);
  }

  firstFocusIn(panel) {
    const marked = panel.querySelector('[autofocus]');
    if (marked && !marked.closest('[inert], [hidden]')) {
      const own = focusablesIn(marked.parentElement).find((node) => node === marked || marked.contains(node));
      if (own) return own;
    }
    const body = panel.querySelector('[data-sf-drawer-body]');
    const stops = focusablesIn(body).filter((node) => node.tabIndex >= 0);
    return stops.find((node) => node.matches(FIELD)) || stops[0] || null;
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
    this.emitDrawerEvent('snapped', false, {snap});
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
  // pushed up, or settles back (core/js/sheet-swipe.js, the one sheet of
  // C157 (5)). Controls inside the head keep their presses.
  onSheetPointerDown(event) {
    if (!this.sheet || !this.openState || event.button !== 0) return;
    const grip = event.currentTarget;
    if (grip.classList.contains('sf-drawer-head') && startsOnControl(event.target)) return;
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    if (!panel) return;
    trackSwipe(event, {
      surface: panel,
      direction: 'down',
      variable: '--sf-drawer-sheet-drag',
      onEnd: ({dismiss, back}) => {
        if (dismiss) {
          if (this.snap === 'full') this.setSnap('half');
          else this.closeChain('close');
        } else if (back) {
          this.setSnap('full');
        }
      },
    });
  }

  // A side panel on a phone is the whole screen (C56), and a finger pushing
  // it toward its own edge closes it (owner decision C157 (4)): the panel
  // follows past the slop and closes past a quarter of its width or on a
  // flick, as the sheet does downwards. Only touch and pen: a mouse drags
  // to select text. A control, a field, or a box that scrolls sideways keeps
  // the gesture.
  onPanelPointerDown(event) {
    if (this.sheet || !this.openState || event.button !== 0 || event.pointerType === 'mouse') return;
    if (this.docked && this.dockColumn) return;
    // The whole screen -- a phone (C56) or size full -- read off the panel
    // itself, not a second copy of the stylesheet's breakpoint.
    const panel = event.currentTarget;
    if (panel.getBoundingClientRect().width < globalThis.innerWidth - 1) return;
    if (startsOnControl(event.target) || scrollsAlong(event.target, panel, 'x')) return;
    trackSwipe(event, {
      surface: panel,
      direction: this.stackEdge === 'left' ? 'left' : 'right',
      variable: '--sf-drawer-swipe',
      onEnd: ({dismiss}) => { if (dismiss) this.closeChain('close'); },
    });
  }

  // The panel this one is drawn inside of (C157 (6)): the nearest open drawer
  // below it at the same edge, both floating over the page (not a column of
  // it, not a sheet). The next item opens inside the same panel, with the way
  // back in its head; a panel at another edge or a window is a new layer.
  nestedUnder() {
    if (!this.openState || this.sheet || (this.docked && this.dockColumn)) return null;
    const drawers = openDrawers();
    const at = drawers.indexOf(this);
    if (at <= 0) return null;
    const edge = this.stackEdge;
    for (let i = at - 1; i >= 0; i -= 1) {
      const below = drawers[i];
      if (!below.openState || below.sheet || (below.docked && below.dockColumn)) continue;
      if (below.stackEdge === edge) return below;
    }
    return null;
  }

  // The close of a nested panel closes the whole panel: this one and every
  // one it is drawn inside of, top first. «Назад» and Escape close the top
  // one only. A listener that refuses one stops the walk there.
  closeChain(reason = 'close') {
    const chain = [];
    for (let drawer = this; drawer; drawer = drawer.nestedUnder()) chain.push(drawer);
    let outcome = applied();
    for (const drawer of chain) {
      outcome = drawer.close({reason});
      if (outcome?.outcome === 'refused') break;
    }
    return outcome;
  }

  // The body's edges (as sf-modal's, owner decision C159 (3)): a hairline
  // under the head only while content is above it, over the foot only while
  // content is below it. The panel scrolls, or its body when a resizer
  // stands in it.
  onPanelScroll() {
    const root = this.getDrawerRoot();
    if (!root) return;
    const panel = root.querySelector('[data-sf-drawer-panel]');
    const body = root.querySelector('[data-sf-drawer-body]');
    const scroller = [body, panel].find((node) => node && node.scrollHeight > node.clientHeight + 1
      && /(auto|scroll)/u.test(getComputedStyle(node).overflowY));
    const top = scroller ? scroller.scrollTop : 0;
    const rest = scroller ? scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop : 0;
    root.toggleAttribute('data-sf-drawer-more-start', top > 1);
    root.toggleAttribute('data-sf-drawer-more-end', rest > 1);
    this.noteWhole(root, panel);
  }

  // A side panel that fills the screen -- a phone (C56, C157 (4)) or size
  // full -- has no outside, and a panel that leaves less room beside it than
  // its edge controls take has none to speak of (study view-property-base,
  // ui-admin.test record r-077): its edge controls (an outside close,
  // «Открыть полностью», «Скопировать ссылку») come into the head's row at
  // its end as ordinary icon buttons, on the panel, not on a scrim (no glass
  // plate), the close last (C14), and the head keeps their room
  // (data-sf-drawer-edge-in-head, --sf-drawer-edge-room); the title keeps the
  // rest of the row. data-sf-drawer-whole still says the panel fills the
  // screen. Placed along the top they covered the title.
  noteWhole(root, panel) {
    const edge = root.querySelector('[data-sf-drawer-edge]');
    const floating = Boolean(panel && this.openState && !this.sheet && !(this.docked && this.dockColumn));
    const whole = floating && panel.getBoundingClientRect().width >= globalThis.innerWidth - 1;
    root.toggleAttribute('data-sf-drawer-whole', whole);
    const inHead = whole || (floating && this.edgeLacksRoom(root, panel, edge));
    root.toggleAttribute('data-sf-drawer-edge-in-head', inHead);
    if (edge) this.orderEdge(edge, inHead);
    const room = inHead && edge && edge.childElementCount ? Math.ceil(edge.getBoundingClientRect().width) : 0;
    if (room) root.style.setProperty('--sf-drawer-edge-room', `${room}px`);
    else root.style.removeProperty('--sf-drawer-edge-room');
    // In the head the controls end where the panel's head ends: the panel's
    // inline end, measured from the root's (0 when the panel reaches it).
    const end = inHead && !whole ? this.panelEndInset(root, panel) : 0;
    if (end) root.style.setProperty('--sf-drawer-edge-end', `${end}px`);
    else root.style.removeProperty('--sf-drawer-edge-end');
    if (inHead !== Boolean(this._edgeInHead)) {
      this._edgeInHead = inHead;
      // The outside close changes its look with it.
      if (this.closePlacement === 'outside') this.requestComponentUpdate('whole');
    }
  }

  // Whether the column of edge controls beside a floating panel finds room on
  // the screen: the room on the panel's outer side against what the column
  // took there, measured while it stood outside (its span from the panel and
  // as much again to the screen's edge, so it never touches the edge).
  edgeLacksRoom(root, panel, edge) {
    if (!edge || !edge.childElementCount) return false;
    const box = panel.getBoundingClientRect();
    const width = globalThis.innerWidth || document.documentElement.clientWidth;
    const outerRight = box.left < width - box.right;
    const room = outerRight ? width - box.right : box.left;
    if (!root.hasAttribute('data-sf-drawer-edge-in-head')) {
      const seen = edge.getBoundingClientRect();
      if (!seen.width) return false;
      const near = outerRight ? seen.left - box.right : box.left - seen.right;
      this._edgeNeed = Math.ceil(seen.width + 2 * Math.max(0, near));
    }
    return Boolean(this._edgeNeed) && room < this._edgeNeed;
  }

  // The distance from the root's inline end to the panel's, for a panel that
  // does not reach it (an inline-start panel without room beside it).
  panelEndInset(root, panel) {
    const frame = root.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const rtl = getComputedStyle(root).direction === 'rtl';
    return Math.max(0, Math.round(rtl ? box.left - frame.left : frame.right - box.right));
  }

  // A host width off the ladder (owner decision C157 (2): 20 · 24 · 30rem
  // and the whole screen, a width of its own only through sf-resizer within
  // 1/2...2) is still drawn -- an old width keeps working until 2027-01-01,
  // as C157's old names do -- and said once per element in the console and
  // in SF.deprecations.list(), naming the steps. The width and the steps are
  // resolved where the panel stands (its tokens, its root font size).
  noteOffLadderWidth(root) {
    const width = (this.getAttribute('width') || '').trim();
    if (!width || this._offLadderWidth === width || !this.openState || typeof document === 'undefined') return;
    const measure = (value) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;inset-block-start:0;block-size:0;inline-size:${value}`;
      root.append(probe);
      const px = probe.getBoundingClientRect().width;
      probe.remove();
      return px;
    };
    const drawn = measure(width);
    if (!drawn) return;
    this._offLadderWidth = width;
    const steps = [...LADDER_WIDTHS.map(([, token]) => measure(token)), measure('100vi')];
    if (steps.some((px) => Math.abs(px - drawn) < 0.5)) return;
    noteDeprecated({component: 'sf-drawer', tag: 'sf-drawer', kind: 'value', attribute: 'width', from: width,
      to: 'size="1/2|1|2|full", sf-resizer within 1/2...2', since: OFF_LADDER_SINCE, remove_after: OFF_LADDER_UNTIL});
    const name = this.id ? `#${this.id}` : this.drawerId ? ` ${this.drawerId}` : '';
    const ladder = LADDER_WIDTHS.map(([size, , rem]) => `size="${size}" ${rem}`).join(', ');
    globalThis.console?.warn?.(`[SIMAI Framework] sf-drawer${name}: width="${width}" draws ${Math.round(drawn)}px, off the width ladder (${ladder}, size="full" the whole screen; C157 (2)). It is still drawn until ${OFF_LADDER_UNTIL}; take a step, and an sf-resizer within 1/2...2 for a width of its own.`);
  }

  // The close stands first in the column outside (at the top, nearest the
  // corner) and last in the head's row (C14: the close ends the row), so the
  // page's edge controls move before it in the head and back after it
  // outside. The drawn close keeps its place (lit's); the page's controls
  // move round it, and a focused one keeps the focus.
  orderEdge(edge, inHead) {
    const close = edge.querySelector(':scope > [data-sf-drawer-close]');
    if (!close) return;
    const items = [...edge.children].filter((node) => node !== close);
    if (!items.length) return;
    const closeFirst = Boolean(close.compareDocumentPosition(items[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (inHead === !closeFirst) return;
    const focused = items.find((node) => node.contains(document.activeElement)) ? document.activeElement : null;
    if (inHead) edge.prepend(...items);
    else edge.append(...items);
    if (focused && document.activeElement !== focused) focused.focus?.({preventScroll: true});
  }

  observeScrollEdges(root) {
    if (typeof ResizeObserver !== 'function') return;
    if (!this._edgeObserver) this._edgeObserver = new ResizeObserver(() => { this.onPanelScroll(); this.placeCloseOnAxis(); });
    this._edgeObserver.disconnect();
    for (const area of ['[data-sf-drawer-panel]', '[data-sf-drawer-body]', '[data-sf-drawer-edge]']) {
      const node = root.querySelector(area);
      if (node) this._edgeObserver.observe(node);
    }
    this.onPanelScroll();
  }

  handleRootClick(event) {
    const root = this.getDrawerRoot();
    if (event.target instanceof Element && event.target.closest('[data-sf-drawer-handle]')) {
      this.setSnap(this.snap === 'full' ? 'half' : 'full');
      return;
    }
    // A press outside is the top layer's only.
    if (event.target === root?.querySelector('[data-sf-drawer-overlay]') && this.closeOnOverlay && this.dismissible && drawerManager.isTop(this)) {
      this.closeChain('outside');
      return;
    }
    // «Назад» in the head of a nested panel: back to the one it opened from.
    if (event.target instanceof Element && event.target.closest('[data-sf-drawer-back]')) {
      event.preventDefault();
      this.close({reason: 'close'});
      return;
    }
    if (event.target instanceof Element && event.target.closest('[data-sf-drawer-close]')) {
      event.preventDefault();
      this.closeChain('close');
    }
  }

  // The layer stack hands the drawer Escape and Tab while it is the top layer:
  // a modal, a list or a drawer opened from it takes them instead. Answers
  // true when it took Escape; the stack then stops the press.
  onKeyDown(event) {
    // An editor or drag operation that handled Escape keeps it.
    if (event.defaultPrevented || !this.openState || !drawerManager.isTop(this)) return false;
    if (event.key === 'Escape' && this.closeOnEsc && this.dismissible) {
      this.close({reason: 'escape'});
      return true;
    }
    if (!this.modal) return false;
    if (event.key !== 'Tab') return false;
    const panel = this.getDrawerRoot()?.querySelector('[data-sf-drawer-panel]');
    // The edge beside the panel is part of the window: its close, a copy and
    // an open-full control stand there. Cycled through the panel alone, Tab
    // never reached them (simai.main keyboard QA, 2026-10-28).
    const edge = this.getDrawerRoot()?.querySelector('[data-sf-drawer-edge]');
    const inside = (element) => Boolean(element && (panel?.contains(element) || edge?.contains(element)));
    const focusable = focusablesIn(panel, edge);
    if (focusable.length === 0) {
      event.preventDefault();
      panel?.focus();
      return false;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!inside(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return false;
  }

  // Sends one of the drawer's events by its verb (§8): sf-drawer-<verb> first,
  // then its old drawer:* name with the old detail through the alias table.
  // Data only in detail; answers false when a listener refused it.
  emitDrawerEvent(verb, cancelable = false, extra = {}) {
    return this.sfEmit(verb, {drawerId: this.drawerId, ...extra}, {cancelable});
  }

  // The old drawer:* names keep their old detail (§16.20 split rows): the new
  // names carry data only (§8), the old ones also the element and its panel.
  sfAliasAdapters() {
    const add = (detail) => ({...detail, component: this, drawer: this, root: this.getDrawerRoot()});
    return Object.fromEntries(OLD_EVENT_NAMES.map((name) => [name, add]));
  }

  // The on* helpers keep their original meaning: only this drawer's events,
  // not those bubbling up from a nested drawer; by their new names (§8).
  ownDrawerHandler(handler) {
    return (event) => {
      if (event.target === this) handler.call(this, event);
    };
  }

  onDrawerEvent(verb, handler, options) {
    if (typeof handler === 'function') this.addEventListener(this.sfEventName(verb), this.ownDrawerHandler(handler), options);
    return this;
  }

  onBeforeOpen(handler, options) { return this.onDrawerEvent('open', handler, options); }

  onAfterOpen(handler, options) { return this.onDrawerEvent('opened', handler, options); }

  onBeforeClose(handler, options) { return this.onDrawerEvent('close', handler, options); }

  onAfterClose(handler, options) { return this.onDrawerEvent('closed', handler, options); }

  clearPortal() {
    if (!this._portalRoot) return;
    render(nothing, this._portalRoot);
    this._portalRoot.remove();
    this._portalRoot = null;
  }
}

SfDrawer.define(DRAWER_SELECTOR);
