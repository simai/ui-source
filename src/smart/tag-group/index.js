// sf-tag-group: a row of tags (owner decision C145 (3)-(5), 2026-11-14; tags
// study ui-control control/research/2026-11-14-tags.md #q-group, #q-keys,
// #q-more, prototype prototypes/tags-study.html):
//
//   <sf-tag-group aria-label="Города">
//     <sf-tag kind="default" closable text="Москва"></sf-tag>
//     <sf-tag kind="default" closable text="Казань"></sf-tag>
//   </sf-tag-group>
//
//   <sf-tag-group aria-label="Фильтры" selection="one">
//     <sf-tag key="new" text="Новые"></sf-tag>
//     <sf-tag key="mine" text="Мои" active></sf-tag>
//   </sf-tag-group>
//
// The tags are the page's own children; the group draws none of them and
// never moves them. What it owns is the row:
//
// - the tags stand 4 apart (gap-1/4, C105 H5);
// - it is a list to a screen reader (role list, each tag a listitem);
// - one Tab stop for the whole row: ArrowLeft and ArrowRight walk the tags
//   (mirrored right to left), Home and End go to the ends, Delete or
//   Backspace removes the removable tag stood on (sf-tag-close, as its cross;
//   the page removes the element) and the focus goes to its neighbour; each
//   step is said in a polite line, «Москва, 1 из 3, Delete — убрать» (C139
//   (6), the words of sf-input-lookup's chips);
// - layout row (the default; filters, a table cell, a card): one row, the
//   tags that do not fit leave it and «+N» stands after the last one shown;
//   «+N» opens a popover (sf-popover, the Framework's panel) with the hidden
//   tags and their crosses -- a press there acts on the page's own tag (C58,
//   C145 (5)); the row keeps its height. layout wrap (a form): the row wraps;
// - selection one or many for filter tags (kind checkbox): one keeps a single
//   tag chosen; both report sf-tag-group-select {ids, id, selected}, and the
//   values selected and selected-ids say what is chosen. A tag is known by its
//   key, else its text.
//
// Every bundle carries its own copy of the modules it imports: the helpers of
// the tag's row (smart/tag/js/tag-row.js) are stateless, and the live line
// they write is one element on the page.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {overflows, setAttr, nameOf, stopOf, stopsIn, said} from '../tag/js/tag-row.js';
import {renderTagGroupTemplate} from './js/templates/default.js';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const OVER = 'data-sf-tag-over';
const SHRINK = 'data-sf-tag-shrink';
const MORE = 'data-sf-tag-group-more';
const COPY = 'data-sf-tag-group-copy';
const ROVING = 'sfTagGroupRoving';

// What a copy in the «+N» panel takes from its tag: what it shows and does.
const COPIED = ['kind', 'type', 'status', 'size', 'height', 'appearance', 'text', 'count', 'icon', 'color', 'color-class',
  'avatar-image-url', 'avatar-text', 'closable', 'interactive', 'href', 'active', 'disabled', 'close-label', 'aria-label', 'key'];
// What a tag's change of asks the row to be laid out again.
const WATCHED = ['active', 'disabled', 'hidden', 'text', 'closable', 'size', 'height', 'kind', 'href'];

const isTag = (node) => node?.localName === 'sf-tag' && !node.hasAttribute('data-sf-tag-more');
const keyOf = (tag) => String(tag.groupKey ?? tag.getAttribute('key') ?? tag.getAttribute('text') ?? tag.textContent ?? '').trim();
const isChosen = (tag) => tag.hasAttribute('active') && tag.getAttribute('active') !== 'false';
const listOf = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(',').map((one) => one.trim()).filter(Boolean);
    }
  }
  return [];
};

const GroupElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfTagGroup extends GroupElement {
  // Its DOM updates are all it draws: the first one counts as its render
  // (Smart base, simai/ui-source#70), as sf-popover's.
  static rendersNoTemplate = true;

  static get props() {
    return {...super.props, templateName: {attribute: 'template', default: 'default'}};
  }

  constructor() {
    super();
    this._frame = 0;
    this._active = 0;
    this._busy = false;
    this._more = null;
    this._copies = new Map();
  }

  get componentName() {
    return 'tag-group';
  }

  // The host is the row's box (the base makes a Smart host display: contents,
  // which lays out nothing). What the page set inline that a child inherits
  // stays on the host before its box.
  applyHostDisplayStyle() {
    const next = [this.hostInheritedStyle(), 'display: flex;'].filter(Boolean).join(' ');
    return this.writeHostStyle(next);
  }

  // The tags are the page's nodes, where the page wrote them (§5.1: a
  // template returning nothing would delete them).
  captureSlotTemplates() {
    this._slotTemplatesCaptured = true;
  }

  resolveUpdateMode() {
    return 'dom';
  }

  updateDom() {
    if (this.getAttribute('role') !== 'list') this.setAttribute('role', 'list');
    this.schedule();
    return true;
  }

  templateContext() {
    return this.createTemplateContext({...this.getPropsContext(), component: this});
  }

  template() {
    return renderTagGroupTemplate(this.templateContext());
  }

  onConnected() {
    super.onConnected?.();
    this._keydown = (event) => this.onKeydown(event);
    this._focusin = (event) => this.onFocusin(event);
    this._change = (event) => this.onTagChange(event);
    this.addEventListener('keydown', this._keydown);
    this.addEventListener('focusin', this._focusin);
    this.addEventListener('change', this._change);
    if (typeof MutationObserver === 'function') {
      this._mutations = new MutationObserver((records) => {
        if (this._busy) return;
        if (records.some((record) => record.target === this || isTag(record.target))) this.schedule();
      });
      this._mutations.observe(this, {childList: true});
    }
    if (typeof ResizeObserver === 'function') {
      let width = -1;
      this._resize = new ResizeObserver(([entry]) => {
        const now = Math.round(entry?.contentRect?.width ?? 0);
        if (now === width) return;
        width = now;
        this.schedule();
      });
      this._resize.observe(this);
    }
    // A face that arrives changes the tags' widths.
    globalThis.document?.fonts?.ready?.then(() => this.schedule());
    this.schedule();
  }

  onDisconnected() {
    this.removeEventListener('keydown', this._keydown);
    this.removeEventListener('focusin', this._focusin);
    this.removeEventListener('change', this._change);
    this._mutations?.disconnect();
    this._resize?.disconnect();
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
    super.onDisconnected?.();
  }

  /** A tag in the row drew (sf-tag asks; its width may have changed). */
  sfTagDrew() {
    this.schedule();
  }

  // ------------------------------------------------------------ the values

  /** The page's own tags of the row, in order. */
  get tags() {
    return [...this.children].filter(isTag);
  }

  /** §18.2: the chosen tag's key; with selection many, the first chosen. */
  get selected() {
    const chosen = this.tags.find(isChosen);
    return chosen ? keyOf(chosen) : '';
  }

  set selected(value) {
    this.choose(value === null || value === undefined || value === '' ? [] : [String(value)]);
  }

  /** §18.2: the keys of the chosen tags, in the row's order. */
  get selectedIds() {
    return this.tags.filter(isChosen).map(keyOf);
  }

  set selectedIds(value) {
    this.choose(listOf(value));
  }

  // Chooses the tags of the keys given and no other (one: the first only).
  choose(keys) {
    const wanted = this.selection === 'one' ? keys.slice(0, 1) : keys;
    this._busy = true;
    try {
      for (const tag of this.tags) {
        const on = wanted.includes(keyOf(tag));
        if (on !== isChosen(tag)) tag.toggleAttribute('active', on);
      }
    } finally {
      this._mutations?.takeRecords();
      this._busy = false;
    }
    this.schedule();
  }

  // A person chose or cleared a filter tag of the row.
  onTagChange(event) {
    const tag = event.target;
    if (!isTag(tag) || tag.parentElement !== this || this.selection === 'none') return;
    const selected = Boolean(event.detail?.active ?? isChosen(tag));
    if (this.selection === 'one' && selected) {
      for (const other of this.tags) if (other !== tag && isChosen(other)) other.toggleAttribute('active', false);
    }
    this.sfEmit('select', {ids: this.selectedIds, id: keyOf(tag), selected});
  }

  // ------------------------------------------------------------ the row

  schedule() {
    if (this._frame || typeof requestAnimationFrame !== 'function') return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this.settle();
    });
  }

  settle() {
    if (!this.isConnected) return;
    this._busy = true;
    try {
      for (const tag of this.tags) {
        if (tag.getAttribute('role') !== 'listitem') tag.setAttribute('role', 'listitem');
        this._mutations?.observe(tag, {attributes: true, attributeFilter: WATCHED});
      }
      this.fit();
      this.rove();
    } finally {
      this._mutations?.takeRecords();
      this._busy = false;
    }
  }

  fit() {
    const tags = this.tags;
    for (const tag of tags) {
      setAttr(tag, OVER, false);
      setAttr(tag, SHRINK, false);
    }
    const shown = tags.filter((tag) => !tag.hidden);
    if (this.layout === 'wrap' || shown.length < 2 || !overflows(this)) {
      this.dropMore();
      return;
    }
    const more = this.moreElement(shown);
    let count = shown.length;
    while (count > 1) {
      count -= 1;
      setAttr(shown[count], OVER, true);
      this.placeMore(more, shown.slice(count));
      if (!overflows(this)) {
        this.fillPanel(shown.slice(count));
        return;
      }
    }
    // The first tag always stands: it gives up its width and ends in an
    // ellipsis.
    setAttr(shown[0], SHRINK, true);
    this.fillPanel(shown.slice(1));
  }

  // «+N»: an sf-popover whose trigger is an interactive tag of the first
  // tag's size, whose surface lists the hidden tags (C145 (5)). It is the last
  // child of the row, a listitem of its own.
  moreElement(shown) {
    let more = this._more;
    if (!more) {
      const doc = this.ownerDocument;
      more = doc.createElement('span');
      more.setAttribute(MORE, '');
      more.setAttribute('role', 'listitem');
      const popover = doc.createElement('sf-popover');
      popover.setAttribute('placement', 'bottom-start');
      popover.setAttribute('width', 'var(--sf-g0)');
      popover.setAttribute('offset', 'var(--sf-space-1\\/4)');
      const trigger = doc.createElement('sf-tag');
      trigger.setAttribute('slot', 'trigger');
      trigger.setAttribute('kind', 'default');
      trigger.setAttribute('interactive', '');
      trigger.setAttribute('data-sf-tag-more', '');
      const surface = doc.createElement('div');
      surface.setAttribute('slot', 'content');
      surface.className = 'sf-tag-group__panel';
      surface.id = `${this.id || 'sf-tag-group'}-more-${Math.random().toString(36).slice(2, 8)}`;
      const list = doc.createElement('sf-tag-group');
      list.setAttribute('layout', 'wrap');
      list.setAttribute(COPY, '');
      surface.append(list);
      // A copy's press is the page's tag's: its events stop here and the
      // page's tag acts (it sends sf-tag-close or change itself).
      const forward = (event) => {
        const copy = event.target?.closest?.('sf-tag');
        const tag = copy?._sfOriginal;
        if (!tag) return;
        event.stopPropagation();
        if (event.type === 'sf-tag-close') tag.onClose?.();
        else if (event.type === 'change') {
          if (Boolean(event.detail?.active) !== isChosen(tag)) tag.onToggle?.();
        }
      };
      for (const type of ['sf-tag-close', 'close', 'change']) surface.addEventListener(type, forward);
      popover.append(trigger, surface);
      more.append(popover);
      this._more = more;
      this._panel = list;
    }
    const first = shown[0];
    const trigger = more.querySelector(':scope > sf-popover > sf-tag[slot="trigger"]');
    for (const name of ['size', 'height']) {
      const value = first.getAttribute(name);
      if (value === null) trigger.removeAttribute(name);
      else if (trigger.getAttribute(name) !== value) trigger.setAttribute(name, value);
    }
    return more;
  }

  placeMore(more, hidden) {
    if (more.parentElement !== this || more.nextElementSibling) this.append(more);
    const count = hidden.length;
    const trigger = more.querySelector(':scope > sf-popover > sf-tag[slot="trigger"]');
    const text = `+${count}`;
    if (trigger.getAttribute('text') !== text) trigger.setAttribute('text', text);
    const label = this.sfWord('more', {count, vars: {n: count, names: hidden.map(nameOf).join(', ')}});
    if (trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label);
    const popover = more.firstElementChild;
    const panel = this.sfWord('more-panel', {count, vars: {n: count}});
    if (popover.getAttribute('label') !== panel) popover.setAttribute('label', panel);
  }

  // The panel's tags: a copy per hidden tag, kept by its tag so a focused
  // copy stays itself while the row changes.
  fillPanel(hidden) {
    const list = this._panel;
    if (!list) return;
    const keep = new Set(hidden);
    for (const [tag, copy] of this._copies) {
      if (keep.has(tag)) continue;
      copy.remove();
      this._copies.delete(tag);
    }
    let before = list.firstElementChild;
    for (const tag of hidden) {
      let copy = this._copies.get(tag);
      if (!copy) {
        copy = this.ownerDocument.createElement('sf-tag');
        copy.setAttribute(COPY, '');
        copy._sfOriginal = tag;
        this._copies.set(tag, copy);
      }
      for (const name of COPIED) {
        const value = tag.getAttribute(name);
        if (value === null) {
          if (copy.hasAttribute(name)) copy.removeAttribute(name);
        } else if (copy.getAttribute(name) !== value) copy.setAttribute(name, value);
      }
      if (copy !== before) list.insertBefore(copy, before);
      before = copy.nextElementSibling;
    }
  }

  dropMore() {
    const more = this._more;
    if (!more?.isConnected) return;
    const popover = more.firstElementChild;
    const hadFocus = more.contains(this.ownerDocument.activeElement);
    if (popover?.open) popover.close?.({reason: 'api'});
    more.remove();
    for (const copy of this._copies.values()) copy.remove();
    this._copies.clear();
    // The focus stood on «+N» or in its panel: it goes to the last tag.
    if (hadFocus) {
      const items = this.items();
      this._active = Math.max(0, items.length - 1);
      requestAnimationFrame(() => this.focusAt(this._active));
    }
  }

  // ------------------------------------------------------------ keys

  // What the row's one Tab stop walks: the shown tags that can be reached,
  // then «+N».
  items() {
    const out = this.tags.filter((tag) => !tag.hidden && !tag.hasAttribute(OVER) && !tag.disabled && stopOf(tag));
    if (this._more?.parentElement === this) out.push(this._more);
    return out;
  }

  stopOfItem(item) {
    if (item === this._more) return item.querySelector('sf-tag[slot="trigger"] button');
    return stopOf(item);
  }

  buttonsOf(item) {
    if (item === this._more) return [...item.querySelectorAll(':scope > sf-popover > sf-tag[slot="trigger"] button')];
    return stopsIn(item);
  }

  rove() {
    const items = this.items();
    const was = this._roved || [];
    // Tags that left the walk get their own stops back.
    for (const item of was) {
      if (items.includes(item)) continue;
      for (const button of this.buttonsOf(item)) {
        if (button.dataset[ROVING] === undefined) continue;
        button.removeAttribute('tabindex');
        delete button.dataset[ROVING];
      }
    }
    this._roved = items;
    if (!items.length) return;
    if (this._active >= items.length) this._active = items.length - 1;
    if (this._active < 0) this._active = 0;
    items.forEach((item, index) => {
      const stop = this.stopOfItem(item);
      for (const button of this.buttonsOf(item)) {
        const tabIndex = button === stop && index === this._active ? '0' : '-1';
        if (button.getAttribute('tabindex') !== tabIndex) button.setAttribute('tabindex', tabIndex);
        button.dataset[ROVING] = '';
      }
    });
  }

  focusAt(index) {
    const items = this.items();
    if (!items.length) return;
    this._active = Math.max(0, Math.min(index, items.length - 1));
    this.rove();
    this.stopOfItem(items[this._active])?.focus();
  }

  // The item a key or a focus came from, when it is this row's (a key in the
  // «+N» panel belongs to the panel's own group).
  itemOf(event) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('sf-tag-group') !== this) return -1;
    if (target.closest('[slot="content"]')) return -1;
    return this.items().findIndex((item) => item.contains(target));
  }

  onKeydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = this.itemOf(event);
    if (index < 0) return;
    const items = this.items();
    const rtl = getComputedStyle(this).direction === 'rtl';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const ahead = rtl ? 'ArrowLeft' : 'ArrowRight';
    const {key} = event;
    if (key === back || key === ahead || key === 'Home' || key === 'End') {
      event.preventDefault();
      const next = key === 'Home' ? 0 : key === 'End' ? items.length - 1
        : Math.max(0, Math.min(items.length - 1, index + (key === ahead ? 1 : -1)));
      this.focusAt(next);
      return;
    }
    if (key !== 'Delete' && key !== 'Backspace') return;
    const tag = items[index];
    if (tag === this._more || !tag.closable) return;
    event.preventDefault();
    tag.onClose?.();
    // The page removes the tag (sf-tag-close); the focus then goes to the
    // neighbour that took its place, or the one before the last.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (tag.isConnected && tag.parentElement === this) return;
      this.settle();
      const left = this.items();
      if (left.length) this.focusAt(Math.min(index, left.length - 1));
    }));
  }

  onFocusin(event) {
    const index = this.itemOf(event);
    if (index < 0) return;
    const items = this.items();
    if (index !== this._active) {
      this._active = index;
      this.rove();
    }
    this.announce(items[index], index, items.length);
  }

  announce(item, index, total) {
    let text;
    if (item === this._more) {
      text = item.querySelector('sf-tag[slot="trigger"]')?.getAttribute('aria-label') || '';
    } else {
      const vars = {label: nameOf(item), position: index + 1, total};
      text = this.sfWord(item.closable ? 'position' : 'position-plain', {vars});
    }
    if (!text) return;
    const line = said(this.ownerDocument);
    line.textContent = '';
    requestAnimationFrame(() => {
      line.textContent = text;
    });
  }
}

SfTagGroup.define('sf-tag-group');

export {SfTagGroup};
