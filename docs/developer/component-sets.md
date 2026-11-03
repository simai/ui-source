# Component sets

Status: draft standard `simai.component-set` 1.0.0
(`contracts/standards/simai.component-set/1.0.0/standard.json`). The Loader,
the builder and the package references do not follow it yet; see "What is not
built yet" below.

Every Smart component outside the free SIMAI Framework lives in a **component
set** (owner decision of 2026-11-03). A set is one repository that holds:

- the set's Smart components;
- its Docara documentation site;
- its demonstrations.

The set id is the repository name without `ui-`:

| Set | Repository | Licence | Families | State |
|---|---|---|---|---|
| admin | simai/ui-admin | simai-pro | admin, confirm | planned |
| view | simai/ui-view | simai-pro | view | pending the owner |
| chat | simai/ui-chat | simai-pro | chat, message | planned |
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
- the Framework pairs it runs over;
- the sets it requires;
- the receipt digest.

No release is moved or rewritten.

## One-line connection

A page loads SIMAI Framework and names its sets in one declaration before
the core starts. The Loader then:

1. finds each set's base through the compatibility index, unless the page
   gives a base;
2. loads only the components on the page.

Until the Loader step lands, the declaration is the component-package one:

```html
<script>window.SF_BOOT_CONFIG = {packages: {effects: {base: '<set base>/dist/smart'}}};</script>
<script src="<framework>/distr/core/js/core.min.js"></script>
```

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

- **Loader:**
  - resolving a set by name through the compatibility index;
  - per-set tag aliases and exports through `registerPackage`.
- **Builder:**
  - a generic `publish-package-release.sh` / `bind-package-release.py`;
  - `set.json` in the build, receipt and release;
  - the receipt checked against `set.json` and the registry.
- **References:** `src/core/contracts/packages/*.package.json` and the tag
  alias rows generated from them leave as dated aliases.
- **Compatibility index:** its location, format and writer.
- **Docara:** the shared set template.
- **ui-doc:** the guide section on component sets.
