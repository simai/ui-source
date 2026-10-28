// The shared Smart runtime: the modules every Smart element is built on,
// loaded once per page by Core and handed to the Smart bundles, which are
// built without their own copies (2026-10-13). Each Smart bundle used to
// carry lit, smart-base and page-language itself -- about 50 KB minified,
// parsed again for every element on the page: 1.2 MB of the admin's script
// was the same code.
//
// The ids are the builder's (ui-builder libs/sharedRuntime.js): a bare lit
// specifier as written, a Core module by its name. A module that is not here
// is bundled into the element as before.
import * as lit from "lit";
import * as litDirective from "lit/directive.js";
import * as litDirectiveHelpers from "lit/directive-helpers.js";
import * as litRef from "lit/directives/ref.js";
import * as litKeyed from "lit/directives/keyed.js";
import * as litUnsafeHtml from "lit/directives/unsafe-html.js";
// Lists that reorder -- a table's rows after a sort -- move their rows rather
// than drawing them again (owner, 2026-10-15).
import * as litRepeat from "lit/directives/repeat.js";
import * as smartBase from "./smart-base";
import * as pageLanguage from "./page-language";
import * as position from "./position.js";
import * as controlSpacing from "./control-spacing";
// The element layer every Smart element is built from (stand 25, 2026-10-28):
// each Smart bundle carried its own element-manifest, aliases, alias table,
// host port, deprecations and page actions -- 26 KB minified, 61% of an
// average bundle, the same code 59 times. Their state already lives on SF
// (aliases, deprecations, page actions, the layer stack); here they become
// one module instance as well.
import * as elementManifest from "./element-manifest.js";
import * as aliases from "./aliases.js";
import * as aliasTable from "./alias-table.js";
import * as hostPort from "./host-port.js";
import * as deprecations from "./deprecations.js";
import * as pageActions from "./page-actions.js";
import * as layerStack from "./layer-stack.js";
import * as openSurfaceMark from "./open-surface-mark.js";
import * as instancePath from "./instance-path.js";

// The runtime's module ABI: what a bundle built against these modules may
// count on -- the ids and, for each Core module, the names it exports
// (core/contracts/shared-runtime.v1.json; a contract test keeps the two the
// same). Adding a module or an export keeps the ABI; removing or renaming
// one, or changing what an export means, raises it. A bundle is built with the
// ABI of the source it was built from and asks for its modules with it
// (SF.runtimeModule(id, abi)); a runtime of another ABI refuses, loudly, rather
// than hand a package built against another release an undefined.
export const RUNTIME_ABI = 1;

export function checkRuntimeAbi(id, wanted, have = RUNTIME_ABI) {
  if (wanted === undefined || wanted === null || wanted === have) return;
  const error = new Error(`SF runtime: a bundle built for runtime ABI ${wanted} asks for "${id}"; this page's runtime is ABI ${have ?? 'unknown'}. Rebuild the package against the SIMAI Framework release the page runs.`);
  globalThis.console?.error?.(error);
  throw error;
}

// webpack reads a default import off an external as `.default` only when the
// value says it is an ES module.
const asModule = (namespace) => Object.freeze({__esModule: true, ...namespace});

export const RUNTIME_MODULES = Object.freeze({
  "lit": asModule(lit),
  "lit/directive.js": asModule(litDirective),
  "lit/directive-helpers.js": asModule(litDirectiveHelpers),
  "lit/directives/ref.js": asModule(litRef),
  "lit/directives/keyed.js": asModule(litKeyed),
  "lit/directives/unsafe-html.js": asModule(litUnsafeHtml),
  "lit/directives/repeat.js": asModule(litRepeat),
  "smart-base": asModule(smartBase),
  "page-language": asModule(pageLanguage),
  "position": asModule(position),
  "control-spacing": asModule(controlSpacing),
  "element-manifest": asModule(elementManifest),
  "aliases": asModule(aliases),
  "alias-table": asModule(aliasTable),
  "host-port": asModule(hostPort),
  "deprecations": asModule(deprecations),
  "page-actions": asModule(pageActions),
  "layer-stack": asModule(layerStack),
  "open-surface-mark": asModule(openSurfaceMark),
  "instance-path": asModule(instancePath),
});

// What a bundle gets for an id. Core runs some of these modules itself
// (aliases, the alias table, deprecations, the page language, the layer stack,
// positioning) and publishes its instances (core-modules.js); a bundle is
// handed Core's instance when Core is on the page, so Core and every Smart
// element share one. The runtime keeps its own copies for a page with no Core
// (or a Core that has not run yet): a page, a test or a probe may include
// smart-base.js alone, and the runtime must not wait for a script that may
// never come. Read when a bundle asks, not when the runtime ran.
export function sharedModule(id) {
  return globalThis.SF?.__internal?.coreModules?.[id] ?? RUNTIME_MODULES[id];
}

export const SHARED_MODULES = Object.freeze(Object.defineProperties({}, Object.fromEntries(
  Object.keys(RUNTIME_MODULES).map((id) => [id, {enumerable: true, get: () => sharedModule(id)}]),
)));
