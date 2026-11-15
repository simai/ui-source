import { ComponentObserver } from '../../../core/js/ComponentObserver';
import iconButtonUtility from '../json/icon-button.utility.json';
import registerComponent from "../../register-helper";
import { watchButtons, ICON_BUTTON_CLASS_ALIASES } from '../../buttons/js/button-checks.js';
import { noteDeprecated } from '../../../core/js/deprecations.js';
import { createInlineSpinner } from '../../spinner/js/_spinner-draw';

class IconButtons extends ComponentObserver {
  static componentName = 'IconButtons';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1',
      type = 'default',
      scheme = 'primary',
      icon,
      tightness,
      spacing,
      height,
      radius,
      loading = false,
      disabled = false,
      utilities = {},
    } = this.params || {};
    const className = this.attrs.class || this.attrs.className;

    this.button = document.createElement('button');
    if (this.id) {
      this.button.id = this.id;
    }
    // The looks are default, tonal, outline and ghost (1.14.0, RG-IB-2): the
    // former `surface` and `link` draw as tonal and ghost until 2027-01-01,
    // so the constructor writes the new class and notes the old value.
    const formerClass = ICON_BUTTON_CLASS_ALIASES[`sf-icon-button--${type}`];
    if (formerClass) {
      noteDeprecated({component: 'icon-buttons', kind: 'value', attribute: 'type', from: type, to: formerClass.replace('sf-icon-button--', ''), since: '2026-11-16', remove_after: '2027-01-01'});
    }
    this.button.classList.add(
      'sf-icon-button',
      'sf-icon-button--icon',
      `sf-icon-button--size-${size}`,
      formerClass || `sf-icon-button--${type}`,
      `sf-icon-button--${scheme}`,
    );
    // An icon button has no density (1.14.0, owner decision C213): size and
    // height change it and keep it square. `spacing` and `tightness` draw
    // nothing and are noted until 2027-01-01.
    for (const [attribute, value] of [['spacing', spacing], ['tightness', tightness]]) {
      if (value && value !== 'normal') {
        noteDeprecated({component: 'icon-buttons', kind: 'value', attribute, from: String(value), to: null, since: '2026-11-16', remove_after: '2027-01-01'});
      }
    }
    // The control height (1.5.0, decisions C27 and C35): the size's
    // tightness step on all four sides; default needs no class.
    if (['low', 'high', 'highest'].includes(height)) {
      this.button.classList.add(`sf-icon-button--height-${height}`);
    }
    if (radius) {
      this.button.classList.add(`radius-${radius}`);
    }
    if (loading) {
      this.button.classList.add('loading', 'sf-icon-button-state-loading');
      this.button.setAttribute('aria-busy', 'true');
      this.button.disabled = true;
    }
    if (disabled) {
      this.button.disabled = true;
      // Loading keeps the scheme colour (C36 follow-up); disabled and loading
      // wears the disabled look.
      if (loading) this.button.classList.add('disabled');
    }
    if (className) {
      this.button.classList.add(...`${className}`.split(' ').filter(Boolean));
    }
    Object.entries(this.attrs)
      .filter(([attr]) => !['class', 'className'].includes(attr))
      .forEach(([attr, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        this.button.setAttribute(attr, value);
      });

    // Avoid implicit form submission unless the caller explicitly chooses it.
    if (!this.button.hasAttribute('type')) {
      this.button.setAttribute('type', 'button');
    }

    this.iconElement = this.createIcon(icon);

    this.applyLayoutUtilities(this.button, '.sf-icon-button');
    this.applyLayoutUtilities(this.iconElement, '.sf-icon-button .sf-icon');

    this.applyUtilities(this.button, utilities.button ?? utilities);
    this.applyUtilities(this.iconElement, utilities.icon);

    // Loading shows the spinner in place of the icon, at the icon's size
    // (simai/ui-source#10).
    if (loading) {
      this.spinner = createInlineSpinner({ className: 'sf-icon-button-spinner' });
      this.button.append(this.spinner);
    } else if (this.iconElement) {
      this.button.append(this.iconElement);
    }

    this.template = this.button;
  }

  createIcon(name) {
    if (!name) {
      return null;
    }
    const icon = document.createElement('i');
    icon.classList.add('sf-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = name;
    return icon;
  }

  applyUtilities(target, utilities) {
    if (!target || !utilities) {
      return;
    }
    const normalize = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(' ');
      if (Array.isArray(value?.classes)) return value.classes;
      if (typeof value?.classes === 'string') return value.classes.split(' ');
      if (Array.isArray(value?.button)) return value.button;
      if (typeof value?.button === 'string') return value.button.split(' ');
      return [];
    };
    normalize(utilities)
      .filter(Boolean)
      .forEach((cls) => target.classList.add(cls));
  }
}

IconButtons.utilityMap = iconButtonUtility;

registerComponent('IconButtons', IconButtons);

// The pressed look on a toggle only, a square icon-only button with a name,
// the set's former classes (C116, C211): said once in the console.
watchButtons();
