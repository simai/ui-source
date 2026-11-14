# Spacing roles H1-H6

Part of the SIMAI Framework foundations standard (owner decision C181 (4);
index: [foundation-standard.md](foundation-standard.md)). Every rule names
the owner decision that set it. The numbers are what the built sheets hold;
`tests/foundation-spacing-roles-c181.contract.test.mjs` resolves every row of
the Numbers table against them and checks that the role table of
[foundation-composition-geometry.md](foundation-composition-geometry.md) §5
names the same first token for each role.

## Roles

Every horizontal distance between two parts is one of six roles (C105). Each
role reads an existing token; a token holds its own normal, compact and phone
values, so a component never sets a compact or phone gap of its own.

| Role | Between | Token |
| --- | --- | --- |
| H1 | picture → label inside a control (button, tag, tab, segment) | `--sf-ui-S--text-space-x` |
| H2 | picture → text in a row (list, menu, options, field, notice, cell, tree) | `--sf-space-1/2` |
| H3 | picture → text inside running text (crumbs, link, help mark) | `--sf-space-1/4` |
| H4 | edge → content of a field, list or menu, border inside | `--sf-space-1/2`, `--sf-space-1`, `--sf-space-2` (sizes 1/2, 1, 2) |
| H5 | neighbours: buttons of one group; toolbar buttons, tags, plates; tabs | `--sf-space-1/3`; `--sf-space-1/4`; 0 |
| H6 | between groups and cells; a card's or a window's inset | `--sf-space-1`; `--sf-space-2` |

## Rules

1. A horizontal distance is one of the six roles above, on the role's token;
   a component reads it through its own variable, never through a layout
   utility such as `gap-2` (C105).
2. H1 is the button's own picture-to-label step, per size; tags use the same
   step between their parts (C69, C76).
3. H4: the value of a field, list or menu starts 12 / 16 / 20 from the edge at
   1/2, 1 and 2, the border inside; compact and phone 12; a rounder corner adds
   (corner − 4) / 2 (C77).
4. H5: buttons of one group and rows of actions (a window footer, a
   confirmation, a wizard footer, a page header) stand 8 apart, 4 in compact.
   A toolbar is a dense group: its icon buttons stand 4 apart and its groups are
   split by a separator with 4 on each side (C144).
5. Tabs stand edge to edge, with no gap; a tab's side padding is the padding of
   a button of the same size (C99).
6. H6: the inset of a card, a window and a notice is `--sf-space-2`
   (20 · 16 · 16); the "24" first written for it was a slip, corrected by the
   owner on 2026-11-12 (C105).
7. A scroll area in a panel keeps one inset, `--sf-space-1/4`, on every side of
   its row plates; a scrollbar that takes room is inset + bar + inset (C106).
8. A nested level steps its child in by its first column and the row gap, so
   the child's first column stands under the parent's text; a text-only list
   steps by its H4 (C109).
9. Every prototype and every build acceptance passes the spacing gate
   (ui-control `control/tools/spacing-gate`) before it reaches the owner
   (C144).

## Numbers

`normal` is a desktop page (from 60rem), `compact` a `data-sf-density="compact"`
region on a desktop, `phone` a page below 60rem. Values in px at a 16 px root.

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C105 H1 | `--sf-ui-1/2--text-space-x` | | 7 | 6 | 6 |
| C105 H1 | `--sf-ui-1--text-space-x` | | 8 | 7 | 6 |
| C105 H1 | `--sf-ui-2--text-space-x` | | 10 | 8 | 8 |
| C105 H2 | `--sf-space-1/2` | | 12 | 8 | 8 |
| C105 H3 | `--sf-space-1/4` | | 4 | 4 | 4 |
| C77 H4 | `--sf-space-1` | | 16 | 12 | 12 |
| C77 H4 | `--sf-space-2` | | 20 | 16 | 16 |
| C144 H5 | `--sf-space-1/3` | | 8 | 4 | 8 |
| C144 H5 | `--sf-space-1/4` | | 4 | 4 | 4 |
| C105 H6 | `--sf-space-1` | | 16 | 12 | 12 |
| C105 H6 | `--sf-space-2` | | 20 | 16 | 16 |
| C106 | `--sf-space-1/4` | | 4 | 4 | 4 |

## Pending

On `fix/role-layers-c173` (e035f88b4, on top of `fix/role-tokens-c173`), not
in a released pair: role tokens by name (C173, refining C156; C105's «no new
variable names» is replaced). Each is a reference to a step, never a number of
its own:

- `--sf-gap--actions` (H5 buttons, `--sf-space-1/3`), `--sf-gap--toolbar`
  and `--sf-gap--tags` (`--sf-space-1/4`), `--sf-gap--groups` (H6,
  `--sf-space-1`), `--sf-gap--icon-text` (H2, `--sf-space-1/2`),
  `--sf-gap--icon-inline` (H3, `--sf-space-1/4`);
- `--sf-inset--panel` (`--sf-space-2`), `--sf-inset--plate`
  (`--sf-space-1/4`);
- `--sf-radius--inner` (host corner − inset, never under 4), `--sf-line--border`
  (1), `--sf-line--indicator` (2), `--sf-hit--min` (24), `--sf-hit--touch`
  (44);
- the class `.sf-actions` for a row of buttons;
- checks: `tests/role-tokens.contract.test.mjs`,
  `tests/spacing-roles.contract.test.mjs` and `scripts/check-role-tokens.mjs`
  on that branch.

When it lands, this page's role table takes the role names and the Numbers
table gains a row per role token.

## Known gaps

- On the released pair, [foundation-composition-geometry.md](foundation-composition-geometry.md)
  §5 still gives H6 a card and dialog inset of 24 (`--sf-space-3`); C105 as
  corrected and the card and modal sheets use `--sf-space-2` (20). The branch
  above corrects that page.
- H2, H3, H6 and the nested indent (C109) are not measured by the spacing gate
  yet; H4 is a warning there, not a failure (rule map waiver `spacing-roles`).

## Check

- `tests/foundation-spacing-roles-c181.contract.test.mjs`: the Numbers table
  against the built sheets, the role table against the geometry standard, every
  rule names its decision.
- `tests/horizontal-spacing.contract.test.mjs`: the mechanism of each role in
  the sheets that draw it (C105, C109).
- Acceptance, outside the pair build's unit run: ui-control
  `control/tools/spacing-gate/measure.js` (C105, C144, C69).
