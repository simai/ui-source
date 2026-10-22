import SfBaseElement from "../../core/js/smart-base";
import { renderIconTemplate } from "./js/templates/default";
import { elementBadge } from "../helpers/anchored-badge";

const weightClasses = new Map([
  [100, "thin"],
  [200, "extra-light"],
  [300, "light"],
  [400, "regular"],
  [500, "medium"],
  [600, "semi-bold"],
  [700, "bold"],
]);
const iconTypes = ["outlined", "rounded", "sharp"];
const iconSizes = ["1/4", "1/3", "1/2", "1", "2", "3", "4", "5", "6", "7"];

function clampAxis(value, fallback, minimum, maximum) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.min(maximum, Math.max(minimum, numericValue));
}

class SfIcon extends SfBaseElement {
  static clearLightDomBeforeFirstRender = true;

  constructor() {
    super();

    this.onIconSubsetReady = (event) => {
      const icon = this.getProp("icon");
      const icons = event.detail?.icons || [];

      const hasIcon =
        icons instanceof Set
          ? icons.has(icon)
          : Array.isArray(icons) && icons.includes(icon);
      // The local full font (icons.enabled = false) draws every icon at once.
      if (icon && !hasIcon && !event.detail?.all) return;

      this.syncLoadedState();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
    this.requestIconLoad();
    this.syncLoadedState();
  }

  disconnectedCallback() {
    window.removeEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
    super.disconnectedCallback();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);

    if (
      ["icon", "filled", "weight", "grade", "optical-size", "type"].includes(
        name,
      ) &&
      oldValue !== newValue
    ) {
      window.addEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
      this.requestIconLoad();
      this.syncLoadedState();
    }
  }

  requestIconLoad() {
    const loader = window.SF?.Loader;
    const iconCount = loader?.trackIconElement?.(this) || 0;

    if (iconCount > 0) {
      loader.mutate?.(() => loader.loadFonts?.());
    }
  }

  syncLoadedState() {
    const loader = window.SF?.Loader;
    const tracked = loader?.getTrackedIconAttrs?.(this) || null;
    const loaded = Boolean(
      tracked?.icon && loader?.isTrackedIconLoaded?.(tracked),
    );

    if (loaded) {
      window.removeEventListener(
        "sf-icons-subset:ready",
        this.onIconSubsetReady,
      );
    } else {
      window.addEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
    }
    if (this.getProp("loaded") === loaded) return;

    this.setState({ loaded });
  }

  static get props() {
    return {
      icon: "",
      loaded: { type: Boolean, default: false },
      filled: { type: Boolean, default: false },
      weight: { type: Number, default: 400 },
      size: { type: String, default: "" },
      type: { type: String, default: "" },
      grade: { type: Number, default: 0 },
      opticalSize: { type: Number, default: 24 },
      label: { type: String, default: "" },
      // A count or a dot on the icon (simai/ui-source#12).
      badgeCount: { type: String, default: "" },
      badgeDot: { type: Boolean, default: false },
      badgeCap: { type: Number, default: 99 },
      badgeLabel: { type: String, default: "" },
    };
  }

  static get observedAttributes() {
    return Array.from(
      new Set([
        ...super.observedAttributes,
        "icon",
        "size",
        "weight",
        "filled",
        "loaded",
        "type",
        "grade",
        "optical-size",
        "label",
        "badge-count",
        "badge-dot",
        "badge-cap",
        "badge-label",
      ]),
    );
  }

  get weightClass() {
    let weight = this.getProp("weight");
    weight = this.toNumber(weight, 400);
    return weightClasses.get(weight) || weightClasses.get(400);
  }

  get iconType() {
    const requestedType = String(this.getProp("type") || "")
      .trim()
      .toLowerCase();
    const type =
      requestedType ||
      window.SF?.Loader?.getDefaultIconType?.() ||
      window.SF_BOOT_CONFIG?.icons?.type ||
      window.SF_ICON_TYPE ||
      "outlined";
    const normalizedType = type === "shape" ? "sharp" : type;

    return iconTypes.includes(normalizedType) ? normalizedType : "outlined";
  }

  get iconSize() {
    const size = String(this.getProp("size") || "").trim();
    return iconSizes.includes(size) ? size : "";
  }

  get iconGrade() {
    return clampAxis(this.getProp("grade"), 0, -50, 200);
  }

  get iconOpticalSize() {
    return clampAxis(this.getProp("opticalSize"), 24, 20, 48);
  }

  get templateData() {
    return {
      icon: this.getProp("icon"),
      loaded: this.getProp("loaded"),
      filled: this.getProp("filled"),
      rounded: this.iconType === "rounded",
      sharp: this.iconType === "sharp",
      weightClass: this.weightClass,
      size: this.iconSize,
      grade: this.iconGrade,
      opticalSize: this.iconOpticalSize,
      label: String(this.getProp("label") || "").trim(),
      badge: elementBadge(this),
    };
  }

  template() {
    return renderIconTemplate({
      ...this.templateContext(),
      ...this.templateData,
    });
  }
}

SfIcon.define("sf-icon");
