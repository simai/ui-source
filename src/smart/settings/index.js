// sf-settings: compact settings -- a few settings a person changes on the
// spot, a reader's theme and text size, a table's density, a chat's sound.
// The items are data, each holding its own value:
//
//   <sf-settings look="rows">
//     (the page's trigger: an icon button, a link)
//     <script type="application/json" data-sf-settings>{"items": [...]}</script>
//   </sf-settings>
//
// It composes sf-menu-context and draws nothing of its own (owner decision
// 2026-11-06): the items become the menu's entries, laid out by one attribute,
// look -- drill (the value under the name, the options in the same panel),
// rows (the name at the start, the control at the end) or tiles (the switches
// used most as tiles on top, the rest as rows). With a trigger (the trigger
// slot, the children without a slot, or for="<id>") the panel opens over the
// page against it; without one it stands open in the page's flow.
//
// A person's change is asked first (change, cancellable, before the write);
// then the value is written into its item and changed says so. remember keeps
// the values as a preference of the person (SF.Preferences
// sf-settings/<name>) and puts them back when the element meets its items.
// The menu's own events stay inside.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8):
// settings, values, actions and events are made by core/js/element-manifest.js.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import BundledPreferences from '../../core/js/preferences.js';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {renderSettingsTemplate} from './js/templates/default';
import {densityOf} from '../../core/js/density.js';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {focusablesIn} from '../../core/js/layer-stack.js';
import {PanelScrollbar} from '../../component/panel-scrollbar.js';
import {
  APPLY, LOOKS, SIZES, applyCount, entriesFor, findItem, itemValue, matches, movedField, panelGroups, panelLayout,
  placedField, rewriteValues, sameValue, toggledField, valueMap, valuePatch,
} from './js/settings';
import manifest from './component.json';
// The panel look's sheet (C106); the menu looks draw nothing of their own.
import './scss/index.scss';
import en from './lang/en.json';
import ru from './lang/ru.json';

// The menu it draws, found under its current name and its former one.
const MENU = `:scope > .sf-settings-parts > ${tagSelector('sf-menu-context')}`;
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const same = sameValue;
// The anchored positioning Core published, or the bundle's own copy.
const position = () => globalThis.SF?.Position || BundledPosition;
// On a phone -- below the md breakpoint, where core declares
// --sf-breakpoint-md -- the panel is a sheet at the bottom of the screen
// (C106 (8), C32), as sf-menu-context's forms are.
const onPhone = () => !getComputedStyle(document.documentElement).getPropertyValue('--sf-breakpoint-md').trim();
// The panel's own parts (templates/panel.js).
const PANEL = ':scope > .sf-settings-parts > .sf-settings-panel';
const ROW = '.sf-settings-row-main';
const rowKey = (main) => main?.dataset.sfOption ?? main?.dataset.sfSetting ?? '';

// The values are a preference of the person (SF.Preferences, owner
// 2026-10-14): in the browser under sf-pref:sf-settings/<remember>, and by a
// host that keeps preferences for its user. The registry is the shared one
// when core has published it (every bundle has its own copy).
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;

/** The SF.Preferences key a remember name keeps the values under. */
export const rememberKey = (name) => (text(name) ? `sf-settings/${text(name)}` : '');

const SettingsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfSettings extends SettingsElement {
  constructor() {
    super();
    this._declared = null;
    this._declaredFor = null;
    this._restoredFor = null;
    this._entries = {items: null, look: '', label: '', list: []};
    this._onDocumentClick = (event) => this.onDocumentClick(event);
    this._onHostClick = (event) => this.onHostClick(event);
    // The panel look (C106): whether a popup panel is open, the search, the
    // chosen tab, the values a button-applied panel holds until «Применить»,
    // and each list's Tab stop by the list's key.
    this._open = null;
    this._query = '';
    this._tab = 0;
    this._draft = null;
    this._current = new Map();
    this._scrollbar = new PanelScrollbar();
    this._onPanelKeyDown = (event) => this.onPanelKeyDown(event);
    this._onPanelInput = (event) => this.onPanelInput(event);
    this._onPanelFocusIn = (event) => this.onPanelFocusIn(event);
    this._onPanelFocusOut = (event) => this.onPanelFocusOut(event);
    this._onPanelPointerDown = (event) => this.onPanelPointerDown(event);
  }

  // The trigger is the default slot (component.json): the children the page
  // wrote without a slot attribute, taken live like the named ones. The JSON
  // island is read and taken out before (element-manifest.js).
  onConnected() {
    super.onConnected?.();
    const live = this._liveSlotNodes;
    if (live && !live.has('trigger')) {
      const nodes = Array.from(this.children).filter((child) => !child.hasAttribute('slot') && !child.hasAttribute('data-sf-static')
        && child.localName !== 'script' && child.localName !== 'template');
      if (nodes.length) {
        nodes.forEach((node) => node.remove());
        live.set('trigger', nodes);
      }
    }
    document.addEventListener('click', this._onDocumentClick);
    this.addEventListener('click', this._onHostClick);
    this.addEventListener('keydown', this._onPanelKeyDown);
    this.addEventListener('input', this._onPanelInput);
    this.addEventListener('focusin', this._onPanelFocusIn);
    this.addEventListener('focusout', this._onPanelFocusOut);
    this.addEventListener('pointerdown', this._onPanelPointerDown);
  }

  disconnectedCallback() {
    this.closePanel({restoreFocus: false, reason: 'api'});
    this._scrollbar.disconnect();
    document.removeEventListener('click', this._onDocumentClick);
    this.removeEventListener('click', this._onHostClick);
    this.removeEventListener('keydown', this._onPanelKeyDown);
    this.removeEventListener('input', this._onPanelInput);
    this.removeEventListener('focusin', this._onPanelFocusIn);
    this.removeEventListener('focusout', this._onPanelFocusOut);
    this.removeEventListener('pointerdown', this._onPanelPointerDown);
    super.disconnectedCallback?.();
  }

  // ------------------------------------------------------------- the values

  // The declared values: the ones the items carried when the page gave them,
  // taken once per list the page gave. reset puts them back.
  declaredValues() {
    if (this._declaredFor !== this.items) {
      this._declared = valueMap(this.items);
      this._declaredFor = this.items;
    }
    return this._declared;
  }

  // The items after a write the element made itself: the declared snapshot
  // stays the page's, and a remembered element keeps the values.
  writeItems(list) {
    this.declaredValues();
    this._declaredFor = list;
    this._restoredFor = list;
    this.items = list;
    this.keep();
  }

  /** Every setting's value by its id: {theme: 'dark', sound: true, scale: 110}. */
  get values() {
    this.restore();
    return valueMap(this.items);
  }

  // A remembered element puts the person's values back into the items the
  // first time it meets them -- before its first drawing, so the panel never
  // shows one value and then another. Nothing is announced: the page reads
  // values, as after setAll.
  restore() {
    const key = rememberKey(this.remember);
    const items = this.items;
    if (!key || this._restoredFor === items || !Array.isArray(items) || !items.length) return;
    this.declaredValues();
    this._restoredFor = items;
    let kept = null;
    try {
      kept = preferences().read(key);
    } catch {
      kept = null;
    }
    if (!kept || typeof kept !== 'object' || Array.isArray(kept)) return;
    const {list, count} = rewriteValues(items, (item) => (Object.hasOwn(kept, item.id) ? valuePatch(item, kept[item.id]) : null));
    if (!count) return;
    this._declaredFor = list;
    this._restoredFor = list;
    this.items = list;
  }

  keep() {
    const key = rememberKey(this.remember);
    if (!key) return;
    try {
      preferences().write(key, valueMap(this.items));
    } catch {
      // A page without storage (private mode, blocked) still changes the value.
    }
  }

  // A person asks the menu for a value: the page is asked first, by this
  // element's change. Cancelled, the menu leaves the row as it was.
  onMenuChange(event) {
    event.stopPropagation();
    const {id, value, previous} = event.detail ?? {};
    const item = findItem(this.items, id);
    if (!item) return;
    const patch = valuePatch(item, value);
    const detail = {id, value, previous: previous ?? itemValue(item), item: {...item, ...(patch ?? {})}};
    if (!patch || !this.sfEmit('change', detail, {cancelable: true})) event.preventDefault();
  }

  // The menu wrote the value into its row: the element writes it into the
  // item, keeps it, and says so.
  onMenuChanged(event) {
    event.stopPropagation();
    const {id, value, previous} = event.detail ?? {};
    const item = findItem(this.items, id);
    if (!item) return;
    const patch = valuePatch(item, value);
    if (!patch) return;
    const {list} = rewriteValues(this.items, (one) => (one.id === id ? patch : null));
    this.writeItems(list);
    this.sfEmit('changed', {id, value, previous, item: {...item, ...patch}});
  }

  /**
   * Writes one setting's value into its item: the page's answer to a
   * cancelled change, or a value restored on load. Raises nothing.
   * setValue('theme', 'dark') or setValue({id, value}).
   */
  setValue(target, given) {
    const {id, value} = target && typeof target === 'object' ? target : {id: target, value: given};
    const item = findItem(this.items, id);
    if (!item) return {outcome: 'refused', reason: 'not-found'};
    const patch = valuePatch(item, value);
    if (!patch) return {outcome: 'refused', reason: 'invalid'};
    if (same(itemValue(item), patch.value)) return {outcome: 'applied'};
    this.writeItems(rewriteValues(this.items, (one) => (one.id === id ? patch : null)).list);
    return {outcome: 'applied'};
  }

  /**
   * Writes a map of values at once -- {id: value} -- into the items that
   * carry those ids: a panel restored from storage. Raises nothing.
   */
  setAll(given) {
    const values = given && typeof given === 'object' && given.values && typeof given.values === 'object' ? given.values : given;
    const map = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
    const {list, count} = rewriteValues(this.items, (item) => (Object.hasOwn(map, item.id) ? valuePatch(item, map[item.id]) : null));
    if (!count) return {outcome: 'refused', reason: 'not-found', count};
    this.writeItems(list);
    return {outcome: 'applied', count};
  }

  /**
   * The declared values back. reset is asked first (cancellable); not
   * cancelled, every setting that moved goes back and changed says so once
   * for each.
   */
  reset() {
    const declared = this.declaredValues();
    if (!this.sfEmit('reset', {}, {cancelable: true})) return {outcome: 'cancelled'};
    const facts = [];
    const {list, count} = rewriteValues(this.items, (item) => {
      if (!Object.hasOwn(declared, item.id)) return null;
      const previous = itemValue(item);
      const value = declared[item.id];
      if (same(previous, value)) return null;
      const patch = valuePatch(item, value);
      if (patch) facts.push({id: item.id, value, previous, item: {...item, ...patch}});
      return patch;
    });
    if (count) this.writeItems(list);
    for (const fact of facts) this.sfEmit('changed', fact);
    return {outcome: 'applied', count};
  }

  /**
   * Goes straight to one setting: a popup opens first; in the drill look the
   * panel opens the levels down to it; the focus goes to its row.
   */
  async show(given) {
    const id = given && typeof given === 'object' ? given.id : given;
    if (!findItem(this.items, id)) return {outcome: 'refused', reason: 'not-found'};
    await this.whenRendered?.();
    if (this.isPanel) return this.showInPanel(id);
    const menu = this.menu;
    if (!menu) return {outcome: 'unavailable', reason: 'no-panel'};
    await customElements.whenDefined('sf-menu-context');
    if (this.popup && !menu.isOpen) {
      const anchor = this.anchor();
      if (!anchor) return {outcome: 'unavailable', reason: 'no-trigger'};
      // An outcome since sf-menu-context 1.12.2; a boolean before.
      const opened = await menu.openFor(anchor, {focus: 'none'});
      if (opened !== true && opened?.outcome !== 'applied') return {outcome: 'cancelled'};
    }
    if (this.look === 'drill') {
      const result = menu.show(id);
      if (result?.outcome !== 'applied') return result;
      return {outcome: 'applied'};
    }
    await menu.whenRendered?.();
    const row = [...menu.querySelectorAll('[data-sf-entry]')].find((one) => menu.entryOf(one)?.id === id);
    const control = row?.matches('.sf-context-menu-value-row') ? row.querySelector(FOCUSABLE) : row;
    menu.syncMenuItems?.();
    control?.focus({preventScroll: false});
    return {outcome: 'applied'};
  }

  // ------------------------------------------------------------- the popup

  get menu() {
    return this.querySelector(MENU);
  }

  // The page's elements that open the panel: the slot's and those for names.
  triggers() {
    const own = [].concat(this._liveSlotNodes?.get('trigger') || []).filter((node) => node instanceof Element);
    const ids = text(this.for).split(/\s+/u).filter(Boolean);
    const named = ids.map((one) => document.getElementById(one)).filter(Boolean);
    return [...own, ...named];
  }

  /** Whether the panel opens over the page (it has a trigger) or stands inline. */
  get popup() {
    return Boolean(text(this.for)) || this.hasSlotContent('trigger');
  }

  // The control a trigger is: its native control when it is a Smart host.
  anchor(trigger = this.triggers()[0]) {
    if (!trigger) return null;
    return trigger.matches(FOCUSABLE) ? trigger : trigger.querySelector(FOCUSABLE) ?? trigger;
  }

  /** Opens or closes the panel of a popup against a trigger. */
  toggle(trigger) {
    const anchor = this.anchor(trigger);
    if (this.isPanel) {
      if (!anchor || !this.popup) return;
      if (this._open) this.closePanel({reason: 'close'});
      else this.openPanel(anchor);
      return;
    }
    const menu = this.menu;
    if (!menu || !anchor || !this.popup) return;
    customElements.whenDefined('sf-menu-context').then(() => menu.toggleFor(anchor));
  }

  onHostClick(event) {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && this.panel?.contains(target)) {
      this.onPanelClick(event, target);
      return;
    }
    const trigger = target && this.triggers().find((one) => one.contains(target));
    if (trigger) this.toggle(trigger);
  }

  onDocumentClick(event) {
    if (event.defaultPrevented || !text(this.for) || !(event.target instanceof Element)) return;
    if (this.contains(event.target)) return;
    const trigger = this.triggers().find((one) => one.contains(event.target) && !this.contains(one));
    if (trigger) this.toggle(trigger);
  }

  // The triggers say they open a menu (openFor says whether it is open).
  syncTriggers() {
    for (const trigger of this.triggers()) {
      const control = this.anchor(trigger);
      // A panel is a dialog (C106, DP-7); the other looks are menus.
      if (control && this.isPanel) control.setAttribute('aria-haspopup', 'dialog');
      if (control && !control.hasAttribute('aria-haspopup')) control.setAttribute('aria-haspopup', 'menu');
      if (control && !control.hasAttribute('aria-expanded')) control.setAttribute('aria-expanded', 'false');
    }
  }

  // ------------------------------------------------------------- drawing

  // The entries are made again only when the items, the look or the words
  // change, so the menu is not handed a new list (and a new declared
  // snapshot) on every drawing.
  entries(look, tilesLabel) {
    const cache = this._entries;
    if (cache.items !== this.items || cache.look !== look || cache.label !== tilesLabel) {
      this._entries = {items: this.items, look, label: tilesLabel, list: entriesFor(this.items, look, {tilesLabel})};
    }
    return this._entries.list;
  }

  templateContext() {
    this.restore();
    const look = LOOKS.includes(this.look) ? this.look : 'drill';
    const size = SIZES.includes(this.size) ? this.size : '1/2';
    const popup = this.popup;
    this.sfHostState('data-look', look);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      ...(look === 'panel' ? this.panelContext() : {}),
      component: this,
      look,
      size,
      popup,
      label: this.label,
      entries: look === 'panel' ? [] : this.entries(look, this.sfWord('tiles')),
      slot: (name) => this.getSlotContent(name),
      hasSlot: (name) => name === 'trigger' && this.hasSlotContent(name),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderSettingsTemplate(this.templateContext());
  }

  afterRender(changed) {
    super.afterRender?.(changed);
    this.syncTriggers();
    if (this.isPanel) this.afterPanelRender();
    else this._scrollbar.disconnect();
  }

  // ─────────────────────────────────────────── the panel look (C106)
  // A list's view settings in a panel of this element's own: groups as
  // sections in one scroll or as tabs, fields lists with a check, a handle, a
  // pin and a search, applied at once or by «Применить». It is not a mode of
  // the action menu (DP-7): a popup is a dialog with its own closing (×,
  // Escape, a press outside, Tab out), a panel in the page's flow a group.

  get isPanel() {
    return this.look === 'panel';
  }

  get panel() {
    return this.querySelector(PANEL);
  }

  /** How a panel applies: at once (instant) or by its «Применить» button. */
  get applyMode() {
    return APPLY.includes(this.apply) ? this.apply : 'instant';
  }

  // What the rows show: the values a button-applied panel holds until
  // «Применить», else the items.
  shownItems() {
    return this._draft ?? this.items;
  }

  panelContext() {
    const items = this.shownItems();
    const groups = panelGroups(items);
    const layout = panelLayout(items, {search: Boolean(this.search)});
    const tab = Math.min(this._tab, Math.max(0, groups.length - 1));
    const shown = layout === 'tabs' ? [groups[tab]].filter(Boolean) : groups;
    const query = this.search ? this._query : '';
    const rowsOf = (list) => list.flatMap((item) => (item.type === 'fields' || item.type === 'choice'
      ? (item.options ?? []).map((option) => [item.type === 'choice' ? item.text : '', option.text])
      : [[item.text, item.caption]]));
    const nothingFound = Boolean(query) && !shown.some((group) => rowsOf(group.items.filter((item) => item.type !== 'heading' && item.type !== 'separator'))
      .some((words) => matches(query, ...words)));
    return {
      groups, layout, tab, query, nothingFound,
      open: Boolean(this._open),
      search: Boolean(this.search),
      apply: this.applyMode,
      count: applyCount(items),
      current: this._current,
      words: {
        label: this.sfWord('label'), close: this.sfWord('close'), reset: this.sfWord('reset'), apply: this.sfWord('apply'),
        search: this.sfWord('search'), empty: this.sfWord('empty'), pin: this.sfWord('pin'), unpin: this.sfWord('unpin'),
        moveHint: this.sfWord('move-hint'),
      },
    };
  }

  // The scroll area's mark (the scroll-area inset rule, C105 addendum): the
  // body gives up its inline-end padding while its scrollbar takes room.
  afterPanelRender() {
    const body = this.panel?.querySelector('.sf-settings-panel-body') ?? null;
    this._scrollbar.watch(body, 'sf-settings-panel-body--scrollbar');
  }

  // A value a person gives in the panel. Applied at once, it is asked
  // (change, cancellable), written and reported (changed), as a menu row's;
  // applied by the button, it waits in the panel's draft.
  async commitValue(id, value) {
    if (this.applyMode === 'button') {
      const draft = this.shownItems();
      const item = findItem(draft, id);
      const patch = item && valuePatch(item, value);
      if (!patch) return false;
      this._draft = rewriteValues(draft, (one) => (one.id === id ? patch : null)).list;
      this.requestComponentUpdate('draft');
      await this.whenRendered?.();
      return true;
    }
    return this.writeAsked(id, value);
  }

  // change (cancellable), then the write and changed: one setting.
  writeAsked(id, value) {
    const item = findItem(this.items, id);
    const patch = item && valuePatch(item, value);
    if (!patch) return false;
    const next = {...item, ...patch};
    const previous = itemValue(item);
    const asked = itemValue(next);
    if (same(previous, asked)) return true;
    if (!this.sfEmit('change', {id, value: asked, previous, item: next}, {cancelable: true})) {
      this.requestComponentUpdate('refused');
      return false;
    }
    this.writeItems(rewriteValues(this.items, (one) => (one.id === id ? patch : null)).list);
    this.sfEmit('changed', {id, value: asked, previous, item: next});
    return true;
  }

  // «Применить»: every setting the draft moved is asked and written, as at
  // once; then the popup closes.
  applyDraft() {
    const draft = this._draft;
    this._draft = null;
    if (draft) {
      const wanted = valueMap(draft);
      const now = valueMap(this.items);
      for (const [id, value] of Object.entries(wanted)) if (!same(now[id], value)) this.writeAsked(id, value);
    }
    this.requestComponentUpdate('draft');
    if (this._open) this.closePanel({reason: 'api'});
  }

  // «Сбросить»: at once, the declared values back (reset, cancellable);
  // applied by the button, the draft takes them and waits for «Применить».
  resetPanel() {
    if (this.applyMode !== 'button') {
      this.reset();
      return;
    }
    const declared = this.declaredValues();
    this._draft = rewriteValues(this.shownItems(), (item) => (Object.hasOwn(declared, item.id) ? valuePatch(item, declared[item.id]) : null)).list;
    this.requestComponentUpdate('draft');
  }

  /** A tab of the panel chosen (the groups shown as tabs). */
  chooseGroup(index) {
    if (!Number.isInteger(index) || index === this._tab) return;
    this._tab = index;
    this.requestComponentUpdate('tab');
  }

  // A press in the panel: a row's control, a pin, the close button, the
  // footer's buttons.
  onPanelClick(event, target) {
    if (target.closest('[data-sf-close]')) {
      this.closePanel({reason: 'close'});
      return;
    }
    if (target.closest('[data-sf-reset]')) {
      this.resetPanel();
      return;
    }
    if (target.closest('[data-sf-apply]')) {
      this.applyDraft();
      return;
    }
    const pin = target.closest('.sf-settings-row-pin');
    if (pin) {
      this.togglePin(pin);
      return;
    }
    if (target.closest('.sf-settings-row-handle')) return;
    const main = target.closest('.sf-settings-row')?.querySelector(`:scope > ${ROW}`);
    if (main) {
      this.stand(main);
      this.activate(main);
    }
  }

  // What a row's control does: a switch turns, an option is chosen, a field
  // is checked or not.
  activate(main) {
    if (main.getAttribute('aria-disabled') === 'true') return;
    const id = main.dataset.sfSetting;
    const item = findItem(this.shownItems(), id);
    if (!item) return;
    if (item.type === 'switch') this.commitValue(id, !itemValue(item));
    else if (item.type === 'choice') this.commitValue(id, main.dataset.sfOption);
    else if (item.type === 'fields') {
      const value = toggledField(item, main.dataset.sfOption, 'checked');
      if (value) this.commitValue(id, value);
    }
  }

  async togglePin(pin) {
    const id = pin.dataset.sfSetting;
    const option = pin.dataset.sfOption;
    const item = findItem(this.shownItems(), id);
    const value = item && toggledField(item, option, 'pinned');
    if (!value) return;
    const focused = pin === document.activeElement;
    await this.commitValue(id, value);
    await this.whenRendered?.();
    if (focused) this.rowControl(id, option, '.sf-settings-row-pin')?.focus({preventScroll: true});
  }

  // A row's control or pin by its setting and option, after a drawing.
  rowControl(id, option, selector = ROW) {
    return [...(this.panel?.querySelectorAll(selector) ?? [])]
      .find((one) => one.dataset.sfSetting === id && (option === undefined || one.dataset.sfOption === option)) ?? null;
  }

  // The rows of a list a person can reach: shown and not disabled.
  listRows(list) {
    return [...(list?.querySelectorAll(`:scope > .sf-settings-row:not([hidden]) > ${ROW}`) ?? [])]
      .filter((main) => main.getAttribute('aria-disabled') !== 'true');
  }

  // A row becomes its list's Tab stop (DP-4): one stop per list, the one the
  // person stood on last.
  stand(main) {
    const list = main.closest('.sf-settings-list');
    if (!list) return;
    this._current.set(list.dataset.sfList, rowKey(main));
    for (const one of list.querySelectorAll(`:scope > .sf-settings-row > ${ROW}`)) one.tabIndex = one === main ? 0 : -1;
  }

  onPanelFocusIn(event) {
    const main = event.target?.closest?.(ROW);
    if (main && this.panel?.contains(main)) this.stand(main);
  }

  // Tab out of a popup closes it (a dialog that does not keep the focus); a
  // sheet keeps it (the layer's Tab below).
  onPanelFocusOut(event) {
    const panel = this.panel;
    if (!this._open || this._open.sheet || !panel?.contains(event.target)) return;
    const next = event.relatedTarget;
    if (!(next instanceof Node) || panel.contains(next) || this._open.anchor.contains(next)) return;
    this.closePanel({restoreFocus: false, reason: 'api'});
  }

  // The search: the rows are filtered as the field is typed in (no case, ё as
  // е); the scroll area's mark follows the rows left.
  onPanelInput(event) {
    const field = event.target;
    if (!field?.matches?.('[data-sf-search]') || !this.panel?.contains(field)) return;
    this._query = field.value;
    this.requestComponentUpdate('query');
    this.whenRendered?.().then(() => this._scrollbar.mark());
  }

  onPanelKeyDown(event) {
    const panel = this.panel;
    const target = event.target;
    if (!panel || !(target instanceof Element) || !panel.contains(target) || event.defaultPrevented) return;
    const rtl = getComputedStyle(panel).direction === 'rtl';
    const inward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const outward = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (target.matches('[data-sf-search]')) {
      if (event.key === 'ArrowDown') {
        const list = [...panel.querySelectorAll('.sf-settings-list:not([hidden])')][0];
        const main = list?.querySelector(`${ROW}[tabindex="0"]`) ?? this.listRows(list)[0];
        if (main) {
          event.preventDefault();
          main.focus();
        }
      }
      return;
    }
    const pin = target.closest('.sf-settings-row-pin');
    const main = pin ? pin.parentElement?.querySelector(`:scope > ${ROW}`) : target.closest(ROW);
    if (!main) return;
    const list = main.closest('.sf-settings-list');
    const rows = this.listRows(list);
    const at = rows.indexOf(main);
    if (pin) {
      if (event.key === outward) {
        event.preventDefault();
        main.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = rows[(at + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length];
        next?.parentElement?.querySelector(':scope > .sf-settings-row-pin')?.focus() ?? next?.focus();
      }
      return;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (main.querySelector('.sf-settings-row-handle')) {
        event.preventDefault();
        this.moveRow(main, event.key === 'ArrowUp' ? -1 : 1);
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next = null;
    if (event.key === 'ArrowDown') next = rows[(at + 1) % rows.length];
    else if (event.key === 'ArrowUp') next = rows[(at - 1 + rows.length) % rows.length];
    else if (event.key === 'Home') next = rows[0];
    else if (event.key === 'End') next = rows[rows.length - 1];
    if (next) {
      event.preventDefault();
      this.stand(next);
      next.focus();
      // A radio group chooses as it moves (APG radio group).
      if (next.getAttribute('role') === 'radio' && next !== main) this.activate(next);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.activate(main);
      return;
    }
    if (event.key === inward) {
      const own = main.parentElement?.querySelector(':scope > .sf-settings-row-pin');
      if (own) {
        event.preventDefault();
        own.focus();
      }
    }
  }

  // Alt+↑/↓ (C106 (6)): the row moves one place within its block (the pinned
  // or the rest), keeps the focus, and its place is said: «Срок: 3 из 8».
  async moveRow(main, step) {
    const id = main.dataset.sfSetting;
    const option = main.dataset.sfOption;
    const item = findItem(this.shownItems(), id);
    const value = item && movedField(item, option, step);
    if (!value) return;
    await this.commitValue(id, value);
    await this.whenRendered?.();
    this.afterMove(id, option);
  }

  afterMove(id, option) {
    const main = this.rowControl(id, option);
    if (!main) return;
    this.stand(main);
    if (document.activeElement !== main) main.focus({preventScroll: false});
    const item = findItem(this.shownItems(), id);
    const options = item ? itemValue(item) : [];
    const index = options.findIndex((one) => one.id === option) + 1;
    const label = main.querySelector('.sf-settings-row-label')?.textContent ?? '';
    this.announce(this.sfWord('position', {vars: {text: label, index, count: options.length}}));
  }

  // The panel's live region: emptied first, so the same words are said again.
  announce(words) {
    const live = this.panel?.querySelector('.sf-settings-panel-live');
    if (!live) return;
    live.textContent = '';
    requestAnimationFrame(() => {
      live.textContent = words;
    });
  }

  // A drag by the handle (C106 (6)): the row follows the pointer within its
  // block; its new place is written when the pointer is let go.
  onPanelPointerDown(event) {
    const handle = event.target?.closest?.('.sf-settings-row-handle');
    if (!handle || !this.panel?.contains(handle) || event.button > 0) return;
    const row = handle.closest('.sf-settings-row');
    const main = row?.querySelector(`:scope > ${ROW}`);
    const list = row?.parentElement;
    if (!main || !list) return;
    event.preventDefault();
    const id = main.dataset.sfSetting;
    const option = main.dataset.sfOption;
    row.classList.add('sf-settings-row--dragging');
    // The rows stay where the drawing put them (lit owns their order); a line
    // shows where the row will land.
    let before = undefined;
    const marks = () => list.querySelectorAll(':scope > .sf-settings-row--drop-before, :scope > .sf-settings-row--drop-after');
    const move = (moved) => {
      const rows = [...list.querySelectorAll(':scope > .sf-settings-row:not([hidden])')].filter((one) => one !== row);
      const over = rows.find((one) => {
        const box = one.getBoundingClientRect();
        return moved.clientY < box.top + box.height / 2;
      });
      before = over ? rowKey(over.querySelector(`:scope > ${ROW}`)) : null;
      for (const one of marks()) one.classList.remove('sf-settings-row--drop-before', 'sf-settings-row--drop-after');
      if (over) over.classList.add('sf-settings-row--drop-before');
      else rows[rows.length - 1]?.classList.add('sf-settings-row--drop-after');
    };
    const up = async () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      row.classList.remove('sf-settings-row--dragging');
      for (const one of marks()) one.classList.remove('sf-settings-row--drop-before', 'sf-settings-row--drop-after');
      const item = findItem(this.shownItems(), id);
      const value = before === undefined || !item ? null : placedField(item, option, before);
      if (!value) return;
      await this.commitValue(id, value);
      await this.whenRendered?.();
      this.afterMove(id, option);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // ─── the popup panel

  // Opens the panel against the control that opened it: anchored in the top
  // layer, a sheet at the bottom on a phone (C106 (8)); the focus goes to the
  // search, else the first list's stop, else the first control.
  async openPanel(anchor) {
    if (this._open || !anchor) return;
    this._open = {anchor, sheet: false, position: null, returnTo: document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : anchor};
    this.requestComponentUpdate('open');
    await this.whenRendered?.();
    const panel = this.panel;
    const owned = this._open;
    if (!panel || !owned) return;
    anchor.setAttribute('aria-expanded', 'true');
    // The density of the control that opened it (C22), where the panel draws.
    owned.density = panel.getAttribute('data-sf-density');
    panel.setAttribute('data-sf-density', densityOf(anchor) ?? 'normal');
    if (typeof panel.showPopover === 'function') {
      panel.setAttribute('popover', 'manual');
      if (!panel.matches(':popover-open')) panel.showPopover();
    }
    const place = (sheet) => {
      owned.position?.stop();
      owned.position = null;
      owned.sheet = sheet;
      panel.toggleAttribute('data-sf-sheet', sheet);
      if (!sheet) owned.position = position().anchor(anchor, panel, {side: 'block-end', align: 'start', flip: true, shift: true, fitHeight: true, topLayer: false});
    };
    place(onPhone());
    owned.onResize = () => {
      if (this._open === owned && onPhone() !== owned.sheet) place(onPhone());
    };
    window.addEventListener('resize', owned.onResize);
    holdOpenSurfaceMark(this, true, {
      root: () => this.panel,
      onEscape: () => {
        this.closePanel({reason: 'escape'});
        return true;
      },
      onOutsidePress: (event) => {
        const path = event.composedPath?.() ?? [];
        if (!path.includes(anchor)) this.closePanel({restoreFocus: false, reason: 'outside'});
      },
      // A sheet covers the page, so Tab goes round inside it.
      onTab: (event) => {
        if (!owned.sheet) return;
        const controls = focusablesIn(panel);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      },
    });
    this._scrollbar.mark();
    const field = panel.querySelector('[data-sf-search]');
    const stop = panel.querySelector(`.sf-settings-list:not([hidden]) ${ROW}[tabindex="0"]`);
    (field ?? stop ?? focusablesIn(panel)[0])?.focus({preventScroll: true});
  }

  // Closes a popup panel: what it held unapplied is dropped, the search is
  // cleared, the focus goes back to the trigger (not after a press outside).
  closePanel({restoreFocus = true} = {}) {
    const owned = this._open;
    if (!owned) return false;
    this._open = null;
    owned.position?.stop();
    window.removeEventListener('resize', owned.onResize);
    holdOpenSurfaceMark(this, false);
    const panel = this.panel;
    if (panel) {
      if (panel.matches?.(':popover-open')) panel.hidePopover();
      panel.removeAttribute('popover');
      panel.removeAttribute('data-sf-sheet');
      if (owned.density === null || owned.density === undefined) panel.removeAttribute('data-sf-density');
      else panel.setAttribute('data-sf-density', owned.density);
    }
    owned.anchor.setAttribute('aria-expanded', 'false');
    this._draft = null;
    this._query = '';
    this.requestComponentUpdate('open');
    if (restoreFocus) (owned.returnTo?.isConnected ? owned.returnTo : owned.anchor)?.focus?.({preventScroll: true});
    return true;
  }

  // show(id) in the panel: a popup opens, the tab that holds the setting is
  // chosen, the focus goes to its row.
  async showInPanel(id) {
    if (this.popup && !this._open) {
      const anchor = this.anchor();
      if (!anchor) return {outcome: 'unavailable', reason: 'no-trigger'};
      await this.openPanel(anchor);
    }
    const groups = panelGroups(this.shownItems());
    const at = groups.findIndex((group) => findItem(group.items, id));
    if (at >= 0 && panelLayout(this.shownItems(), {search: Boolean(this.search)}) === 'tabs') this.chooseGroup(at);
    await this.whenRendered?.();
    const control = this.rowControl(id) ?? this.panel?.querySelector(`[data-sf-setting="${CSS.escape(id)}"]`);
    if (!control) return {outcome: 'unavailable', reason: 'no-panel'};
    if (control.matches(ROW)) this.stand(control);
    control.focus({preventScroll: false});
    return {outcome: 'applied'};
  }
}

SfSettings.define('sf-settings');

export {SfSettings};
