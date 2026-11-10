# Buttons

`buttons` defines the ordinary native action button used by Framework and by
the Smart `sf-button` projection.

## Markup and semantics

- Use a native `<button class="sf-button" type="button">` for an immediate
  action. Use `submit` or `reset` only when that form behaviour is intended.
- Keep a visible, stable action label. An icon-only action belongs to the
  dedicated Icon Button component and needs an accessible name.
- Decorative `.sf-icon` elements use `aria-hidden="true"`.
- A toggle -- a button that stays pressed: bold in an editor, a filter, a
  notification switch -- says its state with `aria-pressed="true"` or
  `"false"` and keeps one label («Жирный»). Pressed, it wears the pressed look
  (1.5.0, owner decision 2026-11-07, rule C12) whatever its emphasis or
  scheme: the primary container fill (`--sf-primary-container`), the label
  and the icons in `--sf-on-primary-container`, no visible edge (the border
  keeps its width and is transparent over the fill, so the height of the size
  does not move) and the icons filled (`FILL 1`): two cues, not colour alone,
  the same roles in both themes. Hover and press over it step the container;
  focus draws the ring; disabled wears the disabled look and keeps the filled
  icon. `sf-button--pressed` draws the same look without `aria-pressed`.
  With the Loader's icon subset, give the icon of a pressed toggle
  `sf-icon--filled` too (the Smart button writes `filled` on its `sf-icon`):
  the subset holds the filled glyph only for an icon marked filled.
  `--sf-button-pressed-background-color` and `--sf-button-pressed-color`
  recolour the resting pressed look.
- A toggle whose label changes («В избранное» → «В избранном») does not carry
  `aria-pressed`: the label already says the state, and both at once read
  «В избранном, нажата». Write the class instead:

  ```html
  <button class="sf-button sf-button--outline sf-button--on-surface sf-button--size-1 sf-button--pressed" type="button">
    <i class="sf-icon" aria-hidden="true">star</i>
    <span class="sf-button-text-container">В избранном</span>
  </button>
  ```

  and swap the label and the class together in code. `sf-button` does it with
  `text-pressed`. The `active` class is the momentary press and the current
  item, not a toggle.

## Public axes

- emphasis: `sf-button--default`, `sf-button--tonal`,
  `sf-button--outline`, `sf-button--link`, `sf-button--surface`;
  `sf-button--ghost` is a compatibility name for `link`;
- scheme: `primary`, `on-surface` and `secondary` for every emphasis.
  `default` and `tonal` secondary have a secondary fill of their own;
  `outline`, `surface` and `link` secondary are the on-surface button --
  edge, fill, padding, height, hover, press and disabled -- with the label and
  the icons in `--sf-secondary` (1.4.0, owner decision 2026-11-07; before,
  these three had no rule: no padding, about 32px at size 1 and the browser's
  text colour);
- status: `sf-button--danger` (or `--error`, the same rules) for a
  destructive button, in every emphasis (decision C13); sf-button writes
  both, and calls `--link` the ghost appearance (C15);
- size: `size-1\/3`, `size-1\/2`, `size-1`, `size-2`, `size-3`;
- density: the default, `spacing-compact`, `spacing-comfortable` or
  `spacing-spacious` (less, more and most side space). Density moves the side
  padding only: a button of a size is as tall at every density as at every
  appearance (one height per size, 1.4.0). The older
  `tightness-low`, `tightness-high` and `tightness-highest` are the same steps
  under names that read backwards -- `low` is the least space -- and stay as
  compatibility names. Put one density class on a button; the constructor's
  `spacing` option wins over `tightness`, as on the Smart element;
- height (1.8.0, decision C27): the default, `sf-button--height-low`,
  `sf-button--height-high` or `sf-button--height-highest` -- the size's
  tightness step as the block padding, so the control stands at line height +
  2 x the step (size 1 on desktop 32 / 40 / 48 / 56), and the side padding grows
  by the same step less the default one; the constructor's option is `height`.
  Declared after the density classes: a button that carries both takes its
  sides from the height. The Smart `spacing` is deprecated in favour of it;
- radius: the normal control radius `--sf-radius--ui`, or the explicit
  `radius-square` and `radius-rounded` overrides;
- full width (1.9.0, owner decision C36): `sf-button--full-width` -- the
  control fills its container and its content stays in the middle, as
  sf-segmented's `full-width`; the constructor's option is `fullWidth`.

`radius-default` is the control radius `--sf-radius--ui`, the same as no
radius class; it stays for the Smart `radius="default"` value. The utility
class of that name and the `--sf-radius-default` token were removed on
2026-11-02 (journal `token-radius-default`).

Joined positions `segment-start`, `segment-middle` and `segment-end` square
the corners two neighbours share and draw one line at each join: the end edge
of the segment before it (a segment that follows another has no start edge).
An outline segment among others owns both of its joins, so a selected outline
segment is framed whole.

Five emphases, each in an accent (`primary`) and a neutral (`on-surface`)
scheme:

- `default` — the one action a screen is about;
- `tonal` — an important action beside it: a tinted fill. `tonal primary`
  tints with the primary container role; `tonal secondary` is kept, but the
  secondary palette is close to neutral, so it reads almost like
  `tonal on-surface`;
- `outline` — a secondary action such as Cancel or Back;
- `surface` — an action that needs its own plate on a coloured background or
  an image: a faint fill from the neutral alpha ramp and a hairline boundary,
  the same in both themes;
- `link` — the lightest action, in a table row, a card or next to text: no
  fill until it is hovered.

`ghost` was the transparent member of the quiet pair. At rest it was identical
to `link` and differed only by a fainter hover, so it now reads as `link` and
stays only as a compatibility name; it goes with the next major version.

## States and motion

Native `disabled` is the source of truth for an unavailable action. Loading
uses `loading sf-button-state-loading`, `aria-busy="true"` and native
`disabled`, so the same action cannot be triggered twice. A loading button
keeps its scheme colour (1.9.0, owner decision C36): the disabled look's rules
skip `sf-button-state-loading`, so the fill, the edge and the label are the
resting button's. One that is disabled as well adds the `disabled` class and
wears the disabled look; the constructor does that for `loading` with
`disabled`. Markup with the bare `loading` class and no state class keeps the
disabled look.

A loading button shows the spinner, the Framework's one loading indicator, at
the size of its icon (simai/ui-source#10):

- with an icon, the spinner takes the place of the icon (the start icon, else
  the end one);
- without an icon, the spinner lies over the label: the label keeps its place,
  painted transparent, so the button keeps its width to the pixel and the
  label stays its accessible name. Reserving room beside the label was
  rejected: it would widen every resting button, or change a loading one by
  the icon and its gap;
- an icon-only button shows the spinner in place of its icon.

The spinner takes the label's ink (the disabled ink on a disabled button)
unless `--sf-loader--color` is set,
and under `prefers-reduced-motion` it is a still arc. The constructor draws it;
in hand-written markup put it where the icon was, or before the label with the
`--overlay` class:

```html
<button type="button" class="sf-button sf-button--default sf-button--primary sf-button--size-1 loading sf-button-state-loading" disabled aria-busy="true">
  <span class="sf-loader-container sf-loader--infinite sf-button-spinner sf-button-spinner--overlay" data-infinite="true" aria-hidden="true"></span>
  <span class="sf-button-text-container">Save</span>
</button>
```

The moving stripes are no longer the loading look. `--sf-button-loading-stripe`
is no longer set; a page that sets it still gets still stripes in that colour
until 2026-12-01 (journal `token-button-loading-stripe`).

Pointer activation does not publish a focus ring. Keyboard navigation uses
the shared `:focus-visible` treatment, including a forced-colours fallback.

In forced colours (Windows High Contrast) the system paints every button's
fill the same, so a `default` or `tonal` button draws a one-pixel border in
`ButtonText` (`GrayText` when disabled) and stays distinguishable next to an
`outline` one. The border is inside the control height: the button does not
grow. Probe: `tests/browser/button-forced-colors-edge.browser.mjs`.
