# Sizes and the size ladder

Part of the SIMAI Framework foundations standard (owner decision C181 (4);
index: [foundation-standard.md](foundation-standard.md)). Every rule names
the owner decision that set it. The numbers are what the built sheets hold;
`tests/foundation-size-ladder-c181.contract.test.mjs` reads the Numbers table
below and resolves every row against them, so this page and the tokens cannot
drift apart.

## Rules

1. Every component size is a step of one ladder: 1/3, 1/2, 1, 2, 3. A step
   fixes the text, the line, the control height, the icon and the padding
   together. Parts of one size are one height whatever their look (filled,
   tonal, outlined); a border is drawn inside the height, never added to it
   (C01).
2. Every length comes from the size scale (`--sf-a0` ... `--sf-i9`, 1 px steps
   up to 20, then 2, 4, 8 ... px) or from a token built on it. Nothing is
   invented "by eye" (C18).
3. A control's height is its text line plus twice its block padding. The
   `height` setting (`low`, `default`, `high`, `highest`) picks the padding,
   not the size; the side padding grows with it. `spacing` is the old name and
   works as before, with a warning, until 2027-01-01 (C27).
4. `data-sf-density="compact"` on `<html>` or on any container moves every
   component inside one step down: height, padding, gaps, icon and text
   together. Products choose it; admin screens are compact, docs and sites are
   normal (C22).
5. An explicit `size` is a step of its region's ladder and moves down with a
   compact region too; `data-sf-density="normal"` on an element or a container
   is the one way back (C79).
6. Density does not change headings: h1-h6 and the titles of a page, an empty
   state, a drawer, a card and a window keep their ladder (C44).
7. Below 60rem the phone ladder applies. It is already the dense one, so
   compact changes nothing there and touch targets stay (C22, C36).
8. One row, one step: a label, its value and a button beside them stand on one
   step (text 1/2 with a `size="1/2"` button, text 1 with `size="1"`). A
   smaller label stands only above its value (C103).
9. Marks below 24 take one of five small steps, 4, 6, 8, 12, 16, the same on a
   desktop, a phone and in a compact region. Nothing is drawn below 4; 4 is for
   ticks and separators only, a coloured mark is never under 6. The author sets
   the host's size; the mark follows one table in core
   (`src/core/scss/vars/_sf_var__size.scss`, internal `--sf-micro--*`) (C132).
10. A card title line is 24 on a desktop and 20 on a phone; compact keeps it
    (C89).
11. A spinner fits the icon field of its step, not the square: inside a 24 icon
    the ring is 20 (C11).
12. A width that holds text is a step of the width ladder in characters,
    `--sf-measure-20`, `-28`, `-36`, `-44`, `-52`, `-64`, `-80`, `-96`: one
    character is half the body text size (`--sf-measure--char`), a step N of
    them. At text 16 every step is a point of the base ladder; compact density,
    a phone and the browser's font size move it with the text, so a line keeps
    its characters. A role takes the nearest step, a tie the wider one; no text
    container's width reads `--sf-g*` or `--sf-h*` (C396).

## Numbers

`normal` is a desktop page (from 60rem), `compact` a `data-sf-density="compact"`
region on a desktop, `phone` a page below 60rem. Values in px at a 16 px root.
Below 60rem a compact region draws the `compact` column for a fine pointer (a
mouse) on a page in the desktop layout (from 600 px, core's `data-sf-layout`),
and the `phone` column for touch or a phone-width page (C435, clarifying
C146 (1)): a 768 window with a mouse draws compact rows at 32, a tablet in the
hand keeps 36 and its 44 touch rows.
`On` names the element when the token is set on a component class.

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C01 | `--sf-text-size-1/3` | | 12 | 12 | 12 |
| C01 | `--sf-text-height-1/3` | | 16 | 16 | 16 |
| C01 C27 | `--sf-ui-1/3--control-height` | | 28 | 24 | 24 |
| C01 | `--sf-text-size-1/2` | | 14 | 12 | 12 |
| C01 | `--sf-text-height-1/2` | | 20 | 16 | 16 |
| C01 | `--sf-ui-1/2--control-height` | | 32 | 28 | 28 |
| C01 | `--sf-text-size-1` | | 16 | 14 | 14 |
| C01 | `--sf-text-height-1` | | 24 | 20 | 20 |
| C01 C22 | `--sf-ui-1--control-height` | | 40 | 32 | 36 |
| C01 | `--sf-text-size-2` | | 20 | 16 | 16 |
| C01 | `--sf-text-height-2` | | 28 | 24 | 24 |
| C01 C22 | `--sf-ui-2--control-height` | | 48 | 40 | 44 |
| C01 | `--sf-text-size-3` | | 24 | 20 | 18 |
| C01 | `--sf-text-height-3` | | 36 | 28 | 24 |
| C01 C22 | `--sf-ui-3--control-height` | | 56 | 48 | 52 |
| C27 | `calc(var(--sf-text-height-1/3) + 2 * var(--sf-ui-1/3--space-y-tightness-low))` | | 24 | 24 | 20 |
| C27 | `calc(var(--sf-text-height-1/3) + 2 * var(--sf-ui-1/3--space-y-tightness-high))` | | 32 | 28 | 28 |
| C27 | `calc(var(--sf-text-height-1/3) + 2 * var(--sf-ui-1/3--space-y-tightness-highest))` | | 40 | 32 | 36 |
| C27 | `calc(var(--sf-text-height-1) + 2 * var(--sf-ui-1--space-y-tightness-low))` | | 32 | 28 | 28 |
| C27 | `calc(var(--sf-text-height-1) + 2 * var(--sf-ui-1--space-y-tightness-high))` | | 48 | 40 | 44 |
| C27 | `calc(var(--sf-text-height-1) + 2 * var(--sf-ui-1--space-y-tightness-highest))` | | 56 | 48 | 52 |
| C27 | `--sf-ui-1/2--space-x` | | 14 | 12 | 12 |
| C27 | `--sf-ui-1--space-x` | | 16 | 14 | 14 |
| C27 | `--sf-ui-2--space-x` | | 20 | 16 | 18 |
| C132 | `--sf-micro--point-1/4` | | 6 | 6 | 6 |
| C132 | `--sf-micro--point-1/2` | | 8 | 8 | 8 |
| C132 | `--sf-micro--point-1` | | 12 | 12 | 12 |
| C132 | `--sf-micro--point-3` | | 16 | 16 | 16 |
| C132 | `--sf-micro--count-1` | | 16 | 16 | 16 |
| C132 | `--sf-micro--count-3` | | 16 | 16 | 16 |
| C132 | `--sf-micro--dot-1/3` | | 6 | 6 | 6 |
| C132 | `--sf-micro--dot-1` | | 8 | 8 | 8 |
| C132 | `--sf-micro--dot-3` | | 12 | 12 | 12 |
| C132 | `--sf-micro--cross-1/3` | | 8 | 8 | 8 |
| C132 | `--sf-micro--cross-1` | | 12 | 12 | 12 |
| C132 | `--sf-micro--cross-3` | | 16 | 12 | 12 |
| C132 | `--sf-micro--badge-1/4` | | 8 | 8 | 8 |
| C132 | `--sf-micro--badge-1/2` | | 12 | 12 | 12 |
| C132 | `--sf-micro--badge-2` | | 16 | 16 | 16 |
| C132 | `--sf-micro--ring-1/3` | | 1 | 1 | 1 |
| C132 | `--sf-micro--ring-1/2` | | 2 | 2 | 2 |
| C132 | `--sf-micro--tick` | | 4 | 4 | 4 |
| C89 | `--sf-title--height-card` | | 24 | 24 | 20 |

The full small-step table, the parts that stay outside it, the padding
formula and the multi-line rows are in
[foundation-composition-geometry.md](foundation-composition-geometry.md) §1,
§2 and §4; density in detail in
[foundation-control-spacing.md](foundation-control-spacing.md).

## Widths in characters

The ladder of rule 12 (C396; contract `measure` in
`src/core/contracts/adaptive-sizing.v1.json`, projected to
`src/core/figma_variables/figma_measure.scss`). The width is the container's
outer width; the container subtracts its own insets. Utilities:
`w-measure-N`, `max-w-measure-N`, `min-w-measure-N`.

| Step | Growth | Text 16 | Compact, phone (14) | Browser 125 % (20) | Base ladder point at 16 | What it is for |
| --- | --- | --- | --- | --- | --- | --- |
| `--sf-measure-20` | — | 160 | 140 | 200 | f0 | a menu's narrowest; a short value (date, number, code) |
| `--sf-measure-28` | +8 | 224 | 196 | 280 | f4 | a medium value (name, phone) |
| `--sf-measure-36` | +8 | 288 | 252 | 360 | f8 | a menu's widest |
| `--sf-measure-44` | +8 | 352 | 308 | 440 | g1 | a popup list, panel or form; a tooltip, a help, a tag; drawer 1/2; a long value (path, e-mail, address) |
| `--sf-measure-52` | +8 | 416 | 364 | 520 | g3 | a wide popup form; a question window; the notification area; drawer 1 |
| `--sf-measure-64` | +12 | 512 | 448 | 640 | g6 | drawer 2; a greeting in a chat |
| `--sf-measure-80` | +16 | 640 | 560 | 800 | h0 | a form window; a reading column (`measure`) |
| `--sf-measure-96` | +16 | 768 | 672 | 960 | h2 | a wide window; a bottom sheet's widest; a wide reading column |

Roles on the steps: `--sf-popup-menu-min-width` 20, `--sf-popup-menu-max-width`
36, `--sf-popup-list-max-width`, `--sf-popup-panel-width`,
`--sf-popup-form-width` 44, `--sf-popup-form-wide-width` and
`--sf-popup-question-width` 52, `--sf-popup--window-form-width` 80,
`--sf-popup--window-wide-width` 96; the field widths
`--sf-field--width-short` 20, `-medium` 28, `-long` 44, which a field reads
through its `width="short | medium | long"` setting (sf-input, sf-input-quantity,
sf-input-date, sf-dropdown, sf-input-lookup, sf-input-textarea,
sf-input-country; core class `sf-field--width-<name>`) and the field renderers
through the template parameter `templateParams.width` (WM-4). The former reading
measures `--sf-text--measure`, `-wide`, `-narrow` (65, 80, 45ch) are aliases of
80, 96 and 52 until 2027-01-01; they are contract roles too, so a density
region redeclares them with the steps.

## Known gaps

- C27 `height="low"` at size 1/3 sums to 20 on a phone (16 + 2 × 2), under the
  24 that the density script calls the smallest target (WCAG 2.5.8,
  `scripts/generate-density.mjs`). Not measured on a drawn button yet.
- C79 and C103 are measured by browser probes and by eye at acceptance; C89
  and C103 have no blocking check in the pair build (rule map waivers
  `branch-only`, `row-rung`).

## Check

- `tests/foundation-size-ladder-c181.contract.test.mjs`: the Numbers table
  against the built sheets; every rule names its decision.
- `tests/text-density.contract.test.mjs`: the compact projection is current
  with the ladder files (C22, C27, C44, C79).
- `tests/adaptive-sizing-contract.test.mjs`: the vertical sizing contract
  (C27).
- `tests/measure-c396.contract.test.mjs`: the width ladder in characters, its
  roles and the grep gate on text containers (C396);
  `tests/browser/measure-c396.browser.mjs`: the characters per line at text 16,
  14 and 20 on the built bytes.
- `tests/button-height.contract.test.mjs`, `tests/field-sizes.contract.test.mjs`:
  one height per size (C01).
- `tests/title-line-height.contract.test.mjs`: the card title line (C89).
- Browser probes, not in the pair build's unit run:
  `tests/browser/density-compact.browser.mjs` (C22, C79),
  `tests/browser/button-c36.browser.mjs` (C36),
  `tests/browser/spinner-ring-live-area.browser.mjs` (C11).
