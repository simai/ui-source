# The shared Smart runtime

A page that shows Smart elements runs one copy of the code they are built
on. Each Smart bundle (`distr/smart/<folder>/js/<folder>.min.js`) and each
product package bundle carries only its own element; lit, the Smart base and
the element layer come from the page's **shared runtime**, the script
`distr/core/js/smart-base.min.js` beside `core.min.js`.

Until 2026-10-28 each Smart bundle carried its own element layer
(element-manifest, aliases, the alias table, the host port, deprecations,
page actions): about 26 KB minified, 61% of an average bundle, the same code
59 times. Now the 66 Smart
bundles are 580 KB gzip in all instead of 1075 KB, and the admin list page (stand 25) loads 641 KB of gzip script instead of 831 KB.

## What the runtime hands out

The list is `core/contracts/shared-runtime.v1.json` (generated:
`node scripts/shared-runtime-contract.mjs --write`; a contract test fails when
it is stale). Today:

| id | source | |
|---|---|---|
| `lit`, `lit/directive.js`, `lit/directive-helpers.js`, `lit/directives/ref.js`, `lit/directives/keyed.js`, `lit/directives/unsafe-html.js`, `lit/directives/repeat.js` | lit | |
| `smart-base` | `core/js/smart-base.js` | the Smart base element |
| `page-language` | `core/js/page-language.js` | Core's instance |
| `position` | `core/js/position.js` | Core's instance |
| `control-spacing` | `core/js/control-spacing.js` | |
| `element-manifest` | `core/js/element-manifest.js` | an element from its manifest |
| `aliases` | `core/js/aliases.js` | Core's instance |
| `alias-table` | `core/js/alias-table.js` | Core's instance |
| `host-port` | `core/js/host-port.js` | |
| `deprecations` | `core/js/deprecations.js` | Core's instance |
| `page-actions` | `core/js/page-actions.js` | |
| `layer-stack` | `core/js/layer-stack.js` | Core's instance |
| `open-surface-mark` | `core/js/open-surface-mark.js` | |
| `instance-path` | `core/js/instance-path.js` | |

The ids are also ui-builder's (`libs/sharedRuntime.js` `BARE_MODULES` and
`CORE_MODULES`). An import of one of these modules from a Smart or package
source file is not bundled: the bundle asks the page for it,
`SF.runtimeModule(id, abi)`, and waits.

"Core's instance": Core runs these modules itself (aliases, deprecations,
the page language, the layer stack, positioning) and publishes its instances
(`core/js/core-modules.js`, `SF.__internal.coreModules`). A bundle that asks
for one of these ids is handed Core's instance when Core is on the page, so
Core and every Smart element share it; the runtime reads it when the bundle
asks, not when the runtime ran (`core/js/runtime.js` `sharedModule`). The
runtime still carries its own copies for a page with no Core: a page, a test
or a probe may include `smart-base.js` alone, and the runtime never waits for
Core. Their state lives on `SF` either way (aliases, deprecations, the layer
stack), so the two copies agree.

## What a bundle embeds of its component.json

An element imports its own `component.json` and hands it to
`elementFromManifest`. Since standard 1.4 the file also holds what only the
build, the registry and the docs read (`x-registry`, `x-rule`,
`x-decisions`, `relations`, `aliases`, `examples`, `$comment`). A bundle
embeds only the top-level keys the runtime reads, listed in the contract as
`component_manifest_keys` (`id`, `tag`, `version`, `kind`, `settings`,
`values`, `events`, `actions`, `form`, `presentation`, `host-states`, `port`,
`layer`, `implements`, `traits`, `words`, `css-variables`; ui-builder
`libs/componentManifestEmbed.js`). Code that reads another key off a
manifest (`manifest.<key>`, `Ctor.manifest`, `sfInterface`) must add it there:
the contract test reads the runtime, the assembly's interface registry, the
host port, the first-paint tools and every element's `index.js` for the keys
they take, and fails on one that is not listed.

Inside those keys the bundle also drops the words the runtime does not read,
listed as `component_manifest_drop` (`$comment`, `description`, `examples`,
`summary`, `x-detail`, `x-markup`, `x-note`, `x-outcomes`, `x-returns`,
`x-shape`, `x-summary`). A key named there goes at least two levels under a
kept key -- `settings.<name>.summary`, `events.<verb>.carries.<field>.summary`,
`actions.<name>.x-returns` -- never as a name: the setting
`settings.description` stays. The contract test fails on runtime code
(`src/core/js`, every file of `src/smart`, the first-paint tools) that reads
one of them, and on a `component.json` that names a member of a typed map
(a carried field, a `with` parameter, an `of` field) like one. Over the 59
Smart manifests of standard 1.4 phase A the embedded manifests go from 180
to 98 KB minified.

## The rule for packages

**A package carries no element layer of its own.** A product package
(ui-pro's larena package, a project's own components) is built over the
ui-source of the SIMAI Framework release it pins and runs on that release's
runtime. Its bundles ask the page's runtime for the modules above; they never
bundle a copy. ui-builder guarantees it (the externals), and the package
receipt records it: `framework.runtime` lists the ABI and the modules and
names the bundles ask for, and with `--ui` the receipt is refused when the
release's `shared-runtime.v1.json` has another ABI, lacks a module or lacks a
name (ui-builder `docs/developer/product-packages.md`).

A Smart element of one package that needs another Smart element on the page
asks for it by tag (the Loader defines it from its own bundle); it does not
import the other element's `index.js`, which would put a second copy of that
element in its bundle.

## The runtime ABI

`core/js/runtime.js` `RUNTIME_ABI` (today 1) is the runtime's module ABI. A
bundle is built with the ABI of the source it was built from and asks with
it; a runtime of another ABI refuses with an error in the console and a
rejected definition, rather than hand a package built against another
release an `undefined`.

- Adding a module or an export: the ABI stays.
- Removing or renaming a module or an export, or changing what an export
  means: raise `RUNTIME_ABI`, rewrite the contract, and every package must be
  rebuilt against the new release.

A runtime module exports `const`, `function` or `class` only: the runtime
hands a bundle a frozen copy of the module's namespace, so an `export let`
reassigned later would stay at its first value in every bundle. A contract
test refuses `export let`, `export var` and `export *` in these modules.

## Loading

Core preloads the runtime as soon as it runs on a page that already holds an
undefined `sf-` element: the bytes are fetched then, the script runs when the
Loader asks for it as it queues a Smart element. (Running it that early let
the bundles define their elements before the page's sheets arrived, and the
first paint went unseen.) A page that preloads `core/js/smart-base.min.js`
itself gets it sooner still. A runtime script the page includes by hand is
waited for, not loaded a second time.
