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
});
