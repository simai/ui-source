import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderButtonGroupTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { bindFormReset } from '../../component/form-reset-helper';
import { FormField } from '../helpers/form-field';
import { preloadControlIcons } from '../helpers/cycle';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// The theme switch's own words -- the three Loader preferences, and the
// group's name when the page gives none -- are lang/<locale>.json runtime.
const THEME_PREFERENCES = ['system', 'light', 'dark'];
// The system item is a monitor, desktop_windows (owner decision D11c, docs
// review R037): brightness_auto is automatic screen brightness on Android.
const THEME_ICONS = { system: 'desktop_windows', light: 'light_mode', dark: 'dark_mode' };

// The Loader's theme preference: what the person chose, not the theme drawn,
// so system stays selected while the system is dark.
function themePreference() {
  const preference = globalThis.SF?.Loader?.themePreference;
  return THEME_PREFERENCES.includes(preference) ? preference : 'system';
}

function parseItems(value = []) {
  if (Array.isArray(value)) return value;

  const source = String(value || '').trim();
  if (!source) return [];

  if (source.startsWith('[')) {
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return source.split('|').map((entry) => {
    const [valuePart, labelPart, flagsPart = ''] = entry.split('::');
    const flags = flagsPart.split(',').map((flag) => flag.trim()).filter(Boolean);
    const iconFlag = flags.find((flag) => flag.startsWith('icon='));

    return {
      value: valuePart.trim(),
      label: (labelPart || valuePart).trim(),
      disabled: flags.includes('disabled'),
      loading: flags.includes('loading'),
      icon: iconFlag ? iconFlag.slice('icon='.length) : '',
    };
  });
}

function normalizeItems(items = []) {
  const seen = new Set();

  return parseItems(items)
    .map((item, index) => {
      const source = typeof item === 'string' ? { value: item, label: item } : item;
      if (!source || typeof source !== 'object') return null;

      const value = String(source.value ?? source.id ?? index).trim();
      if (!value || seen.has(value)) return null;
      seen.add(value);

      return {
        id: String(source.id || value),
        value,
        label: String(source.label ?? source.text ?? value),
        icon: String(source.icon || ''),
        ariaLabel: String(source.ariaLabel || source['aria-label'] || ''),
        // The language the label is written in (a language picker names each
        // language in itself): the segment carries it as lang.
        lang: String(source.lang || '').trim(),
        // A number shown after the label in the segmented appearance; 0 is a
        // count, an absent or empty one is not.
        count: source.count === null || typeof source.count === 'undefined' ? '' : String(source.count).trim(),
        // Only an icon can stand alone; the label stays as the accessible name.
        iconOnly: Boolean((source.iconOnly ?? source['icon-only']) && source.icon),
        // A loading item shows the spinner and is disabled while it works, as
        // a loading button is (simai/ui-source#10).
        loading: Boolean(source.loading),
        disabled: Boolean(source.disabled || source.loading),
      };
    })
    .filter(Boolean);
}

// sf-segmented from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §4.4, §8, §16.20, §17.1): the settings are attributes and
// properties made by core/js/element-manifest.js, select and clear are its
// actions and answer an outcome, change is sent once through sfEmit (the shim
// sends sf-button-group-change after it), and the host is the form control
// through ElementInternals.
const ButtonGroupElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
  actions: {
    select({ value: nextValue } = {}) {
      const value = String(nextValue ?? '');
      const item = this.normalizedItems.find((candidate) => candidate.value === value);
      if (!item) return 'unknown';
      if (item.disabled || this.disabled) return 'disabled';
      if (value === this.value) return 'unchanged';
      const previous = this.value;
      // A theme switch sets the Loader's preference first, so a listener of
      // change already finds the page in the theme it chose; a Loader that
      // cannot change the theme (absent, or SF_BOOT_CONFIG.theme false)
      // selects nothing.
      if (this.themeSwitch && globalThis.SF?.Loader?.setTheme?.(value) !== true) return 'theme';
      this.value = value;
      this.emitValueChange({ previous, value, item });
      return 'applied';
    },
    clear() {
      // A theme preference is never empty.
      if (this.themeSwitch) return 'theme';
      if (this.disabled) return 'disabled';
      if (!this.value) return 'unchanged';
      const previous = this.value;
      this.value = '';
      this.emitValueChange({ previous, value: '', item: null });
      return 'applied';
    },
  },
});

class SfButtonGroup extends FormField(ButtonGroupElement) {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // The attribute takes JSON or value::label::flags|...; the property a list.
      items: { type: Array, default: [], parser: parseItems },
      // No default: control-spacing reads the attribute and tightness.
      spacing: {type: String, default: null},
      ariaLabel: { attribute: 'aria-label', default: '' },
      rootClass: { attribute: 'root-class', default: '' },
    };
  }

  constructor() {
    super();
    this.addEventListener('click', this.handleClick);
    this.addEventListener('keydown', this.handleKeyDown);
    this.addEventListener('sf-after-render', (event) => {
      // A nested Smart button may finish after its parent or render again later.
      if (event.target !== this && event.target.parentElement === this.querySelector('.sf-button-group')) {
        this.syncButtonSemantics();
      }
    });
  }

  get themeItems() {
    return THEME_PREFERENCES.map((value) => ({
      value,
      label: this.sfWord(value),
      icon: THEME_ICONS[value],
      iconOnly: true,
    }));
  }

  // items is a list setting (§4.2) whose attribute keeps its JSON and
  // value::label::flags forms: read through the prop's parser, and a list set
  // as a property stays the instance's own, as it was before the manifest.
  get items() {
    return this.getProp('items');
  }

  set items(value) {
    Object.defineProperty(this, 'items', {configurable: true, enumerable: true, writable: true, value});
    this.requestComponentUpdate?.('items');
  }

  get normalizedItems() {
    const items = normalizeItems(this.themeSwitch ? this.themeItems : this.getProp('items'));
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);

    return items.map((item, index) => ({
      ...item,
      firstEnabled: index === firstEnabledIndex,
    }));
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(nextValue) {
    if (nextValue === null || typeof nextValue === 'undefined' || nextValue === '') {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', String(nextValue));
    }
    this.sfSyncFormState();
  }

  // What the form gets (§17.1): the selected value, nothing while disabled.
  sfFormValue() {
    if (this.disabled) return null;
    return this.value;
  }

  // form.reset(): the value the group was written with, without events; a
  // theme switch keeps the preference (§17.1 item 4).
  fieldReset() {
    if (this.themeSwitch) return;
    this.value = this._resetValue;
  }

  connectedCallback() {
    // A printed JSON island first (standard 1.3.8 §5.4): what is read below may be in it.
    this.sfReadIsland();
    // The value a form reset returns to: the one the group was written with.
    if (!Object.prototype.hasOwnProperty.call(this, '_resetValue')) this._resetValue = this.value;
    super.connectedCallback();
  }

  onConnected() {
    window.addEventListener('sf-theme-change', this.handleThemeChange);
    this.syncThemePreference();
  }

  onDisconnected() {
    window.removeEventListener('sf-theme-change', this.handleThemeChange);
    this._plateObserver?.disconnect();
    this._plateObserver = null;
    this._plateFor = null;
    clearTimeout(this._plateTimer);
    this._releaseReset?.();
    this._releaseReset = null;
    this._resetInput = null;
    super.onDisconnected();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'theme-switch' && oldValue !== newValue && this._isMounted) this.syncThemePreference();
  }

  // A theme switch shows the preference wherever it was set: here, another
  // switch, a Theme component button or SF.Loader.setTheme itself.
  syncThemePreference() {
    if (!this.themeSwitch) return;
    const preference = themePreference();
    if (this.value !== preference) this.value = preference;
  }

  handleThemeChange = () => this.syncThemePreference();

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      ariaLabel: this.getAttribute('aria-label') || (this.themeSwitch ? this.sfWord('group') : ''),
      ...resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}),
      component: this,
      // The entries drawn: normalised, numbered and flagged; items stays the
      // setting as given (the template-context probe compares the two).
      entries: this.normalizedItems,
      value: this.value,
      disabled: this.disabled,
      // The host is the form control where the browser has ElementInternals;
      // the hidden input is drawn only without them (§17.1 item 6).
      hiddenName: this.sfInternals ? '' : this.name,
    });
  }

  template() {
    const context = this.templateContext();
    // Every item's icon, asked for when the group is drawn, as a cycle's are
    // (R074): a segment drawn later (out of loading, items set afresh) finds
    // its glyph in the page's font instead of asking for a grown one.
    preloadControlIcons(this, context.entries.filter((item) => item.icon).map((item) => ({icon: item.icon, filled: false})));
    return renderButtonGroupTemplate(context);
  }

  // Every form value control reports a committed change as `change` on its
  // host, once, under its native name and without the element in its detail
  // (§8, §17.3); the shim sends the legacy sf-button-group-change after it with
  // the same detail (aliases.json).
  emitValueChange(detail) {
    this.sfEmit('change', detail);
  }

  afterRender() {
    this.syncButtonSemantics();
    this.bindReset();
    this.sfSyncFormState();
    this.placePlate();
  }

  // The plate of the track (1.4.0, owner decision D11c): one element under
  // the selected option, measured after each render and moved there. A new
  // choice slides it in 0.2 s (data-plate="moving" turns the transition on;
  // the sheet takes it off under prefers-reduced-motion); a resize, a font
  // that arrives or the first placement move it at once. Without a selected,
  // enabled option the option paints itself (data-plate is removed), as it
  // does in the printed first paint.
  placePlate() {
    const root = this.querySelector(':scope > .sf-button-group');
    const plate = root?.querySelector(':scope > .sf-button-group-plate');
    if (!root || !plate) {
      this._plateObserver?.disconnect();
      this._plateObserver = null;
      this._plateFor = null;
      return;
    }
    const active = root.querySelector(':scope > .sf-button-group-segment.active');
    if (!active || active.disabled) {
      root.removeAttribute('data-plate');
      this._plateFor = null;
      return;
    }
    const moving = Boolean(this._plateFor && this._plateFor !== active && this._plateRoot === root && root.hasAttribute('data-plate'));
    this.measurePlate(root, plate, active, moving);
    this._plateFor = active;
    this._plateRoot = root;
    if (typeof ResizeObserver === 'undefined') return;
    if (!this._plateObserver) {
      this._plateObserver = new ResizeObserver(() => {
        const current = this._plateFor;
        if (current?.isConnected && this._plateRoot?.isConnected) {
          this.measurePlate(this._plateRoot, this._plateRoot.querySelector(':scope > .sf-button-group-plate'), current, false);
        }
      });
    }
    this._plateObserver.disconnect();
    this._plateObserver.observe(root);
    this._plateObserver.observe(active);
  }

  measurePlate(root, plate, active, moving) {
    if (!plate) return;
    const box = root.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // From the track's padding edge at its inline start, with the scroll: a
    // right-to-left track starts at its right edge.
    const rtl = getComputedStyle(root).direction === 'rtl';
    const x = rtl
      ? rect.right - (box.right - (parseFloat(getComputedStyle(root).borderRightWidth) || 0)) + root.scrollLeft
      : rect.left - box.left - root.clientLeft + root.scrollLeft;
    const y = rect.top - box.top - root.clientTop + root.scrollTop;
    // A render that follows the choice (the value echoed back, a form sync)
    // measures again while the plate slides: it keeps the slide and its timer.
    const sliding = !moving && root.getAttribute('data-plate') === 'moving';
    if (!sliding) {
      clearTimeout(this._plateTimer);
      root.setAttribute('data-plate', moving ? 'moving' : 'placed');
    }
    plate.style.setProperty('--sf-button-group--plate-x', `${x}px`);
    plate.style.setProperty('--sf-button-group--plate-y', `${y}px`);
    plate.style.setProperty('--sf-button-group--plate-inline-size', `${rect.width}px`);
    plate.style.setProperty('--sf-button-group--plate-block-size', `${rect.height}px`);
    if (moving) {
      this._plateTimer = setTimeout(() => {
        if (root.getAttribute('data-plate') === 'moving') root.setAttribute('data-plate', 'placed');
      }, 260);
    }
  }

  // Without ElementInternals the hidden input carries the name and value (and
  // is disabled with the group), and a form reset brings back the value the
  // group was written with.
  bindReset() {
    const input = this.querySelector(':scope > .sf-button-group-input');
    if (this._resetInput === input) return;
    this._releaseReset?.();
    this._resetInput = input;
    this._releaseReset = input ? bindFormReset(input, () => {
      if (this.themeSwitch) return;
      this.value = this._resetValue;
    }) : null;
  }

  syncButtonSemantics() {
    const root = this.querySelector('.sf-button-group');
    if (!root) return;
    const items = this.normalizedItems;
    const available = this.disabled ? [] : items.filter(item => !item.disabled);
    const tabStop = available.find(item => item.value === this.value) || available[0];
    // A segmented group draws native buttons; the default one draws Smart buttons.
    root.querySelectorAll(':scope > sf-button, :scope > button').forEach((host, index) => {
      const button = host.matches('button') ? host : host.querySelector('button'), item = items[index];
      if (!button || !item) return;
      const selected = item.value === this.value;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.tabIndex = item === tabStop ? 0 : -1;
    });
  }

  focus(options) {
    const button = this.querySelector('button[role="radio"][tabindex="0"]:not(:disabled)');
    button?.focus?.(options);

    return this;
  }

  handleClick = (event) => {
    const target = event.target?.closest?.('[data-sf-button-group-value]');
    if (!target || !this.contains(target)) return;
    this.select(target.getAttribute('data-sf-button-group-value'));
  };

  handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;

    const enabled = this.normalizedItems.filter((item) => !item.disabled);
    if (!enabled.length || this.disabled) return;

    const currentIndex = Math.max(0, enabled.findIndex((item) => item.value === this.value));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabled.length - 1
          : ['ArrowLeft', 'ArrowUp'].includes(event.key)
            ? (currentIndex - 1 + enabled.length) % enabled.length
            : (currentIndex + 1) % enabled.length;

    event.preventDefault();
    const previous = this.value;
    this.select(enabled[nextIndex].value);

    if (this.value !== previous) {
      this.addEventListener('sf-after-render', () => this.focus(), { once: true });
    }
  };
}

SfButtonGroup.define('sf-segmented');

export { normalizeItems, parseItems };
