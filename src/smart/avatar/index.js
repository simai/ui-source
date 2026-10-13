import SfBaseElement from "../../core/js/smart-base";
import { fieldSize } from "../../component/field-size";
import { renderCardTemplate } from "./js/templates/card";
import { renderDefaultTemplate } from "./js/templates/default";
import { renderLabelTemplate } from "./js/templates/label";
import { getInitials } from "../helpers/text";
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-avatar", code, words).
const AVATAR_TEXT = {
  en: {
    ariaLabel: 'Avatar',
  },
  ru: {
    ariaLabel: 'Аватар',
  },
};


const TEMPLATE_RENDERERS = {
  default: renderDefaultTemplate,
  label: renderLabelTemplate,
  card: renderCardTemplate,
};

class SfAvatar extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: "template", default: "default" },
      size: { default: "1" },
      line: { default: "" },
      shape: { default: "circle" },
      imageUrl: { default: "" },
      imageAlt: { default: "" },
      noWrap: {type: Boolean, default: false},
      text: { default: "" },
      status: { default: "none" },
      ariaLabel: { default: '' },
      title: { default: "" },
      description: { default: "" },
      meta: { default: "" },
      metaIcon: { default: "" },
      cardVariant: { default: "square" },
      disabled: { type: Boolean, default: false },
    };
  }

  constructor() {
    super();
  }

  get templateName() {
    return this.getAttribute("template") || "default";
  }

  set templateName(value) {
    this.setAttribute("template", value || "default");
  }

  get size() {
    return this.getAttribute("size") || "1";
  }

  // Beside a label the avatar takes the label's text line of a form size
  // rather than a control height: an avatar's own sizes are control heights,
  // and none of them is a size 1 line on both desktop and mobile.
  get line() {
    const line = this.getAttribute("line") || "";
    return line ? fieldSize(line, "sf-avatar line") : "";
  }

  set size(value) {
    this.setAttribute("size", value);
  }

  get shape() {
    return this.getAttribute("shape") || "circle";
  }

  set shape(value) {
    this.setAttribute("shape", value || "circle");
  }


  get imageUrl() {
    return this.getAttribute("image-url") || "";
  }

  set imageUrl(value) {
    if (value === null || value === undefined || value === "") {
      this.removeAttribute("image-url");
      return;
    }

    this.setAttribute("image-url", value);
  }

  get imageAlt() {
    return this.getAttribute("image-alt") || "";
  }

  set imageAlt(value) {
    if (value === null || value === undefined || value === "") {
      this.removeAttribute("image-alt");
      return;
    }

    this.setAttribute("image-alt", value);
  }

  get text() {
    return this.getAttribute("text") || "";
  }

  set text(value) {
    if (value === null || value === undefined || value === "") {
      this.removeAttribute("text");
      return;
    }

    this.setAttribute("text", value);
  }

  get status() {
    return this.getAttribute("status") || "none";
  }

  set status(value) {
    this.setAttribute("status", value || "none");
  }

  get ariaLabel() {
    return this.getAttribute("aria-label") || pageText(AVATAR_TEXT, "ariaLabel", this);
  }

  set ariaLabel(value) {
    if (!value) {
      this.removeAttribute("aria-label");
      return;
    }

    this.setAttribute("aria-label", value);
  }

  get title() {
    return this.getAttribute("title") || "";
  }

  set title(value) {
    if (!value) {
      this.removeAttribute("title");
      return;
    }

    this.setAttribute("title", value);
  }

  get description() {
    return this.getAttribute("description") || "";
  }

  set description(value) {
    if (!value) {
      this.removeAttribute("description");
      return;
    }

    this.setAttribute("description", value);
  }

  get meta() {
    return this.getAttribute("meta") || "";
  }

  set meta(value) {
    if (!value) {
      this.removeAttribute("meta");
      return;
    }

    this.setAttribute("meta", value);
  }

  get metaIcon() {
    return this.getAttribute("meta-icon") || "";
  }

  set metaIcon(value) {
    if (!value) {
      this.removeAttribute("meta-icon");
      return;
    }

    this.setAttribute("meta-icon", value);
  }

  get cardVariant() {
    return this.getAttribute("card-variant") || "square";
  }

  set cardVariant(value) {
    this.setAttribute("card-variant", value || "square");
  }

  get disabled() {
    return this.getBooleanAttr("disabled", false);
  }

  set disabled(value) {
    if (value) {
      this.setAttribute("disabled", "");
      return;
    }

    this.removeAttribute("disabled");
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
      this.title || (this.hasAttribute("aria-label") ? this.ariaLabel : ""),
    );
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.getAttribute("aria-label") || pageText(AVATAR_TEXT, "ariaLabel", this),
      component: this,
      isImage: this.isImage,
      isText: this.isText,
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
      button.setAttribute("aria-label", this.ariaLabel);
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
      status: this.status,
      ariaLabel: this.ariaLabel,
      title: this.title,
      description: this.description,
      meta: this.meta,
      metaIcon: this.metaIcon,
      cardVariant: this.cardVariant,
      disabled: this.disabled,
    };
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue);
  }
}

SfAvatar.define("sf-avatar");
