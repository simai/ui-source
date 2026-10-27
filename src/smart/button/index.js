import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { renderButtonTemplate } from "./js/templates/default";
import { html } from "lit";
import { resolveControlSpacing } from '../../core/js/control-spacing';
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

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
  "expanded",
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

// sf-button from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. The legacy names --
// type, icon-left, icon-right, tightness -- and the legacy values -- ghost,
// danger, critical, tightness's words, left and right -- are dated aliases
// (aliases.json, until 2026-12-01): the shim writes the new attribute and
// notes the use, so a value outside a list reads as the default here.
const ButtonElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});

class SfButton extends ButtonElement {
  constructor() {
    super();
    this._attributeObserver = null;
    this._textFromChildren = "";
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  get text() {
    return this.getAttribute("text") || this._textFromChildren || "";
  }

  set text(value) {
    super.text = value;
  }

  // The label a button written in JavaScript carries, the way every element
  // carries one: createElement('sf-button') with textContent = 'Добавить', and
  // <sf-button>Добавить</sf-button> in HTML. The text attribute and the text
  // slot still come first. Before, an unslotted text child was left where it
  // was: the button rendered empty and the text stood beside it as a second,
  // unstyled label (consumer case ui-mail.button-text-content, 2026-10-21).
  captureTextChildren() {
    if (this.hasSlotContent?.("text")) return;

    const nodes = Array.from(this.childNodes).filter(
      (node) => node.nodeType === 3 && String(node.textContent).trim() !== "",
    );
    if (!nodes.length) return;

    this._textFromChildren = nodes
      .map((node) => String(node.textContent).trim())
      .join(" ");
    nodes.forEach((node) => node.remove());
  }

  // Null when the attribute is not there, and '' only when it is there and
  // empty. The template tells those apart on purpose: an empty icon-start is a
  // consumer saying «no icon here», and it suppresses the `icon` shortcut,
  // while an absent one lets the shortcut through. Both answered '' before, so
  // «never written» read as «deliberately emptied» and `icon="add"` on a button
  // drew nothing at all (owner, 2026-10-09). The old names icon-left and
  // icon-right write these attributes through the dated aliases.
  get iconStart() {
    return this.getAttribute('icon-start');
  }

  set iconStart(value) {
    super.iconStart = value;
  }

  get iconEnd() {
    return this.getAttribute('icon-end');
  }

  set iconEnd(value) {
    super.iconEnd = value;
  }

  get rootClass() {
    return this.getAttribute("root-class") || "";
  }

  // expanded is optional (§4.2): absent says nothing, so aria-expanded is
  // written only while the attribute is there.
  get expanded() {
    return this.hasAttribute("expanded") ? super.expanded : undefined;
  }

  set expanded(value) {
    if (value === undefined || value === null) this.removeAttribute("expanded");
    else this.setAttribute("expanded", value ? "" : "false");
  }

  templateContext() {
    // A child parsed after connectedCallback is still the label.
    this.captureTextChildren?.();
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      // Through the getter: the props context knows only the text attribute,
      // and a button whose label is a text child has none.
      text: this.text,
      // Resolved names the template reads (contracts/template-context.json).
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      appearance: this.appearance,
      type: this.appearance,
      status: this.status,
      scheme: this.scheme,
      size: this.size,
      iconPosition: this.iconPosition,
      nativeType: this.nativeType,
      radius: this.radius,
      ariaLabel: this.getAttribute("aria-label") || "",
      expanded: this.expanded,
      ...resolveControlSpacing({spacing: this.getAttribute('spacing')}),
      component: this,
    });
  }

  template() {
    return renderButtonTemplate(this.templateContext());
  }

  resolveUpdateMode() {
    return "lit";
  }

  onConnected() {
    this.captureTextChildren();
    if (!this._pressListener) {
      this._pressListener = (event) => this.handlePress(event);
      this.addEventListener("click", this._pressListener);
    }
    super.onConnected?.();
  }

  // §8: a person's press of the native button, sent once as sf-button-press.
  // A disabled or loading button never gets the click, and a click on the host
  // outside the native button (there is no such box: the host is
  // display:contents) is not a press.
  handlePress(event) {
    const button = this.querySelector(".sf-button");
    if (!button || !(event.target instanceof Node) || !button.contains(event.target)) return;
    if (button.disabled) return;
    this.sfEmit("press", {});
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

  // The native button is what takes focus: the host lays out as
  // display:contents and takes none, so focus() on the host did nothing and
  // left document.activeElement where it was. A product that holds the host --
  // from querySelector('sf-button'), or from closest('sf-button') on a data-* match --
  // focuses it and reaches the control through this.
  focusDelegate() {
    return this.querySelector(".sf-button");
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      appearance: this.appearance,
      type: this.appearance,
      scheme: this.scheme,
      status: this.status,
      text: this.text,
      icon: this.icon,
      iconLeft: this.iconStart,
      iconRight: this.iconEnd,
      iconStart: this.iconStart,
      iconEnd: this.iconEnd,
      iconPosition: this.iconPosition,
      tightness: resolveControlSpacing({spacing: this.getAttribute('spacing')}).tightness,
      spacing: this.spacing,
      radius: this.radius,
      rootClass: this.rootClass,
      loading: this.loading,
      disabled: this.disabled,
      nativeType: this.nativeType,
      ariaLabel: this.getAttribute("aria-label") || "",
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
    if (this._pressListener) {
      this.removeEventListener("click", this._pressListener);
      this._pressListener = null;
    }
    this.disconnectForwardedHostAttributes();
    this._attributeObserver = null;
    super.onDisconnected?.();
  }
}

SfButton.define("sf-button");
