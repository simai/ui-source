// Package modules of the shared runtime (core.runtime 1.38.0): what a
// component package shares between its own bundles. A package's shared core
// (the scales, formats and data readers every chart of a chart set draws
// with) is built once, as its own bundle, which registers its modules here;
// the package's components take them by id, through SF.runtimeModule, instead
// of each carrying a copy (ui-builder `simai.core` of the package's
// package.json, docs/developer/component-packages.md "A package's shared core").
//
// A package module's id is `<package>/<module>`: `chart/scale`. The Framework
// knows nothing of any package here; it keeps one registry and three rules:
//
// - a package module never shadows a Core one: the id may not be a runtime
//   module's, and the package may not be named after a namespace the runtime
//   uses itself (`lit`, for `lit/directive.js`);
// - a package registers with one ABI, the version of its shared core's
//   exports; a bundle asks with the ABI it was built against, and another
//   ABI is refused loudly, as a Core module is (runtime.js checkRuntimeAbi);
//   a second registration with another ABI is refused too -- two releases of
//   one package's core on a page cannot both be the one copy;
// - the registry lives on the shared global, never in module scope: Core,
//   the runtime script and every package core bundle each carry their own
//   copy of this file, and every copy must read and write the same registry.
//
// A component that asks before its core has run waits for it: the Loader
// fetches the core first (the component's rule relates to the core's), but a
// page that includes the bundles by hand may put them in any order.

const REGISTRY = '__sfRuntimePackages';

// The first segments of the runtime's own module ids that hold a slash
// (core/js/runtime.js RUNTIME_MODULES). A contract test keeps the two the same.
export const RESERVED_NAMESPACES = Object.freeze(['lit']);

const PACKAGE_NAME = /^[a-z][a-z0-9-]*$/u;
const MODULE_NAME = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/u;

export function packageRegistry(root = globalThis) {
  let registry = root[REGISTRY];
  if (!registry || typeof registry !== 'object') {
    registry = {packages: Object.create(null), waiting: Object.create(null)};
    Object.defineProperty(root, REGISTRY, {value: registry, configurable: true, enumerable: false, writable: false});
  }
  return registry;
}

// `<package>/<module>` split, or null for an id that is not a package
// module's (a Core id: `lit`, `smart-base`, `lit/directive.js`).
export function packageModuleId(id) {
  const text = String(id ?? '');
  const slash = text.indexOf('/');
  if (slash < 1) return null;
  const name = text.slice(0, slash);
  const module = text.slice(slash + 1);
  if (RESERVED_NAMESPACES.includes(name)) return null;
  if (!PACKAGE_NAME.test(name) || !MODULE_NAME.test(module)) return null;
  return {name, module};
}

function refuse(message) {
  const error = new Error(`SF runtime: ${message}`);
  globalThis.console?.error?.(error);
  return error;
}

function abiError(id, wanted, have) {
  return refuse(`a bundle built for ABI ${wanted} of package "${id.split('/')[0]}" asks for "${id}"; this page's copy of the package is ABI ${have}. Serve the package's bundles from one build.`);
}

/**
 * Register a package's shared modules: `modules` maps a module name (`scale`)
 * to its namespace. Returns the ids registered. Throws (and says so on the
 * console) for a name that is not a package's, an ABI that is not a positive
 * integer, a module that would shadow a Core one, or a second registration
 * with another ABI. A second registration with the same ABI keeps the
 * modules already registered (one instance per page) and adds any new ones.
 */
export function registerPackageModules(name, abi, modules, {coreIds = [], root = globalThis} = {}) {
  const packageName = String(name ?? '');
  if (!PACKAGE_NAME.test(packageName)) {
    throw refuse(`"${packageName}" is not a package name (lower-case letters, digits and hyphens); its modules are not registered`);
  }
  if (RESERVED_NAMESPACES.includes(packageName)) {
    throw refuse(`package "${packageName}" is named after a namespace of the runtime's own modules; its modules would shadow them and are not registered`);
  }
  if (!Number.isInteger(abi) || abi < 1) {
    throw refuse(`package "${packageName}" registers its modules without an ABI (a positive integer); they are not registered`);
  }
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) {
    throw refuse(`package "${packageName}" registers no modules object`);
  }
  const core = new Set(coreIds);
  const entries = Object.entries(modules);
  for (const [module, namespace] of entries) {
    const id = `${packageName}/${module}`;
    if (!MODULE_NAME.test(module)) throw refuse(`package "${packageName}": "${module}" is not a module name`);
    if (core.has(id)) throw refuse(`package "${packageName}": "${id}" is a module of the runtime itself; a package module does not shadow it`);
    if (!namespace || typeof namespace !== 'object') throw refuse(`package "${packageName}": "${id}" is not a module namespace`);
  }

  const registry = packageRegistry(root);
  const current = registry.packages[packageName];
  if (current && current.abi !== abi) {
    throw refuse(`package "${packageName}" is already registered with ABI ${current.abi}; a copy with ABI ${abi} is refused. Serve the package's bundles from one build.`);
  }
  const entry = current || (registry.packages[packageName] = {abi, modules: Object.create(null)});
  const added = [];
  for (const [module, namespace] of entries) {
    if (entry.modules[module]) continue;
    // webpack reads a default import off an external as `.default` only when
    // the value says it is an ES module (runtime.js asModule).
    entry.modules[module] = Object.freeze({__esModule: true, ...namespace});
    added.push(`${packageName}/${module}`);
  }

  const waiting = registry.waiting[packageName] || [];
  delete registry.waiting[packageName];
  for (const wait of waiting) wait();
  return added;
}

/**
 * A promise of one package module by its id, asked with the ABI the bundle
 * was built against. A package that has not registered yet is waited for.
 */
export function packageModule(id, abi, {root = globalThis} = {}) {
  const parsed = packageModuleId(id);
  if (!parsed) return Promise.reject(refuse(`"${id}" is not a package module id (<package>/<module>)`));
  const registry = packageRegistry(root);
  const answer = () => {
    const entry = registry.packages[parsed.name];
    if (abi !== undefined && abi !== null && abi !== entry.abi) throw abiError(id, abi, entry.abi);
    const module = entry.modules[parsed.module];
    if (!module) throw refuse(`package "${parsed.name}" has no shared module "${parsed.module}"`);
    return module;
  };
  if (registry.packages[parsed.name]) {
    try {
      return Promise.resolve(answer());
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return new Promise((resolve, reject) => {
    (registry.waiting[parsed.name] ||= []).push(() => {
      try {
        resolve(answer());
      } catch (error) {
        reject(error);
      }
    });
  });
}

// The registration hook a package core bundle calls:
// SF.runtimeModule.register('<package>', <abi>, {<module>: namespace, ...}).
// Installed on whichever SF.runtimeModule the page has (Core's, or the
// runtime script's on a page without Core).
export function installPackageRegistration(runtimeModule, coreIds) {
  if (typeof runtimeModule !== 'function') return runtimeModule;
  Object.defineProperty(runtimeModule, 'register', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: (name, abi, modules) => registerPackageModules(name, abi, modules, {coreIds: coreIds()}),
  });
  return runtimeModule;
}
