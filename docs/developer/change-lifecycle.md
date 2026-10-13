# Change lifecycle

How a public name leaves the Framework and how a product follows it. The
standard is `contracts/standards/simai.change-lifecycle/1.0.0`; the policy is
`contracts/lifecycle-policy.json`; the history is
`contracts/changes/journal.json`.

## The rule

The Framework keeps one version line for a long time, so legacy leaves on a
calendar rather than with a version number. A public name leaves in two
stages:

- **compat**: it still works, through an alias, and its record in the journal
  names the replacement. A page that uses it gets it noted in
  `SF.deprecations.list()`; console warnings only when the page opts in with
  `<html data-sf-deprecations="warn">`.
- **removed**: the code is gone. The record stays as a tombstone.

A record is removed on the first sweep day (the 1st of a month) at least 30
days after it was deprecated. A record may be extended once, by at most 30
days, with a reason naming the consumer that still depends on it.

## Deprecating a name

1. Keep the old name working in a shared place: `aliases` or `valueAliases` on
   the prop, a declared alias table, or a shim beside the new code. Not a
   branch inside a component's logic.
2. Append a record to `contracts/changes/journal.json`: today's date as
   `recorded_on` and `deprecated_on`, `remove_after` by the policy, every old
   form in `items` with what to write instead, the `rewrite` kind, and for a
   `manual` rewrite an instruction and a before/after example.
3. Update the component's documentation to show only the new name, and the
   changelog.

`tests/change-lifecycle.contract.test.mjs` fails an alias without a record, a
date the policy did not produce, a deleted record, and a compat record past
its day. `tests/browser/change-lifecycle.browser.mjs` holds the same coverage
for the aliases the built classes declare, and the runtime note.

## Moving a component to a package

A component that leaves the free Framework for a component package
(`docs/developer/component-packages.md`) keeps its tag,
attributes and events, so nothing is deprecated and there is no alias to
sweep. Its record is `kind: component`, `rewrite: manual`, and `removed` from
the day the free release drops it (`removed_on`, `removed_in_pair`); the
policy's `deprecated_on` and `remove_after` are filled for that day and mean
nothing further. Each item's `to` names the declaration a product adds,
`SF_BOOT_CONFIG.packages.<name>`, and a `match` that finds the tag in markup
or `createElement` rather than a class of the same name. `sf-upgrade` reports
such an item only in a project where no file declares the package. The first
is `component-pro-package-move` (2026-10-11).

A component can move again, from one package to another: the four Larena
components went to `pro` and then to `larena` the same day, when SIMAI
Framework Pro was dropped (`component-larena-package-move`). Both records stay
as history, and `sf-upgrade` reports only the last move of each component, so
a project already on `larena` is not told to declare `pro`.

## The sweep

On the sweep day:

1. Scan the known consumers: `node scripts/sf-upgrade.mjs <consumer> --json`
   for Larena, Docara and ui-doc. Migrate them first (with `--apply` and the
   manual list), or extend the record once with a reason.
2. Delete the alias and its code. Set the record's `stage` to `removed`,
   `removed_on` and `removed_in_pair`.
3. Publish the pair. The gate refuses a compat record whose day has passed, so
   a sweep cannot be forgotten.

If a sweep cannot finish by its day, extend the records **before** the day,
never after: the gate must not be red on a day the work is in hand, because a
red that everyone has learned to explain is a gate nobody reads. Only the
sweeper edits the journal; anyone else who meets a due record says so and
waits. In the seven days before a sweep day the suite prints the records that
come due as a diagnostic, without failing.

## Upgrading a product

`node scripts/sf-upgrade.mjs <project> [--since YYYY-MM-DD] [--apply] [--json]`

It reads every record, compat and removed, finds each old form in the project
(HTML, Blade, Twig, Vue, JS, CSS, Markdown, JSON), rewrites what is mechanical
with `--apply`, and lists the rest with the record's instruction and example.
`--since` limits it to records deprecated on or after the date of the pair the
product last moved to. A product is upgraded when the tool reports nothing and
`SF.deprecations.list()` is empty on its pages.

### With an AI

Give the AI three things and one rule:

1. the output of `sf-upgrade --json` (the findings and the manual list);
2. the journal records those findings name (`contracts/changes/journal.json`);
3. the product's own checks.

Rule: apply `--apply` first, then change each manual place as its record
instructs, using its example; never invent a mapping the journal does not
state; finish when `sf-upgrade` reports nothing, the product's checks pass and
`SF.deprecations.list()` is empty on the pages that were touched.
