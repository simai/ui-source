# Framework standards

The Framework publishes its own standards here, one directory per identity and
version, in the `standard-contract` envelope:

| Standard | Version | Scope |
|---|---|---|
| `simai.composite-component` | 1.0.3 | composition, slots, presentation, server markup and adoption, behaviour without scripting, accessibility |
| `simai.dynamic-composite-component` | 1.0.3 | the same composite against a host: data ownership, intents, revisions, settings layers, instance lifecycle |
| `simai.composite-host-port` | 1.0.4 | the seam itself: a declared, separately versioned port, compatibility rules, a host declaring what it implements, a transport-neutral conformance kit |
| `simai.change-lifecycle` | 1.0.1 | how a public name leaves the Framework: two stages, a dated journal, a calendar sweep, and an upgrade read from the journal |
| `simai.component-package` | 1.1.2 | a package of Smart components owned by a product or an external author: layout, a pinned Framework revision, rule and manifest of each component, names, a reproducible build with a receipt, delivery and page declaration, licence and trust |
| `simai.interface-fragment` | 1.0.2 | a page built from fragments: a descriptor per fragment, routes declared by the page, closed value types, a contained failure, the address as shared state, and region navigation with a full-load fallback |
| `simai.interaction-rules` | 1.0.0 | how every Smart component loads, talks and draws: one action one render, five states with a skeleton for loading, props down and events up, routes between neighbours, light markup for repeats, stable geometry, contained failure, each rule a check in the build |
| `simai.effect` | 1.4.0 | an animated background: effect.json with typed, bounded settings (a setting may be shown only while another holds given values), the schemes it draws and a pair of the other scheme, one module with mount/update/pause/resume/destroy, still for reduced motion, idle in a hidden tab, no network, clean destroy, a placement theme mode with the area in the drawn theme at 4.5:1, palette tones not roles, a mask-safe windows mode, a pair under the same trust, foreign effects sandboxed, an about menu on a right-click over the background, a kit (scripts/effect-kit.mjs) run before listing |
| `simai.ai-development` | 1.0.0 | how an AI agent develops on and with the Framework: the contracts read first, the public surface only, generated output never edited, exact pins, upgrades by the journal, names without versions, ports by their kit, what a person sees measured in a browser, evidence over report, one writer per repository, the owner's decisions asked, content as data |
| `simai.linkage` | 1.0.1 | what is current and what to change, for every system that uses the Framework: a passport per unit (id, version, owner, files, one content hash over the committed files, dependencies with ranges), a version that moves with the hash, an inventory per release that compares to a change report, a usage record per consumer and one reconcile; formats simai.framework.unit-passport, unit-inventory and unit-change-report; scripts/linkage.mjs |
| `simai.component-set` | 1.3.0 | everything outside the free Framework in sets (draft): one repository per set with its components, Docara site and demos; a passport (set.json: id = repository without ui-, licence simai-pro or framework, Framework pair, required sets at most two levels deep, owned name families, docs site, every component); the Framework holds no per-set reference; one shared name registry (contracts/registry/names.json) with one owner per family under sf-; the Pro gates for every set; one release route (`<set>-<12 hex>` asset and npm `@simai-studio/<set>`) and one compatibility index; an unchanged release re-receipted over a newer pair (`pair-receipt-<pair>.json`, the row's `pairs`) instead of a new version (1.1.0); a pair range per release over a free pair (`pair-range.json`, the row's `range`: the runtime interface the released bytes take from the pair, by which a consumer may accept them over another pair) (1.2.0); a set's scripted API listed in set.json `exports` in the entry shape of public-js-api and held against `SF.package('<set>')` by `scripts/set-exports-kit.mjs` (1.3.0); a one-line connection through the Loader; one site per set from one Docara template (Overview, Connection, Components, Demos, Changes); what is universal belongs to the Framework, reviewed for every component entering a set. Supersedes `simai.component-package` for sets by reference: its package-folder rules hold, `own-element-prefix` and `delivered-in-owners-distribution` are replaced |
| `simai.composition` | 1.0.0 | one Document format for pages and their content (2026-11-10): the JSON Document canonical and the only reversible exchange, HTML, Markdown and Editor.js conversions; three type sets (Layout = the registry, Content = `structured-content`, Page = `ui-layout`); one diagnostic for an unknown profile; inline model 1.2.0 (text, links, the break, a closed list of inline components; marks strong, em, code, strike); unknown content survives; `content.foreign` with source, raw and hash; every converter returns `{value, losses}` under a normative guarantee table; Markdown a projection of content and single text areas in Docara's form; Framework vocabulary with mapping adapters; props and presentation, never a style; versioning; publishing fails closed; one conformance kit. Pins the Recipe lock 1.1.0, the type manifest schema 1.6.0 and the structured-content kit 2.1.0. The editing architecture is not in this edition |

A standard stays at the level of principles that survive a change of library,
browser or view type: 15 to 20 requirements. Event names, CSS classes and
column widths are component documentation, not a standard.

`simai.dynamic-composite-component` inherits `simai.composite-component`, and
`simai.composite-host-port` inherits the dynamic composite, each through
`extends` pinned by version and digest.

A standard pins what it builds on through `uses`, and those pins name **frozen
copies** in `pinned/`, never a live contract file. That is the lesson of the
1.0.1 re-issue: the first edition pinned the live manifest schema, so the next
additive change to that schema would have invalidated a published standard.
Published bytes never change; a superseded edition keeps its exact bytes under
`history/<identity>/<version>/standard.json`, so a consumer that pinned it stays
valid. When a frozen copy has to be refreshed, the standard is re-issued with a
new version and the change is recorded in its ownership extension.

A re-issue travels down every digest pin. When the Recipe contract became 1.1.0
(2026-10-19: its schemas take the format names without a version), the composite
standard pinned the new frozen lock as 1.0.3; the dynamic composite (1.0.3), the
host port (1.0.4) and the interface fragment (1.0.1) were re-issued because each
`extends` its parent by digest, and the component package (1.1.1) because its
`references` name those editions by digest. Requirements did not change.

When value types lost their version in the name (2026-10-19: `record-removed`
beside the older `record-removed.v1`, change journal record
`value-types-without-version`), the fragment descriptor schema became 1.2.0 and
`simai.interface-fragment` 1.0.2 pins its frozen copy
`pinned/interface-fragment-1.2.0.schema.json`; its closed-value-types
requirement names the types without the version. No other standard pins the
interface fragment or the routing contract by digest, so none was re-issued.

When the change journal schema had moved on from the copy its standard pinned
(2026-11-08: `simai.change-lifecycle` 1.0.0 pinned the journal schema 1.0.0, the
live schema is 1.3.0), the standard was re-issued as 1.0.1 over the frozen copy
`pinned/change-journal-1.3.0.schema.json`, equal to the live schema byte for
byte. The re-issue travelled down the references: `simai.component-package`
1.1.2, `simai.linkage` 1.0.1 and `simai.component-set` 1.1.1 name it by digest.
Requirements did not change. The lifecycle policy pin stays 1.0.0: the live
policy declares no version of its own, so it cannot be pinned as a newer
edition until it does.

A pinned reference also names the version the target itself declares: a
contract carries `x-simai-version` (schemas) or `version` (locks), and the gate
refuses a pin whose version does not match. That rule exists because 1.0.1
pinned the manifest schema bytes gained in the data view work while still
calling them 2.0.0, so one identity and version covered two byte sets. The
schema is 2.1.0 since that additive change, and the type manifest schema is
1.1.0.

`standard-contract-1.0.schema.json` is a copy of the envelope schema from
simai/standards (formerly ai-first, zabarov/ai-first; moved and renamed on
2026-11-02, GitHub redirects the old address) standard-contract 1.0
(`standard-contract/1.0`), revision
`8ed3d48efdb2435f1dd4142ab3339b00f5340fb1`, sha256
`ab535794e04b62cf10fca1915a91132b275fe121f3966a571b4882f927de2fb8`. The copy keeps the owner gate
self-contained: `tests/standards.contract.test.mjs` checks every envelope and
every pinned digest without reaching outside this repository. Refresh the copy
from simai/standards when that schema changes, and record the new revision and
digest in this file. The move kept the history: the revision above and its
bytes are the same in simai/standards (tag v1.0.0). Published standards keep
the words "copied from ai-first" in their `specification` description: their
bytes never change, and the name is the repository's former one.

The published, reader-facing form of both standards lives in ui-doc; the
machine-readable form is this directory.

`simai.composition` 1.0.0 (2026-11-10) carries the decisions of the external
review of the composition and its assessment (ui-control
`control/research/2026-11-10-composition-review-assessment.md`, sections 3
and 7) as 17 requirements. It pins frozen copies of the type manifest schema
(`pinned/composition-type-manifest-1.6.0.schema.json`, equal to the live
schema at the time) and of the structured-content conformance kit manifest
(`pinned/structured-content-conformance-2.1.0.manifest.json`), and the Recipe
lock 1.1.0 already frozen here. The Document schema declares no version of its
own, so it is named by `references` (schema_version 1), not pinned by digest.
The editing operations and the behaviour of non-editable nodes wait for the
`sf-input-rich` prototype and are not in this edition.
