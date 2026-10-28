// The modules Core and the shared Smart runtime both stand on, published once
// per page by Core (2026-10-28). Core runs them for itself -- aliases,
// deprecations, the page language, the layer stack, positioning -- and the
// runtime hands these instances to the Smart bundles that ask for the ids
// (core/js/runtime.js sharedModule): Core and every Smart element on the page
// share one. The runtime keeps its own copies for a page without Core.
//
// The ids are the runtime's (core/contracts/shared-runtime.v1.json).
import * as aliases from './aliases.js';
import * as aliasTable from './alias-table.js';
import * as deprecations from './deprecations.js';
import * as pageLanguage from './page-language.js';
import * as layerStack from './layer-stack.js';
import * as position from './position.js';

// webpack reads a default import off an external as `.default` only when the
// value says it is an ES module.
const asModule = (namespace) => Object.freeze({__esModule: true, ...namespace});

export const CORE_MODULES = Object.freeze({
  'aliases': asModule(aliases),
  'alias-table': asModule(aliasTable),
  'deprecations': asModule(deprecations),
  'page-language': asModule(pageLanguage),
  'layer-stack': asModule(layerStack),
  'position': asModule(position),
});

export function publishCoreModules(root = globalThis) {
  const SF = (root.SF = root.SF || {});
  const internal = SF.__internal;
  // The first Core on the page keeps its modules: a second copy of core.js
  // (a page that includes it twice) does not swap the instances under the
  // runtime that already took them.
  if (!internal || internal.coreModules) return internal?.coreModules ?? null;
  Object.defineProperty(internal, 'coreModules', {value: CORE_MODULES, configurable: false, enumerable: false, writable: false});
  try {
    root.dispatchEvent?.(new root.CustomEvent('sf-core-modules', {detail: {modules: Object.keys(CORE_MODULES)}}));
  } catch {
    // A page without CustomEvent (a test realm) still has the modules on SF.
  }
  return CORE_MODULES;
}

if (typeof window !== 'undefined') publishCoreModules(window);
