import { canonical, isPlainObject, stableStringify } from './canonical.mjs';

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
});

const own = (object, key) => isPlainObject(object) && typeof key === 'string' && Object.hasOwn(object, key);
const knownValueType = (name) => own(VALUE_TYPES, name);

export function checkPortValue(valueType, value) {
  if (!knownValueType(valueType)) throw new TypeError(`Unknown value type ${valueType}`);
  const type = VALUE_TYPES[valueType];
  const checked = type.check(value);
  if (new globalThis.TextEncoder().encode(JSON.stringify(checked)).byteLength > ROUTING_LIMITS.maxValueBytes) throw new TypeError('Port value is too large');
  return checked;
}

export function createPortRegistry(manifests = [], options = {}) {
  const elements = new Map();
  for (const manifest of manifests) {
    if (!isPlainObject(manifest) || manifest.schema !== 'simai.composition.port-manifest.v1') throw new TypeError('composition_port_manifest_invalid');
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
          if (ends.from.value !== ends.to.value) diagnostics.push(diagnostic('route_type_mismatch', routePath, `${ends.from.value} cannot feed ${ends.to.value}`));
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
      if (declared !== route.to.value) {
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
    if (route.from.value !== route.to.value || ids.has(route.id)) return null;
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
