import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderIconButtonTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { ANCHORED_BADGE_ATTRIBUTES, elementBadge, nameWithBadge } from '../helpers/anchored-badge';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const COMPONENT_ATTRIBUTES = new Set([
  'template',
  'kind',
  'variant',
  'size',
  'appearance',
  'type',
  'scheme',
  'status',
  'icon',
  'filled',
  'spacing',
  'tightness',
  'radius',
  'segment',
  'root-class',
  'loading',
  'disabled',
  'native-type',
  'button-attributes',
  'aria-label',
  ...ANCHORED_BADGE_ATTRIBUTES,
  'class',
  'style',
  'id',
  'slot',
]);

function applyButtonAttributes(host, button) {
  host?.forwardHostAttributes(button, {
    exclude: COMPONENT_ATTRIBUTES,
    transferDataAttributes: true,
    storageKey: '__sfIconButtonForwardedDataAttributes',
    targetStorageKey: '__sfIconButtonAttributeKeys',
  });
}

// sf-icon-button from its component.json (standard simai.smart-component
// 1.3.8 §3, §4): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. The legacy names type,
// variant and tightness, and tightness's words, are dated aliases
// (aliases.json, until 2026-12-01); a value outside a list reads as the
// default, as sf-button's does.
const IconButtonElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfIconButton extends IconButtonElement {
  constructor() {
    super();
    this._attributeObserver = null;
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get rootClass() {
    return this.getAttribute('root-class') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      // Resolved names the template reads (contracts/template-context.json):
      // the canonical axes under their legacy names too, never the dated
      // aliases themselves (reading them would note a use on every render).
      type: this.appearance,
      variant: this.kind,
      kind: this.kind,
      appearance: this.appearance,
      size: this.size,
      scheme: this.scheme,
      status: this.status,
      segment: this.segment,
      nativeType: this.nativeType,
      radius: this.radius,
      ariaLabel: this.getAttribute('aria-label') || '',
      ...resolveControlSpacing({spacing: this.getAttribute('spacing')}),
      badge: this.badgeState?.(),
      component: this,
    });
  }

  // The count or dot on the button and what it says (simai/ui-source#12).
  badgeState() {
    return elementBadge(this);
  }

  template() {
    return renderIconButtonTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    // loading is drawn by the template, not patched: it puts the spinner in
    // place of the icon (simai/ui-source#10).
    const directPatchAttributes = ['disabled', 'aria-label', 'icon'];

    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) => directPatchAttributes.includes(attr))
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom(changedAttributes = []) {
    const button = this.querySelector('.sf-icon-button');
    if (!button) return false;

    if (changedAttributes.includes('disabled')) {
      button.disabled = this.disabled || this.loading;
    }

    if (changedAttributes.includes('aria-label')) {
      const label = this.getAttribute('aria-label') || '';
      if (label) {
        button.setAttribute('aria-label', nameWithBadge(label, elementBadge(this).phrase));
      } else {
        button.removeAttribute('aria-label');
      }
    }

    if (changedAttributes.includes('icon')) {
      const iconNode = button.querySelector('.sf-icon');
      if (iconNode) {
        iconNode.textContent = this.icon;
      }
    }

    applyButtonAttributes(this, button);
    return true;
  }

  afterRender() {
    const button = this.querySelector('.sf-icon-button');
    applyButtonAttributes(this, button);

    if (!this._attributeObserver) {
      this._attributeObserver = this.observeForwardedHostAttributes(
        () => this.querySelector('.sf-icon-button'),
        {
          exclude: COMPONENT_ATTRIBUTES,
          transferDataAttributes: true,
          storageKey: '__sfIconButtonForwardedDataAttributes',
          targetStorageKey: '__sfIconButtonAttributeKeys',
        },
      )._forwardHostAttributeObserver;
    }
  }

  // The native button is what takes focus: the host lays out as
  // display:contents and takes none, so focus() on the host did nothing and
  // left document.activeElement where it was. A product that holds the host --
  // from querySelector('sf-icon-button'), or from closest('sf-icon-button') on a data-* match --
  // focuses it and reaches the control through this.
  focusDelegate() {
    return this.querySelector('.sf-icon-button');
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      variant: this.kind,
      appearance: this.appearance,
      type: this.appearance,
      scheme: this.scheme,
      status: this.status,
      icon: this.icon,
      segment: this.segment,
      filled: this.filled,
      tightness: resolveControlSpacing({spacing: this.getAttribute('spacing')}).tightness,
      spacing: this.spacing,
      radius: this.radius,
      rootClass: this.rootClass,
      loading: this.loading,
      disabled: this.disabled,
      nativeType: this.nativeType,
      ariaLabel: this.getAttribute('aria-label') || '',
      badgeCount: this.getProp('badgeCount'),
      badgeDot: this.getProp('badgeDot'),
      badgeCap: this.getProp('badgeCap'),
      badgeLabel: this.getProp('badgeLabel'),
    };
  }

  // button-attributes is a writable object setting (component.json); this
  // helper writes it for an external project template, which reads it from
  // the props context. It is not an action (§4.4).
  setButtonAttributes(attributes = {}) {
    this.buttonAttributes = attributes;
    return this;
  }

  onClick(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('click', handler, options);
    }
    return this;
  }

  onFocus(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusin', handler, options);
    }
    return this;
  }

  onBlur(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusout', handler, options);
    }
    return this;
  }

  onMouseEnter(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('mouseenter', handler, options);
    }
    return this;
  }

  onMouseLeave(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('mouseleave', handler, options);
    }
    return this;
  }

  setDisabled(nextValue = true) {
    if (nextValue) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }

    return this;
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }

  onDisconnected() {
    this.disconnectForwardedHostAttributes();
    this._attributeObserver = null;
    super.onDisconnected?.();
  }
}

SfIconButton.define('sf-icon-button');
