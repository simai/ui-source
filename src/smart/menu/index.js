// sf-menu: site navigation built from data -- a site's sections, a cabinet's
// pages, a documentation tree -- drawn as the class menu (src/component/menu),
// so its styles apply and nothing of them is forked (owner, 2026-10-25). The
// items come from `items` (an array, or the same as JSON) or from a nested
// <ul><li><a> written inside the element.
//
// It is the WAI-ARIA disclosure navigation pattern, not an application menu:
// native links in a named <nav>, a branch's button with aria-expanded and
// aria-controls, the current page marked aria-current="page". Tab walks the
// links and the buttons; Enter and Space are the button's; Escape closes the
// innermost open panel only and gives the focus back to its button.
//
// The element draws the class markup and keeps its state itself: open
// branches, the current page, the panel a row that does not fit becomes. The
// markup carries data-sf-menu-owned, so the class runtime -- loaded beside it
// for the sheet -- leaves it alone and two owners never toggle one branch.
import SfBaseElement from '../../core/js/smart-base';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark';
import {pageText} from '../../core/js/page-language';
import {renderMenuTemplate} from './js/templates/default';
import {
  MENU_APPEARANCES,
  MENU_COLLAPSE,
  MENU_ORIENTATIONS,
  currentItemId,
  findItem,
  itemsFromList,
  normaliseItems,
  openBranches,
  pathTo,
  walkItems,
} from './items.mjs';
import './scss/index.scss';

// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

const MENU_TEXT = {
  en: {toggleLabel: 'Menu'},
  ru: {toggleLabel: 'Меню'},
};

let sequence = 0;

class SfSmartMenu extends SfBaseElement {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      items: {default: []},
      orientation: {default: 'vertical', values: MENU_ORIENTATIONS},
      appearance: {default: 'default', values: MENU_APPEARANCES},
      current: {default: ''},
      currentFromLocation: {attribute: 'current-from-location', type: Boolean, default: false},
      collapse: {default: 'auto', values: MENU_COLLAPSE},
      label: {default: ''},
      toggleLabel: {attribute: 'toggle-label', default: ''},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    this._id = `sf-smart-menu-${++sequence}`;
    // undefined: follow the attribute. Set by the property; an attribute
    // written later takes over again.
    this._items = undefined;
    this._childItems = [];
    this._childLabel = '';
    // What the person or the host opened and closed, by item id, over the
    // open flag each item carries.
    this._openState = new Map();
    this._panelOpen = false;
    // A row that did not fit, and the width it needed: it comes back as a row
    // only when that width is there again, so it never flickers between both.
    this._autoCollapsed = false;
    this._neededWidth = 0;
    this._mode = '';
    this._domIds = new Map();
    this._anchors = new Map();
    this._holding = false;
    this._escapeTaken = false;
    // A value set as a property before the element was defined is an own
    // property that would hide the accessor; it is taken through it.
    if (Object.prototype.hasOwnProperty.call(this, 'items')) {
      const early = this.items;
      delete this.items;
      this._items = normaliseItems(early);
    }
    this.addEventListener('click', this.onClick);
    this.addEventListener('focusin', this.onFocusChange);
    this.addEventListener('focusout', this.onFocusOut);
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'items' && previous !== next) {
      this._items = undefined;
      this._autoCollapsed = false;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  // A list written inside the element is the menu too: a <ul> (or a <nav>
  // holding one) of <li> with a link and, for a branch, a nested <ul>. Read
  // once, as slots are, and taken out of the light DOM; without the script it
  // stays a working list of links.
  captureSlotTemplates() {
    const first = !this._slotTemplatesCaptured;
    super.captureSlotTemplates();
    if (!first) return;
    const children = Array.from(this.children);
    const nav = children.find((child) => child.localName === 'nav');
    const list = children.find((child) => child.localName === 'ul') || nav?.querySelector(':scope > ul');
    if (!list) return;
    this._childItems = normaliseItems(itemsFromList(list));
    this._childLabel = nav?.getAttribute('aria-label') || list.getAttribute('aria-label') || '';
    (list.parentElement === nav ? nav : list).remove();
  }

  onConnected() {
    this._onLocation = () => {
      if (this.currentFromLocation) this.requestComponentUpdate('location');
    };
    window.addEventListener('popstate', this._onLocation);
    window.addEventListener('hashchange', this._onLocation);
  }

  onDisconnected() {
    super.onDisconnected();
    window.removeEventListener('popstate', this._onLocation);
    window.removeEventListener('hashchange', this._onLocation);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._observed = null;
    for (const submenu of [...this._anchors.keys()]) this.releaseAnchor(submenu);
    this.holdSurface(false);
  }

  // The items, from the property or the attribute, else from the markup.
  get items() {
    if (this._items !== undefined) return this._items;
    return normaliseItems(this.getAttribute('items'));
  }

  set items(next) {
    this._items = normaliseItems(next);
    this._autoCollapsed = false;
    this.requestComponentUpdate('items');
  }

  get menuItems() {
    const items = this.items;
    return items.length ? items : this._childItems;
  }

  get orientation() { return this.getProp('orientation'); }
  get appearance() { return this.getProp('appearance'); }
  get collapse() { return this.getProp('collapse'); }
  get currentFromLocation() { return this.getBooleanAttr('current-from-location', false); }

  // The documentation tree and the compact rail are columns.
  get horizontal() {
    return this.orientation === 'horizontal' && this.appearance === 'default';
  }

  // The row became a button that opens the same links as a column.
  get collapsed() {
    if (this.collapse === 'always') return true;
    return this.collapse === 'auto' && this.horizontal && this._autoCollapsed;
  }

  // Branches open as panels beside the row: a row that is shown as a row.
  get flyouts() {
    return this.horizontal && !this.collapsed;
  }

  get panelOpen() {
    return this.collapsed && this._panelOpen;
  }

  // The id of the item that is the current page, or null.
  get currentId() {
    const here = globalThis.location;
    return currentItemId(this.menuItems, {
      current: this.getProp('current'),
      pathname: here?.pathname || '',
      base: here?.href || '',
      fromLocation: this.currentFromLocation,
    });
  }

  // The ids of the open branches, outermost first.
  get openIds() {
    this.syncMode();
    return [...openBranches(this.menuItems, this._openState, this.currentId, !this.flyouts)];
  }

  isOpen(id) {
    return this.openIds.includes(String(id));
  }

  item(id) {
    return findItem(this.menuItems, id);
  }

  open(id) {
    return this.setOpen(id, true, 'method');
  }

  close(id) {
    return this.setOpen(id, false, 'method');
  }

  toggle(id) {
    return this.setOpen(id, !this.isOpen(id), 'method');
  }

  // Closes every open panel of a row and the panel of a collapsed menu; the
  // groups of a column keep their state. Returns whether anything changed.
  closeAll() {
    const flyouts = this.flyouts ? this.closeFlyouts('method') : false;
    const panel = this.setPanelOpen(false, 'method');
    return flyouts || panel;
  }

  // A row's open panels are one chain: opening a branch closes every panel
  // that is not above it, closing one closes the panels inside it. A column's
  // groups open and close each on its own. A disabled branch is not opened or
  // closed by the person. Returns whether anything changed.
  setOpen(id, open, source = 'method') {
    const item = this.item(id);
    if (!item || !item.children.length || this.appearance === 'compact') return false;
    if (item.disabled && source === 'user') return false;
    const before = new Set(this.openIds);
    if (before.has(item.id) === Boolean(open)) return false;
    const after = new Set(before);
    if (this.flyouts) {
      const above = new Set(pathTo(this.menuItems, item.id) || []);
      for (const other of before) if (!above.has(other)) after.delete(other);
      if (open) after.add(item.id);
    } else if (open) {
      after.add(item.id);
    } else {
      after.delete(item.id);
    }
    return this.applyOpen(before, after, source, item.id);
  }

  closeFlyouts(source) {
    const before = new Set(this.openIds);
    if (!before.size) return false;
    return this.applyOpen(before, new Set(), source, null);
  }

  applyOpen(before, after, source, asked) {
    const changed = [];
    walkItems(this.menuItems, (one) => {
      if (one.children.length && before.has(one.id) !== after.has(one.id)) changed.push(one);
    });
    if (!changed.length) return false;
    for (const one of changed) this._openState.set(one.id, after.has(one.id));
    this.requestComponentUpdate('open');
    // The branch asked for first, then the ones it closed, innermost first.
    const depth = (one) => (pathTo(this.menuItems, one.id) || []).length;
    changed.sort((a, b) => (a.id === asked ? -1 : b.id === asked ? 1 : depth(b) - depth(a)));
    for (const one of changed) {
      this.dispatchEvent(new CustomEvent('sf-menu:toggle', {
        bubbles: true,
        composed: true,
        detail: {id: one.id, open: after.has(one.id), source, item: one},
      }));
    }
    return true;
  }

  // The panel of a menu shown as a button. Its event names no item: id null.
  setPanelOpen(open, source = 'method') {
    if (!this.collapsed || this._panelOpen === Boolean(open)) return false;
    this._panelOpen = Boolean(open);
    this.requestComponentUpdate('panel');
    this.dispatchEvent(new CustomEvent('sf-menu:toggle', {
      bubbles: true,
      composed: true,
      detail: {id: null, open: this._panelOpen, source, item: null},
    }));
    return true;
  }

  // A change between a row, a column and a button starts from closed panels:
  // a panel opened beside a row is not a group to keep open in a column.
  syncMode() {
    const mode = this.collapsed ? 'collapsed' : this.flyouts ? 'row' : 'column';
    if (mode === this._mode) return;
    if (this._mode) {
      this._openState.clear();
      this._panelOpen = false;
    }
    this._mode = mode;
  }

  // A stable element id for each item, whatever its own id holds.
  domId(id) {
    if (!this._domIds.has(id)) this._domIds.set(id, this._domIds.size + 1);
    return this._domIds.get(id);
  }

  ownControl(target, selector) {
    const control = target?.closest?.(selector);
    return control && control.closest('sf-menu') === this ? control : null;
  }

  rowItem(control) {
    return this.item(control?.closest('[data-sf-menu-item]')?.dataset.sfMenuItem);
  }

  onClick = (event) => {
    const panelToggle = this.ownControl(event.target, '[data-sf-menu-panel-toggle]');
    if (panelToggle) {
      this.setPanelOpen(!this._panelOpen, 'user');
      return;
    }
    const toggle = this.ownControl(event.target, '[data-sf-menu-toggle]');
    if (toggle) {
      if (!toggle.disabled) this.setOpen(toggle.dataset.sfMenuToggle, !this.isOpen(toggle.dataset.sfMenuToggle), 'user');
      return;
    }
    const link = this.ownControl(event.target, 'a[data-sf-menu-link]');
    if (link) this.onNavigate(event, link);
  };

  // A link's own press: a cancellable sf-menu:navigate first, so a host that
  // routes the page itself prevents it and the browser does not go. A press
  // that opens another tab or window is the browser's alone.
  onNavigate(event, link) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((link.getAttribute('target') || '_self') !== '_self') return;
    const item = this.item(link.dataset.sfMenuLink);
    if (!item) return;
    const navigate = new CustomEvent('sf-menu:navigate', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {id: item.id, href: item.href, item},
    });
    this.dispatchEvent(navigate);
    if (navigate.defaultPrevented) event.preventDefault();
    // Gone to the page: nothing stays open over it.
    if (this.flyouts) this.closeFlyouts('user');
    this.setPanelOpen(false, 'user');
  }

  onFocusChange = () => {
    this.syncSurface();
  };

  // Focus that leaves the element closes a row's panels (WAI-ARIA disclosure
  // navigation); focus that leaves the page keeps them.
  onFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.contains(next) && this.flyouts) this.closeFlyouts('user');
    queueMicrotask(() => this.syncSurface());
  };

  // A row's open panel is a surface over the page; the panel of a button is
  // one while the focus is in it. Either holds the shared open-surface mark,
  // so a drawer or a modal behind it stands back on Escape, and takes Escape
  // only as the innermost open layer.
  syncSurface() {
    const flyoutOpen = this.flyouts && this.openIds.length > 0;
    const panel = this.panelOpen && this.contains(document.activeElement);
    this.holdSurface(this.isConnected && (flyoutOpen || panel || this._escapeTaken));
  }

  holdSurface(hold) {
    if (hold === this._holding) return;
    this._holding = hold;
    holdOpenSurfaceMark(this, hold);
    if (hold) {
      document.addEventListener('keydown', this.onDocumentKeydown, true);
      document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    } else {
      document.removeEventListener('keydown', this.onDocumentKeydown, true);
      document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    }
  }

  // Escape closes the innermost open panel only -- the deepest open panel of
  // a row, the one the focus is in first, else the panel of the button -- and
  // gives the focus back to the button that opened it.
  onDocumentKeydown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !isTopOpenSurface(this)) return;
    // The mark stays up until the press has reached every listener: the
    // re-render after closing runs between two of them, and a drawer reading
    // only the mark would otherwise close on the press that closed the panel.
    this._escapeTaken = true;
    setTimeout(() => {
      this._escapeTaken = false;
      this.syncSurface();
    });
    const innermost = this.innermostOpen();
    if (innermost) {
      event.preventDefault();
      event.stopPropagation();
      this.setOpen(innermost.id, false, 'user');
      this.focusAfterRender(`[data-sf-menu-toggle="${CSS.escape(innermost.id)}"]`);
      return;
    }
    if (this.panelOpen) {
      event.preventDefault();
      event.stopPropagation();
      this.setPanelOpen(false, 'user');
      this.focusAfterRender('[data-sf-menu-panel-toggle]');
    }
  };

  onDocumentPointerDown = (event) => {
    if ((event.composedPath?.() ?? []).includes(this)) return;
    if (this.flyouts) this.closeFlyouts('user');
  };

  innermostOpen() {
    if (!this.flyouts) return null;
    const open = new Set(this.openIds);
    if (!open.size) return null;
    const depth = (id) => (pathTo(this.menuItems, id) || []).length;
    const focused = document.activeElement;
    const ids = [...open].sort((a, b) => depth(b) - depth(a));
    const withFocus = ids.find((id) => this.querySelector(`[data-sf-menu-item="${CSS.escape(id)}"]`)?.contains(focused));
    // The deepest open panel the focus is in or under, else the deepest.
    const deepest = ids[0];
    const chosen = withFocus && depth(withFocus) >= depth(deepest) ? withFocus : deepest;
    return this.item(chosen);
  }

  focusAfterRender(selector) {
    this.whenRendered(() => this.querySelector(selector)?.focus(), {next: true});
  }

  focusDelegate() {
    return this.querySelector('[data-sf-menu-panel-toggle], a[href], button:not(:disabled)');
  }

  // A row's panels are placed by the Framework's geometry, as the class menu
  // places them: the first level below its item, deeper ones to the inline
  // end; both flip and shift inside the viewport instead of overflowing it.
  syncAnchors() {
    const wanted = new Set();
    if (this.flyouts) {
      for (const id of this.openIds) {
        const row = this.querySelector(`[data-sf-menu-item="${CSS.escape(id)}"]`);
        const submenu = row?.querySelector(':scope > ul.sf-menu');
        if (!submenu || submenu.hidden) continue;
        wanted.add(submenu);
        const current = this._anchors.get(submenu);
        if (current) {
          current.anchor.update();
          continue;
        }
        const saved = ['min-width', 'overflow-y'].map((name) => [name, submenu.style.getPropertyValue(name), submenu.style.getPropertyPriority(name)]);
        // min-inline-size: 100% would resolve against the viewport once fixed.
        submenu.style.minWidth = `${row.getBoundingClientRect().width}px`;
        submenu.style.overflowY = 'auto';
        const anchor = positioning().anchor(row, submenu, {
          side: row.dataset.sfMenuLevel === '1' ? 'block-end' : 'inline-end', align: 'start', offset: 0, fitHeight: true,
        });
        this._anchors.set(submenu, {anchor, saved});
      }
    }
    for (const submenu of [...this._anchors.keys()]) if (!wanted.has(submenu)) this.releaseAnchor(submenu);
  }

  releaseAnchor(submenu) {
    const current = this._anchors.get(submenu);
    if (!current) return;
    current.anchor.stop();
    for (const [name, value, priority] of current.saved) {
      if (value) submenu.style.setProperty(name, value, priority);
      else submenu.style.removeProperty(name);
    }
    this._anchors.delete(submenu);
  }

  // A row that does not fit the width it is given becomes the button; it is
  // a row again once the width it needed is there.
  observeWidth() {
    const nav = this.querySelector(':scope > nav.sf-smart-menu');
    if (!nav || typeof ResizeObserver === 'undefined') return;
    if (this._observed !== nav) {
      this._resizeObserver?.disconnect();
      this._resizeObserver = new ResizeObserver(() => this.measureFit());
      this._resizeObserver.observe(nav);
      this._observed = nav;
    }
    this.measureFit();
  }

  measureFit() {
    const nav = this._observed;
    if (!nav?.isConnected) return;
    if (this.collapse !== 'auto' || !this.horizontal) {
      if (this._autoCollapsed) {
        this._autoCollapsed = false;
        this.requestComponentUpdate('collapse');
      }
      return;
    }
    const width = nav.clientWidth;
    if (!this._autoCollapsed) {
      const list = nav.querySelector(':scope > ul.sf-menu');
      const needed = list ? list.scrollWidth : 0;
      if (needed > width + 1) {
        this._neededWidth = needed;
        this._autoCollapsed = true;
        this.requestComponentUpdate('collapse');
      }
    } else if (width >= this._neededWidth) {
      this._autoCollapsed = false;
      this.requestComponentUpdate('collapse');
    }
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.syncAnchors();
    this.observeWidth();
    this.syncSurface();
    return undefined;
  }

  templateContext() {
    const props = this.getPropsContext();
    this.syncMode();
    const items = this.menuItems;
    return this.createTemplateContext({
      ...props,
      component: this,
      id: this._id,
      items,
      open: new Set(this.openIds),
      currentId: this.currentId,
      flyouts: this.flyouts,
      collapsed: this.collapsed,
      panelOpen: this.panelOpen,
      compact: this.appearance === 'compact',
      appearance: this.appearance,
      label: this.getAttribute('aria-label') || this.getProp('label') || this._childLabel,
      toggleLabel: this.getProp('toggleLabel') || pageText(MENU_TEXT, 'toggleLabel', this),
      domId: (id) => this.domId(id),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderMenuTemplate(this.templateContext());
  }
}

SfSmartMenu.define('sf-menu');

export {SfSmartMenu};
