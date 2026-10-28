# Framework standards

The Framework publishes its own standards here, one directory per identity and
version, in the `standard-contract` envelope:

| Standard | Version | Scope |
|---|---|---|
| `simai.composite-component` | 1.0.3 | composition, slots, presentation, server markup and adoption, behaviour without scripting, accessibility |
| `simai.dynamic-composite-component` | 1.0.3 | the same composite against a host: data ownership, intents, revisions, settings layers, instance lifecycle |
| `simai.composite-host-port` | 1.0.4 | the seam itself: a declared, separately versioned port, compatibility rules, a host declaring what it implements, a transport-neutral conformance kit |
| `simai.change-lifecycle` | 1.0.0 | how a public name leaves the Framework: two stages, a dated journal, a calendar sweep, and an upgrade read from the journal |
| `simai.component-package` | 1.1.1 | a package of Smart components owned by a product or an external author: layout, a pinned Framework revision, rule and manifest of each component, names, a reproducible build with a receipt, delivery and page declaration, licence and trust |
| `simai.interface-fragment` | 1.0.2 | a page built from fragments: a descriptor per fragment, routes declared by the page, closed value types, a contained failure, the address as shared state, and region navigation with a full-load fallback |
| `simai.interaction-rules` | 1.0.0 | how every Smart component loads, talks and draws: one action one render, five states with a skeleton for loading, props down and events up, routes between neighbours, light markup for repeats, stable geometry, contained failure, each rule a check in the build |
| `simai.effect` | 1.2.0 | an animated background: effect.json with typed, bounded settings, the schemes it draws and a pair of the other scheme, one module with mount/update/pause/resume/destroy, still for reduced motion, idle in a hidden tab, no network, clean destroy, a placement theme mode with the area in the drawn theme at 4.5:1, palette tones not roles, a mask-safe windows mode, a pair under the same trust, foreign effects sandboxed, a kit (scripts/effect-kit.mjs) run before listing |
| `simai.ai-development` | 1.0.0 | how an AI agent develops on and with the Framework: the contracts read first, the public surface only, generated output never edited, exact pins, upgrades by the journal, names without versions, ports by their kit, what a person sees measured in a browser, evidence over report, one writer per repository, the owner's decisions asked, content as data |
| `simai.linkage` | 1.0.0 | what is current and what to change, for every system that uses the Framework: a passport per unit (id, version, owner, files, one content hash over the committed files, dependencies with ranges), a version that moves with the hash, an inventory per release that compares to a change report, a usage record per consumer and one reconcile; formats simai.framework.unit-passport, unit-inventory and unit-change-report; scripts/linkage.mjs |

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

A pinned reference also names the version the target itself declares: a
contract carries `x-simai-version` (schemas) or `version` (locks), and the gate
refuses a pin whose version does not match. That rule exists because 1.0.1
pinned the manifest schema bytes gained in the data view work while still
calling them 2.0.0, so one identity and version covered two byte sets. The
schema is 2.1.0 since that additive change, and the type manifest schema is
1.1.0.

`standard-contract-1.0.schema.json` is a copy of the envelope schema from
ai-first standard-contract 1.0 (`standard-contract/1.0`), revision
`8ed3d48efdb2435f1dd4142ab3339b00f5340fb1`, sha256
`ab535794e04b62cf10fca1915a91132b275fe121f3966a571b4882f927de2fb8`. The copy keeps the owner gate
self-contained: `tests/standards.contract.test.mjs` checks every envelope and
every pinned digest without reaching outside this repository. Refresh the copy
from ai-first when that schema changes, and record the new revision and digest
in this file.

The published, reader-facing form of both standards lives in ui-doc; the
machine-readable form is this directory.
