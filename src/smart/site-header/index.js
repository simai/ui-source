// sf-site-header: the top bar of a SIMAI site -- the effects catalogue, the
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
import {elementFromManifest} from '../../core/js/element-manifest';
import {closeLayer, isTopLayer, openLayer, returnLayerFocus, landmarksAround} from '../../core/js/layer-stack';
import {renderSiteHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The Framework's breakpoints (core/scss/vars/_sf_var__breakpoint.scss), as
// the sheet's media rules read them: collapsed below the step.
const STEPS = {sm: '32rem', md: '44rem', lg: '60rem', xl: '72rem'};
const SLOTS = ['brand', 'nav', 'actions', 'tools', 'sheet'];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let sequence = 0;

const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});

const SiteHeaderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    open() { return this.runOpen(); },
    close({reason} = {}) { return this.runClose({reason}); },
    toggle() { return this.isOpen ? this.runClose({reason: 'close'}) : this.runOpen(); },
  },
});

class SfSiteHeader extends SiteHeaderElement {
  constructor() {
    super();
    this._id = `sf-site-header-${++sequence}`;
    this.isOpen = false;
    this._media = null;
    this._onMedia = () => this.syncCollapsed();
  }

  // The nav is the default slot (component.json): the children the page wrote
  // without a slot attribute, taken live like the named ones, never copied.
  onConnected() {
    super.onConnected?.();
    const live = this._liveSlotNodes;
    if (live && !live.has('nav')) {
      const nodes = Array.from(this.children).filter((child) => !child.hasAttribute('slot') && !child.hasAttribute('data-sf-static')
        && child.localName !== 'script' && child.localName !== 'template');
      if (nodes.length) {
        nodes.forEach((node) => node.remove());
        live.set('nav', nodes);
      }
    }
    this.watchCollapse();
  }

  disconnectedCallback() {
    if (this.isOpen) this.finishClose({emit: false, restoreFocus: false});
    this._media?.removeEventListener?.('change', this._onMedia);
    this._media = null;
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'collapse' && oldValue !== newValue && this._isMounted) this.watchCollapse();
  }

  // Whether the bar is collapsed now: the same answer as the sheet's media rule.
  get collapsed() {
    if (this.collapse === 'always') return true;
    if (this.collapse === 'none') return false;
    return this._media ? !this._media.matches : false;
  }

  watchCollapse() {
    this._media?.removeEventListener?.('change', this._onMedia);
    const step = STEPS[this.collapse];
    this._media = step && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(`(min-width: ${step})`) : null;
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
    return this.collapsed ? this.menuButton() : null;
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
      locksPage: true,
      trapsFocus: true,
      returnTo: this._returnTo,
      lockPage: () => this.lockPage(),
      root: () => this.panel(),
      focusIn: () => this.focusFirst(),
      onEscape: (event) => this.onEscape(event),
      onTab: (event) => this.onTab(event),
      place: ({zIndex}) => this.place(zIndex),
    });
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
    this.requestComponentUpdate('close');
    if (restoreFocus) {
      // Focus goes back to the menu button that opened it (§19.2), or by the
      // stack's rule when that is gone.
      const button = this.menuButton();
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

  // The one page lock (§19.1): the stack takes it with the first layer that
  // locks the page and gives it back with the last.
  lockPage() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return () => {};
    const gap = Math.max(0, window.innerWidth - root.clientWidth);
    const kept = {root: root.style.overflow, body: body.style.overflow, padding: body.style.paddingInlineEnd};
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
    return () => {
      root.style.overflow = kept.root;
      body.style.overflow = kept.body;
      body.style.paddingInlineEnd = kept.padding;
    };
  }

  focusable() {
    const panel = this.panel();
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(FOCUSABLE)).filter((element) => element.getClientRects().length > 0);
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
      sticky: this.sticky,
      size: this.size,
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

SfSiteHeader.define('sf-site-header');

export {SfSiteHeader};
