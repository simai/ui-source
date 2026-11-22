// The head of a work page of an app: where the page is, what it is called,
// whether it is a favourite, its actions and its views. An app with a side
// menu has no top bar (owner decision C161 (1); larena-specs
// frontend-interface-program, sf-admin-menu assignment, v5, section 6), so
// this is the only place a page says these things -- the admin's pages, SIMAI
// Pro's conversation head and ui-mail's columns alike; a site shows
// sf-header-site.
//
// The host owns everything in it. The path, the start of the line («назад»,
// a phone's menu), the actions and the tabs are the host's own markup in
// slots; the heading, the count
// and whether the page is shared by every site are attributes. The star is the
// one control the header draws itself, and pressing it is a request the host
// answers: sf-page-header-toggle {on} is cancelable, and a host that wants to
// wait for its own answer cancels it and sets `star` when it knows.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js, the words are the
// language files', and the old sf-page-header-star follows the toggle as a
// dated alias (aliases.json).
import {nothing} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {noteAuthored} from '../../core/js/density';
import {actionEntry, controlOf, drawnBox, isMainAction, isPressed, layoutActionRow, openRowMenu, readPriority, rowRoom as rowRoomOf} from '../../core/js/overflow-row.js';
import {renderPageHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

const PageHeaderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  aliases,
});

// The header's slots. A child naming one of them is the page's content for it.
const HOST_SLOTS = new Set(['path', 'path-end', 'start', 'media', 'heading', 'actions', 'tabs']);

// The nearest box that scrolls the header (overflow auto or scroll on the
// block axis), or null for the window: the work area a sticky header stays
// at the top of.
function scrollerOf(element) {
  for (let node = element.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
  }
  return null;
}

class SfPageHeader extends PageHeaderElement {
  // The base takes the slot children once, when the element connects. A page
  // that adds an action later -- «Создать» once the list has loaded, a button
  // the person's rights allow -- appended it to the host, and it stood after
  // the drawn header, outside it (ui-doc «Рецепты», 2026-11-10). A child that
  // names a slot and arrives after the connection joins that slot, after the
  // ones it already holds, and the header draws again.
  onConnected() {
    super.onConnected?.();
    this.watchScroll();
    if (this._lateSlotObserver) return;
    this._lateSlotObserver = new MutationObserver(() => this.adoptLateSlotChildren());
    this._lateSlotObserver.observe(this, {childList: true});
    this.adoptLateSlotChildren();
  }

  onDisconnected() {
    this.unwatchScroll();
    this._lateSlotObserver?.disconnect();
    this._lateSlotObserver = null;
    this._rowObserver?.disconnect();
    this._rowObserver = null;
    this._rowObserved = null;
    this._rowMutations?.disconnect();
    this._rowMutations = null;
    this._rowWatched = null;
    super.onDisconnected?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name === 'sticky' && oldValue !== newValue && this._isMounted) this.watchScroll();
  }

  // ─── sticky (owner decision C161 (7)) ───────────────────────────────────────
  // A sticky header stays at the top of the work area that scrolls it -- the
  // nearest box that scrolls, else the window -- flat while the area is at its
  // top and raised while content runs under it (C20, as sf-header-site): the
  // host says data-scrolled, and the sheet draws the raised shadow and folds
  // the path away from it. Only a sticky header listens.
  watchScroll() {
    this.unwatchScroll();
    if (!this.sticky || typeof globalThis.addEventListener !== 'function') {
      this.sfHostState('data-scrolled', false);
      return;
    }
    this._scroller = scrollerOf(this);
    this._onScroll ??= () => {
      if (this._scrollFrame) return;
      this._scrollFrame = globalThis.requestAnimationFrame?.(() => {
        this._scrollFrame = 0;
        this.syncScrolled();
      }) ?? 0;
      if (!this._scrollFrame) this.syncScrolled();
    };
    (this._scroller || globalThis).addEventListener('scroll', this._onScroll, {passive: true});
    this._watchingScroll = true;
    this.syncScrolled();
  }

  unwatchScroll() {
    if (this._watchingScroll) (this._scroller || globalThis).removeEventListener?.('scroll', this._onScroll);
    this._watchingScroll = false;
    this._scroller = null;
    if (this._scrollFrame) globalThis.cancelAnimationFrame?.(this._scrollFrame);
    this._scrollFrame = 0;
  }

  // Content is under the header when its area has scrolled and the header
  // stands stuck at the area's top edge.
  syncScrolled() {
    const header = this.querySelector(':scope > .sf-page-header');
    const scroller = this._scroller;
    const scrolled = scroller ? scroller.scrollTop : (globalThis.scrollY ?? 0);
    const edge = scroller ? scroller.getBoundingClientRect().top + (parseFloat(getComputedStyle(scroller).borderTopWidth) || 0) : 0;
    // Stuck: at the edge, not above it (a header whose column ended has
    // scrolled away with it, and nothing runs under it).
    this.sfHostState('data-scrolled', Boolean(header) && scrolled > 0 && Math.abs(header.getBoundingClientRect().top - edge) <= 1);
  }

  // ─── «Ещё» (owner decision C155 (7), C161 (4)) ─────────────────────────────
  // overflow="more" (the default): the actions stay on one row; what does not
  // fit leaves for ⋯ at its end -- from the end, by the actions' priority
  // where the page gives one, the main action (the filled one), a pressed
  // toggle and priority="pin" never. ⋯ lists them with their icons and words
  // and presses the action itself. overflow="wrap" keeps the former row that
  // wraps onto further rows (OV-2). On a narrow line (below the g6 step of the
  // line's own width, C181 (2); the sheet says --sf-page-header--fold: 1) the
  // head folds as C155 (7) and C161 (4) say for a phone: the actions that must
  // stay stay and every other one is in ⋯, whatever room is left (1.8.0).
  get overflowMore() {
    return this.getAttribute('overflow') !== 'wrap';
  }

  afterRender(changed) {
    const result = super.afterRender?.(changed);
    this.observeActionRow();
    this.layoutActions();
    return result;
  }

  actionRow() {
    return this.querySelector(':scope > .sf-page-header > .sf-page-header-line > .sf-page-header-actions');
  }

  actionItems(row = this.actionRow()) {
    return row ? [...row.children].filter((child) => !child.classList.contains('sf-page-header-more')) : [];
  }

  // The line, the title and every action are watched: a sheet or a face
  // arriving later widens an action or the heading without resizing the line
  // (1.7.0: the title too; a heading that took its face late left a phone's
  // row laid for the wider fallback, on a line of its own). The observer's
  // callback runs after layout and before paint, so the row is never drawn
  // whole first.
  //
  // An action is watched by the box it draws, and that box is replaced when
  // the action's own code comes: sf-button draws a new <button> in place of
  // its printed one. The row's children and their markup are watched too
  // (1.8.0): the new box is observed and the row laid again at once. Before,
  // a printed head adopted by the code was laid while its buttons were
  // pictures held out of view (every width 0, everything fits) and never
  // again: on a phone path-and-action stood 116 high with both actions under
  // the heading, where its rule lays «Создать» and ⋯ beside it (68). A toggle
  // pressed or a look changed moves an action in or out of what must stay.
  observeActionRow() {
    const row = this.actionRow();
    if (!row || typeof ResizeObserver === 'undefined') {
      this._rowObserver?.disconnect();
      this._rowObserved = null;
      this._rowMutations?.disconnect();
      this._rowWatched = null;
      return;
    }
    this._rowObserver ??= new ResizeObserver(() => this.layoutActions());
    if (typeof MutationObserver !== 'undefined' && this._rowWatched !== row) {
      this._rowMutations ??= new MutationObserver(() => {
        if (!this.actionRow()) return;
        this.observeActionRow();
        this.layoutActions();
      });
      this._rowMutations.disconnect();
      this._rowMutations.observe(row, {childList: true, subtree: true, attributes: true, attributeFilter: ['appearance', 'variant', 'pressed', 'aria-pressed', 'priority']});
      this._rowWatched = row;
    }
    // overflow="wrap" watches the line alone: the star follows its wrap.
    const title = row.parentElement.querySelector(':scope > .sf-page-header-title');
    const boxes = [row.parentElement, title, ...(this.overflowMore ? this.actionItems(row) : []).map((item) => {
      let box = item;
      while (box && getComputedStyle(box).display === 'contents') box = box.firstElementChild;
      return box;
    })].filter(Boolean);
    if (this._rowObserved && boxes.length === this._rowObserved.length && boxes.every((box, at) => box === this._rowObserved[at])) return;
    this._rowObserver.disconnect();
    for (const box of boxes) this._rowObserver.observe(box);
    this._rowObserved = boxes;
  }

  // The room the actions have beside the title: the line less what stands
  // before them -- the start slot and the title at the width the line's wrap
  // gives it (its words, no wider than the g0 step). When the actions that
  // must stay do not fit there, the row takes a line of its own, as wide as
  // the line.
  roomBesideTitle(line, row) {
    const style = getComputedStyle(line);
    const gap = parseFloat(style.columnGap) || 0;
    let room = line.getBoundingClientRect().width - (parseFloat(style.paddingInlineStart) || 0) - (parseFloat(style.paddingInlineEnd) || 0);
    for (const child of line.children) {
      if (child === row) continue;
      if (child.classList.contains('sf-page-header-title')) {
        // With a description (1.10.0) the heading and its line stand in a
        // column (sf-page-header-name) that gives way as the heading does;
        // its words are the wider of the two lines.
        const heading = child.querySelector(':scope > .sf-page-header-heading, :scope > .sf-page-header-name');
        const titleGap = parseFloat(getComputedStyle(child).columnGap) || 0;
        // The star is counted at the actions' rung, the size it takes when
        // the actions keep the line beside it (C103): the room is the same
        // whichever size it has now, so the row never moves for the star.
        const parts = [...child.children].filter((part) => part !== heading)
          .map((part) => (part.classList.contains('sf-page-header-star') ? Math.max(drawnBox(part).width, this.actionsRungSide(row)) : drawnBox(part).width));
        const named = heading?.classList.contains('sf-page-header-name') ? Math.max(0, ...[...heading.children].map((line) => line.scrollWidth)) : heading?.scrollWidth;
        const words = (named || 0) + parts.reduce((sum, width) => sum + width + titleGap, 0);
        const basis = parseFloat(getComputedStyle(child).flexBasis);
        room -= Math.min(words, Number.isFinite(basis) ? basis : words) + gap;
      } else {
        room -= drawnBox(child).width + gap;
      }
    }
    return room;
  }

  layoutActions() {
    this.placeActions();
    this.syncStarRung();
    this.relayWhenSheetArrives();
  }

  // A row laid before the header's own sheet applied read no fold and no
  // title basis; the sheet's arrival need not resize anything the observers
  // watch, so the row is laid again once the sheet is in (its title rule:
  // flex-basis var(--sf-g0), never auto), checked once a frame, for a few
  // seconds at most (1.8.0: 1 load in 16 of a 435 px column was left with
  // every action in view where its rule folds it).
  relayWhenSheetArrives() {
    const title = this.querySelector(':scope > .sf-page-header > .sf-page-header-line > .sf-page-header-title');
    if (!title || this._sheetWait || getComputedStyle(title).flexBasis !== 'auto' || typeof requestAnimationFrame !== 'function') return;
    const until = performance.now() + 5000;
    const check = () => {
      const now = this.querySelector(':scope > .sf-page-header > .sf-page-header-line > .sf-page-header-title');
      if (!this.isConnected || !now) { this._sheetWait = 0; return; }
      if (getComputedStyle(now).flexBasis !== 'auto') { this._sheetWait = 0; this.layoutActions(); return; }
      this._sheetWait = performance.now() < until ? requestAnimationFrame(check) : 0;
    };
    this._sheetWait = requestAnimationFrame(check);
  }

  // The side of the actions' controls: the drawn height of the first one
  // (an icon button on that rung is as wide as it is tall).
  actionsRungSide(row = this.actionRow()) {
    const first = row ? this.actionItems(row).find((item) => !item.classList.contains('sf-page-header-out')) : null;
    return first ? drawnBox(controlOf(first)).height : 0;
  }

  // The star stands on the rung of the controls in its row (owner decision
  // C103: one row, one rung): the actions' size while they keep the line
  // beside the title, else the start slot's control («назад», a phone's menu
  // button) beside it, else the half step it has alone with the heading
  // (32). A phone's actions on a line of their own under the heading leave
  // the star at the half step. Whether the actions keep the line is the
  // line's own arithmetic, not where they stand now: the room beside the
  // title with the star at the actions' rung (roomBesideTitle) against the
  // row's width. It does not depend on the star's size, so a star that grows
  // never moves the row and never swings back.
  syncStarRung() {
    const line = this.querySelector(':scope > .sf-page-header > .sf-page-header-line');
    const star = line?.querySelector(':scope > .sf-page-header-title > .sf-page-header-star');
    if (!star) return;
    const title = star.parentElement;
    const row = this.actionRow();
    const sizeOf = (element) => element?.getAttribute('size') || '1';
    const first = row ? this.actionItems(row).find((item) => !item.classList.contains('sf-page-header-out')) : null;
    const start = [...line.children].find((child) => child !== title && child !== row && child.nodeType === 1);
    // Not laid yet: the line before its sheet, an action before its code.
    if (getComputedStyle(line).display !== 'flex' || (first && !drawnBox(controlOf(first)).height)) return;
    let want = '1/2';
    if (first) {
      // The line's wrap has no tolerance (placeActions takes the room a
      // pixel short); the row's drawn width with what left for ⋯ out.
      if (this.roomBesideTitle(line, row) - 1 >= row.getBoundingClientRect().width) want = sizeOf(first);
    } else if (start) {
      const box = title.getBoundingClientRect();
      const drawn = drawnBox(controlOf(start) || start);
      const middle = (drawn.top + drawn.bottom) / 2;
      if (drawn.height > 0 && middle > box.top && middle < box.bottom) want = sizeOf(start);
    }
    if (want === (star.getAttribute('size') || '1/2')) return;
    this._starRung = want;
    star.setAttribute('size', want);
  }

  placeActions() {
    const row = this.actionRow();
    const more = row?.querySelector(':scope > .sf-page-header-more');
    if (!row || !more) return;
    const items = this.actionItems(row);
    if (!this.overflowMore) {
      for (const item of [...items, more]) item.classList.remove('sf-page-header-out', 'sf-page-header-pin');
      return;
    }
    const units = items.map((element) => {
      const {rank, pin} = readPriority(element.getAttribute('priority'));
      return {element, rank, pin: pin || isMainAction(element) || isPressed(element), group: 0};
    });
    // The ones that must stay are marked (sf-page-header-pin): a printed
    // head folds on a narrow line by the same mark before its code comes.
    for (const unit of units) unit.element.classList.toggle('sf-page-header-pin', unit.pin);
    const line = row.parentElement;
    if (getComputedStyle(row).getPropertyValue('--sf-page-header--fold').trim() === '1') {
      const out = [];
      units.forEach((unit, at) => {
        unit.element.classList.toggle('sf-page-header-out', !unit.pin);
        if (!unit.pin) out.push(at);
      });
      more.classList.toggle('sf-page-header-out', !out.length);
      this.finishRow(row, more, out);
      return;
    }
    // The line's wrap has no tolerance: a row half a pixel over the room
    // beside the title moves to a line of its own, so the room is taken a
    // pixel short.
    let laid = layoutActionRow({row, units, more, outClass: 'sf-page-header-out', room: this.roomBesideTitle(line, row) - 1});
    // The ones that must stay do not fit beside the title: the row takes a
    // line of its own (the line wraps it there), as wide as the line.
    if (!laid.fits) laid = layoutActionRow({row, units, more, outClass: 'sf-page-header-out', room: rowRoomOf(line)});
    this.finishRow(row, more, laid.out);
  }

  finishRow(row, more, out) {
    row.setAttribute('data-sf-row-laid', '');
    this._actionsOut = out;
    more.setAttribute('aria-label', this.sfWord('more'));
    more.setAttribute('title', this.sfWord('more'));
  }

  // ⋯ pressed: the actions that left, as menu rows; a row presses its action.
  openActionsMore(event) {
    const anchor = controlOf(event.currentTarget);
    const items = this.actionItems();
    const entries = (this._actionsOut || []).map((at) => actionEntry(items[at], at)).filter((entry) => entry.text);
    openRowMenu(this, {
      anchor,
      entries,
      label: this.sfWord('more'),
      size: (items[0]?.getAttribute('size') || '1') === '1/2' ? '1/2' : '1',
      select: (id) => controlOf(this.actionItems()[Number(id)])?.click(),
    });
  }

  adoptLateSlotChildren() {
    if (!this._slotTemplatesCaptured) return;
    const late = [...this.children].filter((child) => HOST_SLOTS.has(child.getAttribute('slot')) && child.localName !== 'template');
    if (!late.length) return;
    for (const child of late) {
      const name = child.getAttribute('slot');
      const nodes = this._liveSlotNodes.get(name) || [];
      nodes.push(child);
      this._liveSlotNodes.set(name, nodes);
      // The page's content: a size it gives stays the page's (density, C22; it
      // follows the region like any size since C79).
      noteAuthored([child]);
      child.remove();
    }
    this.requestComponentUpdate('slot-change');
  }

  // star is optional (§4.2): absent draws no star, so it reads undefined
  // rather than the boolean's false.
  get star() {
    return this.hasAttribute('star') ? super.star : undefined;
  }

  set star(value) {
    if (value === undefined || value === null) this.removeAttribute('star');
    else this.setAttribute('star', value ? 'true' : 'false');
  }

  // VS-10 (views study, owner decision C393): where the Framework's icon
  // button has the toggle look (sf-button-icon appearance="toggle",
  // component.icon-buttons 1.20.0), the star is that toggle -- off a quiet
  // ghost, on the soft primary plate with its ring, the glyph kept outline,
  // aria-pressed its state and one name, «В избранное», so the state is said
  // once (C12). Where it has not, the star keeps the filled glyph in the
  // favourite's colour and says its state by its name (1.2.2). Checked on the
  // element sf-button-icon defines: until it is defined the star draws the
  // former look and is drawn again once it is.
  starLook() {
    const Button = globalThis.customElements?.get?.('sf-button-icon');
    if (!Button) {
      if (!this._starToggleWait && globalThis.customElements?.whenDefined) {
        this._starToggleWait = globalThis.customElements.whenDefined('sf-button-icon').then(() => this.requestComponentUpdate('star-look'));
      }
      return null;
    }
    const values = Button.sfInterface?.settings?.appearance?.values;
    return Array.isArray(values) && values.includes('toggle') ? 'toggle' : null;
  }

  // The template's press: the request toggle {on}; not cancelled, the header
  // writes the star itself.
  toggleStar() {
    const on = this.star !== true;
    if (this.sfEmit('toggle', {on}, {cancelable: true})) this.star = on;
  }

  // The actions in the order the header places them (owner decision C161 (3)):
  // the main action -- the filled sf-button -- last, at the end of the line,
  // the outlined and quiet ones before it in the page's order. The nodes are
  // the page's and are only placed, so the reading and Tab order follow what
  // is seen. Windows and panels keep their own order (C157 (3), C159 (4)).
  // ⋯ «Ещё» stands between the two, so the main action ends the line on a
  // phone too (C161 (3), (4)).
  orderedActions() {
    const nodes = [].concat(this.getSlotContent('actions') || []).filter((node) => node && node !== nothing);
    const main = nodes.filter((node) => node.nodeType === 1 && isMainAction(node));
    return {rest: nodes.filter((node) => !main.includes(node)), main};
  }

  // ⋯ takes the look of the actions it stands for: outlined when the first
  // action that may leave is outlined (the prototype's «Ещё» beside «Импорт»,
  // «Экспорт»), else the row's quiet ghost on the surface (C155 (2)).
  actionMoreLook() {
    const first = this.orderedActions().rest.find((node) => node.nodeType === 1);
    return first?.getAttribute('appearance') === 'outline' ? {appearance: 'outline', scheme: first.getAttribute('scheme') || ''} : {appearance: 'ghost', scheme: 'on-surface'};
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      sticky: this.sticky,
      actions: () => this.orderedActions(),
      heading: this.heading,
      headingLevel: this.headingLevelValue(),
      description: this.description || '',
      count: this.count,
      level: this.level,
      star: this.star,
      starLook: this.star === undefined ? null : this.starLook(),
      rootClass: this.getRootClass(),
      overflow: this.overflowMore ? 'more' : 'wrap',
      moreSize: this.actionMoreSize(),
      starSize: this._starRung ?? this.starSize(),
      moreLook: this.actionMoreLook(),
      text: (key) => this.sfWord(key),
      hostSlot: (name) => this.getSlotContent(name),
      hasHostSlot: (name) => this.hasSlotContent(name),
    });
  }

  // ⋯ stands on the actions' rung: the size the page gave its first action.
  actionMoreSize() {
    const nodes = this._liveSlotNodes?.get?.('actions') || [];
    const first = nodes.find((node) => node.nodeType === 1);
    return first?.getAttribute('size') || '1';
  }

  // The star's rung before the line is laid (syncStarRung then follows the
  // line): the size the page gave its first action (1 when it gave none), as
  // ⋯ takes; with no actions the start slot control's size; alone with the
  // heading the half step (32).
  starSize() {
    for (const name of ['actions', 'start']) {
      const first = (this._liveSlotNodes?.get?.(name) || []).find((node) => node.nodeType === 1);
      if (first) return first.getAttribute('size') || '1';
    }
    return '1/2';
  }

  // The heading element's level (1.10.0): 1 to 6, 1 when the attribute says
  // anything else. Only the tag changes; the look stays the fourth heading
  // step. A head inside a page that has its own h1 (a conversation embedded
  // in a page) says 2.
  headingLevelValue() {
    const value = Number(this.getAttribute('heading-level'));
    return Number.isInteger(value) && value >= 1 && value <= 6 ? value : 1;
  }

  // The media slot (1.10.0): an avatar before the title stands on the line's
  // rung, as the star does before the line is laid: the size the page gave
  // its first action, else its start control's, else 1 beside a description
  // (the heading and its line are that tall) and the half step alone with
  // the heading. A size the page writes itself stays; the header writes only
  // a size it chose (data-sf-page-header-size marks it, so it follows a rung
  // that changes).
  sizeMedia() {
    const media = (this._liveSlotNodes?.get?.('media') || []).filter((node) => node.nodeType === 1);
    if (!media.length) return;
    let rung = '';
    for (const name of ['actions', 'start']) {
      const first = (this._liveSlotNodes?.get?.(name) || []).find((node) => node.nodeType === 1);
      if (first) { rung = first.getAttribute('size') || '1'; break; }
    }
    if (!rung) rung = this.description ? '1' : '1/2';
    for (const node of media) {
      if (node.hasAttribute('size') && !node.hasAttribute('data-sf-page-header-size')) continue;
      if (node.getAttribute('size') !== rung) node.setAttribute('size', rung);
      node.setAttribute('data-sf-page-header-size', '');
    }
  }

  template() {
    this.sizeMedia();
    return renderPageHeaderTemplate(this.templateContext());
  }
}

SfPageHeader.define('sf-header-page');

export {SfPageHeader};
