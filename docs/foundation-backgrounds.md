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

Translucent roles on a place: the fill `--sf-surface-container` (12/16/20 since
C113), the state layers `--sf-surface-state-hover/-select/-active` (4/8/12), the
stronger fill `--sf-surface-container-strong` (24 since C41), the veil
`--sf-surface-veil` (glass under a sticky header), disabled
`--sf-surface-disabled` (8 since C113) / `--sf-on-surface-disabled` /
`--sf-outline-disabled`.
Each colour has the same family: `--sf-<colour>-state-*`,
`--sf-<colour>-container-strong`, `--sf-<colour>-outline`. Information has its
state layers now (`--sf-info-state-*`, `--sf-info-container-strong`); it had
none.

### What changed with C113 (2026-11-13)

- **The neutral fill weighs as much as the coloured ones.** The study of tonal
  buttons (`ui-control` research 2026-11-12-tonal-buttons, TB-1, TB-2) found
  the neutral plate at 8 lighter than every coloured container at 12 in the
  light theme (1.10:1 on the page against 1.16-1.19). Two plates weigh the
  same when they differ from the place by the same lightness: grey 50 and
  blue 50 are equally dark, so the neutral takes the fill family's first
  steps, `--sf-surface-container` 12, hover 16, press 20, strong 24. In the
  dark theme the neutral is laid with grey 90, which lightens far more per
  percent than a 50 tone, so "+12 dark" is not applied to it: 12/16/20 there
  too. Every reader moves with the role (badges, tags, tabs, segmented
  controls, fields, menus, tonal buttons; about 60 sheets), and every place
  that writes the roles out (cards, popups, windows, `bg-surface-*`, the
  popover, glass at white 12/16/20). The press state (12) now equals the
  plate; a state is drawn over a plate, not instead of it.
- **The disabled plate is lighter than rest.** `--sf-surface-disabled` is the
  state family's 8 (was 12, heavier than the resting plate at 8), on a strong
  coloured place the place's ink at 8 and on glass white 8.
- The fills stay translucent: on a coloured place a neutral plate takes that
  place's hue.

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
  header. A tonal button there is the place's own-ink fill (12) under the
  place's ink, as `--sf-primary-container` and `--sf-on-primary-container`;
  its hover and press go a step darker in both themes (light: white 8 and
  4, so the white label gains contrast; dark: the place's ink 16 and 20).
- **Places own the accent only on a strong place.** A card, a window, a
  drawer or a popup on a neutral place declares no `--sf-primary` and no
  `--sf-outline-variant`, so a project that re-brands through the roles (on
  `:root` or on `.theme-light, .theme-dark`) keeps its brand inside them. On
  a strong place an opaque place takes back the accent the page had there,
  the project's brand included; on any coloured place (strong, soft, glass)
  it takes back the theme's boundary line, because a coloured place
  re-declares that line on itself and its former value cannot be read below
  it.
- **Set a site colour per theme.** A project that brands through the role
  writes it for both themes, `--sf-primary: light-dark(<light>, <dark>)` on
  `.theme-light, .theme-dark` (or brands the palette tones, which reaches
  every step). One colour on `:root` serves the light theme only: in the dark
  the theme's ink stays tone 20, and a banner button with the brand label
  reads 2.23:1 (`#002f67` under `#c2185b`); a per-theme brand gives 7.67.
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

### The nearest opaque place (2026-11-11)

`--sf-surface-place-ground` is the colour of the nearest opaque place. The
page declares it (`var(--sf-surface-page)`), every solid place declares it with
its solid colour (cards, popups, `bg-surface-*`, `bg-<colour>`, the popover,
the alert-bar levels), and a soft coloured place (`bg-<colour>-container`)
does not, so under a soft place it is the opaque place the soft one stands
on. A cut-out that must not show what is under it lays the place colour over
it: the avatar's status dot is drawn as before over that ground, so on a
soft place it is the soft place's own look, opaque, and the photo no longer
shows through it. On solid places nothing
changes. Glass (`.sf-surface-media`) declares `var(--sf-black)`, the opaque
base of its tone: the dot there is solid dark glass, not the photo.

### What a component reads on a place: three hooks (2026-11-11)

A component that keeps its own value on the page but must follow a place
reads three hooks. The page declares none of them, so
`var(--sf-place--<hook>, <the component's own value>)` is unchanged on the page.

- `--sf-place--ink-variant` is the dim ink on a fill on this place. Every
  place declares it: an opaque place (a card, a popup, `bg-surface-*`) as its
  `--sf-on-surface-container-variant`, a strong place (`bg-<colour>`) as its
  full ink `on-<colour>` (its dim ink 80 over a fill stays under 4.5:1), glass
  as white at 80. The grey plate (`bg-surface-container`) declares it too.
- `--sf-place--ink` is the ink that stands in for a hue: a strong place and
  glass declare their full ink, so coloured text there is one colour; an
  opaque place takes it back (initial).
- `--sf-place--fill-surface` is what a block that would lay the container
  fill lays instead: nothing (`transparent`) on the grey plate, which is the
  fill already, and on a popup in the dark theme, a raised step on which a
  fill took coloured text under 4.5:1. Every other place takes it back.

The code highlight reads all three: its comment, punctuation and line numbers
take `--sf-place--ink-variant`, its text and every hue `--sf-place--ink`, and
the code surface `--sf-place--fill-surface`. On the page it is drawn as before.

### The fill of a row (2026-11-11)

`--sf-surface-place-fill` is the translucent fill a row lays over its place.
The core mix `sf-place-fill($fill)` declares it with `--sf-surface-underlay`
on a selected, open, current or hovered row, `$fill` being the row's
background in that rule. Every place takes it back (initial): the page, every
opaque place through the theme roles it re-declares, the soft and strong
coloured places, glass and the popover (C43 later, 2026-11-12). So it is read
on its own: on a row of any place, a soft one too, it is that row's fill, and a
popup or a place opened from the row does not inherit it.

- **The anchored badge's ring** lays the fill over the place colour, and both
  over the nearest opaque place (`--sf-surface-place-ground`), so on a row the
  ring is the row's own colour, not a halo of the place around the badge
  (C43 D3). Off a row it is the place colour; on a soft place that is the soft
  tone over its ground, the place's own look, and on glass the glass tone over
  black, as under the avatar's status dot.
- **Hovered and open rows** of the list, the dropdown, the context menu, the
  tree, the menu, the admin menu, sf-list and the choice card include the mix
  as their selected rows do (C43 D4): a tonal badge on them keeps its tone,
  where it took the hover's alpha under its own before.
- **Table rows.** The cells of a striped, a hovered and an active row
  (`table-stripe`, `table-stripe-col`, `table-hover`, `table-active`) include
  the mix with the cell's accent (2026-11-12): a tonal badge in such a cell
  keeps its tone and an anchored badge rings with the cell. A cell at rest
  declares nothing, so it is exactly as before.

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
  place it stands on. A disabled tree item reads the disabled ink; the
  offline dot of an avatar read it too until 2026-11-11 and is now the dim
  ink `--sf-on-surface-variant` (the disabled ink was under 3:1 for a status
  mark).
- **Boundary on the light grey steps.** On `bg-surface-2/3/4` the resting
  boundary `--sf-outline` is opaque neutral-50 in the light theme (3.94, 3.47
  and 3.03 : 1 against the block), so a checkbox, a switch or a field keeps
  3:1. The inside of a control stays the block's colour. Dark unchanged.
- **Boundary on a container fill (contrast lows, 2026-11-11).**
  `bg-surface-container` takes the same boundary on a neutral place: opaque
  neutral-50 in the light theme (4.07 : 1 over the page, 3.61 over
  surface-2, 3.20 over surface-3; was 2.90 to 2.44), the theme's in the dark.
  On a coloured place it keeps the place's boundary (the place hands it down
  as `--sf-place--container-outline`; an opaque place takes it back).
- **The accent on bg-surface-4 (contrast lows).** On the children of
  `bg-surface-4`, light theme, the accent moves one step along its own
  ladder: rest reads `--sf-primary-hover`, hover `--sf-primary-active`, and
  press one step beyond, tone 25 (theme: 35 / 30 / 25; press stays a step
  beyond hover, as C16's states do), so a primary label or a text link holds
  4.5 (5.26 : 1; 40 gave 4.39); a text link moves along the link's ladder the
  same way (a visited link, 4.40, has no darker role and stays). Rest and
  hover are read from the roles, so a project's brand stays.
  The step stops at a place: a card, a popup, a popover's content, a soft
  container or a `bg-<colour>` inside `bg-surface-4` takes back the accent
  the step found (`--sf-place--found-*`), so the brand tone there is the
  page's. A step inside a step moves the accent once. Dark unchanged.
- **Hover and press in a container on a strong place (contrast lows).** In
  the light theme a hovered or pressed control in `bg-surface-container` on
  `bg-<colour>` keeps the theme's ink (4.01 / 3.74; the place's white gave
  3.78 / 3.52); the dark half is the place's ink.
- **Hovered and pressed ink on a strong place and glass (contrast lows).**
  `bg-<colour>`, the alert bar's levels and `.sf-surface-media` declare
  `--sf-on-surface-hover` and `--sf-on-surface-active` as their ink; every
  opaque place takes the theme's back. A pressed outline or link button on a
  danger bar read neutral 20 / 80 on red (2.80 light, 1.44 dark).

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
  3:1 a graphic needs (WCAG 1.4.11) and not the 4.5:1 of text (1.4.3). Across
  the sixteen hues, light: 4.46:1 to 4.50:1 on white, 4.26:1 to 4.30:1 on the
  page's surface, 3.59:1 to 3.72:1 on the hue's own plate
  (`bg-hue-container`); dark: 5.40:1 to 5.46:1 on the surface, 4.12:1 to
  4.32:1 on the plate. Text in a hue is `color-on-hue-container` on the plate
  or `color-hue` on the page.
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
reads from white on the alpha scale: states 4/8/12, fill 12/16/20 (C113),
disabled plate 8, line 24, boundary 64, dim ink 80. An icon keeps its four roles (C107): the icon role
`--sf-on-surface-icon` is the glass's ink there, because the alpha scale has no
half step between white and white at 80.

The accent on glass is the glass's own white ink (C70, owner 2026-11-11,
`prototypes/glass-accent.html` variant B), as on a strong coloured place
(C42.4). On the children of `.sf-surface-media`, `--sf-primary` is white
(hover `--sf-neutral-95`, press `--sf-neutral-90`) and `--sf-on-primary` black,
the glass's opaque base; the tonal accent is white 12 under white, its hover
and press going down to 8 and 4 (as on a strong place in the light theme, D2b:
more white under a darkening label lost it). The
link (`--sf-link`, hover and press as the accent; visited white at 80) and the
focus ring (`--sf-focus`, with `--sf-focus--color`, which resolves at the
root) are white too: the theme's blue read 1.16-1.75 under
a primary label on glass in the light theme. An opaque place on glass (a card,
a popup, a popover's content) takes back the accent, the link and the ring the
page had there.

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
only for glass and the scrim; and the neutral fill family is 12/16/20 with the
strong step 24 (C113; 8/12/16 under C41), the plate at the press state's step
and above every other state.

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
