import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderIconButtonTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { ANCHORED_BADGE_ATTRIBUTES, elementBadge, nameWithBadge } from '../helpers/anchored-badge';
import { cycleState, hasCycle, parseCycle, preloadSwitchIcons, pressCycle, themeCycleFollow, warnCycleToggle } from '../helpers/cycle';
import { noteDeprecated } from '../../core/js/deprecations';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const COMPONENT_ATTRIBUTES = new Set([
  'template',
  'kind',
  'variant',
  'size',
  'height',
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
  'pressed',
  'label-pressed',
  'cycle',
  'theme-cycle',
  'value',
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

// sf-button-icon from its component.json (standard simai.smart-component
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

// The looks C15 retired (docs review R033): surface is drawn as tonal with
// the on-surface scheme, secondary as on-surface-variant. surface changes two
// settings, which a value alias cannot do, so the component reads the word
// itself and notes the use (change journal value-icon-button-looks-c15).
const RETIRED_APPEARANCE = 'surface';

class SfIconButton extends IconButtonElement {
  // aria-label is the host's (§3.1), not a setting, so the manifest makes no
  // attribute of it; it is watched here, or a name changed after the first
  // drawing never reached the button (sf-language's «Язык: Русский» stayed
  // after a choice, 2026-11-06). updateDom patches it.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'aria-label'])];
  }

  constructor() {
    super();
    this._attributeObserver = null;
  }

  // appearance: the retired surface reads as tonal; link, the former name of
  // ghost, is mapped by the dated alias before it gets here.
  get retiredSurface() {
    return (this.getAttribute('appearance') ?? this.getAttribute('type')) === RETIRED_APPEARANCE;
  }

  get appearance() {
    if (this.retiredSurface) {
      noteDeprecated({component: 'sf-button-icon', tag: 'sf-button-icon', kind: 'value', attribute: 'appearance', from: 'surface', to: 'tonal', since: '2026-11-08', remove_after: '2027-01-01'});
      return 'tonal';
    }
    return super.appearance;
  }

  set appearance(value) {
    super.appearance = value;
  }

  // scheme: surface brings on-surface with it unless the page named a scheme.
  get scheme() {
    if (this.retiredSurface && !this.hasAttribute('scheme')) return 'on-surface';
    return super.scheme;
  }

  set scheme(value) {
    super.scheme = value;
  }

  // The cycle (D11d): null when the button is not one.
  cycleState() {
    if (!hasCycle(this)) return null;
    return cycleState(this, {
      base: this.getAttribute('aria-label') || '',
      words: (key, options) => this.sfWord(key, options),
    });
  }

  static get props() {
    return {
      ...super.props,
      // The attribute takes JSON or value::label::flags|…; the property a list.
      cycle: {type: Array, default: [], parser: parseCycle},
    };
  }

  // cycle is a list setting (§4.2) whose attribute keeps its JSON form: a
  // list set as a property stays the instance's own, as sf-segmented's items.
  get cycle() {
    return this.getProp('cycle');
  }

  set cycle(value) {
    Object.defineProperty(this, 'cycle', {configurable: true, enumerable: true, writable: true, value});
    this.requestComponentUpdate?.('cycle');
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get rootClass() {
    return this.getAttribute('root-class') || '';
  }

  // pressed is optional: absent, the button is not a toggle and says nothing;
  // present, aria-pressed and the selected look follow it.
  get pressed() {
    // A cycle is not a toggle: pressed is ignored beside it.
    if (hasCycle(this)) return undefined;
    return this.hasAttribute('pressed') ? super.pressed : undefined;
  }

  set pressed(value) {
    if (value === undefined || value === null) this.removeAttribute('pressed');
    else this.setAttribute('pressed', value ? '' : 'false');
  }

  templateContext() {
    const props = this.getPropsContext();
    const cycle = this.cycleState();
    if (cycle) warnCycleToggle(this, ['pressed', 'label-pressed']);
    const announce = Boolean(cycle && this.__sfCycleAnnounce);
    this.__sfCycleAnnounce = false;
    // The icons a press can show, asked for before the press (R074).
    preloadSwitchIcons(this, {icons: [this.getAttribute('icon')], filled: Boolean(this.filled)});

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
      pressed: cycle ? undefined : this.pressed,
      labelPressed: cycle ? '' : this.labelPressed,
      // The cycle's current item: its icon, its pressed look, its name and
      // the tooltip; the announcement after a press.
      // cycleView, not cycle: `cycle` is the setting (the list of items).
      cycleView: cycle ? {
        icon: cycle.item.icon,
        pressedLook: cycle.item.pressed,
        name: cycle.name,
        tooltip: cycle.tooltip,
        announcement: announce ? cycle.name : '',
      } : null,
      ...resolveControlSpacing({spacing: this.getAttribute('spacing')}),
      // The control height (1.8.0, decisions C27 and C35): the size's
      // tightness step; a value outside the list reads as default.
      height: this.height,
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
    // A cycle's name and icon come from its item: drawn, not patched.
    if (this.cycleState()) return 'lit';

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
      // While a toggle with label-pressed is on, its pressed name stands.
      const label = (this.pressed === true && this.labelPressed) || this.getAttribute('aria-label') || '';
      if (label) {
        button.setAttribute('aria-label', nameWithBadge(label, elementBadge(this).phrase));
      } else {
        button.removeAttribute('aria-label');
      }
    }

    if (changedAttributes.includes('icon')) {
      // The glyph is sf-icon's: its icon setting is changed, and it draws the
      // name and asks the Loader for it. Writing the glyph's text here took
      // lit's markers out of sf-icon's drawing and left its icon attribute on
      // the old name; moved afterwards (sf-drawer taking its column under
      // body), the icon drew again and threw "Cannot set properties of null
      // (setting 'data')".
      const iconElement = button.querySelector(':scope > sf-icon');
      if (iconElement) {
        iconElement.setAttribute('icon', this.icon);
      } else if (!this.loading) {
        return false;
      }
    }

    applyButtonAttributes(this, button);
    return true;
  }

  afterRender() {
    const button = this.querySelector('.sf-icon-button');
    applyButtonAttributes(this, button);
    // The cycle's tooltip names the current and the next value; it stands
    // over a title the page forwarded.
    const cycle = this.cycleState();
    if (button && cycle) button.setAttribute('title', cycle.tooltip);

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
  // from a querySelector() of sf-button-icon, or from closest() on a data-* match --
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
      height: this.height,
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

  onConnected() {
    if (!this._cyclePress) {
      // A person's press moves the cycle: the click of the native button.
      this._cyclePress = (event) => {
        const button = this.querySelector('.sf-icon-button');
        if (!button || !(event.target instanceof Node) || !button.contains(event.target) || button.disabled) return;
        pressCycle(this, this.cycleState());
      };
      this.addEventListener('click', this._cyclePress);
    }
    if (!this._cycleTheme) {
      // A theme cycle follows the theme wherever it was set.
      this._cycleTheme = () => themeCycleFollow(this);
      globalThis.addEventListener?.('sf-theme-change', this._cycleTheme);
    }
    super.onConnected?.();
  }

  onDisconnected() {
    if (this._cyclePress) {
      this.removeEventListener('click', this._cyclePress);
      this._cyclePress = null;
    }
    if (this._cycleTheme) {
      globalThis.removeEventListener?.('sf-theme-change', this._cycleTheme);
      this._cycleTheme = null;
    }
    this.disconnectForwardedHostAttributes();
    this._attributeObserver = null;
    super.onDisconnected?.();
  }
}

SfIconButton.define('sf-button-icon');
