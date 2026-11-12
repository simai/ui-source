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
import {instancePath, partId} from '../../core/js/instance-path.js';
import {fileKind, fileType} from '../../core/js/file-types/index.js';
import {createInlineSpinner} from '../../component/spinner/js/_spinner-draw';
import { renderTreeTemplate, renderStaticTreeTemplate } from './js/templates/default';
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

// An entry id as the local part of an element id: every character outside
// [A-Za-z0-9_-] written as _<hex>, so two ids never meet in one.
const idWord = (id) => String(id).replace(/[^A-Za-z0-9_-]/gu, (char) => `_${char.codePointAt(0).toString(16)}`);

// A branch: an entry with children, or one that says it has them before they
// are loaded (has-children). A file is never one.
const isBranch = (entry) => entry.kind !== 'file' && (entry.childIds.length > 0 || entry.hasChildren);
// A folder: a branch, or an entry the host calls one with nothing in it
// (C102: no children is a leaf unless kind="folder").
const isFolder = (entry) => isBranch(entry) || entry.kind === 'folder';
// The rows a lazy branch shows under itself (C102 item 6) are keyed by its id.
const PLACEHOLDER = '\u0000';

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
    // `kind` is one of the twelve words of core file-types (C102); `type` the
    // legacy name. No kind: the entry's place says it -- children make a
    // folder, none a leaf whose name may say its type.
    kind: fileKind(item.kind || item.type),
    open: Boolean(item.open),
    selected: Boolean(item.selected),
    active: Boolean(item.active),
    disabled: Boolean(item.disabled),
    // A branch whose children are not here yet (TR-5): it shows the chevron
    // and opens, and its toggle is the host's cue to load them.
    hasChildren: Boolean(pick(item, 'has-children', 'hasChildren')),
    // A name (C102), or false for none; empty or true: chosen by kind,
    // extension and place.
    icon: item.icon === false || item.icon === 'false' ? false : typeof item.icon === 'string' && item.icon !== 'true' ? item.icon : '',
    // A second text after the name, a highlighted line, the «…» line, a
    // hidden page, and a lazy branch whose children failed to load (C102).
    note: text(item.note),
    mark: Boolean(item.mark),
    more: Boolean(item.more),
    hidden: Boolean(item.hidden),
    error: Boolean(item.error),
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
    'expand-all'() { return this.setAllOpen(true); },
    'collapse-all'() { return this.setAllOpen(false); },
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
    // The drawn entries whose name the line cuts (TR-14): their rows carry a
    // tooltip with the whole name.
    this._cut = new Set();
    this._resize = null;
    // Lazy branches whose retry was pressed: they show «Загрузка…» again
    // until the host answers with a new items (C102 item 6).
    this._retrying = new Set();
    this._spinners = new Map();
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
    this._retrying.clear();
    for (const id of [...this._spinners.keys()]) if (!entries.has(id)) this._spinners.delete(id);
    const before = this.selectionIds();
    let next;
    if (said.length) next = this.multiple() ? said : [said.at(-1)];
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
      const branch = isBranch(entry);
      const open = branch && this._open.get(id) === true;
      rows.push({id, entry, level, setsize: ids.length, posinset: index + 1, branch, open});
      if (open) visit(entry.childIds, level + 1);
      // An open lazy branch with nothing loaded yet: a «Загрузка…» row, or the
      // error row with its retry when the host said the load failed.
      if (open && !entry.childIds.length && entry.hasChildren) {
        const placeholder = entry.error && !this._retrying.has(id) ? 'error' : 'loading';
        rows.push({id: `${id}${PLACEHOLDER}${placeholder}`, placeholder, entry: {id: `${id}${PLACEHOLDER}`, parent: id, childIds: [], label: '', value: entry.value, disabled: placeholder === 'loading', placeholder}, level: level + 1, setsize: 1, posinset: 1, branch: false, open: false});
      }
    });
    visit(this._roots || [], 1);
    this._rows = rows;
    this._hasBranches = rows.some((row) => row.branch) || [...this._entries.values()].some(isBranch);
    return rows;
  }

  // ---- selection (§18.2) -------------------------------------------------

  // many and check keep a list of ids; one keeps one.
  multiple() {
    return this.selection === 'many' || this.selection === 'check';
  }

  selectionIds() {
    if (this.multiple()) return Array.isArray(this.selectedIds) ? this.selectedIds.map(text) : [];
    const one = text(this.selected);
    return one ? [one] : [];
  }

  // The selection as a set, kept while the value it is read from is the same
  // array (or id): a row asks whether it is selected on every drawing, and a
  // tree of 10 000 entries all checked scanned a 10 000-id list per row and
  // per entry -- 73 ms a change (simai/ui-source#43, tests/browser/tree-scale).
  selectionSet() {
    const source = this.multiple() ? this.selectedIds : text(this.selected);
    if (this._selectionSource !== source || !this._selectionSet) {
      this._selectionSource = source;
      this._selectionSet = new Set(this.selectionIds());
    }
    return this._selectionSet;
  }

  writeSelection(ids, {quiet = true} = {}) {
    const wanted = new Set(ids);
    const ordered = [...this._entries.keys()].filter((id) => wanted.has(id));
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
    return this.selection !== 'none' && this.selectionSet().has(id);
  }

  // ---- checks (selection="check", C102 item 7) ---------------------------

  // Every entry's check: 'true', 'false' or 'mixed'. A branch is what its
  // children are -- all checked, none, or some (mixed); a branch in the list
  // whose children are not in it checks them (children that arrived after it
  // was checked, or a list that names only the parent).
  checkStates() {
    const set = this.selectionSet();
    const states = new Map();
    const visit = (id, inherited) => {
      const entry = this._entries.get(id);
      const own = inherited || set.has(id);
      if (!entry.childIds.length) {
        states.set(id, own ? 'true' : 'false');
        return;
      }
      for (const child of entry.childIds) visit(child, own);
      states.set(id, branchCheck(entry.childIds.map((child) => states.get(child))));
    };
    for (const id of this._roots || []) visit(id, false);
    return states;
  }

  // A press or Space on a row: it and everything under it take the opposite
  // of its check, and every branch above it is what its children now are.
  checkRow(row) {
    const states = this.checkStates();
    const on = states.get(row.id) !== 'true';
    const mark = (id) => {
      states.set(id, on ? 'true' : 'false');
      for (const child of this._entries.get(id).childIds) mark(child);
    };
    mark(row.id);
    for (let parent = row.entry.parent; parent !== null && parent !== undefined; parent = this._entries.get(parent)?.parent) {
      const entry = this._entries.get(parent);
      if (!entry) break;
      states.set(parent, branchCheck(entry.childIds.map((child) => states.get(child))));
    }
    const ordered = this.writeSelection([...states].filter(([, state]) => state === 'true').map(([id]) => id), {quiet: false});
    this.sfEmit('select', {ids: ordered, id: row.id, selected: on});
  }

  selectRow(row) {
    const mode = this.selection;
    if (row.placeholder) return;
    if (mode === 'check') {
      this.checkRow(row);
      return;
    }
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
    if (!isBranch(entry)) return {outcome: 'refused', reason: 'leaf'};
    if (entry.disabled) return {outcome: 'refused', reason: 'disabled'};
    if (this._open.get(entry.id) === Boolean(open)) return {outcome: 'applied'};
    this._open.set(entry.id, Boolean(open));
    this._rowsDirty = true;
    this.requestComponentUpdate('open');
    this.sfEmit('toggle', {id: entry.id, open: Boolean(open), value: entry.value});
    return {outcome: 'applied'};
  }

  // The actions expand-all and collapse-all, and * on a row (its siblings):
  // every branch named that is not disabled; a toggle for each that changed.
  setAllOpen(open, ids = null) {
    const changed = [];
    for (const entry of ids ? ids.map((id) => this._entries.get(id)).filter(Boolean) : this._entries.values()) {
      if (!isBranch(entry) || entry.disabled || this._open.get(entry.id) === Boolean(open)) continue;
      this._open.set(entry.id, Boolean(open));
      changed.push(entry);
    }
    if (!changed.length) return {outcome: 'applied'};
    this._rowsDirty = true;
    this.requestComponentUpdate('open');
    for (const entry of changed) this.sfEmit('toggle', {id: entry.id, open: Boolean(open), value: entry.value});
    return {outcome: 'applied'};
  }

  // The error row's retry (C102 item 6): the branch shows «Загрузка…» again
  // and the host is asked to load it once more, retry {id, value}.
  retryEntry(id) {
    const entry = this._entries.get(text(id));
    if (!entry || !entry.error || this._retrying.has(entry.id)) return;
    this._retrying.add(entry.id);
    this._rowsDirty = true;
    this.requestComponentUpdate('retry');
    this.sfEmit('retry', {id: entry.id, value: entry.value});
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
  // records travel as application/x-sf-records+json, which sf-view-table writes.
  dropKind(event) {
    if (this.static) return null;
    if (this._dragId !== undefined && this.reorder) return 'entry';
    const types = [...(event.dataTransfer?.types ?? [])];
    if (this.acceptRecords && types.includes(RECORDS_TYPE)) return 'records';
    if (this.acceptFiles && types.includes('Files')) return 'files';
    return null;
  }

  dropNode(event) {
    const node = event.target?.closest?.('.sf-tree-item[data-sf-entry]');
    return node && this.contains(node) && node.getAttribute('aria-disabled') !== 'true' ? node : null;
  }

  markDropTarget(node, position = '') {
    if (this._dropTarget === node && this._dropPosition === position) return;
    this._dropTarget?.removeAttribute('data-sf-drop-target');
    this._dropTarget?.removeAttribute('data-sf-drop-position');
    this._dropTarget = node;
    this._dropPosition = position;
    if (node && position) node.setAttribute('data-sf-drop-position', position);
    if (node && (!position || position === 'inside')) node.setAttribute('data-sf-drop-target', '');
  }

  // ---- reorder inside the tree (C102 §7 item 11) -------------------------

  // Where a dragged entry lands on a row: the upper quarter puts it before
  // the row, the lower quarter after it, the middle into it -- only an entry
  // that can hold others (a folder, a page; not a file). Never into itself or
  // anything under it.
  dropPlace(event, node) {
    const dragged = this._entries.get(this._dragId);
    const target = this._entries.get(node.dataset.sfEntry);
    if (!dragged || !target) return null;
    for (let id = target.id; id !== null && id !== undefined; id = this._entries.get(id)?.parent) {
      if (id === dragged.id) return null;
    }
    const box = node.querySelector(':scope > .sf-tree-item-container')?.getBoundingClientRect() ?? node.getBoundingClientRect();
    const at = (event.clientY - box.top) / (box.height || 1);
    const holds = isFolder(target) || target.kind === 'page' || (!target.kind && this.typeOf(target, false, false).kind === 'file');
    let position = at < 0.25 ? 'before' : at > 0.75 ? 'after' : holds ? 'inside' : at < 0.5 ? 'before' : 'after';
    if (position === 'inside') return {position, parent: target.id, before: null};
    const siblings = target.parent === null ? this._roots : this._entries.get(target.parent).childIds;
    let before = target.id;
    if (position === 'after') {
      const rest = siblings.slice(siblings.indexOf(target.id) + 1).filter((id) => id !== dragged.id);
      before = rest[0] ?? null;
    }
    if (before === dragged.id) return null;
    return {position, parent: target.parent, before};
  }

  handleTreeDragStart = (event) => {
    const node = event.target?.closest?.('.sf-tree-item[data-sf-entry][draggable="true"]');
    if (!this.reorder || !node || !this.contains(node)) return;
    const entry = this._entries.get(node.dataset.sfEntry);
    if (!entry || entry.disabled) return;
    this._dragId = entry.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.label);
  };

  handleTreeDragEnd = () => {
    this._dragId = undefined;
    this.markDropTarget(null);
  };

  handleTreeDragOver = (event) => {
    const kind = this.dropKind(event);
    const node = kind ? this.dropNode(event) : null;
    if (!node) { this.markDropTarget(null); return; }
    if (kind === 'entry') {
      const place = this.dropPlace(event, node);
      if (!place) { this.markDropTarget(null); return; }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      this.markDropTarget(node, place.position);
      return;
    }
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
    if (kind === 'entry') {
      const place = node ? this.dropPlace(event, node) : null;
      const id = this._dragId;
      this.markDropTarget(null);
      this._dragId = undefined;
      if (!place) return;
      event.preventDefault();
      // The tree moves nothing itself: the host moves the entry and gives a
      // new items. parent null is the tree's top level; before null, the end.
      this.sfEmit('move', {ids: [id], parent: place.parent, before: place.before, source: null});
      return;
    }
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
    // A printed JSON island first (standard 1.3.8 §5.4): what is read below may be in it.
    this.sfReadIsland();
    this.addEventListener('dragover', this.handleTreeDragOver);
    this.addEventListener('dragleave', this.handleTreeDragLeave);
    this.addEventListener('drop', this.handleTreeDrop);
    this.addEventListener('dragstart', this.handleTreeDragStart);
    this.addEventListener('dragend', this.handleTreeDragEnd);
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
    this.removeEventListener('dragstart', this.handleTreeDragStart);
    this.removeEventListener('dragend', this.handleTreeDragEnd);
    this.markDropTarget(null);
    this.removeEventListener('keydown', this.handleTreeKeydown);
    this.removeEventListener('focusin', this.handleTreeFocusIn);
    this.removeEventListener('click', this.handleTreeClick);
    clearTimeout(this._typeaheadTimer);
    this._itemObserver?.disconnect();
    this._itemObserver = null;
    this.unwatchScroll();
    this._resize?.disconnect();
    this._resize = null;
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
    return !this.static && this._rows.length > WINDOW_FROM;
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
    const chosen = this._rows.findIndex((row) => !row.placeholder && (this.isSelected(row.id) || row.entry.active));
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
    if (row.placeholder === 'error') {
      this.retryEntry(row.entry.parent);
      return;
    }
    if (row.entry.disabled || row.placeholder) return;
    if (this.selection === 'one' || this.selection === 'many' || this.selection === 'check') this.selectRow(row);
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
    if (row.placeholder === 'error') {
      this.retryEntry(row.entry.parent);
      return;
    }
    if (row.entry.disabled || row.placeholder) return;
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
      if (!this._rows[at].placeholder && this._rows[at].entry.label.trim().toLocaleLowerCase().startsWith(this._typeahead)) {
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
        else if (row.open && row.entry.childIds.length) target = index + 1;
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
        if (this.selection === 'none' || row.placeholder) this.activateRow(row);
        else if (!row.entry.disabled) this.selectRow(row);
        break;
      case '*': {
        // APG: every sibling branch of the row opens.
        const siblings = row.entry.parent === null || row.entry.parent === undefined ? this._roots : this._entries.get(row.entry.parent)?.childIds ?? [];
        this.setAllOpen(true, siblings);
        break;
      }
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

  // The kind and icon an entry is shown with (core file-types, C102): icon,
  // kind, the name's extension (file-types="name"), its place. The tree's
  // icons setting keeps them on every row, on folders only, or on none. An
  // entry's own open-icon / closed-icon still name its glyph (a section icon
  // a host passed that way before icon took a name).
  typeOf(entry, branch, open) {
    const folder = branch || entry.kind === 'folder';
    const custom = folder ? (open ? entry.openIcon : entry.closedIcon) : entry.closedIcon || entry.openIcon;
    return fileType({
      icon: entry.icon === false ? false : entry.icon || custom || '',
      kind: entry.kind,
      name: entry.label,
      folder,
      open,
      byName: this.fileTypes !== 'none',
    });
  }

  iconOf(entry, branch, open) {
    const mode = this.icons;
    if (mode === 'none') return '';
    if (mode === 'branches' && !(branch || entry.kind === 'folder')) return '';
    return this.typeOf(entry, branch, open).icon;
  }

  // The spinner of a lazy branch's «Загрузка…» row: one element per branch,
  // so a redraw does not start it again.
  spinnerFor(id) {
    let spinner = this._spinners.get(id);
    if (!spinner) {
      spinner = createInlineSpinner({className: 'sf-tree-item-spinner-ring'});
      this._spinners.set(id, spinner);
    }
    return spinner;
  }

  rowContext(row, tabStopId) {
    const entry = row.entry;
    if (row.placeholder) {
      return {
        id: row.id,
        placeholder: row.placeholder,
        label: row.placeholder === 'error' ? this._words.error : this._words.loading,
        retryLabel: this._words.retry,
        spinner: row.placeholder === 'loading' ? this.spinnerFor(entry.parent) : null,
        onRetry: row.onRetry,
        level: row.level,
        tabStop: row.id === tabStopId,
      };
    }
    const check = this.selection === 'check';
    const selected = !check && this.isSelected(row.id);
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
      nodeIcon: this.iconOf(entry, row.branch, row.open),
      folder: row.branch || entry.kind === 'folder',
      note: entry.note,
      mark: entry.mark,
      more: entry.more,
      pageHidden: entry.hidden,
      hiddenWord: this._words.hidden,
      check: check ? this._checks?.get(row.id) ?? 'false' : '',
      draggable: Boolean(this.reorder) && !entry.disabled,
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
      tipId: this._cut.has(row.id) ? partId(this._tipPath, `tip-${idWord(row.id)}`) : '',
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
        onRetry: (event) => {
          event.preventDefault();
          event.stopPropagation();
          const row = this._rows.find((one) => one.id === id);
          if (row?.placeholder === 'error') this.retryEntry(row.entry.parent);
        },
      };
      this._handlers.set(id, handlers);
    }
    return handlers;
  }

  // The static tree (C102 item 5): the entries as a nested list, all of
  // them, nothing to press.
  staticContext() {
    const node = (id) => {
      const entry = this._entries.get(id);
      const branch = entry.childIds.length > 0;
      return {
        entry,
        nodeIcon: this.iconOf(entry, isBranch(entry), branch),
        folder: isFolder(entry),
        hiddenWord: this._words.hidden,
        children: entry.childIds.map(node),
      };
    };
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      nodes: (this._roots || []).map(node),
      ariaLabel: this.getAttribute('aria-label') || '',
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
    });
  }

  templateContext() {
    this._words = {
      open: this.sfWord('open-label'),
      close: this.sfWord('close-label'),
      loading: this.sfWord('loading'),
      error: this.sfWord('load-error'),
      retry: this.sfWord('retry'),
      hidden: this.sfWord('hidden'),
    };
    if (this.static) {
      this._rows = [];
      this._rowsDirty = true;
      return this.staticContext();
    }
    const rows = this.flatten();
    for (const id of [...(this._handlers?.keys() ?? [])]) if (!this._entries.has(id.split(PLACEHOLDER)[0])) this._handlers.delete(id);
    this._checks = this.selection === 'check' ? this.checkStates() : null;
    // The tooltips' ids start with the tree's path (§7.1.1), read once a drawing.
    this._tipPath = this._cut.size ? instancePath(this, {kind: 'sf-tree'}) : '';
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
    const context = this.templateContext();
    return this.static ? renderStaticTreeTemplate(context) : renderTreeTemplate(context);
  }

  // A row is measured after every drawing: the first one may be drawn before
  // the sheets arrive, taller than it will be. A height that changed places
  // the spacers again.
  afterRender(changedAttributes) {
    super.afterRender?.(changedAttributes);
    this.watchWidth();
    if (!this._rows.length) return;
    const before = this._rowHeight;
    this.measureRow();
    const cut = this.measureCut();
    if (cut || (this.windowed() && Math.abs((this._rowHeight || 0) - (before || 0)) > 0.5)) this.requestComponentUpdate(cut ? 'cut' : 'window');
  }

  // ---- long names (TR-14) ------------------------------------------------

  // A name is one line, cut with an ellipsis (the tree sheet); a drawn row
  // whose name does not fit gets the whole name as its tooltip and its
  // aria-label. Whether it fits is read from the drawn name: the column, the
  // font and the indent decide it, not the length of the text. True when the
  // set of cut rows changed and the rows are to be drawn again.
  measureCut() {
    let changed = false;
    for (const node of this.getRenderedItems()) {
      const name = node.querySelector(':scope > .sf-tree-item-container > .sf-tree-item-name');
      if (!name) continue;
      const id = node.dataset.sfEntry;
      const cut = name.scrollWidth - name.clientWidth > 0.5;
      if (cut === this._cut.has(id)) continue;
      if (cut) this._cut.add(id);
      else this._cut.delete(id);
      changed = true;
    }
    for (const id of [...this._cut]) if (!this._entries.has(id)) this._cut.delete(id);
    return changed;
  }

  // A column that narrows or widens cuts other names, and so does the sheet
  // that arrives after the first drawing (the names wrapped until then, and
  // nothing was cut): the tree's box changes either way, and is measured again.
  watchWidth() {
    const list = this.querySelector(':scope > .sf-tree');
    if (this._resize || !list || typeof ResizeObserver === 'undefined') return;
    this._resize = new ResizeObserver(() => {
      if (this.measureCut()) this.requestComponentUpdate('cut');
    });
    this._resize.observe(list);
  }
}

function same(a, b) {
  return a.length === b.length && a.every((one, index) => one === b[index]);
}

// A branch's check from its children's: all checked, none, or some.
function branchCheck(states) {
  if (states.every((state) => state === 'true')) return 'true';
  return states.some((state) => state !== 'false') ? 'mixed' : 'false';
}

SfTree.define('sf-tree');

export {SfTree};
