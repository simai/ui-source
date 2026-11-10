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

### What changed with C43 (2026-11-10)

- **Rows with a fill.** A selected, open or current row is not a place: its
  fill is an alpha over the place under it. `--sf-surface-place-solid` is the
  place's colour where the place is solid (initial on a soft coloured place
  and on glass); `--sf-surface-underlay` equals the place colour and is set
  only under a translucent fill. A tonal badge on such a row stacks its tone
  over the underlay, so it keeps its colour. Badges on solid places are
  unchanged.
- **The grey steps are places.** `bg-surface-2`, `bg-surface-3` and
  `bg-surface-4` are the card, raised and popup places in both themes, with
  that place's dim ink. `bg-surface-5` paints nothing and is not a place.
- **Dim ink, dark theme, visibly lighter.** `--sf-on-surface-variant` is
  neutral-70 on the page, an area, a card and a raised block, and neutral-80
  on a popup and a nested popup (was 60 on the page and a card, 70 on a
  raised block and a popup, 80 on a nested popup). Everything that reads it in
  the dark theme is lighter: the main neutral badge, the switch thumb, the
  neutral dot and the close icons among them. On a fill
  (`--sf-on-surface-container-variant`) a popup place reads neutral-90 and a
  nested popup neutral-95 (was 85). Light theme unchanged.
- **Muted is disabled.** `--sf-on-surface-muted` is
  `var(--sf-on-surface-disabled)` and is deprecated
  (`token-c43-muted-is-disabled`, remove after 2027-01-01): it follows the
  place it stands on. A disabled tree item and the offline dot of an avatar
  read the disabled ink.
- **Boundary on the light grey steps.** On `bg-surface-2/3/4` the resting
  boundary `--sf-outline` is opaque neutral-50 in the light theme (3.94, 3.47
  and 3.03 : 1 against the block), so a checkbox, a switch or a field keeps
  3:1. The inside of a control stays the block's colour. Dark unchanged.

## Hue roles: a colour that is not a place

A tag, a label or a coloured note that needs a colour of its own takes a hue
(owner decision C17, 2026-11-08): `.sf-hue-<name>` gives the element one role
set, the same for every hue (`src/core/scss/_sf_css__hue.scss`). `<name>` is
one of the sixteen static hues (red, orange, amber, yellow, lime, green, teal,
cyan, sky, blue, indigo, violet, purple, pink, brown, gray) or the theme's
primary, secondary or tertiary. The hue role utilities (R087 item 1, option A,
2026-11-10) read that set, so a page writes two classes and no inline style:

```html
<span class="sf-hue-teal bg-hue-container color-on-hue-container">Teal note</span>
```

| Class | Reads | Light | Dark |
| --- | --- | --- | --- |
| `bg-hue` | `--sf-hue` | 40 | 80 |
| `bg-hue-container` | `--sf-hue-container` | 50 at 12 % | 50 at 24 % |
| `hover:bg-hue-container` | `--sf-hue-container-hover` | 50 at 16 % | 50 at 28 % |
| `active:bg-hue-container` | `--sf-hue-container-active` | 50 at 20 % | 50 at 32 % |
| `color-hue` | `--sf-hue` | 40 | 80 |
| `color-on-hue` | `--sf-on-hue` | white | 20 |
| `color-on-hue-container` | `--sf-on-hue-container` | 10 | 90 |
| `color-on-hue-container-graphic` | `--sf-on-hue-container-graphic` | 50 | 60 |
| `border-hue-outline` | `--sf-hue-outline` | 50 | 60 |
| `fill-hue-container-graphic` | `--sf-on-hue-container-graphic` | 50 | 60 |

- The pairs are the status roles' pairs: `bg-hue` with `color-on-hue`,
  `bg-hue-container` with `color-on-hue-container`. `color-hue` is coloured
  text on the page or a card, as `color-primary` is; the graphic role is for a
  dot or a glyph.
- The `.sf-hue-<name>` may sit on the element or an ancestor. Without one the
  role is not declared: a background is transparent, a border takes the text
  colour, a text or fill colour is the parent's.
- A hue only paints. It is not a place: what stands on `bg-hue-container`
  keeps the place under it (controls, state layers and lines are not
  re-coloured, as they are on `bg-primary-container`). Places stay the theme's
  seven colours (C16).
- Only the container has pointer-over and pressed steps, as in the role set.
- They succeed the legacy palette classes (`utility-c17-legacy-palette-classes`
  in `contracts/changes/journal.json`): `color-<hue>[-N]` →
  `sf-hue-<hue> color-hue`, `border-<hue>[-N]` → `sf-hue-<hue> border-hue-outline`,
  `bg-<hue>[-N]` → `sf-hue-<hue> bg-hue-container` where the class read a tint
  (tone 70 and lighter) and `sf-hue-<hue> bg-hue` where it read a deeper tone.
  The roles follow the theme, so the successor is the same tone as the legacy
  class only where the numbers happen to meet (light: 34 of 264 items); where
  the exact tone matters, write the static primitive (`var(--sf-red-50)`).
  White and black are not hues and have no successor class.

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
| `on-surface-muted` (C43, value changes) | `on-surface-disabled` |
| component `--sf-<name>-background` | `--sf-<name>-background-color` |

Held, with their own values: `elevation-2--*` and `elevation-5--*` (their
values differ from the step they join; the collapse is a visible change of a
later stage) and the four `shadow--*` theme names (the shadow family is
renamed whole in its own pass).

One former name changes its value: `on-surface-muted` is `var(--sf-on-surface-disabled)`
since C43 (2026-11-10; journal `token-c43-muted-is-disabled`, remove after
2027-01-01). It was neutral-60 / neutral-40, which no place could take back;
it now follows the disabled ink of the place it stands on. It is not in the
C16 list, which holds renames with the same value: every rule that declares
the disabled ink declares it beside it, and
`tests/muted-alias.contract.test.mjs` holds that in the built sheets. Read
`--sf-on-surface-disabled`.

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
