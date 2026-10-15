import pageStorage from './page-storage.js';
export function initIconSubsetState(loader) {
  loader.iconFontReady = false;
  loader.iconSubsetPending = false;
  loader.loadedIcons = new Set();
  loader.iconDescriptorStates = new Map();
  loader.iconSubsetReady = false;
  loader.iconSubsetPromise = null;
  loader.iconSubsetNeedsReload = false;
  loader.iconSubsetManifest = null;
  loader.iconSubsetHash = "";
  loader.iconManifestStorageKey = "SF_ICON_SUBSET_MANIFEST";
  loader.iconSubsetManifests = new Map();
  loader.iconSubsetHashes = new Map();
  loader.iconSubsetWarnings = new Set();
  loader.pendingIconScanCount = 0;
  loader.pendingIconFlushQueued = false;
  loader.isSyncingStaticIconState = false;
  loader.staticIconDescriptorKeys = new WeakMap();
  return loader;
}

export function normalizeIconFontLoadWeight(value = "400") {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  const range = normalized.match(/^([1-9]00)\s+([1-9]00)$/);

  if (!range) {
    return normalized || "400";
  }

  const start = Number(range[1]);
  const end = Number(range[2]);
  const minimum = Math.min(start, end);
  const maximum = Math.max(start, end);

  return String(Math.min(maximum, Math.max(minimum, 400)));
}

export function installIconSubsetRuntime(
  SFLoaderPlugin,
  { safeSetItem, safeRemoveItem } = {},
) {
  const normalizeConfigList = (value = []) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (value == null || value === false) {
      return [];
    }

    return [value];
  };

  const iconWeightClassMap = new Map([
    ["sf-icon--weight-thin", "100"],
    ["sf-icon-thin", "100"],
    ["sf-icon--weight-extra-light", "200"],
    ["sf-icon-extra-light", "200"],
    ["sf-icon--weight-light", "300"],
    ["sf-icon-light", "300"],
    ["sf-icon--weight-regular", "400"],
    ["sf-icon-regular", "400"],
    ["sf-icon--weight-medium", "500"],
    ["sf-icon-medium", "500"],
    ["sf-icon--weight-semi-bold", "600"],
    ["sf-icon-semi-bold", "600"],
    ["sf-icon--weight-bold", "700"],
    ["sf-icon-bold", "700"],
  ]);
  const defaultIconWeight = "400";
  const iconTypeClassMap = new Map([
    ["sf-icon--rounded", "rounded"],
    ["sf-icon-rounded", "rounded"],
    ["sf-icon--sharp", "sharp"],
    ["sf-icon-shape", "sharp"],
  ]);
  const iconFamilyTypeMap = new Map([
    ["material symbols outlined", "outlined"],
    ["material symbols rounded", "rounded"],
    ["material symbols sharp", "sharp"],
  ]);
  const iconFallbackFontFiles = Object.freeze({
    outlined: {
      family: "Material Symbols Outlined",
      file: "MaterialSymbols-Outlined.woff2",
      format: "woff2",
      weight: "100 700",
    },
    rounded: {
      family: "Material Icons Round",
      file: "MaterialIconsRound-Regular.otf",
      format: "opentype",
      weight: "400",
    },
    sharp: {
      family: "Material Icons Sharp",
      file: "MaterialIconsSharp-Regular.otf",
      format: "opentype",
      weight: "400",
    },
  });
  const isTruthyIconFlag = (value, fallback = false) => {
    if (value === "" || value === true) return true;
    if (value === false || value == null) return fallback;

    const normalized = String(value).trim().toLowerCase();

    if (!normalized) return true;

    return !["0", "false", "no", "off", "none"].includes(normalized);
  };

  SFLoaderPlugin.prototype.normalizeIconType = function (type = "") {
    const normalized = String(type || "")
      .trim()
      .toLowerCase();

    if (!normalized || normalized === "outlined" || normalized === "outline") {
      return "outlined";
    }

    if (normalized === "shape") {
      return "sharp";
    }

    if (normalized === "rounded" || normalized === "sharp") {
      return normalized;
    }

    return "outlined";
  };

  // The core runtime sets data-sf-icons="subset-pending" so icons wait in the
  // subset family instead of fetching the full font; lifted here once a font
  // that draws them -- the subset or the full-font fallback -- is in place.
  SFLoaderPlugin.prototype.liftIconSubsetPending = function () {
    const root = document.documentElement;
    if (root?.getAttribute("data-sf-icons") === "subset-pending") {
      root.removeAttribute("data-sf-icons");
    }
  };

  SFLoaderPlugin.prototype.isIconSubsetEnabled = function () {
    const configValue = window.SF_BOOT_CONFIG?.icons?.enabled;
    const globalValue = window.SF_ICON_SUBSET_ENABLED;

    if (typeof configValue === "boolean") {
      return configValue;
    }

    if (typeof globalValue === "boolean") {
      return globalValue;
    }

    return true;
  };

  SFLoaderPlugin.prototype.getDefaultIconType = function () {
    return this.normalizeIconType(
      window.SF_BOOT_CONFIG?.icons?.type || window.SF_ICON_TYPE || "outlined",
    );
  };

  SFLoaderPlugin.prototype.getIconManifestStorageKey = function (type = "") {
    const normalizedType = this.normalizeIconType(type);
    return normalizedType === "outlined"
      ? this.iconManifestStorageKey
      : `${this.iconManifestStorageKey}:${normalizedType}`;
  };

  SFLoaderPlugin.prototype.getIconManifestForType = function (type = "") {
    const normalizedType = this.normalizeIconType(type);
    return (
      this.iconSubsetManifests?.get(normalizedType) ||
      (this.iconSubsetManifest &&
      this.getIconManifestType(this.iconSubsetManifest) === normalizedType
        ? this.iconSubsetManifest
        : null)
    );
  };

  SFLoaderPlugin.prototype.setIconManifestForType = function (
    type = "",
    manifest = null,
  ) {
    const normalizedType = this.normalizeIconType(type);
    if (!this.iconSubsetManifests) {
      this.iconSubsetManifests = new Map();
    }
    if (!this.iconSubsetHashes) {
      this.iconSubsetHashes = new Map();
    }

    if (!manifest) {
      this.iconSubsetManifests.delete(normalizedType);
      this.iconSubsetHashes.delete(normalizedType);
    } else {
      this.iconSubsetManifests.set(normalizedType, manifest);
      this.iconSubsetHashes.set(
        normalizedType,
        manifest.hash || manifest.packet_sha256 || "",
      );
    }

    if (normalizedType === this.getDefaultIconType()) {
      this.iconSubsetManifest = manifest;
      this.iconSubsetHash = manifest?.hash || manifest?.packet_sha256 || "";
    }
  };

  SFLoaderPlugin.prototype.getConfiguredIconSubsetConfig = function () {
    const rawConfig =
      window.SF_BOOT_CONFIG?.icons?.staticSubset ||
      window.SF_ICON_STATIC_SUBSET;

    if (!rawConfig || typeof rawConfig !== "object") {
      return null;
    }

    const icons = Array.from(
      new Set(
        normalizeConfigList(rawConfig.icons || rawConfig.icon_names).map(
          (icon) => String(icon || "").trim(),
        ),
      ),
    ).filter(Boolean);

    if (!icons.length) {
      return null;
    }

    const weights = new Set(
      normalizeConfigList(rawConfig.weights || rawConfig.weight).map((item) =>
        String(item).trim(),
      ),
    );
    const fills = new Set(
      normalizeConfigList(rawConfig.fill ?? rawConfig.filled).map((item) =>
        String(item).trim(),
      ),
    );
    const grades = new Set(
      normalizeConfigList(rawConfig.grade).map((item) => String(item).trim()),
    );
    const opticalSizes = new Set(
      normalizeConfigList(
        rawConfig.optical_size ?? rawConfig.opticalSize ?? rawConfig.opsz,
      ).map((item) => String(item).trim()),
    );
    const defaultType = this.normalizeIconType(
      rawConfig.type || this.getDefaultIconType(),
    );
    const types = new Set(
      normalizeConfigList(rawConfig.type || defaultType).map((item) =>
        this.normalizeIconType(item),
      ),
    );

    return {
      icons,
      weights,
      fills,
      grades,
      opticalSizes,
      types,
      fill: fills.size > 0,
      grade: grades.size ? [...grades].join(",") : "",
      opticalSize: opticalSizes.size ? [...opticalSizes].join(",") : "",
      defaultType,
    };
  };

  SFLoaderPlugin.prototype.hasConfiguredIconSubset = function () {
    return Boolean(this.getConfiguredIconSubsetConfig());
  };

  SFLoaderPlugin.prototype.ensureConfiguredIconSubsetState = function (
    options = {},
  ) {
    const config = this.getConfiguredIconSubsetConfig();
    if (!config) {
      return false;
    }

    const { forceLoaded = false } = options;

    config.icons.forEach((icon) => {
      const iconAttrs = this.uniqueIcons.has(icon)
        ? this.uniqueIcons.get(icon)
        : new Map();

      if (config.weights.size) {
        iconAttrs.set("weight", new Set(config.weights));
      }

      if (config.fills.size) {
        iconAttrs.set("filled", new Set(config.fills));
      }

      if (config.grades.size) {
        iconAttrs.set("grade", new Set(config.grades));
      }

      if (config.opticalSizes.size) {
        iconAttrs.set("optical-size", new Set(config.opticalSizes));
      }

      if (config.types.size) {
        iconAttrs.set("type", new Set(config.types));
      }

      if (forceLoaded) {
        iconAttrs.set("loading", true);
      } else if (iconAttrs.get("loading") !== true) {
        iconAttrs.set("loading", false);
      }

      this.uniqueIcons.set(icon, iconAttrs);
    });

    return true;
  };

  SFLoaderPlugin.prototype.getManifestAxisValue = function (
    manifest = {},
    axisName = "",
  ) {
    if (!manifest || !axisName) return "";

    const axes = manifest.axes || {};
    const axis =
      axes[axisName] ||
      axes[axisName.toLowerCase()] ||
      axes[axisName.toUpperCase()];

    if (axis == null) {
      return "";
    }

    if (typeof axis === "object") {
      if (typeof axis.value !== "undefined" && axis.value !== null) {
        return String(axis.value).trim();
      }
      if (typeof axis.raw !== "undefined" && axis.raw !== null) {
        return String(axis.raw).trim();
      }
    }

    return String(axis).trim();
  };

  SFLoaderPlugin.prototype.getManifestAxis = function (
    manifest = {},
    axisName = "",
  ) {
    if (!manifest || !axisName) return null;

    const axes = manifest.axes || {};
    return (
      axes[axisName] ||
      axes[axisName.toLowerCase()] ||
      axes[axisName.toUpperCase()] ||
      null
    );
  };

  SFLoaderPlugin.prototype.manifestAxisIncludesValue = function (
    manifest = {},
    axisName = "",
    value = "",
  ) {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) return true;

    const axis = this.getManifestAxis(manifest, axisName);
    if (axis == null) return true;

    if (typeof axis !== "object") {
      return String(axis).trim() === normalizedValue;
    }

    if (
      typeof axis.value !== "undefined" &&
      axis.value !== null &&
      String(axis.value).trim()
    ) {
      return String(axis.value).trim() === normalizedValue;
    }

    if (Array.isArray(axis.values)) {
      return axis.values
        .map((item) => String(item).trim())
        .includes(normalizedValue);
    }

    const min =
      typeof axis.min !== "undefined" && axis.min !== null
        ? Number(axis.min)
        : null;
    const max =
      typeof axis.max !== "undefined" && axis.max !== null
        ? Number(axis.max)
        : null;
    const numericValue = Number(normalizedValue);

    if (
      min !== null &&
      max !== null &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      !Number.isNaN(numericValue)
    ) {
      return numericValue >= min && numericValue <= max;
    }

    if (typeof axis.raw !== "undefined" && axis.raw !== null) {
      const raw = String(axis.raw).trim();
      if (!raw) return true;

      if (raw.includes(",")) {
        return raw
          .split(",")
          .map((item) => item.trim())
          .includes(normalizedValue);
      }

      return raw === normalizedValue;
    }

    return true;
  };

  SFLoaderPlugin.prototype.isIconCoveredByManifest = function (
    icon = "",
    attrs = {},
  ) {
    const attrType = this.normalizeIconType(
      attrs.type || this.getDefaultIconType(),
    );
    const manifest = this.getIconManifestForType(attrType);
    if (!manifest || typeof manifest !== "object") return false;

    const manifestIcons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!manifestIcons.includes(icon)) return false;

    const manifestType = this.getIconManifestType(manifest);
    if (manifestType !== attrType) {
      return false;
    }

    if (
      attrs.weight &&
      !this.manifestAxisIncludesValue(manifest, "wght", attrs.weight)
    ) {
      return false;
    }

    if (
      attrs.filled &&
      (!this.getManifestAxis(manifest, "FILL") ||
        !this.manifestAxisIncludesValue(manifest, "FILL", attrs.filled))
    ) {
      return false;
    }

    if (
      attrs.grade &&
      !this.manifestAxisIncludesValue(manifest, "GRAD", attrs.grade)
    ) {
      return false;
    }

    if (
      attrs["optical-size"] &&
      !this.manifestAxisIncludesValue(
        manifest,
        "opsz",
        attrs["optical-size"],
      )
    ) {
      return false;
    }

    return true;
  };

  SFLoaderPlugin.prototype.isManifestCoveredByConfiguredSubset = function (
    manifest = {},
  ) {
    const config = this.getConfiguredIconSubsetConfig();
    if (!config) return true;

    const manifestIcons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!config.icons.every((icon) => manifestIcons.includes(icon))) {
      return false;
    }

    const manifestType = this.getIconManifestType(manifest);
    if ([...config.types].some((type) => type !== manifestType)) {
      return false;
    }

    if (
      [...config.weights].some(
        (weight) => !this.manifestAxisIncludesValue(manifest, "wght", weight),
      )
    ) {
      return false;
    }

    if (
      [...config.fills].some(
        (fill) =>
          !this.getManifestAxis(manifest, "FILL") ||
          !this.manifestAxisIncludesValue(manifest, "FILL", fill),
      )
    ) {
      return false;
    }

    if (
      [...config.grades].some(
        (grade) => !this.manifestAxisIncludesValue(manifest, "GRAD", grade),
      )
    ) {
      return false;
    }

    if (
      [...config.opticalSizes].some(
        (size) => !this.manifestAxisIncludesValue(manifest, "opsz", size),
      )
    ) {
      return false;
    }

    return true;
  };

  SFLoaderPlugin.prototype.trackIconDescriptor = function (
    icon = "",
    attrs = {},
  ) {
    if (!this.isIconSubsetEnabled()) return 0;
    if (this.hasConfiguredIconSubset()) return 0;

    const normalizedIcon = String(icon || "").trim();
    if (!normalizedIcon) return 0;

    const loadAttrs = this.getIconLoadAttrs(attrs);
    const descriptorKey = this.getLoadedIconDescriptorKey(
      normalizedIcon,
      loadAttrs,
    );
    if (!this.iconDescriptorStates) {
      this.iconDescriptorStates = new Map();
    }
    const knownDescriptor = this.iconDescriptorStates.get(descriptorKey);
    if (
      knownDescriptor ||
      this.loadedIcons.has(descriptorKey) ||
      this.isIconCoveredByManifest(normalizedIcon, loadAttrs)
    ) {
      return 0;
    }
    this.iconDescriptorStates.set(descriptorKey, {
      attrs: loadAttrs,
      icon: normalizedIcon,
      loading: false,
    });

    const isNewIcon = !this.uniqueIcons.has(normalizedIcon);
    const iconAttrs = isNewIcon
      ? new Map()
      : this.uniqueIcons.get(normalizedIcon);
    let hasNewAttrs = false;

    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null || value === "") return;

      const normalizedValue = String(value).trim();
      if (!normalizedValue) return;

      if (!iconAttrs.has(key)) {
        iconAttrs.set(key, new Set());
        hasNewAttrs = true;
      }

      if (!iconAttrs.get(key).has(normalizedValue)) {
        iconAttrs.get(key).add(normalizedValue);
        hasNewAttrs = true;
      }
    });

    if (this.isIconCoveredByManifest(normalizedIcon, loadAttrs)) {
      iconAttrs.set("loading", true);
      this.uniqueIcons.set(normalizedIcon, iconAttrs);
      return 0;
    }

    if (!isNewIcon && !hasNewAttrs) {
      return 0;
    }

    iconAttrs.set("loading", false);
    this.uniqueIcons.set(normalizedIcon, iconAttrs);
    return 1;
  };

  // Icons a page knows it will draw before it draws them: the ones that come
  // with data, after the first request has gone. Each request returns one
  // whole accumulated font, so an icon found late costs a second font; one
  // declared here goes in the first request, tracked exactly as a scanned one
  // so the scan that finds it later sees it already asked for. Entries are
  // names or {icon, weight, filled, grade, opticalSize, type}.
  const normalizeIconPreloadEntries = (value) =>
    normalizeConfigList(value)
      .map((entry) => {
        if (typeof entry === "string") {
          return { icon: entry.trim(), attrs: {} };
        }
        if (!entry || typeof entry !== "object") return null;
        return {
          icon: String(entry.icon || entry.name || "").trim(),
          attrs: {
            weight: entry.weight,
            filled: isTruthyIconFlag(entry.filled ?? entry.fill)
              ? "1"
              : undefined,
            grade: entry.grade,
            "optical-size": entry.opticalSize ?? entry["optical-size"],
            type: entry.type,
          },
        };
      })
      .filter((entry) => entry?.icon);

  SFLoaderPlugin.prototype.trackIconPreload = function (entries = []) {
    let added = 0;
    normalizeIconPreloadEntries(entries).forEach(({ icon, attrs }) => {
      added += this.trackIconDescriptor(icon, {
        ...attrs,
        weight: attrs.weight ?? defaultIconWeight,
        type: this.normalizeIconType(attrs.type || this.getDefaultIconType()),
      });
    });
    return added;
  };

  SFLoaderPlugin.prototype.preloadIcons = function (entries = []) {
    if (!this.isIconSubsetEnabled()) return 0;

    const added = this.trackIconPreload(entries);
    if (added) {
      this.pendingIconScanCount += added;
      this.flushPendingIconScan();
    }
    return added;
  };

  SFLoaderPlugin.prototype.preloadConfiguredIcons = function () {
    if (this.iconPreloadApplied) return 0;
    this.iconPreloadApplied = true;

    return this.trackIconPreload(
      window.SF_BOOT_CONFIG?.icons?.preload ?? window.SF_ICON_PRELOAD,
    );
  };

  SFLoaderPlugin.prototype.getStaticIconDescriptorKey = function (
    icon = "",
    attrs = {},
  ) {
    const normalizedAttrs = Object.entries(attrs)
      .filter(([, value]) => value != null && value !== "")
      .map(([key, value]) => [key, String(value).trim()])
      .sort(([a], [b]) => a.localeCompare(b));

    return JSON.stringify([String(icon || "").trim(), normalizedAttrs]);
  };

  SFLoaderPlugin.prototype.getIconLoadAttrs = function (attrs = {}) {
    const normalized = {};

    ["weight", "filled", "grade", "optical-size", "type"].forEach((key) => {
      const value = attrs?.[key];
      if (value == null || value === "") {
        return;
      }

      normalized[key] = String(value).trim();
    });

    if (!normalized.weight) {
      normalized.weight = defaultIconWeight;
    }

    if (!normalized.type) {
      normalized.type = this.getDefaultIconType();
    }

    return normalized;
  };

  SFLoaderPlugin.prototype.getLoadedIconDescriptorKey = function (
    icon = "",
    attrs = {},
  ) {
    return this.getStaticIconDescriptorKey(icon, this.getIconLoadAttrs(attrs));
  };

  SFLoaderPlugin.prototype.getLoadedDescriptorKeysForIconState = function (
    icon = "",
    iconAttrs = new Map(),
  ) {
    const iconName = String(icon || "").trim();
    if (!iconName) {
      return [];
    }

    const weights = iconAttrs.get("weight");
    const fills = iconAttrs.get("filled");
    const grades = iconAttrs.get("grade");
    const types = iconAttrs.get("type");

    const weightValues =
      weights instanceof Set && weights.size
        ? [...weights].map((value) => String(value).trim()).filter(Boolean)
        : [defaultIconWeight];
    const fillValues =
      fills instanceof Set && fills.size
        ? [...fills].map((value) => String(value).trim()).filter(Boolean)
        : [""];
    const gradeValues =
      grades instanceof Set && grades.size
        ? [...grades].map((value) => String(value).trim()).filter(Boolean)
        : [""];
    const typeValues =
      types instanceof Set && types.size
        ? [...types]
            .map((value) => this.normalizeIconType(value))
            .filter(Boolean)
        : [this.getDefaultIconType()];

    const keys = new Set();

    weightValues.forEach((weight) => {
      fillValues.forEach((filled) => {
        gradeValues.forEach((grade) => {
          typeValues.forEach((type) => {
            keys.add(
              this.getLoadedIconDescriptorKey(iconName, {
                weight,
                filled,
                grade,
                type,
              }),
            );
          });
        });
      });
    });

    return [...keys];
  };

  SFLoaderPlugin.prototype.isTrackedIconLoaded = function (tracked) {
    if (!tracked?.icon) {
      return false;
    }

    const loadAttrs = this.getIconLoadAttrs(tracked.attrs);

    if (this.isIconCoveredByManifest(tracked.icon, loadAttrs)) {
      return true;
    }

    const descriptorKey = this.getLoadedIconDescriptorKey(
      tracked.icon,
      tracked.attrs,
    );

    return this.loadedIcons.has(descriptorKey);
  };

  SFLoaderPlugin.prototype.getStaticIconElement = function (node) {
    const host =
      node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement || null;
    const iconElement = host?.classList?.contains("sf-icon")
      ? host
      : host?.closest?.(".sf-icon") || null;

    if (!iconElement || iconElement.nodeType !== Node.ELEMENT_NODE) return null;
    if (iconElement.tagName?.toLowerCase?.() === "sf-icon") return null;
    if (!iconElement.classList?.contains("sf-icon")) return null;
    if (iconElement.closest?.("sf-icon")) return null;
    if (this.shouldSkipNode(iconElement)) return null;

    return iconElement;
  };

  SFLoaderPlugin.prototype.isStaticIconLoadedStateCurrent = function (
    el,
    tracked,
  ) {
    if (!el || !tracked) return false;

    return (
      el.classList.contains("sf-icon-loaded") ===
      this.isTrackedIconLoaded(tracked)
    );
  };

  SFLoaderPlugin.prototype.syncTrackedStaticIconElement = function (
    el,
    tracked,
  ) {
    if (!el || !tracked || !this.staticIconDescriptorKeys) return;

    const nextKey = this.getLoadedIconDescriptorKey(
      tracked.icon,
      tracked.attrs,
    );

    const prevKey = this.staticIconDescriptorKeys.get(el);

    if (prevKey && prevKey !== nextKey && !this.isTrackedIconLoaded(tracked)) {
      el.classList.remove("sf-icon-loaded");
    }

    this.staticIconDescriptorKeys.set(el, nextKey);
    return prevKey !== nextKey;
  };

  SFLoaderPlugin.prototype.getTrackedIconAttrs = function (el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

    const icon = String(el.getAttribute("icon") || "").trim();
    if (!icon) return null;

    const attrs = {};
    ["weight", "size", "grade", "optical-size", "type"].forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value != null) {
        attrs[attr] = String(value).trim();
      }
    });

    if (el.hasAttribute("filled")) {
      const value = el.getAttribute("filled");
      if (isTruthyIconFlag(value)) {
        attrs.filled = "1";
      }
    }

    attrs.type = this.normalizeIconType(
      attrs.type || this.getDefaultIconType(),
    );

    return { icon, attrs };
  };

  SFLoaderPlugin.prototype.getTrackedStaticIconAttrs = function (el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    if (!el.classList?.contains("sf-icon")) return null;
    if (el.closest?.("sf-icon")) return null;

    const icon = String(
      el.getAttribute("data-icon") || el.textContent || "",
    ).trim();
    if (!icon) return null;

    const attrs = {
      weight: defaultIconWeight,
    };

    const sizeClass = Array.from(el.classList).find((className) =>
      className.startsWith("sf-icon--size-"),
    );
    if (sizeClass) {
      attrs.size = sizeClass.replace("sf-icon--size-", "").trim();
    }

    for (const [className, weight] of iconWeightClassMap.entries()) {
      if (el.classList.contains(className)) {
        attrs.weight = weight;
        break;
      }
    }

    for (const [className, type] of iconTypeClassMap.entries()) {
      if (el.classList.contains(className)) {
        attrs.type = type;
        break;
      }
    }

    const attrWeight =
      el.getAttribute("data-weight") ||
      el.getAttribute("weight") ||
      el.style?.getPropertyValue?.("--sf-icon--weight");
    if (attrWeight) {
      attrs.weight = String(attrWeight).trim();
    }

    const styleFill = String(
      el.style?.getPropertyValue?.("--sf-icon--fill") || "",
    ).trim();
    const isFilled =
      el.classList.contains("sf-icon--filled") ||
      el.classList.contains("sf-icon-filled") ||
      (el.hasAttribute("data-filled") &&
        isTruthyIconFlag(el.getAttribute("data-filled"))) ||
      (el.hasAttribute("filled") &&
        isTruthyIconFlag(el.getAttribute("filled"))) ||
      // An unset --sf-icon--fill reads as "", which the flag parser takes for
      // a bare attribute -- true -- so every static icon was tracked as
      // filled and the subset was asked for the FILL axis it never drew.
      (styleFill !== "" && isTruthyIconFlag(styleFill, false));

    if (isFilled) {
      attrs.filled = "1";
    }

    const attrType =
      el.getAttribute("data-type") ||
      el.getAttribute("type") ||
      el.style?.getPropertyValue?.("--sf-icon--type");
    if (attrType) {
      attrs.type = this.normalizeIconType(attrType);
    }

    return { icon, attrs };
  };

  SFLoaderPlugin.prototype.trackIconComponent = function (el) {
    if (!this.isIconSubsetEnabled()) return 0;

    const tracked = this.getTrackedStaticIconAttrs(el);
    if (!tracked) return 0;

    const didDescriptorChange = this.syncTrackedStaticIconElement(el, tracked);
    if (
      !didDescriptorChange &&
      this.isStaticIconLoadedStateCurrent(el, tracked)
    ) {
      return 0;
    }

    return this.trackIconDescriptor(tracked.icon, tracked.attrs);
  };

  SFLoaderPlugin.prototype.processStaticIconMutation = function (
    node,
    autoLoad = true,
  ) {
    if (!this.isIconSubsetEnabled()) {
      return { handled: false, iconCount: 0 };
    }

    const iconElement = this.getStaticIconElement(node);
    if (!iconElement) {
      return { handled: false, iconCount: 0 };
    }

    const tracked = this.getTrackedStaticIconAttrs(iconElement);
    if (!tracked) {
      this.staticIconDescriptorKeys?.delete?.(iconElement);
      iconElement.classList.remove("sf-icon-loaded");
      return { handled: true, iconCount: 0 };
    }

    const iconCount = this.trackIconComponent(iconElement);

    if (autoLoad && iconCount > 0) {
      this.mutate(() => this.loadFonts());
      return { handled: true, iconCount };
    }

    this.syncStaticIconLoadedState(iconElement);

    return { handled: true, iconCount };
  };

  SFLoaderPlugin.prototype.syncStaticIconLoadedState = function (root = null) {
    if (!this.isIconSubsetEnabled()) return;

    const host = root || document.body;
    if (!host) return;

    const updateLoadedClass = (el, shouldBeLoaded) => {
      const hasLoadedClass = el.classList.contains("sf-icon-loaded");
      if (hasLoadedClass === shouldBeLoaded) {
        return;
      }

      if (shouldBeLoaded) {
        el.classList.add("sf-icon-loaded");
      } else {
        el.classList.remove("sf-icon-loaded");
      }
    };

    const processNode = (el) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      if (el.tagName?.toLowerCase?.() === "sf-icon") return;
      if (el.closest?.("sf-icon")) return;
      if (!el.classList?.contains("sf-icon")) return;

      const tracked = this.getTrackedStaticIconAttrs(el);
      if (!tracked) {
        updateLoadedClass(el, false);
        return;
      }

      updateLoadedClass(el, this.isTrackedIconLoaded(tracked));
    };

    this.isSyncingStaticIconState = true;
    try {
      if (host.nodeType === Node.ELEMENT_NODE) {
        processNode(host);
      }

      if (host.querySelectorAll) {
        host.querySelectorAll(".sf-icon").forEach(processNode);
      }
    } finally {
      this.isSyncingStaticIconState = false;
    }
  };

  SFLoaderPlugin.prototype.scanStaticIcons = function (
    root = null,
    autoLoad = true,
  ) {
    if (!this.isIconSubsetEnabled()) {
      return { iconCount: 0 };
    }

    const host =
      root?.nodeType === Node.ELEMENT_NODE
        ? root
        : root?.parentElement || document.body;

    if (!host) {
      return { iconCount: 0 };
    }

    if (this.shouldSkipNode(host)) {
      return { iconCount: 0 };
    }

    if (this.hasConfiguredIconSubset()) {
      this.syncStaticIconLoadedState(host);
      return { iconCount: 0 };
    }

    let iconItemCount = 0;
    const processNode = (el) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE || this.shouldSkipNode(el)) {
        return;
      }
      iconItemCount += this.trackIconComponent(el);
    };

    if (host.nodeType === Node.ELEMENT_NODE) {
      processNode(host);
    }

    if (host.querySelectorAll) {
      host.querySelectorAll(".sf-icon").forEach(processNode);
    }
    const result = { iconCount: iconItemCount };

    if (autoLoad && iconItemCount > 0) {
      this.mutate(() => this.loadFonts());
      return result;
    }

    this.syncStaticIconLoadedState(host);

    return result;
  };

  SFLoaderPlugin.prototype.trackIconElement = function (el) {
    if (!this.isIconSubsetEnabled()) return 0;

    const tracked = this.getTrackedIconAttrs(el);
    if (!tracked) return 0;

    return this.trackIconDescriptor(tracked.icon, tracked.attrs);
  };

  SFLoaderPlugin.prototype.trackPendingIconScan = function (scanResult = {}) {
    if (!this.isIconSubsetEnabled()) return 0;

    const iconCount = Number(scanResult.iconCount || 0);
    if (iconCount > 0) {
      this.pendingIconScanCount += iconCount;
    }
    return iconCount;
  };

  SFLoaderPlugin.prototype.markManifestIconsAsLoaded = function (
    manifest = {},
  ) {
    if (!manifest || typeof manifest !== "object") return false;

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!icons.length) return false;

    const loadedDescriptorKeys = new Set(this.loadedIcons);
    const manifestType = this.getIconManifestType(manifest);
    const weightAxis = this.getManifestAxis(manifest, "wght");
    const fillAxis = this.getManifestAxis(manifest, "FILL");

    const weights = Array.isArray(weightAxis?.values)
      ? weightAxis.values
      : weightAxis?.value
        ? [weightAxis.value]
        : [400];
    const fills = Array.isArray(fillAxis?.values)
      ? fillAxis.values
      : fillAxis?.value
        ? [fillAxis.value]
        : [""];

    icons.forEach((icon) => {
      weights.forEach((weight) => {
        fills.forEach((filled) => {
          loadedDescriptorKeys.add(
            this.getLoadedIconDescriptorKey(icon, {
              weight,
              filled,
              type: manifestType,
            }),
          );
        });
      });
    });

    this.loadedIcons = loadedDescriptorKeys;
    return true;
  };

  SFLoaderPlugin.prototype.flushPendingIconScan = function ({
    defer = false,
  } = {}) {
    if (!this.isIconSubsetEnabled()) return false;

    const iconCount = this.pendingIconScanCount;

    if (!iconCount) {
      return false;
    }

    if (defer) {
      // Deferred, not dropped. The caller defers when the same batch of
      // mutations also loads modules, so the fetch waits for them -- but the
      // count stayed pending and nothing flushed it afterwards, so a glyph that
      // appeared alongside a new component never arrived at all. Entering a mode
      // that draws both at once is exactly that: the handles, the eyes and the
      // arrows stayed blank squares until some later, unrelated mutation
      // happened to flush them, and usually none did.
      if (!this.pendingIconFlushQueued) {
        this.pendingIconFlushQueued = true;
        this.mutate(() => {
          this.pendingIconFlushQueued = false;
          this.flushPendingIconScan();
        });
      }
      return false;
    }

    this.pendingIconScanCount = 0;
    this.mutate(() => this.loadFonts());
    return true;
  };

  SFLoaderPlugin.prototype.handleCustomElementScanResult = function (
    scanResult = {},
    autoLoad = true,
  ) {
    const normalized = {
      ...scanResult,
      keys: Array.isArray(scanResult.keys) ? scanResult.keys : [],
      count: Number(scanResult.count || 0),
      iconCount: Number(scanResult.iconCount || 0),
    };

    if (!autoLoad) {
      return normalized;
    }

    if (normalized.count > 0) {
      this.mutate(() => this.getLoader(this.module, true));
    }

    if (this.isIconSubsetEnabled() && normalized.iconCount > 0) {
      this.mutate(() => this.loadFonts());
    }

    return normalized;
  };

  SFLoaderPlugin.prototype.getIconSubsetHost = function () {
    return (
      window.SF_BOOT_CONFIG?.icons?.subsetHost ||
      window.SF_ICON_SUBSET_HOST ||
      "https://icons.simai.io"
      // 'http://127.0.0.1:3189'
    );
  };

  SFLoaderPlugin.prototype.decodeIconManifestHeader = function (
    manifestRaw = "",
  ) {
    if (!manifestRaw) return null;

    try {
      return JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob(manifestRaw.replace(/-/g, "+").replace(/_/g, "/")),
            (char) => char.charCodeAt(0),
          ),
        ),
      );
    } catch (error) {
      console.warn("SFLoader icon manifest decode failed", error);
      return null;
    }
  };

  SFLoaderPlugin.prototype.getStoredIconManifest = function (type = "") {
    const raw = pageStorage().getItem(this.getIconManifestStorageKey(type));

    if (!raw) return null;

    try {
      const manifest = JSON.parse(raw);
      return manifest && typeof manifest === "object" ? manifest : null;
    } catch (error) {
      console.warn("SFLoader icon manifest cache parse failed", error);
      return null;
    }
  };

  SFLoaderPlugin.prototype.getIconManifestFontFamily = function (
    manifest = {},
  ) {
    if (manifest.font_family) return String(manifest.font_family);

    return `${
      (manifest.schema === "sf.icon_subset.v1"
        ? iconFallbackFontFiles[this.getIconManifestType(manifest)]?.family
        : manifest.family) || "Material Symbols Outlined"
    } Subset`;
  };

  SFLoaderPlugin.prototype.getIconManifestType = function (manifest = {}) {
    const manifestType = String(
      manifest.type ||
        (manifest.schema === "sf.icon_subset.v1" ? manifest.family : "") ||
        "",
    )
      .trim()
      .toLowerCase();
    if (manifestType) {
      return this.normalizeIconType(manifestType);
    }

    const familyKey = String(manifest.family || "")
      .trim()
      .toLowerCase();
    return this.normalizeIconType(
      iconFamilyTypeMap.get(familyKey) || "outlined",
    );
  };

  SFLoaderPlugin.prototype.getIconSubsetSelector = function (manifest = {}) {
    const type = this.getIconManifestType(manifest);

    if (type === "rounded") {
      return ".sf-icon:is(.sf-icon--rounded, .sf-icon-rounded)";
    }

    if (type === "sharp") {
      return ".sf-icon:is(.sf-icon--sharp, .sf-icon-shape)";
    }

    return ".sf-icon:not(.sf-icon--rounded):not(.sf-icon-rounded):not(.sf-icon--sharp):not(.sf-icon-shape)";
  };

  SFLoaderPlugin.prototype.getIconFallbackFontUrl = function (type = "") {
    const fallbackFonts =
      window.SF_BOOT_CONFIG?.icons?.fallbackFonts ||
      window.SF_ICON_FALLBACK_FONTS ||
      {};
    const normalizedType = this.normalizeIconType(type);
    const configuredUrl =
      fallbackFonts[normalizedType] ||
      fallbackFonts.outlined ||
      window.SF_BOOT_CONFIG?.icons?.fallbackFontUrl ||
      window.SF_ICON_FALLBACK_FONT_URL;

    if (configuredUrl) {
      return configuredUrl;
    }

    const file = iconFallbackFontFiles[normalizedType]?.file;
    const root = String(window.sfPath || "").replace(/\/+$/, "");
    if (!file || !root) {
      return "";
    }

    return `${root}/component/icons/fonts/${file}`;
  };

  SFLoaderPlugin.prototype.buildIconFallbackCss = function (options = {}) {
    const type = this.normalizeIconType(
      options.type || this.getDefaultIconType(),
    );
    const url = this.getIconFallbackFontUrl(type);
    const fallbackFont = iconFallbackFontFiles[type];
    if (!url || !fallbackFont) {
      return "";
    }
    const selector = this.getIconSubsetSelector({
      type,
      family: fallbackFont.family,
    });

    return (
      `@font-face {\n` +
      `  font-family: '${fallbackFont.family}';\n` +
      `  src: url('${url}') format('${fallbackFont.format}');\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${fallbackFont.weight};\n` +
      `  font-display: block;\n` +
      `}\n\n` +
      `${selector} {\n` +
      `  --sf-icon--font-family: '${fallbackFont.family}';\n` +
      `  font-family: '${fallbackFont.family}';\n` +
      `  font-feature-settings: 'liga';\n` +
      `  font-variation-settings: ` +
      `'FILL' var(--sf-icon--fill, 0), ` +
      `'wght' var(--sf-icon--weight, 400), ` +
      `'GRAD' var(--sf-icon--grade, 0), ` +
      `'opsz' var(--sf-icon--optical-size, 24);\n` +
      `}\n`
    );
  };

  SFLoaderPlugin.prototype.applyIconFontFallback = function (options = {}) {
    const icons = Array.isArray(options.icons) ? options.icons : [];
    const type = this.normalizeIconType(
      options.type || this.getDefaultIconType(),
    );
    const prev = document.querySelector(
      `style[data-sf-icons-fallback="${type}"]`,
    );
    const style = document.createElement("style");
    style.setAttribute("data-sf-icons-fallback", type);
    if (icons.length) {
      style.setAttribute("data-sf-icons-fallback-icons", icons.join(","));
    }
    style.textContent = this.buildIconFallbackCss({ type });
    if (!style.textContent) {
      return false;
    }
    document.head.appendChild(style);
    if (prev) {
      prev.remove();
    }

    const loadedDescriptorKeys = new Set(this.loadedIcons);
    icons.forEach((icon) => {
      const iconAttrs = this.uniqueIcons.has(icon)
        ? this.uniqueIcons.get(icon)
        : new Map();
      iconAttrs.set("loading", true);
      this.uniqueIcons.set(icon, iconAttrs);
      this.getLoadedDescriptorKeysForIconState(icon, iconAttrs).forEach((key) =>
        loadedDescriptorKeys.add(key),
      );
    });
    this.loadedIcons = loadedDescriptorKeys;
    this.iconSubsetPending = false;
    this.iconSubsetReady = true;
    this.iconFontReady = true;
    this.liftIconSubsetPending();
    document.body?.classList?.add("sf-icons-loaded");
    this.syncStaticIconLoadedState();

    const warningKey = `fallback:${type}`;
    if (!this.iconSubsetWarnings?.has(warningKey)) {
      this.iconSubsetWarnings?.add(warningKey);
      console.warn("SFLoader icon subset font fallback applied", {
        type,
        icons,
        reason: options.reason || null,
        url: this.getIconFallbackFontUrl(type),
      });
    }

    window.dispatchEvent(
      new CustomEvent("sf-icons-subset:ready", {
        detail: {
          icons: new Set(icons),
          weights: [],
          loader: this,
          fallback: true,
        },
      }),
    );

    return true;
  };

  SFLoaderPlugin.prototype.buildIconSubsetCssFromManifest = function (
    manifest = {},
  ) {
    const fonts = Array.isArray(manifest.fonts) ? manifest.fonts : [];
    if (!fonts.length) {
      return { cssText: "", family: "", weights: [] };
    }

    const family = this.getIconManifestFontFamily(manifest);
    const selector = this.getIconSubsetSelector(manifest);
    const weights = new Set();

    const fontFaces = fonts
      .filter((font) => font?.url)
      .map((font) => {
        const weight = font.weight || manifest.axes?.wght?.value || 400;
        weights.add(String(weight));

        return (
          `@font-face {\n` +
          `  font-family: '${family}';\n` +
          `  src: url('${font.url}') format('woff2');\n` +
          `  font-style: normal;\n` +
          `  font-weight: ${weight};\n` +
          `  font-display: block;\n` +
          `}\n`
        );
      })
      .join("\n");

    if (!fontFaces) {
      return { cssText: "", family, weights: [...weights] };
    }

    const cssText =
      fontFaces +
      `\n` +
      `${selector} {\n` +
      `  --sf-icon--font-family: '${family}';\n` +
      `  --sf-icon--font--weight: var(--sf-icon--weight, 400);\n` +
      `  font-feature-settings: 'liga';\n` +
      `  font-variation-settings: ` +
      `'FILL' var(--sf-icon--fill, 0), ` +
      `'wght' var(--sf-icon--weight, 400), ` +
      `'GRAD' var(--sf-icon--grade, 0), ` +
      `'opsz' var(--sf-icon--optical-size, 24);\n` +
      `}\n`;

    return {
      cssText,
      weights: [...weights],
    };
  };

  SFLoaderPlugin.prototype.applyIconManifest = function (
    manifest = {},
    options = {},
  ) {
    if (!this.isIconSubsetEnabled()) return false;

    if (!manifest || typeof manifest !== "object") return false;
    const { cssText: builtCssText, weights } =
      this.buildIconSubsetCssFromManifest(manifest);
    const cssText = options.cssText || builtCssText;
    if (!cssText) return false;

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const type = this.getIconManifestType(manifest);
    const prev = document.querySelector(
      `style[data-sf-icons-subset-family="${type}"]`,
    );
    const style = document.createElement("style");
    style.setAttribute("data-sf-icons-subset", icons.join(","));
    style.setAttribute("data-sf-icons-subset-family", type);
    if (manifest.hash) {
      style.setAttribute("data-sf-icons-subset-hash", manifest.hash);
    }
    style.textContent = cssText;
    this.setIconManifestForType(type, manifest);
    this.markManifestIconsAsLoaded(manifest);
    this.iconSubsetPending = true;
    this.iconSubsetReady = false;
    document.head.appendChild(style);

    const fontVerification =
      Array.isArray(manifest.fonts) && manifest.fonts.length
      ? this.verifyIconManifestFonts(manifest, { icons, weights })
      : this.verifyIconCssFonts(cssText, { icons });
    this.iconSubsetPromise = fontVerification
      .then(async () => {
        this.ensureConfiguredIconSubsetState({ forceLoaded: true });
        icons.forEach((icon) => {
          const iconAttrs = this.uniqueIcons.has(icon)
            ? this.uniqueIcons.get(icon)
            : new Map();
          const keepDirtyState = iconAttrs.get("loading") === false;

          if (!keepDirtyState) {
            iconAttrs.set("loading", true);
          }

          if (weights.length) {
            if (!iconAttrs.has("weight")) {
              iconAttrs.set("weight", new Set());
            }

            weights.forEach((weight) => {
              iconAttrs.get("weight").add(String(weight));
            });
          }

          this.uniqueIcons.set(icon, iconAttrs);
        });

        const loadedDescriptorKeys = new Set(this.loadedIcons);
        icons.forEach((icon) => {
          const iconAttrs = this.uniqueIcons.get(icon);
          this.getLoadedDescriptorKeysForIconState(icon, iconAttrs).forEach(
            (key) => loadedDescriptorKeys.add(key),
          );
        });
        this.loadedIcons = loadedDescriptorKeys;
        this.iconSubsetPending = false;
        this.iconSubsetReady = true;
        this.liftIconSubsetPending();

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (prev) {
          prev.remove();
        }

        window.dispatchEvent(
          new CustomEvent("sf-icons-subset:ready", {
            detail: {
              icons: new Set(icons),
              weights,
              loader: this,
              fromCache: !!options.fromCache,
            },
          }),
        );
        this.syncStaticIconLoadedState();
      })
      .catch((error) => {
        this.iconSubsetPending = false;
        this.iconSubsetReady = false;
        this.setIconManifestForType(type, null);
        style.remove();
        safeRemoveItem?.(this.getIconManifestStorageKey(type));
        console.warn("SFLoader cached icon manifest failed", error);
        this.applyIconFontFallback({
          icons,
          type: this.getIconManifestType(manifest),
          reason: error,
        });
        if (!options.fromCache) {
          void this.loadFonts();
        }
      })
      .finally(() => {
        const needsReload = this.iconSubsetNeedsReload;
        this.iconSubsetNeedsReload = false;
        this.iconSubsetPromise = null;

        if (needsReload) {
          void this.loadFonts();
        }
      });

    return true;
  };

  SFLoaderPlugin.prototype.verifyIconManifestFonts = async function (
    manifest = {},
    options = {},
  ) {
    if (!this.isIconSubsetEnabled()) {
      return false;
    }

    const icons =
      options.icons || (Array.isArray(manifest.icons) ? manifest.icons : []);
    const fonts = Array.isArray(manifest.fonts) ? manifest.fonts : [];

    if (!icons.length || !fonts.length) {
      throw new Error("Icon manifest has no icons or fonts");
    }

    if (!document.fonts?.load) {
      return true;
    }

    const family = this.getIconManifestFontFamily(manifest);
    const sampleText = icons.join(" ");

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const results = await Promise.all(
      fonts.map((font) => {
        const weight = normalizeIconFontLoadWeight(
          font.weight || manifest.axes?.wght?.value || defaultIconWeight,
        );
        return document.fonts.load(`${weight} 16px "${family}"`, sampleText);
      }),
    );

    const loadedCount = results.reduce(
      (sum, fontFaces) => sum + fontFaces.length,
      0,
    );

    if (!loadedCount) {
      throw new Error("Icon manifest fonts were not loaded");
    }

    if (document.fonts.ready) {
      await document.fonts.ready;
    }

    return true;
  };

  SFLoaderPlugin.prototype.extractIconFontFacesFromCss = function (
    cssText = "",
  ) {
    const fontFaces = [];
    const blocks = String(cssText || "").match(/@font-face\s*{[^}]*}/gim) || [];

    blocks.forEach((block) => {
      const familyMatch = block.match(
        /font-family\s*:\s*['"]?([^;'"}]+)['"]?/i,
      );
      const weightMatch = block.match(/font-weight\s*:\s*([^;]+)/i);
      const family = familyMatch?.[1]?.trim();

      if (!family) {
        return;
      }

      fontFaces.push({
        family,
        weight: weightMatch?.[1]?.trim() || defaultIconWeight,
      });
    });

    return fontFaces;
  };

  SFLoaderPlugin.prototype.extractIconFontFaceCss = function (cssText = "") {
    return (String(cssText || "").match(/@font-face\s*{[^}]*}/gim) || []).join(
      "\n",
    );
  };

  SFLoaderPlugin.prototype.verifyIconCssFonts = async function (
    cssText = "",
    options = {},
  ) {
    if (!this.isIconSubsetEnabled()) {
      return false;
    }

    if (!document.fonts?.load) {
      return true;
    }

    const icons = options.icons || [];
    const sampleText = Array.isArray(icons)
      ? icons.join(" ")
      : String(icons || "");
    const fontFaces = this.extractIconFontFacesFromCss(cssText);

    if (!fontFaces.length || !sampleText) {
      return true;
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const results = await Promise.all(
      fontFaces.map(({ family, weight }) =>
        document.fonts.load(
          `${normalizeIconFontLoadWeight(weight)} 16px "${family}"`,
          sampleText,
        ),
      ),
    );

    const loadedCount = results.reduce(
      (sum, fontFaceList) => sum + fontFaceList.length,
      0,
    );

    if (!loadedCount) {
      throw new Error("Icon subset CSS fonts were not loaded");
    }

    if (document.fonts.ready) {
      await document.fonts.ready;
    }

    return true;
  };

  SFLoaderPlugin.prototype.restoreIconManifestFromCache = function () {
    if (!this.isIconSubsetEnabled()) return false;

    const currentDefaultType = this.getIconSubsetRequestConfig().defaultType;
    const manifest = this.getStoredIconManifest(currentDefaultType);
    if (!manifest) return false;

    const manifestType = this.getIconManifestType(manifest);
    if (
      manifestType !== currentDefaultType ||
      !this.isManifestCoveredByConfiguredSubset(manifest)
    ) {
      safeRemoveItem?.(this.getIconManifestStorageKey(currentDefaultType));
      this.setIconManifestForType(currentDefaultType, null);
      return false;
    }

    return this.applyIconManifest(manifest, { fromCache: true });
  };

  SFLoaderPlugin.prototype.getIconSubsetRequestConfig = function () {
    const accumulate = window.SF_BOOT_CONFIG?.icons?.accumulate === true;

    if (!this.isIconSubsetEnabled()) {
      return {
        icons: [],
        weights: new Set(),
        fill: false,
        types: new Set(),
        defaultType: this.getDefaultIconType(),
        accumulate,
      };
    }

    const configured = this.getConfiguredIconSubsetConfig();
    if (configured) {
      this.ensureConfiguredIconSubsetState();
      return {
        icons: configured.icons,
        weights: configured.weights,
        fill: configured.fill,
        grade: configured.grade,
        opticalSize: configured.opticalSize,
        types: configured.types,
        defaultType: configured.defaultType,
        accumulate,
      };
    }

    const icons = [...this.uniqueIcons.keys()];
    const weights = new Set();
    const types = new Set();
    let fill = false;
    const grades = new Set();
    const opticalSizes = new Set();
    const defaultType = this.getDefaultIconType();

    this.uniqueIcons.forEach((attrs) => {
      const weight = attrs.get("weight");
      const filled = attrs.get("filled");
      const grade = attrs.get("grade");
      const opticalSize = attrs.get("optical-size");
      const type = attrs.get("type");

      if (filled) {
        fill = true;
      }

      if (type) {
        const normalizedTypes =
          type instanceof Set || Array.isArray(type) ? type : [type];

        normalizedTypes.forEach((item) => {
          const normalizedType = this.normalizeIconType(item);
          if (normalizedType !== defaultType) {
            types.add(normalizedType);
          }
        });
      }

      if (!weight) {
        if (grade instanceof Set || Array.isArray(grade)) {
          grade.forEach((item) => grades.add(String(item)));
        } else if (grade) {
          grades.add(String(grade));
        }
        if (opticalSize instanceof Set || Array.isArray(opticalSize)) {
          opticalSize.forEach((item) => opticalSizes.add(String(item)));
        } else if (opticalSize) {
          opticalSizes.add(String(opticalSize));
        }
        return;
      }

      if (weight instanceof Set || Array.isArray(weight)) {
        weight.forEach((item) => weights.add(String(item)));
      } else {
        weights.add(String(weight));
      }

      if (grade instanceof Set || Array.isArray(grade)) {
        grade.forEach((item) => grades.add(String(item)));
      } else if (grade) {
        grades.add(String(grade));
      }
      if (opticalSize instanceof Set || Array.isArray(opticalSize)) {
        opticalSize.forEach((item) => opticalSizes.add(String(item)));
      } else if (opticalSize) {
        opticalSizes.add(String(opticalSize));
      }
    });

    return {
      icons,
      weights,
      fill,
      grade: grades.size ? [...grades].join(",") : "",
      opticalSize: opticalSizes.size ? [...opticalSizes].join(",") : "",
      types,
      defaultType,
      accumulate,
    };
  };

  SFLoaderPlugin.prototype.bootstrapConfiguredIconSubset = function () {
    if (!this.isIconSubsetEnabled()) return false;
    if (!this.hasConfiguredIconSubset()) return false;

    this.ensureConfiguredIconSubsetState();

    if (
      this.iconSubsetPending ||
      this.iconSubsetReady ||
      this.iconSubsetPromise
    ) {
      return true;
    }

    this.mutate(() => this.loadFonts());
    return true;
  };

  SFLoaderPlugin.prototype.getIconSubsetRequestConfigs = function () {
    const baseConfig = this.getIconSubsetRequestConfig();
    const configs = new Map();
    const getConfig = (type) => {
      const normalizedType = this.normalizeIconType(type);
      if (!configs.has(normalizedType)) {
        configs.set(normalizedType, {
          accumulate: baseConfig.accumulate,
          defaultType: normalizedType,
          fill: false,
          grade: new Set(),
          opticalSize: new Set(),
          icons: new Set(),
          weights: new Set(),
        });
      }
      return configs.get(normalizedType);
    };

    this.uniqueIcons.forEach((attrs, icon) => {
      const rawTypes = attrs.get("type");
      const types = rawTypes instanceof Set || Array.isArray(rawTypes)
        ? [...rawTypes]
        : [rawTypes || baseConfig.defaultType];
      const rawWeights = attrs.get("weight");
      const weights = rawWeights instanceof Set || Array.isArray(rawWeights)
        ? [...rawWeights]
        : rawWeights ? [rawWeights] : [];
      const rawGrades = attrs.get("grade");
      const grades = rawGrades instanceof Set || Array.isArray(rawGrades)
        ? [...rawGrades]
        : rawGrades ? [rawGrades] : [];
      const rawOpticalSizes = attrs.get("optical-size");
      const opticalSizes =
        rawOpticalSizes instanceof Set || Array.isArray(rawOpticalSizes)
          ? [...rawOpticalSizes]
          : rawOpticalSizes
            ? [rawOpticalSizes]
            : [];

      types.forEach((type) => {
        const config = getConfig(type);
        config.icons.add(icon);
        weights.forEach((weight) => config.weights.add(String(weight)));
        grades.forEach((grade) => config.grade.add(String(grade)));
        opticalSizes.forEach((size) => config.opticalSize.add(String(size)));
        if (attrs.get("filled")) {
          config.fill = true;
        }
      });
    });

    if (!configs.size && baseConfig.icons.length) {
      const types = baseConfig.types?.size
        ? [...baseConfig.types]
        : [baseConfig.defaultType];
      types.forEach((type) => {
        const config = getConfig(type);
        baseConfig.icons.forEach((icon) => config.icons.add(icon));
        baseConfig.weights.forEach((weight) => config.weights.add(weight));
        String(baseConfig.grade || "")
          .split(",")
          .filter(Boolean)
          .forEach((grade) => config.grade.add(grade));
        String(baseConfig.opticalSize || "")
          .split(",")
          .filter(Boolean)
          .forEach((size) => config.opticalSize.add(size));
        config.fill = baseConfig.fill;
      });
    }

    return [...configs.values()]
      .map((config) => ({
        ...config,
        grade: [...config.grade].sort().join(","),
        opticalSize: [...config.opticalSize].sort().join(","),
        icons: [...config.icons].sort(),
      }))
      .sort((left, right) =>
        left.defaultType.localeCompare(right.defaultType),
      );
  };

  SFLoaderPlugin.prototype.loadIconSubsetFamily = async function (
    requestConfig,
  ) {
    const { defaultType: type, icons } = requestConfig;
    if (!icons.length) return false;

    const host = this.getIconSubsetHost();
    const query = new URLSearchParams({
      icon_names: icons.join(","),
      type,
    });
    if (requestConfig.weights.size) {
      query.set("weight", [...requestConfig.weights].sort().join(","));
    }
    if (requestConfig.fill) query.set("fill", "1");
    if (requestConfig.grade) query.set("grade", requestConfig.grade);
    if (requestConfig.opticalSize) {
      query.set("optical_size", requestConfig.opticalSize);
    }
    if (requestConfig.accumulate) query.set("accumulate", "true");

    let manifest = null;
    let appliedStyle = null;
    try {
      const response = await fetch(`${host}/ms/css?${query.toString()}`, {
        cache: "reload",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest = this.decodeIconManifestHeader(
        response.headers.get("X-SIMAI-Font-Manifest"),
      );
      const cssText = await response.text();
      const manifestType = manifest
        ? this.getIconManifestType(manifest)
        : type;
      if (manifest && manifestType !== type) {
        throw new Error(
          `Icon subset family mismatch: requested ${type}, received ${manifestType}`,
        );
      }

      const previous = document.querySelector(
        `style[data-sf-icons-subset-family="${type}"]`,
      );
      const style = document.createElement("style");
      style.setAttribute("data-sf-icons-subset", icons.join(","));
      style.setAttribute("data-sf-icons-subset-family", type);
      style.textContent = cssText;
      document.head.appendChild(style);
      appliedStyle = style;

      if (manifest) {
        safeSetItem?.(
          this.getIconManifestStorageKey(type),
          JSON.stringify(manifest),
        );
        this.setIconManifestForType(type, manifest);
        this.markManifestIconsAsLoaded(manifest);
        if (Array.isArray(manifest.fonts) && manifest.fonts.length) {
          await this.verifyIconManifestFonts(manifest, { icons });
        } else {
          await this.verifyIconCssFonts(cssText, { icons });
        }
      } else {
        await this.verifyIconCssFonts(cssText, { icons });
      }
      if (document.fonts?.ready) await document.fonts.ready;
      this.liftIconSubsetPending();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      previous?.remove?.();

      return true;
    } catch (error) {
      appliedStyle?.remove?.();
      this.setIconManifestForType(type, null);
      safeRemoveItem?.(this.getIconManifestStorageKey(type));
      return this.applyIconFontFallback({ icons, reason: error, type });
    }
  };

  SFLoaderPlugin.prototype.loadFonts = async function () {
    if (!this.isIconSubsetEnabled()) {
      return false;
    }

    // The first request waits for the page's first ready. Sent with the first
    // icon scanned, it asked for one glyph; the page's other icons, scanned a
    // moment later, then waited for that font to arrive before they could be
    // asked for, and every request returns a whole font -- two fonts in a row
    // before the page showed its icons. A frame after ready, the elements have
    // drawn theirs and one request carries them all. A page that is slow to
    // become ready sends it on the timer.
    if (this.eventSend === false && !this.iconFirstRequestReleased) {
      if (!this.iconFirstRequestHeld) {
        this.iconFirstRequestHeld = new Promise((resolve) => {
          let timer = 0;
          const release = () => {
            window.removeEventListener("sf-loader-ready", release);
            clearTimeout(timer);
            requestAnimationFrame(() => setTimeout(resolve, 0));
          };
          timer = setTimeout(release, 2500);
          window.addEventListener("sf-loader-ready", release);
        }).then(() => {
          this.iconFirstRequestReleased = true;
          this.iconFirstRequestHeld = null;
          return this.loadFonts();
        });
      }
      return this.iconFirstRequestHeld;
    }

    this.ensureConfiguredIconSubsetState();
    this.preloadConfiguredIcons();

    if (this.iconSubsetPending && this.iconSubsetPromise) {
      this.iconSubsetNeedsReload = true;
      return this.iconSubsetPromise;
    }

    const unloadedIcons = Array.from(this.uniqueIcons).filter(
      ([, attrs]) => attrs.get("loading") === false,
    );
    const unloadedDescriptors = Array.from(
      this.iconDescriptorStates || new Map(),
    ).filter(([, descriptor]) => descriptor.loading === false);
    if (!unloadedIcons.length && !unloadedDescriptors.length) {
      return this.iconSubsetPromise || false;
    }

    unloadedIcons.forEach(([, attrs]) => attrs.set("loading", true));
    unloadedDescriptors.forEach(([, descriptor]) => {
      descriptor.loading = true;
    });
    this.iconSubsetPending = true;
    this.iconSubsetReady = false;
    const requestConfigs = this.getIconSubsetRequestConfigs();
    this.iconSubsetPromise = Promise.all(
      requestConfigs.map((config) => this.loadIconSubsetFamily(config)),
    )
      .then((results) => {
        const loadedDescriptorKeys = new Set(this.loadedIcons);
        if (unloadedDescriptors.length) {
          unloadedDescriptors.forEach(([key]) => loadedDescriptorKeys.add(key));
        } else {
          unloadedIcons.forEach(([icon, attrs]) => {
            this.getLoadedDescriptorKeysForIconState(icon, attrs).forEach(
              (key) => loadedDescriptorKeys.add(key),
            );
          });
        }
        this.loadedIcons = loadedDescriptorKeys;
        this.iconSubsetPending = false;
        this.iconSubsetReady = results.every(Boolean);
        window.dispatchEvent?.(
          new CustomEvent("sf-icons-subset:ready", {
            detail: {
              icons: new Set([
                ...unloadedIcons.map(([icon]) => icon),
                ...unloadedDescriptors.map(([, descriptor]) => descriptor.icon),
              ]),
              loader: this,
              types: requestConfigs.map((config) => config.defaultType),
            },
          }),
        );
        this.syncStaticIconLoadedState();
        return this.iconSubsetReady;
      })
      .finally(() => {
        const needsReload = this.iconSubsetNeedsReload;
        this.iconSubsetNeedsReload = false;
        this.iconSubsetPromise = null;
        if (needsReload) void this.loadFonts();
      });

    return this.iconSubsetPromise;
  };
}
