// sf-profile-picker: the one way a person chooses, makes, renames, removes and
// resets a profile -- the admin menu's profiles, a record's views, and
// whatever has profiles next (owner, 2026-10-14, from the approved
// prototype). It picks a settings profile -- a named set of menu rows, of a
// record's view, of a table's columns -- never an account or an organisation
// (owner decision C163 (1): those are the person menu's, sf-menu-context).
// Folded it is the standard button naming the profile in use (sf-button ghost
// with a chevron, C163 (2)); open, everything happens in its panel: a row per
// profile, its rename and remove behind the row's «⋯» (C163 (3)), a new
// profile made inline, a reset at the foot. On a phone the panel is the
// Framework's bottom sheet, sf-drawer placement=bottom (C163 (4), C157 (5)).
//
// The profiles and what may be done with them are the host's: the component
// draws them and says what the person asked for, with one event per act --
// sf-profile-picker-select, -create, -rename, -delete, -reset (the old
// sf-profile-* names follow until 2026-12-01). It does not change its own
// list; the host answers by setting `profiles` (and `current`), or by setting
// `message` to say why not.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// settings and values are made by core/js/element-manifest.js, the words are
// lang/<locale>.json, and skeleton.html is its first paint before the host's
// profiles arrive (§5.4).
import {render} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {applied, elementFromManifest} from '../../core/js/element-manifest';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {focusablesIn} from '../../core/js/layer-stack';
import {PanelScrollbar} from '../../component/panel-scrollbar';
import {renderProfilePickerTemplate, renderProfilePickerSheet} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

const ProfilePickerElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  aliases,
});

const position = () => globalThis.SF?.Position || BundledPosition;
// On a phone -- below the md breakpoint, where core declares
// --sf-breakpoint-md -- the panel is a sheet at the bottom of the screen
// (owner decisions C32, C106 (8): a panel holding a form is a bottom sheet on
// a phone; C163 (4), C157 (5): the one bottom sheet is sf-drawer
// placement=bottom, a lazy relation). A page without sf-drawer gets the
// picker's own sheet, the panel at the bottom of the screen.
const onPhone = () => !getComputedStyle(document.documentElement).getPropertyValue('--sf-breakpoint-md').trim();
// The row's buttons are reached by the arrows' F2 and Delete, not by Tab: the
// menu is one stop (sf-button-icon draws its native button late, so it is
// tamed as it appears).
const tameButtons = (panel) => {
  for (const button of panel?.querySelectorAll('.sf-profile-picker-actions button') ?? []) button.tabIndex = -1;
};

// Asks the Loader for a lazy relation and answers whether it is defined.
const ensureElement = async (tag) => {
  if (globalThis.customElements?.get(tag)) return true;
  try {
    await globalThis.SF?.Loader?.ensure?.([tag]);
  } catch {
    // Not on this page: the caller's fallback.
  }
  return Boolean(globalThis.customElements?.get(tag));
};

// The template names its words in camelCase; the language files in kebab-case.
const kebab = (key) => String(key).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

class SfProfilePicker extends ProfilePickerElement {
  constructor() {
    super();
    this._profiles = [];
    this._rights = {};
    this.state = {open: false, sheet: false, drawer: false, mode: null, target: null, draft: {name: '', shared: false}};
  }

  static get props() {
    return {...super.props, templateName: {attribute: 'template', default: 'default'}, rootClass: {default: ''}};
  }

  // [{id, label, shared, builtin, editable}]: editable false is a profile this
  // person may see and choose but not change; builtin is the standard one,
  // never renamed or removed.
  get profiles() {
    return this._profiles;
  }

  set profiles(value) {
    this._profiles = Array.isArray(value) ? value.filter((entry) => entry && entry.id !== undefined) : [];
    // A host that answers with the list has answered the act in progress.
    if (this.state.mode && this.state.mode !== 'delete-confirm') this.state = {...this.state, mode: null, target: null};
    if (this.state.mode === 'delete-confirm' && !this._profiles.some((entry) => String(entry.id) === this.state.target)) {
      this.state = {...this.state, mode: null, target: null};
    }
    this.requestComponentUpdate('profiles');
  }

  // {create: {personal, shared}, reset}: what this person may make. A
  // personal profile is one per person, so a host that has one says so.
  get rights() {
    return this._rights;
  }

  set rights(value) {
    this._rights = value && typeof value === 'object' ? value : {};
    this.requestComponentUpdate('rights');
  }

  // Size 1 by default (owner decision C22): a compact admin gets its smaller
  // step from data-sf-density, a phone from the ladder; 1/2 was the default
  // and made a phone's trigger 24 high. size="1/2" is still drawn as asked.
  get size() {
    return this.getAttribute('size') === '1/2' ? '1/2' : '1';
  }

  set size(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('size');
    else this.setAttribute('size', String(value));
  }

  get current() {
    return this.getAttribute('current') ?? String(this._profiles[0]?.id ?? '');
  }

  set current(value) {
    if (value === null || value === undefined) this.removeAttribute('current');
    else this.setAttribute('current', String(value));
  }

  text(key) {
    return this.sfWord(kebab(key));
  }

  currentProfile() {
    return this._profiles.find((entry) => String(entry.id) === String(this.current)) ?? this._profiles[0] ?? null;
  }

  mayChange(profile) {
    return Boolean(profile) && profile.editable !== false && !profile.builtin;
  }

  canCreate() {
    const create = this._rights.create ?? {};
    return Boolean(create.personal || create.shared);
  }

  panel() {
    if (this.state.drawer) return this._sheetBody?.querySelector('.sf-profile-picker-panel') ?? null;
    return this.querySelector(':scope > .sf-profile-picker > .sf-profile-picker-panel');
  }

  // The trigger's native button (sf-button's host lays out as
  // display:contents, so the box and the focus are its button's).
  trigger() {
    const host = this.querySelector(':scope > .sf-profile-picker > .sf-profile-picker-trigger');
    return host?.querySelector(':scope > button') ?? null;
  }

  // ─── opening ───────────────────────────────────────────────────────────
  async open() {
    if (this.disabled) return {outcome: 'refused', reason: 'disabled'};
    if (this.state.open) return applied();
    if (onPhone() && !this._noDrawer) {
      this.state = {...this.state, open: true, sheet: true, drawer: true, mode: null, target: null};
      this.requestComponentUpdate('open');
      if (await ensureElement('sf-drawer')) return this.openSheet();
      // No bottom sheet on this page: the picker's own.
      this._noDrawer = true;
      if (!this.state.open || !this.isConnected) return {outcome: 'refused', reason: 'closed'};
      this.state = {...this.state, open: false, sheet: false, drawer: false};
    }
    this.state = {...this.state, open: true, sheet: onPhone(), drawer: false, mode: null, target: null};
    this.requestComponentUpdate('open');
    await this.whenRendered?.();
    // Closed or taken out while it drew (§7.7): nothing is started, or the
    // listeners, the placement and the layer it registers would outlive it.
    // The action answers cancelled when its scope has ended (element-manifest.js).
    if (!this.state.open || !this.isConnected) return {outcome: 'refused', reason: 'closed'};
    const panel = this.panel();
    const trigger = this.trigger();
    if (!panel || !trigger) return applied();
    if (typeof panel.showPopover === 'function') {
      panel.setAttribute('popover', 'manual');
      if (!panel.matches(':popover-open')) panel.showPopover();
    }
    this.place();
    this._onResize = () => {
      if (this.state.open && onPhone() !== this.state.sheet) {
        this.state = {...this.state, sheet: onPhone()};
        this.requestComponentUpdate('sheet');
        this.whenRendered?.().then(() => this.place());
      }
    };
    window.addEventListener('resize', this._onResize);
    tameButtons(panel);
    this._tamer = typeof MutationObserver === 'function' ? new MutationObserver(() => tameButtons(this.panel())) : null;
    this._tamer?.observe(panel, {childList: true, subtree: true});
    // The scrollbar stands in the panel's inline-end inset while it takes
    // room (owner C07, docs review R029).
    this._scrollbar ??= new PanelScrollbar();
    this._scrollbar.watch(panel, 'sf-profile-picker-panel--scrollbar');
    // The open panel owns Escape: the root says so, and a drawer or record
    // panel listening on the document stands back. A press outside the picker
    // and its panel closes it, heard through the layer stack's one listener
    // while it is the top layer (§19.3).
    holdOpenSurfaceMark(this, true, {
      root: () => this.panel(),
      onOutsidePress: () => this.close({restoreFocus: false}),
      // An Escape whose focus is not in a row (the page, after a press
      // outside the rows) still closes the open panel.
      onEscape: () => {
        if (this.state.mode) this.setMode(null);
        else this.close();
        return true;
      },
      // A sheet covers the page, so Tab goes round inside it.
      onTab: (event) => {
        if (!this.state.sheet) return;
        const controls = focusablesIn(this.panel());
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
    (panel.querySelector('.sf-profile-picker-row[aria-checked="true"]') ?? panel.querySelector('.sf-profile-picker-row'))?.focus({preventScroll: true});
    return applied();
  }

  // ─── the bottom sheet on a phone ────────────────────────────────────────
  // sf-drawer placement=bottom, made once and kept in the host so it carries
  // the picker's language, direction and theme to its portal. The drawer
  // draws the head (the picker's name and its close button), holds the focus
  // and the scrim, closes on Escape, the scrim and a swipe down, and gives the
  // focus back to the trigger; the picker draws its rows into the body.
  sheetDrawer() {
    if (this._sheet?.isConnected && this._sheet.parentNode === this) return this._sheet;
    const sheet = document.createElement('sf-drawer');
    sheet.setAttribute('placement', 'bottom');
    sheet.setAttribute('modal', '');
    const body = document.createElement('div');
    body.className = 'sf-profile-picker-sheet-body';
    sheet.append(body);
    sheet.addEventListener('sf-drawer-opened', () => this.focusSheetRow());
    sheet.addEventListener('sf-drawer-closed', () => this.sheetClosed());
    this.append(sheet);
    this._sheet = sheet;
    this._sheetBody = body;
    return sheet;
  }

  async openSheet() {
    await this.whenRendered?.();
    if (!this.state.open || !this.isConnected) return {outcome: 'refused', reason: 'closed'};
    const sheet = this.sheetDrawer();
    // The sheet's title, which also names its dialog.
    sheet.setAttribute('heading', this.label || this.text('label'));
    sheet.setAttribute('close-label', this.text('close'));
    this.renderSheet();
    // The drawer focuses its panel when it opens (and again when its sheet
    // has come on a first open); the picker hands that focus on to the
    // current row, as the dropping panel opens on it.
    this._sheetFocus ??= (event) => {
      const panel = this._sheetBody?.closest('[data-sf-drawer-panel]');
      if (this.state.drawer && panel && event.target === panel) this.focusSheetRow();
    };
    document.addEventListener('focusin', this._sheetFocus, true);
    this._tamer?.disconnect();
    this._tamer = typeof MutationObserver === 'function' ? new MutationObserver(() => tameButtons(this.panel())) : null;
    this._tamer?.observe(this._sheetBody, {childList: true, subtree: true});
    await sheet.open?.();
    tameButtons(this.panel());
    return applied();
  }

  focusSheetRow() {
    const panel = this.panel();
    if (!this.state.drawer || !panel || this.state.mode) return;
    (panel.querySelector('.sf-profile-picker-row[aria-checked="true"]') ?? panel.querySelector('.sf-profile-picker-row'))?.focus({preventScroll: true});
  }

  renderSheet() {
    if (!this._sheetBody) return;
    render(renderProfilePickerSheet(this.templateContext()), this._sheetBody);
  }

  // The drawer closed itself (its close button, the scrim, Escape, a swipe):
  // the picker is closed too; the drawer has given the focus back.
  sheetClosed() {
    if (!this.state.drawer) return;
    this.finishClose();
    this.requestComponentUpdate('close');
  }

  // Every update of the element draws the sheet's body too while it is open.
  renderTemplateResult(templateResult) {
    super.renderTemplateResult(templateResult);
    if (this.state.drawer) this.renderSheet();
  }

  // Anchored under the trigger, at least its width; a sheet at the bottom of
  // the screen on a phone (the stylesheet's sf-profile-picker-panel--sheet).
  place() {
    const panel = this.panel();
    const trigger = this.trigger();
    this._position?.stop();
    this._position = null;
    if (!panel || !trigger) return;
    if (this.state.sheet) {
      panel.style.removeProperty('min-inline-size');
      for (const property of ['top', 'left', 'right', 'bottom', 'inset', 'translate', 'transform', 'max-block-size', 'max-height']) panel.style.removeProperty(property);
      return;
    }
    // At least the trigger's width, wider for a long name.
    panel.style.minInlineSize = `${Math.round(trigger.getBoundingClientRect().width)}px`;
    this._position = position().anchor(trigger, panel, {side: 'block-end', align: 'start', flip: true, shift: true, fitHeight: true});
  }

  close({restoreFocus = true} = {}) {
    if (!this.state.open) return {outcome: 'refused', reason: 'closed'};
    this._actions?.close?.({restoreFocus: false});
    if (this.state.drawer) {
      // The drawer gives the focus back to what opened it, the trigger.
      const sheet = this._sheet;
      this.finishClose();
      this.requestComponentUpdate('close');
      sheet?.close?.({reason: 'close'});
      return applied();
    }
    this.finishClose();
    this._position?.stop();
    this._position = null;
    window.removeEventListener('resize', this._onResize);
    this._tamer?.disconnect();
    this._tamer = null;
    this._scrollbar?.disconnect();
    holdOpenSurfaceMark(this, false);
    const panel = this.panel();
    if (panel?.matches?.(':popover-open')) panel.hidePopover();
    this.requestComponentUpdate('close');
    if (restoreFocus) this.trigger()?.focus({preventScroll: true});
    return applied();
  }

  // What every close does, whoever closed: the state, the listeners.
  finishClose() {
    this.state = {...this.state, open: false, sheet: false, drawer: false, mode: null, target: null};
    if (this._sheetFocus) document.removeEventListener('focusin', this._sheetFocus, true);
    this._tamer?.disconnect();
    this._tamer = null;
    if (this._sheetBody) render(renderProfilePickerSheet(this.templateContext()), this._sheetBody);
  }

  toggle() {
    return this.state.open ? this.close() : this.open();
  }

  // ─── a row's «⋯» (owner decision C163 (3)) ─────────────────────────────
  // One menu per picker, the standard sf-menu-context as a popup (a lazy
  // relation): «Переименовать» (F2) and, after a line, «Удалить…» in the
  // danger colour, which asks first in the row. It stands above the panel and
  // the sheet, and gives the focus back to the «⋯» it opened from.
  async openActions(id, from) {
    const profile = this._profiles.find((entry) => String(entry.id) === String(id));
    if (!this.mayChange(profile) || !(await ensureElement('sf-menu-context'))) return;
    if (!this.state.open || !this.isConnected) return;
    if (!this._actions?.isConnected) {
      const menu = document.createElement('sf-menu-context');
      menu.setAttribute('popup', '');
      menu.className = 'sf-profile-picker-actions-menu';
      menu.addEventListener('sf-menu-context-select', (event) => {
        const chosen = event.detail?.id;
        const target = this._actionsFor;
        if (!target || (chosen !== 'rename' && chosen !== 'delete')) return;
        // The row's form takes the focus once it is drawn.
        setTimeout(() => this.setMode(chosen === 'rename' ? 'rename' : 'delete-confirm', target), 0);
      });
      this.append(menu);
      this._actions = menu;
    }
    const menu = this._actions;
    menu.setAttribute('aria-label', `${this.text('actions')}: ${profile.label ?? id}`);
    menu.entries = [
      {id: 'rename', text: this.text('rename'), icon: 'edit', shortcut: 'F2'},
      {type: 'separator'},
      {id: 'delete', text: this.text('removeAsk'), icon: 'delete', danger: true, shortcut: 'Delete'},
    ];
    this._actionsFor = String(id);
    const anchor = from?.querySelector?.(':scope > button') ?? from;
    await menu.toggleFor?.(anchor);
  }

  disconnectedCallback() {
    this.close({restoreFocus: false});
    this._actions?.close?.({restoreFocus: false});
    super.disconnectedCallback();
  }

  // ─── acts ──────────────────────────────────────────────────────────────
  // sf-profile-picker-<verb> (§8); the old sf-profile-<verb> follows.
  announce(name, detail, {cancelable = false} = {}) {
    return this.sfEmit(name, detail, {cancelable});
  }

  setMode(mode, target = null) {
    const current = this.currentProfile();
    const create = this._rights.create ?? {};
    const draft = mode === 'create'
      ? {name: '', shared: create.personal ? false : true}
      : this.state.draft;
    // Leaving a form, the focus goes back to the row it was opened from (or
    // to «Новый профиль…»), so the next Escape still reaches the panel: it
    // fell to the page with the form, and the panel stayed open.
    const back = mode ? null : (this.state.mode === 'create' ? 'add' : this.state.target);
    this.state = {...this.state, mode, target: target === null ? null : String(target), draft};
    this.setAttribute('message', '');
    this.requestComponentUpdate('mode');
    this.whenRendered?.().then(() => {
      const panel = this.panel();
      if (!mode) {
        if (!this.state.open || !panel || panel.contains(document.activeElement) && document.activeElement !== panel) return;
        const row = back === 'add'
          ? panel.querySelector('.sf-profile-picker-add')
          : (back !== null && [...panel.querySelectorAll('.sf-profile-picker-row[data-id]')].find((entry) => entry.dataset.id === back))
            || panel.querySelector('.sf-profile-picker-row[aria-checked="true"]');
        row?.focus({preventScroll: true});
        return;
      }
      const field = panel?.querySelector('.sf-profile-picker-field');
      field?.focus();
      field?.select?.();
    });
    return current;
  }

  choose(id) {
    if (String(id) !== String(this.current)) this.announce('select', {id: String(id), ids: [String(id)]});
    this.close();
  }

  submitCreate(name, shared) {
    const label = String(name ?? '').trim();
    if (!label) {
      this.setAttribute('message', this.text('nameEmpty'));
      return;
    }
    const create = this._rights.create ?? {};
    const kind = (shared && create.shared) || !create.personal ? true : Boolean(shared);
    this.announce('create', {label, shared: kind, from: String(this.currentProfile()?.id ?? ''), kind: kind ? 'shared' : 'personal'});
  }

  submitRename(id, name) {
    const label = String(name ?? '').trim();
    if (!label) {
      this.setAttribute('message', this.text('nameEmpty'));
      return;
    }
    this.announce('rename', {id: String(id), label, title: label});
  }

  submitDelete(id) {
    this.announce('delete', {id: String(id), ids: [String(id)]});
  }

  reset() {
    this.announce('reset', {id: String(this.currentProfile()?.id ?? '')});
    this.close();
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      // Consumed: the press closes the panel (or leaves its form), not the
      // drawer or the window the picker sits in.
      event.preventDefault();
      event.stopPropagation();
      if (this.state.mode) this.setMode(null);
      else this.close();
      return;
    }
    const rows = [...(this.panel()?.querySelectorAll('.sf-profile-picker-row[tabindex]') ?? [])];
    const at = rows.indexOf(event.target);
    if (at < 0) return;
    const row = rows[at];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      rows[(at + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      rows[event.key === 'Home' ? 0 : rows.length - 1]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      row.click();
    } else if (event.key === 'F2' && row.dataset.id) {
      const profile = this._profiles.find((entry) => String(entry.id) === row.dataset.id);
      if (this.mayChange(profile)) { event.preventDefault(); this.setMode('rename', row.dataset.id); }
    } else if (event.key === 'Delete' && row.dataset.id) {
      const profile = this._profiles.find((entry) => String(entry.id) === row.dataset.id);
      if (this.mayChange(profile)) { event.preventDefault(); this.setMode('delete-confirm', row.dataset.id); }
    } else if ((event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) && row.dataset.id) {
      // The row's «⋯» from the keyboard: its menu, as a context menu opens.
      const more = row.querySelector('.sf-profile-picker-more');
      if (more) { event.preventDefault(); this.openActions(row.dataset.id, more); }
    }
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      // The page language's «Profile» when the host names nothing.
      heading: this.label || this.text('label'),
      size: this.size,
      profiles: this._profiles,
      current: this.current,
      currentProfile: this.currentProfile(),
      rights: this._rights,
      state: this.state,
      message: this.message,
      resettable: this.resettable,
      text: (key) => this.text(key),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderProfilePickerTemplate(this.templateContext());
  }
}

SfProfilePicker.define('sf-profile-picker');

globalThis.SF = globalThis.SF || {};
export {SfProfilePicker};
