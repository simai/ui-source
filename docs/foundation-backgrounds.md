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

Translucent roles on a place: the fill `--sf-surface-container` (8/12/16 since
C41), the state layers `--sf-surface-state-hover/-select/-active` (4/8/12), the
stronger fill `--sf-surface-container-strong` (24 since C41), the veil
`--sf-surface-veil` (glass under a sticky header), disabled
`--sf-surface-disabled` / `--sf-on-surface-disabled` / `--sf-outline-disabled`.
Each colour has the same family: `--sf-<colour>-state-*`,
`--sf-<colour>-container-strong`, `--sf-<colour>-outline`. Information has its
state layers now (`--sf-info-state-*`, `--sf-info-container-strong`); it had
none.

### What changed with C41 and C42 (2026-11-10)

- **The neutral fill is lighter (C41).** `--sf-surface-container` is 8, its
  hover 12, its press 16 and `--sf-surface-container-strong` 24, in both
  themes (were 16/20/24/32): light `#f4f4f5`, dark `#202226` on the page, one
  step darker than any place. Glass over media takes white 8/12/16. Every
  place that writes the roles out moves with them (the card, the popups, the
  windows, the `bg-surface-*` places, the popover), and
  `tests/neutral-fill-weight.contract.test.mjs` holds the sources and the
  built sheets to it. The select state is also 8: a state is drawn over a
  plate, and a chosen row is `primary-container`, not grey. The tinted
  containers keep their steps. White 20 and neutral-50/90 at 20 and 32 are
  read by nothing now and stay declared until remove_after.
- **A plate inside a card (C42.1)** is `--sf-surface-container`, with bordered
  fields on it. Nothing in the components changes for it.
- **A card above card level (C42.2).** A card inside a window
  (`.sf-modal-surface`), a drawer over the page, or a popover adds no fill:
  its edge `--sf-outline-variant`, the place's colour, as a card in a card.
- **The segmented thumb (C42.3)** is
  `light-dark(var(--sf-surface-raised), var(--sf-surface-container-active))`
  through `--sf-button-group-plate-background-color`: white with its shadow
  in the light theme, and in the dark lighter than the track. On a strong
  coloured place the place gives the plate: white under the place's colour
  in the light theme, the colour's tone 90 under its ink in the dark, so it
  stays lighter than the track there too.
- **The accent on a strong coloured place (C42.4).** On the children of
  `bg-<colour>` (all seven), `--sf-primary` is the place's ink and
  `--sf-on-primary` the place's colour; hover and press are one and two
  five-tone steps towards the place (95/90 light, 25/30 dark). A filled
  button, a checked checkbox and a switch that is on are white on a blue
  header. A tonal button there is the place's own-ink fill (12/16/20) under
  the place's ink, as `--sf-primary-container` and
  `--sf-on-primary-container`.
- **Places own the accent only on a strong place.** A card, a window, a
  drawer or a popup on a neutral place declares no `--sf-primary` and no
  `--sf-outline-variant`, so a project that re-brands through the roles (on
  `:root` or on `.theme-light, .theme-dark`) keeps its brand inside them. On
  a strong place an opaque place takes back the accent the page had there,
  the project's brand included; on any coloured place (strong, soft, glass)
  it takes back the theme's boundary line, because a coloured place
  re-declares that line on itself and its former value cannot be read below
  it.
- **The surface look of buttons, icon buttons, segments and tags** reads the
  surface roles, not `--sf-alpha-*`: rest 4 is `--sf-surface-state-hover`, 8
  `--sf-surface-state-select`, 12 `--sf-surface-state-active`, 16
  `--sf-surface-container-active`. They follow a coloured place.
- **The filled placeholder** (`sf-input`, `sf-textarea`) is the place's dim
  ink, as the bordered one: dark 70 on the page.
- **One row hover (C42.5):** `--sf-surface-state-select` (8) for the
  navigation menu, a dropdown option, a context-menu item, an interactive
  `sf-list-item` and an `sf-list` row (was 4 in some and 20 in others).
- **Defects from the components audit.** A plain `.sf-list` and an
  `sf-list-item` have no fill of their own; a popup opened from a popup (a
  list in a window, a submenu) paints `--sf-surface-popup-nested` and its dim
  ink; `.table-active` wins over a stripe; the documentation keycap
  stands on the neutral fill; a surface tag rests on
  `--sf-surface-state-hover`.
- **Over moving content or an image (C43.3)**, an alpha layer stacks over the
  solid place colour, `--sf-surface-place`: a sticky column or table head, a
  list's sticky heading, an avatar or badge ring. No new tone.

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
| `border-hue` | `--sf-hue-outline` | 50 | 60 |
| `fill-hue-container-graphic` | `--sf-on-hue-container-graphic` | 50 | 60 |

- The pairs are the status roles' pairs: `bg-hue` with `color-on-hue`,
  `bg-hue-container` with `color-on-hue-container`. `color-hue` is coloured
  text on the page or a card, as `color-primary` is.
- `color-on-hue-container-graphic` and `fill-hue-container-graphic` are for
  graphics, not for text: a dot, an icon, a chart mark, a line. They pass the
  3:1 a graphic needs (WCAG 1.4.11) and not the 4.5:1 of text (1.4.3): tone 50
  on white measures 4.46:1 to 4.50:1 across the sixteen hues and 3.76:1 to
  3.89:1 on its own plate (`bg-hue-container`). Text in a hue is
  `color-on-hue-container` on the plate or `color-hue` on the page.
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
  `sf-hue-<hue> color-hue`, `border-<hue>[-N]` → `sf-hue-<hue> border-hue`,
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
reads from white on the alpha scale: states 4/8/12, fill 8/12/16, line 24,
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
only for glass and the scrim; and the neutral fill family is 8/12/16 with the
strong step 24 (C41), above every state but the press.

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
