import { noteDeprecated } from './deprecations.js';
import './internal.js';
import { html, nothing, render } from "lit";
import {createRef} from "lit/directives/ref.js";
import {Directive, PartType, directive} from "lit/directive.js";
import { language } from "./page-language";
export function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return [
    "1",
    "true",
    "yes",
    "on",
    "checked",
    "disabled",
    "download",
    "indeterminate",
    "multiple",
  ].includes(String(value).toLowerCase());
}

export function toAttributeName(key) {
  if (key === "className") {
    return "class";
  }

  return String(key || "").replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// A closed list may also answer to legacy values that mean the same thing, which
// is how a value can be renamed without breaking a consumer: {'1/2': ['small']}
// keeps size="small" working while the canonical answer is 1/2.
export function normalizeEnum(value, allowed, fallback, valueAliases = null, onLegacy = null) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  if (Array.isArray(allowed) && allowed.includes(normalized)) {
    return normalized;
  }

  if (valueAliases) {
    for (const [canonical, legacy] of Object.entries(valueAliases)) {
      const names = Array.isArray(legacy) ? legacy : [legacy];
      if (names.map((name) => String(name).toLowerCase()).includes(normalized)) {
        onLegacy?.(normalized, canonical);
        return canonical;
      }
    }
  }

  return fallback;
}

export function parseJsonAttribute(element, name, fallback = null) {
  const rawValue = element?.getAttribute?.(name);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(
      `${element?.tagName?.toLowerCase?.() || "sf-element"}: invalid ${name} JSON`,
      error,
    );
    return fallback;
  }
}

function smartTagName(type) {
  const tagName = String(type || "").startsWith("sf-")
    ? String(type)
    : `sf-${String(type || "")}`;

  if (!/^sf-[a-z0-9-]+$/.test(tagName)) {
    throw new Error(`Invalid SF tag name: ${tagName}`);
  }

  return tagName;
}

// Writes a props object onto an element that already exists, and reports what it
// wrote so the next write can take back what the props no longer carry. An
// attribute is only touched when its value differs, a listener only swapped when
// the function differs; both matter for an element a person is using while the
// table re-renders around them.
export function applySmartProps(element, props = {}, previous = null) {
  const listeners = previous?.listeners ?? new Map();
  const attributes = previous?.attributes ?? new Set();
  const nextListeners = new Map();
  const nextAttributes = new Set();

  for (const [key, value] of Object.entries(props || {})) {
    if (key === ":key" || typeof value === "undefined" || value === null) {
      continue;
    }

    if (key === ":ref") {
      if (typeof value === "function") {
        value(element);
      } else if (value && typeof value === "object") {
        value.value = element;
      }
      continue;
    }

    const eventName = key.startsWith("@")
      ? key.slice(1)
      : /^on[A-Z]/.test(key)
        ? key.slice(2).toLowerCase()
        : null;

    if (eventName && typeof value === "function") {
      nextListeners.set(eventName, value);
      continue;
    }

    const attributeName = toAttributeName(key);

    if (typeof value === "boolean") {
      element.toggleAttribute(attributeName, value);
      nextAttributes.add(attributeName);
      continue;
    }

    if (typeof value === "object" || typeof value === "function") {
      element[key] = value;
      continue;
    }

    if (element.getAttribute(attributeName) !== String(value)) {
      element.setAttribute(attributeName, String(value));
    }
    nextAttributes.add(attributeName);
  }

  for (const [name, handler] of listeners) {
    if (nextListeners.get(name) !== handler) {
      element.removeEventListener(name, handler);
    }
  }
  for (const [name, handler] of nextListeners) {
    if (listeners.get(name) !== handler) {
      element.addEventListener(name, handler);
    }
  }
  for (const name of attributes) {
    if (!nextAttributes.has(name)) {
      element.removeAttribute(name);
    }
  }

  return {listeners: nextListeners, attributes: nextAttributes};
}

// One element per place in the template. A directive instance belongs to the
// position it was rendered in, so the element it makes is the element that
// position keeps: a re-render writes the props onto it instead of replacing it.
//
// Elements used to be created on every render and handed to lit as a new node,
// so every cell that is a Framework element was torn out and rebuilt whenever
// anything in the table changed -- fourteen nodes a row, changed row or not,
// taking the control a person was interacting with with them.
class SmartElementDirective extends Directive {
  constructor(partInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD) {
      throw new Error("renderSmartElement belongs in a child position of a template");
    }
    this._element = null;
    this._tagName = "";
    this._written = null;
  }

  render(type, props = {}) {
    const tagName = smartTagName(type);

    if (!this._element || this._tagName !== tagName) {
      this._element = document.createElement(tagName);
      this._tagName = tagName;
      this._written = null;
    }

    this._written = applySmartProps(this._element, props, this._written);

    return this._element;
  }
}

export const smartElement = directive(SmartElementDirective);

// The same element, outside a template. A caller that holds the element itself
// -- a portal, a measurement, a test -- gets a fresh one, because there is no
// position to keep it in.
export function createSmartElement(type, props = {}) {
  const element = document.createElement(smartTagName(type));
  applySmartProps(element, props, null);

  return element;
}

class SfBaseElement extends HTMLElement {
  static externalTemplateBasePath = "/local/smart/templates";
  static externalTemplateModules = new Map();
  static externalTemplateMisses = new Set();
  static externalTemplateChecks = new Map();
  static externalTemplateCssLoaded = new Set();
  static externalTemplateCssMisses = new Set();
  static waitForStylesBeforeRenderReady = true;
  static styleReadyTimeout = 3000;
  static styleReadinessCssId = "sf-smart-style-readiness";

  static get props() {
    return {};
  }

  static get observedAttributes() {
    return Array.from(
      new Set([
        ...this.propsToAttributes(),
        "template",
        "root-class",
        "root-style",
        "style",
      ]),
    );
  }

  static propsToAttributes(props = this.props) {
    return Object.entries(props || {})
      .flatMap(([key, config]) => {
        const normalized = this.normalizePropConfig(key, config);
        return [normalized.attribute, ...normalized.aliases];
      })
      .filter(Boolean);
  }

  static normalizePropConfig(key, config = "") {
    const isConfigObject =
      config &&
      typeof config === "object" &&
      !Array.isArray(config) &&
      (Object.prototype.hasOwnProperty.call(config, "type") ||
        Object.prototype.hasOwnProperty.call(config, "default") ||
        Object.prototype.hasOwnProperty.call(config, "attribute") ||
        Object.prototype.hasOwnProperty.call(config, "parser") ||
        Object.prototype.hasOwnProperty.call(config, "parse") ||
        Object.prototype.hasOwnProperty.call(config, "values"));
    const propConfig = isConfigObject ? { ...config } : { default: config };
    const defaultValue = propConfig.default;
    const inferredType =
      propConfig.type ||
      (Array.isArray(defaultValue)
        ? Array
        : defaultValue !== null && typeof defaultValue === "object"
          ? Object
          : typeof defaultValue === "boolean"
            ? Boolean
            : typeof defaultValue === "number"
              ? Number
              : String);

    // A prop may name legacy attributes it still answers to. The canonical name
    // wins when both are present; otherwise the first legacy name that is set is
    // read. This is what lets an axis be renamed without breaking a consumer.
    const aliases = (
      Array.isArray(propConfig.aliases)
        ? propConfig.aliases
        : propConfig.aliases
          ? [propConfig.aliases]
          : []
    )
      .map((alias) => (alias === false ? "" : toAttributeName(alias)))
      .filter(Boolean);

    return {
      ...propConfig,
      key,
      attribute:
        propConfig.attribute === false
          ? ""
          : propConfig.attribute || toAttributeName(key),
      aliases,
      default: defaultValue,
      type: inferredType,
    };
  }

  static toBoolean(value, fallback = false) {
    return toBoolean(value, fallback);
  }

  static toAttributeName(key) {
    return toAttributeName(key);
  }

  static toNumber(value, fallback = 0) {
    return toNumber(value, fallback);
  }

  static normalizeEnum(value, allowed, fallback) {
    return normalizeEnum(value, allowed, fallback);
  }

  static parseJsonAttribute(element, name, fallback = null) {
    return parseJsonAttribute(element, name, fallback);
  }

  static get tagName() {
    return this.resolveTagName();
  }

  static resolveTagName(className = this.name) {
    const tagName = String(className || "")
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .replace(/_/g, "-")
      .toLowerCase();

    if (!tagName) {
      return "";
    }

    return tagName.includes("-") ? tagName : `sf-${tagName}`;
  }

  // One component can reach a page twice: as its own file and inside a bundle
  // that carries it. Those are two class objects with the same tag, and
  // re-registering is a no-op, not a mistake worth a warning. A tag taken by a
  // different component, or by a class that is not a SIMAI element at all, is
  // a real conflict and still warns.
  static get sfElementBrand() {
    return "simai.smart-base.v1";
  }

  static isSameComponentAs(other) {
    if (other === this) {
      return true;
    }

    if (!other || other.sfElementBrand !== this.sfElementBrand) {
      return false;
    }

    const isClassName = (value) => /^[A-Z][A-Za-z0-9_]{2,}$/.test(String(value || ""));

    if (isClassName(other.name) && isClassName(this.name)) {
      return other.name === this.name;
    }

    // Minified builds mangle class names; the shared brand and the tag are
    // then all the identity there is.
    return true;
  }

  static define(tagName) {
    const resolvedTagName = String(tagName || this.resolveTagName())
      .trim()
      .toLowerCase();

    if (!resolvedTagName || !resolvedTagName.includes("-")) {
      throw new Error(
        `${this.name || "SfBaseElement"}.define(): cannot resolve custom element tag. Call define() on a named subclass or pass tagName explicitly.`,
      );
    }

    const existing = customElements.get(resolvedTagName);
    if (existing) {
      if (!this.isSameComponentAs(existing)) {
        console.warn(
          `${this.name || "SfBaseElement"}.define(): ${resolvedTagName} is already defined`,
          existing,
        );
      }

      return existing;
    }

    customElements.define(resolvedTagName, this);
    return this;
  }

  static ensureStyleReadinessCss() {
    if (
      typeof document === "undefined" ||
      document.getElementById(this.styleReadinessCssId)
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = this.styleReadinessCssId;
    style.textContent =
      "[data-sf-style-pending],[data-sf-style-pending] *{visibility:hidden!important;}";
    document.head.append(style);
  }

  constructor() {
    super();
    this._updateScheduled = false;
    this._changedAttributes = new Set();
    this._updateLoopCount = 0;
    this._updateLoopResetScheduled = false;
    this._updateLoopBlocked = false;
    this._updateLoopWarned = false;
    this._isMounted = false;
    this._hasRendered = false;
    this._renderToken = 0;
    this._externalTemplateModule = null;
    this._slotTemplates = new Map();
    this._liveSlotNodes = new Map();
    this._slotTemplatesCaptured = false;
    this._customTemplateProps = new Map();
    this._refEffects = new Map();
    this._activeRefEffects = null;
    this._hostStyle = "";
    this._syncingHostStyle = false;
    this._authorStyleElement = null;
    this._authorStyleObserver = null;
    this._styleReady = false;
    this._styleReadyPromise = null;
    this.__sfSmartElement = true;
    this.__sfSourceCaptured = false;
  }

  connectedCallback() {
    this.constructor.ensureStyleReadinessCss();
    this.captureHostStyle();
    this.applyHostDisplayStyle();
    this.captureSlotTemplates();
    this.__sfSourceCaptured = true;
    this._isMounted = true;
    this.onConnected();
    // A component chooses its words when it draws and would otherwise keep
    // them for ever: changing the page's language used to mean reloading it.
    // Subscribing here rather than in each component is the same argument as
    // the shared rule itself -- sixteen subscriptions would be sixteen chances
    // to forget one (owner, 2026-10-11: «языков будет гораздо больше чем два»).
    this.__sfLanguageOff = language.onChange(() => {
      if (this._isMounted) this.requestComponentUpdate("language");
    });
    this.emitComponentEvent("connected");
    this.requestComponentUpdate("connected");
  }

  disconnectedCallback() {
    this._isMounted = false;
    this.__sfLanguageOff?.();
    this.__sfLanguageOff = null;
    try {
      this.onDisconnected();
    } finally {
      this._releaseExternalTemplate();
    }
    this.emitComponentEvent("disconnected");
  }

  toBoolean(value, fallback = false) {
    return toBoolean(value, fallback);
  }

  toAttributeName(key) {
    return toAttributeName(key);
  }

  // Kept as the name every template already calls. The element it returns is
  // the one this position in the template already had.
  renderSmartElement(type, props = {}) {
    return smartElement(type, props);
  }

  toNumber(value, fallback = 0) {
    return toNumber(value, fallback);
  }

  normalizeEnum(value, allowed, fallback) {
    return normalizeEnum(value, allowed, fallback);
  }

  parseJsonAttribute(name, fallback = null) {
    return parseJsonAttribute(this, name, fallback);
  }

  getBooleanAttr(name, fallback = false) {
    const attr = this.attributeName(name);
    if (!attr || !this.hasAttribute(attr)) {
      return fallback;
    }

    const value = this.getAttribute(attr);
    if (value === "") {
      return true;
    }

    return toBoolean(value, fallback);
  }

  getNumberAttr(name, fallback = 0) {
    const attr = this.attributeName(name);
    if (!attr || !this.hasAttribute(attr)) {
      return fallback;
    }

    const value = this.getAttribute(attr);
    if (value === "") {
      return fallback;
    }

    return toNumber(value, fallback);
  }

  // The canonical attribute if it is set, otherwise the first legacy name that is.
  resolveAttributeName({attribute = "", aliases = []} = {}) {
    if (attribute && this.hasAttribute(attribute)) {
      return attribute;
    }
    const legacy = aliases.find((alias) => this.hasAttribute(alias));
    if (legacy) {
      noteDeprecated({component: this.localName, kind: 'attribute', from: legacy, to: attribute || null});
    }
    return legacy || attribute;
  }

  // The same rule for a component that reads an enum directly. It may pass the
  // legacy attribute names it answers to, and — through the options form —
  // the legacy values it accepts:
  //   getEnumAttr('size', {values: ['1/2', '1'], fallback: '1',
  //                        valueAliases: {'1/2': ['small'], 1: ['medium']}})
  getEnumAttr(name, allowed = [], fallback = "", aliases = []) {
    const options =
      allowed && !Array.isArray(allowed) && typeof allowed === "object"
        ? allowed
        : {values: allowed, fallback, aliases};
    const attr = this.resolveAttributeName({
      attribute: this.attributeName(name),
      aliases: (Array.isArray(options.aliases) ? options.aliases : [options.aliases])
        .filter(Boolean)
        .map((alias) => this.attributeName(alias)),
    });
    const value =
      attr && this.hasAttribute(attr) ? this.getAttribute(attr) : undefined;

    return normalizeEnum(
      value,
      options.values ?? [],
      options.fallback ?? "",
      options.valueAliases ?? null,
      (from, to) => noteDeprecated({component: this.localName, kind: 'value', attribute: this.attributeName(name), from, to}),
    );
  }

  hasDeclaredProps() {
    return Object.keys(this.constructor.props || {}).length > 0;
  }
  createRef() {
    const ref = createRef();
    ref.__sfOwner = this;
    return ref;
  }

  registerRefEffect(ref, callback, options = {}) {
    if (!ref || typeof callback !== "function") {
      return this;
    }

    const currentRecord = this._refEffects.get(ref) || {};
    const record = {
      ...currentRecord,
      callback,
      once: options.once === true,
    };

    this._refEffects.set(ref, record);
    this._activeRefEffects?.add(ref);

    return this;
  }

  flushRefEffects() {
    if (!this._refEffects.size) {
      return this;
    }

    const activeRefs = this._activeRefEffects;

    this._refEffects.forEach((record, ref) => {
      if (activeRefs && !activeRefs.has(ref)) {
        if (typeof record.cleanup === "function") {
          record.cleanup();
        }

        this._refEffects.delete(ref);
        return;
      }

      const nextValue = ref?.value || null;

      if (Object.is(record.value, nextValue)) {
        return;
      }

      if (typeof record.cleanup === "function") {
        record.cleanup();
      }

      record.value = nextValue;
      record.cleanup = null;

      if (!nextValue) {
        return;
      }

      const cleanup = record.callback.call(this, nextValue, {
        component: this,
        ref,
        value: nextValue,
      });

      record.cleanup = typeof cleanup === "function" ? cleanup : null;

      if (record.once) {
        this._refEffects.delete(ref);
      }
    });

    this._activeRefEffects = null;
    return this;
  }


  getPropsContext(props = this.constructor.props || {}) {
    return Object.fromEntries(
      Object.entries(props).map(([key, config]) => [
        key,
        this.getPropValue(key, config),
      ]),
    );
  }

  getProp(key, fallbackConfig = "") {
    const props = this.constructor.props || {};
    return this.getPropValue(key, props[key] ?? fallbackConfig);
  }

  getPropValue(key, config = "") {
    const propConfig = this.constructor.normalizePropConfig(key, config);
    const { type, default: defaultValue } = propConfig;
    const parser = propConfig.parser || propConfig.parse;
    const attribute = this.resolveAttributeName(propConfig);
    const hasAttribute = attribute ? this.hasAttribute(attribute) : false;
    const rawValue = hasAttribute ? this.getAttribute(attribute) : undefined;

    if (!hasAttribute && Object.prototype.hasOwnProperty.call(this, key)) {
      return this.coercePropValue(this[key], propConfig);
    }

    if (typeof parser === "function") {
      return parser.call(this, rawValue, defaultValue, this);
    }

    if (!hasAttribute) {
      return this.clonePropDefault(defaultValue, type);
    }

    return this.coercePropValue(rawValue, propConfig);
  }

  coercePropValue(value, config = {}) {
    const { type, default: defaultValue, values, valueAliases } = config;

    if (type === Boolean) {
      if (value === "") {
        return true;
      }

      return toBoolean(value, Boolean(defaultValue));
    }

    if (type === Number) {
      return toNumber(value, Number(defaultValue || 0));
    }

    if (type === Array || type === Object) {
      if (typeof value !== "string") {
        return value ?? this.clonePropDefault(defaultValue, type);
      }

      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn(
          `${this.tagName.toLowerCase()}: invalid ${config.attribute} JSON`,
          error,
        );
        return this.clonePropDefault(defaultValue, type);
      }
    }

    if (Array.isArray(values)) {
      // The legacy values belong here, not only in a component's own getter: the
      // template reads the props context, so a legacy word that is normalised in
      // the getter alone would still reach the class list as the default.
      return normalizeEnum(
        value,
        values,
        defaultValue || values[0] || "",
        valueAliases || null,
        (from, to) => noteDeprecated({component: this.localName, kind: 'value', attribute: config.attribute || config.key || '', from, to}),
      );
    }

    return value ?? this.clonePropDefault(defaultValue, type);
  }

  clonePropDefault(defaultValue, type) {
    if (Array.isArray(defaultValue)) {
      return [...defaultValue];
    }

    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      (type === Object || type === Array)
    ) {
      return { ...defaultValue };
    }

    if (typeof defaultValue !== "undefined") {
      return defaultValue;
    }

    if (type === Boolean) {
      return false;
    }

    if (type === Number) {
      return 0;
    }

    if (type === Array) {
      return [];
    }

    if (type === Object) {
      return {};
    }

    return "";
  }

  get value() {
    return this.getAttribute("value") || "";
  }

  set value(nextValue) {
    if (
      nextValue &&
      typeof nextValue === "object" &&
      !Array.isArray(nextValue)
    ) {
      this.setValueAttributes(nextValue);
      return;
    }

    this.setAttributeValue("value", nextValue);
  }

  getAttributeValue(name = "value", fallback = "") {
    return this.getAttribute(name) || fallback;
  }

  setAttributeValue(name = "value", nextValue = "") {
    const attr = toAttributeName(name);

    if (!attr) {
      return this;
    }

    if (nextValue === null || typeof nextValue === "undefined") {
      this.removeAttribute(attr);
      return this;
    }

    this.setAttribute(attr, String(nextValue));
    return this;
  }

  setValueAttributes(nextValue = {}, options = {}) {
    if (!nextValue || typeof nextValue !== "object") {
      return this;
    }

    const { stringifyObjects = true, removeEmptyString = true } = options;

    Object.entries(nextValue).forEach(([key, value]) => {
      const attr = toAttributeName(key);

      if (!attr) {
        return;
      }

      this.setCustomTemplateProp(key, value);

      if (
        value === false ||
        value === null ||
        typeof value === "undefined" ||
        (removeEmptyString && value === "")
      ) {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, "");
        return;
      }

      if (
        stringifyObjects &&
        (Array.isArray(value) || typeof value === "object")
      ) {
        this.setAttribute(attr, JSON.stringify(value));
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    if (name === "style") {
      if (this._syncingHostStyle) {
        return;
      }

      this._hostStyle = this.normalizeHostStyle(newValue);
      this.syncAuthorStyle();
      this.applyHostDisplayStyle();
    }

    this.requestComponentUpdate(name);
  }

  get updateLoopLimit() {
    const limit = Number(this.constructor.updateLoopLimit ?? 50);
    return Number.isFinite(limit) ? limit : 50;
  }

  resetUpdateLoopGuard() {
    this._updateLoopCount = 0;
    this._updateLoopResetScheduled = false;
    this._updateLoopBlocked = false;
    this._updateLoopWarned = false;
  }

  scheduleUpdateLoopGuardReset() {
    if (this._updateLoopResetScheduled) {
      return;
    }

    this._updateLoopResetScheduled = true;
    setTimeout(() => {
      this.resetUpdateLoopGuard();
    }, 0);
  }

  canScheduleComponentUpdate(reason = "unknown") {
    if (this._updateLoopBlocked) {
      return false;
    }

    const limit = this.updateLoopLimit;
    if (limit <= 0) {
      return true;
    }

    this.scheduleUpdateLoopGuardReset();
    this._updateLoopCount += 1;

    if (this._updateLoopCount <= limit) {
      return true;
    }

    this._updateLoopBlocked = true;
    this._changedAttributes.clear();

    if (!this._updateLoopWarned) {
      this._updateLoopWarned = true;
      console.warn(
        `${this.componentTagName || "sf-element"}: update loop limit reached`,
        {
          reason,
          limit,
          component: this,
        },
      );
    }

    return false;
  }

  requestComponentUpdate(reason = "unknown") {
    if (this._updateLoopBlocked) {
      return;
    }

    if (reason) {
      this._changedAttributes.add(reason);
    }

    if (this._updateScheduled) {
      return;
    }

    if (!this.canScheduleComponentUpdate(reason)) {
      return;
    }

    this._updateScheduled = true;
    Promise.resolve().then(() => {
      this._updateScheduled = false;

      if (!this._isMounted) {
        return;
      }

      const changedAttributes = Array.from(this._changedAttributes);
      this._changedAttributes.clear();
      this.performComponentUpdate(changedAttributes).catch((error) => this.reportComponentError(error, "render"));
    });
  }

  // A component that throws while it draws says so, once per failure, on an
  // event the page can answer (simai.interface-fragment, failure-is-contained):
  // a fragment boundary puts the error state in its place and offers a retry,
  // and nothing else on the page goes with it. The error is still logged.
  reportComponentError(error, phase = "render") {
    console.error(error);
    this.setAttribute("data-sf-error", phase);
    this.dispatchEvent(new CustomEvent("sf-component-error", {
      bubbles: true,
      composed: true,
      detail: {phase, message: String(error?.message ?? error), element: this.localName},
    }));
  }

  async performComponentUpdate(changedAttributes = []) {
    const mode =
      this.hasBuiltInTemplate(this.componentTemplateName) &&
      !this._externalTemplateModule
        ? this.resolveUpdateMode(changedAttributes)
        : "lit";

    if (mode === "dom" && this.updateDom(changedAttributes) !== false) {
      this.afterUpdate(changedAttributes, mode);
      this.emitComponentEvent("updated", {
        changedAttributes,
        updateMode: mode,
      });
      this.emitComponentEvent(
        "props-change",
        this.createPropChangeDetail(changedAttributes, mode),
      );
      return;
    }

    await this.renderComponent(changedAttributes);
    this.afterUpdate(changedAttributes, "lit");
    this.emitComponentEvent("updated", {
      changedAttributes,
      updateMode: "lit",
    });
    this.emitComponentEvent(
      "props-change",
      this.createPropChangeDetail(changedAttributes, "lit"),
    );
  }

  async renderComponent(changedAttributes = []) {
    const renderToken = ++this._renderToken;

    if (!this._isMounted) {
      return;
    }

    this._activeRefEffects = new Set();
    this.beforeRender(changedAttributes);
    this.emitComponentEvent("before-render", { changedAttributes });
    this.runExternalHook("beforeRender", {
      changedAttributes,
      root: this,
    });

    const templateResult = await this.resolveTemplateResult(changedAttributes);

    if (!this._isMounted || renderToken !== this._renderToken) {
      return;
    }

    this.prepareRenderContainer(changedAttributes);
    this.markStylePending(this);
    render(templateResult, this);
    this.flushRefEffects();
    await this.whenRenderedStylesReady(this);

    if (!this._isMounted || renderToken !== this._renderToken) {
      return;
    }

    this._hasRendered = true;
    this.afterRender(changedAttributes);
    this._childrenDefinedPromise = null;
    this.runExternalHook("afterRender", {
      changedAttributes,
      root: this,
    });
    this.emitComponentEvent("after-render", { changedAttributes });
  }

  shouldWaitForStylesReady() {
    return this.constructor.waitForStylesBeforeRenderReady !== false;
  }

  markStylePending(target = this) {
    if (
      this.shouldWaitForStylesReady() &&
      !this._styleReady &&
      target?.setAttribute
    ) {
      target.setAttribute("data-sf-style-pending", "");
      target.removeAttribute("data-sf-style-ready");
    }

    return this;
  }

  markStyleReady(target = this) {
    this._styleReady = true;

    [target, this].forEach((element) => {
      if (element?.removeAttribute && element?.setAttribute) {
        element.removeAttribute("data-sf-style-pending");
        element.setAttribute("data-sf-style-ready", "");
      }
    });

    return this;
  }

  async whenRenderedStylesReady(target = this) {
    if (!this.shouldWaitForStylesReady()) {
      return;
    }

    const loader = window.SF?.Loader;
    if (!loader || typeof loader.ensureStylesReady !== "function") {
      this.markStyleReady(target);
      return;
    }

    const readiness = Promise.resolve().then(() =>
      loader.ensureStylesReady(target || this, { autoLoad: true }),
    );
    const timeout = Number(this.constructor.styleReadyTimeout ?? 3000);
    this._styleReadyPromise =
      timeout > 0
        ? Promise.race([
            readiness,
            new Promise((resolve) => {
              setTimeout(resolve, timeout);
            }),
          ])
        : readiness;

    await this._styleReadyPromise.catch((error) => {
      console.warn(
        `${this.componentTagName || "sf-element"}: style readiness failed`,
        error,
      );
    });
    this.markStyleReady(target);
  }

  getChildCustomElements() {
    return Array.from(this.querySelectorAll("*")).filter((node) => {
      const tagName = node?.tagName?.toLowerCase?.() || "";
      return tagName.startsWith("sf-");
    });
  }

  async whenChildrenDefined() {
    if (this._childrenDefinedPromise) {
      return this._childrenDefinedPromise;
    }

    this._childrenDefinedPromise = Promise.resolve().then(async () => {
      const children = this.getChildCustomElements();

      await Promise.all(
        children.map(async (child) => {
          const tagName = child.tagName?.toLowerCase?.();
          if (!tagName || !window.customElements?.whenDefined) {
            return;
          }

          await window.customElements.whenDefined(tagName);

          if (child.updateComplete?.then) {
            await child.updateComplete;
          }

          if (child._updateScheduled) {
            await Promise.resolve();
          }
        }),
      );

      return children;
    });

    return this._childrenDefinedPromise;
  }

  get componentTagName() {
    return this.tagName?.toLowerCase?.() || "";
  }

  get componentTemplateName() {
    return this.getAttribute("template") || "default";
  }

  get externalTemplateComponentName() {
    return this.componentTagName.startsWith("sf-")
      ? this.componentTagName.replace(/^sf-/, "")
      : this.componentTagName;
  }

  get externalTemplateBasePath() {
    return (
      window.SF_SMART_TEMPLATE_PATH ||
      window.SFSmartTemplatePath ||
      this.constructor.externalTemplateBasePath
    );
  }

  emitComponentEvent(name, detail = {}) {
    const eventDetail = {
      component: this,
      tagName: this.componentTagName,
      template: this.componentTemplateName,
      ...detail,
    };

    this.dispatchEvent(
      new CustomEvent(`sf-${name}`, {
        bubbles: true,
        composed: true,
        detail: eventDetail,
      }),
    );
  }

  attributeName(key) {
    return String(key || "").replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
  }

  shouldSerializeFalseAttribute(attr) {
    const attributes = this.constructor.defaultTrueAttributes;

    if (!attributes) {
      return false;
    }

    if (attributes instanceof Set) {
      return attributes.has(attr);
    }

    if (Array.isArray(attributes)) {
      return attributes.includes(attr);
    }

    return false;
  }

  setAttributes(nextAttributes = {}) {
    if (!nextAttributes || typeof nextAttributes !== "object") {
      return this;
    }

    Object.entries(nextAttributes).forEach(([key, value]) => {
      const attr = this.attributeName(key);
      if (!attr) {
        return;
      }

      this.setCustomTemplateProp(key, value);

      if (value === false && this.shouldSerializeFalseAttribute(attr)) {
        this.setAttribute(attr, "false");
        return;
      }

      if (
        value === false ||
        value === null ||
        value === undefined ||
        value === ""
      ) {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, "");
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }

  forwardHostAttributes(target, options = {}) {
    if (!target) {
      return this;
    }

    const {
      exclude = [],
      transferDataAttributes = true,
      storageKey = "__sfForwardedDataAttributes",
      targetStorageKey = "__sfForwardedAttributeKeys",
    } = options;

    const excludeSet = exclude instanceof Set ? exclude : new Set(exclude);
    const dataAttributes = this[storageKey] || new Map();
    const previous = target[targetStorageKey] || new Set();
    const dataAttributeNamesToRemove = [];
    const nextKeys = new Set();

    previous.forEach((name) => {
      target.removeAttribute(name);
    });

    Array.from(this.attributes).forEach((attribute) => {
      const { name, value } = attribute;

      if (excludeSet.has(name)) {
        return;
      }

      if (/^on[a-z]/i.test(name)) {
        return;
      }

      if (transferDataAttributes && name.startsWith("data-")) {
        dataAttributes.set(name, value);
        dataAttributeNamesToRemove.push(name);
        return;
      }

      nextKeys.add(name);
      target.setAttribute(name, value);
    });

    dataAttributes.forEach((value, name) => {
      nextKeys.add(name);
      target.setAttribute(name, value);
    });

    target[targetStorageKey] = nextKeys;
    this[storageKey] = dataAttributes;

    if (dataAttributeNamesToRemove.length) {
      this.__sfForwardingHostAttributes = true;
      dataAttributeNamesToRemove.forEach((name) => this.removeAttribute(name));
      this.__sfForwardingHostAttributes = false;
    }

    return this;
  }

  observeForwardedHostAttributes(targetGetter, options = {}) {
    if (this._forwardHostAttributeObserver) {
      return this;
    }

    const resolveTarget =
      typeof targetGetter === "function" ? targetGetter : () => targetGetter;

    this._forwardHostAttributeObserver = new MutationObserver(() => {
      if (this.__sfForwardingHostAttributes) {
        return;
      }

      this.forwardHostAttributes(resolveTarget(), options);
    });

    this._forwardHostAttributeObserver.observe(this, { attributes: true });
    return this;
  }

  disconnectForwardedHostAttributes() {
    this._forwardHostAttributeObserver?.disconnect?.();
    this._forwardHostAttributeObserver = null;
    return this;
  }

  removeAttributes(attributeNames = []) {
    const names = Array.isArray(attributeNames)
      ? attributeNames
      : [attributeNames];
    names
      .filter(Boolean)
      .forEach((name) => this.removeAttribute(this.attributeName(name)));
    return this;
  }

  refresh(reason = "manual") {
    this.requestComponentUpdate(reason);
    return this;
  }

  get isRendered() {
    return this._hasRendered === true;
  }

  createRenderDetail(detail = {}) {
    return {
      component: this,
      tagName: this.componentTagName,
      template: this.componentTemplateName,
      ...detail,
    };
  }

  runRenderedCallback(callback, detail = {}, event = null) {
    if (typeof callback !== "function") {
      return undefined;
    }

    return callback.call(this, this.createRenderDetail(detail), event);
  }

  whenRendered(callback = null, options = {}) {
    const waitNext = options.next === true;

    if (this.isRendered && !waitNext) {
      const detail = this.createRenderDetail({
        changedAttributes: [],
        immediate: true,
      });

      return Promise.resolve().then(() => {
        this.runRenderedCallback(callback, detail);
        return detail;
      });
    }

    return new Promise((resolve) => {
      const onAfterRender = (event) => {
        const detail = event?.detail || this.createRenderDetail();
        this.runRenderedCallback(callback, detail, event);
        resolve(detail);
      };

      this.addEventListener("sf-after-render", onAfterRender, { once: true });
    });
  }

  onAfterRender(callback, options = {}) {
    const immediate = options.immediate !== false;
    const once = options.once !== false;

    if (immediate && this.isRendered) {
      this.runRenderedCallback(callback, {
        changedAttributes: [],
        immediate: true,
      });

      if (once) {
        return () => {};
      }
    }

    const onAfterRender = (event) => {
      this.runRenderedCallback(callback, event?.detail || {}, event);

      if (once) {
        this.removeEventListener("sf-after-render", onAfterRender);
      }
    };

    this.addEventListener("sf-after-render", onAfterRender);
    return () => this.removeEventListener("sf-after-render", onAfterRender);
  }

  getState() {
    if (typeof this.state !== "undefined") {
      return this.state;
    }

    if (this.hasDeclaredProps()) {
      return this.templateContext();
    }

    if (typeof this.value !== "undefined") {
      return this.value;
    }

    return this.templateContext();
  }

  normalizeStateCallbackArgs(reasonOrCallback, callback, fallbackReason = "state") {
    if (typeof reasonOrCallback === "function") {
      return {
        reason: fallbackReason,
        callback: reasonOrCallback,
      };
    }

    return {
      reason: reasonOrCallback || fallbackReason,
      callback,
    };
  }

  runStateCallback(callback, detail = {}) {
    if (typeof callback !== "function") {
      return this;
    }

    callback.call(this, {
      component: this,
      state: this.getState(),
      ...detail,
    });

    return this;
  }

  scheduleStateCallback(callback, detail = {}) {
    if (typeof callback !== "function") {
      return this;
    }

    if (this._isMounted && this._updateScheduled) {
      this.whenRendered((renderDetail) => {
        this.runStateCallback(callback, {
          ...detail,
          renderDetail,
        });
      }, { next: true });
      return this;
    }

    Promise.resolve().then(() => {
      this.runStateCallback(callback, detail);
    });

    return this;
  }

  setState(nextState = {}, callback = null) {
    this.setAttributes(nextState);
    this.scheduleStateCallback(callback, {
      patch: nextState,
      reason: "attributes",
    });
    return this;
  }

  patchState(nextState = {}, reasonOrCallback = "state", callback = null) {
    const { reason, callback: stateCallback } = this.normalizeStateCallbackArgs(
      reasonOrCallback,
      callback,
      "state",
    );
    const prevState =
      this.state && typeof this.state === "object" ? this.state : {};
    const patch =
      typeof nextState === "function" ? nextState(prevState) : nextState;

    if (!patch || typeof patch !== "object" || Object.is(patch, prevState)) {
      this.scheduleStateCallback(stateCallback, {
        patch,
        reason,
        changed: false,
        changedKeys: [],
        prevState,
        nextState: prevState,
      });
      return this;
    }

    let changed = false;
    const changedKeys = [];
    const state = { ...prevState };

    Object.entries(patch).forEach(([key, value]) => {
      if (Object.is(state[key], value)) {
        return;
      }

      state[key] = value;
      changed = true;
      changedKeys.push(key);
    });

    if (!changed) {
      this.scheduleStateCallback(stateCallback, {
        patch,
        reason,
        changed: false,
        changedKeys,
        prevState,
        nextState: prevState,
      });
      return this;
    }

    this.state = state;
    this.requestComponentUpdate(reason);
    this.scheduleStateCallback(stateCallback, {
      patch,
      reason,
      changed: true,
      changedKeys,
      prevState,
      nextState: state,
    });
    return this;
  }

  set(nextState = {}, reasonOrCallback = "state", callback = null) {
    return this.patchState(nextState, reasonOrCallback, callback);
  }

  getRootClass() {
    return this.getAttribute("root-class") || "";
  }

  normalizeHostStyle(style = "") {
    const element = document.createElement("div");
    element.setAttribute("style", String(style || ""));
    element.style.removeProperty("display");

    return element.style.cssText;
  }

  // The host is deliberately boxless; author styles belong to the template
  // root. Keep a real, stable CSSStyleDeclaration for CSSOM edits rather than
  // exposing the internal display-only declaration and losing prior edits.
  get style() {
    if (!this._authorStyleElement) {
      this._authorStyleElement = document.createElement("div");
      this._hostStyle = this.normalizeHostStyle(this.getAttribute("style")) || this._hostStyle;
      this.syncAuthorStyle();
      this._authorStyleObserver = new MutationObserver(() => this.flushAuthorStyle());
      this._authorStyleObserver.observe(this._authorStyleElement, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
    return this._authorStyleElement.style;
  }

  set style(value) {
    this.style.cssText = value == null ? "" : String(value);
  }

  syncAuthorStyle() {
    if (!this._authorStyleElement) return;
    const next = `${this._hostStyle} display: contents;`.trim();
    if (this._authorStyleElement.style.cssText !== next) {
      this._authorStyleElement.style.cssText = next;
    }
  }

  flushAuthorStyle() {
    if (!this._authorStyleElement) return;
    const next = this.normalizeHostStyle(this._authorStyleElement.style.cssText);
    if (next !== this._hostStyle) {
      // Reuse the existing attribute -> render path. Attribute replacement and
      // removal supersede pending CSSOM edits just as they do for native style.
      this.setAttribute("style", next);
    } else if (this._authorStyleElement.style.display !== "contents") {
      this.syncAuthorStyle();
    }
  }

  captureHostStyle() {
    this.flushAuthorStyle();
    const normalized = this.normalizeHostStyle(this.getAttribute("style"));

    if (normalized || !this._hostStyle) {
      this._hostStyle = normalized;
    }
    this.syncAuthorStyle();

    return this;
  }

  applyHostDisplayStyle() {
    const nextStyle = "display: contents;";

    if (this.getAttribute("style") === nextStyle) {
      return this;
    }

    this._syncingHostStyle = true;
    this.setAttribute("style", nextStyle);
    this._syncingHostStyle = false;

    return this;
  }

  getRootStyle() {
    this.flushAuthorStyle();
    return [this._hostStyle, this.getAttribute("root-style")]
      .filter(Boolean)
      .join("; ");
  }

  setRootClass(nextValue = "") {
    const value = String(nextValue || "").trim();

    if (!value) {
      this.removeAttribute("root-class");
      return this;
    }

    this.setAttribute("root-class", value);
    return this;
  }

  addRootClass(...tokens) {
    const classes = new Set(this.getRootClass().split(/\s+/).filter(Boolean));
    tokens
      .flat()
      .filter(Boolean)
      .forEach((token) => {
        String(token)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((part) => classes.add(part));
      });

    return this.setRootClass(Array.from(classes).join(" "));
  }

  setRootStyle(nextValue = "") {
    const value = String(nextValue || "").trim();

    if (!value) {
      this.removeAttribute("root-style");
      return this;
    }

    this.setAttribute("root-style", value);
    return this;
  }

  removeRootClass(...tokens) {
    const classes = new Set(this.getRootClass().split(/\s+/).filter(Boolean));
    tokens
      .flat()
      .filter(Boolean)
      .forEach((token) => {
        String(token)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((part) => classes.delete(part));
      });

    return this.setRootClass(Array.from(classes).join(" "));
  }

  toggleRootClass(token, force) {
    const normalized = String(token || "").trim();
    if (!normalized) {
      return this;
    }

    const classes = new Set(this.getRootClass().split(/\s+/).filter(Boolean));
    const shouldAdd =
      typeof force === "boolean" ? force : !classes.has(normalized);

    if (shouldAdd) {
      classes.add(normalized);
    } else {
      classes.delete(normalized);
    }

    this.setRootClass(Array.from(classes).join(" "));
    return this;
  }

  setHidden(hidden = true) {
    const next = toBoolean(hidden, true);

    this.toggleAttribute("hidden", next);
    this.toggleRootClass("hidden", next);

    return this;
  }

  isHidden() {
    const rootClasses = new Set(
      this.getRootClass().split(/\s+/).filter(Boolean),
    );

    return this.hasAttribute("hidden") || rootClasses.has("hidden");
  }

  createPropChangeDetail(changedAttributes = [], updateMode = "lit") {
    return {
      changedAttributes,
      updateMode,
      state: this.getState(),
    };
  }

  onPropChange(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener(
        "sf-props-change",
        (event) => {
          handler(event.detail?.state, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  onUpdate(handler, options) {
    if (typeof handler === "function") {
      this.addEventListener(
        "sf-updated",
        (event) => {
          handler(this.getState(), event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  createTemplateContext(baseContext = {}) {
    const propsContext = this.hasDeclaredProps() ? this.getPropsContext() : {};
    const normalizedContext = {
      component: this,
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
      ...propsContext,
      ...baseContext,
    };
    const custom = this.getCustomTemplateProps(normalizedContext);

    return {
      ...custom,
      ...normalizedContext,
      custom,
    };
  }

  getCustomTemplateProps(baseContext = {}) {
    const reservedAttributes = this.getReservedTemplateAttributes();
    const reservedKeys = this.getReservedTemplateKeys(baseContext);

    const props = {};

    this._customTemplateProps.forEach((value, key) => {
      if (!this.isCustomTemplateProp(key, baseContext)) {
        return;
      }

      props[key] = value;
    });

    Object.entries(this.getOwnCustomTemplateProps(baseContext)).forEach(
      ([key, value]) => {
        if (
          !key ||
          reservedKeys.has(key) ||
          Object.prototype.hasOwnProperty.call(props, key)
        ) {
          return;
        }

        props[key] = value;
      },
    );

    Array.from(this.attributes || []).forEach(({ name, value }) => {
      if (reservedAttributes.has(name)) {
        return;
      }

      const key = this.attributeToPropertyName(name);
      if (
        !key ||
        reservedKeys.has(key) ||
        Object.prototype.hasOwnProperty.call(props, key)
      ) {
        return;
      }

      props[key] = value;
    });

    return props;
  }

  getOwnCustomTemplateProps(baseContext = {}) {
    const props = {};
    const reservedKeys = this.getReservedTemplateKeys(baseContext);

    Object.keys(this).forEach((key) => {
      if (
        key.startsWith("_") ||
        reservedKeys.has(key) ||
        typeof this[key] === "function"
      ) {
        return;
      }

      props[key] = this[key];
    });

    return props;
  }

  getReservedTemplateAttributes() {
    const reservedAttributes = new Set([
      "class",
      "style",
      "id",
      "slot",
      "template",
    ]);
    const observedAttributes = this.constructor.observedAttributes || [];

    observedAttributes.forEach((name) => {
      const attr = toAttributeName(name);

      if (attr) {
        reservedAttributes.add(attr);
      }
    });

    return reservedAttributes;
  }

  getReservedTemplateKeys(baseContext = {}) {
    const reservedKeys = new Set(["custom"]);

    Object.keys(baseContext || {}).forEach((key) => {
      reservedKeys.add(key);
    });

    this.getReservedTemplateAttributes().forEach((attr) => {
      const key = this.attributeToPropertyName(attr);

      if (key) {
        reservedKeys.add(key);
      }
    });

    return reservedKeys;
  }

  isCustomTemplateProp(key, baseContext = {}) {
    const prop = this.attributeToPropertyName(toAttributeName(key));

    if (!prop) {
      return false;
    }

    const attr = toAttributeName(prop);
    const reservedAttributes = this.getReservedTemplateAttributes();
    const reservedKeys = this.getReservedTemplateKeys(baseContext);

    return !reservedAttributes.has(attr) && !reservedKeys.has(prop);
  }

  setCustomTemplateProps(nextProps = {}, baseContext = {}) {
    if (!nextProps || typeof nextProps !== "object") {
      return this;
    }

    Object.entries(nextProps).forEach(([key, value]) => {
      this.setCustomTemplateProp(key, value, baseContext);
    });

    return this;
  }

  setCustomTemplateProp(key, value, baseContext = {}) {
    const prop = this.attributeToPropertyName(toAttributeName(key));

    if (!this.isCustomTemplateProp(prop, baseContext)) {
      return this;
    }

    if (value === false || value === null || typeof value === "undefined") {
      if (this._customTemplateProps.delete(prop)) {
        this.requestComponentUpdate(prop);
      }

      return this;
    }

    if (this._customTemplateProps.get(prop) === value) {
      return this;
    }

    this._customTemplateProps.set(prop, value);
    this.requestComponentUpdate(prop);

    return this;
  }

  attributeToPropertyName(name) {
    return String(name || "").replace(/-([a-z0-9])/g, (_, symbol) =>
      symbol.toUpperCase(),
    );
  }

  resolveUpdateMode() {
    return "lit";
  }

  createPropsTemplateContext(extraContext = {}) {
    return this.createTemplateContext({
      component: this,
      ...this.getPropsContext(),
      ...extraContext,
    });
  }

  templateContext() {
    return this.createPropsTemplateContext();
  }

  captureSlotTemplates() {
    if (this._slotTemplatesCaptured) {
      return;
    }

    this._slotTemplatesCaptured = true;

    Array.from(this.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }

      const slotName = child.getAttribute("slot");
      if (!slotName) {
        return;
      }

      if (child.tagName?.toLowerCase?.() === "template") {
        if (!this._slotTemplates.has(slotName)) {
          this._slotTemplates.set(slotName, []);
        }

        Array.from(child.content?.childNodes || []).forEach((node) => {
          this._slotTemplates.get(slotName).push(node.cloneNode(true));
        });

        child.remove();
        return;
      }

      if (!this._liveSlotNodes.has(slotName)) {
        this._liveSlotNodes.set(slotName, []);
      }

      const shouldUnwrapSlotHost =
        child.getAttributeNames().length === 1 && child.hasAttribute("slot");
      const slotNodes = shouldUnwrapSlotHost
        ? Array.from(child.childNodes)
        : [child];

      this._liveSlotNodes.get(slotName).push(...slotNodes);
      child.remove();
    });
  }

  captureChildTemplates(name, matcher, options = {}) {
    if (!name) {
      return [];
    }

    const { append = true, remove = true } = options;
    const matches =
      typeof matcher === "function"
        ? matcher
        : (node) =>
            node instanceof Element &&
            typeof matcher === "string" &&
            node.matches?.(matcher);
    const nodes = Array.from(this.childNodes || []).filter((child) =>
      matches(child),
    );

    if (!nodes.length) {
      return [];
    }

    if (!append || !this._slotTemplates.has(name)) {
      this._slotTemplates.set(name, []);
    }

    const templates = nodes.map((node) => node.cloneNode(true));

    templates.forEach((node) => {
      this._slotTemplates.get(name).push(node);
    });

    if (remove) {
      nodes.forEach((node) => node.remove());
    }

    return templates.map((node) => node.cloneNode(true));
  }

  hasSlotContent(name) {
    if ((this._liveSlotNodes.get(name) || []).length > 0) {
      return true;
    }

    return (this._slotTemplates.get(name) || []).length > 0;
  }

  getSlotContent(name) {
    const liveSlotContent = this._liveSlotNodes.get(name) || [];
    if (liveSlotContent.length) {
      return liveSlotContent.length === 1
        ? liveSlotContent[0]
        : liveSlotContent;
    }

    const slotContent = this._slotTemplates.get(name) || [];
    if (!slotContent.length) {
      return nothing;
    }

    if (slotContent.length === 1) {
      return slotContent[0].cloneNode(true);
    }

    return slotContent.map((node) => node.cloneNode(true));
  }

  setSlot(name, ...elements) {
    if (!name) {
      return this;
    }

    // Преобразуем строки в DOM-элементы
    const parsed = elements
      .map((el) => {
        if (typeof el === "string") {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = el;
          return Array.from(wrapper.childNodes);
        }
        return [el];
      })
      .flat()
      .filter((node) => node instanceof Node);

    // Обновляем _slotTemplates (Lit-рендеринг)
    this._slotTemplates.delete(name);

    // Обновляем _liveSlotNodes (если есть — для совместимости с sf-modal)
    this._liveSlotNodes.set(name, parsed);

    // Запрашиваем перерендер
    this.requestComponentUpdate("slot-change");
    return this;
  }

  copyRuntimeData(source, target) {
    if (!(source instanceof Node) || !(target instanceof Node)) {
      return;
    }

    if (source.__sfCreateEventHandlers) {
      Object.defineProperty(target, "__sfCreateEventHandlers", {
        configurable: true,
        enumerable: false,
        value: source.__sfCreateEventHandlers.slice(),
      });
    }

    const sourceChildren = Array.from(source.childNodes || []);
    const targetChildren = Array.from(target.childNodes || []);

    sourceChildren.forEach((sourceChild, index) => {
      this.copyRuntimeData(sourceChild, targetChildren[index]);
    });
  }

  clearSlot(name) {
    if (!name) {
      return this;
    }

    this._slotTemplates.delete(name);
    if (this._liveSlotNodes) {
      this._liveSlotNodes.delete(name);
    }

    this.requestComponentUpdate("slot-change");
    return this;
  }

  async resolveTemplateResult(changedAttributes = []) {
    const templateName = this.componentTemplateName;
    const renderToken = this._renderToken;

    if (this.hasBuiltInTemplate(templateName)) {
      this._releaseExternalTemplate();
      return this.template();
    }

    const externalModule =
      await this.resolveExternalTemplateModule(templateName);
    if (
      !this._isMounted ||
      renderToken !== this._renderToken ||
      templateName !== this.componentTemplateName
    ) {
      return nothing;
    }
    if (externalModule !== this._externalTemplateModule) {
      this._releaseExternalTemplate();
    }
    this._externalTemplateModule = externalModule || null;

    if (externalModule) {
      const rawContext = this.templateContext();
      const context = this.createTemplateContext(
        this.mapExternalTemplateContext(rawContext, externalModule),
      );
      const renderFn =
        typeof externalModule.default === "function"
          ? externalModule.default
          : null;

      if (renderFn) {
        return renderFn({
          html,
          nothing,
          context,
          component: this,
          changedAttributes,
        });
      }
    }

    this._externalTemplateModule = null;
    return this.template();
  }

  hasBuiltInTemplate(templateName = this.componentTemplateName) {
    return !templateName || templateName === "default";
  }

  mapExternalTemplateContext(context, externalModule) {
    if (typeof externalModule?.mapContext === "function") {
      return (
        externalModule.mapContext({
          context,
          component: this,
          html,
          nothing,
        }) || context
      );
    }

    return context;
  }

  async resolveExternalTemplateModule(
    templateName = this.componentTemplateName,
  ) {
    if (!templateName) {
      return null;
    }

    const moduleUrl = this.getExternalTemplateModuleUrl(templateName);
    if (!moduleUrl) {
      return null;
    }

    await this.loadExternalTemplateCss(templateName);

    if (this.constructor.externalTemplateModules.has(moduleUrl)) {
      return this.constructor.externalTemplateModules.get(moduleUrl);
    }

    if (this.constructor.externalTemplateMisses.has(moduleUrl)) {
      return null;
    }

    const exists = await this.checkExternalTemplateModule(moduleUrl);
    if (!exists) {
      this.constructor.externalTemplateMisses.add(moduleUrl);
      return null;
    }

    try {
      const externalModule = await import(/* webpackIgnore: true */ moduleUrl);
      this.constructor.externalTemplateModules.set(moduleUrl, externalModule);
      return externalModule;
    } catch (error) {
      console.warn(error);
      this.constructor.externalTemplateMisses.add(moduleUrl);
      return null;
    }
  }

  async checkExternalTemplateModule(moduleUrl) {
    if (!moduleUrl) {
      return false;
    }

    if (this.constructor.externalTemplateChecks.has(moduleUrl)) {
      return this.constructor.externalTemplateChecks.get(moduleUrl);
    }

    const checkPromise = fetch(moduleUrl, {
      method: "GET",
      cache: "no-store",
    })
      .then((response) => response.ok)
      .catch(() => false);

    this.constructor.externalTemplateChecks.set(moduleUrl, checkPromise);

    const exists = await checkPromise;
    if (!exists) {
      this.constructor.externalTemplateChecks.delete(moduleUrl);
    }

    return exists;
  }

  getExternalTemplateModuleUrl(templateName = this.componentTemplateName) {
    const basePath = String(this.externalTemplateBasePath || "").replace(
      /\/$/,
      "",
    );
    const componentName = this.externalTemplateComponentName;

    if (!basePath || !componentName || !templateName) {
      return "";
    }

    return `${basePath}/${componentName}/${templateName}/index.js`;
  }

  getExternalTemplateCssUrl(templateName = this.componentTemplateName) {
    const basePath = String(this.externalTemplateBasePath || "").replace(
      /\/$/,
      "",
    );
    const componentName = this.externalTemplateComponentName;

    if (!basePath || !componentName || !templateName) {
      return "";
    }

    return `${basePath}/${componentName}/${templateName}/index.css`;
  }

  loadExternalTemplateCss(templateName = this.componentTemplateName) {
    const cssUrl = this.getExternalTemplateCssUrl(templateName);

    if (!cssUrl) {
      return Promise.resolve(false);
    }

    if (this.constructor.externalTemplateCssLoaded.has(cssUrl)) {
      return Promise.resolve(true);
    }

    if (this.constructor.externalTemplateCssMisses.has(cssUrl)) {
      return Promise.resolve(false);
    }

    const existing = document.querySelector(
      `link[data-sf-smart-css="${cssUrl}"]`,
    );
    if (existing) {
      this.constructor.externalTemplateCssLoaded.add(cssUrl);
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      link.dataset.sfSmartCss = cssUrl;
      link.onload = () => {
        this.constructor.externalTemplateCssLoaded.add(cssUrl);
        resolve(true);
      };
      link.onerror = () => {
        this.constructor.externalTemplateCssMisses.add(cssUrl);
        resolve(false);
      };
      document.head.append(link);
    });
  }

  _releaseExternalTemplate() {
    const externalModule = this._externalTemplateModule;
    if (!externalModule) return;

    this._externalTemplateModule = null;
    this.runExternalHook("destroy", {}, externalModule);
  }

  runExternalHook(
    hookName,
    detail = {},
    externalModule = this._externalTemplateModule,
  ) {
    if (typeof externalModule?.[hookName] !== "function") {
      return;
    }

    try {
      externalModule[hookName]({
        component: this,
        root: this,
        html,
        nothing,
        context: this.templateContext(),
        ...detail,
      });
    } catch (error) {
      console.warn(error);
    }
  }

  updateDom() {
    return false;
  }

  shouldClearLightDomBeforeFirstRender() {
    return this.constructor.clearLightDomBeforeFirstRender === true;
  }

  prepareRenderContainer() {
    if (this._hasRendered || !this.shouldClearLightDomBeforeFirstRender()) {
      return;
    }

    this.replaceChildren();
  }

  template() {
    return nothing;
  }

  beforeRender() {}

  afterRender(callback) {
    if (typeof callback === "function") {
      return this.whenRendered(callback);
    }

    return undefined;
  }

  afterUpdate() {}

  onConnected() {}

  onDisconnected() {
    this._releaseExternalTemplate();
  }
}

export default SfBaseElement;

// Global access for Playground, console, and project-level components.
if (typeof window !== "undefined") {
  window.SfBaseElement = SfBaseElement;
  window.html = html;
  window.nothing = nothing;
  window.render = render;

  if (!window.SF) {
    window.SF = {};
  }

  window.SF.SfBaseElement = SfBaseElement;
  window.SF.html = html;
  window.SF.nothing = nothing;
  window.SF.render = render;
  window.SF.smart = {
    ...(window.SF.smart || {}),
    SfBaseElement,
    html,
    nothing,
    render,
    toBoolean,
    toAttributeName,
    toNumber,
    normalizeEnum,
    parseJsonAttribute,
  };
  // Announced once per page, by whichever copy of the base arrives first --
  // SF.loadSmartBase() or the first Smart bundle, each of which carries one --
  // so SF.smartBaseReady settles however the base came.
  if (!window.SF.__internal.smartBaseAnnounced) {
    window.SF.__internal.smartBaseAnnounced = true;
    try {
      window.dispatchEvent(new CustomEvent("sf-smart-base-ready", {
        detail: { smart: window.SF.smart, loader: window.SF.Loader || null, timestamp: Date.now() },
      }));
    } catch (error) {
      console.warn("sf-smart-base-ready dispatch failed", error);
    }
  }
}
