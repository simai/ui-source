// sf-header-site: the top bar of a SIMAI site -- the effects catalogue, the
// Docara documentation sites and the simai.io hub show one bar, made once
// here, rather than three copies of a header row and a mobile sheet.
//
// The bar is a frame. Its brand, navigation, actions and tools are the page's
// own markup in slots, drawn with the Framework's components; the bar gives
// them one row on the container's width and, below the `collapse` step of
// its own width (a container condition, C181 (2)), a menu button that opens the navigation and the actions as a side panel.
//
// The side panel is a layer of the shared stack (standard simai.smart-component
// 1.3.11 §19, core/js/layer-stack.js), registered the way sf-drawer registers:
// the stack orders it, hands it Escape and Tab only while it is the top layer,
// holds the one page lock and gives focus back when it closes. The panel is
// the header's own element: wide it is display: contents, so the slot nodes
// stand in the row; collapsed it is the panel. The nodes are placed once and
// never get copied (§4.5); only the settings among the tools -- the language
// and the theme switch -- move, between the bar's tools and the panel's
// «Настройки» group, when the bar crosses its breakpoint (owner decision C161
// (8)): a phone's bar keeps the menu button, the brand, search and profile.
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, open, close and toggle are the actions and
// answer outcomes, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {breakpointMedia} from '../../core/js/breakpoints.js';
import {layoutHeight, layoutRowRoom, layoutWidth} from '../../core/js/overflow-row.js';
import {closeLayer, focusablesIn, isTopLayer, openLayer, returnLayerFocus, landmarksAround} from '../../core/js/layer-stack';
import {renderSiteHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

const SLOTS = ['brand', 'nav', 'actions', 'tools', 'sheet'];
const TAGS = ['sf-header-site', 'sf-site-header'];
const SWITCH_OPERATIONS = ['toggle', 'open', 'close'];

// A tool that is a setting of the page rather than a tool of the site: the
// language (sf-language) and the theme switch (any element with theme-switch).
// On a collapsed bar these stand in the panel under the sections (C161 (8)).
const SETTING_TOOLS = 'sf-language, [theme-switch]';
function settingKind(node) {
  if (node?.nodeType !== 1) return null;
  const setting = node.matches(SETTING_TOOLS) ? node : node.querySelector?.(SETTING_TOOLS);
  if (!setting) return null;
  // A wrapper that holds the setting beside other tools (search, language,
  // theme in one row) is the tools row, not the language: it was labelled
  // «Язык» though it held more (GB10). Its word is the neutral «Инструменты».
  if (setting !== node && node.children.length > 1) return 'tools';
  return setting.localName === 'sf-language' ? 'language' : 'theme';
}
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
  lang: languageFiles,
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
    // The bar's own width decides (the sheet's container condition); the
    // observer tells the script when it changed. undefined: not answered yet.
    this._collapsedNow = undefined;
    this._sizeObserver = null;
    this._observedHeader = null;
    // F-1: the bar's width at which a nav that overflowed fits again (0: it
    // fits, or it was never measured too wide).
    this._fitNeed = 0;
    this._fitFrame = 0;
    // collapse auto (C371, C372): the tools that give way first (sf-button
    // shrink="icon") and the width each drew whole, read while it was whole,
    // so the bar knows the row's width with them whole while they are glyphs.
    this._toolsCompact = false;
    this._wholeWidths = new WeakMap();
    this._fitting = false;
    this._onFonts = () => this.queueFit();
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
    this._offSwitches = this.onAfterRender(() => {
      this.observeSize();
      this.syncCollapsed();
      this.syncSwitches();
      this.queueFit();
    }, {once: false});
    // Words that arrive with a face change the nav's width, not the bar's.
    globalThis.document?.fonts?.addEventListener?.('loadingdone', this._onFonts);
  }

  disconnectedCallback() {
    if (this.isOpen) this.finishClose({emit: false, restoreFocus: false});
    this._media?.removeEventListener?.('change', this._onMedia);
    this._media = null;
    this._sizeObserver?.disconnect();
    this._sizeObserver = null;
    this._observedHeader = null;
    this._collapsedNow = undefined;
    globalThis.document?.fonts?.removeEventListener?.('loadingdone', this._onFonts);
    if (this._fitFrame) globalThis.cancelAnimationFrame?.(this._fitFrame);
    this._fitFrame = 0;
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
    if (name === 'collapse' && oldValue !== newValue && this._isMounted) {
      this._collapsedNow = undefined;
      this.setFit(0);
      this.watchCollapse();
    }
    if (name === 'sticky' && oldValue !== newValue && this._isMounted) this.watchScroll();
  }

  // Whether the bar is collapsed now: the sheet's own answer. The bar is the
  // container of its parts, and below the `collapse` step of its width the
  // sheet's container condition gives the row --sf-site-header--collapsed: 1
  // (C181 (2), C104): the bar and the sf-menu in it read one width, the bar's,
  // so a bar narrower than the window -- a column, a card, an example frame --
  // collapses with its nav instead of leaving the nav to fold into its own
  // button over the actions. Before the row is drawn, the window's step is the
  // guess (core/js/breakpoints.js): a full-width bar gives the same answer.
  get collapsed() {
    if (this.collapse === 'always') return true;
    if (this.collapse === 'none') return false;
    const row = this.header()?.querySelector(':scope > .sf-site-header-row');
    if (row && typeof globalThis.getComputedStyle === 'function') {
      return globalThis.getComputedStyle(row).getPropertyValue('--sf-site-header--collapsed').trim() === '1';
    }
    return this._media ? !this._media.matches : false;
  }

  watchCollapse() {
    this._media?.removeEventListener?.('change', this._onMedia);
    // The guess before the row is drawn, and a wake-up when the window
    // crosses the step (the bar's width moves with it); none has no step.
    this._media = breakpointMedia(this.collapse);
    this._media?.addEventListener?.('change', this._onMedia);
    this.syncCollapsed();
  }

  // The bar's width is watched where it is drawn: the <header> is the
  // container the sheet's condition reads.
  observeSize() {
    const header = this.header();
    if (!header || header === this._observedHeader || typeof ResizeObserver === 'undefined') return;
    this._sizeObserver?.disconnect();
    this._sizeObserver = new ResizeObserver(() => {
      if (this.collapse === 'auto') {
        this.fitRow();
        return;
      }
      this.syncCollapsed();
      this.syncFit();
    });
    this._sizeObserver.observe(header);
    this._observedHeader = header;
    this.observeParts();
  }

  // collapse auto: the brand and the tools are watched too -- a face that
  // arrives, a word that changes, a tool that draws late change the room the
  // nav has without changing the bar's width.
  observeParts() {
    if (!this._sizeObserver || this.collapse !== 'auto') return;
    const header = this.header();
    for (const part of header?.querySelectorAll(':scope > .sf-site-header-row > :is(.sf-site-header-brand, .sf-site-header-tools)') ?? []) {
      if (this._observedParts?.has(part)) continue;
      this._observedParts ??= new WeakSet();
      this._observedParts.add(part);
      this._sizeObserver.observe(part);
    }
  }

  // The bar crossed its step: the host says so, a horizontal sf-menu in the
  // nav turns into a column while it stands in the panel, and an open panel
  // the wide bar no longer has closes. Only a change acts, so the observer,
  // the drawing and the window can all ask.
  syncCollapsed() {
    const collapsed = this.collapsed;
    if (collapsed === this._collapsedNow) return;
    this._collapsedNow = collapsed;
    this.sfHostState('data-collapsed', collapsed);
    // The settings among the tools stand in the bar or in the panel by the
    // bar's form: a change of form draws them again in their place.
    if (this._drawnCollapsed !== undefined && this._drawnCollapsed !== collapsed) this.requestComponentUpdate('collapse');
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

  // F-1 (docs header, 2026-11-18): a wide bar whose nav needs more room than
  // the row leaves it drew the nav over the brand and the tools (the docs'
  // static class menu of five sections at 1180-1320 px under collapse xl:
  // up to 60 px over). The bar gives way instead: when the nav's content is
  // wider than the nav's box, the host says data-nav-overflow and the sheet
  // collapses the bar as below its step -- the menu button, the nav and the
  // actions in the side panel -- until the bar is again as wide as the nav
  // measured it needed. A nav whose sf-menu gives way itself (overflow more
  // or collapse, its defaults) is left to it; collapse none never collapses
  // and always already does.
  navGivesWay() {
    return this.navMenus().some((menu) => menu.getAttribute('overflow') !== 'none' || menu.getAttribute('collapse') !== 'none');
  }

  setFit(need) {
    this._fitNeed = need;
    this.sfHostState('data-nav-overflow', need > 0);
  }

  queueFit() {
    if (this._fitFrame) return;
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf !== 'function') {
      this.syncFit();
      return;
    }
    this._fitFrame = raf(() => {
      this._fitFrame = 0;
      this.syncFit();
    });
  }

  syncFit() {
    if (this.collapse === 'auto') {
      this.fitRow();
      return;
    }
    const header = this.header();
    if (!header || this.collapse === 'none' || this.collapse === 'always' || typeof document === 'undefined') {
      if (this._fitNeed) this.setFit(0);
      return;
    }
    const width = header.getBoundingClientRect().width;
    if (this._fitNeed) {
      if (width < this._fitNeed) return;
      // Room again: draw the row and measure it in the next frame.
      this.setFit(0);
      this.syncCollapsed();
      this.queueFit();
      return;
    }
    if (this.collapsed) return;
    const nav = header.querySelector('.sf-site-header-nav');
    if (!nav || !nav.firstElementChild || this.navGivesWay()) return;
    const room = nav.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(nav);
    const spread = range.getBoundingClientRect();
    const over = Math.max(0, room.left - spread.left) + Math.max(0, spread.right - room.right);
    if (over <= 0.5 || !room.height) return;
    this.setFit(Math.ceil(width + spread.width - room.width) + 1);
    this.syncCollapsed();
  }

  // collapse auto (owner decisions C371, C372, 2026-11-19): the bar measures
  // its own row and gives way in one order -- first the tools that can
  // (sf-button shrink="icon" draws its glyph only), then the nav's sf-menu
  // moves its sections one by one into «Ещё» (overflow more), and only when
  // not even one section beside «Ещё» fits, the menu button and the side
  // panel. Every width change is decided here, in the observer that saw it,
  // before the paint and in one step: the tools' state is written first, so
  // the nav has its final room when the menu is asked for its row in the same
  // task (measureFit({driven: true})); nothing in between is drawn.
  //
  // The widths: the row's content box; the brand, the actions and the tools
  // as they stand; a shrinking tool whole (the width it drew whole, read
  // while it was) and as a glyph (a square of its own height); the menu's
  // whole row and its narrowest row (rowNeeds, one item and «Ещё»). A nav
  // without such a menu asks its content's width and moves whole.
  drivesRow(menu) {
    return this.collapse === 'auto' && !this.collapsed && this.navMenus().includes(menu);
  }

  shrinkingTools() {
    const tools = this.header()?.querySelector(':scope > .sf-site-header-row > .sf-site-header-tools');
    return tools ? Array.from(tools.querySelectorAll('[shrink="icon"]')) : [];
  }

  setToolsCompact(compact) {
    for (const tool of this.shrinkingTools()) {
      if (compact) tool.setAttribute('data-shrunk', 'true');
      else tool.removeAttribute('data-shrunk');
    }
    if (compact === this._toolsCompact) return;
    this._toolsCompact = compact;
    this.sfHostState('data-tools-compact', compact);
  }

  // The nav's needs: the menu's own, else its content measured as it lies.
  // null while a menu in it is not drawn as a row yet (its code not here,
  // or a column turning back into a row): the menu asks the bar again once
  // it has drawn (rowHost), and nothing is decided on a half-drawn nav.
  navNeeds(nav) {
    const menus = this.navMenus();
    if (menus.some((element) => !element.matches(':defined'))) return null;
    const menu = menus.find((element) => typeof element.rowNeeds === 'function' && element.moreActive);
    if (menu) {
      const needs = menu.rowNeeds();
      return needs ? {...needs, menu} : null;
    }
    const range = document.createRange();
    range.selectNodeContents(nav);
    const whole = range.getBoundingClientRect().width;
    return {whole, least: whole, menu: null};
  }

  fitRow() {
    if (this.collapse !== 'auto' || this._fitting || typeof document === 'undefined') return;
    const header = this.header();
    const row = header?.querySelector(':scope > .sf-site-header-row');
    if (!row) return;
    this._fitting = true;
    try {
      this.fitRowNow(row);
    } finally {
      this._fitting = false;
    }
    this.sfHostState('data-fitted', true);
  }

  // Layout boxes, not screen boxes (layoutWidth, layoutRowRoom; the row
  // engine's measures under a transformed ancestor, fix/segmented-transform):
  // a bar in a scaled preview decides as it is laid out.
  fitRowNow(row) {
    const room = layoutRowRoom(row);
    // Collapsed by this measure: the bar comes back when its row is again as
    // wide as the narrowest row needed when it collapsed. The menu draws as a
    // row again, measures and asks the bar back (rowHost), which then decides
    // the row in full.
    if (this._fitNeed) {
      if (room + 0.5 < this._fitNeed) return;
      this.setFit(0);
      this.syncCollapsed();
      return;
    }
    // Below the floor (the md step, a phone, until the nav's menu has drawn)
    // the sheet collapses the bar; the floor lifted, the menu turns back into
    // a row and asks the bar again.
    this.syncCollapsed();
    if (this.collapsed) {
      this.setToolsCompact(this.shrinkingTools().length > 0);
      return;
    }
    const nav = row.querySelector('.sf-site-header-nav');
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const width = (element) => (element ? layoutWidth(element) : 0);
    const brand = row.querySelector(':scope > .sf-site-header-brand');
    const actions = row.querySelector('.sf-site-header-actions');
    const tools = row.querySelector(':scope > .sf-site-header-tools');
    const parts = [brand, nav, actions, tools].filter((part) => part && part.getClientRects().length);
    const besides = width(brand) + width(actions) + gap * Math.max(0, parts.length - 1);
    const toolsNow = width(tools);
    let whole = 0;
    let glyph = 0;
    for (const tool of this.shrinkingTools()) {
      const box = tool.querySelector(':scope > :is(button, a)') ?? tool;
      const drawn = {width: layoutWidth(box), height: layoutHeight(box)};
      if (!this._toolsCompact) this._wholeWidths.set(tool, drawn.width);
      whole += this._wholeWidths.get(tool) ?? drawn.width;
      glyph += this._toolsCompact ? drawn.width : drawn.height;
    }
    const shrinks = this.shrinkingTools().length > 0;
    const toolsWhole = this._toolsCompact ? toolsNow - glyph + whole : toolsNow;
    const toolsGlyph = this._toolsCompact ? toolsNow : toolsNow - whole + glyph;
    if (!nav || !nav.firstElementChild) {
      this.setToolsCompact(shrinks && besides + toolsWhole > room + 0.5);
      return;
    }
    const needs = this.navNeeds(nav);
    if (!needs) return;
    const roomWhole = room - besides - toolsWhole;
    const roomGlyph = room - besides - toolsGlyph;
    if (needs.whole <= roomWhole + 0.5) {
      this.setToolsCompact(false);
    } else if (needs.least <= (shrinks ? roomGlyph : roomWhole) + 0.5) {
      this.setToolsCompact(shrinks);
    } else {
      // Not even one section beside «Ещё»: the menu button and the panel,
      // until the row is as wide as that row needs.
      this.setToolsCompact(shrinks);
      this.setFit(Math.ceil(room + needs.least - (shrinks ? roomGlyph : roomWhole)) + 1);
      this.syncCollapsed();
      return;
    }
    // The nav has its room now (the tools' state is drawn by the sheet at
    // once): the menu decides its row in the same task.
    needs.menu?.measureFit({driven: true});
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

  // The tools split by the bar's form (C161 (8)): wide, every tool in the
  // bar in the page's order; collapsed, the settings (language, theme) in the
  // panel's «Настройки» group, each with its word, and the rest in the bar.
  toolParts(collapsed) {
    const nodes = [].concat(this.hasSlotContent('tools') ? this.getSlotContent('tools') : []).filter((node) => node && typeof node === 'object' && 'nodeType' in node);
    if (!collapsed) return {bar: nodes, settings: []};
    const settings = nodes.filter((node) => settingKind(node)).map((node) => ({node, kind: settingKind(node), label: this.sfWord(settingKind(node))}));
    return {bar: nodes.filter((node) => !settingKind(node)), settings};
  }

  templateContext() {
    const collapsed = this.collapsed;
    this._drawnCollapsed = collapsed;
    const tools = this.toolParts(collapsed);
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
      tools,
      settingsLabel: this.sfWord('settings'),
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
