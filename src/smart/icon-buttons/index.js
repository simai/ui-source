import SfBaseElement from '../../core/js/smart-base';
import { renderIconButtonTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { ANCHORED_BADGE_ATTRIBUTES, elementBadge, nameWithBadge } from '../helpers/anchored-badge';

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
    hostKeepsDataAttributes: true,
    storageKey: '__sfIconButtonForwardedDataAttributes',
    targetStorageKey: '__sfIconButtonAttributeKeys',
  });
}

const ICON_BUTTON_APPEARANCES = ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'];

class SfIconButton extends SfBaseElement {
  constructor() {
    super();
    this._attributeObserver = null;
  }

  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'icon', values: ['icon', 'close'], aliases: ['variant']},
      size: { default: '1' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: { default: 'default', aliases: ['type'] },
      scheme: { default: 'primary' },
      // What the control is about, in the shared status vocabulary. A scheme says
      // which colour family a control takes; a status says what it does, and the
      // only one a control paints today is the destructive error. The two cannot
      // both colour it, so a status wins where it is set.
      status: { default: '', values: ['', 'error'] },
      segment: {default: ''},
      icon: { default: 'add' },
      filled: {type: Boolean, default: false},
      spacing: {type: String, default: null},
      tightness: { default: '', values: ['', 'low', 'high', 'highest'] },
      radius: { default: '', values: ['', 'default', 'square', 'rounded'] },
      rootClass: { default: '' },
      loading: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      nativeType: { default: 'button' },
      ariaLabel: { default: '' },
      // A count or a dot on the button (simai/ui-source#12).
      badgeCount: { default: '' },
      badgeDot: { type: Boolean, default: false },
      badgeCap: { type: Number, default: 99 },
      badgeLabel: { default: '' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.variant still gets an answer.
  get variant() {
    return this.kind;
  }

  // A value outside the list draws the default button, as sf-button does; an
  // unknown appearance drew a button with no fill and no border.
  get appearance() {
    const value = this.getAttribute('appearance') || this.getAttribute('type') || 'default';
    return ICON_BUTTON_APPEARANCES.includes(value) ? value : 'default';
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.appearance;
  }

  get scheme() {
    return this.getAttribute('scheme') || 'primary';
  }

  get status() {
    return this.getAttribute('status') || '';
  }

  get icon() {
    return this.getAttribute('icon') || 'add';
  }

  get segment() {
    return this.getEnumAttr('segment', ['start', 'middle', 'end'], '');
  }

  get filled() {
    return this.getBooleanAttr('filled', false);
  }

  get tightness() {
    return resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}).tightness;
  }

  get spacing() {
    return resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}).spacing;
  }

  get radius() {
    return this.getEnumAttr('radius', ['default', 'square', 'rounded'], '');
  }

  get rootClass() {
    return this.getAttribute('root-class') || '';
  }

  get loading() {
    return this.getBooleanAttr('loading', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get nativeType() {
    return this.getAttribute('native-type') || 'button';
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
      variant: this.variant,
      ...resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}),
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
      if (this.ariaLabel) {
        button.setAttribute('aria-label', nameWithBadge(this.ariaLabel, elementBadge(this).phrase));
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
          hostKeepsDataAttributes: true,
          storageKey: '__sfIconButtonForwardedDataAttributes',
          targetStorageKey: '__sfIconButtonAttributeKeys',
        },
      )._forwardHostAttributeObserver;
    }
  }

  // The native button is what takes focus: the host lays out as
  // display:contents and takes none. host.focus() reaches it through this, so
  // the element a data-* selector finds -- the host, the only place that
  // attribute lives -- is also the element a product can focus. Larena's admin
  // menu focuses its magnifier this way, through
  // querySelector('[data-sf-admin-search-toggle]').
  focusDelegate() {
    return this.querySelector('.sf-icon-button');
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      variant: this.variant,
      appearance: this.appearance,
      type: this.type,
      scheme: this.scheme,
      status: this.status,
      icon: this.icon,
      segment: this.segment,
      filled: this.filled,
      tightness: this.tightness,
      spacing: this.spacing,
      radius: this.radius,
      rootClass: this.rootClass,
      loading: this.loading,
      disabled: this.disabled,
      nativeType: this.nativeType,
      ariaLabel: this.ariaLabel,
      badgeCount: this.getProp('badgeCount'),
      badgeDot: this.getProp('badgeDot'),
      badgeCap: this.getProp('badgeCap'),
      badgeLabel: this.getProp('badgeLabel'),
    };
  }

  setButtonAttributes(attributes = {}) {
    this.setState({ buttonAttributes: attributes });
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
