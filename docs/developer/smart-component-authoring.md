# Writing a Smart component

The rules every Smart component follows, each with the check that holds it.
They came from defects that passed a green suite; the check is what stops
the next one.

## Values

- **A template reads resolved values.** Where a component defines a getter
  for a key its template reads, `templateContext()` passes that getter's
  value. `tests/browser/template-context.browser.mjs`;
  `contracts/template-context.json`.
- **A declared prop is not an accessor.** `static props` puts nothing on the
  instance; read a prop through a getter you define or `this.getProp(key)`,
  never `this.<prop>` bare. `tests/undeclared-prop-reads.contract.test.mjs`.
- **A manifest default is what the component does** with the attribute
  absent, and `meta.mjs` agrees with the manifest.
  `tests/browser/manifest-defaults.browser.mjs`;
  `contracts/manifest-defaults.json`.
- **A payload copy keeps what JSON cannot carry.** Copying a port payload or
  an event detail through `JSON.parse(JSON.stringify(...))` turns a `File`,
  `Blob`, `Date` or `Map` into `{}` or a string without a word: an upload
  intent once arrived with an empty object for its file, the host's size
  check never matched, and every file was accepted. Clone the plain parts and
  pass such values by reference, or use `structuredClone`. Test the seam:
  assert `payload.file instanceof File`, not that an intent was raised.

## Manifest

- **The manifest is valid against the schema itself**, not only against the
  checks `sf-contract` used to make. Those were a subset, and 21 manifests
  that passed them broke ui-studio, which reads the schema.
  `tests/smart-manifest-schema.contract.test.mjs`; `sf-contract` refuses the
  same.
- **Visual states come from the closed list** in the schema. A state of the
  data is the nearest word in it (populated or ready is `default`, a chosen
  star is `selected`); a layout (compact, mobile, wide) belongs to
  `presentation.responsive`; a panel that opens is `open`; a variant an input
  sets is that input. A word the list lacks is a decision about the list, not a
  local addition.
- **Slots are described in `contracts.slots`**, as an object schema whose
  properties are the slot names.

## Events

- **A committed value change is `change`** on the host, once per change the
  user makes; older names stay as aliases: the event is marked `canonical` and each older
  name `alias_of` it (schema 2.3.0). A value set from code
  is not a change. `tests/change-event.contract.test.mjs`;
  `tests/browser/change-event.cli.js`.

## Host ports

- **A closed schema declares every key the component reads.** Every object
  schema in a port is closed, so a key the component reads and the port does
  not declare is a refusal — for the *host*, not the component, which simply
  reads `undefined` and carries on. The file renderer read `uploadText`,
  `formats` and `accept` from the first pair that had a file editor, and a
  consumer validating its own answers against the port was refused for sending
  them; the sweep that found those found nine more. Collect the keys from the
  sources rather than from a list someone maintains, and record a deliberate
  omission with its reason so it cannot outlive it.
  The package's `tests/property-view-field-keys.contract.test.mjs` (larena).
- **An intent declares the event the component announces**, and announces it
  on success as well as on failure. Two intents once named an event that
  existed nowhere, and the first fix announced it only when a write failed,
  which is a declaration a host hears only bad news through.
  The package's `tests/host-port.contract.test.mjs` (larena).
- **A capability names only data the port adds.** Rights that travel inside
  another answer are not a data shape of their own. Same test.
- **A right that differs per person travels in the answer, not in a
  capability.** A capability is static for the host and cannot say that one
  person may write a shared layer and another may not.
- **A rule the host owns is stated per entry, not reimplemented.** «Hidden for
  everyone cannot be shown again in a personal view» arrives as `hiddenBy`
  naming the layer that decided. A component that worked it out instead would
  put the permission model in two places.
- **A write that must not interleave is the whole thing against a revision**,
  and then the thing being written has to *arrive* with its own contents. A
  property view that knew only the resolved arrangement would have written all
  of it into the personal layer, pinning the view so that nothing later changed
  for everyone could show through. Found while implementing the port, before it
  was published; the shape it replaced had already been sent to a consumer.
- **Order written into a sparse store is dense for what moved.** A single
  order cannot say «between B and C» — two neighbours may share a number or
  have none — so take over the order of the one or two containers a change
  touched and leave the rest resolving as it did.
- **Do not write to what the host answered with.** Copy the answer if the
  component rearranges it optimistically; a host that caches its answer would
  otherwise find its own record rewritten by a change it had not accepted.
- **Serialize writes that carry a revision.** Two quick changes sent against
  the same revision make the second a conflict the person caused by being
  quick: correct by the contract and useless to them.

## Measuring

- **Measure the painted result, not the mechanism.** A check that read the
  inline style string a component wrote would have passed only while that
  mechanism survived, and said nothing about what a person sees. Measure the
  geometry: inset from the edge, equal widths.
- **One geometry, one mechanism.** A stacked panel was narrowed by a step in
  one place and inset by a margin in another, and the two had drifted a step
  apart — the window moved one distance and shrank by another. When a
  dependency grows the input for it, delete yours rather than keeping both.
- **Do not restate a wrapper's layout.** An element that carries the same
  class as the container it replaces is already styled by it, because the
  element default sits in `sf.base` and component rules sit above it in
  `sf.components`. A duplicate typed from memory drifts, and this one would
  have reflowed the arrangement at the moment a person entered the mode for
  arranging it.

## Language

- **English by default, Russian on a Russian page.** Words the component
  supplies itself come from `pageText()` in `src/core/js/page-language.js`;
  declare the English text as the props default and resolve the page text in
  a getter that `templateContext()` passes. A host's own text is shown as
  given. `tests/page-language.contract.test.mjs`.
- **The language state is shared, never module-scoped.** Every bundle,
  a component package's included, carries its own copy of `page-language.js`,
  and all of them read one registry on `globalThis`.
  `tests/page-language-shared-state.contract.test.mjs`.

## Packages

- **A component served from its own base is in a package**: declared by the
  page in `SF_BOOT_CONFIG.packages`, its rules registered with
  `SF.RuleLoader.registerPackage`. `docs/developer/component-packages.md`;
  `tests/loader-packages.contract.test.mjs`;
  `tests/browser/loader-packages.browser.mjs`.

## Host content

- **The base captures slot content before the first render**
  (`hasSlotContent` / `getSlotContent`). `connectedCallback` takes the host's
  children first, then calls `onConnected`, then asks for the first render, so
  `onConnected` runs with the slot content already taken and before anything
  is drawn: read slots through `getSlotContent`, not by walking the children,
  which are gone by then. A carrier whose
  only attribute is `slot` is unwrapped and its children kept; with any other
  attribute it is kept whole, so a listener on the carrier itself goes with
  it.

- **Static markup is replaced in the first render** (standard
  simai.smart-component 1.3.8 §5.4, simai/ui-source#40). What a server or a
  static page printed inside the host before the code arrived -- each top node
  marked `data-sf-static` -- is the element's first paint, and the base removes
  it right before lit draws the template, in the same task: no frame shows
  both and none shows neither. The element reads its first values from the
  host's attributes, never from those nodes, and `captureChildTemplates`
  skips them; a child with `slot` is page content, not static markup.
  Until the tag is defined Core hides only an element that has neither static
  markup nor a `data-sf-skeleton` shape (`src/core/js/pending-tags.js`), in its
  own box; the page itself is never hidden.

- **Every component's first paint is a build snapshot** (owner decision
  2026-10-27; §5.4, §7.3, gate 24). `node scripts/snapshot-first-paint.mjs
  <build output>` renders every example of `examples.json` (a component
  without one: its defaults) in a headless browser with the real Loader and
  writes `static/<template>/<example>.html` -- the host as a server prints it:
  its attributes, a JSON island `<script type="application/json"
  data-sf-settings>` for list and object settings, the rendered markup marked
  `data-sf-static`, and the page's own children (those the element takes into
  its markup marked `data-sf-held`, out of view until it draws) -- and
  `static/sheets.json`, the sheets the Loader asked for, per example. The
  files are committed and ship with the component (the builder copies every
  `.html` and `.json` of its folder); `--check` fails on a stale one, and
  `tests/browser/first-paint-snapshots.browser.mjs` runs it on the candidate.
  An overlay is printed closed: its first paint is its trigger, or nothing.
  The JSON island is printed once, as the island (never again as a held
  child), and the icon runtime's font state -- `sf-icon`'s `loaded`
  attribute, the `sf-icon-loaded` class -- is left out: the live element sets
  it, and a snapshot is the same on every run.
- **Snapshots are measured in Inter** (decision 2026-10-27). On a page the
  Inter faces are `font-display: optional`: a cold visit keeps the metric
  fallback ("Inter Fallback", Arial bent to Inter's metrics) for the visit
  rather than move its layout when Inter arrives, and that stays as it is.
  But a snapshot page set its text in whichever face won the race, and a
  width the code measured (a column, a truncated label) moved 1-2 px between
  runs. The snapshot and gate server (`scripts/first-paint-lib.mjs`
  `measuredFonts`) serves the sheets with the Inter faces `block`, and the
  snapshot waits for every Inter face the stage's text needs and refuses to
  serialise without it (`fontsReady`). Metric overrides cannot close the gap
  instead: Arial's glyph widths differ from Inter's per letter, not by a
  scale. Two independent write runs give byte-identical snapshots.
- **A component package runs the same tools** over its own build: a JSON file
  given as `--config=<file>` (or `FIRST_PAINT_CONFIG`) declares
  `{"packages": {"<name>": {"output": "<built smart/ dir>", "base":
  "/distr/package/<name>/"}}}`; each package's output is served under its base
  after the free output and declared on every page as
  `SF_BOOT_CONFIG.packages.<name>`.
- **Late data has a skeleton.** Settings that arrive after the first paint
  are declared: `"presentation": {"skeleton": {"late": ["items"]}}` (sf-tree,
  sf-menu, sf-profile-picker). For an example that gives them, the snapshot
  also writes `<example>.skeleton.html` (an example that gives an empty list
  gives the empty state, which is data: it has no skeleton, and a printed
  skeleton whose late list arrives empty leaves): every text a bar of the same length
  (`.sf-first-paint-bar`, the text kept transparent), every image a fill,
  values cleared, the late settings left out of the island, the host marked
  `data-sf-first-paint="skeleton" aria-busy="true"`. The element keeps a
  printed skeleton until the late settings arrive (`sfAwaitingData()`), then
  replaces it in one frame. A hand-written `skeleton.html`
  (`presentation.skeleton.file`, with `{{setting}}` and `<template
  data-sf-repeat="rows">` repeated from `presentation.skeleton.repeat`)
  overrides the derived one, and is what a part whose data is unknown when an
  assembly is composed is printed with. Repeats nest (a row, and in it
  `<template data-sf-repeat="cells">` a cell per column), and a count is a
  setting (`"rows": "items"`), a setting with a default for when it is not
  given (`"rows": {"setting": "items", "default": 5}`), or a number.
- **A component fed through a host port** declares in an example what a fake
  port answers: `"port": {"answers": {"<intent>": <answer>, "*": <answer>},
  "methods": {...}, "capabilities": ..., "delay": 0}`. The snapshot is taken
  before any port is handed over; gate 24 hands the fake port over
  (`connectPort`) as phase 3 and checks the box holds while the answers draw.
- **Adoption is the base's**, not a component's: the JSON island is read
  before the first render (`sfReadIsland()`, a component that reads children
  before `super.connectedCallback()` calls it first); a Smart element drawn
  inside another's static markup does not draw on its own; when the outer
  element draws, each new Smart element of its template takes the static
  children of the printed one of the same tag and order
  (`handOverStaticMarkup`), so the page shows its picture until it draws. A
  component that renders by its own path (sf-modal, sf-drawer, the plain
  composition hosts) removes static markup the same way, and one that
  collects its children as content skips `data-sf-static`.
- **An assembly's first paint is composed from its parts** (§7.3): the
  snapshot renders the assembly and writes `static/<layout>/<example>.html`,
  the live layout printed as one `data-sf-static` node with each part's host
  in its place holding the part's static markup, or its `skeleton.html` when
  its late data is not in the example. `SF.Assembly` takes the printed part
  hosts into the live layout in the same task as it places the parts
  (`HostView.adoptPrinted`), so each adopts its own printed markup.
  `tests/fixtures/first-paint/document-browser` is the test assembly.
- **Gate 24** (`tests/browser/first-paint-gate.browser.mjs`): every snapshot
  is printed with its sheets, Core in `<head>`, the components' code held
  back; at 1280 and 390 px the element's box (each part's, for an assembly)
  is the same once the sheets are in, once the code adopted and once the late
  data arrived, the text below never moves and no layout shift is recorded.
  A shift before any code while nothing moved, or of text alone while no box
  moved, is a font arriving and is reported apart. Known exceptions, each
  with its reason: `tests/fixtures/first-paint/gate-known.json`.

- **A Smart element in a closed container loads when it opens** (§7.2.1,
  simai/ui-source#47). Inside `[hidden]`, `[inert]`, a closed `<details>` (past
  its summary) or a closed `<dialog>`, the Loader does not fetch the tag's code;
  it watches the container and fetches once when it opens. A container part
  shows and closes a panel with `hidden`.
  `tests/core-first-paint.contract.test.mjs`;
  `tests/browser/core-first-paint.browser.mjs`.

- **A component that takes a host port asks for one** with
  `sf-host-port-request`: bubbling and composed, `detail: {component, context:
  {owner, record, group}}`. `owner` names the composite that embedded it; a page
  list sends all three as null rather than inventing a value. It is raised once
  per connection while there is no port, and the host answers with
  `event.target.setHostPort(port)`, at once or later. The once-per-connection
  flag resets on disconnect, so an element moved in the DOM asks again; it is
  not reset by `setHostPort`. This is not the routing contract's
  `sf-port-output`: a routing port is a typed value moving between endpoints, a
  host port is the data adapter. Every component that takes a host port today
  lives in package larena, so the checks live with it:
  `tests/host-port-request.contract.test.mjs`;
  `tests/browser/host-port-request.browser.mjs`. The ports themselves are
  public: `src/core/contracts/ports/<port>/<version>/` (`component-packages.md`).

- **A `data-*` an author writes on the host is moved to the native control,
  never copied.** `forwardHostAttributes` copies the attributes the component
  does not own to the control it renders and moves `data-*` there
  (`transferDataAttributes`), so exactly one element carries one — and it is the
  element that has a box, paints, takes focus, is clicked and is dragged. Both
  other shapes failed in production: copying put every `data-*` on two elements
  and doubled a count, and keeping it on the host alone left one element with no
  box, so a drag through its bounding box threw and a probe reading a filled
  button read the wrong element. A `display: contents` host generates no box at
  all, and no JavaScript can give it one. The host is reached back from the
  control with `closest('sf-button')`, the direction that always exists, and the
  host's own record of what the author wrote is public as
  `element.dataAttributes`, with `removeHostDataAttribute()` to clear one from
  the record and the control together.
  `tests/smart-host-light-dom.contract.test.mjs`;
  `tests/browser/host-data-attributes-focus.browser.mjs`.

- **A component that renders a focusable control names it in
  `focusDelegate()`**, and the base sends `focus()` and `blur()` on the host
  there. A Smart host lays out as `display: contents`, so it generates no box
  and cannot be focused: without a delegate, `focus()` on the host did nothing
  and left `document.activeElement` where it was. A focus asked before the first
  render is applied when the control appears, and dropped if something else took
  focus while it waited. Same checks as above.

## Surfaces and lines

- **Height is a pair**: what floats takes `--sf-elevation-N--surface` and
  `--sf-elevation-N--shadow` together. `tests/elevation-shadow.contract.test.mjs`.
- **A control rests on `--sf-outline`** (3:1), never on
  `--sf-outline-variant`, which is the edge of a region.
  `tests/control-boundary.contract.test.mjs`.
- **Geometry is measured**, at a desktop and a mobile width, against the
  size ladder: `docs/foundation-composition-geometry.md`.
