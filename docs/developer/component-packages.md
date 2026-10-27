# Component packages

A component package is a set of Smart components served from its own base and
carrying its own rules, loaded by the same Loader as everything else. It is how
the Framework is extended: a component lives with its owner, and a product or
an external author ships its components as a package rather than adding them
to the Framework (owner's decisions of 2026-10-11). The standard is
`simai.component-package` 1.0.0 (`contracts/standards/simai.component-package/`).

Larena's components are the first package, `larena`: `sf-table`,
`sf-data-view`, `sf-property-view` and `sf-admin-menu` are not in Core's rule
list or in `ui`; they live in the component folder of `simai/larena-ui`, open
under Apache-2.0, and arrive this way. They went to a package named `pro`
first; SIMAI Framework Pro was dropped the same day, and the change journal
records both moves (`component-pro-package-move`,
`component-larena-package-move`). The Loader side is in
`src/core/js/loader.js` (`registerPackage`, `resolveSmartBase`,
`getMissingFileKey`).

## Where Smart comes from without a package

The `ui` distribution carries Smart in `distr/smart`, beside `distr/core`
(release `ui-6b4a0c3887d6` on). A page sets `window.sfPath` to its copy of
`distr/` and nothing else; Smart resolves to `<sfPath>/smart`.
`window.sfSmartPath` still works for a page that serves the separate ui-smart
repository from its own root, and an empty value counts as not set.
`tests/loader-packages.contract.test.mjs`.

A page that sets no `sfPath` gets the `distr/` its `core.js` (or
`core.min.js`) was loaded from: Core reads its own script URL, so
`https://cdn.jsdelivr.net/npm/@simai-studio/ui@<version>/distr/core/js/core.js`
loads its siblings from the same package version. Only when no Core script
can be found does it fall back to an unpinned default, with a console warning
that recommends the npm form (simai/ui-source#8,
`tests/public-path-resolution.contract.test.mjs`).

Debug mode (`?sf-debug`, `data-sf-debug`, `SF_BOOT_CONFIG.minified = false`)
asks for the readable files and takes the minified twin of any that is
missing, scripts and sheets alike, so it works over the npm package, which
ships components, utilities and Smart files minified only
(`tests/browser/debug-minified-only.browser.mjs`).

## Declaring a package

The page declares where each package is served, in the boot configuration,
before `core.js`:

```html
<script>
  window.sfPath = '/assets/ui/distr/';
  window.SF_BOOT_CONFIG = {
    packages: {
      larena: {base: '/assets/larena/smart'},
    },
  };
</script>
<script src="/assets/ui/distr/core/js/core.js"></script>
```

- **Name**: lower-case letters, digits and hyphens. It is the key the
  package's rules are filed under and the prefix of its missing-file entries.
- **`base`**: the directory holding the package's component folders, laid out
  like `distr/smart`: `<base>/<folder>/js/<folder>.js` and
  `<base>/<folder>/css/<folder>.css`, where the folder is the rule name without
  its `cl-` prefix.
- **`rule`** (optional): the URL of the package's rule file. Default
  `<base>/rule.js`.

There is one place to declare a package. `SF_BOOT_CONFIG` already holds the
structured settings (`smart`, `preloader`, `icons`, the cache versions); the
`sf*Path` globals are single strings and stay as they are.

## The rule file

The Loader fetches each declared package's rule file itself, before its first
scan of the page. The page does not add it as a script. Two reasons: Core
creates the rule map (`SF.RuleLoader`) when it starts, so a rule file that ran
before Core would have nowhere to register; and with the rules in place before
the first scan, the package's tags are known when the page is first read and a
cached plugin list never names a rule that has not arrived. A page that
declares no package starts exactly as before, synchronously.

The file is a plain script with one call:

```js
SF.RuleLoader.registerPackage('larena', {
  rules: {
    'cl-table': {
      tags: ['sf-table'],
      type: 'smart',
      mode: 'smart',
      js: true,
      css: true,
      relation: [{name: 'cl-icon'}, {name: 'cl-pagination'}],
    },
  },
});
```

- A rule is written exactly as a Core Smart rule is; the Loader stamps
  `package: '<name>'` on it, and that field is what sends its files to the
  package base. Relations name rules by key and each resolves from its own
  package, so a larena rule relating to `cl-icon` fetches the icons from the
  Smart base.
- A relation the element renders only later -- a filter editor, a date
  picker, a cell renderer for a type a page may not hold -- is marked
  `{name: 'cl-datepicker', lazy: true}`. The element does not wait for it and
  the page does not hold its first paint for it: the Loader fetches it when it
  is first used -- asked for (`SF.Loader.ensurePlugin('cl-datepicker')`) or
  met in the document -- and never in idle time on the chance it is needed
  (standard simai.smart-component 1.3.8 §7.2.1, simai/ui-source#47). A page
  that wants the old warm-up after `sf-loader-ready` sets
  `SF_BOOT_CONFIG.prefetchLazyRelations = true`. An element that creates a
  lazy one and calls it straight away waits for `customElements.whenDefined`
  first.
- A package's elements may carry its owner's prefix (`lr-records-list`)
  rather than the Framework's `sf-`, and a new element should (standard
  `simai.component-package`, own-element-prefix). The Loader loads any tag a
  package rule lists; a tag outside `sf-` is claimed only by a package rule, so
  the Framework's names stay its own. `SF.create('lr-records-list')` keeps the
  full name; a short name (`SF.create('button')`) is still a Framework one.
- `registerPackage(name, {rules, base})` may also take a `base`. The page's
  declaration wins when both are given: where the bytes are served is the
  deployment's decision, not the bundle's.
- It returns the rule keys it registered. It is not enumerable on
  `SF.RuleLoader`, so nothing that walks the rules mistakes it for one.
- A package may take over a Core rule of the same name that has not loaded
  yet. While a component moves into a package, Core still ships its old rule,
  and a page that declared the package chose the package's bytes. A rule that
  has already loaded is kept, with a warning (a custom element cannot be
  defined twice), and so is a rule another package owns.

## Registering late

`registerPackage` can also be called after the page is up, by a page that
loads a package of its own. The Loader drops what it derived from the rule map
(the attribute index, the regexp scan list, both match caches) and reads the
page again, so an element that was in the document before its rule arrived is
loaded. `tests/browser/loader-packages.browser.mjs`.

## When a package cannot load

Nothing is fetched from the Smart base in a package's place: that would load
whatever an older Core shipped under the same name, or 404 and be cached as
missing there. Instead the Loader says, once per rule, which tag could not
load and why:

- the rule names a package the page has not declared;
- the package has no base;
- the rule file could not be loaded, or loaded and registered nothing.

## The missing-file cache

A file missing from one base is not missing everywhere. Entries for a
package's rules are kept as `<package>::<rule>` in `SF_MISSING_PLUGINS`, so a
404 from a package base never suppresses the same name in the Smart base, or
the other way round. Smart-base entries keep their bare names, the format
browsers already hold. Revalidation forgets a package entry only when a rule of
that package is registered under the name.

## Language

A package bundle carries its own copy of `src/core/js/page-language.js`, as
every Smart bundle does. The language state (registered words, listeners, the
chosen language) lives on `globalThis.__sfPageLanguage`, never in module scope,
so every copy reads and writes the one registry: a product that registers a
language, or calls `SF.language.use()`, changes base and package components
alike. `tests/page-language-shared-state.contract.test.mjs` fails if that
state moves back into the module.

## Building a package

A package's source is a folder laid out like `src/smart`: one folder per
component with its `index.js`, `rule.js` (writing exactly its own `cl-<folder>`
rule as plain data), manifest and templates, plus `tests/`, `docs/` and a
`framework.lock.json` pinning one ui-source revision
(`simai.framework.product-package-source-lock.v1`). The folder may be a
repository's root or a folder inside a product's own repository; Larena's is
the component folder of `simai/larena-ui`.

ui-builder builds it over the pinned ui-source, from committed bytes, twice,
and the two waves must be identical (`docs/developer/product-packages.md` in
ui-builder). The output is laid out for exactly the declaration above: a
`smart/` directory that is the package base, with `smart/rule.js` -- one
`SF.RuleLoader.registerPackage('<name>', {rules})` call generated from the
components' rule files -- at the default place, so a page needs only

```js
window.SF_BOOT_CONFIG = {packages: {larena: {base: '/assets/larena/smart'}}};
```

Every build a consumer uses has a receipt, `package-receipt.json`: the package,
its source repository, revision and path, the ui-source revision and the free
release `ui-<12>` it was built over, the builder, and the hashes of what it
wrote. The owner delivers the build inside its own distribution; there is no
separate distribution repository and no built bytes in git.

While the free recipe `recipe.admin.collection` still places Larena's data
view, `src/core/contracts/packages/larena.package.json` names the package's
components so the free registry can place them. It carries no bytes, and it
leaves the free Framework together with the recipe once Larena reads both from
its own folder.

## Not yet

- A package's files are versioned with Core's `cacheVersion`; a package with
  its own release cadence has no separate cache version yet. A page that
  serves each release under its own path (as ui-admin does) is not affected.
