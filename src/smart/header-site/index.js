// sf-header-site: the top bar of a SIMAI site -- the effects catalogue, the
// Docara documentation sites and the simai.io hub show one bar, made once
// here, rather than three copies of a header row and a mobile sheet.
//
// The bar is a frame. Its brand, navigation, actions and tools are the page's
// own markup in slots, drawn with the Framework's components; the bar gives
// them one row on the container's width and, below the `collapse` breakpoint,
// a menu button that opens the navigation and the actions as a side panel.
//
// The side panel is a layer of the shared stack (standard simai.smart-component
// 1.3.11 §19, core/js/layer-stack.js), registered the way sf-drawer registers:
// the stack orders it, hands it Escape and Tab only while it is the top layer,
// holds the one page lock and gives focus back when it closes. The panel is
// the header's own element: wide it is display: contents, so the slot nodes
// stand in the row; collapsed it is the panel. The nodes are placed once and
// never move or get copied (§4.5).
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, open, close and toggle are the actions and
// answer outcomes, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {breakpointMedia} from '../../core/js/breakpoints.js';
import {closeLayer, focusablesIn, isTopLayer, openLayer, returnLayerFocus, landmarksAround} from '../../core/js/layer-stack';
import {renderSiteHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const SLOTS = ['brand', 'nav', 'actions', 'tools', 'sheet'];
const TAGS = ['sf-header-site', 'sf-site-header'];
const SWITCH_OPERATIONS = ['toggle', 'open', 'close'];
let sequence = 0;

// A switch of the page's own (owner decision C104, as sf-drawer's
// data-drawer): an element with data-header-site="toggle", "open" or "close"
// naming the bar's id in aria-controls. sf-button carries its data-* and
// aria-controls to its native button, so the press finds them there. One
// listener for the document, bound when the first bar connects.
function controlsBar(element, id) {
  return (element.getAttribute('aria-controls') || '').split(/\s+/u).includes(id);
}

function barSwitches(id) {
  if (!id || typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('[data-header-site][aria-controls]'))
    .filter((element) => SWITCH_OPERATIONS.includes(element.getAttribute('data-header-site')) && controlsBar(element, id));
}

let switchesBound = false;
function bindSwitches() {
  if (switchesBound || typeof document === 'undefined') return;
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-header-site][aria-controls]');
    const operation = trigger?.getAttribute('data-header-site');
    if (!trigger || !SWITCH_OPERATIONS.includes(operation)) return;
    for (const id of trigger.getAttribute('aria-controls').split(/\s+/u)) {
      const bar = id ? document.getElementById(id) : null;
      if (bar && TAGS.includes(bar.localName) && typeof bar[operation] === 'function') {
        bar[operation](operation === 'close' ? {reason: 'close'} : undefined);
      }
    }
  });
  switchesBound = true;
}


const SiteHeaderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  // The events of the former tag name (sf-site-header-*) follow the current
  // ones through the shim until the date in aliases.json.
  aliases,
  actions: {
    open() { return this.runOpen(); },
    close({reason} = {}) { return this.runClose({reason}); },
    toggle() { return this.isOpen ? this.runClose({reason: 'close'}) : this.runOpen(); },
  },
});

class SfSiteHeader extends SiteHeaderElement {
  // The slot nodes stay in the page until the bar draws and places them, in
  // the same task: a page that finds its sf-menu by id once the tag is
  // defined finds it on every load (pair ui-a0370c0c99fb acceptance, D1).
  static holdsSlotNodesUntilDrawn = true;

  constructor() {
    super();
    this._id = `sf-site-header-${++sequence}`;
    this.isOpen = false;
    this._media = null;
    this._onMedia = () => this.syncCollapsed();
    this._outsideSwitch = false;
    this._switchFrame = 0;
    this._onResize = () => {
      if (this._switchFrame) return;
      this._switchFrame = globalThis.requestAnimationFrame?.(() => {
        this._switchFrame = 0;
        this.syncSwitches();
      }) ?? 0;
      if (!this._switchFrame) this.syncSwitches();
    };
    this._scrollFrame = 0;
    this._onScroll = () => {
      if (this._scrollFrame) return;
      this._scrollFrame = globalThis.requestAnimationFrame?.(() => {
        this._scrollFrame = 0;
        this.syncScrolled();
      }) ?? 0;
      if (!this._scrollFrame) this.syncScrolled();
    };
  }

  // The nav is the default slot (component.json): the children the page wrote
  // without a slot attribute, taken live like the named ones, never copied,
  // and held in the page until the bar draws, as the named ones are.
  onConnected() {
    super.onConnected?.();
    const live = this._liveSlotNodes;
    if (live && !live.has('nav')) {
      const nodes = Array.from(this.children).filter((child) => !child.hasAttribute('slot') && !child.hasAttribute('data-sf-static')
        && child.localName !== 'script' && child.localName !== 'template');
      if (nodes.length) {
        nodes.forEach((node) => this.holdSlotNode(node));
        live.set('nav', nodes);
      }
    }
    this.watchCollapse();
    this.watchScroll();
    bindSwitches();
    if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('resize', this._onResize, {passive: true});
    this._offSwitches?.();
    this._offSwitches = this.onAfterRender(() => this.syncSwitches(), {once: false});
  }

  disconnectedCallback() {
    if (this.isOpen) this.finishClose({emit: false, restoreFocus: false});
    this._media?.removeEventListener?.('change', this._onMedia);
    this._media = null;
    this.unwatchScroll();
    if (typeof globalThis.removeEventListener === 'function') globalThis.removeEventListener('resize', this._onResize);
    if (this._switchFrame) globalThis.cancelAnimationFrame?.(this._switchFrame);
    this._switchFrame = 0;
    this._offSwitches?.();
    this._offSwitches = null;
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'collapse' && oldValue !== newValue && this._isMounted) this.watchCollapse();
    if (name === 'sticky' && oldValue !== newValue && this._isMounted) this.watchScroll();
  }

  // Whether the bar is collapsed now: the same answer as the sheet's media rule.
  get collapsed() {
    if (this.collapse === 'always') return true;
    if (this.collapse === 'none') return false;
    return this._media ? !this._media.matches : false;
  }

  watchCollapse() {
    this._media?.removeEventListener?.('change', this._onMedia);
    // Collapsed below the Framework's step (core/js/breakpoints.js, the sheet's
    // own ladder; reuse audit 2026-11-02, finding 6); none has no step.
    this._media = breakpointMedia(this.collapse);
    this._media?.addEventListener?.('change', this._onMedia);
    this.syncCollapsed();
  }

  // The window crossed the breakpoint: the host says so, a horizontal sf-menu
  // in the nav turns into a column while it stands in the panel, and an open
  // panel the wide bar no longer has closes.
  syncCollapsed() {
    const collapsed = this.collapsed;
    this.sfHostState('data-collapsed', collapsed);
    for (const menu of this.navMenus()) {
      if (collapsed) {
        if (menu.dataset.sfSiteHeaderOrientation === undefined) menu.dataset.sfSiteHeaderOrientation = menu.getAttribute('orientation') ?? '';
        menu.setAttribute('orientation', 'vertical');
      } else if (menu.dataset.sfSiteHeaderOrientation !== undefined) {
        const was = menu.dataset.sfSiteHeaderOrientation;
        delete menu.dataset.sfSiteHeaderOrientation;
        if (was) menu.setAttribute('orientation', was);
        else menu.removeAttribute('orientation');
      }
    }
    if (!collapsed && this.isOpen) this.runClose({reason: 'api'});
  }

  // A sticky bar is the flat place while the page is at its top and the raised
  // one while content runs under it (shadow system C20): the host says so with
  // data-scrolled, and the sheet draws the raised shadow from it. Only a
  // sticky bar listens; a bar in the flow scrolls away with the page.
  watchScroll() {
    this.unwatchScroll();
    if (!this.sticky || typeof globalThis.addEventListener !== 'function') {
      this.sfHostState('data-scrolled', false);
      return;
    }
    globalThis.addEventListener('scroll', this._onScroll, {passive: true});
    this._watchingScroll = true;
    this.syncScrolled();
  }

  unwatchScroll() {
    if (this._watchingScroll) globalThis.removeEventListener?.('scroll', this._onScroll);
    this._watchingScroll = false;
    if (this._scrollFrame) globalThis.cancelAnimationFrame?.(this._scrollFrame);
    this._scrollFrame = 0;
  }

  // Content is under the bar when the page has scrolled and the bar stands
  // stuck at the top of the window (its top at or above the sticky edge).
  syncScrolled() {
    const bar = this.header();
    const scrolled = Boolean(bar) && (globalThis.scrollY ?? 0) > 0 && bar.getBoundingClientRect().top <= 0;
    this.sfHostState('data-scrolled', scrolled);
  }

  // The page's switches (data-header-site): each says whether the panel is
  // open, and while a toggle or open switch outside the panel is on screen
  // the bar draws no menu button of its own (C104). Checked after each
  // drawing and on resize, as sf-drawer's controlled checks its switch.
  syncSwitches() {
    const switches = barSwitches(this.id);
    const expanded = this.isOpen ? 'true' : 'false';
    for (const element of switches) {
      if (element.getAttribute('data-header-site') !== 'close' && element.getAttribute('aria-expanded') !== expanded) {
        element.setAttribute('aria-expanded', expanded);
      }
    }
    const panel = this.panel();
    const outside = switches.some((element) => element.getAttribute('data-header-site') !== 'close'
      && !panel?.contains(element)
      && element.getClientRects().length > 0
      && (element.checkVisibility?.({visibilityProperty: true}) ?? true));
    if (outside !== this._outsideSwitch) {
      this._outsideSwitch = outside;
      this.requestComponentUpdate('switch');
    }
  }

  // The page's switch on screen, when the bar draws no menu button.
  outsideSwitch() {
    if (!this._outsideSwitch) return null;
    const panel = this.panel();
    return barSwitches(this.id).find((element) => element.getAttribute('data-header-site') !== 'close'
      && !panel?.contains(element) && element.getClientRects().length > 0) ?? null;
  }

  navMenus() {
    const nodes = [].concat(this._liveSlotNodes?.get('nav') || []);
    return nodes.flatMap((node) => (node.localName === 'sf-menu' ? [node] : Array.from(node.querySelectorAll?.('sf-menu') || [])));
  }

  panel() {
    return this.querySelector(':scope .sf-site-header-panel');
  }

  menuButton() {
    return this.querySelector(':scope .sf-site-header-menu-button button') ?? this.querySelector(':scope .sf-site-header-menu-button');
  }

  header() {
    return this.querySelector(':scope > .sf-site-header');
  }

  // The menu button is the control the host's focus() reaches while the bar is
  // collapsed (the host is display: contents and has no box).
  focusDelegate() {
    return this.collapsed ? (this.menuButton() ?? this.outsideSwitch()) : null;
  }

  // The action open.
  runOpen() {
    if (this.isOpen) return applied();
    if (!this.collapsed) return refused('not-collapsed');
    if (!this.sfEmit('open', {}, {cancelable: true})) return refused('prevented');
    this._returnTo = document.activeElement;
    this._returnAncestors = landmarksAround(this._returnTo);
    this.isOpen = true;
    this.sfHostState('data-open', true);
    openLayer(this, {
      kind: 'panel',
      // The stack's default page lock (lockPageScroll), the one every layer takes.
      locksPage: true,
      trapsFocus: true,
      returnTo: this._returnTo,
      root: () => this.panel(),
      focusIn: () => this.focusFirst(),
      onEscape: (event) => this.onEscape(event),
      onTab: (event) => this.onTab(event),
      place: ({zIndex}) => this.place(zIndex),
    });
    this.syncSwitches();
    this.requestComponentUpdate('open');
    // Lit draws the open panel in a microtask; a frame later it has a box to
    // take focus.
    const settle = () => {
      if (!this.isOpen) return;
      this.focusFirst();
      this.sfEmit('opened', {});
    };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(settle);
    else Promise.resolve().then(settle);
    return applied();
  }

  // The action close; reason by §19.3.
  runClose({reason = 'api', restoreFocus = true} = {}) {
    if (!this.isOpen) return refused('closed');
    if (!this.sfEmit('close', {reason}, {cancelable: true})) return refused('prevented');
    this.finishClose({reason, restoreFocus});
    return applied();
  }

  finishClose({reason = 'api', emit = true, restoreFocus = true} = {}) {
    this.isOpen = false;
    this.sfHostState('data-open', false);
    const wasTop = closeLayer(this, {restoreFocus: false});
    this.place('');
    this.syncSwitches();
    this.requestComponentUpdate('close');
    if (restoreFocus) {
      // Focus goes back to the menu button that opened it (§19.2), or by the
      // stack's rule when that is gone.
      const button = this.menuButton() ?? this.outsideSwitch();
      const target = button?.getClientRects().length ? button : this._returnTo;
      returnLayerFocus(wasTop, target, this._returnAncestors);
    }
    if (emit) this.sfEmit('closed', {reason});
  }

  // The bar's place in the stack while open: its z-index lifts the header,
  // and the panel and scrim inside it, to the layer's height.
  place(zIndex) {
    const header = this.header();
    if (!header) return;
    if (zIndex === '' || zIndex === undefined) header.style.removeProperty('z-index');
    else header.style.zIndex = String(zIndex);
  }

  focusable() {
    return focusablesIn(this.panel());
  }

  // Focus on open: the current page's link (the last one, as the nav comes
  // before a documentation tree in the sheet slot), else the first link, else
  // the close button.
  focusFirst() {
    const panel = this.panel();
    if (!panel) return;
    const current = Array.from(panel.querySelectorAll('[aria-current="page"]')).filter((element) => element.getClientRects().length > 0);
    const links = Array.from(panel.querySelectorAll('a[href]')).filter((element) => element.getClientRects().length > 0);
    const close = panel.querySelector('.sf-site-header-close-button button') ?? panel.querySelector('.sf-site-header-close-button');
    const target = current.at(-1) || links[0] || close || panel;
    target.focus({preventScroll: true});
  }

  onEscape(event) {
    if (event.defaultPrevented || !this.isOpen || !isTopLayer(this)) return false;
    this.close({reason: 'escape'});
    return true;
  }

  onTab(event) {
    if (!this.isOpen) return;
    const items = this.focusable();
    const panel = this.panel();
    if (!items.length) {
      event.preventDefault();
      panel?.focus();
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    const active = document.activeElement;
    if (!panel?.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // A link chosen in the open panel closes it (the page goes on to the link).
  onPanelClick(event) {
    if (!this.isOpen) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link && this.panel()?.contains(link)) this.runClose({reason: 'api', restoreFocus: false});
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      open: this.isOpen,
      collapse: this.collapse,
      menuPlacement: this.menuPlacement === 'inline-end' ? 'inline-end' : 'inline-start',
      ownMenuButton: !this._outsideSwitch,
      sticky: this.sticky,
      size: this.size,
      navigationAlign: this.navigationAlign,
      label: this.label,
      menuLabel: this.menuLabel,
      closeLabel: this.closeLabel,
      slot: (name) => this.getSlotContent(name),
      hasSlot: (name) => SLOTS.includes(name) && this.hasSlotContent(name),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderSiteHeaderTemplate(this.templateContext());
  }
}

SfSiteHeader.define('sf-header-site');

export {SfSiteHeader};
