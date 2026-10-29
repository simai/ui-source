// sf-settings-menu: compact settings -- a reader's theme and text size, a
// table's view options, a chat's settings -- as one menu a page fills with
// data, instead of a popover of buttons and switches made again on each page.
//
// A special case of the context menu. The settings are data (items); the
// component draws them, keeps the values and reports every change, and the
// page decides what a value means. Two arrangements of the same parts are
// its templates (standard simai.smart-component 1.3.13 §6): drill, the
// default, where a choice opens its list in place, and rows, where the
// control stands at the end of the row. Tiles on top are optional.
//
// The popup form is the platform popover in the top layer, positioned against
// its trigger by core/js/position.js as sf-context-menu is, and a surface of
// the shared layer stack (§19, core/js/layer-stack.js through
// core/js/open-surface-mark.js): only the top layer takes Escape and an outside
// press. The inline form is always open, for a panel or a sidebar.
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, open, close, toggle and reset are the actions
// and answer outcomes, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {carryLayerOrigin, hasLayerAbove, updateLayer} from '../../core/js/layer-stack';
import {renderSettingsMenuTemplate} from './js/templates/default';
import {renderSettingsMenuRowsTemplate} from './js/templates/rows';
import {STOP} from './js/templates/parts';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const TEMPLATES = {default: renderSettingsMenuTemplate, rows: renderSettingsMenuRowsTemplate};
const TYPES = new Set(['boolean', 'choice', 'range', 'action', 'section', 'divider']);
// Two short words: a pill holds a word of eight characters at most.
const SHORT_WORD = 8;
const PLACEMENT = {
  'bottom-end': {side: 'block-end', align: 'end'},
  'bottom-start': {side: 'block-end', align: 'start'},
  'top-end': {side: 'block-start', align: 'end'},
  'top-start': {side: 'block-start', align: 'start'},
  'inline-end': {side: 'inline-end', align: 'start'},
  'inline-start': {side: 'inline-start', align: 'start'},
};
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';
let sequence = 0;

// Prefer the helper Core published; a bundle loaded without core.js still
// positions with its own copy.
const position = () => globalThis.SF?.Position || BundledPosition;
const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});
const has = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);

const SettingsMenuElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    open() { return this.runOpen(); },
    close({reason} = {}) { return this.runClose({reason: reason || 'api'}); },
    toggle() { return this._open ? this.runClose({reason: 'close'}) : this.runOpen(); },
    reset() { return this.runReset(); },
  },
});

class SfSettingsMenu extends SettingsMenuElement {
  constructor() {
    super();
    this._id = `sf-settings-menu-${++sequence}`;
    this._open = false;
    this._level = null;
    this._current = null;
    this._afterRender = null;
    this.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.addEventListener('click', (event) => this.onHostClick(event));
    this.addEventListener('focusin', (event) => {
      const stop = event.target?.closest?.(`.${STOP}`);
      if (stop && this.panel()?.contains(stop)) {
        this._current = stop;
        this.syncStops();
      }
    });
    this._onOutsidePress = (event) => {
      const path = event.composedPath?.() ?? [];
      if (path.includes(this) || path.includes(this.trigger())) return;
      // A press inside a layer opened above the menu -- its compact select's
      // list, a dialog -- is that layer's (§19.3).
      if (hasLayerAbove(this, ['surface', 'modal', 'panel'])) return;
      this.runClose({reason: 'outside', restoreFocus: false});
    };
    // A control elsewhere in the page named by `for` opens the panel.
    this._onDocumentClick = (event) => {
      if (this.inline || !this.for || event.defaultPrevented) return;
      const target = event.target?.closest?.(`#${globalThis.CSS?.escape ? CSS.escape(this.for) : this.for}`);
      if (!target || this.contains(target)) return;
      event.preventDefault();
      if (this._open) this.runClose({reason: 'close'});
      else this.runOpen();
    };
  }

  onConnected() {
    super.onConnected?.();
    document.addEventListener('click', this._onDocumentClick, {signal: this.sfScope});
    this.syncTrigger();
  }

  disconnectedCallback() {
    // Taken out of the page, it closes without asking: nothing is left to keep.
    if (this._open) this.finishClose({emit: false, restoreFocus: false});
    this.closeSelect();
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (oldValue === newValue || !this._isMounted) return;
    if (name === 'inline' && this.inline && this._open) this.finishClose({reason: 'api', restoreFocus: false});
    if (name === 'for' || name === 'inline') this.syncTrigger();
  }

  // ─── templates ──────────────────────────────────────────────────────────
  hasBuiltInTemplate(templateName = this.componentTemplateName) {
    return has(TEMPLATES, templateName);
  }

  template() {
    return (TEMPLATES[this.componentTemplateName] || TEMPLATES.default)(this.templateContext());
  }

  // ─── data ───────────────────────────────────────────────────────────────
  // One item as the templates read it: typed, its options as strings, its
  // value's label, and the control a choice is drawn with in this template.
  normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const options = Array.isArray(raw.options)
      ? raw.options.filter((option) => option && option.value !== undefined && option.value !== null)
        .map((option) => ({value: String(option.value), label: String(option.label ?? option.value), icon: option.icon ? String(option.icon) : ''}))
      : [];
    const type = TYPES.has(raw.type) ? raw.type
      : raw.type ? ''
        : options.length ? 'choice' : typeof raw.value === 'boolean' ? 'boolean' : typeof raw.value === 'number' ? 'range' : 'action';
    if (!type) return null;
    if (type === 'section' || type === 'divider') return {type, key: raw.key ? String(raw.key) : '', label: String(raw.label ?? '')};
    if (raw.key === undefined || raw.key === null || raw.key === '') return null;
    const item = {
      type,
      key: String(raw.key),
      label: String(raw.label ?? raw.key),
      caption: raw.caption ? String(raw.caption) : '',
      icon: raw.icon ? String(raw.icon) : '',
      options,
      disabled: raw.disabled === true,
      tile: raw.tile === true && (type === 'boolean' || type === 'choice'),
      control: '',
      hasDefault: has(raw, 'default'),
    };
    if (type === 'boolean') {
      item.value = raw.value === true || raw.value === 'true';
      item.default = raw.default === true || raw.default === 'true';
      item.valueLabel = this.sfWord(item.value ? 'on' : 'off');
      item.on = item.value;
    } else if (type === 'choice') {
      if (!options.length) return null;
      const value = raw.value === undefined || raw.value === null ? options[0].value : String(raw.value);
      const chosen = options.find((option) => option.value === value);
      item.value = value;
      item.default = item.hasDefault ? String(raw.default) : options[0].value;
      item.valueLabel = chosen ? chosen.label : value;
      item.valueIcon = chosen?.icon || '';
      item.on = value !== item.default;
      item.control = this.controlFor(raw.control, options);
    } else if (type === 'range') {
      item.min = Number.isFinite(Number(raw.min)) ? Number(raw.min) : 0;
      item.max = Number.isFinite(Number(raw.max)) ? Number(raw.max) : 100;
      item.step = Number.isFinite(Number(raw.step)) && Number(raw.step) > 0 ? Number(raw.step) : 1;
      const value = Number(raw.value);
      item.value = Math.min(item.max, Math.max(item.min, Number.isFinite(value) ? value : item.min));
      item.default = item.hasDefault ? Number(raw.default) : item.value;
      item.unit = raw.unit ? String(raw.unit) : '';
      item.valueLabel = `${item.value}${item.unit}`;
    }
    return item;
  }

  // How a choice is drawn (component.json x-decisions): drill opens it in
  // place; rows draws pills for up to three icons or two short words, else a
  // compact select. A page may name the form.
  controlFor(asked, options) {
    const rows = this.componentTemplateName === 'rows';
    if (asked === 'pills' || asked === 'drill') return asked;
    if (asked === 'select') return rows ? 'select' : 'drill';
    if (!rows) return 'drill';
    const icons = options.length <= 3 && options.every((option) => option.icon);
    const words = options.length <= 2 && options.every((option) => [...option.label].length <= SHORT_WORD);
    return icons || words ? 'pills' : 'select';
  }

  allItems() {
    return (Array.isArray(this.items) ? this.items : []).map((raw) => this.normalize(raw)).filter(Boolean);
  }

  item(key) {
    return this.allItems().find((item) => item.key === key && item.type !== 'section' && item.type !== 'divider') ?? null;
  }

  // §4: every item's value by its key.
  get values() {
    return Object.fromEntries(this.allItems()
      .filter((item) => item.type === 'boolean' || item.type === 'choice' || item.type === 'range')
      .map((item) => [item.key, item.value]));
  }

  // The page's items with one value changed: the same entries, so what the
  // page put in them stays.
  writeValues(next) {
    const list = Array.isArray(this.items) ? this.items : [];
    this.items = list.map((raw) => (raw && has(next, String(raw.key)) ? {...raw, value: next[String(raw.key)]} : raw));
  }

  // ─── changing a value ───────────────────────────────────────────────────
  // A person's change is a request (sf-settings-menu-change, cancelable);
  // the fact (sf-settings-menu-changed) follows once the value is kept. A
  // cancelled change leaves the value -- and a native control the person
  // moved is put back.
  requestChange(key, value, {control = null} = {}) {
    const item = this.item(key);
    if (!item || item.disabled || item.type === 'action') return refused('unknown');
    const next = item.type === 'boolean' ? Boolean(value) : item.type === 'range' ? Number(value) : String(value);
    const previous = item.value;
    if (next === previous) return applied();
    if (item.type === 'choice' && !item.options.some((option) => option.value === next)) return refused('unknown');
    if (!this.sfEmit('change', {key, value: next, previous}, {cancelable: true})) {
      if (control?.type === 'checkbox') control.checked = Boolean(previous);
      else if (control?.type === 'range') control.value = String(previous);
      this.requestComponentUpdate('items');
      return refused('prevented');
    }
    this.writeValues({[key]: next});
    this.sfEmit('changed', {key, value: next, previous});
    return applied();
  }

  toggleBoolean(key, control) {
    const item = this.item(key);
    return this.requestChange(key, control ? control.checked : !item?.value, {control});
  }

  // A range shows its value while it moves and asks once, when it is let go.
  previewRange(key, control) {
    const item = this.item(key);
    const label = control?.closest('.sf-settings-menu-row')?.querySelector('.sf-settings-menu-range-value');
    if (item && label) label.textContent = `${control.value}${item.unit}`;
  }

  commitRange(key, control) {
    return this.requestChange(key, control.value, {control});
  }

  // An option chosen in the list a row opened: the panel goes back to the
  // rows, the focus to the row it came from.
  pick(key, value) {
    const result = this.requestChange(key, value);
    if (result.outcome === 'applied') this.back();
    return result;
  }

  pressTile(key) {
    const item = this.item(key);
    if (!item || item.disabled) return refused('unknown');
    if (item.type === 'boolean') return this.requestChange(key, !item.value);
    if (item.options.length > 3) return this.drillIn(key);
    const at = item.options.findIndex((option) => option.value === item.value);
    return this.requestChange(key, item.options[(at + 1) % item.options.length].value);
  }

  // An action row: the page does the action (vocabulary §5 apply, §18.3); a
  // popup closes unless a listener cancelled the request to keep it.
  chooseAction(key) {
    const item = this.item(key);
    if (!item || item.disabled) return refused('unknown');
    const allowed = this.sfEmit('apply', {action: key, scope: 'entry', ids: [key]}, {cancelable: true});
    if (allowed && this._open) this.runClose({reason: 'api'});
    return allowed ? applied() : refused('prevented');
  }

  // The action reset: the items that declare a default and differ from it.
  runReset() {
    const changing = this.allItems().filter((item) => item.hasDefault && item.value !== item.default);
    const keys = changing.map((item) => item.key);
    if (!this.sfEmit('reset', {keys}, {cancelable: true})) return refused('prevented');
    if (!keys.length) return applied();
    this.writeValues(Object.fromEntries(changing.map((item) => [item.key, item.default])));
    for (const item of changing) this.sfEmit('changed', {key: item.key, value: item.default, previous: item.value});
    return applied();
  }

  // ─── the list in place ──────────────────────────────────────────────────
  drillIn(key) {
    const item = this.item(key);
    if (!item || item.type !== 'choice' || item.disabled) return refused('unknown');
    this.closeSelect();
    this._level = key;
    this.sfHostState('data-level', key);
    this.focusAfterRender(() => {
      const options = this.stops();
      return options.find((stop) => stop.getAttribute('aria-selected') === 'true') ?? options[0];
    });
    this.requestComponentUpdate('level');
    return applied();
  }

  back() {
    const key = this._level;
    if (!key) return refused('top');
    this._level = null;
    this.sfHostState('data-level', null);
    this.focusAfterRender(() => this.stops().find((stop) => stop.dataset.sfKey === key) ?? this.stops()[0]);
    this.requestComponentUpdate('level');
    return applied();
  }

  focusAfterRender(pick) {
    this._afterRender = () => {
      const target = pick();
      if (!target) return;
      this._current = target;
      this.syncStops();
      // Only a panel that held the focus moves it: an inline menu changed by
      // a pointer leaves the focus where the person put it.
      if (this.panel()?.contains(document.activeElement) || this._open || document.activeElement === document.body) {
        target.focus({preventScroll: true});
      }
    };
  }

  // ─── the compact select's small menu (rows) ─────────────────────────────
  async openSelect(button, key, event) {
    const item = this.item(key);
    if (!item || item.disabled) return;
    if (this._select?.isOpen && this._select._sfSettingsKey === key) {
      this._select.close({reason: 'close'});
      return;
    }
    this.closeSelect();
    const menu = document.createElement('sf-context-menu');
    menu._sfSettingsKey = key;
    menu.setAttribute('popup', '');
    menu.setAttribute('aria-label', item.label);
    menu.entries = item.options.map((option) => ({id: option.value, text: option.label, icon: option.icon || undefined, kind: 'radio', checked: option.value === item.value}));
    // The choice is this menu's to ask for; the list closes once it is kept.
    menu.addEventListener('sf-context-menu-select', (selected) => {
      selected.stopPropagation();
      if (this.requestChange(key, selected.detail?.id).outcome !== 'applied') selected.preventDefault();
    });
    menu.addEventListener('sf-context-menu-closed', () => {
      if (this._select === menu) this._select = null;
      menu.remove();
    });
    (this.closest('dialog[open]') || document.body).append(menu);
    carryLayerOrigin(menu, this);
    this._select = menu;
    await customElements.whenDefined('sf-context-menu');
    if (this._select !== menu) return;
    await menu.openFor(button, {side: 'block-end', align: 'end', focus: event?.detail === 0 ? 'first' : 'none'});
  }

  closeSelect() {
    const menu = this._select;
    if (!menu) return;
    this._select = null;
    if (menu.isOpen) menu.close({restoreFocus: false, ask: false});
    menu.remove();
  }

  // ─── the popup ──────────────────────────────────────────────────────────
  panel() {
    return this.querySelector(':scope > .sf-settings-menu');
  }

  // What opens the panel: the trigger slot's element, or the page's control
  // named by `for`.
  trigger() {
    if (this.inline) return null;
    const slotted = [].concat(this._liveSlotNodes?.get('trigger') || []).find((node) => node instanceof Element);
    if (slotted) return slotted;
    return this.for ? document.getElementById(this.for) : null;
  }

  // The element that says it opens a dialog: a native control itself, an
  // sf-icon-button or sf-button host (it forwards aria-* to its button), or
  // the first control inside.
  triggerControl() {
    const trigger = this.trigger();
    if (!trigger) return null;
    if (trigger.matches(FOCUSABLE) || trigger.localName.includes('-')) return trigger;
    return trigger.querySelector(FOCUSABLE) ?? trigger;
  }

  focusableTrigger() {
    const control = this.triggerControl();
    if (!control) return null;
    return control.localName.includes('-') ? (control.querySelector(FOCUSABLE) ?? control) : control;
  }

  syncTrigger() {
    const control = this.triggerControl();
    if (!control) return;
    control.setAttribute('aria-haspopup', 'dialog');
    control.setAttribute('aria-expanded', String(this._open));
    control.setAttribute('aria-controls', `${this._id}-panel`);
  }

  onHostClick(event) {
    if (this.inline) return;
    const path = event.composedPath?.() ?? [];
    const trigger = [].concat(this._liveSlotNodes?.get('trigger') || []).find((node) => node instanceof Element);
    if (!trigger || !path.includes(trigger)) return;
    event.preventDefault();
    if (this._open) this.runClose({reason: 'close'});
    else this.runOpen();
  }

  // The action open.
  runOpen() {
    if (this.inline) return refused('inline');
    if (this._open) return applied();
    const anchor = this.trigger();
    if (!anchor) return refused('no-trigger');
    if (!this.sfEmit('open', {}, {cancelable: true})) return refused('prevented');
    const active = document.activeElement;
    this._returnTo = active instanceof HTMLElement && active !== document.body && active !== document.documentElement && !this.panel()?.contains(active)
      ? active
      : this.focusableTrigger();
    this._open = true;
    this._level = null;
    this._current = null;
    this.sfHostState('data-open', true);
    this.sfHostState('data-level', null);
    this.syncTrigger();
    this.requestComponentUpdate('open');
    this.whenRendered(() => this.placeOpen(anchor));
    return applied();
  }

  placeOpen(anchor) {
    const surface = this.panel();
    if (!this._open || !surface) return;
    surface.classList.add('sf-settings-menu--open');
    // The top layer, where the platform has it: above every stacking context
    // and every clipping box.
    if (typeof surface.showPopover === 'function') {
      surface.setAttribute('popover', 'manual');
      if (!surface.matches(':popover-open')) surface.showPopover();
    } else {
      surface.style.zIndex = 'var(--sf-z-index-9)';
    }
    const {side, align} = PLACEMENT[this.placement] ?? PLACEMENT['bottom-end'];
    this._position?.stop();
    this._position = position().anchor(anchor, surface, {side, align, flip: true, shift: true, fitHeight: true});
    // A surface of the one stack (§19.1): the mark makes a drawer or a modal
    // under it stand back, and the stack hands it Escape while it is on top.
    holdOpenSurfaceMark(this, true);
    updateLayer(this, {root: () => this.panel(), onEscape: (event) => this.onLayerEscape(event)});
    document.addEventListener('pointerdown', this._onOutsidePress, true);
    this.syncStops();
    this.stops()[0]?.focus({preventScroll: true});
    this.sfEmit('opened', {});
  }

  // The action close; reason by §19.3.
  runClose({reason = 'api', restoreFocus = true} = {}) {
    if (!this._open) return refused('closed');
    if (!this.sfEmit('close', {reason, unsaved: false}, {cancelable: true})) return refused('prevented');
    this.finishClose({reason, restoreFocus});
    return applied();
  }

  finishClose({reason = 'api', emit = true, restoreFocus = true} = {}) {
    this._open = false;
    this.closeSelect();
    this._position?.stop();
    this._position = null;
    document.removeEventListener('pointerdown', this._onOutsidePress, true);
    holdOpenSurfaceMark(this, false);
    const surface = this.panel();
    if (surface) {
      if (surface.matches?.(':popover-open')) surface.hidePopover();
      surface.removeAttribute('popover');
      surface.classList.remove('sf-settings-menu--open');
      surface.style.removeProperty('z-index');
    }
    this._level = null;
    this.sfHostState('data-open', false);
    this.sfHostState('data-level', null);
    this.syncTrigger();
    this.requestComponentUpdate('close');
    if (restoreFocus) {
      // Focus goes back to the control that opened it (§19.2).
      const target = this._returnTo?.isConnected ? this._returnTo : this.focusableTrigger();
      target?.focus?.({preventScroll: true});
    }
    if (emit) this.sfEmit('closed', {reason});
  }

  // Escape through the stack, wherever the focus is: back from a list first.
  onLayerEscape(event) {
    if (!this._open || event.defaultPrevented) return false;
    if (this._level) this.back();
    else this.runClose({reason: 'escape'});
    return true;
  }

  // ─── keyboard ───────────────────────────────────────────────────────────
  // The stops of the level shown, in order: one per control.
  stops() {
    const panel = this.panel();
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(`.${STOP}`))
      .filter((stop) => !stop.disabled && stop.getClientRects().length > 0);
  }

  // One stop in the tab order: the one last focused, else the chosen pill or
  // option, else the first.
  syncStops() {
    const all = this.panel() ? Array.from(this.panel().querySelectorAll(`.${STOP}`)) : [];
    const stops = this.stops();
    if (!stops.includes(this._current)) {
      this._current = stops.find((stop) => stop.getAttribute('aria-selected') === 'true') ?? stops[0] ?? null;
    }
    for (const stop of all) stop.tabIndex = stop === this._current ? 0 : -1;
  }

  afterRender(changed) {
    if (typeof changed === 'function') return super.afterRender(changed);
    super.afterRender?.(changed);
    this.syncStops();
    const run = this._afterRender;
    this._afterRender = null;
    run?.();
    return undefined;
  }

  // The row a stop is in, and the stop a row is entered at: its pressed pill
  // or chosen option, else its first.
  rowOf(stop) {
    return stop?.dataset.sfRow ?? null;
  }

  entryOf(row, stops) {
    const inRow = stops.filter((stop) => this.rowOf(stop) === row);
    return inRow.find((stop) => stop.getAttribute('aria-pressed') === 'true') ?? inRow[0];
  }

  moveRow(from, step, stops) {
    const rows = [...new Set(stops.map((stop) => this.rowOf(stop)))];
    if (!rows.length) return null;
    let at = rows.indexOf(this.rowOf(from));
    if (step === 'first') at = 0;
    else if (step === 'last') at = rows.length - 1;
    else at = at < 0 ? 0 : (at + step + rows.length) % rows.length;
    return this.entryOf(rows[at], stops);
  }

  onKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const panel = this.panel();
    if (!panel || !panel.contains(event.target)) return;
    const stops = this.stops();
    const stop = event.target.closest?.(`.${STOP}`);
    const rtl = getComputedStyle(panel).direction === 'rtl';
    const inward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const outward = rtl ? 'ArrowRight' : 'ArrowLeft';
    const inRow = stop ? stops.filter((one) => this.rowOf(one) === this.rowOf(stop)) : [];
    const range = stop?.type === 'range';
    const go = (target) => {
      event.preventDefault();
      event.stopPropagation();
      if (target) {
        this._current = target;
        this.syncStops();
        target.focus();
      }
    };
    switch (event.key) {
      case 'ArrowDown':
        if (!event.shiftKey) go(this.moveRow(stop, 1, stops));
        return;
      case 'ArrowUp':
        if (!event.shiftKey) go(this.moveRow(stop, -1, stops));
        return;
      case 'Home':
        if (!range) go(this.moveRow(stop, 'first', stops));
        return;
      case 'End':
        if (!range) go(this.moveRow(stop, 'last', stops));
        return;
      case 'Escape':
        if (this._level) {
          go(null);
          this.back();
        } else if (this._open) {
          go(null);
          this.runClose({reason: 'escape'});
        }
        return;
      case 'Tab':
        // Tab leaves the popup for the page: the menu does not trap it.
        if (this._open) this.runClose({reason: 'api'});
        return;
      case 'Enter':
        // A switch is a checkbox: Space toggles it natively, Enter here.
        if (stop?.type === 'checkbox') {
          event.preventDefault();
          stop.click();
        }
        return;
      default:
        break;
    }
    if (range || !stop) return;
    if (event.key === inward) {
      if (inRow.length > 1) go(inRow[(inRow.indexOf(stop) + 1) % inRow.length]);
      else if (stop.classList.contains('sf-settings-menu-row--drill')) {
        go(null);
        this.drillIn(stop.dataset.sfKey);
      }
    } else if (event.key === outward) {
      if (inRow.length > 1) go(inRow[(inRow.indexOf(stop) + inRow.length - 1) % inRow.length]);
      else if (this._level) {
        go(null);
        this.back();
      } else if (this._open) {
        go(null);
        this.runClose({reason: 'api'});
      }
    }
  }

  // ─── drawing ────────────────────────────────────────────────────────────
  templateContext() {
    const all = this.allItems();
    const level = this._level ? all.find((item) => item.key === this._level && item.type === 'choice') ?? null : null;
    const tiles = all.filter((item) => item.tile);
    const items = all.filter((item) => !item.tile);
    // Row numbers for the keyboard: the tiles are one row, then each control.
    let row = tiles.length ? 1 : 0;
    for (const tile of tiles) tile.row = 0;
    for (const item of items) if (item.type !== 'section' && item.type !== 'divider') item.row = row++;
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      items,
      tiles,
      level,
      lead: items.some((item) => item.icon && item.type !== 'section' && item.type !== 'divider'),
      resetRow: row,
      open: this._open,
      inline: this.inline,
      size: this.size,
      label: this.label,
      heading: this.heading,
      resettable: this.resettable,
      resetLabel: this.resetLabel,
      backLabel: this.backLabel,
      trigger: this.inline ? '' : this.getSlotContent('trigger'),
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
    });
  }
}

SfSettingsMenu.define('sf-settings-menu');

export {SfSettingsMenu};
