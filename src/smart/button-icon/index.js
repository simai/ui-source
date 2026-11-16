import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderIconButtonTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { ANCHORED_BADGE_ATTRIBUTES, elementBadge, nameWithBadge } from '../helpers/anchored-badge';
import { cycleState, hasCycle, parseCycle, preloadSwitchIcons, pressCycle, themeCycleFollow, warnCycleToggle } from '../helpers/cycle';
import { noteDeprecated } from '../../core/js/deprecations';
import { warnUnknownControlStatus } from '../helpers/control-status';
import { dangerLook, sayButtonSetFormers } from '../helpers/button-set';
import manifest from './component.json';
import aliases from './aliases.json';
import enFile from './lang/en.json';
import ruFile from './lang/ru.json';
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};

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
  'href',
  'target',
  'rel',
  'download',
  'pressed',
  'label-pressed',
  'tooltip',
  // The host's title is the name tooltip's text (C160 (1)), not forwarded.
  'title',
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

// href (1.9.0) takes sf-button's addresses: a relative one, a fragment,
// http(s), mailto and tel. Any other scheme (javascript:, data:) draws the
// icon button as a button.
const SAFE_HREF = /^(?:[^:/?#]*(?:[/?#]|$)|https?:|mailto:|tel:)/iu;
function linkAddress(value) {
  const href = String(value || '').trim();
  return href && SAFE_HREF.test(href) ? href : '';
}

// A link that opens a new tab says noopener noreferrer unless the page wrote
// its own rel, as sf-button's.
function linkRelation(target, rel) {
  const own = String(rel || '').trim();
  if (own) return own;
  return String(target || '').trim().toLowerCase() === '_blank' ? 'noopener noreferrer' : '';
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

// The name tooltip (owner decision C160 (1)): the icon button shows its name
// as the Framework's tooltip by itself. The surface is the tooltip
// composition (a .sf-tooltip the button names by data-tooltip), linked by the
// tooltip controller (component.tooltip); it is made on the first hover,
// keyboard focus or long press, so nothing is drawn or fetched before -- the
// first-paint markup is unchanged -- and the event that woke it is handed to
// the controller once it has linked the button.
const NAME_TIP = 'sf-icon-button-tooltip';
let nameTips = 0;

function tooltipController() {
  return globalThis.SF?.ComponentRegistry?.Tooltip || globalThis.SF?.Loader?.ComponentRegistry?.Tooltip || null;
}

// The controller is there: run now; else ask the Loader for it (a lazy
// relation) and run once it registered.
function whenTooltipReady(run) {
  if (tooltipController()) {
    run();
    return;
  }
  const loader = globalThis.SF?.Loader;
  loader?.ensurePlugin?.('tooltip');
  if (typeof loader?.ready === 'function') loader.ready('Tooltip', () => run());
  else globalThis.addEventListener?.('Tooltip:ready', () => run(), {once: true});
}

// The looks C15 retired (docs review R033): surface is drawn as tonal with
// the on-surface scheme, secondary as on-surface-variant. surface changes two
// settings, which a value alias cannot do, so the component reads the word
// itself and notes the use (change journal value-icon-button-looks-c15).
const RETIRED_APPEARANCE = 'surface';

// Density on an icon button (owner decision C213, 2026-11-16): size and
// height change it and keep it square, so spacing and tightness draw nothing.
// Read until 2027-01-01, noted in SF.deprecations and said once per button.
function noteIconButtonDensity(element) {
  const said = [['spacing', element.getAttribute('spacing')], ['tightness', element.getAttribute('tightness')]]
    .filter(([, value]) => value && value !== 'normal');
  if (!said.length) return;
  for (const [attribute, from] of said) {
    noteDeprecated({component: 'sf-button-icon', tag: 'sf-button-icon', kind: 'setting', attribute, from: attribute, to: null, since: '2026-11-16', remove_after: '2027-01-01'});
  }
  if (element.__sfDensitySaid) return;
  element.__sfDensitySaid = true;
  globalThis.console?.warn?.(`[SIMAI Framework] sf-button-icon: ${said.map(([a, v]) => `${a}="${v}"`).join(' ')} draws nothing: an icon button has no density (owner decision C213); size and height="low|high|highest" change it and keep it square. Remove it before 2027-01-01.`, element);
}

class SfIconButton extends IconButtonElement {
  // aria-label is the host's (§3.1), not a setting, so the manifest makes no
  // attribute of it; it is watched here, or a name changed after the first
  // drawing never reached the button (sf-language's «Язык: Русский» stayed
  // after a choice, 2026-11-06). updateDom patches it.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'aria-label', 'title'])];
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

  // A danger icon button is filled, outline or ghost (decision C116,
  // #q-danger-looks): tonal, and the retired surface, with status danger draw
  // as outline until 2027-01-01 (helpers/button-set.js, change journal
  // value-button-set-c116).
  get dangerFormer() {
    return dangerLook(this.getAttribute('appearance') ?? this.getAttribute('type'), this.getAttribute('status')).former;
  }

  get appearance() {
    if (this.dangerFormer) return 'outline';
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
    // success, warning, info: no such icon buttons (C13, BS-1); said once per page.
    warnUnknownControlStatus('sf-button-icon', this.getAttribute('status'));
    // An icon button has no density (owner decision C213): spacing (and its
    // former name tightness) draws nothing; noted, and said once per button.
    noteIconButtonDensity(this);
    // A danger tonal or surface (C116); said once per page.
    const dangerFormer = this.dangerFormer;
    if (dangerFormer) sayButtonSetFormers('sf-button-icon', [{attribute: 'appearance', from: dangerFormer, to: 'outline', danger: true, drawn: 'appearance="outline" status="danger" (a danger icon button is filled, outline or ghost)'}]);
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
      // href (1.9.0): a link with the icon button's look; null download is
      // none, '' the server's name.
      href: linkAddress(this.getAttribute('href')),
      linkTarget: this.getAttribute('target') || '',
      linkRel: linkRelation(this.getAttribute('target'), this.getAttribute('rel')),
      linkDownload: this.hasAttribute('download') ? this.getAttribute('download') : null,
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
    const directPatchAttributes = ['disabled', 'aria-label', 'icon', 'title', 'tooltip'];
    // A cycle's name and icon come from its item: drawn, not patched; a link
    // is drawn too (disabled takes its href away).
    if (this.cycleState() || this.hasAttribute('href')) return 'lit';

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
      // A loading one that is disabled as well wears the disabled look (C36
      // follow-up); the template writes the same class.
      if (this.loading) button.classList.toggle('disabled', Boolean(this.disabled));
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
    this.syncNameTooltip();
    return true;
  }

  // The name tooltip's text: the host's title when the page wrote one, a
  // cycle's current and next value, the pressed name of a toggle that is on,
  // else the name.
  nameTooltipText() {
    const title = (this.getAttribute('title') || '').trim();
    if (title) return title;
    const cycle = this.cycleState();
    if (cycle) return cycle.tooltip;
    return String((this.pressed === true && this.labelPressed) || this.getAttribute('aria-label') || '').trim();
  }

  // The button and whether the name tooltip is its: off, no text, or a
  // tooltip the page linked itself (data-tooltip naming another surface).
  nameTooltipTarget() {
    const button = this.querySelector('.sf-icon-button');
    if (!button || this.getAttribute('tooltip') === 'off' || !this.nameTooltipText()) return null;
    const linked = button.getAttribute('data-tooltip');
    if (linked && linked !== this._nameTip?.id) return null;
    return button;
  }

  // After every drawing: the title stands back, and a tooltip made already
  // keeps its text and its link to the button lit drew this time.
  syncNameTooltip() {
    const button = this.querySelector('.sf-icon-button');
    if (!button) return;
    const target = this.nameTooltipTarget();
    const tip = this._nameTip;
    if (!target) {
      button.removeAttribute('aria-description');
      if (tip) {
        if (button.getAttribute('data-tooltip') === tip.id) button.removeAttribute('data-tooltip');
        tip.remove();
        this._nameTip = null;
      }
      // Off: the host's title and a cycle's value stay the browser's title,
      // as before 1.11.0.
      const cycle = this.cycleState();
      const title = this.getAttribute('title');
      if (cycle) button.setAttribute('title', cycle.tooltip);
      else if (title !== null) button.setAttribute('title', title);
      else if (button.getAttribute('title') === '') button.removeAttribute('title');
      return;
    }
    // An empty title on the button: the host's title (the button's ancestor)
    // draws no browser tooltip over the Framework one.
    if (this.hasAttribute('title')) button.setAttribute('title', '');
    else button.removeAttribute('title');
    // A text other than the name describes the button (as the title did)
    // before the tooltip is made; once made, the controller links it by
    // aria-describedby instead.
    const cycle = this.cycleState();
    const name = String(cycle ? cycle.name : (this.pressed === true && this.labelPressed) || this.getAttribute('aria-label') || '').trim().toLowerCase();
    const said = this.nameTooltipText();
    if (!tip && said.toLowerCase() !== name) button.setAttribute('aria-description', said);
    else button.removeAttribute('aria-description');
    if (!tip) return;
    const text = tip.querySelector('.sf-tooltip-text');
    if (text && text.textContent !== this.nameTooltipText()) text.textContent = this.nameTooltipText();
    if (tip.previousElementSibling !== button || !tip.isConnected) button.after(tip);
    if (button.getAttribute('data-tooltip') !== tip.id) button.setAttribute('data-tooltip', tip.id);
  }

  // The first hover, keyboard focus or long press makes the tooltip and hands
  // that event to the controller, which shows it by its own rules (C59).
  wakeNameTooltip(event) {
    if (this._nameTip) return;
    const button = this.nameTooltipTarget();
    if (!button) return;
    // A pointer entering is told to the host itself; a focus and a press come
    // from inside, and must come from the button.
    if (event.type !== 'pointerenter' && !(event.target instanceof Node && button.contains(event.target))) return;
    const tip = document.createElement('span');
    tip.className = `sf-tooltip sf-tooltip--dark ${NAME_TIP}`;
    tip.id = this.id ? `${this.id}--tooltip` : `${NAME_TIP}-${++nameTips}`;
    tip.hidden = true;
    const content = document.createElement('span');
    content.className = 'sf-tooltip-content';
    const text = document.createElement('span');
    text.className = 'sf-tooltip-text';
    text.textContent = this.nameTooltipText();
    content.append(text);
    tip.append(content);
    this._nameTip = tip;
    button.after(tip);
    button.removeAttribute('aria-description');
    button.setAttribute('data-tooltip', tip.id);
    const kind = event.type;
    const pointerType = event.pointerType;
    let released = false;
    if (kind === 'pointerdown') button.addEventListener('pointerup', () => { released = true; }, {once: true});
    whenTooltipReady(() => setTimeout(() => {
      const now = this.querySelector('.sf-icon-button');
      if (!now || now.getAttribute('data-tooltip') !== tip.id) return;
      // The controller links the button on its own (its observer); the event
      // is handed over only while it still holds.
      if (kind === 'pointerenter' && now.matches(':hover')) {
        now.dispatchEvent(new PointerEvent('pointerenter', {pointerType}));
      } else if (kind === 'focusin' && document.activeElement === now) {
        now.dispatchEvent(new FocusEvent('focusin'));
      } else if (kind === 'pointerdown' && !released) {
        now.dispatchEvent(new PointerEvent('pointerdown', {pointerType}));
      }
    }, 0));
  }

  afterRender() {
    const button = this.querySelector('.sf-icon-button');
    applyButtonAttributes(this, button);
    // The name tooltip (C160 (1)): a cycle's value and the host's title are
    // its text, not a browser title; off, they stay the title.
    this.syncNameTooltip();

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
    if (!this._nameTipWake) {
      // Pointer enter does not bubble, but the host is the button's ancestor
      // and hears it; a finger counts only once it is a long press (the
      // controller times it), so a touch is handed over from pointerdown.
      this._nameTipWake = (event) => {
        if (event.type === 'pointerenter' && event.pointerType === 'touch') return;
        if (event.type === 'pointerdown' && event.pointerType !== 'touch') return;
        if (event.type === 'focusin') {
          try {
            if (!event.target?.matches?.(':focus-visible')) return;
          } catch { /* the selector unknown: a focus counts */ }
        }
        this.wakeNameTooltip(event);
      };
      this.addEventListener('pointerenter', this._nameTipWake);
      this.addEventListener('focusin', this._nameTipWake);
      this.addEventListener('pointerdown', this._nameTipWake);
    }
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
    if (this._nameTipWake) {
      this.removeEventListener('pointerenter', this._nameTipWake);
      this.removeEventListener('focusin', this._nameTipWake);
      this.removeEventListener('pointerdown', this._nameTipWake);
      this._nameTipWake = null;
    }
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
