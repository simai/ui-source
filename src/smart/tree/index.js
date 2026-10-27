// A tree of entries: folders that open, files and links. One Tab stop walked
// with the arrows, an optional selection, and drops of records and files on an
// entry.
//
// The entries (standard simai.smart-component 1.3.8 §18; simai/ui-source#43).
// The tree draws them itself, flat, as rows of class markup -- the row
// sf-tree-item draws (../tree-item/js/templates/row.js) -- keyed by id, so a
// change of one entry rewrites that row in place and nothing else. Drawn as a
// nest of sf-tree-item elements, each with sf-icon elements in it, a tree of
// 2 000 nodes took 33 s to draw and 16.6 s for any change: every change built
// every element again, and every element that drew asked every other one for
// its tab stop. Over 300 visible entries only the rows in view of the nearest
// scroller are drawn, between two spacers (§18.4, `window`).
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js; the events are open, select, toggle, move,
// attach and window, the old names their dated aliases (aliases.json).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {isTreeItemNode, treeItemNodeToData} from '../tree-item/js/node-data.js';
import { renderTreeTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import itemEn from '../tree-item/lang/en.json';
import itemRu from '../tree-item/lang/ru.json';

// What a list writes when its rows are dragged: {ids, source}.
const RECORDS_TYPE = 'application/x-sf-records+json';
// Quality profile gate 17 (window_from_entries): a tree that may hold more
// entries than this draws only those in view.
const WINDOW_FROM = 300;
// Rows drawn beyond the view on each side, and the height a row is taken to
// have before one has been measured.
const WINDOW_MARGIN = 20;
const ROW_GUESS = 48;

const text = (value) => (value === undefined || value === null ? '' : String(value));
const pick = (item, kebab, camel) => (item[kebab] !== undefined ? item[kebab] : item[camel]);

// One entry as the tree holds it: the fields of component.json's entry shape
// (kebab-case), read from the camelCase ones too, with its id (§18.1).
function normalizeEntry(item, place) {
  if (!item || typeof item !== 'object') return null;
  const value = text(item.value);
  const id = text(item.id ?? (value !== '' ? value : place));
  const children = Array.isArray(item.children) ? item.children : [];
  return {
    id,
    value,
    label: text(item.label ?? item.text ?? item.title),
    href: text(item.href),
    target: text(item.target),
    rel: text(item.rel),
    // `kind` is the axis; `type` the legacy name.
    kind: text(item.kind || item.type) === 'file' ? 'file' : 'folder',
    open: Boolean(item.open),
    selected: Boolean(item.selected),
    active: Boolean(item.active),
    disabled: Boolean(item.disabled),
    icon: item.icon !== false,
    openIcon: text(pick(item, 'open-icon', 'openIcon')),
    closedIcon: text(pick(item, 'closed-icon', 'closedIcon')),
    chevronOpenIcon: text(pick(item, 'chevron-open-icon', 'chevronOpenIcon')),
    chevronClosedIcon: text(pick(item, 'chevron-closed-icon', 'chevronClosedIcon')),
    openLabel: text(pick(item, 'open-label', 'openLabel')),
    closeLabel: text(pick(item, 'close-label', 'closeLabel')),
    revision: text(item.revision),
    children,
  };
}

const TreeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  // The chevron's names are sf-tree-item's words.
  lang: {en: {...en, runtime: {...itemEn.runtime, ...en.runtime}}, ru: {...ru, runtime: {...itemRu.runtime, ...ru.runtime}}},
  source: 'ru',
  aliases,
  actions: {
    expand({id}) { return this.setEntryOpen(id, true); },
    collapse({id}) { return this.setEntryOpen(id, false); },
    'focus-entry'({id}) {
      const at = this._rows.findIndex((row) => row.id === text(id));
      if (at < 0) return {outcome: 'refused', reason: 'unknown'};
      this.focusRow(at);
      return {outcome: 'applied'};
    },
  },
});

class SfTree extends TreeElement {
  constructor() {
    super();
    this._itemObserver = null;
    this._source = [];
    this._entries = new Map();
    this._open = new Map();
    this._rows = [];
    this._tabStop = null;
    this._typeahead = '';
    this._typeaheadTimer = null;
    this._window = {first: 0, last: -1};
    this._rowHeight = 0;
    this._scroller = null;
    this._frame = 0;
  }

  // ---- the entries -------------------------------------------------------

  // Entries may arrive as data or as sf-tree-item children. The children are
  // read once and removed, and the tree watches only for children appearing.
  get items() {
    return this._source;
  }

  set items(value) {
    this._source = Array.isArray(value) ? value : [];
    this.takeEntries(true);
    this.requestComponentUpdate('items');
  }

  captureInitialItems(append = false) {
    const nodes = Array.from(this.childNodes || []).filter(isTreeItemNode);
    if (!nodes.length) return false;
    const next = nodes.map(treeItemNodeToData);
    this._source = append ? [...this._source, ...next] : next;
    nodes.forEach((node) => node.remove());
    this.takeEntries(false);
    return true;
  }

  observeItemChildren() {
    if (this._itemObserver) return;
    this._itemObserver = new MutationObserver((mutations) => {
      const added = mutations.some((mutation) => Array.from(mutation.addedNodes || []).some(isTreeItemNode));
      if (added && this.captureInitialItems(true)) this.requestComponentUpdate('items');
    });
    this._itemObserver.observe(this, {childList: true});
  }

  // Reads the source into entries by id. The open state of an id seen before
  // survives (§18.1 entry state); the selection keeps the ids still present,
  // or is set by the entries when they say selected (§18.2).
  takeEntries(fromData) {
    const entries = new Map();
    const said = [];
    const walk = (list, parent, prefix) => list.map((item, index) => {
      const entry = normalizeEntry(item, prefix ? `${prefix}/${index}` : String(index));
      if (!entry || entries.has(entry.id)) return null;
      entry.parent = parent;
      entries.set(entry.id, entry);
      if (!this._open.has(entry.id)) this._open.set(entry.id, entry.open);
      if (entry.selected) said.push(entry.id);
      entry.childIds = walk(entry.children, entry.id, entry.id).filter(Boolean);
      return entry.id;
    });
    this._roots = walk(this._source, null, '').filter(Boolean);
    this._rowsDirty = true;
    for (const id of [...this._open.keys()]) if (!entries.has(id)) this._open.delete(id);
    this._entries = entries;
    const before = this.selectionIds();
    let next;
    if (said.length) next = this.selection === 'many' ? said : [said.at(-1)];
    else next = before.filter((id) => entries.has(id));
    this.writeSelection(next, {quiet: !fromData || same(before, next)});
  }

  // The visible entries in order, with their level and place among siblings.
  // Kept until the entries or an open state change: a scroll only moves the
  // window over the same rows.
  flatten() {
    if (!this._rowsDirty && this._rows) return this._rows;
    this._rowsDirty = false;
    const rows = [];
    const visit = (ids, level) => ids.forEach((id, index) => {
      const entry = this._entries.get(id);
      const branch = entry.kind !== 'file' && entry.childIds.length > 0;
      const open = branch && this._open.get(id) === true;
      rows.push({id, entry, level, setsize: ids.length, posinset: index + 1, branch, open});
      if (open) visit(entry.childIds, level + 1);
    });
    visit(this._roots || [], 1);
    this._rows = rows;
    this._hasBranches = rows.some((row) => row.branch) || [...this._entries.values()].some((entry) => entry.childIds.length);
    return rows;
  }

  // ---- selection (§18.2) -------------------------------------------------

  selectionIds() {
    if (this.selection === 'many') return Array.isArray(this.selectedIds) ? this.selectedIds.map(text) : [];
    const one = text(this.selected);
    return one ? [one] : [];
  }

  writeSelection(ids, {quiet = true} = {}) {
    const ordered = [...this._entries.keys()].filter((id) => ids.includes(id));
    this.__sfManifestData = this.__sfManifestData || {};
    this.__sfManifestData['selected-ids'] = ordered;
    const current = ids.at(-1) ?? '';
    if (text(this.getAttribute('selected')) !== current) {
      if (current) this.setAttribute('selected', current);
      else this.removeAttribute('selected');
    }
    if (!quiet) this.requestComponentUpdate('selection');
    return ordered;
  }

  get selectedIds() {
    return this.__sfManifestData?.['selected-ids'] ?? [];
  }

  set selectedIds(value) {
    this.writeSelection((Array.isArray(value) ? value : []).map(text));
    this.requestComponentUpdate('selected-ids');
  }

  isSelected(id) {
    return this.selection !== 'none' && this.selectionIds().includes(id);
  }

  selectRow(row) {
    const mode = this.selection;
    if (mode !== 'one' && mode !== 'many') return;
    const ids = this.selectionIds();
    const on = mode === 'many' ? !ids.includes(row.id) : true;
    const next = mode === 'many' ? (on ? [...ids, row.id] : ids.filter((id) => id !== row.id)) : [row.id];
    const ordered = this.writeSelection(next, {quiet: false});
    this.sfEmit('select', {ids: ordered, id: row.id, selected: on});
  }

  // ---- open state (§18.1) ------------------------------------------------

  setEntryOpen(id, open) {
    const entry = this._entries.get(text(id));
    if (!entry) return {outcome: 'refused', reason: 'unknown'};
    if (entry.kind === 'file' || !entry.childIds.length) return {outcome: 'refused', reason: 'leaf'};
    if (entry.disabled) return {outcome: 'refused', reason: 'disabled'};
    if (this._open.get(entry.id) === Boolean(open)) return {outcome: 'applied'};
    this._open.set(entry.id, Boolean(open));
    this._rowsDirty = true;
    this.requestComponentUpdate('open');
    this.sfEmit('toggle', {id: entry.id, open: Boolean(open), value: entry.value});
    return {outcome: 'applied'};
  }

  // ---- the old details (aliases.json) ------------------------------------

  rowElement(id) {
    if (id === undefined || id === null) return null;
    return this.querySelector(`.sf-tree-item[data-sf-entry="${CSS.escape(String(id))}"]`);
  }

  sfAliasAdapters() {
    const item = (detail) => this.rowElement(detail.id ?? detail.parent);
    return {
      'sf-tree-selection-change': (detail) => ({item: item(detail), selected: detail.selected, value: this._entries.get(detail.id)?.value ?? ''}),
      'sf-tree-item-click': (detail) => ({item: item(detail), value: detail.value, originalEvent: this._pressEvent ?? null}),
      'sf-tree-item-toggle': (detail) => ({item: item(detail), open: detail.open, value: detail.value}),
      'sf-tree-records-drop': (detail) => ({value: this._entries.get(detail.parent)?.value ?? '', ids: detail.ids, source: detail.source}),
      'sf-tree-files-drop': (detail) => ({value: this._entries.get(detail.parent)?.value ?? '', files: detail.files}),
    };
  }

  // The helper the docs show: the row's element first, as the item was.
  onToggle(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-tree-toggle', (event) => handler(this.rowElement(event.detail?.id), event.detail, event), options);
    }
    return this;
  }

  getRenderedItems() {
    return Array.from(this.querySelectorAll('.sf-tree-item[data-sf-entry]'));
  }

  getVisibleItems() {
    return this.getRenderedItems();
  }

  // ---- drops (owner, 2026-10-15, the file manager) -----------------------

  // An entry takes records dragged from a list -- accept-records -- and files
  // from the computer -- accept-files. The tree moves and uploads nothing
  // itself; it asks: move {ids, parent} and attach {files, parent}. The
  // records travel as application/x-sf-records+json, which sf-table writes.
  dropKind(event) {
    const types = [...(event.dataTransfer?.types ?? [])];
    if (this.acceptRecords && types.includes(RECORDS_TYPE)) return 'records';
    if (this.acceptFiles && types.includes('Files')) return 'files';
    return null;
  }

  dropNode(event) {
    const node = event.target?.closest?.('.sf-tree-item[data-sf-entry]');
    return node && this.contains(node) && node.getAttribute('aria-disabled') !== 'true' ? node : null;
  }

  markDropTarget(node) {
    if (this._dropTarget === node) return;
    this._dropTarget?.removeAttribute('data-sf-drop-target');
    this._dropTarget = node;
    node?.setAttribute('data-sf-drop-target', '');
  }

  handleTreeDragOver = (event) => {
    const kind = this.dropKind(event);
    const node = kind ? this.dropNode(event) : null;
    if (!node) { this.markDropTarget(null); return; }
    event.preventDefault();
    event.dataTransfer.dropEffect = kind === 'files' ? 'copy' : 'move';
    this.markDropTarget(node);
  };

  handleTreeDragLeave = (event) => {
    if (!this.contains(event.relatedTarget)) this.markDropTarget(null);
  };

  handleTreeDrop = (event) => {
    const kind = this.dropKind(event);
    const node = kind ? this.dropNode(event) : null;
    this.markDropTarget(null);
    if (!node) return;
    event.preventDefault();
    const parent = node.dataset.sfEntry;
    if (kind === 'files') {
      this.sfEmit('attach', {files: [...event.dataTransfer.files], parent});
      return;
    }
    let payload = {};
    try { payload = JSON.parse(event.dataTransfer.getData(RECORDS_TYPE) || '{}'); } catch { payload = {}; }
    const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
    if (!ids.length) return;
    this.sfEmit('move', {ids, parent, before: null, source: payload.source ?? null});
  };

  // ---- lifecycle ---------------------------------------------------------

  connectedCallback() {
    this.addEventListener('dragover', this.handleTreeDragOver);
    this.addEventListener('dragleave', this.handleTreeDragLeave);
    this.addEventListener('drop', this.handleTreeDrop);
    this.addEventListener('keydown', this.handleTreeKeydown);
    this.addEventListener('focusin', this.handleTreeFocusIn);
    this.addEventListener('click', this.handleTreeClick);
    this.observeItemChildren();
    this.captureInitialItems();
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.removeEventListener('dragover', this.handleTreeDragOver);
    this.removeEventListener('dragleave', this.handleTreeDragLeave);
    this.removeEventListener('drop', this.handleTreeDrop);
    this.markDropTarget(null);
    this.removeEventListener('keydown', this.handleTreeKeydown);
    this.removeEventListener('focusin', this.handleTreeFocusIn);
    this.removeEventListener('click', this.handleTreeClick);
    clearTimeout(this._typeaheadTimer);
    this._itemObserver?.disconnect();
    this._itemObserver = null;
    this.unwatchScroll();
    super.disconnectedCallback();
  }

  // ---- the window (§18.4) ------------------------------------------------

  // The nearest ancestor that scrolls, or the page.
  scroller() {
    for (let node = this.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
    }
    return window;
  }

  watchScroll() {
    if (this._scroller) return;
    this._scroller = this.scroller();
    this._onScroll = () => {
      if (this._frame) return;
      this._frame = requestAnimationFrame(() => {
        this._frame = 0;
        if (this.windowed() && !same(this.windowRange(), [this._window.first, this._window.last])) this.requestComponentUpdate('window');
      });
    };
    this._scroller.addEventListener('scroll', this._onScroll, {passive: true});
    window.addEventListener('resize', this._onScroll, {passive: true});
  }

  unwatchScroll() {
    if (!this._scroller) return;
    this._scroller.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onScroll);
    cancelAnimationFrame(this._frame);
    this._frame = 0;
    this._scroller = null;
  }

  windowed() {
    return this._rows.length > WINDOW_FROM;
  }

  // The rows in view of the scroller, plus the margin: [first, last].
  windowRange() {
    const count = this._rows.length;
    const height = this._rowHeight || ROW_GUESS;
    const list = this.querySelector(':scope > .sf-tree');
    if (!list || !this.isConnected) return [0, Math.min(count, 60) - 1];
    const top = list.getBoundingClientRect().top;
    let viewTop = 0;
    let viewBottom = window.innerHeight;
    if (this._scroller && this._scroller !== window) {
      const box = this._scroller.getBoundingClientRect();
      viewTop = Math.max(box.top, 0);
      viewBottom = Math.min(box.bottom, window.innerHeight);
    }
    let first = Math.floor((viewTop - top) / height) - WINDOW_MARGIN;
    let last = Math.ceil((viewBottom - top) / height) + WINDOW_MARGIN;
    first = Math.max(0, Math.min(first, count - 1));
    last = Math.max(first, Math.min(last, count - 1));
    // A row the keyboard asked for is drawn even outside the view: the window
    // moves to it, the same size.
    const want = this._want;
    if (want !== undefined && want >= 0 && (want < first || want > last)) {
      const size = last - first;
      first = Math.max(0, Math.min(want - WINDOW_MARGIN, count - 1 - size));
      last = Math.min(count - 1, first + size);
    }
    return [first, last];
  }

  measureRow() {
    const row = this.querySelector(':scope > .sf-tree > .sf-tree-item');
    const list = row?.parentElement;
    if (!row || !list) return;
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    const height = row.getBoundingClientRect().height + gap;
    if (height > 0) {
      this._rowHeight = height;
      this._gap = gap;
    }
  }

  // ---- focus: one Tab stop (roving tabindex) -----------------------------

  tabStopIndex() {
    const at = (id) => (id ? this._rows.findIndex((row) => row.id === id) : -1);
    const stop = at(this._tabStop);
    if (stop >= 0) return stop;
    const chosen = this._rows.findIndex((row) => this.isSelected(row.id) || row.entry.active);
    return chosen >= 0 ? chosen : this._rows.length ? 0 : -1;
  }

  // Focus moves without a smooth scroll: a page that scrolls smoothly would
  // carry the row out of the window halfway and the focus with it.
  focusRow(index) {
    const row = this._rows[index];
    if (!row) return;
    this._tabStop = row.id;
    const show = (element) => {
      element.scrollIntoView?.({block: 'nearest', behavior: 'instant'});
      element.focus({preventScroll: true});
    };
    const drawn = this.rowElement(row.id);
    if (drawn) {
      this.syncTabStop();
      show(drawn);
      return;
    }
    // Outside the window: scroll to where it will be, draw it, then focus it.
    const list = this.querySelector(':scope > .sf-tree');
    const scroller = this._scroller || this.scroller();
    if (list) {
      const offset = index * (this._rowHeight || ROW_GUESS);
      if (scroller === window) {
        window.scrollTo({top: window.scrollY + list.getBoundingClientRect().top + offset - window.innerHeight / 2, behavior: 'instant'});
      } else {
        const top = scroller.scrollTop + list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + offset - scroller.clientHeight / 2;
        scroller.scrollTo({top, behavior: 'instant'});
      }
    }
    this._want = index;
    this.requestComponentUpdate('focus');
    this.whenRendered?.(() => {
      this._want = undefined;
      const element = this.rowElement(row.id);
      if (element) show(element);
    }, {next: true});
  }

  // The drawn rows' tabindex, without a redraw: the tab stop, or the first
  // drawn row when the window holds the tab stop out.
  syncTabStop() {
    const rows = this.getRenderedItems();
    const stop = this._rows[this.tabStopIndex()]?.id;
    const target = rows.find((row) => row.dataset.sfEntry === stop) || rows[0];
    for (const row of rows) row.tabIndex = row === target ? 0 : -1;
  }

  rowIndexOf(event) {
    const node = event.target?.closest?.('.sf-tree-item[data-sf-entry]');
    if (!node || !this.contains(node)) return -1;
    return this._rows.findIndex((row) => row.id === node.dataset.sfEntry);
  }

  handleTreeFocusIn = (event) => {
    const at = this.rowIndexOf(event);
    if (at < 0) return;
    this._tabStop = this._rows[at].id;
    this.syncTabStop();
  };

  // A press selects, the way the space bar does; the chevron stops its own
  // press, so opening a branch is still not choosing it.
  handleTreeClick = (event) => {
    const at = this.rowIndexOf(event);
    if (at < 0) return;
    const row = this._rows[at];
    this._tabStop = row.id;
    this.syncTabStop();
    if (row.entry.disabled) return;
    if (this.selection === 'one' || this.selection === 'many') this.selectRow(row);
  };

  // A press on a name: the request open {id}. A link still follows itself.
  pressName(row, event) {
    if (row.entry.disabled) {
      event?.preventDefault();
      return;
    }
    this._pressEvent = event ?? null;
    this.sfEmit('open', {id: row.id, value: row.entry.value});
    this._pressEvent = null;
  }

  activateRow(row) {
    if (row.entry.disabled) return;
    const link = this.rowElement(row.id)?.querySelector(':scope > .sf-tree-item-container > a[href]');
    if (link) link.click();
    else this.pressName(row, null);
  }

  moveTypeahead(index, key) {
    clearTimeout(this._typeaheadTimer);
    this._typeahead += key.toLocaleLowerCase();
    this._typeaheadTimer = setTimeout(() => { this._typeahead = ''; }, 500);
    const count = this._rows.length;
    for (let step = 1; step <= count; step += 1) {
      const at = (index + step) % count;
      if (this._rows[at].entry.label.trim().toLocaleLowerCase().startsWith(this._typeahead)) {
        this.focusRow(at);
        return;
      }
    }
  }

  handleTreeKeydown = (event) => {
    const index = this.rowIndexOf(event);
    if (index < 0 || event.target.closest('.sf-tree-item[data-sf-entry]') !== event.target) return;
    const row = this._rows[index];
    const last = this._rows.length - 1;
    let target = -1;
    let handled = true;
    switch (event.key) {
      case 'ArrowDown': target = Math.min(index + 1, last); break;
      case 'ArrowUp': target = Math.max(index - 1, 0); break;
      case 'Home': target = 0; break;
      case 'End': target = last; break;
      case 'ArrowRight':
        if (row.branch && !row.open) this.setEntryOpen(row.id, true);
        else if (row.open) target = index + 1;
        break;
      case 'ArrowLeft':
        if (row.branch && row.open) this.setEntryOpen(row.id, false);
        else if (row.entry.parent !== null) target = this._rows.findIndex((one) => one.id === row.entry.parent);
        break;
      case 'Enter':
        if (row.branch) this.setEntryOpen(row.id, !row.open);
        else this.activateRow(row);
        break;
      case ' ':
        if (this.selection === 'none') this.activateRow(row);
        else if (!row.entry.disabled) this.selectRow(row);
        break;
      default:
        handled = false;
    }
    if (!handled && event.key.length === 1 && !event.altKey && !event.metaKey && !event.ctrlKey) {
      this.moveTypeahead(index, event.key);
      handled = true;
    }
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
    if (target >= 0) this.focusRow(target);
  };

  // ---- drawing -----------------------------------------------------------

  rowContext(row, tabStopId) {
    const entry = row.entry;
    const selected = this.isSelected(row.id);
    return {
      id: row.id,
      value: entry.value,
      label: entry.label,
      href: entry.href,
      target: entry.target,
      rel: entry.rel,
      kind: entry.kind,
      open: row.open,
      selected,
      active: entry.active,
      disabled: entry.disabled,
      icon: entry.icon,
      openIcon: entry.openIcon || 'folder_open',
      closedIcon: entry.closedIcon || 'folder',
      chevronOpenIcon: entry.chevronOpenIcon || 'keyboard_arrow_down',
      chevronClosedIcon: entry.chevronClosedIcon || 'chevron_right',
      openLabel: entry.openLabel || this._words.open,
      closeLabel: entry.closeLabel || this._words.close,
      hasChildren: row.branch,
      level: row.level,
      setsize: row.setsize,
      posinset: row.posinset,
      tabStop: row.id === tabStopId,
      selection: this.selection,
      onToggle: row.onToggle,
      onName: row.onName,
    };
  }

  // Handlers made once per id, so a redraw binds the same functions and Lit
  // leaves the rows' listeners alone.
  handlersFor(id) {
    if (!this._handlers) this._handlers = new Map();
    let handlers = this._handlers.get(id);
    if (!handlers) {
      handlers = {
        onToggle: (event) => {
          event.preventDefault();
          event.stopPropagation();
          const row = this._rows.find((one) => one.id === id);
          if (row && !row.entry.disabled) this.setEntryOpen(id, !row.open);
        },
        onName: (event) => {
          const row = this._rows.find((one) => one.id === id);
          if (row) this.pressName(row, event);
        },
      };
      this._handlers.set(id, handlers);
    }
    return handlers;
  }

  templateContext() {
    const rows = this.flatten();
    for (const id of [...(this._handlers?.keys() ?? [])]) if (!this._entries.has(id)) this._handlers.delete(id);
    this._words = {open: this.sfWord('open-label'), close: this.sfWord('close-label')};
    const tabStopId = rows[this.tabStopIndex()]?.id;
    let first = 0;
    let last = rows.length - 1;
    if (this.windowed()) {
      this.watchScroll();
      [first, last] = this.windowRange();
    }
    const changed = first !== this._window.first || last !== this._window.last;
    this._window = {first, last};
    if (changed && this.windowed()) queueMicrotask(() => this.sfEmit('window', {first, last}));
    const height = this._rowHeight || ROW_GUESS;
    const drawn = rows.slice(first, last + 1).map((row) => this.rowContext({...row, ...this.handlersFor(row.id)}, tabStopId));
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      rows: drawn,
      // The first drawn row stands in for the tab stop the window holds out.
      tabStopDrawn: drawn.some((row) => row.tabStop),
      // A spacer stands for the rows it replaces; the list's gap after it is
      // one of theirs.
      before: this.windowed() && first > 0 ? Math.max(0, first * height - (this._gap || 0)) : 0,
      after: this.windowed() && last < rows.length - 1 ? Math.max(0, (rows.length - 1 - last) * height - (this._gap || 0)) : 0,
      hasBranches: this._hasBranches,
      selection: this.selection,
      ariaLabel: this.getAttribute('aria-label') || '',
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
    });
  }

  template() {
    return renderTreeTemplate(this.templateContext());
  }

  // A row is measured after every drawing: the first one may be drawn before
  // the sheets arrive, taller than it will be. A height that changed places
  // the spacers again.
  afterRender(changedAttributes) {
    super.afterRender?.(changedAttributes);
    if (!this._rows.length) return;
    const before = this._rowHeight;
    this.measureRow();
    if (this.windowed() && Math.abs((this._rowHeight || 0) - (before || 0)) > 0.5) this.requestComponentUpdate('window');
  }
}

function same(a, b) {
  return a.length === b.length && a.every((one, index) => one === b[index]);
}

SfTree.define('sf-tree');

export {SfTree};
