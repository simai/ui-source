// The head of an admin page: where the page is, what it is called, how many
// records it holds, whether it is a favourite, and its main action. The admin's
// top bar is gone (larena-specs frontend-interface-program, sf-admin-menu
// assignment, v5, section 6), so this is the only place a page says these
// things -- and it is a shared part because every admin page, Docara's
// included, says the same four.
//
// The host owns everything in it. The path, the start of the line on a phone
// and the actions are the host's own markup in slots; the heading, the count
// and whether the page is shared by every site are attributes. The star is the
// one control the header draws itself, and pressing it is a request the host
// answers: sf-page-header-toggle {on} is cancelable, and a host that wants to
// wait for its own answer cancels it and sets `star` when it knows.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js, the words are the
// language files', and the old sf-page-header-star follows the toggle as a
// dated alias (aliases.json).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {noteAuthored} from '../../core/js/density';
import {actionEntry, controlOf, drawnBox, isMainAction, isPressed, layoutActionRow, openRowMenu, readPriority, rowRoom as rowRoomOf} from '../../core/js/overflow-row.js';
import {renderPageHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const PageHeaderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

// The header's slots. A child naming one of them is the page's content for it.
const HOST_SLOTS = new Set(['path', 'start', 'actions']);

class SfPageHeader extends PageHeaderElement {
  // The base takes the slot children once, when the element connects. A page
  // that adds an action later -- «Создать» once the list has loaded, a button
  // the person's rights allow -- appended it to the host, and it stood after
  // the drawn header, outside it (ui-doc «Рецепты», 2026-11-10). A child that
  // names a slot and arrives after the connection joins that slot, after the
  // ones it already holds, and the header draws again.
  onConnected() {
    super.onConnected?.();
    if (this._lateSlotObserver) return;
    this._lateSlotObserver = new MutationObserver(() => this.adoptLateSlotChildren());
    this._lateSlotObserver.observe(this, {childList: true});
    this.adoptLateSlotChildren();
  }

  onDisconnected() {
    this._lateSlotObserver?.disconnect();
    this._lateSlotObserver = null;
    this._rowObserver?.disconnect();
    this._rowObserver = null;
    this._rowObserved = null;
    super.onDisconnected?.();
  }

  // ─── «Ещё» (owner decision C155 (7), C161 (4)) ─────────────────────────────
  // overflow="more" (the default): the actions stay on one row; what does not
  // fit leaves for ⋯ at its end -- from the end, by the actions' priority
  // where the page gives one, the main action (the filled one), a pressed
  // toggle and priority="pin" never. ⋯ lists them with their icons and words
  // and presses the action itself. overflow="wrap" keeps the former row that
  // wraps onto further rows (OV-2).
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

  // The line and every action are watched: a sheet or a face arriving later
  // widens an action without resizing the line. The observer's callback runs
  // after layout and before paint, so the row is never drawn whole first.
  observeActionRow() {
    const row = this.actionRow();
    if (!row || !this.overflowMore || typeof ResizeObserver === 'undefined') {
      this._rowObserver?.disconnect();
      this._rowObserved = null;
      return;
    }
    this._rowObserver ??= new ResizeObserver(() => this.layoutActions());
    const boxes = [row.parentElement, ...this.actionItems(row).map((item) => {
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
        const heading = child.querySelector(':scope > .sf-page-header-heading');
        const titleGap = parseFloat(getComputedStyle(child).columnGap) || 0;
        const parts = [...child.children].filter((part) => part !== heading).map((part) => drawnBox(part).width);
        const words = (heading?.scrollWidth || 0) + parts.reduce((sum, width) => sum + width + titleGap, 0);
        const basis = parseFloat(getComputedStyle(child).flexBasis);
        room -= Math.min(words, Number.isFinite(basis) ? basis : words) + gap;
      } else {
        room -= drawnBox(child).width + gap;
      }
    }
    return room;
  }

  layoutActions() {
    const row = this.actionRow();
    const more = row?.querySelector(':scope > .sf-page-header-more');
    if (!row || !more) return;
    const items = this.actionItems(row);
    if (!this.overflowMore) {
      for (const item of [...items, more]) item.classList.remove('sf-page-header-out');
      return;
    }
    const units = items.map((element) => {
      const {rank, pin} = readPriority(element.getAttribute('priority'));
      return {element, rank, pin: pin || isMainAction(element) || isPressed(element), group: 0};
    });
    const line = row.parentElement;
    let laid = layoutActionRow({row, units, more, outClass: 'sf-page-header-out', room: this.roomBesideTitle(line, row)});
    // The ones that must stay do not fit beside the title: the row takes a
    // line of its own (the line wraps it there), as wide as the line.
    if (!laid.fits) laid = layoutActionRow({row, units, more, outClass: 'sf-page-header-out', room: rowRoomOf(line)});
    const out = laid.out;
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

  // The template's press: the request toggle {on}; not cancelled, the header
  // writes the star itself.
  toggleStar() {
    const on = this.star !== true;
    if (this.sfEmit('toggle', {on}, {cancelable: true})) this.star = on;
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      heading: this.heading,
      count: this.count,
      level: this.level,
      star: this.star,
      rootClass: this.getRootClass(),
      overflow: this.overflowMore ? 'more' : 'wrap',
      moreSize: this.actionMoreSize(),
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

  template() {
    return renderPageHeaderTemplate(this.templateContext());
  }
}

SfPageHeader.define('sf-header-page');

export {SfPageHeader};
