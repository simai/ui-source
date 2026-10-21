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

- **A `data-*` an author writes on the host stays on the host, and nowhere
  else.** `forwardHostAttributes` copies the attributes the component does not
  own to the native control it renders, and leaves `data-*` out of that copy
  (`hostKeepsDataAttributes`). A `data-*` names one element, so one element
  carries it: `querySelector('[data-add]')` answers the host and
  `querySelectorAll('[data-action="close"]')` counts it once. Both other
  shapes were wrong in production — moving them to the control emptied the
  host a product had written them on, and copying them put every one on two
  elements and doubled a count. Delegation reads them from inside with
  `event.target.closest('[data-...]')`.
  `tests/smart-host-light-dom.contract.test.mjs`;
  `tests/browser/host-data-attributes-focus.browser.mjs`.

- **A component that renders a focusable control names it in
  `focusDelegate()`**, and the base sends `focus()` and `blur()` on the host
  there. A Smart host lays out as `display: contents`, so it generates no box
  and cannot be focused: without a delegate, `focus()` on the host did nothing
  and left `document.activeElement` where it was. This is what makes a host
  `data-*` usable as a handle — a product finds the host by the attribute it
  wrote and focuses the answer. A focus asked before the first render is
  applied when the control appears, and dropped if something else took focus
  while it waited. Same checks as above.

## Surfaces and lines

- **Height is a pair**: what floats takes `--sf-elevation-N--surface` and
  `--sf-elevation-N--shadow` together. `tests/elevation-shadow.contract.test.mjs`.
- **A control rests on `--sf-outline`** (3:1), never on
  `--sf-outline-variant`, which is the edge of a region.
  `tests/control-boundary.contract.test.mjs`.
- **Geometry is measured**, at a desktop and a mobile width, against the
  size ladder: `docs/foundation-composition-geometry.md`.
