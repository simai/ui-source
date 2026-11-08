# Backgrounds: places, names and former names

The background system (C16, owner-approved 2026-11-08; research in ui-control
`control/research/2026-11-08-surfaces.md`). This page covers what the base
layer and the naming pass add (stages S1 and S2). Nothing here changes a
colour a page already draws: the values are the ones the theme had, under
purpose names, and every former name still works.

## Places and what stands on them

A **place** is what a region stands on. Places are opaque; what stands on a
place is translucent -- a fill, a state layer, a line -- so it comes out right
on any place.

| Place | Role | Light | Dark | Former name |
| --- | --- | --- | --- | --- |
| page | `--sf-surface-page` | white | neutral-5 | `--sf-surface-0` |
| area | `--sf-surface-area` | neutral-98 | neutral-10 | `--sf-surface-1` |
| card | `--sf-surface-card` | white | surface-2 | `--sf-elevation-1--surface` |
| popup | `--sf-surface-popup` | white | surface-4 | `--sf-elevation-3--surface` |
| nested popup | `--sf-surface-popup-nested` | white | surface-5 | `--sf-elevation-4--surface` |
| inverse | `--sf-surface-inverse` | neutral-20 | neutral-90 | (unchanged) |

Each place has its dim ink: `--sf-on-surface-card-variant`,
`--sf-on-surface-popup-variant`, `--sf-on-surface-popup-nested-variant`, and
its shadow: `--sf-shadow-card`, `--sf-shadow-popup`, `--sf-shadow-popup-nested`.

**`--sf-surface-place`** is the colour of the place a thing stands on, the
page by default. A cut-out (a badge's ring, a switch's thumb gap, a table
head) reads it instead of the page, so it matches the card or popup it sits
in. The `bg-surface-page/-area/-card/-popup/-popup-nested` utilities declare
it and the place's dim ink; the cards and popups declare it themselves in a
later stage.

Translucent roles on a place: the fill `--sf-surface-container` (16/20/24),
the state layers `--sf-surface-state-hover/-select/-active` (4/8/12), the
stronger fill `--sf-surface-container-strong` (32), the veil
`--sf-surface-veil` (glass under a sticky header), disabled
`--sf-surface-disabled` / `--sf-on-surface-disabled` / `--sf-outline-disabled`.
Each colour has the same family: `--sf-<colour>-state-*`,
`--sf-<colour>-container-strong`, `--sf-<colour>-outline`. Information has its
state layers now (`--sf-info-state-*`, `--sf-info-container-strong`); it had
none.

## Glass over media

`--sf-surface-media` is black at 48 (hover 64, pressed 80:
`--sf-surface-media-hover`, `--sf-surface-media-active`) under
`--sf-on-surface-media` (white), the same in both themes because a picture
does not change with the theme. The class `.sf-surface-media` paints the glass
with a blur (`--sf-blur-large`) and re-declares the roles a control on it
reads from white on the alpha scale: states 4/8/12, fill 16/20/24, line 24,
boundary 64, dim ink 80. An icon keeps its three roles.

Coloured places (a header in the brand colour, a status banner) are held for
the owner's answer: the proposal is that the `bg-<role>` and
`bg-<role>-container` utilities become places rather than a second class
family.

## The alpha scale

Eleven steps, three families: state 4/8/12, fill 12-32, ink 48/64/80. The base
layer adds white 4/12/16/20/64/80 (white had 8 and 24), black 48/64/80 and the
missing information steps (info-50 at 4/8, info-90 at 4/8/12/24); the theme
generator writes the information steps for any theme colour. Two rules hold in
`tests/alpha-scale.contract.test.mjs`: an ink step (48 and above) is a fill
only for glass and the scrim; and the neutral plate starts at 16 because 12 is
the press layer.

The generator (`src/core/js/theme-palette.js`) also gives the greys no more
chroma than the colour they come from (`min(5, source chroma)`): a near-grey
brand colour made teal or violet greys before.

## Names and former names

Scheme: `--sf-<role>[-<variant>][-<state>]`, purpose names. 51 theme roles are
renamed, 20 component variables that set a fill end in `-background-color`
like the other 53, and the background utilities take the new names beside the
old ones. The machine-readable list is
`src/core/contracts/token-aliases.v1.json` (old, new, since, remove_after);
the change journal records it (`token-c16-theme-role-names`,
`token-component-background-color-names`, `utility-c16-background-names`) and
`scripts/sf-upgrade.mjs` rewrites a project from it.

| Former | New |
| --- | --- |
| `surface-0`, `surface-1` | `surface-page`, `surface-area` |
| `elevation-1/3/4--surface` | `surface-card`, `surface-popup`, `surface-popup-nested` |
| `elevation-1/3/4--shadow` | `shadow-card`, `shadow-popup`, `shadow-popup-nested` |
| `on-elevation-1/3/4--variant` | `on-surface-card-variant`, `on-surface-popup-variant`, `on-surface-popup-nested-variant` |
| `on-surface-container--variant` | `on-surface-container-variant` |
| `<c>-transparent-hover/select/active` | `<c>-state-hover/select/active` |
| `<c>-transparent-overlay` | `<c>-container-strong` |
| `surface-overlay` | `surface-veil` |
| `outline-<c>` | `<c>-outline` |
| `disable`, `on-disable`, `outline-disable` | `surface-disabled`, `on-surface-disabled`, `outline-disabled` |
| component `--sf-<name>-background` | `--sf-<name>-background-color` |

Held, with their own values: `elevation-2--*` and `elevation-5--*` (their
values differ from the step they join; the collapse is a visible change of a
later stage) and the four `shadow--*` theme names (the shadow family is
renamed whole in its own pass).

**How the aliases work.** A former name is `var()` of its new name:
`--sf-surface-0: var(--sf-surface-page)`. An alias resolves where it is
declared, so the theme root declares them all, and every rule that
re-declares a renamed role re-declares its alias with it, through one mixin
(`src/core/scss/mix/_mix__role_aliases.scss`, `sf-role-aliases`). Otherwise a
place that set `--sf-surface-state-hover` alone would leave a reader of
`--sf-surface-transparent-hover` inside it on the root's value.
`tests/token-aliases.contract.test.mjs` holds this in the sources and in the
built sheets: a rule that writes a new name writes its alias, and a former
name is written nowhere else.

A renamed component variable is read first under its new name and then
under its former one: `var(--sf-card-background-color,
var(--sf-card-background, var(--sf-surface-0)))`, so a page that sets the
former name draws as before.

Former names are removed on the change journal's sweep day (2027-01-01 by the
lifecycle policy, extendable by 30 days with a named reason), after the
consumers have moved.
