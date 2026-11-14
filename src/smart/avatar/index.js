import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { fieldSize } from "../../component/field-size";
import { renderCardTemplate } from "./js/templates/card";
import { renderDefaultTemplate } from "./js/templates/default";
import { renderLabelTemplate } from "./js/templates/label";
import { getInitials } from "../helpers/text";
import { resolveAvatarHue } from "./js/tone.mjs";
import {elementBadge, nameWithBadge} from "../helpers/anchored-badge";
import {preloadControlIcons} from "../helpers/cycle";
import {avatarPictureIcons, avatarStepText} from "./js/picture";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

// sf-avatar from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §11): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest; title is heading's
// dated alias (aliases.json, §3.1); the default name is the language files'
// runtime aria-label.
const AvatarElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});


// The tooltips' ids, one per element on the page (stable across renders).
let sequence = 0;

const TEMPLATE_RENDERERS = {
  default: renderDefaultTemplate,
  label: renderLabelTemplate,
  card: renderCardTemplate,
};

class SfAvatar extends AvatarElement {
  get templateName() {
    return this.getAttribute("template") || "default";
  }

  set templateName(value) {
    this.setAttribute("template", value || "default");
  }

  // Beside a label the avatar takes the label's text line of a form size
  // rather than a control height: an avatar's own sizes are control heights,
  // and none of them is a size 1 line on both desktop and mobile.
  get line() {
    const line = this.getAttribute("line") || "";
    return line ? fieldSize(line, "sf-avatar line") : "";
  }

  set line(value) {
    super.line = value;
  }

  // The browser's own ariaLabel answers the attribute; the avatar answers its
  // default word too, as it always did.
  get ariaLabel() {
    return this.getAttribute("aria-label") || this.sfWord("aria-label");
  }

  set ariaLabel(value) {
    if (!value) {
      this.removeAttribute("aria-label");
      return;
    }

    this.setAttribute("aria-label", value);
  }

  // The name the avatar is read by (avatar study AV-2, 2026-11-14): the
  // host's aria-label, else the heading the author gave, else the initials of
  // text, else the language file's word («Аватар»). heading named nobody: it
  // gave the initials and the hue, and the button still read «Аватар» (10 of
  // 36 avatars on the docs page). el.ariaLabel keeps answering the attribute
  // or the word, as it did.
  get accessibleName() {
    return (
      this.getAttribute("aria-label") ||
      String(this.heading ?? "").trim() ||
      String(this.text ?? "").trim() ||
      this.sfWord("aria-label")
    );
  }

  // The presence word (AV-4): online and offline join the name as the count
  // does -- «Анна Белова, в сети, 3 непрочитанных» -- in the page's language
  // (lang runtime status-online / status-offline). The company and verified
  // marks are not presence and add nothing.
  get presenceWord() {
    if (this.status === "online") return this.sfWord("status-online");
    if (this.status === "away") return this.sfWord("status-away");
    if (this.status === "offline") return this.sfWord("status-offline");
    return "";
  }

  // What the avatar is (owner decision C152 (1), 2026-11-14): a link with
  // href; a button where it has an action of its own -- the trigger of a
  // popover or a menu (slot="trigger"), or a host that says it opens one
  // (aria-haspopup); otherwise a picture, role img with the name, no Tab
  // stop and no hover ring. It was always a button: five avatars in a row
  // were five Tab stops, and products hid them with aria-hidden and inert.
  get mode() {
    if (String(this.href ?? "").trim()) return "link";
    if (this.getAttribute("slot") === "trigger" || this.hasAttribute("aria-haspopup")) {
      return "button";
    }
    return "picture";
  }

  // The name over an avatar whose name is not printed (C152 (7)): a link or
  // a button of the default template -- the user menu in a header, a link to
  // a profile. A picture's name is printed beside it in a row, a card or a
  // label, so it takes none; a group shows its members' names itself.
  get tooltipText() {
    if (this.templateName !== "default" || this.mode === "picture") return "";
    return String(this.heading ?? "").trim() || this.getAttribute("aria-label") || "";
  }

  get spokenName() {
    const presence = this.presenceWord;
    const name = presence ? `${this.accessibleName}, ${presence}` : this.accessibleName;
    return nameWithBadge(name, elementBadge(this).phrase);
  }

  connectedCallback() {
    super.connectedCallback();
    // The placeholder's glyph is asked for before the avatar draws, as the
    // tag's is (R074 F3): one request with the page's first icons.
    if (this.isConnected) this.preloadIcons();
  }

  preloadIcons() {
    const icons = avatarPictureIcons({
      imageUrl: this.imageUrl,
      text: this.displayText,
      icon: this.icon,
    });
    preloadControlIcons(this, icons.map((icon) => ({icon, filled: false})));
  }

  // The text attribute as given; the template draws displayText (the text,
  // else initials), an exemption of contracts/template-context.json.
  get text() {
    return super.text;
  }

  set text(value) {
    super.text = value;
  }

  get isImage() {
    return !!this.imageUrl;
  }

  get isText() {
    return !this.isImage && !!this.displayText;
  }

  get displayText() {
    if (this.text) {
      return this.text;
    }

    if (this.isImage) {
      return "";
    }

    // A glyph the author names (a bot, a system) stands in for the initials
    // of the name, which still names the avatar (AV-8).
    if (String(this.icon ?? "").trim()) {
      return "";
    }

    return getInitials(
      this.heading || (this.hasAttribute("aria-label") ? this.ariaLabel : ""),
    );
  }

  // The letters drawn: the initials with a photo too (they stand under it
  // until it comes and when it fails, C152 (2)), one letter at 1/4 (C152 (3)).
  get drawnText() {
    if (String(this.icon ?? "").trim() && !this.text) return "";
    const own = this.text || getInitials(
      this.heading || (this.hasAttribute("aria-label") ? this.ariaLabel : ""),
    );
    return avatarStepText(own, this.size);
  }

  // The hue the initials are drawn in (C17): the named one, or for auto the
  // one of the name, the words the initials stand for rather than the two
  // letters, so two people with the same initials differ. Only initials take a
  // hue: a picture covers the fill and the placeholder stays neutral. The
  // former tone setting is read when hue is empty (rose is pink). A card
  // without a photo draws the initials on the hue of the name when no hue is
  // set (owner decision C124): auto is the card's default.
  get resolvedHue() {
    if (!this.drawnText) {
      return "";
    }

    const cardDefault =
      this.templateName === "card" && !this.hue && !this.tone ? "auto" : "";

    return resolveAvatarHue(
      this.hue || cardDefault,
      this.heading || this.getAttribute("aria-label") || this.text,
      this.tone,
    );
  }

  templateContext() {
    const props = this.getPropsContext();
    const badge = elementBadge(this);
    if (!this._uid) this._uid = `sf-avatar-${++sequence}`;
    const tipText = this.tooltipText;
    // The tooltip relation is lazy: asked for when such an avatar draws.
    if (tipText) globalThis.SF?.Loader?.ensurePlugin?.("tooltip");

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.ariaLabel,
      // The name, the presence and the count: «Анна Белова, в сети,
      // 3 непрочитанных».
      buttonLabel: this.spokenName,
      icon: this.icon,
      size: this.size,
      line: this.line,
      shape: this.shape,
      status: this.status,
      heading: this.heading,
      // An external project template written before the rename reads title.
      title: this.heading,
      badge,
      component: this,
      isImage: this.isImage,
      // The initials are drawn alone or under the photo (C152 (2)); the card
      // keeps its own photo-or-placeholder media (isCardText).
      isText: Boolean(this.drawnText),
      isCardText: this.isText,
      resolvedHue: this.resolvedHue,
      text: this.templateName === "card" ? this.displayText : this.drawnText,
      mode: this.mode,
      href: String(this.href ?? "").trim(),
      tipText,
      tipId: tipText ? `${this._uid}-tip` : "",
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
    });
  }

  hasBuiltInTemplate(templateName = this.templateName) {
    return Object.prototype.hasOwnProperty.call(
      TEMPLATE_RENDERERS,
      templateName,
    );
  }

  templateRenderer() {
    return TEMPLATE_RENDERERS[this.templateName] || TEMPLATE_RENDERERS.default;
  }

  template() {
    this.preloadIcons();
    return this.templateRenderer()(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    const directPatchAttributes = ["disabled"];

    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) => directPatchAttributes.includes(attr))
    ) {
      return "dom";
    }

    return "lit";
  }

  updateDom(changedAttributes = []) {
    const button = this.querySelector(".sf-avatar");

    // Only a button takes disabled in place; a link or a picture draws again.
    if (!button || button.localName !== "button") {
      return false;
    }

    if (changedAttributes.includes("aria-label")) {
      button.setAttribute("aria-label", this.spokenName);
    }

    if (changedAttributes.includes("disabled")) {
      button.disabled = this.disabled;
    }

    return true;
  }

  get value() {
    return {
      template: this.templateName,
      size: this.size,
      line: this.line,
      shape: this.shape,
      imageUrl: this.imageUrl,
      imageAlt: this.imageAlt,
      text: this.text,
      hue: this.hue,
      tone: this.tone,
      status: this.status,
      icon: this.icon,
      href: this.href,
      ariaLabel: this.ariaLabel,
      heading: this.heading,
      description: this.description,
      meta: this.meta,
      metaIcon: this.metaIcon,
      cardVariant: this.cardVariant,
      disabled: this.disabled,
      badgeCount: this.getProp("badgeCount"),
      badgeDot: this.getProp("badgeDot"),
      badgeCap: this.getProp("badgeCap"),
      badgeLabel: this.getProp("badgeLabel"),
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfAvatar.define("sf-avatar");
