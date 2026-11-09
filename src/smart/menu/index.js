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
import {elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark';
import {breakpointMedia} from '../../core/js/breakpoints.js';
import {renderMenuTemplate} from './js/templates/default';
import {
  HOVER_CLOSE_DELAY,
  HOVER_OPEN_DELAY,
  HOVER_REGION_OPEN_DELAY,
  MENU_INDICATORS,
  MENU_APPEARANCES,
  MENU_COLLAPSE,
  MENU_OPEN_ON,
  MENU_ORIENTATIONS,
  MENU_OVERFLOW,
  MORE_ID,
  ROW_APPEARANCES,
  currentItemId,
  findItem,
  fitRow,
  itemsFromList,
  normaliseItems,
  openBranches,
  pathTo,
  walkItems,
  withoutGroups,
} from './items.mjs';
import './scss/index.scss';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8,
// §11): the settings are attributes and properties made by
// core/js/element-manifest.js, the button's word is lang/<locale>.json, the
// actions answer outcomes, and the old event names sf-menu:navigate and
// sf-menu:toggle are dated aliases of sf-menu-navigate and sf-menu-toggle.
const MenuElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

// open('catalog') and open({id: 'catalog'}) both name an item (§4.4).
// How many levels of panels an item opens: 0 for a leaf.
const panelDepth = (item) => (item?.children?.length ? 1 + Math.max(...item.children.map(panelDepth)) : 0);

const itemArgument = (value) => (value && typeof value === 'object' ? value.id : value);

class SfSmartMenu extends MenuElement {
  static get props() {
    return {
      ...super.props,
      templateName: {attribute: 'template', default: 'default'},
      items: {default: []},
      orientation: {default: 'vertical', values: MENU_ORIENTATIONS},
      appearance: {default: 'default', values: MENU_APPEARANCES},
      current: {default: ''},
      currentFromLocation: {attribute: 'current-from-location', type: Boolean, default: false},
      collapse: {default: 'auto', values: MENU_COLLAPSE},
      overflow: {default: 'collapse', values: MENU_OVERFLOW},
      moreLabel: {attribute: 'more-label', default: ''},
      openOn: {attribute: 'open-on', default: 'hover', values: MENU_OPEN_ON},
      indicator: {default: 'line', values: MENU_INDICATORS},
      label: {default: ''},
      toggleLabel: {attribute: 'toggle-label', default: ''},
      sticky: {type: Boolean, default: false},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
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
    // Under the md breakpoint (a phone), for collapse narrow.
    this._narrow = false;
    // overflow more: the ids of the first-level items that left the row for
    // «Ещё», in their order.
    this._overflowHidden = [];
    // open-on hover: the timers of the branches the pointer rests on or left.
    this._hoverTimers = new Map();
    // A region's template, stamped once per name, so a render keeps its nodes.
    this._regionNodes = new Map();
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
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('pointerover', this.onPointerOver);
    this.addEventListener('pointerout', this.onPointerOut);
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
    // Static markup is a picture of the menu, not its items (§5.4).
    const children = Array.from(this.children).filter((child) => !child.hasAttribute('data-sf-static'));
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
    // The phone's width, as the sheets switch on it (core/js/breakpoints).
    this._narrowMedia = breakpointMedia('md', {below: true});
    this._narrow = this._narrowMedia?.matches === true;
    this._onNarrow = () => {
      const narrow = this._narrowMedia?.matches === true;
      if (narrow === this._narrow) return;
      this._narrow = narrow;
      if (this.collapse === 'narrow') this.requestComponentUpdate('narrow');
    };
    this._narrowMedia?.addEventListener?.('change', this._onNarrow);
    // The words of a row change their width when the font arrives: «Ещё» is
    // measured again then.
    this._onFonts = () => this.measureFit();
    document.fonts?.addEventListener?.('loadingdone', this._onFonts);
    document.fonts?.ready?.then?.(() => this.isConnected && this.measureFit());
  }

  onDisconnected() {
    super.onDisconnected();
    window.removeEventListener('popstate', this._onLocation);
    window.removeEventListener('hashchange', this._onLocation);
    this._narrowMedia?.removeEventListener?.('change', this._onNarrow);
    this._narrowMedia = null;
    document.fonts?.removeEventListener?.('loadingdone', this._onFonts);
    for (const timer of this._hoverTimers.values()) clearTimeout(timer);
    this._hoverTimers.clear();
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

  // A row with overflow more: the items that left the row stand under the
  // trailing «Ещё» branch.
  get moreActive() {
    return this.overflow === 'more' && this.flyouts;
  }

  // The tree the open panels, the current path and the keys walk: the items,
  // or -- in a row with overflow more -- the row's items with the ones that
  // left it under «Ещё».
  get treeItems() {
    const items = this.menuItems;
    if (!this.moreActive) return items;
    const row = withoutGroups(items);
    const hidden = new Set(this._overflowHidden);
    return [...row.filter((item) => !hidden.has(item.id)), this.moreItem(row.filter((item) => hidden.has(item.id)))];
  }

  // «Ещё» -- the more-label words -- or «Меню» when no item stays in the row.
  moreItem(children = []) {
    const none = children.length > 0 && children.length === withoutGroups(this.menuItems).length;
    const label = none
      ? this.getAttribute('toggle-label') || this.sfWord('toggle-label')
      : this.getAttribute('more-label') || this.sfWord('more-label');
    return {id: MORE_ID, label, href: '', icon: '', badge: '', status: '', current: false, disabled: false, open: false, region: '', children};
  }

  // The ids of the first-level items that left the row for «Ещё».
  get overflowHidden() {
    return this.moreActive ? [...this._overflowHidden] : [];
  }

  // orientation, appearance, collapse, current-from-location and the words are
  // the manifest's accessors (attribute and property).

  // The documentation tree and the compact rail are columns; the default and
  // the navigation can be a row.
  get horizontal() {
    return this.orientation === 'horizontal' && ROW_APPEARANCES.includes(this.appearance);
  }

  // The row became a button that opens the same links as a column.
  get collapsed() {
    if (this.collapse === 'always') return true;
    if (this.collapse === 'narrow') return this._narrow;
    return this.collapse === 'auto' && this.overflow === 'collapse' && this.horizontal && this._autoCollapsed;
  }

  // Branches open as panels beside the row: a row that is shown as a row.
  get flyouts() {
    return this.horizontal && !this.collapsed;
  }

  // Groups are drawn with their headings in a column; a row and the compact
  // rail draw their items in the group's place.
  get groupsDrawn() {
    return !this.flyouts && this.appearance !== 'compact';
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
      hash: here?.hash || '',
      base: here?.href || '',
      fromLocation: this.currentFromLocation,
    });
  }

  // The ids of the open branches, outermost first.
  get openIds() {
    this.syncMode();
    return [...openBranches(this.treeItems, this._openState, this.currentId, !this.flyouts)];
  }

  isOpen(id) {
    return this.openIds.includes(String(id));
  }

  item(id) {
    return findItem(this.treeItems, id);
  }

  // The actions open, close and toggle {id} and close-all (§4.4): each
  // answers an outcome, applied or refused with a reason.
  open(id) {
    return this.setOpen(itemArgument(id), true, 'method');
  }

  close(id) {
    return this.setOpen(itemArgument(id), false, 'method');
  }

  toggle(id) {
    const key = itemArgument(id);
    return this.setOpen(key, !this.isOpen(key), 'method');
  }

  // Closes every open panel of a row and the panel of a collapsed menu; the
  // groups of a column keep their state.
  closeAll() {
    const flyouts = this.flyouts ? this.closeFlyouts('method') : false;
    const panel = this.setPanelOpen(false, 'method');
    return flyouts || panel ? {outcome: 'applied'} : {outcome: 'refused', reason: 'already'};
  }

  // A row's open panels are one chain: opening a branch closes every panel
  // that is not above it, closing one closes the panels inside it. A column's
  // groups open and close each on its own. A disabled branch is not opened or
  // closed by the person. Answers an outcome: applied, or refused with
  // unknown (no such branch), compact (no groups), disabled or already.
  setOpen(id, open, source = 'method') {
    const item = this.item(id);
    if (!item || !item.children.length) return {outcome: 'refused', reason: 'unknown'};
    if (this.appearance === 'compact') return {outcome: 'refused', reason: 'compact'};
    // A group that is not collapsible, or a group a row does not draw, stays
    // as it is.
    if (item.group && (!item.collapsible || !this.groupsDrawn)) return {outcome: 'refused', reason: 'fixed'};
    if (item.disabled && source === 'user') return {outcome: 'refused', reason: 'disabled'};
    // Any decision on a branch (a press, a key, a method or a rest that ran)
    // drops the rests still pending on it: a branch Escape closed under a
    // resting mouse stays closed until the pointer comes back.
    this.clearHoverTimer(`open\u0000${item.id}`);
    this.clearHoverTimer(`close\u0000${item.id}`);
    const before = new Set(this.openIds);
    if (before.has(item.id) === Boolean(open)) return {outcome: 'refused', reason: 'already'};
    const after = new Set(before);
    if (this.flyouts) {
      const above = new Set(pathTo(this.treeItems, item.id) || []);
      for (const other of before) if (!above.has(other)) after.delete(other);
      if (open) after.add(item.id);
    } else if (open) {
      after.add(item.id);
    } else {
      after.delete(item.id);
    }
    return this.applyOpen(before, after, source, item.id)
      ? {outcome: 'applied'}
      : {outcome: 'refused', reason: 'already'};
  }

  closeFlyouts(source) {
    const before = new Set(this.openIds);
    if (!before.size) return false;
    return this.applyOpen(before, new Set(), source, null);
  }

  applyOpen(before, after, source, asked) {
    const changed = [];
    walkItems(this.treeItems, (one) => {
      if (one.children.length && before.has(one.id) !== after.has(one.id)) changed.push(one);
    });
    if (!changed.length) return false;
    for (const one of changed) this._openState.set(one.id, after.has(one.id));
    this.requestComponentUpdate('open');
    // The branch asked for first, then the ones it closed, innermost first.
    const depth = (one) => (pathTo(this.treeItems, one.id) || []).length;
    changed.sort((a, b) => (a.id === asked ? -1 : b.id === asked ? 1 : depth(b) - depth(a)));
    // sf-menu-toggle, then its old name sf-menu:toggle with the same detail
    // (aliases.json, until 2026-12-01).
    for (const one of changed) {
      this.sfEmit('toggle', {id: one.id, open: after.has(one.id), source, item: one});
    }
    return true;
  }

  // The panel of a menu shown as a button. Its event names no item: id null.
  setPanelOpen(open, source = 'method') {
    if (!this.collapsed || this._panelOpen === Boolean(open)) return false;
    this._panelOpen = Boolean(open);
    this.requestComponentUpdate('panel');
    this.sfEmit('toggle', {id: null, open: this._panelOpen, source, item: null});
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
    if (link) {
      this.onNavigate(event, link);
      return;
    }
    // A link of a region's own template is the host's: following it closes
    // the region, as a menu link does.
    const regionLink = this.ownControl(event.target, '.sf-menu-region a[href]');
    if (regionLink && this.flyouts && !event.defaultPrevented) this.closeFlyouts('user');
  };

  // open-on hover (C30, the default of a row): a mouse resting on a row's
  // branch opens it after 300 ms (a region after 500 ms); once it has been
  // outside a branch and its panel for 500 ms the branch closes. Touch, a pen
  // and the keyboard go through the branch's chevron, which a press opens
  // and closes.
  hoverOpens(event) {
    return this.openOn === 'hover' && this.flyouts && event.pointerType === 'mouse';
  }

  // A first-level branch of a row that opens a region rather than a panel.
  flyoutRegion(item) {
    return Boolean(item?.region) && this.flyouts && this.menuItems.some((top) => top.id === item.id);
  }

  // The ids of the items whose rows or panels hold a node, innermost first.
  itemChain(node) {
    const chain = [];
    for (let li = node?.closest?.('[data-sf-menu-item]'); li && this.contains(li); li = li.parentElement?.closest('[data-sf-menu-item]')) {
      chain.push(li.dataset.sfMenuItem);
    }
    return chain;
  }

  hoverTimer(key, delay, run) {
    if (this._hoverTimers.has(key)) return;
    this._hoverTimers.set(key, setTimeout(() => {
      this._hoverTimers.delete(key);
      if (this.isConnected && this.flyouts) run();
    }, delay));
  }

  clearHoverTimer(key) {
    const timer = this._hoverTimers.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    this._hoverTimers.delete(key);
  }

  onPointerOver = (event) => {
    if (!this.hoverOpens(event)) return;
    const chain = new Set(this.itemChain(event.target));
    for (const key of [...this._hoverTimers.keys()]) {
      const [kind, id] = key.split('\u0000');
      if ((kind === 'close' && chain.has(id)) || (kind === 'open' && !chain.has(id))) this.clearHoverTimer(key);
    }
    const [id] = chain;
    const item = id ? this.item(id) : null;
    if (!item?.children.length || item.disabled || this.isOpen(id)) return;
    const delay = this.flyoutRegion(item) ? HOVER_REGION_OPEN_DELAY : HOVER_OPEN_DELAY;
    this.hoverTimer(`open\u0000${id}`, delay, () => this.setOpen(id, true, 'user'));
  };

  onPointerOut = (event) => {
    if (!this.hoverOpens(event)) return;
    const next = event.relatedTarget instanceof Node && this.contains(event.relatedTarget) ? new Set(this.itemChain(event.relatedTarget)) : new Set();
    for (const key of [...this._hoverTimers.keys()]) {
      const [kind, id] = key.split('\u0000');
      if (kind === 'open' && !next.has(id)) this.clearHoverTimer(key);
    }
    for (const id of this.openIds) {
      if (next.has(id)) continue;
      this.hoverTimer(`close\u0000${id}`, HOVER_CLOSE_DELAY, () => {
        if (this.isOpen(id)) this.setOpen(id, false, 'user');
      });
    }
  };

  // The arrows of a row (WAI-ARIA disclosure navigation, the optional keys):
  // Left and Right walk the row's first level, Home and End go to its ends,
  // Down and Up open a branch and enter its panel at the first or the last
  // row; in a panel Down and Up walk its rows, Home and End go to its ends,
  // Right opens a side panel and enters it, Left closes the side panel the
  // focus is in and gives the focus back to its branch; in a region Down and
  // Up walk its links and Left and Right its columns. Tab, Enter, Space and
  // Escape are as before. A column has no arrows: it is not a tree widget.
  onKeydown = (event) => {
    if (!this.flyouts || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    const li = event.target?.closest?.('[data-sf-menu-item]');
    if (!li || !this.contains(li)) return;
    const region = event.target.closest('.sf-menu-region');
    const handled = region && li.contains(region)
      ? this.regionKey(region, event.target, key)
      : li.dataset.sfMenuLevel === '1' ? this.rowKey(li, key) : this.panelKey(li, event.target, key);
    if (handled) event.preventDefault();
  };

  // The control a row's item is reached by: its link, or its branch button.
  rowControl(li) {
    const row = li?.querySelector(':scope > .sf-menu-element');
    if (!row) return null;
    const control = row.matches('a[href], button') ? row : row.querySelector(':scope > a[href], :scope > button');
    return control && !control.disabled ? control : null;
  }

  // The items of one list that can be reached, in order.
  reachable(list) {
    return Array.from(list?.children || []).filter((li) => li.matches('[data-sf-menu-item]:not([hidden])') && this.rowControl(li));
  }

  // Opens a branch if it is closed, then gives the focus to the first or the
  // last control of its panel.
  enterBranch(li, last = false) {
    const id = li.dataset.sfMenuItem;
    const focusInside = () => {
      const panel = li.querySelector(':scope > .sf-menu, :scope > .sf-menu-region');
      if (!panel) return;
      const controls = panel.matches('.sf-menu-region')
        ? this.regionControls(panel)
        : this.reachable(panel).map((one) => this.rowControl(one));
      (last ? controls[controls.length - 1] : controls[0])?.focus();
    };
    if (this.isOpen(id)) {
      focusInside();
      return true;
    }
    const outcome = this.setOpen(id, true, 'user');
    if (outcome.outcome !== 'applied') return false;
    this.whenRendered(focusInside, {next: true});
    return true;
  }

  rowKey(li, key) {
    const items = this.reachable(li.parentElement);
    const at = items.indexOf(li);
    if (at < 0) return false;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.rowControl(items[(at + (key === 'ArrowRight' ? 1 : -1) + items.length) % items.length])?.focus();
      return true;
    }
    if (key === 'Home' || key === 'End') {
      this.rowControl(items[key === 'Home' ? 0 : items.length - 1])?.focus();
      return true;
    }
    if (!li.matches('.sf-menu-item--has-submenu')) return false;
    return this.enterBranch(li, key === 'ArrowUp');
  }

  panelKey(li, target, key) {
    const items = this.reachable(li.parentElement);
    const at = items.indexOf(li);
    if (at < 0) return false;
    // Inside the vertical-to-horizontal sense of the row: the side a panel
    // opens to is the row's inline end, mirrored in RTL.
    const rtl = getComputedStyle(this.querySelector(':scope > nav') || this).direction === 'rtl';
    const inward = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      this.rowControl(items[(at + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length])?.focus();
      return true;
    }
    if (key === 'Home' || key === 'End') {
      this.rowControl(items[key === 'Home' ? 0 : items.length - 1])?.focus();
      return true;
    }
    if (key === inward) {
      if (!li.matches('.sf-menu-item--has-submenu')) return false;
      return this.enterBranch(li);
    }
    // Outward from a side panel: it closes and its branch takes the focus.
    const owner = li.parentElement?.closest('[data-sf-menu-item]');
    if (!owner || owner.dataset.sfMenuLevel === '1') return false;
    this.setOpen(owner.dataset.sfMenuItem, false, 'user');
    this.focusAfterRender(`[data-sf-menu-item="${CSS.escape(owner.dataset.sfMenuItem)}"] > .sf-menu-element [data-sf-menu-toggle], [data-sf-menu-item="${CSS.escape(owner.dataset.sfMenuItem)}"] > [data-sf-menu-toggle]`);
    return true;
  }

  regionControls(region) {
    return Array.from(region.querySelectorAll('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter((node) => node.getClientRects().length > 0);
  }

  regionKey(region, target, key) {
    const controls = this.regionControls(region);
    const at = controls.indexOf(target.closest('a[href], button, [tabindex]'));
    if (at < 0 || !controls.length) return false;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      controls[(at + (key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length].focus();
      return true;
    }
    if (key === 'Home' || key === 'End') {
      controls[key === 'Home' ? 0 : controls.length - 1].focus();
      return true;
    }
    // A column is a child of the region (or of its columns' grid) that holds
    // controls: Left and Right go to the first control of the one beside.
    const columns = Array.from(region.querySelectorAll(':scope > *, :scope > .sf-menu-region-columns > *'))
      .filter((column) => !column.matches('.sf-menu-region-columns') && this.regionControls(column).length);
    const column = columns.findIndex((one) => one.contains(target));
    if (column < 0) return false;
    const rtl = getComputedStyle(region).direction === 'rtl';
    const step = (key === 'ArrowRight') !== rtl ? 1 : -1;
    this.regionControls(columns[(column + step + columns.length) % columns.length])[0]?.focus();
    return true;
  }

  // A link's own press: a cancellable sf-menu-navigate first (and its old name
  // sf-menu:navigate, one cancel for both), so a host that routes the page
  // itself prevents it and the browser does not go. A press that opens
  // another tab or window is the browser's alone.
  onNavigate(event, link) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((link.getAttribute('target') || '_self') !== '_self') return;
    const item = this.item(link.dataset.sfMenuLink);
    if (!item) return;
    const allowed = this.sfEmit('navigate', {id: item.id, href: item.href, item});
    if (!allowed) event.preventDefault();
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
    // A press outside comes from the layer stack's one listener, while the
    // menu is the top layer (§19.3).
    holdOpenSurfaceMark(this, hold, {onOutsidePress: this.onOutsidePress});
    if (hold) {
      document.addEventListener('keydown', this.onDocumentKeydown, true);
    } else {
      document.removeEventListener('keydown', this.onDocumentKeydown, true);
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

  // Outside the menu: the stack has checked that already.
  onOutsidePress = () => {
    if (this.flyouts) this.closeFlyouts('user');
  };

  innermostOpen() {
    if (!this.flyouts) return null;
    const open = new Set(this.openIds);
    if (!open.size) return null;
    const depth = (id) => (pathTo(this.treeItems, id) || []).length;
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
        const submenu = row?.querySelector(':scope > ul.sf-menu, :scope > .sf-menu-region');
        if (!submenu || submenu.hidden) continue;
        wanted.add(submenu);
        const current = this._anchors.get(submenu);
        if (current) {
          current.anchor.update();
          continue;
        }
        const saved = ['min-width', 'overflow-y'].map((name) => [name, submenu.style.getPropertyValue(name), submenu.style.getPropertyPriority(name)]);
        submenu.style.overflowY = 'auto';
        let anchor;
        if (submenu.matches('.sf-menu-region')) {
          // A region is as wide as the header the row stands in -- else the
          // row's own nav -- and opens under it.
          const header = this.closest('.sf-site-header, header') || this.querySelector(':scope > nav') || row;
          anchor = positioning().anchor(header, submenu, {side: 'block-end', align: 'start', offset: 0, matchWidth: true, fitHeight: true});
        } else if (row.dataset.sfMenuLevel === '1') {
          // min-inline-size: 100% would resolve against the viewport once fixed.
          submenu.style.minWidth = `${row.getBoundingClientRect().width}px`;
          // It stands the gap under the header's edge, not under the row:
          // sf-header-site says how far its edge is below the row
          // (--sf-site-header--edge), so the current section's line on that
          // edge stays in sight while the panel is open (C30, R060).
          anchor = positioning().anchor(row, submenu, {side: 'block-end', align: 'start', offset: 'calc(var(--sf-site-header--edge, calc(var(--sf-px) * 0)) + var(--sf-space-1\\/4))', fitHeight: true});
        } else {
          // A side panel stands beside the panel its row is in, not over it:
          // past that panel's own edge (its padding and border) by the gap
          // between panels, its first row level with the row that opened it.
          // Its side is the chain's: the first side level takes the side
          // with room for every level still under it, and the levels under
          // it keep that side, so no level opens back over its own chain
          // (no zig-zag at the window's edge). Only a level that has no room
          // on that side at all turns over. The chevron stays › (R059).
          const panel = row.parentElement;
          submenu.style.minWidth = `${row.getBoundingClientRect().width}px`;
          const outer = panel.getBoundingClientRect();
          const box = row.getBoundingClientRect();
          const own = getComputedStyle(submenu);
          const gap = positioning().resolveLength('var(--sf-space-1\\/4)', this);
          const inherited = panel.dataset.sfSide;
          let side = 'inline-end';
          if (inherited === 'inline-start' || inherited === 'inline-end') {
            side = inherited;
          } else {
            const width = submenu.getBoundingClientRect().width + gap;
            const needed = width * panelDepth(this.item(id));
            const rtl = getComputedStyle(this).direction === 'rtl';
            const right = document.documentElement.clientWidth - outer.right;
            const left = outer.left;
            const [after, before] = rtl ? [left, right] : [right, left];
            side = after >= needed || after >= before ? 'inline-end' : 'inline-start';
          }
          submenu.dataset.sfSide = side;
          anchor = positioning().anchor(row, submenu, {
            side, align: 'start', fitHeight: true,
            offset: Math.max(outer.right - box.right, box.left - outer.left) + gap,
            alignmentOffset: -((parseFloat(own.paddingTop) || 0) + (parseFloat(own.borderTopWidth) || 0)),
          });
        }
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
    if (this.moreActive) {
      this.measureOverflow(nav);
      return;
    }
    if (this._overflowHidden.length) this.setOverflowHidden([]);
    if (this.collapse !== 'auto' || this.overflow !== 'collapse' || !this.horizontal) {
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

  // overflow more (priority+, C30): each first-level item's width is measured
  // as the row draws it -- every item and «Ещё» shown for the measure, in the
  // same task, so nothing is painted -- and the items that do not fit leave
  // the row from its end; the section that holds the current page stays
  // while it fits beside «Ещё». sf-menu-overflow says which left, each time
  // that changes.
  measureOverflow(nav) {
    const list = nav.querySelector(':scope > ul.sf-menu');
    const more = list?.querySelector(':scope > .sf-menu-item--more');
    if (!list || !more) return;
    const tops = Array.from(list.children).filter((li) => li !== more && li.matches('[data-sf-menu-item], [data-sf-menu-placeholder]'));
    const was = [...tops, more].map((li) => li.hidden);
    for (const li of [...tops, more]) li.hidden = false;
    const widths = tops.map((li) => li.getBoundingClientRect().width);
    const moreWidth = more.getBoundingClientRect().width;
    [...tops, more].forEach((li, at) => {
      li.hidden = was[at];
    });
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const ids = tops.map((li) => li.dataset.sfMenuItem || li.dataset.sfMenuPlaceholder);
    const currentId = this.currentId;
    const above = currentId ? [currentId, ...(pathTo(this.menuItems, currentId) || [])] : [];
    const keep = ids.findIndex((id) => above.includes(id));
    const stays = new Set(fitRow(widths, moreWidth, nav.clientWidth, gap, keep));
    this.setOverflowHidden(ids.filter((_, at) => !stays.has(at)), nav.clientWidth);
  }

  setOverflowHidden(hidden, width) {
    if (hidden.length === this._overflowHidden.length && hidden.every((id, at) => id === this._overflowHidden[at])) return;
    // A row in a box that takes its width from its content (a header not yet
    // drawn, a shrink-to-fit cell) gets wider when items leave it and
    // narrower when they come back: going straight back to the set it just
    // left, sooner than a frame or two, is that loop -- the row keeps the
    // set with more items under «Ещё» until its width changes on its own.
    const key = hidden.join('\u0000');
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    const flip = this._overflowFlip;
    if (flip && flip.back === key && now - flip.at < 100 && hidden.length < this._overflowHidden.length) return;
    // The other way round: a set with fewer items under «Ещё» that bounced
    // straight back (the row narrowed once they were shown) does not hold at
    // the width it was measured at; a later measure at that same width (a
    // panel opening re-draws the row) keeps the row as it is, and the open
    // panel stays.
    const loop = this._overflowLoop;
    if (loop && loop.key === key && width !== undefined && loop.width === width) return;
    if (flip && flip.back === key && now - flip.at < 100 && hidden.length > this._overflowHidden.length) {
      this._overflowLoop = {key: this._overflowHidden.join('\u0000'), width: flip.width};
    }
    this._overflowFlip = {back: this._overflowHidden.join('\u0000'), at: now, width};
    // A panel open over the row was placed for the row as it was.
    if (this.flyouts) this.closeFlyouts('method');
    this._overflowHidden = hidden;
    this.requestComponentUpdate('overflow');
    this.sfEmit('overflow', {hidden: [...hidden]});
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
    const all = this.menuItems;
    const items = this.groupsDrawn ? all : withoutGroups(all);
    const currentId = this.currentId;
    const tree = this.treeItems;
    const moreActive = this.moreActive;
    const selector = this.collapse === 'narrow' && this.collapsed;
    return this.createTemplateContext({
      ...props,
      component: this,
      // The host's path id (§7.1.1, simai/ui-source#41): <path>--list and
      // <path>--menu-<n>, n the item's place in this element's own map.
      id: partId(instancePath(this, {kind: 'sf-menu'})),
      items,
      open: new Set(this.openIds),
      currentId,
      // The branches above the current page: a closed one draws the bar (C23).
      holding: new Set(currentId ? pathTo(tree, currentId) || [] : []),
      // overflow more: the first-level items that left the row (drawn there
      // as placeholders) and the «Ещё» branch that holds them.
      hidden: new Set(moreActive ? this._overflowHidden : []),
      moreItem: moreActive ? tree[tree.length - 1] : null,
      moreShown: moreActive && this._overflowHidden.length > 0,
      moreId: MORE_ID,
      regionContent: (name) => this.regionNodes(name),
      // collapse narrow: the button is a selector showing the current item.
      selector,
      selectedItem: selector && currentId ? findItem(all, currentId) : null,
      statusWord: (status) => this.sfWord(`status-${status}`),
      // A split row's chevron is named after its section: «Каталог: подразделы».
      subsectionsName: (label) => `${label}: ${this.sfWord('subsections')}`,
      indicator: this.indicator,
      flyouts: this.flyouts,
      collapsed: this.collapsed,
      panelOpen: this.panelOpen,
      compact: this.appearance === 'compact',
      appearance: this.appearance,
      label: this.getAttribute('aria-label') || this.getProp('label') || this._childLabel,
      toggleLabel: this.getAttribute('toggle-label') || this.sfWord('toggle-label'),
      domId: (id) => this.domId(id),
      rootClass: this.getRootClass(),
    });
  }

  // A region's template (<template slot="region-<name>">), stamped once: the
  // region keeps its nodes from one render to the next.
  regionNodes(name) {
    if (!name) return null;
    if (this._regionNodes.has(name)) return this._regionNodes.get(name);
    const nodes = this._slotTemplates.get(`region-${name}`) || [];
    if (!nodes.length) return null;
    const stamped = nodes.map((node) => node.cloneNode(true));
    this._regionNodes.set(name, stamped);
    return stamped;
  }

  template() {
    return renderMenuTemplate(this.templateContext());
  }
}

SfSmartMenu.define('sf-menu');

export {SfSmartMenu};
