import { noteDeprecated } from './deprecations.js';
import './internal.js';
import { installAliases } from './aliases.js';
import { upgradeOwnProperties } from './upgrade-properties.js';
import { connectPort as connectHostPort, portOf } from './host-port.js';
import { html, nothing, render } from "lit";
import {createRef} from "lit/directives/ref.js";
import {Directive, PartType, directive} from "lit/directive.js";
import { followLanguage, language } from "./page-language";
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

// Definitions in batches (stand 25, D10). A page's Smart bundles arrive one
// script after another, and each definition upgrades its elements and
// invalidates the style of the whole page: on the admin forty of them, each in
// a frame of its own with a style recalculation of 100-300 ms at 4x CPU. A
// definition now waits for the next frame, and every bundle that ran before it
// is defined in the same callback, so the frame recalculates once. A hidden
// tab has no frames: there the batch runs on a timer, as the Loader's work
// does. SF_BOOT_CONFIG.batchDefinitions = false defines at once, as before.
// The queue is on a shared global: each bundle may carry its own copy of
// this module.
const DEFINITIONS = Symbol.for("simai.sf.smart-base.definitions");

function pendingDefinitions() {
  if (!globalThis[DEFINITIONS]) {
    // flush: the Loader defines what is queued before it runs a script that
    // depends on it -- a relation is defined before the element naming it runs.
    Object.defineProperty(globalThis, DEFINITIONS, {
      value: { queue: new Map(), scheduled: false, flush: () => defineQueued() },
      configurable: true,
    });
  }
  return globalThis[DEFINITIONS].queue;
}

// Defines what is queued, in the order the bundles ran; `only`, when given,
// defines those tags alone and leaves the rest queued.
function defineQueued(only = null) {
  const state = globalThis[DEFINITIONS];
  const batch = [...state.queue].filter(([tagName]) => !only || only.has(tagName));
  batch.forEach(([tagName]) => state.queue.delete(tagName));
  batch.forEach(([tagName, constructor]) => {
    if (customElements.get(tagName)) return;
    try {
      customElements.define(tagName, constructor);
    } catch (error) {
      console.error(`${tagName}: definition failed`, error);
    }
  });
}

// The parts of an element holding a declared port (standard §4.9, §7.3; stand
// 27): the element, the parts inside it and their relations (core
// early-port.js, SF.EarlyPort.firstTags). Defined in a batch of their own,
// before the rest of the page's: the element is handed its port and draws its
// first answer in that task, and the other definitions follow in the next
// frame instead of standing in front of it.
function firstTags() {
  try {
    const tags = globalThis.SF?.EarlyPort?.firstTags?.();
    return tags instanceof Set ? tags : new Set();
  } catch {
    return new Set();
  }
}

function flushDefinitions() {
  const state = globalThis[DEFINITIONS];
  state.scheduled = false;
  const first = firstTags();
  if (first.size) {
    const queued = [...state.queue.keys()];
    const mine = new Set(queued.filter((tagName) => first.has(tagName)));
    if (mine.size && mine.size < queued.length) {
      defineQueued(mine);
      scheduleFlush();
      return;
    }
  }
  defineQueued();
}

// A frame, or a short timer when none comes (an iframe out of view); a timer
// in a hidden tab, which has no frames.
function scheduleFlush() {
  const state = globalThis[DEFINITIONS];
  if (state.scheduled) return;
  state.scheduled = true;
  if (document.hidden) {
    setTimeout(flushDefinitions, 0);
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    flushDefinitions();
  };
  const frame = requestAnimationFrame(run);
  const timer = setTimeout(run, 100);
}

function queueDefinition(tagName, constructor) {
  // Only on a page the Loader drives: a bundle included by hand beside the
  // Smart base alone is defined at once, as its page expects.
  const batching =
    typeof window !== "undefined" &&
    typeof requestAnimationFrame === "function" &&
    Boolean(window.SF?.Loader) &&
    window.SF_BOOT_CONFIG?.batchDefinitions !== false;
  if (!batching) {
    customElements.define(tagName, constructor);
    return;
  }
  pendingDefinitions().set(tagName, constructor);
  scheduleFlush();
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

// The marks the runtime keeps on a Smart host (SF.Assembly, the first paint,
// the Loader): forwardHostAttributes leaves them on the host.
const HOST_RUNTIME_MARKS = new Set([
  "data-sf-role",
  "data-sf-instance",
  "data-sf-start",
  "data-sf-started",
  "data-sf-assembly",
  "data-sf-static",
  "data-sf-first-paint",
  "data-sf-held",
  "data-sf-skeleton",
  "data-sf-observer",
]);

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

    const existing =
      customElements.get(resolvedTagName) ||
      pendingDefinitions().get(resolvedTagName);
    if (existing) {
      if (!this.isSameComponentAs(existing)) {
        console.warn(
          `${this.name || "SfBaseElement"}.define(): ${resolvedTagName} is already defined`,
          existing,
        );
      }

      return existing;
    }

    queueDefinition(resolvedTagName, this);
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
    // A connected callback can run for an element that is no longer in the
    // page: custom-element reactions run late, at the next [CEReactions]
    // boundary, so an element a parent takes out while its connected reaction
    // is still queued (a modal moving its slotted content) runs that reaction
    // detached, and its disconnected reaction may already have run inside it.
    // What it started then would have no disconnect to end it (gate 36: a
    // language listener per sf-slider of a gallery's lightbox, 2026-10-27).
    // It is placed again later, and that placing connects it.
    if (!this.isConnected) return;
    // Values a page or a parent's template set before this class was defined
    // reach their setters now, once, before anything is drawn from them.
    if (!this.__sfPropertiesUpgraded) {
      this.__sfPropertiesUpgraded = true;
      upgradeOwnProperties(this);
    }
    this.constructor.ensureStyleReadinessCss();
    this.captureHostStyle();
    this.applyHostDisplayStyle();
    this.captureSlotTemplates();
    this.__sfSourceCaptured = true;
    this._isMounted = true;
    // Dated aliases (standard 1.3.8 §16.20): the component's aliases.json,
    // installed once per element and kept while it is detached, so a page
    // that moves it keeps its old names. Before onConnected, so the old
    // attributes in the markup have filled the new ones when it draws.
    this.sfOpenScope();
    if (this.constructor.aliases && !this.__sfAliases) {
      // A component whose old event names carried more than the new ones
      // (page elements, which §8 takes out of detail) gives the shim one
      // detail adapter per old name: sfAliasAdapters() -> {old: (detail) => old detail}.
      this.__sfAliases = installAliases(this, this.constructor.aliases, {tag: this.localName, signal: this.sfScope, adapters: this.sfAliasAdapters?.() ?? {}});
    }
    this.onConnected();
    // Taken out while it connected (its disconnected callback ran inside
    // onConnected): nothing more is started.
    if (!this.isConnected) return;
    // A component chooses its words when it draws and would otherwise keep
    // them for ever: changing the page's language used to mean reloading it.
    // Subscribing here rather than in each component is the same argument as
    // the shared rule itself -- sixteen subscriptions would be sixteen chances
    // to forget one (owner, 2026-10-11: «языков будет гораздо больше чем два»).
    this.__sfLanguageOff = language.onChange(() => {
      if (this._isMounted) this.requestComponentUpdate("language");
    });
    // A [lang] changed on the page redraws the elements under it (standard
    // 1.3.8 §11.1; simai/ui-source#45): one observer for the document.
    this.__sfLanguageUnwatch = followLanguage(this, () => {
      if (this._isMounted) this.requestComponentUpdate("language");
    });
    this.emitComponentEvent("connected");
    this.requestComponentUpdate("connected");
  }

  // The instance's scope (standard 1.3.8 §7.7): one abort signal for
  // everything the instance starts -- listeners on other nodes, timers,
  // requests, observers, its aliases. It ends when the instance is removed:
  // taken out and not placed again before the next task, so a page that
  // moves an element keeps it. A new scope opens when it is placed again.
  get sfScope() {
    if (!this.__sfScope) this.__sfScope = new AbortController();
    return this.__sfScope.signal;
  }

  // The base action connect-port {port} (standard 1.3.8 §4.1, §4.9), with
  // setHostPort as its alias: the port is kept on the instance's scope and the
  // component's optional onPortConnected(port, {signal}) runs; a component's
  // own older setHostPort override runs in its place (core/js/host-port.js).
  connectPort(port) {
    return connectHostPort(this, port, SfBaseElement.prototype.setHostPort);
  }

  setHostPort(port) {
    return this.connectPort(port);
  }

  /** The host port the instance holds now (§4.9), or null. */
  get sfPort() {
    return portOf(this);
  }

  sfOpenScope() {
    clearTimeout(this.__sfScopeEnd);
    this.__sfScopeEnd = null;
    if (this.__sfScope?.signal.aborted) {
      this.__sfScope = null;
      this.__sfAliases = null;
    }
    return this.sfScope;
  }

  sfCloseScope() {
    clearTimeout(this.__sfScopeEnd);
    this.__sfScopeEnd = setTimeout(() => {
      this.__sfScopeEnd = null;
      if (!this.isConnected) this.__sfScope?.abort();
    }, 0);
  }

  disconnectedCallback() {
    this._isMounted = false;
    this.sfCloseScope?.();
    this.__sfLanguageOff?.();
    this.__sfLanguageOff = null;
    this.__sfLanguageUnwatch?.();
    this.__sfLanguageUnwatch = null;
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

    // A printed skeleton stays until the data it stands for arrives (§5.4,
    // §7.3 phase 3): the first render then replaces it in one frame.
    if (!this._hasRendered && this.sfAwaitingData?.() === true) {
      return;
    }

    // An element drawn inside another's static markup is part of that
    // picture: it does not draw on its own (a slider in a gallery's picture
    // drew without its slides before the gallery came). The element around
    // it replaces the picture, or hands this part of it to its own new one.
    if (!this._hasRendered && this.parentElement?.closest("[data-sf-static]")) {
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

    // A printed first paint stays on screen until the sheets the element
    // draws with are applied, and is replaced styled: hiding the element
    // while they came showed a blank box between the printed picture and the
    // element's own (stand 25: the admin menu blank for 200-300 ms). The
    // Loader asks for those sheets with the element's script, so they are
    // usually in when it is defined.
    if (!this._hasRendered && !this._styleReady && this.staticMarkup().length) {
      const readiness = this.stylesReadiness();
      if (readiness) {
        await readiness;
        if (!this._isMounted || renderToken !== this._renderToken) {
          return;
        }
        this._styleReady = true;
      }
    }

    const printed = this._hasRendered ? [] : this.staticMarkup();
    this.prepareRenderContainer(changedAttributes);
    this.markStylePending(this);
    render(templateResult, this);
    if (printed.length) {
      this.handOverStaticMarkup(printed);
      // Page children the first paint held out of view are placed now.
      this.querySelectorAll("[data-sf-held]").forEach((node) => {
        if (!node.parentElement?.querySelector(":scope > [data-sf-static]")) node.removeAttribute("data-sf-held");
      });
    }
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

  // The sheets this element draws with, applied: a promise that settles once
  // per element (and at the latest after styleReadyTimeout), null when there
  // is nothing to wait for.
  //
  // The Loader knows the sheets an element draws with (ensureStylesReady).
  // An element defined before the Loader has started -- a page that loads
  // its parts with <script defer> beside core.js -- waits for it (SF.ready
  // settles at sf-loader-init) instead of declaring itself ready: it used to
  // draw its text before any of its sheets (stand 25, D2). Without core on
  // the page there is no Loader to wait for, and the element is ready now.
  stylesReadiness({ autoLoad = true } = {}) {
    if (this._styleReady || !this.shouldWaitForStylesReady()) return null;
    if (autoLoad && this._styleReadyPromise) return this._styleReadyPromise;
    const loaderNow = window.SF?.Loader;
    const awaitedLoader =
      loaderNow && typeof loaderNow.ensureStylesReady === "function"
        ? Promise.resolve(loaderNow)
        : !loaderNow && window.SF?.ready && typeof window.SF.ready.then === "function"
          ? Promise.resolve(window.SF.ready).then(() => window.SF?.Loader)
          : null;
    if (!awaitedLoader) return null;

    const readiness = awaitedLoader.then((loader) =>
      typeof loader?.ensureStylesReady === "function"
        ? loader.ensureStylesReady(this, { autoLoad })
        : true,
    );
    const timeout = Number(this.constructor.styleReadyTimeout ?? 3000);
    // The time limit is cleared once the sheets are in: a timer left behind
    // per element was a leak of its own (gate 36).
    let timer = null;
    const settled = (
      timeout > 0
        ? Promise.race([
            readiness,
            new Promise((resolve) => {
              timer = setTimeout(resolve, timeout);
            }),
          ])
        : readiness
    )
      .catch((error) => {
        console.warn(
          `${this.componentTagName || "sf-element"}: style readiness failed`,
          error,
        );
      })
      .finally(() => clearTimeout(timer));
    if (autoLoad) this._styleReadyPromise = settled;
    return settled;
  }

  async whenRenderedStylesReady(target = this) {
    if (!this.shouldWaitForStylesReady()) {
      return;
    }
    const readiness = this.stylesReadiness();
    if (readiness) await readiness;
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

  // Host attributes the component does not own are copied to the control it
  // renders, so a native button gets the author's aria- and ordinary
  // attributes. A data-* is moved, not copied: it ends up on the control alone.
  //
  // One element carries it, and it is the one that has a box, paints, takes
  // focus, is clicked and is dragged. Both other shapes failed in production.
  // Copying a data-* to the control while the host kept it put every one on two
  // elements: querySelectorAll('[data-action="close"]') answered 2 where the
  // product had written 1, and the first match was the display:contents host --
  // no box, so a drag through its bounding box threw, and no paint, so a probe
  // reading a filled button read the wrong element (consumer cases
  // larena.property-view-arranging, larena.property-view,
  // larena.table-sortable-lists, larena.admin-menu-search, 2026-10-22). Keeping
  // it on the host alone leaves one element, but a boxless one, so the drag and
  // the paint still have nothing to read: a display:contents host generates no
  // box at all, and no JavaScript can give it one.
  //
  // So the control carries it, and the host is reached back from it with
  // closest('sf-button') -- the direction that always exists. The host's own
  // record of what the author wrote is readable as element.dataAttributes
  // (consumer case ui-mail.button-data-attributes, 2026-10-21: a product that
  // wrote data-add on <sf-button> needs a way to read it back), and
  // removeHostDataAttribute() takes one off the host's record and the control
  // together.
  //
  // The runtime's own marks of the host are not the author's and are never
  // moved: SF.Assembly's part marks (data-sf-role, data-sf-instance,
  // data-sf-start, data-sf-started) and the first paint's (data-sf-static,
  // data-sf-first-paint, data-sf-held, data-sf-observer) name the host, the
  // element the Assembly and the Loader find by them. Moved to the control,
  // a printed sf-button carried its role on <button>, and the Assembly could
  // not adopt it: it drew a second button and the line below moved (stand
  // 24, F2).
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

      if (HOST_RUNTIME_MARKS.has(name)) {
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

    // The record outlives the host attribute, because the attribute is taken
    // off the host: it is what the control is given again on every render.
    dataAttributes.forEach((value, name) => {
      nextKeys.add(name);
      target.setAttribute(name, value);
    });

    target[targetStorageKey] = nextKeys;
    this[storageKey] = dataAttributes;
    // Where element.dataAttributes and removeHostDataAttribute() read and
    // write, whatever storage key the component chose.
    this.__sfHostDataAttributes = dataAttributes;
    this.__sfHostDataAttributeTarget = target;
    this.__sfHostDataAttributeTargetKeys = targetStorageKey;

    if (dataAttributeNamesToRemove.length) {
      this.__sfForwardingHostAttributes = true;
      dataAttributeNamesToRemove.forEach((name) => this.removeAttribute(name));
      this.__sfForwardingHostAttributes = false;
    }

    return this;
  }

  // What the author wrote as data-* on this host, read the way dataset reads:
  // dataAttributes.add for data-add. The attributes themselves live on the
  // native control, so host.dataset is empty and this is the host's answer.
  get dataAttributes() {
    const record = this.__sfHostDataAttributes;
    if (!record || !record.size) {
      return {};
    }

    const read = {};
    record.forEach((value, name) => {
      const key = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      read[key] = value;
    });

    return read;
  }

  // Take a data-* off the host's record and off the control together. Removing
  // it from the control alone is undone on the next render, because the record
  // is what the control is given again.
  removeHostDataAttribute(name) {
    if (typeof name !== "string" || !name) {
      return this;
    }

    const attribute = name.startsWith("data-")
      ? name
      : `data-${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;

    this.__sfForwardingHostAttributes = true;
    this.removeAttribute(attribute);
    this.__sfForwardingHostAttributes = false;

    this.__sfHostDataAttributes?.delete(attribute);
    this.__sfHostDataAttributeTarget?.removeAttribute?.(attribute);
    const keys = this.__sfHostDataAttributeTargetKeys;
    if (keys) this.__sfHostDataAttributeTarget?.[keys]?.delete?.(attribute);

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

  // The control inside the host that takes focus on the host's behalf. A Smart
  // host lays out as display:contents, so it generates no box and cannot be
  // focused: focus() on it did nothing and left document.activeElement where it
  // was. A component that renders a native control names it here.
  //
  // This is what makes a data-* on the host usable as a handle. A product finds
  // the host by the attribute it wrote -- the one element that carries it -- and
  // then focuses what it found: Larena's admin menu returns focus to its
  // magnifier that way, with this.querySelector('[data-sf-admin-search-toggle]')
  // and .focus() on the answer (consumer case larena.admin-menu-search,
  // 2026-10-22). Focus lands on the native control, so document.activeElement is
  // the control and host.contains(document.activeElement) is true.
  focusDelegate() {
    return null;
  }

  focus(options) {
    const target = this.focusDelegate?.();

    if (target && typeof target.focus === "function") {
      target.focus(options);
      return;
    }

    // Asked before the control exists: focus once it does, and only if nothing
    // else took focus while this waited -- a queued focus must not steal it back.
    if (!target && typeof this.focusDelegate === "function" && !this.isRendered) {
      const activeWhenAsked = this.ownerDocument?.activeElement || null;
      this.whenRendered(() => {
        const ready = this.focusDelegate?.();
        if (!ready || typeof ready.focus !== "function") return;
        if ((this.ownerDocument?.activeElement || null) !== activeWhenAsked) return;
        ready.focus(options);
      });
      return;
    }

    super.focus(options);
  }

  blur() {
    const target = this.focusDelegate?.();

    if (target && typeof target.blur === "function") {
      target.blur();
      return;
    }

    super.blur();
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
    // Static markup is a picture of the element, not its content (§5.4).
    const nodes = Array.from(this.childNodes || []).filter((child) =>
      !child.hasAttribute?.("data-sf-static") && matches(child),
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

  // Static markup is the element's first paint: what a server, a static page
  // or the docs printed inside the host before the code arrived, each top node
  // marked data-sf-static (standard simai.smart-component 1.3.8 §5.4;
  // simai/ui-source#40). The first render replaces it in the same task as it
  // draws the template, so the page shows one or the other in every frame:
  // never both (two switches, the text below pushed down) and never neither.
  // The element takes its first values from the host's attributes, never from
  // these nodes. Page content (anything with slot="...") is not static markup:
  // the slots took it before this.
  staticMarkup() {
    return Array.from(this.children).filter(
      (child) => child.hasAttribute("data-sf-static") && !child.hasAttribute("slot"),
    );
  }

  prepareRenderContainer() {
    if (this._hasRendered) {
      return;
    }

    if (this.shouldClearLightDomBeforeFirstRender()) {
      this.replaceChildren();
      this.endFirstPaint();
      return;
    }

    this.staticMarkup().forEach((node) => node.remove());
    this.endFirstPaint();
  }

  // A Smart element this element's template draws (a slider in a gallery, a
  // button in a header) is new and draws itself later, a frame or more after
  // this one. Its part of the printed picture goes over to it, in the same
  // task: the n-th new element of a tag takes the static children of the n-th
  // printed one, so the page shows the picture of it until it draws (§5.4,
  // gate 23: no frame without the component).
  handOverStaticMarkup(printed) {
    const pool = new Map();
    for (const node of printed) {
      for (const element of node.querySelectorAll("*")) {
        if (!element.localName.includes("-")) continue;
        if (!pool.has(element.localName)) pool.set(element.localName, []);
        pool.get(element.localName).push(element);
      }
    }
    if (!pool.size) return;
    for (const element of this.querySelectorAll("*")) {
      if (!element.localName.includes("-") || element.isRendered === true) continue;
      // Only an element that will draw takes a picture: a Smart element, or
      // one whose code has not arrived.
      if (customElements.get(element.localName) && !("isRendered" in element)) continue;
      if (element.closest("[data-sf-static]")) continue;
      const old = pool.get(element.localName)?.shift();
      if (!old) continue;
      // Text the template put inside it would show beside the picture: such
      // an element shows its text until it draws. Elements it was given are
      // held out of view (data-sf-held) while the picture stands.
      if (Array.from(element.childNodes).some((node) => node.nodeType === 3 && node.data.trim())) continue;
      const pictures = Array.from(old.children).filter((child) => child.hasAttribute("data-sf-static"));
      if (!pictures.length) continue;
      Array.from(element.children).forEach((child) => child.setAttribute("data-sf-held", ""));
      // The printed host's box (display: contents, as the element sets it on
      // connect) until its code comes: an undefined host is inline and gave
      // a line of its own around the picture.
      const display = old.style?.display;
      if (display && !element.style.display) element.style.display = display;
      element.append(...pictures);
    }
  }

  // What the first paint left on the host goes with it: the skeleton's
  // marks, and the hold on page children the static markup showed for them
  // (core placeholder sheet, data-sf-held).
  endFirstPaint() {
    if (this.getAttribute("data-sf-first-paint") === "skeleton") {
      this.removeAttribute("aria-busy");
    }
    this.removeAttribute("data-sf-first-paint");
    Array.from(this.children).forEach((child) => child.removeAttribute("data-sf-held"));
    // A host printed as a static node of another's picture and adopted live
    // (sf-data-view takes its printed sf-table and sf-pagination as its
    // slotted children) is no longer static markup once it draws. The mark
    // stays only while the element around it can still replace its picture:
    // a Smart parent that has not drawn yet, and the node is not slotted page
    // content (stand 24, U1).
    if (this.hasAttribute("data-sf-static")) {
      const parent = this.parentElement;
      const pictureOfParent =
        !this.hasAttribute("slot") &&
        Boolean(parent?.localName.includes("-")) &&
        parent.isRendered !== true;
      if (!pictureOfParent) this.removeAttribute("data-sf-static");
    }
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
