// sf-settings: compact settings -- a few settings a person changes on the
// spot, a reader's theme and text size, a table's density, a chat's sound.
// The items are data, each holding its own value:
//
//   <sf-settings look="rows">
//     <sf-button-icon icon="tune" aria-label="Настройки"></sf-button-icon>
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
import {LOOKS, SIZES, entriesFor, findItem, itemValue, rewriteValues, valueMap, valuePatch} from './js/settings';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// The menu it draws, found under its current name and its former one.
const MENU = `:scope > .sf-settings-parts > ${tagSelector('sf-menu-context')}`;
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const same = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));

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
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClick);
    this.removeEventListener('click', this._onHostClick);
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
    const menu = this.menu;
    if (!menu) return {outcome: 'unavailable', reason: 'no-panel'};
    await customElements.whenDefined('sf-menu-context');
    if (this.popup && !menu.isOpen) {
      const anchor = this.anchor();
      if (!anchor) return {outcome: 'unavailable', reason: 'no-trigger'};
      const opened = await menu.openFor(anchor, {focus: 'none'});
      if (!opened) return {outcome: 'cancelled'};
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
    const menu = this.menu;
    const anchor = this.anchor(trigger);
    if (!menu || !anchor || !this.popup) return;
    customElements.whenDefined('sf-menu-context').then(() => menu.toggleFor(anchor));
  }

  onHostClick(event) {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
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
      component: this,
      look,
      size,
      popup,
      label: this.label,
      entries: this.entries(look, this.sfWord('tiles')),
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
  }
}

SfSettings.define('sf-settings');

export {SfSettings};
