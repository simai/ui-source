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
`disabled`, so the same action cannot be triggered twice. Loading colours,
spacing and animation use semantic Framework tokens; motion stops under
`prefers-reduced-motion`.

Pointer activation does not publish a focus ring. Keyboard navigation uses
the shared `:focus-visible` treatment, including a forced-colours fallback.
