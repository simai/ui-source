import { ComponentObserver } from '../../../core/js/ComponentObserver';
import iconButtonUtility from '../json/icon-button.utility.json';
import registerComponent from "../../register-helper";
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
    this.button.classList.add(
      'sf-icon-button',
      'sf-icon-button--icon',
      `sf-icon-button--size-${size}`,
      `sf-icon-button--${type}`,
      `sf-icon-button--${scheme}`,
    );
    // The readable names for the same steps: compact, comfortable, spacious.
    // `normal` is the default and needs no class. When both options are given,
    // `spacing` wins, as it does on the Smart element (control-spacing.js), so
    // one control never carries two different steps.
    const hasSpacing = ['normal', 'compact', 'comfortable', 'spacious'].includes(spacing);
    if (hasSpacing && spacing !== 'normal') {
      this.button.classList.add(`spacing-${spacing}`);
    } else if (!hasSpacing && tightness) {
      this.button.classList.add(`tightness-${tightness}`);
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
