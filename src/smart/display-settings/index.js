// sf-display-settings: how a person wants this site shown (owner decision
// C196, 2026-11-15; research ui-control
// control/research/2026-11-15-accessibility-worldwide.md):
//
//   <sf-display-settings></sf-display-settings>
//   <sf-display-settings label="Версия для слабовидящих" show-font show-links></sf-display-settings>
//   <sf-display-settings layout="panel"></sf-display-settings>
//
// Text 100–200 %, a colour scheme, wider spacing, images in colour, grey or
// hidden with their text, motion stopped, «Обычная версия»; the author turns
// on the font and «Подчёркивать ссылки». The panel only writes the choice:
// core (core/js/display-settings.js, SF.displaySettings) keeps it in this
// browser and applies it on every page of the site as root attributes the
// core sheet reads. Nothing is sent, nothing claims conformance.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {
  DEFAULTS,
  SCHEMES,
  TEXT_SCALES,
  fromRoot,
  isDefault,
  normalize,
  readStored,
  writeSettings,
} from '../../core/js/display-settings.js';
import {renderDisplaySettingsTemplate} from './js/templates/default';
import manifest from './component.json';
import './scss/index.scss';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// The panel's ids, one per element on the page (stable across renders).
let sequence = 0;

const media = (query) => {
  try {
    return globalThis.matchMedia?.(query) ?? null;
  } catch {
    return null;
  }
};

/** The person's settings: what this browser keeps, else what the root shows. */
export function currentSettings() {
  return readStored() ?? fromRoot();
}

/** The next text step from `scale`, `direction` -1 or 1, held to 100–200. */
export function nextTextScale(scale, direction) {
  const at = Math.max(0, TEXT_SCALES.indexOf(Number(scale)));
  const next = Math.min(TEXT_SCALES.length - 1, Math.max(0, at + Math.sign(direction)));
  return TEXT_SCALES[next];
}

const DisplaySettingsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  actions: {
    reset() {
      const previous = currentSettings();
      if (isDefault(previous)) return 'unchanged';
      const settings = writeSettings(DEFAULTS);
      this.requestComponentUpdate('reset');
      this.sfEmit('change', {settings, previous, setting: 'reset'});
      return undefined;
    },
  },
});

class SfDisplaySettings extends DisplaySettingsElement {
  constructor() {
    super();
    this._uid = `sf-display-settings-${++sequence}`;
    this._redraw = () => this.requestComponentUpdate('display-settings');
    this._onKey = (event) => {
      if (event.key !== 'Escape' || this.layout === 'panel' || !this.open) return;
      event.stopPropagation();
      this.open = false;
      this.querySelector('.sf-display-settings__trigger')?.focus?.();
    };
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._forced = media('(forced-colors: active)');
    this._motion = media('(prefers-reduced-motion: reduce)');
    this._forced?.addEventListener?.('change', this._redraw);
    this._motion?.addEventListener?.('change', this._redraw);
    this.ownerDocument.addEventListener('sf-display-change', this._redraw);
    this.addEventListener('keydown', this._onKey);
  }

  disconnectedCallback() {
    this._forced?.removeEventListener?.('change', this._redraw);
    this._motion?.removeEventListener?.('change', this._redraw);
    this.ownerDocument.removeEventListener('sf-display-change', this._redraw);
    this.removeEventListener('keydown', this._onKey);
    super.disconnectedCallback?.();
  }

  // The value: the person's choice as core keeps it.
  get settings() {
    return currentSettings();
  }

  toggle(open = !this.open) {
    this.open = Boolean(open);
  }

  // One setting from a press; the root shows it, the browser keeps it.
  choose(setting, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, setting)) return;
    if (setting === 'scheme' && this.forcedColors) return;
    const previous = currentSettings();
    let next = value;
    if (setting === 'links') next = previous.links === 'underline' ? 'site' : 'underline';
    if (setting === 'textScale') next = Number(value);
    const settings = writeSettings(normalize({...previous, [setting]: next}));
    if (JSON.stringify(settings) === JSON.stringify(previous)) return;
    this.sfEmit('change', {settings, previous, setting});
  }

  stepText(direction) {
    this.choose('textScale', nextTextScale(currentSettings().textScale, direction));
  }

  get forcedColors() {
    return Boolean(this._forced?.matches);
  }

  templateContext() {
    const settings = currentSettings();
    const forced = this.forcedColors;
    const layout = this.layout === 'panel' ? 'panel' : 'disclosure';
    const shown = layout === 'panel' || Boolean(this.open);
    this.sfHostState('data-open', shown);
    this.sfHostState('data-forced-colors', forced);
    const word = (key, vars) => this.sfWord(key, vars ? {vars} : undefined);
    const id = (name) => `${this._uid}-${name}`;
    const options = (setting, values) => values.map(([value, key]) => ({value, text: word(key), pressed: settings[setting] === value}));
    const groups = [
      {
        id: 'textScale',
        labelId: id('text'),
        label: word('text-label'),
        value: word('text-value', {value: settings.textScale}),
        smaller: {mark: word('text-smaller-mark'), text: word('text-smaller')},
        larger: {mark: word('text-larger-mark'), text: word('text-larger')},
      },
      {
        id: 'scheme',
        labelId: id('colour'),
        noteId: id('colour-note'),
        label: word('colour-label'),
        disabled: forced,
        note: forced ? word('colour-system') : '',
        options: options('scheme', [['', 'scheme-site'], ...SCHEMES.map((name) => [name, `scheme-${name}`])]),
      },
      {
        id: 'textSpacing',
        labelId: id('spacing'),
        label: word('spacing-label'),
        options: options('textSpacing', [['normal', 'spacing-normal'], ['wide', 'spacing-wide']]),
      },
      {
        id: 'images',
        labelId: id('images'),
        label: word('images-label'),
        options: options('images', [['colour', 'images-colour'], ['grey', 'images-grey'], ['hide', 'images-hide']]),
      },
      {
        id: 'motion',
        labelId: id('motion'),
        noteId: id('motion-note'),
        label: word('motion-label'),
        note: this._motion?.matches ? word('motion-device') : '',
        options: options('motion', [['system', 'motion-system'], ['reduce', 'motion-reduce']]),
      },
    ];
    if (this.showFont) {
      groups.push({
        id: 'font',
        labelId: id('font'),
        label: word('font-label'),
        options: options('font', [['site', 'site-font'], ['sans', 'sans-font'], ['serif', 'serif-font']]),
      });
    }
    if (this.showLinks) {
      groups.push({
        id: 'links',
        labelId: id('links'),
        label: word('links-label'),
        options: [{value: 'underline', text: word('underline-links'), pressed: settings.links === 'underline'}],
      });
    }
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      layout,
      shown,
      label: this.label || word('label-text'),
      panelId: id('panel'),
      groups,
      words: {reset: word('reset-text')},
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderDisplaySettingsTemplate(this.templateContext());
  }
}

SfDisplaySettings.define('sf-display-settings');

export {SfDisplaySettings};
