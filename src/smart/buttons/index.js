import SfBaseElement from "../../core/js/smart-base";
import { renderButtonTemplate } from "./js/templates/default";
import { html } from "lit";
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { noteDeprecated } from '../../core/js/deprecations.js';

const COMPONENT_ATTRIBUTES = new Set([
  "template",
  "size",
  "appearance",
  "type",
  "scheme",
  "status",
  "text",
  "icon",
  "icon-start",
  "icon-end",
  "icon-left",
  "icon-right",
  "icon-position",
  "text-position",
  "spacing",
  "tightness",
  "radius",
  "root-class",
  "loading",
  "segment",
  "disabled",
  "native-type",
  "aria-label",
  "class",
  "style",
  "id",
  "slot",
]);

function applyButtonAttributes(host, button) {
  host?.forwardHostAttributes(button, {
    exclude: COMPONENT_ATTRIBUTES,
    transferDataAttributes: true,
    storageKey: "__sfButtonForwardedDataAttributes",
    targetStorageKey: "__sfButtonAttributeKeys",
  });
}

// Ghost is the link appearance under its old name: the class sf-button--ghost
// already reads as sf-button--link (journal class-button-ghost-to-link), and
// the Smart value now says the same instead of drawing the retired class
// (docs trial 4, 2026-10-15; journal value-button-ghost-to-link).
const BUTTON_APPEARANCES = ["default", "tonal", "outline", "link", "surface"];
const APPEARANCE_ALIASES = {ghost: "link"};
const STATUS_ALIASES = {danger: "error", critical: "error"};

class SfButton extends SfBaseElement {
  constructor() {
    super();
    this._attributeObserver = null;
  }

  static get props() {
    return {
      templateName: { attribute: "template", default: "default" },
      size: { default: "1" },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: { default: "default", aliases: ["type"] },
      scheme: { default: "primary" },
      // What the control is about, in the shared status vocabulary. A scheme says
      // which colour family a control takes; a status says what it does, and the
      // only one a control paints today is the destructive error. The two cannot
      // both colour it, so a status wins where it is set.
      status: { default: "", values: ["", "error"] },
      textPosition: {type: String, default: 'center'},
      text: { default: "" },
      segment: { default: "" },
      icon: { default: "" },
      iconStart: {type: String, default: null},
      iconEnd: {type: String, default: null},
      iconLeft: { default: "" },
      iconRight: { default: "" },
      iconPosition: { default: "start" },
      spacing: {type: String, default: null},
      tightness: { default: "", values: ["", "low", "high", "highest"] },
      radius: { default: "", values: ["", "default", "square", "rounded"] },
      rootClass: { default: "" },
      loading: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      nativeType: { default: "button" },
      ariaLabel: { default: "" },
    };
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  get size() {
    return this.getAttribute("size") || "1";
  }

  // A value outside the list draws the default button. It drew none: an unknown
  // appearance (type="primary", a scheme written where the appearance goes) gave
  // the class sf-button--primary twice and no fill, no border, no padding.
  get appearance() {
    const value = this.getAttribute("appearance") || this.getAttribute("type") || "default";
    if (Object.hasOwn(APPEARANCE_ALIASES, value)) {
      noteDeprecated({component: this.localName, kind: 'value', attribute: 'appearance', from: value, to: APPEARANCE_ALIASES[value]});
      return APPEARANCE_ALIASES[value];
    }
    return BUTTON_APPEARANCES.includes(value) ? value : "default";
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.appearance;
  }

  get scheme() {
    return this.getAttribute("scheme") || "primary";
  }

  // danger and critical are the shared vocabulary's old names for error
  // (journal value-status-danger-critical-to-error). The button dropped them and
  // drew a primary button, so a destructive control written that way looked
  // like a safe one (documentation trial 6, 2026-10-18).
  get status() {
    const value = this.getAttribute("status") || "";
    if (STATUS_ALIASES[value]) {
      noteDeprecated({component: this.localName, kind: 'value', attribute: 'status', from: value, to: STATUS_ALIASES[value]});
      return STATUS_ALIASES[value];
    }
    return value;
  }

  get text() {
    return this.getAttribute("text") || "";
  }

  get icon() {
    return this.getAttribute("icon") || "";
  }

  // Null when neither attribute is there, and '' only when one of them is there
  // and empty. The template tells those apart on purpose: an empty icon-start is
  // a consumer saying «no icon here», and it suppresses the `icon` shortcut,
  // while an absent one lets the shortcut through. Both answered '' before, so
  // «never written» read as «deliberately emptied» and `icon="add"` on a button
  // drew nothing at all -- the shortcut the manifest has always described has
  // never once worked (owner, 2026-10-09).
  get iconLeft() {
    if (this.hasAttribute('icon-left')) noteDeprecated({component: this.localName, kind: 'attribute', from: 'icon-left', to: 'icon-start'});
    return this.getAttribute('icon-start') ?? this.getAttribute('icon-left');
  }

  get iconRight() {
    if (this.hasAttribute('icon-right')) noteDeprecated({component: this.localName, kind: 'attribute', from: 'icon-right', to: 'icon-end'});
    return this.getAttribute('icon-end') ?? this.getAttribute('icon-right');
  }

  get iconStart() {
    return this.iconLeft;
  }

  get iconEnd() {
    return this.iconRight;
  }

  get iconPosition() {
    return this.getAttribute("icon-position") || "start";
  }

  get tightness() {
    if (this.hasAttribute('tightness')) noteDeprecated({component: this.localName, kind: 'attribute', from: 'tightness', to: 'spacing'});
    return resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}).tightness;
  }

  get spacing() {
    return resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}).spacing;
  }

  get radius() {
    return this.getEnumAttr("radius", ["default", "square", "rounded"], "");
  }

  get rootClass() {
    return this.getAttribute("root-class") || "";
  }

  get loading() {
    return this.getBooleanAttr("loading", false);
  }

  get disabled() {
    return this.getBooleanAttr("disabled", false);
  }

  get nativeType() {
    return this.getAttribute("native-type") || "button";
  }

  get ariaLabel() {
    return this.getAttribute("aria-label") || "";
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      iconLeft: props.iconStart ?? props.iconLeft,
      iconRight: props.iconEnd ?? props.iconRight,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      type: this.type,
      // A legacy appearance reaches the template under its current name, as the
      // getter reports it (journal value-button-ghost-to-link).
      appearance: props.appearance === 'ghost' ? 'link' : props.appearance,
      // Through the getters, which read the legacy names and note them: the
      // props context knows only the current values (danger and critical
      // fell to no status there).
      status: this.status,
      tightness: this.tightness,
      spacing: this.spacing,
      component: this,
    });
  }

  template() {
    return renderButtonTemplate(this.templateContext());
  }

  resolveUpdateMode() {
    return "lit";
  }

  afterRender() {
    const button = this.querySelector(".sf-button");
    applyButtonAttributes(this, button);

    if (!this._attributeObserver) {
      this._attributeObserver = this.observeForwardedHostAttributes(
        () => this.querySelector(".sf-button"),
        {
          exclude: COMPONENT_ATTRIBUTES,
          transferDataAttributes: true,
          storageKey: "__sfButtonForwardedDataAttributes",
          targetStorageKey: "__sfButtonAttributeKeys",
        },
      )._forwardHostAttributeObserver;
    }
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      appearance: this.appearance,
      type: this.type,
      scheme: this.scheme,
      status: this.status,
      text: this.text,
      icon: this.icon,
      iconLeft: this.iconLeft,
      iconRight: this.iconRight,
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      iconPosition: this.iconPosition,
      tightness: this.tightness,
      spacing: this.spacing,
      radius: this.radius,
      rootClass: this.rootClass,
      loading: this.loading,
      disabled: this.disabled,
      nativeType: this.nativeType,
      ariaLabel: this.ariaLabel,
    };
  }

  onClick(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("click", handler, options);
    }
    return this;
  }

  onFocus(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("focusin", handler, options);
    }
    return this;
  }

  onBlur(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("focusout", handler, options);
    }
    return this;
  }

  onMouseEnter(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("mouseenter", handler, options);
    }
    return this;
  }

  onMouseLeave(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener("mouseleave", handler, options);
    }
    return this;
  }

  setDisabled(nextValue = true) {
    if (nextValue) {
      this.setAttribute("disabled", "");
    } else {
      this.removeAttribute("disabled");
    }

    return this;
  }

  createIcon(name) {
    if (!name) return "";
    return html`<sf-icon icon="${name}" root-class="pointer-event-none" weight="400" aria-hidden="true"></sf-icon>`;
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

SfButton.define("sf-button");
