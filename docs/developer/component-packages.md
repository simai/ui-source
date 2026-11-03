# Component packages

A component package is a set of Smart components served from its own base and
carrying its own rules, loaded by the same Loader as everything else. It is how
the Framework is extended: a component lives with its owner, and a product or
an external author ships its components as a package rather than adding them
to the Framework (owner's decisions of 2026-10-11). The standard is
`simai.component-package` 1.0.0 (`contracts/standards/simai.component-package/`).

The SIMAI Framework Pro components are the first package, `pro`:
`sf-view-table`, `sf-view`, `sf-view-properties`, `sf-admin-menu` and the rest
are not in Core's rule list or in `ui`; they live in the component folder of
`simai/ui-pro` and arrive this way. Larena is one of their consumers. They
went to a package named `pro` on 2026-10-11, to `larena` the same day, and
back to `pro` on 2026-11-02 (owner decision q-4ac7d07595); the change journal
records each step (`component-pro-package-move`,
`component-larena-package-move`, `option-package-larena-to-pro`). The Loader
side is in `src/core/js/loader.js` (`registerPackage`, `resolveSmartBase`,
`getMissingFileKey`, `PACKAGE_ALIASES`).

### A package's former name

A renamed package keeps its former name as a dated alias until the journal's
sweep day. `larena` is the alias of `pro` until 2027-01-01: a page that
declares `packages.larena` declares `pro` (the same base and rule file), and a
package built under the old name, whose rule file calls
`registerPackage('larena', ...)`, registers as `pro`. Either use is noted once
in `SF.deprecations` (kind `option`, component `loader`). A page that declares
both names gets `pro` and a warning that `larena` is ignored. A Framework pair
from before 2026-11-02 knows only the name the page declares, so over such a
pair the page and the package must use the same name.

### A package element's former tag

A package component renamed with a dated tag alias (rename plan R2,
2026-11-03: `sf-table` is `sf-view-table`, `sf-data-view` is `sf-view`,
`sf-property-view` is `sf-view-properties`, `sf-content-editor` is
`sf-editor-content`, `sf-thread-list` is `sf-chat-threads`,
`sf-change-confirm` is `sf-confirm-change`) keeps its former tag until the
alias's `remove_after`, the way a Framework component does
(`src/core/js/tag-aliases.js`):

- The package reference lists it: the item names the new `element`,
  `rule_name`, `folder` and `id`, and `element_aliases` holds each former tag
  with `since`, `remove_after` and its change journal record. The package's
  rule lists the element first and its former tags after it, which the package
  receipt checks against the release (ui-builder `write-package-receipt.py`).
- The runtime's tag table (`tag-aliases.generated.js`, written by
  `scripts/tag-alias-table.mjs`) carries the reference's rows, so
  `SF.tags.selector('sf-view-table')`, `SF.create('sf-table')` and the
  language registry know the former tag before the package has run. An old tag
  the page still has as an element of its own (a package built before the
  rename beside a newer pair) is left as it is.
- The Loader forwards the former bundle name (`cl-table` -> `cl-view-table`,
  `src/core/contracts/smart-rule-forwards.v1.json`) to the package's rule once
  the package's rules are registered; a package that still registers the former
  name itself keeps its own rule. The package build serves only folders that
  hold a rule, so the former file path under the package base is not served.

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
      pro: {base: '/assets/ui-pro/smart'},
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
SF.RuleLoader.registerPackage('pro', {
  rules: {
    'cl-table': {
      tags: ['sf-view-table'],
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
  package, so a pro rule relating to `cl-icon` fetches the icons from the
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
  lazy one and calls it straight away asks for it and waits in one call:
  `const {missing} = await SF.Loader.ensure(['sf-context-menu'], {timeout: 3000})`.
  It fetches each tag's code as the page would, settles when all are defined
  or the timeout has passed (3 s by default), and never rejects: `ready`
  lists the tags that are defined, `missing` those that are not, for the
  caller's fallback. A tag already defined costs nothing, and callers of one
  tag share one fetch and one wait.
- What an element renders from its own code outside its own render -- a
  window, a menu or a panel it draws into a box of its own (a portal) -- is
  read by the Loader as the page is. A Smart element inside such a box does
  not wait for an ancestor outside it to capture its source: the element marks
  the box with `SF.Loader.watch(box)` (it sets `data-sf-portal`, reads what is
  in the box at once, and returns the function that unmarks it;
  `SF.Loader.unwatch(box)` does the same). A parent element defined over
  another base than the Smart base holds none of its children either.
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
repository's root or a folder inside a product's own repository; Pro's is
the component folder of `simai/ui-pro`.

ui-builder builds it over the pinned ui-source, from committed bytes, twice,
and the two waves must be identical (`docs/developer/product-packages.md` in
ui-builder). The output is laid out for exactly the declaration above: a
`smart/` directory that is the package base, with `smart/rule.js` -- one
`SF.RuleLoader.registerPackage('<name>', {rules})` call generated from the
components' rule files -- at the default place, so a page needs only

```js
window.SF_BOOT_CONFIG = {packages: {pro: {base: '/assets/ui-pro/smart'}}};
```

Every build a consumer uses has a receipt, `package-receipt.json`: the package,
its source repository, revision and path, the ui-source revision and the free
release `ui-<12>` it was built over, the builder, and the hashes of what it
wrote. The owner delivers the build inside its own distribution; there is no
separate distribution repository and no built bytes in git.

While the free recipe `recipe.admin.collection` still places the Pro data
view, `src/core/contracts/packages/pro.package.json` names the package's
components so the free registry can place them. It carries no bytes, and it
leaves the free Framework together with the recipe. `larena.package.json`
names the same components under the former name (`alias_of: "pro"`), so a
package built as `larena` still agrees with the release; it leaves with the
alias on 2027-01-01.

## Not yet

- A package's files are versioned with Core's `cacheVersion`; a package with
  its own release cadence has no separate cache version yet. A page that
  serves each release under its own path (as ui-admin does) is not affected.
