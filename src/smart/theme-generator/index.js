// sf-theme-generator: a theme from one colour (owner, 2026-10-10: «a Smart
// component where a person chooses the main colour and it makes all the
// other variables»).
//
// The calculation is core's theme-palette: one colour gives the eight tonal
// palettes, the 128 primitives --sf-<palette>-<tone> every semantic token
// reads. This element is the choice around it: a colour, the generator's own
// hue and chroma for fine tuning, a preview of the palettes, and a way back to
// the Framework's own colour. It stores nothing -- the host keeps the choice
// (Docara settings, Larena site settings) -- and changes nothing on the page
// unless it is asked to with `apply`.
import SfBaseElement from '../../core/js/smart-base';
import {pageText} from '../../core/js/page-language';
import {
  applyTheme,
  colorToHct,
  isThemeColor,
  themeFromColor,
  themeFromHct,
  themeToCss,
  themeVariables,
  DEFAULT_THEME_COLOR,
  THEME_PALETTES,
} from '../../core/js/theme-palette.js';
import {renderThemeGeneratorTemplate} from './js/templates/default';
import './scss/index.scss';

const SIZES = ['1/2', '1', '2'];
// The tones the preview shows: light to dark, the brand tone (40) among them.
const PREVIEW_TONES = [90, 70, 50, 40, 30, 10];
const LIMITS = {hue: [0, 360], chroma: [0, 150]};

const THEME_TEXT = {
  en: {
    color: 'Main colour',
    inherited: 'Framework colour',
    advanced: 'Advanced',
    hue: 'Hue',
    hueHint: '0 to 360',
    chroma: 'Chroma',
    chromaHint: '0 to 150',
    reset: 'Reset',
    preview: 'Theme preview',
    primary: 'Primary',
    secondary: 'Secondary',
    tertiary: 'Tertiary',
    neutral: 'Neutral',
    error: 'Error',
    warning: 'Warning',
    success: 'Success',
    info: 'Information',
  },
  ru: {
    color: 'Основной цвет',
    inherited: 'цвет Framework',
    advanced: 'Тонкая настройка',
    hue: 'Тон',
    hueHint: 'От 0 до 360',
    chroma: 'Насыщенность',
    chromaHint: 'От 0 до 150',
    reset: 'Сбросить',
    preview: 'Предпросмотр темы',
    primary: 'Основная',
    secondary: 'Вторичная',
    tertiary: 'Дополнительная',
    neutral: 'Нейтральная',
    error: 'Ошибка',
    warning: 'Предупреждение',
    success: 'Успех',
    info: 'Информация',
  },
};

// A hex the calculation accepts, as #rrggbb, or '' for none. The colour
// control also holds #rrggbbaa; a theme has no transparency, so it is dropped.
const normaliseColor = (value) => {
  let text = String(value ?? '').trim();
  if (/^#?[0-9a-f]{8}$/iu.test(text)) text = text.replace(/^#?/u, '#').slice(0, 7);
  return isThemeColor(text) ? colorToHct(text).hex : '';
};

// A whole number in the field's range, or null. `clamp` takes a number out of
// range to its edge (a committed field); without it such a number is not read
// at all (a field still being typed: «4» on the way to «45» is not 4 yet, but
// «400» on the way nowhere is not 360 either).
const readNumber = (value, [min, max], clamp = false) => {
  const text = String(value ?? '').trim();
  if (!/^-?\d+(?:[.,]\d+)?$/u.test(text)) return null;
  const number = Math.round(Number(text.replace(',', '.')));
  if (!Number.isFinite(number)) return null;
  if (number < min || number > max) return clamp ? Math.min(max, Math.max(min, number)) : null;
  return number;
};

const copy = (value) => JSON.parse(JSON.stringify(value));

class SfThemeGenerator extends SfBaseElement {
  constructor() {
    super();
    this._themeKey = null;
    this._theme = null;
    this._undo = null;
    this._applied = {target: null, key: null};
    this._quiet = false;
    this._committedKey = null;
  }

  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      value: {default: ''},
      hue: {default: ''},
      chroma: {default: ''},
      size: {default: '1', values: ['1/2', '1', '2']},
      swatches: {default: ''},
      apply: {type: Boolean, default: false},
      target: {default: ''},
      selector: {default: ':root'},
      rootClass: {default: ''},
    };
  }

  // The main colour, #rrggbb, or '' while the Framework's own one applies.
  get value() {
    return normaliseColor(this.getAttribute('value'));
  }

  set value(next) {
    const value = normaliseColor(next);
    if (value) this.setAttribute('value', value);
    else this.removeAttribute('value');
  }

  // The colour the theme is made from.
  get color() {
    return this.value || DEFAULT_THEME_COLOR;
  }

  get hue() {
    return readNumber(this.getAttribute('hue'), LIMITS.hue, true) ?? colorToHct(this.color).hue;
  }

  get chroma() {
    return readNumber(this.getAttribute('chroma'), LIMITS.chroma, true) ?? colorToHct(this.color).chroma;
  }

  get size() {
    const value = this.getAttribute('size');
    return SIZES.includes(value) ? value : '1';
  }

  get selector() {
    return this.getAttribute('selector') || ':root';
  }

  get swatches() {
    return this.getAttribute('swatches') || '';
  }

  /** The theme shown now (a copy: changing it changes nothing). */
  get theme() {
    return copy(this._currentTheme());
  }

  /** The theme as one stylesheet rule of its 128 primitives. */
  toCSS(selector = this.selector) {
    return themeToCss(this._currentTheme(), selector || ':root');
  }

  /** The theme object (simai.framework.theme.v1). */
  toJSON() {
    return copy(this._currentTheme());
  }

  /** Back to the Framework's own colour; a committed choice. */
  reset() {
    this._batch(() => {
      this.removeAttribute('value');
      this.removeAttribute('hue');
      this.removeAttribute('chroma');
    });
    this._emitChange();
    this._commit(true);
  }

  _key() {
    const tuned = (name) => readNumber(this.getAttribute(name), LIMITS[name], true) ?? '';
    return `${this.color}|${tuned('hue')}|${tuned('chroma')}`;
  }

  // A hue or chroma set on the element is the generator's own input and wins
  // over the colour's reading; without them the colour is read as
  // themeFromColor reads it. The two give the same palettes for the same
  // numbers, so a host that stores all three gets back what it stored.
  _currentTheme() {
    const key = this._key();
    if (key !== this._themeKey) {
      const tuned = this.hasAttribute('hue') || this.hasAttribute('chroma');
      this._theme = tuned ? themeFromHct({hue: this.hue, chroma: this.chroma}) : themeFromColor(this.color);
      this._themeKey = key;
    }
    return this._theme;
  }

  _detail() {
    const theme = this._currentTheme();
    return {
      value: this.value,
      hue: this.hue,
      chroma: this.chroma,
      theme: copy(theme),
      variables: themeVariables(theme),
      css: themeToCss(theme, this.selector),
    };
  }

  _emitChange() {
    // sf-theme-generator-change, and its first name sf-theme-change, which the
    // Loader's own light/dark event also bears (journal
    // event-theme-generator-names, until 2026-12-01).
    const detail = this._detail();
    this.emitComponentEvent('theme-generator-change', detail);
    this.emitComponentEvent('theme-change', detail);
  }

  // Committed once per distinct theme: Enter and the field's own change that
  // follows it are one commit, not two.
  _commit(force = false) {
    const key = this._key();
    if (!force && key === this._committedKey) return;
    this._committedKey = key;
    const detail = this._detail();
    this.emitComponentEvent('theme-generator-apply', detail);
    this.emitComponentEvent('theme-apply', detail);
  }

  // Several attributes as one change: the page is re-themed once.
  _batch(write) {
    this._quiet = true;
    try {
      write();
    } finally {
      this._quiet = false;
    }
    this._sync();
    this.requestComponentUpdate('theme');
  }

  _target() {
    if (!this.hasAttribute('apply') || this.getAttribute('apply') === 'false') return null;
    const selector = this.getAttribute('target');
    if (!selector) return document.documentElement;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  // With `apply`, the theme is on the target, and only the latest one: the
  // previous application is taken off first, so the target's own inline
  // values come back rather than a theme from two choices ago.
  _sync() {
    if (!this.isConnected) return;
    const target = this._target();
    const key = target ? this._key() : null;
    if (target === this._applied.target && key === this._applied.key) return;
    this._unapply();
    if (target) this._undo = applyTheme(this._currentTheme(), target);
    this._applied = {target, key};
  }

  _unapply() {
    this._undo?.();
    this._undo = null;
    this._applied = {target: null, key: null};
  }

  attributeChangedCallback(name, previous, next) {
    super.attributeChangedCallback?.(name, previous, next);
    if (previous !== next && !this._quiet) this._sync();
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._committedKey = this._key();
    this._sync();
  }

  disconnectedCallback() {
    this._unapply();
    super.disconnectedCallback?.();
  }

  // The colour control: its input moves the choice, its change commits it.
  // Its own events stop here; the generator's are the ones a host hears.
  _colorInput(event) {
    event.stopPropagation();
    const value = normaliseColor(event.detail?.value ?? event.target?.value);
    if (!value) return;
    const moved = value !== this.value || this.hasAttribute('hue') || this.hasAttribute('chroma');
    if (moved) {
      this._batch(() => {
        this.setAttribute('value', value);
        this.removeAttribute('hue');
        this.removeAttribute('chroma');
      });
      this._emitChange();
    }
  }

  _colorChange(event) {
    this._colorInput(event);
    this._commit();
  }

  _fieldInput(name, event) {
    event.stopPropagation();
    const number = readNumber(event.target?.value, LIMITS[name]);
    if (number === null || String(number) === this.getAttribute(name)) return;
    this._batch(() => this.setAttribute(name, String(number)));
    this._emitChange();
  }

  _fieldCommit(name, field) {
    const number = readNumber(field?.value, LIMITS[name], true);
    if (number !== null && String(number) !== this.getAttribute(name)) {
      this._batch(() => this.setAttribute(name, String(number)));
      this._emitChange();
    }
    // What the field shows is what the theme uses: «400» reads 360, and an
    // empty field shows the number it stands for again.
    if (field && String(field.value) !== String(this[name])) field.value = String(this[name]);
    this._commit();
  }

  _fieldChange(name, event) {
    event.stopPropagation();
    this._fieldCommit(name, event.currentTarget);
  }

  _fieldKey(name, event) {
    if (event.key !== 'Enter') return;
    // Enter commits the theme; it does not also submit a settings form the
    // generator stands in.
    event.preventDefault();
    this._fieldCommit(name, event.currentTarget);
  }

  templateContext() {
    const text = (key) => pageText(THEME_TEXT, key, this, 'sf-theme-generator');
    const theme = this._currentTheme();
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: this.size,
      value: this.value,
      inheritedValue: DEFAULT_THEME_COLOR,
      hue: this.hue,
      chroma: this.chroma,
      swatches: this.swatches,
      text: {
        color: text('color'),
        inherited: text('inherited'),
        advanced: text('advanced'),
        hue: text('hue'),
        hueHint: text('hueHint'),
        chroma: text('chroma'),
        chromaHint: text('chromaHint'),
        reset: text('reset'),
        preview: text('preview'),
      },
      palettes: THEME_PALETTES.map((name) => ({
        name,
        label: text(name),
        swatches: PREVIEW_TONES.map((tone) => ({tone, hex: theme.palettes[name].tones[tone]})),
      })),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderThemeGeneratorTemplate(this.templateContext());
  }
}

SfThemeGenerator.define('sf-theme-generator');

export {SfThemeGenerator};
