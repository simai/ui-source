import SfBaseElement from "../../core/js/smart-base";
import { elementFromManifest } from "../../core/js/element-manifest";
import { renderIconTemplate } from "./js/templates/default";
import { elementBadge } from "../helpers/anchored-badge";
import manifest from "./component.json";
import aliases from "./aliases.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

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

// sf-icon from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): the settings are the attributes and properties core/js/element-manifest.js
// makes from the manifest, `loaded` is the value the Loader reports, and the
// family's old name `shape` is a dated value alias of `sharp` (aliases.json).
// What stays here is behaviour: the exact subset the glyph waits for, the
// axes' bounds and the badge.
const IconElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: "ru",
  aliases,
});

class SfIcon extends IconElement {
  static clearLightDomBeforeFirstRender = true;

  constructor() {
    super();

    // Every subset answer, not only one that names this icon: an icon can
    // become drawable under an answer that does not name it -- a manifest
    // that already held it, its filled or weighted form loaded in a batch
    // named before the form was added, the full font taking over -- and it
    // then stayed at font-size 0 until something touched it (R074). The
    // check is a lookup in the Loader's sets.
    this.onIconSubsetReady = () => this.syncLoadedState();
    // An icon connected before the Loader existed asked it for nothing; it
    // asks, and checks again, once the Loader is ready.
    this.onLoaderReady = () => {
      this.requestIconLoad();
      this.syncLoadedState();
    };
  }

  connectedCallback() {
    // An icon placed again that has no glyph -- its host emptied after it drew,
    // by whatever emptied it -- draws again instead of staying blank for good:
    // its first render, which clears the host and starts lit afresh, runs once
    // more. Taking such an icon out and putting it back did nothing before,
    // and ui-mail replaced the blank ones in its drawer portals with fresh
    // copies (redrawPortalIcons, simai/ui-source#56).
    if (this._hasRendered && !this.querySelector(":scope > i.sf-icon, :scope > .sf-badge-anchor")) {
      this._hasRendered = false;
    }
    super.connectedCallback();
    window.addEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
    window.addEventListener("sf-loader-ready", this.onLoaderReady);
    this.requestIconLoad();
    this.syncLoadedState();
  }

  disconnectedCallback() {
    window.removeEventListener("sf-icons-subset:ready", this.onIconSubsetReady);
    window.removeEventListener("sf-loader-ready", this.onLoaderReady);
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

  // Classes someone else put on the glyph stay through a re-render: the
  // template writes the whole class attribute, and Docara's icon runtime lost
  // the face class it had set (sf-icon-complete), so a name outside the fast
  // subset drew as broken ligatures (simai/docara#35). The glyph's classes
  // that the last render did not write are carried into the next.
  foreignGlyphClasses() {
    const glyph = this.querySelector(":scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon");
    if (!glyph) return "";
    const written = new Set(String(this.__sfIconWrittenClass || "").split(/\s+/).filter(Boolean));
    // The element's own family is never foreign, so a first paint printed
    // before the element ran (its classes not yet recorded) hands over no
    // stale size or weight.
    const own = /^sf-icon(?:$|--)|^sf-icon-loaded$/;
    return [...glyph.classList].filter((name) => !written.has(name) && !own.test(name)).join(" ");
  }

  template() {
    const result = renderIconTemplate({
      ...this.templateContext(),
      ...this.templateData,
      foreignClass: this.foreignGlyphClasses(),
    });
    this.__sfIconWrittenClass = result.__sfIconClass;
    return result;
  }
}

SfIcon.define("sf-icon");
