import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { renderButtonTemplate } from "./js/templates/default";
import { html } from "lit";
import { resolveControlSpacing } from '../../core/js/control-spacing';
import { noteDeprecated } from "../../core/js/deprecations.js";
import { warnUnknownControlStatus } from "../helpers/control-status";
import { buttonSetLook, sayButtonSetFormers } from "../helpers/button-set";
import {
  ariaKeyShortcuts,
  isCommandShortcut,
  isApplePlatform,
  isEditableTarget,
  matchesShortcut,
  parseShortcut,
  shortcutCaps,
} from "../../component/kbd/js/shortcut";
import { cycleState, hasCycle, parseCycle, preloadSwitchIcons, pressCycle, themeCycleFollow, warnCycleToggle } from "../helpers/cycle";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

const COMPONENT_ATTRIBUTES = new Set([
  "template",
  "size",
  "height",
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
  "full-width",
  "root-class",
  "loading",
  "segment",
  "disabled",
  "native-type",
  "form",
  "name",
  "value",
  "href",
  "target",
  "rel",
  "expanded",
  "pressed",
  "text-pressed",
  "cycle",
  "theme-cycle",
  "shortcut",
  "shortcut-listen",
  "aria-label",
  "class",
  "style",
  "id",
  "slot",
]);

// height (1.10.0, decision C27): the size's tightness steps. A value outside
// the list reads as default and is said once per button.
const HEIGHTS = new Set(["low", "default", "high", "highest"]);
function buttonHeight(host) {
  const raw = host.getAttribute("height");
  if (raw === null || raw === "") return "default";
  const value = raw.trim().toLowerCase();
  if (HEIGHTS.has(value)) return value;
  if (!host.__sfHeightWarned) {
    host.__sfHeightWarned = true;
    globalThis.console?.warn?.(`[SIMAI Framework] sf-button: height="${raw}" is not a height; write low, default, high or highest (the size's steps). Read as default.`);
  }
  return "default";
}

// spacing is deprecated (1.10.0, decision C27; journal
// attribute-button-spacing-to-height): it keeps drawing the side padding
// until 2027-01-01 and is not turned into a height. It is noted in
// SF.deprecations and said once per page in the console -- the decision asks
// for the warning whether or not the page opted in to them.
function noteSpacing(host) {
  if (!host.hasAttribute("spacing")) return;
  noteDeprecated({component: "sf-button", kind: "attribute", from: "spacing", to: "height", since: "2026-11-09", remove_after: "2027-01-01"});
  const root = globalThis.SF = globalThis.SF || {};
  if (root.__sfButtonSpacingWarned) return;
  Object.defineProperty(root, "__sfButtonSpacingWarned", {value: true, configurable: true});
  globalThis.console?.warn?.("[SIMAI Framework] sf-button: spacing is deprecated until 2027-01-01 and draws the side padding only; write height=\"low|default|high|highest\" for the control height. See contracts/changes/journal.json (attribute-button-spacing-to-height).");
}

// The button set (1.14.0, owner decision C116; helpers/button-set.js):
// scheme="secondary" draws as on-surface, appearance="surface" as the soft grey
// button (tonal + on-surface, C113), and a danger button that asks for tonal or
// surface draws as outline. Each is a former name until 2027-01-01, noted in
// SF.deprecations and said once per page (change journal
// value-button-set-c116). surface with on-surface-variant, retired in 1.11.0
// (value-button-surface-quiet-scheme), is part of the retired surface now and
// draws the same soft grey button. Words of two settings, so the component
// reads them itself rather than through value aliases.
function setLook(host) {
  return buttonSetLook({
    appearance: host.getAttribute("appearance") ?? host.getAttribute("type"),
    scheme: host.getAttribute("scheme"),
    status: host.getAttribute("status"),
  });
}

// href (1.4.0) takes the addresses a link may follow: a relative one, a
// fragment, http(s), mailto and tel. Any other scheme (javascript:, data:)
// draws the button as a button.
const SAFE_HREF = /^(?:[^:/?#]*(?:[/?#]|$)|https?:|mailto:|tel:)/iu;
function linkAddress(value) {
  const href = String(value || "").trim();
  return href && SAFE_HREF.test(href) ? href : "";
}

// A link that opens a new tab says noopener noreferrer unless the page wrote
// its own rel (1.7.0): the opened page cannot reach window.opener.
function linkRelation(target, rel) {
  const own = String(rel || "").trim();
  if (own) return own;
  return String(target || "").trim().toLowerCase() === "_blank" ? "noopener noreferrer" : "";
}

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
  static get props() {
    return {
      ...super.props,
      // The attribute takes JSON or value::label::flags|…; the property a list.
      cycle: {type: Array, default: [], parser: parseCycle},
    };
  }

  // cycle is a list setting (§4.2) whose attribute keeps its JSON form, as
  // sf-segmented's items: a list set as a property stays the instance's own.
  get cycle() {
    return this.getProp("cycle");
  }

  set cycle(value) {
    Object.defineProperty(this, "cycle", {configurable: true, enumerable: true, writable: true, value});
    this.requestComponentUpdate?.("cycle");
  }

  // The cycle (D11d): null when the button is not one. Its name is the
  // button's aria-label, or none: then the current label is the text and the name.
  cycleState() {
    if (!hasCycle(this)) return null;
    return cycleState(this, {
      base: this.getAttribute("aria-label") || "",
      words: (key, options) => this.sfWord(key, options),
    });
  }

  // aria-label is the host's (§3.1), not a setting, so the manifest makes no
  // observed attribute of it, and the forwarder leaves it out (it is in
  // COMPONENT_ATTRIBUTES): a name changed after the first drawing never reached
  // the inner button. sf-input-image's «Заменить изображение «photo.png»» kept
  // the first file's name after a new drop (1.14.0); sf-button-icon watched it
  // since 2026-11-06. A change now draws the button again with the new name.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, "aria-label"])];
  }

  constructor() {
    super();
    this._attributeObserver = null;
    this._textFromChildren = "";
    this._shortcutListener = null;
  }

  // appearance and scheme: the set's former words read as their successors
  // (C116): surface as tonal, a danger tonal or surface as outline.
  get appearance() {
    const look = setLook(this);
    return look.formers.some((former) => former.attribute === "appearance") ? look.appearance : super.appearance;
  }

  set appearance(value) {
    super.appearance = value;
  }

  // secondary, and the scheme the retired surface brings, read as on-surface.
  get scheme() {
    const look = setLook(this);
    return look.formers.some((former) => former.attribute === "scheme" || former.from === "surface" && former.to === "tonal") ? look.scheme : super.scheme;
  }

  set scheme(value) {
    super.scheme = value;
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  // A text attribute, even an empty one, is the label: emptying it empties
  // the button. Before, an empty attribute fell through to the text captured
  // from children, and a toolbar that cleared a label kept the old one
  // (simai.main, Main's isolated toolbar on ui-36116c01a792, 2026-10-28).
  get text() {
    if (this.hasAttribute("text")) return this.getAttribute("text") || "";
    return this._textFromChildren || "";
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

  // pressed is optional too: absent, the button is not a toggle and says
  // nothing; present, aria-pressed and the selected look follow it.
  get pressed() {
    // A cycle is not a toggle: pressed is ignored beside it.
    if (hasCycle(this)) return undefined;
    return this.hasAttribute("pressed") ? super.pressed : undefined;
  }

  set pressed(value) {
    if (value === undefined || value === null) this.removeAttribute("pressed");
    else this.setAttribute("pressed", value ? "" : "false");
  }

  templateContext() {
    // A child parsed after connectedCallback is still the label.
    this.captureTextChildren?.();
    const props = this.getPropsContext();
    const cycle = this.cycleState();
    if (cycle) warnCycleToggle(this, ["pressed", "text-pressed"]);
    noteSpacing(this);
    // success, warning, info: no such buttons (C13, BS-1); said once per page.
    warnUnknownControlStatus("sf-button", this.getAttribute("status"));
    // secondary, surface, a danger tonal or surface (C116); said once per page.
    sayButtonSetFormers("sf-button", setLook(this).formers);
    const announce = Boolean(cycle && this.__sfCycleAnnounce);
    this.__sfCycleAnnounce = false;
    // A cycle with an icon shows the item's icon in place of the start icon;
    // one without shows the item's label as its text.
    const cycleIcon = cycle?.item.icon || "";
    // The icons a press can show, asked for before the press (R074).
    preloadSwitchIcons(this, {
      icons: [this.iconStart, this.iconEnd, ...["icon", "icon-left", "icon-right"].map((name) => this.getAttribute(name))],
    });

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
      // A native button's own words (1.5.0): the form it submits, and the
      // name and value it submits under.
      formId: this.getAttribute("form") || "",
      submitName: this.getAttribute("name") || "",
      submitValue: cycle && !cycle.theme ? cycle.item.value : this.getAttribute("value") ?? "",
      href: linkAddress(this.getAttribute("href")),
      // Where the link opens and its relation (1.7.0, Larena after sf-wizard):
      // a new tab with no rel is noopener noreferrer.
      linkTarget: this.getAttribute("target") || "",
      linkRel: linkRelation(this.getAttribute("target"), this.getAttribute("rel")),
      radius: this.radius,
      // A cycle's name says its current value; without an aria-label the
      // shown label is the name.
      ariaLabel: cycle ? (this.getAttribute("aria-label") || (cycleIcon && !this.text) ? cycle.name : "") : this.getAttribute("aria-label") || "",
      expanded: this.expanded,
      pressed: cycle ? undefined : this.pressed,
      textPressed: cycle ? "" : this.textPressed,
      // The cycle's item: its icon in place of the start icon, or, without
      // one, its label in place of the text.
      // cycleView, not cycle: `cycle` is the setting (the list of items).
      cycleView: cycle ? {
        icon: cycleIcon,
        label: cycleIcon ? '' : cycle.item.label,
        pressedLook: cycle.item.pressed,
        name: cycle.name,
        tooltip: cycle.tooltip,
        announcement: announce ? cycle.name : "",
      } : null,
      // The shortcut's key caps and its aria-keyshortcuts, in this platform's
      // words (component/kbd/js/shortcut.js).
      shortcutCaps: shortcutCaps(parseShortcut(this.shortcut)),
      // Words join with + where the platform spells its modifiers (the kbd
      // sheet shows the join only where keys are plain glyphs).
      shortcutJoin: !isApplePlatform(),
      ariaKeyShortcuts: ariaKeyShortcuts(parseShortcut(this.shortcut)),
      ...resolveControlSpacing({spacing: this.getAttribute('spacing')}),
      height: buttonHeight(this),
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
    this.syncShortcutListener();
    if (!this._cycleTheme) {
      // A theme cycle follows the theme wherever it was set.
      this._cycleTheme = () => themeCycleFollow(this);
      globalThis.addEventListener?.("sf-theme-change", this._cycleTheme);
    }
    super.onConnected?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if ((name === "shortcut" || name === "shortcut-listen") && oldValue !== newValue && this.isConnected) {
      this.syncShortcutListener();
    }
  }

  // shortcut-listen: one keydown listener on the document while the button is
  // connected and listens. The combination presses the native button -- a
  // click, so the press event follows as for a person's click -- unless a
  // listener before it took the key, the button is disabled or loading, or
  // the combination has no modifier and focus is in a field.
  syncShortcutListener() {
    const wanted = Boolean(this.shortcutListen) && Boolean(parseShortcut(this.shortcut));
    if (wanted && !this._shortcutListener) {
      this._shortcutListener = (event) => this.handleShortcut(event);
      globalThis.document?.addEventListener("keydown", this._shortcutListener);
    } else if (!wanted && this._shortcutListener) {
      globalThis.document?.removeEventListener("keydown", this._shortcutListener);
      this._shortcutListener = null;
    }
  }

  handleShortcut(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    const parsed = parseShortcut(this.shortcut);
    if (!matchesShortcut(event, parsed)) return;
    const target = event.composedPath?.()[0] ?? event.target;
    if (!isCommandShortcut(parsed) && isEditableTarget(target)) return;
    const button = this.querySelector(".sf-button");
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true" || !button.getClientRects().length) return;
    event.preventDefault();
    button.click();
  }

  // §8: a person's press of the native button, sent once as sf-button-press.
  // A disabled or loading button never gets the click, and a click on the host
  // outside the native button (there is no such box: the host is
  // display:contents) is not a press.
  handlePress(event) {
    const button = this.querySelector(".sf-button");
    if (!button || !(event.target instanceof Node) || !button.contains(event.target)) return;
    // A link that is off (href, disabled or loading: 1.4.0) is not pressed either.
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    this.sfEmit("press", {});
    // A cycle moves to its next value after the press (D11d).
    pressCycle(this, this.cycleState());
  }

  afterRender() {
    const button = this.querySelector(".sf-button");
    applyButtonAttributes(this, button);
    // The cycle's tooltip names the current and the next value.
    const cycle = this.cycleState();
    if (button && cycle) button.setAttribute("title", cycle.tooltip);

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
      height: buttonHeight(this),
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
      fullWidth: this.fullWidth,
      rootClass: this.rootClass,
      loading: this.loading,
      disabled: this.disabled,
      nativeType: this.nativeType,
      form: this.getAttribute("form") || "",
      name: this.getAttribute("name") || "",
      value: this.getAttribute("value") || "",
      href: this.getAttribute("href") || "",
      target: this.getAttribute("target") || "",
      rel: this.getAttribute("rel") || "",
      shortcut: this.shortcut,
      shortcutListen: this.shortcutListen,
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

  // A pressed toggle draws its icons filled (1.6.0, rule C12): the filled
  // attribute, not the sheet's FILL alone, so the Loader's icon subset holds
  // the filled glyph -- a FILL set by a rule drew the outlined one from it.
  createIcon(name, filled = false) {
    if (!name) return "";
    return html`<sf-icon icon="${name}" ?filled=${filled} root-class="pointer-event-none" weight="400" aria-hidden="true"></sf-icon>`;
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }

  onDisconnected() {
    if (this._pressListener) {
      this.removeEventListener("click", this._pressListener);
      this._pressListener = null;
    }
    if (this._shortcutListener) {
      globalThis.document?.removeEventListener("keydown", this._shortcutListener);
      this._shortcutListener = null;
    }
    if (this._cycleTheme) {
      globalThis.removeEventListener?.("sf-theme-change", this._cycleTheme);
      this._cycleTheme = null;
    }
    this.disconnectForwardedHostAttributes();
    this._attributeObserver = null;
    super.onDisconnected?.();
  }
}

SfButton.define("sf-button");
