// The runtime's own names on window.SF moved under SF.__internal (week audit,
// 2026-10-18; journal global-sf-internal). They were never a promise to a page
// -- the message bus (send, receive), the runtime module registry's own state
// (runtimeModules, runtimeArrived, runtimeLoading, runtimeSettled), the Smart
// base's announcement (smartBaseAnnounced) and litHtml -- but they stood beside
// the public API (core/contracts/
// public-js-api.json marks them internal) and a page could lean on them.
//
// The old names keep working until the journal's sweep: each is an accessor on
// window.SF that reads and writes SF.__internal, and a read through it is
// noted as a deprecation (SF.deprecations.list(), a console warning under
// <html data-sf-deprecations="warn">). The Framework's own code uses
// SF.__internal. Every bundle carries a copy of this module; the store and the
// accessors live on the shared global, so the first copy installs them and the
// rest find them in place.
import {noteDeprecated} from './deprecations.js';

// SF.loadSmartBase, SF.smart, SF.smartBaseReady, SF.loadRuntime and
// SF.runtimeModule stay where they are: the documentation promises them to a
// page (a project's own Smart component extends SF.smart.SfBaseElement after
// `await SF.loadSmartBase()`), so they are public, not the runtime's.
export const INTERNAL_NAMES = Object.freeze([
  'send', 'receive',
  'runtimeModules', 'runtimeArrived', 'runtimeLoading', 'runtimeSettled',
  'smartBaseAnnounced',
  'litHtml',
]);

export function installInternal(root = globalThis) {
  const SF = (root.SF = root.SF || {});
  if (!SF.__internal || typeof SF.__internal !== 'object') {
    Object.defineProperty(SF, '__internal', {value: {}, configurable: true, enumerable: false, writable: false});
  }
  const store = SF.__internal;
  for (const name of INTERNAL_NAMES) {
    const own = Object.getOwnPropertyDescriptor(SF, name);
    if (own?.get?.sfInternalAlias) continue;
    // A value a page or an older bundle put there first is kept.
    if (own && 'value' in own && !(name in store)) store[name] = own.value;
    const get = () => {
      noteDeprecated({kind: 'global', from: `SF.${name}`, to: `SF.__internal.${name}`});
      return store[name];
    };
    get.sfInternalAlias = true;
    Object.defineProperty(SF, name, {
      configurable: true,
      enumerable: false,
      get,
      set(value) { store[name] = value; },
    });
  }
  return store;
}

if (typeof globalThis !== 'undefined') installInternal(globalThis);
