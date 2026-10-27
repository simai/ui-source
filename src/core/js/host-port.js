// The base action connect-port {port} (standard simai.smart-component 1.3.8
// §4.1, §4.9): every element takes the host port it is handed, from the page
// or from the assembly it is a part of, by one method, `connectPort(port)`;
// `setHostPort(port)` is its alias.
//
// The port is kept on the instance, for its scope (§7.7): it lasts while the
// instance does and is let go when its scope ends, so an element taken out of
// the page holds no host. A component reacts through an optional hook,
// `onPortConnected(port, {signal})`, run after the port is kept; a component
// written before the base action, which overrides `setHostPort(port)` itself,
// has that override run as the hook, so it needs no change to be reached.
//
// Answers an outcome (§4.4): `{outcome: 'applied'}`; `refused` with
// `no-port` when nothing was handed, `other-port` when the port names an id
// other than the one the manifest declares, and `port-unsupported` when the
// hook throws -- the port is then not kept.

// A host adapter names its port by `id` (SF.Assembly, the port contracts) or
// by `port` (`{port, version, capabilities, raise}`, ui-pro's adapters).
export function portIdOf(port) {
  if (!port || typeof port !== 'object') return '';
  if (typeof port.id === 'string' && port.id) return port.id;
  if (typeof port.port === 'string' && port.port) return port.port;
  return '';
}

// connect-port takes its parameters as one object, `{port}`, or the port
// itself. An adapter whose `port` is its id (a string) is the port.
export function portFromParams(params) {
  if (params && typeof params === 'object' && params.port && typeof params.port === 'object') return params.port;
  return params;
}

// The port id the element's manifest declares, if any (§4.9).
function declaredPortId(element) {
  const declared = element?.constructor?.manifest?.port ?? element?.constructor?.sfInterface?.port;
  return portIdOf(declared);
}

/** The port an element holds now, or null. */
export function portOf(element) {
  return element?.__sfPortEntry?.port ?? null;
}

/** connect-port {port} on `element`, with `alias` the base's own setHostPort. */
export function connectPort(element, params, alias) {
  const port = portFromParams(params);
  if (!port || typeof port !== 'object') return {outcome: 'refused', reason: 'no-port'};
  const declared = declaredPortId(element);
  const given = portIdOf(port);
  if (declared && given && declared !== given) return {outcome: 'refused', reason: 'other-port'};

  const previous = element.__sfPortEntry ?? null;
  // Kept on the element, not in a module map: every bundle carries its own
  // copy of this module, and the element is what they share.
  const signal = element.sfScope;
  const entry = {port, signal};
  element.__sfPortEntry = entry;
  // The port lives as long as the scope it was handed in (§7.7).
  if (signal && typeof signal.addEventListener === 'function' && !signal.aborted) {
    signal.addEventListener('abort', () => {
      if (element.__sfPortEntry === entry) element.__sfPortEntry = null;
    }, {once: true});
  }

  // The hook. A component's own setHostPort (written before the base action)
  // is the hook when there is no onPortConnected; the guard lets such an
  // override call super.setHostPort without running itself again.
  if (element.__sfConnectingPort) return {outcome: 'applied'};
  element.__sfConnectingPort = true;
  try {
    if (typeof element.onPortConnected === 'function') {
      element.onPortConnected(port, {signal});
    } else if (typeof element.setHostPort === 'function' && element.setHostPort !== alias) {
      element.setHostPort(port);
    }
  } catch (error) {
    element.__sfPortEntry = previous;
    return {outcome: 'refused', reason: 'port-unsupported'};
  } finally {
    element.__sfConnectingPort = false;
  }
  element.requestComponentUpdate?.('port');
  return {outcome: 'applied'};
}

/**
 * Gives a class the base action where its base has none: `connectPort`,
 * `setHostPort` and the read-only `sfPort`.
 */
export function installPortAction(proto) {
  if (!proto || typeof proto.connectPort === 'function') return;
  function setHostPort(port) { return connectPort(this, port, setHostPort); }
  Object.defineProperty(proto, 'connectPort', {
    configurable: true,
    writable: true,
    value: function connectPortAction(port) { return connectPort(this, port, setHostPort); },
  });
  if (typeof proto.setHostPort !== 'function') {
    Object.defineProperty(proto, 'setHostPort', {configurable: true, writable: true, value: setHostPort});
  }
  if (!Object.prototype.hasOwnProperty.call(proto, 'sfPort')) {
    Object.defineProperty(proto, 'sfPort', {configurable: true, get() { return portOf(this); }});
  }
}
