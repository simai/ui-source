import { canonical, isPlainObject, stableStringify } from './canonical.mjs';
import { isSchema } from './schema-name.mjs';

// Generic cross-composite routing. A layout.scope node is the common parent
// that declares typed routes between endpoint descendants. Routes name only
// endpoints and published ports; they never carry endpoints, methods, actions,
// expressions or transformations. Products keep data access and authorization.

export const ENDPOINT_EXTENSION = 'simai.composition:endpoint';
export const PORT_OUTPUT_EVENT = 'sf-port-output';
export const ROUTE_STATE_EVENT = 'sf-composition-route-state';
export const ROUTING_LIMITS = Object.freeze({
  maxRoutesPerScope: 32,
  maxEndpointsPerScope: 64,
  maxFanOut: 8,
  maxScopeNesting: 4,
  maxReentrancy: 8,
  maxValueBytes: 65536,
});

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
const ROUTE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;

const diagnostic = (code, path, message) => ({ code, path, message });

function checkedRecordId(value) {
  if (typeof value === 'string') return value.length > 0 && value.length <= 256 && !CONTROL.test(value);
  return Number.isSafeInteger(value);
}

function freezeList(list) {
  return Object.freeze([...list]);
}

// The page-level value types (interface fragments, 2026-10-15) are closed
// objects: a key a type does not name is refused, never carried through.
function closedObject(value, required, optional, type) {
  if (!isPlainObject(value)) throw new TypeError(`${type} value is not an object`);
  const keys = Object.keys(value);
  if (!required.every((key) => keys.includes(key))) throw new TypeError(`${type} value misses a required key`);
  if (!keys.every((key) => required.includes(key) || optional.includes(key))) throw new TypeError(`${type} value has an undeclared key`);
}

const TOKEN = /^[a-z][a-z0-9._:-]{0,127}$/u;
const isToken = (value) => typeof value === 'string' && TOKEN.test(value);
const isCollection = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128 && !CONTROL.test(value);
const isRevision = (value) => (typeof value === 'string' && value.length > 0 && value.length <= 128 && !CONTROL.test(value)) || Number.isSafeInteger(value);
const PREFERENCE_KEY = /^[\w.*:-]+(?:\/[\w.*:/-]+)?$/u;
// An address inside the same site: a path, never a scheme of its own, never
// another origin's protocol-relative form.
const isLocalUrl = (value) => typeof value === 'string' && value.length > 0 && value.length <= 2048
  && !CONTROL.test(value) && value.startsWith('/') && !value.startsWith('//');
const COLLECTION_SCHEMA = { type: 'string', minLength: 1, maxLength: 128 };
const RECORD_ID_SCHEMA = { oneOf: [{ type: 'string', minLength: 1, maxLength: 256 }, { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }] };
const REVISION_SCHEMA = { oneOf: [{ type: 'string', minLength: 1, maxLength: 128 }, { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }] };
const TOKEN_SCHEMA = { type: 'string', pattern: '^[a-z][a-z0-9._:-]{0,127}$' };

// Closed value-type vocabulary. Each validator returns an immutable copy or
// throws TypeError; there is no coercion between types.
export const VALUE_TYPES = Object.freeze({
  'record-ids.v1': Object.freeze({
    summary: 'Ordered unique opaque record identities: nonempty strings up to 256 code units without control characters, or safe integers. Up to 1000 items; empty means no selection.',
    schema: {
      type: 'array',
      maxItems: 1000,
      uniqueItems: true,
      items: { oneOf: [{ type: 'string', minLength: 1, maxLength: 256 }, { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }] },
    },
    check(value) {
      if (!Array.isArray(value) || value.length > 1000 || !value.every(checkedRecordId)) throw new TypeError('record-ids.v1 value is invalid');
      const seen = new Set(value.map((entry) => `${typeof entry}:${entry}`));
      if (seen.size !== value.length) throw new TypeError('record-ids.v1 value has duplicates');
      return freezeList(value);
    },
  }),
  'record-id.v1': Object.freeze({
    summary: 'One opaque record identity or null for none.',
    schema: { oneOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 256 }, { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }] },
    check(value) {
      if (value !== null && !checkedRecordId(value)) throw new TypeError('record-id.v1 value is invalid');
      return value;
    },
  }),
  'text.v1': Object.freeze({
    summary: 'Plain text up to 2000 code units; never interpreted as markup or a query language.',
    schema: { type: 'string', maxLength: 2000 },
    check(value) {
      if (typeof value !== 'string' || value.length > 2000) throw new TypeError('text.v1 value is invalid');
      return value;
    },
  }),
  'boolean.v1': Object.freeze({
    summary: 'A strict boolean.',
    schema: { type: 'boolean' },
    check(value) {
      if (typeof value !== 'boolean') throw new TypeError('boolean.v1 value is invalid');
      return value;
    },
  }),
  'record-changed.v1': Object.freeze({
    summary: 'A record changed: its collection, identity and new revision, and optionally the keys of the fields that changed (up to 256). Says what changed, never the values.',
    schema: {
      type: 'object', additionalProperties: false, required: ['collection', 'id', 'revision'],
      properties: {
        collection: COLLECTION_SCHEMA, id: RECORD_ID_SCHEMA, revision: REVISION_SCHEMA,
        fields: { type: 'array', maxItems: 256, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
      },
    },
    check(value) {
      closedObject(value, ['collection', 'id', 'revision'], ['fields'], 'record-changed.v1');
      if (!isCollection(value.collection) || !checkedRecordId(value.id) || !isRevision(value.revision)) throw new TypeError('record-changed.v1 value is invalid');
      const out = { collection: value.collection, id: value.id, revision: value.revision };
      if (value.fields !== undefined) {
        const fields = value.fields;
        if (!Array.isArray(fields) || fields.length > 256 || !fields.every(isCollection) || new Set(fields).size !== fields.length) throw new TypeError('record-changed.v1 fields are invalid');
        out.fields = freezeList(fields);
      }
      return Object.freeze(out);
    },
  }),
  'record-removed.v1': Object.freeze({
    summary: 'A record was removed from its collection.',
    schema: { type: 'object', additionalProperties: false, required: ['collection', 'id'], properties: { collection: COLLECTION_SCHEMA, id: RECORD_ID_SCHEMA } },
    check(value) {
      closedObject(value, ['collection', 'id'], [], 'record-removed.v1');
      if (!isCollection(value.collection) || !checkedRecordId(value.id)) throw new TypeError('record-removed.v1 value is invalid');
      return Object.freeze({ collection: value.collection, id: value.id });
    },
  }),
  'collection-changed.v1': Object.freeze({
    summary: 'Something in a collection changed that a list should read again; reason is a short token (created, imported, reordered, settings ...).',
    schema: { type: 'object', additionalProperties: false, required: ['collection', 'reason'], properties: { collection: COLLECTION_SCHEMA, reason: TOKEN_SCHEMA } },
    check(value) {
      closedObject(value, ['collection', 'reason'], [], 'collection-changed.v1');
      if (!isCollection(value.collection) || !isToken(value.reason)) throw new TypeError('collection-changed.v1 value is invalid');
      return Object.freeze({ collection: value.collection, reason: value.reason });
    },
  }),
  'files-moved.v1': Object.freeze({
    summary: 'Files moved between folders: their identities (1 to 1000, unique), the folder they left and the one they went to; null is the root.',
    schema: {
      type: 'object', additionalProperties: false, required: ['ids', 'from', 'to'],
      properties: {
        ids: { type: 'array', minItems: 1, maxItems: 1000, uniqueItems: true, items: RECORD_ID_SCHEMA },
        from: { oneOf: [{ type: 'null' }, ...RECORD_ID_SCHEMA.oneOf] },
        to: { oneOf: [{ type: 'null' }, ...RECORD_ID_SCHEMA.oneOf] },
      },
    },
    check(value) {
      closedObject(value, ['ids', 'from', 'to'], [], 'files-moved.v1');
      const ids = value.ids;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 || !ids.every(checkedRecordId)) throw new TypeError('files-moved.v1 ids are invalid');
      if (new Set(ids.map((entry) => `${typeof entry}:${entry}`)).size !== ids.length) throw new TypeError('files-moved.v1 ids have duplicates');
      const folder = (entry) => entry === null || checkedRecordId(entry);
      if (!folder(value.from) || !folder(value.to)) throw new TypeError('files-moved.v1 folder is invalid');
      return Object.freeze({ ids: freezeList(ids), from: value.from, to: value.to });
    },
  }),
  'counter.v1': Object.freeze({
    summary: 'A named count changed: key is a token (notifications, requests.new ...), value a non-negative safe integer.',
    schema: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: TOKEN_SCHEMA, value: { type: 'integer', minimum: 0, maximum: 9007199254740991 } } },
    check(value) {
      closedObject(value, ['key', 'value'], [], 'counter.v1');
      if (!isToken(value.key) || !Number.isSafeInteger(value.value) || value.value < 0) throw new TypeError('counter.v1 value is invalid');
      return Object.freeze({ key: value.key, value: value.value });
    },
  }),
  'navigation.v1': Object.freeze({
    summary: 'Go to an address of the same site, in a named region: url is a path (starting with one slash, up to 2048 code units), region a region name.',
    schema: { type: 'object', additionalProperties: false, required: ['url', 'region'], properties: { url: { type: 'string', minLength: 1, maxLength: 2048, pattern: '^/(?!/)' }, region: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' } } },
    check(value) {
      closedObject(value, ['url', 'region'], [], 'navigation.v1');
      if (!isLocalUrl(value.url) || typeof value.region !== 'string' || !NAME_PATTERN.test(value.region)) throw new TypeError('navigation.v1 value is invalid');
      return Object.freeze({ url: value.url, region: value.region });
    },
  }),
  'preference-changed.v1': Object.freeze({
    summary: 'A person changed a view preference: the SF.Preferences key (sf-table/<key>, sf-table/*, sf-admin-menu/main ...). Says which, never the value.',
    schema: { type: 'object', additionalProperties: false, required: ['key'], properties: { key: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[\\w.*:-]+(?:/[\\w.*:/-]+)?$' } } },
    check(value) {
      closedObject(value, ['key'], [], 'preference-changed.v1');
      if (typeof value.key !== 'string' || value.key.length > 256 || !PREFERENCE_KEY.test(value.key)) throw new TypeError('preference-changed.v1 value is invalid');
      return Object.freeze({ key: value.key });
    },
  }),
});

const own = (object, key) => isPlainObject(object) && typeof key === 'string' && Object.hasOwn(object, key);

// Names carry no version (owner, 2026-10-19; journal record
// value-types-without-version). A value type is read by its bare name
// (record-removed) or by the older label with the version (record-removed.v1)
// until the change journal retires the older one. VALUE_TYPES and the
// registries keep the older labels as keys, so published bytes and digests do
// not move; this is the one place that reads either form.
const VALUE_TYPE_LABELS = Object.freeze(Object.assign(Object.create(null),
  Object.fromEntries(Object.keys(VALUE_TYPES).map((label) => [label.replace(/\.v1$/u, ''), label]))));

/** The bare name of a value type given in either form, or null when the vocabulary has no such type. */
export function valueTypeName(name) {
  if (typeof name !== 'string') return null;
  if (Object.hasOwn(VALUE_TYPE_LABELS, name)) return name;
  if (Object.hasOwn(VALUE_TYPES, name)) return name.replace(/\.v1$/u, '');
  return null;
}

/** Whether two value types are the same type, whichever form each is named in. */
export function sameValueType(left, right) {
  const name = valueTypeName(left);
  return name !== null && name === valueTypeName(right);
}

/** The vocabulary entry {summary, schema, check} of a value type named in either form, or null. */
export function valueTypeEntry(name) {
  const bare = valueTypeName(name);
  return bare === null ? null : VALUE_TYPES[VALUE_TYPE_LABELS[bare]];
}

const knownValueType = (name) => valueTypeName(name) !== null;

export function checkPortValue(valueType, value) {
  if (!knownValueType(valueType)) throw new TypeError(`Unknown value type ${valueType}`);
  const type = valueTypeEntry(valueType);
  const checked = type.check(value);
  if (new globalThis.TextEncoder().encode(JSON.stringify(checked)).byteLength > ROUTING_LIMITS.maxValueBytes) throw new TypeError('Port value is too large');
  return checked;
}

export function createPortRegistry(manifests = [], options = {}) {
  const elements = new Map();
  for (const manifest of manifests) {
    // Either form of the format name (schema-name.mjs).
    if (!isPlainObject(manifest) || !isSchema(manifest, 'simai.composition.port-manifest', 1)) throw new TypeError('composition_port_manifest_invalid');
    if (elements.has(manifest.element)) throw new TypeError(`composition_port_manifest_duplicate:${manifest.element}`);
    for (const port of [...Object.values(manifest.outputs || {}), ...Object.values(manifest.inputs || {})]) {
      if (!knownValueType(port.value)) throw new TypeError(`composition_port_value_type_unknown:${port.value}`);
    }
    elements.set(manifest.element, canonical(manifest));
  }
  const bindings = new Map(Object.entries(options.bindings || {}));
  for (const [type, element] of bindings) {
    if (!elements.has(element)) throw new TypeError(`composition_port_binding_unknown:${type}`);
  }
  return { elements, bindings };
}

export function portsForType(typeManifest, ports) {
  if (!typeManifest || !ports) return null;
  const bound = ports.bindings.get(typeManifest.type);
  if (bound) return ports.elements.get(bound) || null;
  if (typeManifest.renderer?.kind === 'custom-element') return ports.elements.get(typeManifest.renderer.name) || null;
  return null;
}

function validEndpointExtension(extension) {
  return isPlainObject(extension) && Object.keys(extension).length === 1
    && typeof extension.name === 'string' && NAME_PATTERN.test(extension.name);
}

export function endpointName(node) {
  const extension = own(node?.extensions, ENDPOINT_EXTENSION) ? node.extensions[ENDPOINT_EXTENSION] : undefined;
  return validEndpointExtension(extension) ? extension.name : undefined;
}

function collectScope(scopeNode, path) {
  const endpoints = new Map();
  const problems = [];
  const visit = (node, nodePath, nested) => {
    if (!isPlainObject(node)) return;
    if (node !== scopeNode) {
      const extension = own(node.extensions, ENDPOINT_EXTENSION) ? node.extensions[ENDPOINT_EXTENSION] : undefined;
      // Shape errors are reported once for every node by resolveRoutes.
      if (validEndpointExtension(extension) && !nested) {
        if (endpoints.has(extension.name)) {
          problems.push(diagnostic('route_endpoint_duplicate', `${nodePath}.extensions.${ENDPOINT_EXTENSION}`, `Endpoint ${extension.name} is declared twice in one scope`));
        } else {
          endpoints.set(extension.name, { node, path: nodePath });
        }
      }
      // A nested scope encapsulates its own endpoints.
      if (node.type === 'layout.scope') nested = true;
    }
    for (const [slotName, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (Array.isArray(children)) children.forEach((child, index) => visit(child, `${nodePath}.slots.${slotName}[${index}]`, nested));
    }
  };
  visit(scopeNode, path, false);
  return { endpoints, problems };
}

function findCycle(edges) {
  const graph = new Map();
  for (const [from, to] of edges) {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from).add(to);
  }
  const state = new Map();
  const walk = (node) => {
    state.set(node, 'active');
    for (const next of graph.get(node) || []) {
      if (state.get(next) === 'active') return true;
      if (!state.has(next) && walk(next)) return true;
    }
    state.set(node, 'done');
    return false;
  };
  return [...graph.keys()].some((node) => !state.has(node) && walk(node));
}

/**
 * Resolves and validates every layout.scope in a Document. Returns a map of
 * scope node id to typed routes; problems are appended to diagnostics.
 */
export function resolveRoutes(root, registry, ports, diagnostics = []) {
  const resolved = new Map();
  const visit = (node, path, scopeDepth) => {
    if (!isPlainObject(node)) return;
    if (own(node.extensions, ENDPOINT_EXTENSION) && !validEndpointExtension(node.extensions[ENDPOINT_EXTENSION])) {
      diagnostics.push(diagnostic('route_endpoint_invalid', `${path}.extensions.${ENDPOINT_EXTENSION}`, 'Endpoint extension must contain only a valid name'));
    }
    let depth = scopeDepth;
    if (node.type === 'layout.scope') {
      depth += 1;
      if (depth > ROUTING_LIMITS.maxScopeNesting) diagnostics.push(diagnostic('scope_nesting_limit', path, 'Routing scopes are nested too deeply'));
      const routes = Array.isArray(node.props?.routes) ? node.props.routes : [];
      const { endpoints, problems } = collectScope(node, path);
      diagnostics.push(...problems);
      if (endpoints.size > ROUTING_LIMITS.maxEndpointsPerScope) diagnostics.push(diagnostic('route_limit', path, 'Scope declares too many endpoints'));
      const ids = new Set();
      const inputs = new Set();
      const fanOut = new Map();
      const edges = [];
      const typed = [];
      routes.forEach((route, index) => {
        const routePath = `${path}.props.routes[${index}]`;
        if (!isPlainObject(route) || !isPlainObject(route.from) || !isPlainObject(route.to)) return;
        if (ids.has(route.id)) diagnostics.push(diagnostic('route_id_duplicate', `${routePath}.id`, `Route ${route.id} is declared twice`));
        ids.add(route.id);
        const ends = {};
        for (const side of ['from', 'to']) {
          const endpoint = typeof route[side].endpoint === 'string' ? endpoints.get(route[side].endpoint) : undefined;
          if (!endpoint) {
            diagnostics.push(diagnostic('route_endpoint_unknown', `${routePath}.${side}.endpoint`, `Endpoint ${route[side].endpoint} is not declared in this scope`));
            continue;
          }
          const portManifest = portsForType(registry.types.get(endpoint.node.type), ports);
          const direction = side === 'from' ? 'outputs' : 'inputs';
          const opposite = side === 'from' ? 'inputs' : 'outputs';
          const port = own(portManifest?.[direction], route[side].port) ? portManifest[direction][route[side].port] : undefined;
          if (!port) {
            const wrongDirection = own(portManifest?.[opposite], route[side].port);
            diagnostics.push(wrongDirection
              ? diagnostic('route_port_direction', `${routePath}.${side}.port`, `${route[side].port} is not ${side === 'from' ? 'an output' : 'an input'}`)
              : diagnostic('route_port_unknown', `${routePath}.${side}.port`, `${endpoint.node.type} publishes no ${side === 'from' ? 'output' : 'input'} ${route[side].port}`));
            continue;
          }
          ends[side] = { endpoint: route[side].endpoint, port: route[side].port, value: port.value, element: portManifest.element };
        }
        if (route.from.endpoint === route.to.endpoint) diagnostics.push(diagnostic('route_self', routePath, 'A route cannot connect an endpoint to itself'));
        const inputKey = `${route.to.endpoint}.${route.to.port}`;
        if (inputs.has(inputKey)) diagnostics.push(diagnostic('route_input_conflict', `${routePath}.to`, `Input ${inputKey} already has a route`));
        inputs.add(inputKey);
        const outputKey = `${route.from.endpoint}.${route.from.port}`;
        fanOut.set(outputKey, (fanOut.get(outputKey) || 0) + 1);
        if (fanOut.get(outputKey) > ROUTING_LIMITS.maxFanOut) diagnostics.push(diagnostic('route_fanout_limit', `${routePath}.from`, `Output ${outputKey} feeds too many routes`));
        edges.push([route.from.endpoint, route.to.endpoint]);
        if (ends.from && ends.to) {
          if (!sameValueType(ends.from.value, ends.to.value)) diagnostics.push(diagnostic('route_type_mismatch', routePath, `${ends.from.value} cannot feed ${ends.to.value}`));
          else typed.push({ id: route.id, from: ends.from, to: ends.to });
        }
      });
      if (findCycle(edges.filter(([from, to]) => from !== to))) diagnostics.push(diagnostic('route_cycle', `${path}.props.routes`, 'Routes form a cycle between endpoints'));
      resolved.set(node.id, typed);
    }
    for (const [slotName, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (Array.isArray(children)) children.forEach((child, index) => visit(child, `${path}.slots.${slotName}[${index}]`, depth));
    }
  };
  visit(root, '$.root', 0);
  return resolved;
}

/**
 * DOM-independent route controller used by sf-composition-scope. The host is
 * any EventTarget; endpoints are resolved lazily on every delivery so that
 * removed and remounted children never keep stale references.
 */
export class CompositionRouteController {
  constructor(host, routes, options = {}) {
    this.host = host;
    this.routes = Object.freeze(routes.map((route) => Object.freeze({ ...route, from: Object.freeze({ ...route.from }), to: Object.freeze({ ...route.to }) })));
    this.options = options;
    this.sequence = 0;
    this.depth = 0;
    this.states = new Map();
    this.pending = new Map();
    this.counters = { outputs: 0, deliveries: 0, settled: 0, stale: 0, rejected: 0 };
    this.connection = null;
    this.onOutput = this.onOutput.bind(this);
  }

  get connected() {
    return this.connection !== null;
  }

  connect() {
    if (this.connection) return false;
    this.connection = new AbortController();
    this.host.addEventListener(PORT_OUTPUT_EVENT, this.onOutput, { signal: this.connection.signal });
    for (const route of this.routes) this.setState(route.id, { status: 'idle', sequence: 0 });
    return true;
  }

  disconnect() {
    if (!this.connection) return false;
    this.connection.abort();
    this.connection = null;
    for (const controller of this.pending.values()) controller.abort();
    this.pending.clear();
    for (const route of this.routes) this.setState(route.id, { status: 'disposed', sequence: this.states.get(route.id)?.sequence || 0 });
    return true;
  }

  getState(routeId) {
    const state = this.states.get(routeId);
    return state ? { ...state } : null;
  }

  setState(routeId, state) {
    const next = Object.freeze({ route: routeId, ...state });
    this.states.set(routeId, next);
    this.options.onState?.(next);
  }

  onOutput(event) {
    const source = this.options.sourceEndpoint?.(event);
    if (!source) return;
    const detail = event.detail;
    if (!isPlainObject(detail) || typeof detail.port !== 'string') return;
    this.counters.outputs += 1;
    for (const route of this.routes) {
      if (route.from.endpoint !== source || route.from.port !== detail.port) continue;
      let value;
      try {
        value = checkPortValue(route.from.value, detail.value);
      } catch {
        // The newest output wins even when invalid: an older pending delivery
        // for this route becomes stale and cannot settle afterwards.
        this.counters.rejected += 1;
        this.pending.get(route.id)?.abort();
        this.pending.delete(route.id);
        this.setState(route.id, { status: 'error', error: 'value_invalid', sequence: ++this.sequence });
        continue;
      }
      this.deliver(route, value);
    }
  }

  deliver(route, value) {
    if (!this.connection) return;
    const sequence = ++this.sequence;
    this.pending.get(route.id)?.abort();
    const abort = new AbortController();
    this.pending.set(route.id, abort);
    this.setState(route.id, { status: 'pending', sequence });
    const isLatest = () => this.connection !== null && !abort.signal.aborted && this.states.get(route.id)?.sequence === sequence;
    const meta = Object.freeze({ route: route.id, sequence, signal: abort.signal, isLatest });
    const attempt = () => {
      if (!isLatest()) return;
      const target = this.options.targetEndpoint?.(route.to.endpoint);
      if (!target) {
        this.setState(route.id, { status: 'error', error: 'endpoint_unresolved', sequence });
        return;
      }
      if (typeof target.sfPortInput !== 'function') {
        const ready = this.options.whenReady?.(target);
        if (ready) {
          this.setState(route.id, { status: 'waiting', sequence });
          ready.then(attempt, () => this.setState(route.id, { status: 'error', error: 'endpoint_unavailable', sequence }));
        } else {
          this.setState(route.id, { status: 'error', error: 'port_unsupported', sequence });
        }
        return;
      }
      const declared = target.constructor?.sfPorts?.inputs?.[route.to.port];
      if (!sameValueType(declared, route.to.value)) {
        this.counters.rejected += 1;
        this.setState(route.id, { status: 'error', error: 'port_mismatch', sequence });
        return;
      }
      if (this.depth >= ROUTING_LIMITS.maxReentrancy) {
        this.counters.rejected += 1;
        this.setState(route.id, { status: 'error', error: 'reentrancy_limit', sequence });
        return;
      }
      this.depth += 1;
      let result;
      try {
        this.counters.deliveries += 1;
        result = target.sfPortInput(route.to.port, value, meta);
      } catch {
        this.depth -= 1;
        this.counters.rejected += 1;
        this.setState(route.id, { status: 'error', error: 'port_rejected', sequence });
        return;
      }
      this.depth -= 1;
      if (result && typeof result.then === 'function') {
        this.setState(route.id, { status: 'pending', sequence });
        result.then(() => {
          if (!isLatest()) { this.counters.stale += 1; return; }
          this.counters.settled += 1;
          this.pending.delete(route.id);
          this.setState(route.id, { status: 'settled', sequence });
        }, () => {
          if (!isLatest()) { this.counters.stale += 1; return; }
          this.setState(route.id, { status: 'error', error: 'port_rejected', sequence });
        });
      } else {
        this.counters.settled += 1;
        this.pending.delete(route.id);
        this.setState(route.id, { status: 'settled', sequence });
      }
    };
    attempt();
  }
}

function nearestScope(element) {
  return element?.parentElement?.closest?.('sf-composition-scope') || null;
}

const isCustom = (element) => typeof element?.localName === 'string' && element.localName.includes('-');
const upgradePending = (element) => isCustom(element) && !globalThis.customElements?.get(element.localName);

// The endpoint element either implements the port protocol itself or wraps
// exactly one port element that belongs to the same scope.
function portElement(endpointElement, scope) {
  if (typeof endpointElement.sfPortInput === 'function' || upgradePending(endpointElement)) return endpointElement;
  const candidates = [...endpointElement.querySelectorAll('*')]
    .filter((element) => isCustom(element) && element.localName !== 'sf-composition-scope' && nearestScope(element) === scope);
  const implemented = candidates.filter((element) => typeof element.sfPortInput === 'function');
  if (implemented.length === 1) return implemented[0];
  const pending = candidates.filter(upgradePending);
  return implemented.length === 0 && pending.length === 1 ? pending[0] : null;
}

export function parseRoutesAttribute(value) {
  let parsed;
  try { parsed = JSON.parse(value || '[]'); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length > ROUTING_LIMITS.maxRoutesPerScope) return null;
  const ids = new Set();
  for (const route of parsed) {
    if (!isPlainObject(route) || typeof route.id !== 'string' || !ROUTE_ID_PATTERN.test(route.id)) return null;
    for (const side of ['from', 'to']) {
      const end = route[side];
      if (!isPlainObject(end) || typeof end.endpoint !== 'string' || typeof end.port !== 'string'
        || !NAME_PATTERN.test(end.endpoint) || !NAME_PATTERN.test(end.port) || !knownValueType(end.value)) return null;
    }
    if (!sameValueType(route.from.value, route.to.value) || ids.has(route.id)) return null;
    ids.add(route.id);
  }
  return parsed;
}

export function defineCompositionScope(registry = globalThis.customElements) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-composition-scope');
  if (existing) return existing;
  class SfCompositionScope extends globalThis.HTMLElement {
    constructor() {
      super();
      this.routeController = null;
      this.routeDiagnostics = [];
    }

    connectedCallback() {
      if (!this.routeController) {
        const routes = parseRoutesAttribute(this.getAttribute('data-sf-routes'));
        if (!routes) {
          this.routeDiagnostics = [{ code: 'routes_invalid', path: 'data-sf-routes', message: 'Rendered routes are invalid' }];
          this.setAttribute('data-sf-routing', 'error');
          return;
        }
        this.routeController = new CompositionRouteController(this, routes, {
          sourceEndpoint: (event) => {
            const origin = event.target?.closest?.('[data-sf-endpoint]');
            if (!origin || nearestScope(origin) !== this || portElement(origin, this) !== event.target) return null;
            return origin.getAttribute('data-sf-endpoint');
          },
          targetEndpoint: (name) => {
            const matches = [...this.querySelectorAll('[data-sf-endpoint]')]
              .filter((element) => element.getAttribute('data-sf-endpoint') === name && nearestScope(element) === this);
            return matches.length === 1 ? portElement(matches[0], this) : null;
          },
          whenReady: (element) => (element.localName?.includes('-') && globalThis.customElements
            ? globalThis.customElements.whenDefined(element.localName)
            : null),
          onState: (state) => this.dispatchEvent(new globalThis.CustomEvent(ROUTE_STATE_EVENT, { detail: state })),
        });
      }
      this.routeController.connect();
      this.setAttribute('data-sf-routing', 'connected');
    }

    disconnectedCallback() {
      this.routeController?.disconnect();
      if (this.routeController) this.setAttribute('data-sf-routing', 'disposed');
    }

    getRouteState(routeId) {
      return this.routeController?.getState(routeId) || null;
    }

    getRoutingCounters() {
      return this.routeController ? { ...this.routeController.counters } : null;
    }
  }
  registry.define('sf-composition-scope', SfCompositionScope);
  return SfCompositionScope;
}

export function routesAttribute(routes) {
  return stableStringify(routes.map((route) => ({
    id: route.id,
    from: { endpoint: route.from.endpoint, port: route.from.port, value: route.from.value },
    to: { endpoint: route.to.endpoint, port: route.to.port, value: route.to.value },
  })));
}

export default { CompositionRouteController, checkPortValue, createPortRegistry, defineCompositionScope, resolveRoutes };
