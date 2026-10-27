// SF.Assembly: the assembly runtime of standard simai.smart-component 1.3.8
// (§7 assemblies, §9 rules, §10 execution, §11.2 words a rule picks, §14 the
// journal). An assembly is defined by its manifest alone — no code of its own:
//
//   SF.Assembly.interfaces.registerAll(registry.parts);   // the parts' interfaces
//   SF.Assembly.define(manifest, {layouts: {default: html}, lang: {ru: words}});
//   document.body.append(document.createElement(manifest.tag));
//
// Its parts are any custom elements with a declared interface: the runtime
// does not depend on the Smart base class (link.mjs). The state that must be
// one per page — definitions, instances, interfaces, the journal, activity —
// lives on the shared global, so every bundle that carries this module meets
// the same registry.

import {AssemblyCore, activity, headlessView, whenIdle} from './core.mjs';
import {compile, interfaces} from './definition.mjs';
import {definitions, elementClass, instances} from './host.mjs';
import {journal} from './journal.mjs';
import {PART_LINK, adaptElement, createLink} from './link.mjs';

/**
 * Define an assembly from its manifest. `options.layouts` maps a layout name
 * to its HTML; `options.lang` a locale to its language file; `options.loadPart`
 * fetches a part's module when the part starts (the Loader by default).
 */
function define(manifest, options = {}) {
  const tag = String(manifest?.tag ?? '').toLowerCase();
  if (definitions.has(tag)) return definitions.get(tag);
  const definition = compile(manifest, options);
  definitions.set(tag, definition);
  const registry = globalThis.customElements;
  if (registry && typeof globalThis.HTMLElement === 'function' && !registry.get(tag)) registry.define(tag, elementClass(definition, options));
  return definition;
}

export const Assembly = Object.freeze({
  define,
  defined: (tag) => definitions.get(String(tag).toLowerCase()) ?? null,
  interfaces,
  journal,
  /** Turn the journal on or off whatever the page says (§14); `null` follows the page. */
  debug: (on = true) => { journal.force(on); return journal.on; },
  activity,
  whenIdle,
  /** A running instance by its role path (§7.1.1). */
  instance: (path) => instances.get(path) ?? null,
  instances: () => [...instances.keys()],
  PART_LINK,
  adaptElement,
  createLink,
  compile,
  AssemblyCore,
  headlessView,
});

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.Assembly) globalThis.SF.Assembly = Assembly;
}

export default Assembly;
export {AssemblyCore, PART_LINK, activity, adaptElement, compile, createLink, define, headlessView, interfaces, journal, whenIdle};
