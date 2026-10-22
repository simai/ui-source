# Buttons

`buttons` defines the ordinary native action button used by Framework and by
the Smart `sf-button` projection.

## Markup and semantics

- Use a native `<button class="sf-button" type="button">` for an immediate
  action. Use `submit` or `reset` only when that form behaviour is intended.
- Keep a visible, stable action label. An icon-only action belongs to the
  dedicated Icon Button component and needs an accessible name.
- Decorative `.sf-icon` elements use `aria-hidden="true"`.
- A real two-state button combines `active` with `aria-pressed`; visual
  emphasis alone must not invent toggle semantics.

## Public axes

- emphasis: `sf-button--default`, `sf-button--tonal`,
  `sf-button--outline`, `sf-button--link`, `sf-button--surface`;
  `sf-button--ghost` is a compatibility name for `link`;
- scheme: `primary` and `on-surface` for every emphasis; `tonal` also keeps
  `secondary`;
- size: `size-1\/3`, `size-1\/2`, `size-1`, `size-2`, `size-3`;
- density: the default, `spacing-compact`, `spacing-comfortable` or
  `spacing-spacious` (less, more and most inner space). The older
  `tightness-low`, `tightness-high` and `tightness-highest` are the same steps
  under names that read backwards -- `low` is the least space -- and stay as
  compatibility names. Put one density class on a button; the constructor's
  `spacing` option wins over `tightness`, as on the Smart element;
- radius: the normal control radius `--sf-radius--ui`, or the explicit
  `radius-square` and `radius-rounded` overrides.

`radius-default` maps to the large-surface radius and is retained only for
compatibility. It is not a normal button variation.

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
`disabled`, so the same action cannot be triggered twice.

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

The spinner takes the button's disabled ink unless `--sf-loader--color` is set,
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
