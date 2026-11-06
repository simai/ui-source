// sf-language: the site's language picker. One element whose look follows the
// number of languages it is given:
//
//   <sf-language languages="ru en"></sf-language>            two: a segmented switch
//   <sf-language languages="ru en de fr es"></sf-language>   five: an icon button and a menu
//   <sf-language languages="ru en de … ja zh ar"></sf-language>  eight and more: the menu with search
//
// One language draws nothing. The names come from the browser
// (Intl.DisplayNames): each language is named in itself («Deutsch»), and in
// the menu in English beside it («German»); no dictionary ships with the
// component. A choice is a cancellable change event first; not cancelled, the
// element follows the language's href when it has one (a site with /ru/ and
// /en/), and otherwise applies it to the page: SF.language.use(code), and lang
// and dir on <html>. remember="<name>" keeps the choice (SF.Preferences, in
// the browser under sf-pref:sf-language/<name>); reading it back before the
// first paint is the site's (docs.md).
//
// It composes the Framework's parts and draws nothing of its own: the switch
// is sf-button-group appearance="segmented", the trigger sf-button-icon with
// the Material Symbols «translate» glyph, the list sf-menu-context with its
// search. Their events stay inside: the page hears this element's change.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8,
// §17.1): settings, values, the select action and the change event are made
// by core/js/element-manifest.js; the host is the form control.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {pageLocale} from '../../core/js/page-language';
import BundledPreferences from '../../core/js/preferences.js';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {FormField} from '../helpers/form-field';
import {renderLanguageTemplate} from './js/templates/default';
import {SIZES, canonicalCode, lookFor, matchLanguage, nameIn, normalizeLanguages} from './js/languages';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// The parts it draws, found under their current names and their former ones.
const MENU = `:scope > ${tagSelector('sf-menu-context')}`;
const TRIGGER = `:scope > ${tagSelector('sf-button-icon')}`;

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

// A remembered choice is a preference of the person (SF.Preferences, owner
// 2026-10-14): in the browser under sf-pref:sf-language/<remember>, and by a
// host that keeps preferences for its user. The registry is the shared one
// when core has published it (every bundle has its own copy).
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;

/** The SF.Preferences key a remember name keeps the choice under. */
export const rememberKey = (name) => (text(name) ? `sf-language/${text(name)}` : '');

const LanguageElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    select(args = {}) {
      const value = typeof args === 'string' ? args : args?.value;
      return this.choose(value, 'api');
    },
  },
});

class SfLanguage extends FormField(LanguageElement) {
  constructor() {
    super();
    // What the element last drew, so a change of the page's language that
    // this element did not make moves the shown value with it.
    this._shownLook = '';
  }

  connectedCallback() {
    // The island first: the languages may be in it.
    this.sfReadIsland();
    // The value a form reset returns to: the one the element was written with,
    // or the page's language when it was written with none.
    if (!Object.prototype.hasOwnProperty.call(this, '_resetValue')) this._resetValue = this.getAttribute('value') || '';
    super.connectedCallback();
  }

  // The languages, made safe: each with its names, short label, href and dir.
  get languageList() {
    return normalizeLanguages(this.languages, this.items, this.href);
  }

  // The language shown as chosen: the value when it is one of the list, else
  // the page's language, else the first.
  get current() {
    const list = this.languageList;
    if (!list.length) return null;
    const own = this.getAttribute('value');
    const doc = this.ownerDocument?.documentElement;
    return (own && matchLanguage(list, own))
      ?? matchLanguage(list, doc?.getAttribute('lang') || pageLocale(doc))
      ?? list[0];
  }

  // The value is a language code of the list; the chosen one is read through
  // current, so an element written without value says the page's language.
  get value() {
    return this.current?.code ?? '';
  }

  set value(next) {
    const code = canonicalCode(next);
    if (code) this.setAttribute('value', code);
    else this.removeAttribute('value');
    this.sfSyncFormState?.();
  }

  // What the element looks like now: none, inline, menu or search.
  get look() {
    return lookFor(this.languageList.length, {mode: this.mode, inlineMax: this.inlineMax, searchFrom: this.searchFrom});
  }

  // What the form gets (§17.1): the chosen code, nothing while disabled or
  // with no language to choose.
  sfFormValue() {
    if (this.disabled || this.sfFormDisabled) return null;
    return this.value || null;
  }

  fieldReset() {
    this.value = this._resetValue;
  }

  // The choice: the request first (change, cancellable); not cancelled, the
  // value is the language, the choice is remembered, and the page goes to its
  // href or takes the language.
  choose(next, reason = 'press') {
    const list = this.languageList;
    const language = matchLanguage(list, next);
    if (!language) return refused('unknown');
    if (this.disabled || this.sfFormDisabled) return refused('disabled');
    const previous = this.value;
    if (language.code === previous) return refused('unchanged');
    const detail = {value: language.code, previous, href: language.href, dir: language.dir, reason};
    if (!this.sfEmit('change', detail, {cancelable: true})) {
      // The switch shows what it had: the segment a person pressed goes back.
      this.requestComponentUpdate('refused');
      return refused('prevented');
    }
    this.value = language.code;
    this.keep(language.code);
    if (language.href) {
      this.go(language.href);
    } else if (this.apply !== 'none') {
      this.applyLanguage(language);
    }
    this.requestComponentUpdate('value');
    return applied({value: language.code});
  }

  keep(code) {
    const key = rememberKey(this.remember);
    if (!key) return;
    try {
      preferences().write(key, code);
    } catch {
      // A page without storage (private mode, blocked) still changes language.
    }
  }

  go(href) {
    const location = this.ownerDocument?.defaultView?.location;
    if (location && typeof location.assign === 'function') location.assign(href);
  }

  // The page takes the language: the components' words (SF.language.use,
  // which also writes <html lang>), and the direction it is written in.
  applyLanguage(language) {
    const root = this.ownerDocument?.documentElement;
    const shared = globalThis.SF?.language;
    if (typeof shared?.use === 'function') shared.use(language.code);
    if (root) {
      if (root.getAttribute('lang') !== language.code) root.setAttribute('lang', language.code);
      if (root.getAttribute('dir') !== language.dir) root.setAttribute('dir', language.dir);
    }
  }

  // ---------------------------------------------------------------- the parts

  // A segment was pressed. The group has already moved its plate; the
  // element answers for it, and the group's own change stays inside.
  onGroupChange(event) {
    event.stopPropagation();
    const group = event.currentTarget;
    const result = this.choose(group?.value, 'press');
    if (result.outcome !== 'applied' && group && group.value !== this.value) group.value = this.value;
  }

  // A row of the menu was chosen: the menu closes itself and returns focus to
  // the trigger; its event stays inside.
  onMenuSelect(event) {
    event.stopPropagation();
    const id = event.detail?.id;
    if (id) this.choose(id, 'press');
  }

  get menu() {
    return this.querySelector(MENU);
  }

  get trigger() {
    return this.querySelector(TRIGGER);
  }

  /** Opens or closes the menu of a menu or search look. */
  toggleMenu() {
    const menu = this.menu;
    const host = this.trigger;
    if (!menu || !host || this.disabled) return;
    const anchor = host.querySelector('button') ?? host;
    customElements.whenDefined('sf-menu-context').then(() => menu.toggleFor(anchor));
  }

  // The menu's rows: the name in itself, its English name beside it, the
  // radio mark on the chosen one; each row in its own language. The search
  // reads the native name, the English name, the name in the page's language
  // and the code (keywords).
  menuEntries(list, current) {
    const page = pageLocale(this);
    return list.map((language) => ({
      id: language.code,
      text: language.label,
      value: language.english !== language.label ? language.english : undefined,
      kind: 'radio',
      checked: language.code === current?.code,
      lang: language.code,
      keywords: [language.native, language.english, nameIn(language.code, page), language.code].filter(Boolean).join(' '),
    }));
  }

  templateContext() {
    const list = this.languageList;
    const current = this.current;
    const look = lookFor(list.length, {mode: this.mode, inlineMax: this.inlineMax, searchFrom: this.searchFrom});
    const size = SIZES.includes(this.size) ? this.size : '1';
    this.sfHostState('data-look', look);
    this._shownLook = look;
    const label = this.label;
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      look,
      size,
      // The menu has two rungs: rows of 32 px up to 1/2, of 40 px from 1.
      menuSize: size === '1/3' || size === '1/2' ? '1/2' : '1',
      compact: Boolean(this.compact),
      disabled: Boolean(this.disabled || this.sfFormDisabled),
      list,
      current,
      value: current?.code ?? '',
      label,
      triggerLabel: current ? this.sfWord('trigger', {vars: {label, name: current.native}}) : label,
      entries: look === 'menu' || look === 'search' ? this.menuEntries(list, current) : [],
      search: look === 'search' ? {placeholder: this.sfWord('search'), empty: this.sfWord('empty')} : null,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderLanguageTemplate(this.templateContext());
  }

  afterRender() {
    // The menu takes its search as a property; the template cannot clear it
    // once set, so it is written here every drawing.
    const menu = this.menu;
    if (menu) {
      const search = this.look === 'search' ? {placeholder: this.sfWord('search'), empty: this.sfWord('empty')} : null;
      if (JSON.stringify(menu.search) !== JSON.stringify(search)) menu.search = search;
    }
    this.sfSyncFormState();
  }
}

SfLanguage.define('sf-language');

export {SfLanguage};
