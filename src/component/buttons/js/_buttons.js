import { ComponentObserver } from '../../../core/js/ComponentObserver';
import buttonUtility from '../json/button.utility.json';
import registerComponent from "../../register-helper";

class Buttons extends ComponentObserver {
  static componentName = 'Buttons';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1',
      type = 'default',
      scheme = 'primary',
      text = '',
      icon,
      iconLeft,
      iconRight,
      iconPosition = 'start',
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
      'sf-button',
      `sf-button--size-${size}`,
      `sf-button--${type}`,
      `sf-button--${scheme}`,
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
      this.button.classList.add('loading', 'sf-button-state-loading');
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

    // Avoid implicit "submit" behavior inside forms unless explicitly overridden.
    if (!this.button.hasAttribute('type')) {
      this.button.setAttribute('type', 'button');
    }

    const normalizedIconPosition = `${iconPosition}`.toLowerCase();
    const isIconEnd = ['right', 'end'].includes(normalizedIconPosition);

    const leftIconName =
      iconLeft ?? (icon && !isIconEnd ? icon : null);
    const rightIconName =
      iconRight ?? (icon && isIconEnd ? icon : null);

    this.iconLeft = this.createIcon(leftIconName);
    this.iconRight = this.createIcon(rightIconName);

    this.textContainer = document.createElement('span');
    this.textContainer.classList.add('sf-button-text-container');
    this.textElement = document.createElement('span');
    this.textElement.classList.add('sf-button-text');
    this.textContainer.textContent = text;

    this.applyLayoutUtilities(this.button, '.sf-button');
    this.applyLayoutUtilities(this.iconLeft, '.sf-button .sf-icon');
    this.applyLayoutUtilities(this.iconRight, '.sf-button .sf-icon');
    this.applyLayoutUtilities(this.textContainer, '.sf-button .sf-button-text-container');

    this.applyUtilities(this.button, utilities.button ?? utilities);
    this.applyUtilities(this.iconLeft, utilities.icon);
    this.applyUtilities(this.iconRight, utilities.icon);
    this.applyUtilities(this.textContainer, utilities.textContainer);


    if (this.iconLeft) {
      this.button.append(this.iconLeft);
    }
    this.button.append(this.textContainer);
    if (this.iconRight) {
      this.button.append(this.iconRight);
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

Buttons.utilityMap = buttonUtility;

registerComponent('Buttons', Buttons);
