# Dependency graph

Owner decisions C249, C250 and C251 (2026-11-16). One graph of what SIMAI
Framework units declare and what their code really draws, built at every pair
and shipped with it, and two gates over it:

- **C249 — the graph.** Built from the unit passports, the Smart manifests'
  `composition.uses`, the Loader's relations and the Smart code, with reverse
  links on every node.
- **C250 — declared against drawn.** A Smart component must declare what it
  draws and draw what it declares. Today's mismatches are dated debt; a new one
  fails the pair, and so does fixed debt still listed.
- **C251 — twins.** A plain component and its Smart twin are one look in two
  models; Smart is the default model (C224). A divergence that is not dated debt
  fails the pair, and so does a change to one twin without a change to the other
  or an explicit mark that the change is meant for one side.

Script: `scripts/dependency-graph.mjs`. Contract test:
`tests/dependency-graph.contract.test.mjs` (in `npm run test:unit`).

## Where it runs

The graph rides the linkage standard (`scripts/linkage.mjs`), so every route
that already runs linkage builds and checks the graph without a step of its own:

| Route | Command | Graph |
|---|---|---|
| candidate (`ui-control tools/release/linkage-gate.sh`) and publish (`ui-builder scripts/publish-framework-release.sh`, before anything is laid down) | `linkage.mjs passports --check --rev <source> --previous <last released inventory>` | C250 and C251 gates, the twin change check against that inventory, the impact list |
| publish, after the build commit | `linkage.mjs inventory --out ui/contracts/releases/ui-<12>.inventory.json` | writes `ui/contracts/releases/ui-<12>.graph.json` beside the inventory; the bind commit (`git add -A`) carries it |
| source suite (`npm test`, CI) | `node --test tests/*.test.mjs` | the contract test; against the newest released inventory of an ancestor when `../ui/contracts/releases` (or `UI_RELEASES_ROOT`) is at hand |

`--no-graph` leaves the graph out of either linkage command. No change to
ui-builder is needed: it already runs both commands and commits what the
inventory step writes.

By hand:

```sh
node scripts/dependency-graph.mjs build --out /tmp/graph.json           # the graph of HEAD
node scripts/dependency-graph.mjs check [--previous <inventory.json>]  # the gates
node scripts/dependency-graph.mjs impact [<unit id> ...]                 # who is hit
UI_DOC_ROOT=../ui-doc node scripts/dependency-graph.mjs impact component.inputs
node scripts/run-browser-probes.mjs <build output> --only <probe>,<probe>
```

The source is read at a git ref (HEAD by default), as linkage reads it; the
contract files below are read from the working tree.

## The graph (`simai.framework.dependency-graph` 1)

Mirai Graph shape: a node is an object, an edge a relation citing its source
file at `revision`.

```jsonc
{
  "schema": "simai.framework.dependency-graph", "schema_version": 1,
  "source": "simai/ui-source", "revision": "<source commit>", "release": "ui-<12>" | null,
  "stats": {"nodes", "edges", "by_type", "by_kind", "missing", "unused", "twins", "twins_diverging", ...},
  "nodes": [{"id": "component.quantity", "type": "component", "version": "1.4.3",
             "declared": true, "source": "<file>", "dir", "tag"?, "family"?, "twin"?,
             "uses": ["<id>"], "used_by": ["<id>"]}],
  "edges": [{"from", "to", "kind", "source", "range"?, "rule"?, "lazy"?, "evidence"?, "via_shared"?}],
  "aliases": [{"from": "cl-inputs", "to": "smart.input", "rule", "since", "remove_after"}],
  "class_roots": {"sf-quantity": "component.quantity"},
  "checks": {"declared_vs_loaded": [...], "twins": [...], "twin_candidates": [...]}
}
```

| Edge kind | Declared in | Meaning |
|---|---|---|
| `depends` | `src/{component,plugin,utility}/*/passport.json` | the passport's `dependencies` |
| `uses` | `src/smart/*/smart.manifest.json` | `composition.uses` |
| `relation` | `src/smart/*/component.json`, `src/component/*/rule.js` | the Loader's relations; rule names resolved to units (`cl-x` → Smart, `x` → component, `x/variant` → utility) through the dated forwards of `src/core/contracts/smart-rule-forwards.v1.json` |
| `loads` | `src/smart/<x>/**/*.js`, with the shared `helpers/` and `field-renderers/` followed | what the code imports, places as `<sf-tag>` or draws as a plain `sf-*` class; `via_shared` when only a shared helper draws it (a branch for another host), and the impact walk skips those |
| `twin` | `contracts/graph/twins.json` | a plain component and its Smart twin; not a use, so not in `uses`/`used_by` |

Nodes are the component, plugin and Smart units, and every unit an edge names
(tokens, core, module, icon set, a utility named by a relation). Versions come
from the passports (linkage's units, so the foundations carry theirs too);
`declared: false` marks a node with no passport or manifest of its own folder.

Plain class ownership (`class_roots`) is read from each plain rule's `regex`
and from sheet selectors that extend a Loader root or name the component's
folder. The `loads` detection is a heuristic (comments stripped, event names and
the element's own part names skipped); each `loads` edge keeps up to three
pieces of evidence.

## C250: declared against drawn

For every Smart component:

- `missing` — drawn directly by its own code, not in `composition.uses`;
- `unused` — in `composition.uses`, never drawn, and not reached through a
  declared Smart part either (`unused_covered_by_parts` lists those that are);
- `missing_via_shared` — drawn only through a shared helper: reported, not gated.

`contracts/graph/dependency-debt.json` holds the mismatches of 2026-11-16 at
ui-source `10145e63b` (108 missing, 8 unused; the study counted 106 at
`5f130e62f`, and `smart.progress-ring` has since drawn `component.avatars` and
`smart.avatar`). The gate reports:

- `graph-new-missing` / `graph-new-unused` — a mismatch that is not debt:
  declare the unit, or stop drawing it;
- `graph-debt-fixed` — a debt entry that is no longer true: remove it in the
  change that fixes it.

Never add a debt entry to pass the gate. `node scripts/dependency-graph.mjs
debt --write` rewrites both debt files from HEAD; it exists for the first record
and for an owner decision to re-baseline, and its diff is read before commit.

## C251: twins

`contracts/graph/twins.json` declares the 42 plain/Smart pairs. The script
suggests pairs by name (`checks.twin_candidates`); a suggestion not declared is
`twin-undeclared`, and a plain component that has no twin despite its name is
declared with `"smart": null` and a reason. A declared pair whose unit is gone is
`twin-stale`.

Divergences, by code:

| Code | Meaning |
|---|---|
| `twin-not-declared` | the Smart twin does not declare the plain component in `composition.uses` |
| `twin-not-drawing` | the Smart twin's code draws no class of the plain component: its markup and look are its own |
| `size-ladder` | the sizes differ (Smart `settings.size.values` against the plain `--size-*` modifiers) |
| `appearance-values` | a Smart appearance has no plain modifier |
| `default-look` | the plain default draws an outline border and the Smart field's default appearance does not |
| `smart-own-sheet` | the Smart twin's own sheet restyles the plain classes (selector count) |

`contracts/graph/twin-debt.json` records the 17 diverging pairs of 2026-11-16
by code. A new code on a pair is `twin-new-divergence`: align the plain twin to
the Smart one (Smart is the default model, C224), or record the owner's decision
in the debt file. A recorded code that is gone is `twin-divergence-fixed`.

**One-sided changes.** Against the previous pair's inventory, a twin whose unit
changed (hash and version moved, or the unit is new) while its twin did not is
`twin-one-sided-change`. Change the other twin in the same pair, or mark the
change intended in `contracts/graph/twin-intent.json`:

```json
{"unit": "component.badges", "version": "1.10.1", "twin": "smart.badge",
 "reason": "the plain dot only; the Smart badge draws its own", "decision": "C###", "date": "2026-11-16"}
```

A mark covers that unit's version alone, so the next change asks again. Any
file change counts as a change: the unit hash covers look and behaviour alike,
and a change that is neither is marked like any other.

## The impact list

For every unit changed since the previous pair (or the ids given to `impact`):
the Smart components and plain components that reach it through `uses`,
`relation`, `depends` and direct `loads` (a walk over `used_by`, shared-helper
branches skipped), its twin, the browser probes named after any of them, and —
with `UI_DOC_ROOT` or a `../ui-doc` checkout — the documentation pages that show
its classes or tags, directly or through an example. The last line is the
command that reruns those probes:

```
  impact component.quantity 1.5.0 (twin smart.input-quantity): 2 Smart, 0 plain, 7 doc pages
    smart: smart.input-quantity smart.form
    pages: /ru/components/forms/quantity/ /ru/smart-components/forms/quantity/ ...
    probes: quantity-limit-focus,quantity-smart
  rerun: node scripts/run-browser-probes.mjs <build output> --only quantity-limit-focus,quantity-smart
```

## Краткое содержание

Граф зависимостей SIMAI Framework (решения C249–C251): строится из паспортов,
`composition.uses`, связей Loader и кода смарт-компонентов при каждой сборке
пары и кладётся рядом с инвентарём (`ui-<12>.graph.json`). Гейт C250 падает на
новом расхождении «заявлено/рисует» и на исправленном, но не убранном долге
(долг на 16.11.2026: 108 + 8). Гейт C251 держит 42 пары «простой ↔ смарт»: новое
расхождение, исправленное расхождение в долге и изменение одного двойника без
другого (или без отметки «намеренно») — красные. Для каждого изменённого блока
печатается список затронутых смарт-компонентов, страниц документации и проб.
