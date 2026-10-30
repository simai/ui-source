import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { fieldSize } from "../../component/field-size";
import { renderCardTemplate } from "./js/templates/card";
import { renderDefaultTemplate } from "./js/templates/default";
import { renderLabelTemplate } from "./js/templates/label";
import { getInitials } from "../helpers/text";
import { avatarTone } from "./js/tone.mjs";
import {elementBadge, nameWithBadge} from "../helpers/anchored-badge";
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

    return getInitials(
      this.heading || (this.hasAttribute("aria-label") ? this.ariaLabel : ""),
    );
  }

  // The tone the initials are drawn in: the named one, or for auto the one of
  // the name, the words the initials stand for rather than the two letters, so
  // two people with the same initials differ. Only initials take a tone: a
  // picture covers the fill and the placeholder stays neutral.
  get resolvedTone() {
    const tone = this.tone;

    if (!tone || !this.isText) {
      return "";
    }

    if (tone !== "auto") {
      return tone;
    }

    return avatarTone(
      this.heading || this.getAttribute("aria-label") || this.text,
    );
  }

  templateContext() {
    const props = this.getPropsContext();
    const badge = elementBadge(this);

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.ariaLabel,
      // The count joins the name: «Анна Белова, 3 непрочитанных».
      buttonLabel: nameWithBadge(this.ariaLabel, badge.phrase),
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
      isText: this.isText,
      resolvedTone: this.resolvedTone,
      text: this.displayText,
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

    if (!button) {
      return false;
    }

    if (changedAttributes.includes("aria-label")) {
      button.setAttribute("aria-label", nameWithBadge(this.ariaLabel, elementBadge(this).phrase));
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
      tone: this.tone,
      status: this.status,
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
