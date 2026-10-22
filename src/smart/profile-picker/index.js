// sf-profile-picker: the one way a person chooses, makes, renames, removes and
// resets a profile -- the admin menu's profiles, a record's views, and
// whatever has profiles next (owner, 2026-10-14, from the approved
// prototype). Folded it is a field-like button naming the profile in use;
// open, everything happens in its panel: a row per profile, its rename and
// remove on the row, a new profile made inline, a reset at the foot.
//
// The profiles and what may be done with them are the host's: the component
// draws them and says what the person asked for, with one event per act --
// sf-profile-select, -create, -rename, -delete, -reset. It does not change its
// own list; the host answers by setting `profiles` (and `current`), or by
// setting `message` to say why not.
import SfBaseElement from '../../core/js/smart-base';
import BundledPosition from '../../core/js/position.js';
import {pageText} from '../../core/js/page-language';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {renderProfilePickerTemplate} from './js/templates/default';
import './scss/index.scss';

const position = () => globalThis.SF?.Position || BundledPosition;

export const PROFILE_PICKER_TEXT = {
  en: {
    label: 'Profile', newProfile: 'New profile…', name: 'Profile name', personal: 'Personal', shared: 'For everyone',
    builtin: 'standard', create: 'Create', cancel: 'Cancel', rename: 'Rename', remove: 'Delete', save: 'Save',
    reset: 'Reset to standard', removeQuestion: 'Delete «{name}»?', removeShared: 'It goes for everyone on the site.',
    copyOf: 'A copy of «{name}».', seenByAll: 'Seen by everyone on the site.', seenByYou: 'Seen only by you.',
    locked: 'You cannot change it', personalTaken: 'You already have a personal profile', sharedDenied: 'You cannot make shared profiles',
    nameEmpty: 'Give the profile a name.',
  },
  ru: {
    label: 'Профиль', newProfile: 'Новый профиль…', name: 'Название профиля', personal: 'Личный', shared: 'Для всех',
    builtin: 'стандартный', create: 'Создать', cancel: 'Отмена', rename: 'Переименовать', remove: 'Удалить', save: 'Сохранить',
    reset: 'Сбросить к стандартному', removeQuestion: 'Удалить «{name}»?', removeShared: 'Он исчезнет у всех на сайте.',
    copyOf: 'Копия профиля «{name}».', seenByAll: 'Виден всем на сайте.', seenByYou: 'Виден только вам.',
    locked: 'Нет прав на изменение', personalTaken: 'Личный профиль уже есть', sharedDenied: 'Нет прав на общие профили',
    nameEmpty: 'Дайте профилю название.',
  },
};

class SfProfilePicker extends SfBaseElement {
  constructor() {
    super();
    this._profiles = [];
    this._rights = {};
    this.state = {open: false, mode: null, target: null, draft: {name: '', shared: false}};
    this._onOutside = (event) => {
      if (!this.state.open) return;
      const path = event.composedPath();
      if (path.includes(this) || path.includes(this.panel())) return;
      this.close({restoreFocus: false});
    };
  }

  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      label: {default: ''},
      size: {default: '1/2'},
      current: {default: ''},
      resettable: {type: Boolean, default: false},
      message: {default: ''},
      disabled: {type: Boolean, default: false},
      rootClass: {default: ''},
    };
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

  get label() {
    return this.getAttribute('label') || '';
  }

  get size() {
    return this.getAttribute('size') === '1' ? '1' : '1/2';
  }

  get current() {
    return this.getAttribute('current') ?? String(this._profiles[0]?.id ?? '');
  }

  get resettable() {
    return this.getBooleanAttr('resettable', false);
  }

  get message() {
    return this.getAttribute('message') || '';
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  text(key) {
    return pageText(PROFILE_PICKER_TEXT, key, this, 'sf-profile-picker');
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
    return this.querySelector(':scope .sf-profile-picker-panel');
  }

  trigger() {
    return this.querySelector(':scope .sf-profile-picker-trigger');
  }

  // ─── opening ───────────────────────────────────────────────────────────
  async open() {
    if (this.disabled || this.state.open) return;
    this.state = {...this.state, open: true, mode: null, target: null};
    this.requestComponentUpdate('open');
    await this.whenRendered?.();
    const panel = this.panel();
    const trigger = this.trigger();
    if (!panel || !trigger) return;
    if (typeof panel.showPopover === 'function') {
      panel.setAttribute('popover', 'manual');
      if (!panel.matches(':popover-open')) panel.showPopover();
    }
    // At least the trigger's width, wider for a long name.
    panel.style.minInlineSize = `${Math.round(trigger.getBoundingClientRect().width)}px`;
    this._position = position().anchor(trigger, panel, {side: 'block-end', align: 'start', flip: true, shift: true, fitHeight: true});
    document.addEventListener('pointerdown', this._onOutside, true);
    // The open panel owns Escape: the root says so, and a drawer or record
    // panel listening on the document stands back.
    holdOpenSurfaceMark(this, true);
    (panel.querySelector('.sf-profile-picker-row[aria-checked="true"]') ?? panel.querySelector('.sf-profile-picker-row'))?.focus({preventScroll: true});
  }

  close({restoreFocus = true} = {}) {
    if (!this.state.open) return;
    this.state = {...this.state, open: false, mode: null, target: null};
    this._position?.stop();
    this._position = null;
    document.removeEventListener('pointerdown', this._onOutside, true);
    holdOpenSurfaceMark(this, false);
    const panel = this.panel();
    if (panel?.matches?.(':popover-open')) panel.hidePopover();
    this.requestComponentUpdate('close');
    if (restoreFocus) this.trigger()?.focus({preventScroll: true});
  }

  toggle() {
    return this.state.open ? this.close() : this.open();
  }

  disconnectedCallback() {
    this.close({restoreFocus: false});
    super.disconnectedCallback();
  }

  // ─── acts ──────────────────────────────────────────────────────────────
  announce(name, detail, {cancelable = false} = {}) {
    return this.dispatchEvent(new CustomEvent(`sf-profile-${name}`, {bubbles: true, composed: true, cancelable, detail}));
  }

  setMode(mode, target = null) {
    const current = this.currentProfile();
    const create = this._rights.create ?? {};
    const draft = mode === 'create'
      ? {name: '', shared: create.personal ? false : true}
      : this.state.draft;
    this.state = {...this.state, mode, target: target === null ? null : String(target), draft};
    this.setAttribute('message', '');
    this.requestComponentUpdate('mode');
    this.whenRendered?.().then(() => {
      const field = this.panel()?.querySelector('.sf-profile-picker-field');
      field?.focus();
      field?.select?.();
    });
    return current;
  }

  choose(id) {
    if (String(id) !== String(this.current)) this.announce('select', {id: String(id)});
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
    this.announce('create', {label, shared: kind, from: String(this.currentProfile()?.id ?? '')});
  }

  submitRename(id, name) {
    const label = String(name ?? '').trim();
    if (!label) {
      this.setAttribute('message', this.text('nameEmpty'));
      return;
    }
    this.announce('rename', {id: String(id), label});
  }

  submitDelete(id) {
    this.announce('delete', {id: String(id)});
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
