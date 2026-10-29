// An element from its manifest (standard simai.smart-component 1.3.8 §3, §4,
// §4.1, §4.4, §7.7, §8, §11, §17.1).
//
// A component folder holds component.json, its language files and its
// aliases.json; the element's attribute and property code, the methods of its
// actions and the names of its events are not written by hand but made from
// them here:
//
//   import manifest from './component.json';
//   import en from './lang/en.json';
//   import ru from './lang/ru.json';
//   import aliases from './aliases.json';
//   const Base = elementFromManifest(manifest, {base: SfBaseElement, lang: {en, ru}, aliases, actions: {...}});
//   class SfThing extends Base { ...behaviour only... }
//
// Why at load and not in the build: ui-builder compiles a Smart component's
// index.js with webpack and babel and transforms nothing of its own, so the
// JSON files are bundled as they are (webpack reads JSON imports) and the
// plumbing is made once per class when the bundle runs. A build step can take
// this over later without a change in the components: the input is the same
// manifest.
//
// What the class gets:
//
// - settings (§4): an attribute and a property per setting, typed (`string`,
//   `enum`, `boolean`, `number`, `icon`, `date`, `id`; `list`, `object` and
//   `state` are properties only); a setting with `"default-from":
//   "runtime.<word>"` defaults to that word in the element's language;
// - values (§4, §4.3): a value with a default is also a setting of the same
//   name; the others are read-only properties that a component overrides with
//   its own getter;
// - events (§8): `sfEmit(verb, detail)` sends `<tag>-<verb>`, or the native
//   name for `change`, `input` and `"carries": "native"` (with the detail
//   when one is given), through the dated aliases, so the old names follow;
// - actions (§4.4): one method per action that takes its `with` parameters as
//   one object or in declared order and answers an outcome, `{outcome:
//   'applied'}` or `{outcome: 'refused', reason}`; `"emits"` sends its event
//   once first, and a page that cancels it makes the action refused; a
//   waiting action whose instance is removed answers `cancelled`;
// - the base action `connect-port {port}` (§4.1, §4.9): `connectPort(port)`,
//   `setHostPort` its alias, the port kept on the instance's scope and read
//   as `sfPort`, the component's `onPortConnected(port, {signal})` its hook
//   (core/js/host-port.js; the Smart base has it, another base gets it here);
// - the base values `shown` and `started` (§4.1) and the host state
//   `data-sf-started`; `sfHostState(name, on)` writes the declared
//   `host-states` (§5.3);
// - static `aliases` from aliases.json (§16.20), installed by the base;
// - words (§11, §11.1): `sfWord(key, {count, vars})`, with the element's own
//   word first, then the nearest [lang], the page's choice, <html lang>,
//   English, the source language and the key;
// - a form control (§17.1): `formAssociated` and ElementInternals where the
//   browser has them; `sfFormValue()` is what the form gets.
//
// Members the runtime adds start with `sf`, which no manifest name may
// (§3.1), so a generated setting or action never collides with them.

import { dispatchAliased } from './aliases.js';
import { pageWord } from './page-language.js';
import { noteDeprecated } from './deprecations.js';
import { bindPageActions } from './page-actions.js';
import { installPortAction } from './host-port.js';

const RESERVED = new Set([
  'props', 'api', 'view', 'scope', 'parts', 'receive', 'render', 'connected',
  'disconnected', 'updated', 'outside', 'data',
  'template', 'root-class', 'root-style', 'focus', 'blur', 'connect-port', 'shown', 'started',
]);

const PROPERTY_ONLY = new Set(['list', 'object', 'state']);

// core/js/smart-base.js toBoolean: what an attribute value means as true.
const TRUE_WORDS = new Set(['1', 'true', 'yes', 'on', 'checked', 'disabled', 'download', 'indeterminate', 'multiple']);

export const camelName = (name) => String(name).replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

// The browser's own members (§3.1): read from the prototype, never from a copy.
function isNativeMember(property) {
  let proto = globalThis.HTMLElement?.prototype;
  while (proto) {
    if (Object.prototype.hasOwnProperty.call(proto, property)) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

// The browser's own names a field reports under (§8, §17.3): a page listens
// for `change` and `input` on any form control, ours included, so they keep
// those names whatever they carry -- a detail when the component gives one,
// never `<tag>-change`. A component that holds other content and is no value
// control (sf-tabs, sf-steps, sf-pagination) declares `"x-native": false` on
// the event: it sends `<tag>-change`, so a field's change bubbling out of a
// panel is never taken for its own.
const NATIVE_EVENTS = new Set(['change', 'input']);

/** The DOM name of an event the manifest declares by its verb (§8). */
export function eventName(manifest, verb) {
  const declared = manifest?.events?.[verb];
  if (declared?.carries === 'native') return verb;
  // An event a trait brings carries no tag in its name: one name for the
  // whole family, so a form hears every field at once (`"shared": "<trait>"`,
  // §8, §20.2). The verb names it in full: `field-reset` -> `sf-field-reset`.
  if (declared?.shared) return `sf-${verb}`;
  if (NATIVE_EVENTS.has(verb) && declared?.['x-native'] !== false) return verb;
  return `${manifest.tag}-${verb}`;
}

/** An action's answer as an outcome (§4.4, vocabulary §3.1). */
export function toOutcome(result) {
  if (result === undefined || result === null || result === true) return {outcome: 'applied'};
  if (result === false) return {outcome: 'refused', reason: 'refused'};
  if (typeof result === 'string') {
    return ['applied', 'cancelled', 'conflict', 'unavailable'].includes(result)
      ? {outcome: result}
      : {outcome: 'refused', reason: result};
  }
  if (typeof result === 'object' && typeof result.outcome === 'string') return result;
  return {outcome: 'applied', value: result};
}

function typedDefault(spec) {
  if (Object.prototype.hasOwnProperty.call(spec, 'default')) return spec.default;
  switch (spec.type) {
    case 'boolean': return false;
    case 'number': return 0;
    case 'list': return [];
    case 'object':
    case 'state': return {};
    case 'enum': return spec.values?.[0] ?? '';
    default: return '';
  }
}

function runtimeWordOf(spec) {
  const from = spec?.['default-from'];
  return typeof from === 'string' && from.startsWith('runtime.') ? from.slice('runtime.'.length) : '';
}

/**
 * The members a manifest declares, read once: what the element exposes and
 * how each name is spelled on it.
 */
export function readManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !manifest.tag) {
    throw new TypeError('elementFromManifest: a manifest with a tag is required');
  }
  const members = [];
  const refused = [];
  const take = (part, name, spec, writable) => {
    const property = camelName(name);
    if (RESERVED.has(name) || name.startsWith('_') || name.startsWith('sf')) {
      refused.push({part, name, reason: 'reserved'});
      return;
    }
    members.push({
      part,
      name,
      property,
      type: spec.type || 'string',
      values: Array.isArray(spec.values) ? spec.values : null,
      default: typedDefault(spec),
      optional: spec.optional === true,
      attribute: PROPERTY_ONLY.has(spec.type) ? '' : name,
      writable,
      word: runtimeWordOf(spec),
      native: isNativeMember(property),
    });
  };
  for (const [name, spec] of Object.entries(manifest.settings || {})) take('settings', name, spec || {}, true);
  for (const [name, spec] of Object.entries(manifest.values || {})) {
    // A value a person changes is also writable as a setting (§4); one that
    // only shows (effective-*) is read.
    const writable = Object.prototype.hasOwnProperty.call(spec || {}, 'default') || Boolean(spec?.['default-from']);
    take('values', name, spec || {}, writable && !name.startsWith('effective-'));
  }
  const events = Object.fromEntries(Object.entries(manifest.events || {}).map(([verb, spec]) => [verb, {
    verb,
    name: eventName(manifest, verb),
    cancelable: spec?.cancelable === true,
    native: NATIVE_EVENTS.has(verb) || spec?.carries === 'native',
  }]));
  const actions = Object.entries(manifest.actions || {}).map(([name, spec]) => ({
    name,
    method: camelName(name),
    with: Object.keys(spec?.with || {}),
    emits: spec?.emits || '',
  }));
  return {tag: manifest.tag, members, events, actions, refused, hostStates: {...(manifest['host-states'] || {})}, form: manifest.form || null};
}

/** The base's `props` for the members that live in attributes or properties. */
export function propsFromManifest(manifest) {
  const {members} = readManifest(manifest);
  const props = {};
  for (const member of members) {
    if (!member.writable) continue;
    const config = {default: member.default, attribute: member.attribute || false};
    if (member.type === 'boolean') config.type = Boolean;
    else if (member.type === 'number') config.type = Number;
    else if (member.type === 'list') config.type = Array;
    else if (PROPERTY_ONLY.has(member.type)) config.type = Object;
    if (member.values) config.values = member.values;
    if (PROPERTY_ONLY.has(member.type)) {
      config.parser = function readProperty(raw, fallback, element) {
        const store = element?.__sfManifestData;
        return store && Object.prototype.hasOwnProperty.call(store, member.name) ? store[member.name] : fallback;
      };
    } else if (member.word) {
      config.parser = function readWord(raw, fallback, element) {
        return raw !== undefined && raw !== null ? raw : element.sfWord(member.word);
      };
    }
    props[member.property] = config;
  }
  return props;
}

function readAttribute(element, member) {
  const raw = element.getAttribute(member.attribute);
  if (member.type === 'boolean') {
    if (raw === null) return member.optional && member.default === undefined ? undefined : Boolean(member.default);
    // The base's reading, so the template and the property agree: present
    // and empty is true, then the words the base takes for true.
    return raw === '' || TRUE_WORDS.has(raw.toLowerCase());
  }
  if (raw === null) return member.word ? element.sfWord(member.word) : member.default;
  if (member.type === 'number') {
    const number = Number(raw);
    return raw.trim() !== '' && Number.isFinite(number) ? number : member.default;
  }
  if (member.values && !member.values.includes(raw)) return member.default;
  return raw;
}

function writeAttribute(element, member, value) {
  if (value === null || value === undefined) {
    element.removeAttribute(member.attribute);
    return;
  }
  if (member.type === 'boolean') {
    // An optional boolean keeps «off» as a value of its own (§4.2), and so
    // does one that is on by default: taking the attribute away would read
    // as the default, on (sf-pagination's count-known, total-exact).
    if (value) element.setAttribute(member.attribute, '');
    else if (member.optional || member.default === true) element.setAttribute(member.attribute, 'false');
    else element.removeAttribute(member.attribute);
    return;
  }
  element.setAttribute(member.attribute, String(value));
}

function defineMembers(target, members) {
  for (const member of members) {
    // The browser's own members stay the browser's (§3.1); a component that
    // must answer one writes its own accessor.
    if (member.native) continue;
    if (!member.writable) {
      Object.defineProperty(target, member.property, {
        configurable: true,
        get() { return member.default; },
      });
      continue;
    }
    if (!member.attribute) {
      Object.defineProperty(target, member.property, {
        configurable: true,
        get() {
          const store = this.__sfManifestData;
          return store && Object.prototype.hasOwnProperty.call(store, member.name) ? store[member.name] : member.default;
        },
        set(value) {
          if (!this.__sfManifestData) this.__sfManifestData = {};
          this.__sfManifestData[member.name] = value;
          this.requestComponentUpdate?.(member.name);
        },
      });
      continue;
    }
    Object.defineProperty(target, member.property, {
      configurable: true,
      get() { return readAttribute(this, member); },
      set(value) { writeAttribute(this, member, value); },
    });
  }
}

function parameters(action, args) {
  if (args.length === 1 && isPlainObject(args[0])
    && (action.with.length !== 1 || Object.keys(args[0]).every((key) => action.with.includes(key)))) {
    return {...args[0]};
  }
  return Object.fromEntries(action.with.map((name, index) => [name, args[index]]));
}

function defineActions(target, actions, implementations, events) {
  for (const action of actions) {
    if (isNativeMember(action.method)) continue;
    const run = implementations?.[action.name];
    Object.defineProperty(target, action.method, {
      configurable: true,
      writable: true,
      value: function generatedAction(...args) {
        const params = parameters(action, args);
        if (action.emits) {
          const event = events[action.emits];
          const allowed = this.sfEmit(action.emits, params, {cancelable: event?.cancelable ?? true});
          if (!allowed) return {outcome: 'refused', reason: 'prevented'};
        }
        if (typeof run !== 'function') {
          globalThis.console?.warn?.(`[SIMAI Framework] ${this.localName}: action ${action.name} has no code`);
          return {outcome: 'refused', reason: 'not-implemented'};
        }
        let result;
        try {
          result = run.call(this, params, {signal: this.sfScope});
        } catch (error) {
          this.reportComponentError?.(error, `action ${action.name}`);
          return {outcome: 'refused', reason: 'error'};
        }
        if (result && typeof result.then === 'function') {
          const signal = this.sfScope;
          return Promise.resolve(result).then(
            (value) => (signal?.aborted ? {outcome: 'cancelled'} : toOutcome(value)),
            (error) => {
              if (signal?.aborted || error?.name === 'AbortError') return {outcome: 'cancelled'};
              this.reportComponentError?.(error, `action ${action.name}`);
              return {outcome: 'refused', reason: 'error'};
            },
          );
        }
        return toOutcome(result);
      },
    });
  }
}

// The nearest closed container (§7.2.1): `hidden`, a closed <details> or
// <dialog>. What has no box in an opened container is not shown.
function isShown(element) {
  if (!element.isConnected) return false;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement || node.getRootNode?.()?.host) {
    if (node.hidden) return false;
    const tag = node.localName;
    if (node !== element && (tag === 'details' || tag === 'dialog') && !node.open) return false;
  }
  return true;
}

/**
 * The class a component extends: its manifest's plumbing over `base`.
 *
 * options:
 *   base      the class to extend (the Smart base, or a trait over it);
 *   lang      `{<locale>: <lang file>}`; the `runtime` words are the element's;
 *   source    the language the component was written in (the fallback before
 *             the key; default the first file that `lang` names);
 *   aliases   the component's aliases.json;
 *   actions   `{<action>(params, {signal}) => outcome}`, the actions' code;
 *   formerWords
 *             `{since, remove_after, words: {<key>: <old key>}}`: the keys
 *             a product may still have registered its words under (the
 *             camelCase keys before §11's language files). A word registered
 *             under an old key is said until the day, noted once in
 *             SF.deprecations.
 */
export function elementFromManifest(manifest, {base, lang = {}, source, aliases, actions = {}, formerWords} = {}) {
  const Base = base || globalThis.SF?.smart?.SfBaseElement;
  if (typeof Base !== 'function') throw new TypeError('elementFromManifest: a base class is required');
  const read = readManifest(manifest);
  const generatedProps = propsFromManifest(manifest);
  // Settings that arrive after the first paint (§5.4): their skeleton holds
  // the box until they do.
  const late = [].concat(manifest.presentation?.skeleton?.late ?? [])
    .map((name) => read.members.find((member) => member.name === name))
    .filter(Boolean);
  const words = Object.fromEntries(Object.entries(lang).map(([locale, file]) => [locale.toLowerCase(), {...(file?.runtime || {})}]));
  const sourceLanguage = source || Object.keys(words)[0] || '';
  const formerKeys = formerWords?.words || {};
  const formAssociated = Boolean(read.form) && typeof globalThis.ElementInternals === 'function'
    && typeof globalThis.ElementInternals.prototype?.setFormValue === 'function';

  class ManifestElement extends Base {
    static get manifest() { return manifest; }
    // What SF.Assembly reads of a part it places (assembly/definition.mjs
    // interfaces.of): the same manifest, so a rule can ask its actions.
    static get sfInterface() { return manifest; }
    static get sfManifest() { return read; }
    static get sfWords() { return words; }
    static get formAssociated() { return formAssociated; }

    static get props() {
      return {...super.props, ...generatedProps};
    }

    constructor() {
      super();
      this.sfInternals = formAssociated && typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    }

    connectedCallback() {
      this.sfReadIsland();
      super.connectedCallback();
      // A leaf outside an assembly starts with the page (§7.2.1 `now`).
      this.toggleAttribute('data-sf-started', true);
    }

    /**
     * The first values of the settings an attribute cannot hold, lists and
     * objects, from the JSON island a server prints in the host (§5.4):
     * `<script type="application/json" data-sf-settings>{"items": [...]}</script>`.
     * Read once, before the first render; an attribute or a property the page
     * set first wins. The island is taken out, so a component that reads its
     * children never meets it.
     */
    sfReadIsland() {
      const island = Array.from(this.children ?? []).find((child) => child.localName === 'script'
        && child.hasAttribute('data-sf-settings') && /^application\/json$/iu.test(child.type));
      if (!island) return;
      island.remove();
      let data;
      try {
        data = JSON.parse(island.textContent || '{}');
      } catch (error) {
        globalThis.console?.warn?.(`[SIMAI Framework] ${this.localName}: the data-sf-settings island is not JSON`, error);
        return;
      }
      for (const [name, value] of Object.entries(isPlainObject(data) ? data : {})) {
        const member = read.members.find((one) => one.name === name);
        if (!member || !member.writable || member.native) {
          globalThis.console?.warn?.(`[SIMAI Framework] ${this.localName}: the island's "${name}" is not a setting`);
          continue;
        }
        if (member.attribute ? this.hasAttribute(member.attribute) : Object.prototype.hasOwnProperty.call(this.__sfManifestData ?? {}, name)) continue;
        this[member.property] = value;
      }
    }

    /**
     * Whether the element keeps its printed skeleton (§5.4, §7.3 phase 3):
     * the host was printed with data-sf-first-paint="skeleton" and a setting
     * declared late (presentation.skeleton.late) has not arrived. The first
     * render waits for it, so the skeleton turns into content in one frame.
     * A list given explicitly, even empty, has arrived: an empty list is
     * data (the empty state), not data still to come. Only a list nobody set
     * -- its default -- keeps the skeleton waiting.
     * A component whose data comes another way (a port) overrides this.
     */
    sfAwaitingData() {
      if (!late.length || this.getAttribute('data-sf-first-paint') !== 'skeleton') return false;
      return late.some((member) => {
        if (member.attribute && this.hasAttribute(member.attribute)) return false;
        const store = this.__sfManifestData;
        if (!member.attribute && store && Object.prototype.hasOwnProperty.call(store, member.name)) {
          const given = store[member.name];
          if (given !== undefined && given !== null) return false;
        }
        // Read through the property: a component may keep the setting itself.
        const value = this[member.property];
        return value === undefined || value === null || (Array.isArray(value) && !value.length);
      });
    }

    /** §4.1: the element has a box in an opened container. */
    get shown() { return isShown(this); }

    /** §4.1: its assembly has started it (a leaf on a page, once connected). */
    get started() { return this.hasAttribute('data-sf-started'); }

    /** The DOM name of a declared event (§8). */
    sfEventName(verb) {
      return read.events[verb]?.name ?? eventName(manifest, verb);
    }

    /**
     * Sends a declared event by its verb. Answers false when a listener
     * refused a cancelable one.
     */
    sfEmit(verb, detail = {}, {cancelable} = {}) {
      const event = read.events[verb];
      if (!event) globalThis.console?.warn?.(`[SIMAI Framework] ${this.localName}: event ${verb} is not declared`);
      return dispatchAliased(this, this.sfEventName(verb), {
        detail,
        bubbles: true,
        composed: true,
        cancelable: cancelable ?? event?.cancelable ?? false,
      });
    }

    /** A word of the element's own, in its language (§11, §11.1). */
    sfWord(key, {count, vars} = {}) {
      const former = Object.hasOwn(formerKeys, key) ? formerKeys[key] : undefined;
      const onFormer = former === undefined ? undefined : (old) => noteDeprecated({
        component: this.localName,
        tag: this.localName,
        kind: 'word',
        from: old,
        to: key,
        since: formerWords.since,
        remove_after: formerWords.remove_after,
      });
      return pageWord(words, key, this, {component: this.localName, source: sourceLanguage, count, vars, former, onFormer});
    }

    /** Writes a declared host state (§5.3). */
    sfHostState(name, value) {
      const type = read.hostStates[name];
      if (!type) {
        globalThis.console?.warn?.(`[SIMAI Framework] ${this.localName}: host state ${name} is not declared`);
        return;
      }
      if (type === 'boolean') {
        if (value) this.setAttribute(name, 'true');
        else this.removeAttribute(name);
      } else if (value === null || value === undefined || value === '') {
        this.removeAttribute(name);
      } else {
        this.setAttribute(name, String(value));
      }
    }

    /**
     * What a form gets (§17.1): the value named by `form.submits` while the
     * value named by `form.value` holds, nothing while disabled. A boolean
     * value submits only when true. A component overrides it for a value of
     * its own shape.
     */
    sfFormValue() {
      const form = read.form;
      if (!form) return null;
      if (form.disabled && this[camelName(form.disabled)]) return null;
      const value = this[camelName(form.value)];
      if (form.submits && form.submits !== form.value) {
        if (!value) return null;
        const submitted = this[camelName(form.submits)];
        return submitted === undefined || submitted === null ? null : String(submitted);
      }
      if (value === undefined || value === null || value === false) return null;
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    /** Tells the form what the element holds now. */
    sfSyncForm() {
      if (!this.sfInternals) return;
      try {
        this.sfInternals.setFormValue(this.sfFormValue());
      } catch (error) {
        this.reportComponentError?.(error, 'form');
      }
    }

    get form() { return this.sfInternals?.form ?? null; }
    get labels() { return this.sfInternals?.labels ?? null; }
    get validity() { return this.sfInternals?.validity; }
    get validationMessage() { return this.sfInternals?.validationMessage ?? ''; }
    get willValidate() { return this.sfInternals?.willValidate ?? false; }
    checkValidity() { return this.sfInternals ? this.sfInternals.checkValidity() : true; }
    reportValidity() { return this.sfInternals ? this.sfInternals.reportValidity() : true; }
    setCustomValidity(message = '') {
      if (!this.sfInternals) return;
      if (message) this.sfInternals.setValidity({customError: true}, String(message));
      else this.sfInternals.setValidity({});
    }

    formDisabledCallback(disabled) {
      this.sfFormDisabled = Boolean(disabled);
      this.requestComponentUpdate?.('form-disabled');
    }
  }

  defineMembers(ManifestElement.prototype, read.members);
  // connect-port is the base's (§4.1): a base without it gets it here.
  installPortAction(ManifestElement.prototype);
  defineActions(ManifestElement.prototype, read.actions, actions, read.events);
  // data-sf-action="<id>.<action>" runs a declared action (§8 one page trigger).
  if (read.actions.length) bindPageActions();
  if (aliases) ManifestElement.aliases = aliases;
  return ManifestElement;
}
