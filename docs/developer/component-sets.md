# Component sets

Status: draft standard `simai.component-set` 1.2.0
(`contracts/standards/simai.component-set/1.2.0/standard.json`; 1.0.0, 1.1.0
and 1.1.1 are kept under `contracts/standards/history`; 1.1.1 changed no
requirement of 1.1.0; 1.2.0 adds pair ranges). The Loader
follows it since `core.runtime` 1.25.0 and the builder has a generic set
release route; the package references do not follow it yet. See "What is not
built yet" below.

Every Smart component outside the free SIMAI Framework lives in a **component
set** (owner decision of 2026-11-03). A set is one repository that holds:

- the set's Smart components;
- its Docara documentation site;
- its demonstrations.

The set id is the repository name without `ui-`:

| Set | Repository | Licence | Families | State |
|---|---|---|---|---|
| admin | simai/ui-admin | simai-pro | admin | planned |
| view | simai/ui-view | simai-pro | view | pending the owner |
| chat | simai/ui-chat | simai-pro | chat | planned |
| mail | simai/ui-mail | simai-pro | mail | planned |
| editor | simai/ui-editor | simai-pro | editor | planned |
| chart | simai/ui-chart | simai-pro | chart | planned |
| effects | simai/ui-effects | framework (free) | effect | planned, first set |

`view` is a possible set of data views (table, kanban, calendar, gantt, list).
It is waiting for the owner's decision. Until then the registry holds the
family `view` for it rather than for `admin`.

## The passport: `set.json`

A set describes itself in `set.json` at the root of its package folder, in the
format `simai.framework.component-set` (`schema_version: 1`). The schema is
`contracts/schema/component-set.v1.schema.json`, and the standard pins a frozen
copy of it.

```json
{
  "schema": "simai.framework.component-set",
  "schema_version": 1,
  "standard": {"id": "simai.component-set", "version": "1.0.0"},
  "id": "effects",
  "title": "SIMAI Effects",
  "repository": "simai/ui-effects",
  "licence": {"class": "framework", "spdx": "Apache-2.0"},
  "framework": {"core_runtime": ">=1.25.0", "source_revision": "<40 hex>"},
  "requires_sets": [],
  "families": ["effect"],
  "docs": "https://effects.simai.io/",
  "components": [
    {"element": "sf-effect", "rule": "cl-effect", "folder": "effect", "requires": ["cl-menu-context"]}
  ]
}
```

The fields:

- **`id`**: the repository name without `ui-`. The same id appears in:
  - the lock;
  - the rule file's `registerPackage`;
  - the release tag;
  - the npm name `@simai-studio/<id>`;
  - the page declaration;
  - the registry.
- **`licence`**: one of two classes, each with exactly one SPDX expression.
  - `simai-pro`: `PolyForm-Small-Business-1.0.0 OR PolyForm-Noncommercial-1.0.0 OR LicenseRef-SIMAI-Commercial`.
  - `framework`: `Apache-2.0`.
- **`framework`**: the one ui-source commit the set is built and tested
  against (the same commit as `framework.lock.json`), and the lowest
  `core.runtime` version it needs. A release adds `pair` (`ui-<12 hex>`).
- **`requires_sets`**: the other sets the set's components use, each as `{id, range}`.
  - There are no cycles, and the graph is at most two levels deep.
  - The Loader never loads a required set on its own: the page declares it.
- **`families`**: the name families the set owns. They must match the
  registry.
- **`components`**: every element the set holds, with:
  - its rule (`cl-<folder>`);
  - its folder;
  - the rules it needs;
  - its dated former tags.

  This list is the only description of the set's components. **SIMAI Framework keeps no per-set
  reference**, so a new component in a set needs no Framework release.
- **`release`**: added by the release route. It holds `<set>-<12 hex>`, the npm
  version and the source commit.

## Names: one prefix, one registry

- Every element starts with `sf-` and every rule with `cl-`. A set has no prefix
  of its own.
- A name is `sf-<family>[-<block>][-<variant>]`
  (`decisions/2026-11-02-smart-component-naming.md` in ui-control). Its family
  is the first word after `sf-`.
- The shared registry `contracts/registry/names.json` (format
  `simai.framework.name-registry`) gives each family **one owner**: SIMAI
  Framework or one set. It also lists the names known in each family.
- The registry holds names only. It has no files, versions or rules.
- CI reads the registry from ui-source `main`. This is the one documented
  exception to "main is not a contract".
- To take a family, change the registry before the set's first release that
  uses it. A new name inside a family the set already owns needs no registry
  change first.
- A name that breaks the rule today goes in `exceptions`, with its reason
  and date. The gate refuses any break that is not listed.
- Dated former tags (the tag alias table) are exempt until their
  `remove_after`.

`tests/component-set.contract.test.mjs` checks that:

- no family has two owners;
- every registered name starts with a family its owner holds, or is a listed
  exception, and no exception is stale;
- the Framework's own `src/smart/*/smart.manifest.json` elements are exactly
  the Framework's registered names;
- every tag alias points at a registered name, and no former tag is a
  current name;
- the fixture passport (`tests/fixtures/component-set/set.json`) takes the
  pinned form and agrees with the registry.

Open exceptions on 2026-11-03: `sf-editor-inline` and `sf-editor-overlay`.
They are SIMAI Framework components in the family `editor`, which belongs to
the set `editor`. One of two changes will close them:

- they move to the set;
- they are renamed through the change lifecycle.

## What is universal belongs to SIMAI Framework

A set does not ship what the Framework offers or should offer.

- The reusable part of a complex component is raised into the Framework as a
  Smart component of its own, and the set composes it.
- Basic parts are ordered from the Framework. Examples: a scale, a colour
  scheme, a token, a scrim, lazy loading of a part.
- Every component that enters a set, new or moved, is first reviewed against
  this rule. The review is recorded with the component.
- When ui-pro moves, the first candidates are `message-log`, `confirm-change`
  and `admin-menu`.

## Gates, the same for every set

These are the gates the Pro package passes today:

1. the unit suite over the overlay of the pinned Framework;
2. manifest probes;
3. browser probes in a real browser;
4. the first paint, watched frame by frame;
5. linkage: passports whose version moves with the content hash, and the
   release inventory compared to the previous one;
6. two byte-identical builds with a receipt;
7. the passport checked against the registry at `main`.

## One release route

Each release is tagged `<set>-<12 hex>`, the first twelve hex digits of the
set commit. The tag is on the set's own repository and carries these assets:

- `package-<set>.tar` and its `.sha256`;
- `package-receipt.json`;
- the built `set.json`.

The same bytes go to npm as `@simai-studio/<set>`.

Each release adds one row to the one compatibility index, with:

- the set;
- the release;
- the version;
- the Framework it was built over (`pair`, `source_revision`) and the lowest
  `core.runtime` it needs, so it runs over every pair at or above it;
- the sets it requires;
- the receipt digest.

No release is moved or rewritten.

### Pair receipts (since 1.1.0)

When a product moves to a newer SIMAI Framework pair and the set's own source
did not change, the set gets no new version (owner decision 2026-11-07). The
release route runs ui-builder `scripts/pair-receipt.py run` over the existing
release:

- the released output, read from the Build commit, is the release archive;
- the pair's `core.runtime` meets the set's minimum, its shared runtime and
  free rules agree with the set, and the registry agrees with the passport;
- the release source, repinned to the pair's ui-source in a local commit that
  is never pushed, rebuilds to the released bytes apart from the passport's
  `framework.source_revision` (otherwise the set needs a new release);
- the set's own gates pass over the pair against the released bytes.

The result, a pair receipt (`simai.framework.set-pair-receipt` v1), is added to
the existing release as `pair-receipt-<pair>.json`, to the set repository as
`contracts/pair-receipts/<release>/<pair>.json`, and to the release's row of
the index as an entry of `pairs`. The release lock, the package receipt, the
passport and npm do not change. A consumer that pins exact pairs accepts the
set over a pair named either by its package receipt or by one of its pair
receipts.

### Pair ranges (since 1.2.0)

A pair receipt rebuilds and gates the set over each pair. A pair range does
not: it is written once per release, from the released bytes, and lists what
those bytes take from the free pair at runtime (owner decision 2026-11-09,
R1):

- `core_runtime`: the passport's minimum;
- `runtime`: the shared runtime ABI and, per shared module, the names the
  bundles import through `SF.runtimeModule`;
- `relations`: every relation of the set's rule file to a rule that is not
  the set's own, resolved on the pair to a free rule or through a live
  forward (`smart-rule-forwards.v1.json`);
- `elements`: the set's own tags, which no free rule may take;
- `free_elements`: the free tags the set's scripts render;
- `core_folder`: the set's package core, which the pair must not ship in
  `distr/smart`;
- `variables`: the `--sf-*` properties read bare (no fallback), not set by the
  set, declared by the pair's sheets;
- `js_api`: the `window.SF` names called that `public-js-api.json` lists as
  public.

The file, `simai.framework.set-pair-range` v1 with `interface_sha256` (the
sha256 of the canonical JSON of `requires`) and `not_covered`, is written by
ui-builder `scripts/set-pair-range.py write`; the release route writes it with
every release over a free pair, as the asset `pair-range.json`, as
`contracts/pair-ranges/<release>.json` in the set repository and as `range` on
the release's index row. `set-pair-range.py check --range <file> --ui <ui>
--pair <ui-12>` answers from the pair's `distr` alone. A consumer that pins
exact pairs may accept the set over a pair where every requirement holds,
after the exact pair and the pair receipts. What a range does not cover --
behaviour behind an unchanged interface, Framework code a bundle inlined, the
set's gates -- is left to the consumer's own browser probes at each repin and
to a full pair receipt once per release train.

### The compatibility index

- Format: `simai.framework.set-index`, `schema_version: 1`
  (`contracts/schema/set-index.v1.schema.json`, pinned by the standard).
  A fixture is `tests/fixtures/component-set/index.json`.
- Where: `index.json` of the npm package `@simai-studio/sets`. The Loader reads
  `https://cdn.jsdelivr.net/npm/@simai-studio/sets@1/index.json`: the format's
  major is pinned, the rows grow.
- Writer: the set release route, `ui-builder/scripts/set-index.py add`, from
  the release's built `set.json` and receipt. Nobody edits it by hand.
- Reader: the Loader picks the newest release of a set whose
  `framework.core_runtime` this Core meets (`core/js/sets.js`,
  `selectSetRelease`). It does not read `pairs`.
- A row's facts never change. Since 1.1.0 a row may carry `pairs`, each
  `{pair, source_revision, receipt_sha256, received_on}`: the further pairs
  its unchanged release was re-receipted over, in the order received, written
  by `set-index.py pair`. Since 1.2.0 a row may carry `range`,
  `{sha256, interface_sha256}`: the digests of its pair range file and of the
  interface it names, set once by `set-index.py range`. The Loader reads
  neither.

```json
{
  "schema": "simai.framework.set-index",
  "schema_version": 1,
  "sets": [{"id": "effects", "title": "SIMAI Effects", "repository": "simai/ui-effects",
            "npm": "@simai-studio/effects", "licence": {"class": "framework", "spdx": "Apache-2.0"},
            "docs": "https://effects.simai.io/"}],
  "releases": [{"set": "effects", "release": "effects-<12 hex>", "version": "1.0.0",
                "source_revision": "<40 hex>",
                "framework": {"core_runtime": ">=1.25.0", "source_revision": "<40 hex>", "pair": "ui-<12 hex>"},
                "requires_sets": [], "receipt_sha256": "<64 hex>", "published_on": "2026-11-03"}]
}
```

## One-line connection

A page loads SIMAI Framework and names its sets on the same line
(`core.runtime` 1.25.0):

```html
<script src="https://cdn.jsdelivr.net/npm/@simai-studio/ui@<v>/distr/core/js/core.min.js" data-sf-sets="effects"></script>
```

The Loader then:

1. finds each set's base through the compatibility index:
   `@simai-studio/<set>@<version>/dist/smart` of the newest release this Core
   meets;
2. fetches the set's `rule.js` before the first scan;
3. loads only the components on the page.

Other forms of the same declaration:

| Written | Means |
|---|---|
| `data-sf-sets="effects admin@1.2.0"` | effects by the index; admin at npm 1.2.0, no index read |
| `SF_BOOT_CONFIG.packages.effects = true` (or `{index: true}`) | by the index |
| `SF_BOOT_CONFIG.packages.effects = '1.0.0'` | that npm version |
| `SF_BOOT_CONFIG.packages.effects = '<base>'` | that base, for example a `gh/` commit or a local copy |
| `SF_BOOT_CONFIG.packages.effects = {base, rule}` | the component-package form |
| `<script src="<base>/rule.js">` after core.js | the base is the rule file's directory |

`SF_BOOT_CONFIG` wins over `data-sf-sets`. `SF_BOOT_CONFIG.setIndex` and
`SF_BOOT_CONFIG.setNpm` replace the index address and the npm root, for a
mirror or a local stand.

What a set adds at runtime, through its `rule.js` and its bundles:

- `SF.RuleLoader.registerPackage(<set>, {rules, api, aliases, base})`: the
  rules; `api`, the rule whose bundle carries the set's scripted API; `aliases`,
  the set's own dated former tags (`{from, to, since, remove_after}`), merged
  into `SF.tags` so SIMAI Framework keeps no row for them.
- `SF.RuleLoader.registerPackage(<set>, {exports})`: the scripted API, from the
  bundle. A page reads it with `await SF.package('<set>')`, which asks for the
  `api` element if it has not loaded and refuses a set the page has not
  declared, naming the line to add.
- `SF.RuleLoader.packageOf(<set>)`: `{name, base, declared, registered,
  version, release, api, exported}`, frozen. A bundle finds files published
  with it (the effects catalogue) relative to `base`.

In debug (`?sf-debug`, `data-sf-debug`) the Loader also reads
`<base>/../set.json` and names each required set the page has not declared.
It never loads a required set on the page's behalf. It reads the passport only
of a package the page names as a set (`data-sf-sets`, `true`, a version, a
base string, `{index: true}` or an object with a `version`); a component
package declared as `{base}` or `{base, rule}`, such as the Pro package, has no
passport and nothing is requested for it (core.runtime 1.26.1).

## One site per set

Each set has one site on its own subdomain. It holds the documentation and
the demos together and is built with the one shared Docara set template. It
has five required sections:

- **Overview**: what the set does, its licence and its Framework
  compatibility;
- **Connection**: the one line;
- **Components**: one page per component, with live examples;
- **Demos**: ready screens;
- **Changes**.

## Relation to `simai.component-package`

`simai.component-set` **supersedes** `simai.component-package` for components
outside the Framework. It refers to 1.1.1 by digest and does not extend it.

An `extends` would inherit two requirements that sets replace:

- `own-element-prefix`: sets use `sf-`;
- `delivered-in-owners-distribution`: sets have one release route.

The standard-contract envelope cannot override an inherited requirement.

Every other component-package rule still holds for a set's package folder:

- layout and lock;
- plain-data rules;
- manifests and ports;
- reproducible build and receipt;
- trust;
- the lifecycle of public names.

`pro` and `larena` stay on the package standard until `pro` becomes a
transitional bundle of the paid sets.

## What is not built yet

- **References:** `src/core/contracts/packages/*.package.json` and the tag
  alias rows generated from them leave as dated aliases.
- **Compatibility index:** `@simai-studio/sets` is not published until the
  first set release; no gate checks `requires_sets` across sets yet.
- **Docara:** the shared set template.
- **ui-doc:** the guide section on component sets.
