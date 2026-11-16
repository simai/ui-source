# Icons

Part of the SIMAI Framework foundations standard (owner decision C181 (4);
index: [foundation-standard.md](foundation-standard.md)). Every rule names
the owner decision that set it. The numbers are what the built sheets hold;
`tests/foundation-icons-c181.contract.test.mjs` resolves every row of the
Numbers and Colour tables against them.

## Rules

1. An icon in a control is as large as the text line of the control's step:
   24 in a size 1 control on a desktop, 20 in size 1/2 (C01; the full part
   table is [foundation-composition-geometry.md](foundation-composition-geometry.md) §1).
2. `sf-icon` sizes are still the old numbered scale: sizes 1 to 4 are the
   icons of buttons 1/3, 1/2, 1 and 2 and read that button's text line, so they
   come down with it on a phone and in a compact region; sizes 1/4 to 1/2 and
   5 to 7 go one icon step down there. The ladder names of C151 (1) are not on
   the released pair yet (see Pending) (C151, C22).
3. No icon is under 12: the old 10 at size 1/4 became 12 (C132).
4. A neutral icon beside text in a control (button, segment, tab, header tool,
   an icon button without text) takes `--sf-on-surface-icon`, half a step
   paler than its label; a row's icon (list, menu, tree, field, tag, crumbs,
   notice, file row) and the service marks in a field take
   `--sf-on-surface-variant`. On hover and press the icon catches up with its
   label's colour. Chosen and filled parts keep the colour "on" their fill
   (C107).
5. An icon inside a field has no plate in any state: the hint colour at rest,
   the text colour on hover and press, the focus ring around the icon. It is
   as large as the field's leading icon and stands as far from the edge; its
   press area is the field's height and never under 24. From the text to the
   edge: clear, then an action (copy, show password), then the chevron or the
   calendar (C123).
6. The «?» of `sf-help-mark` is an icon, not a button: the same look as a
   field icon, a press area of 24-28, its window has a shadow only (C133, C59).

## Numbers

`normal` is a desktop page (from 60rem), `compact` a `data-sf-density="compact"`
region on a desktop, `phone` a page below 60rem. Values in px at a 16 px root.

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C132 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-1/4` | 12 | 12 | 12 |
| C132 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-1/3` | 12 | 12 | 12 |
| C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-1/2` | 14 | 12 | 12 |
| C01 C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-1` | 16 | 16 | 16 |
| C01 C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-2` | 20 | 16 | 16 |
| C01 C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-3` | 24 | 20 | 20 |
| C01 C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-4` | 28 | 24 | 24 |
| C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-5` | 32 | 28 | 28 |
| C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-6` | 36 | 32 | 32 |
| C22 | `--sf-icon--font-size` | `.sf-icon.sf-icon--size-7` | 40 | 36 | 36 |
| C132 | `--sf-icon-size-1/4` | | 12 | 12 | 12 |

## Colour

| Rule | Token | light | dark |
| --- | --- | --- | --- |
| C107 | `--sf-on-surface-icon` | `--sf-neutral-25` | `--sf-neutral-80` |

## Pending

On `fix/icons-c151` (5fd668dfd), not in a released pair:

- C151 (1): sizes by the host's step in a region with
  `data-sf-icon-scale="ladder"`: 1/3 = 16, 1/2 = 20, 1 = 24, 2 = 28, 3 = 36 on a
  desktop, one step down on a phone and in compact; old numbers until
  2027-01-01.
- C151 (2)-(8): an unknown name leaves an empty place and one console warning;
  directional icons mirror in `dir="rtl"` (`mirror="auto|on|off"`); the font
  axes follow by themselves (optical size from size, weight from the label,
  grade −25 in dark); an icon in text one step above the text, on the line's
  middle; `SF.icons.register(name, svg)`; a meaning → icon table; choice by
  Russian and English words.

## Known gaps

- C151 (1) gives 1 = 24, 1/2 = 20, 1/3 = 16; the released `sf-icon` names
  still mean 1 = 16, 2 = 20, 3 = 24 (Numbers above). The two agree only once
  the ladder names land.
- The «icon row» sizes below 24 (14 at 1/2 and the 18 / 22 glyphs some
  controls draw) wait for the icon-row study (C132 #q-icons).
- C107 asks for at least 3:1 contrast of the icon role on every surface; no
  pair-build check computes it yet (rule map waiver `contrast`).

## Check

- `tests/foundation-icons-c181.contract.test.mjs`: the Numbers and Colour
  tables against the built sheets; every rule names its decision.
- `tests/icon-colour-roles.contract.test.mjs`: every glyph takes one of the
  four colour roles (C107).
- `tests/icons-owner.contract.test.mjs`, `tests/smart-icons-owner.contract.test.mjs`:
  the icon vocabulary and its geometry tokens.
- `tests/field-contract.contract.test.mjs`: field icons and the password
  reveal (C123).
- Browser probes, not in the pair build's unit run:
  `tests/browser/help-mark.browser.mjs` (C133),
  `tests/browser/copy-button-in-field.browser.mjs` (C123).
