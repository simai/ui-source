# Icon Buttons

`icon-buttons` defines a compact native action whose visible content is a
single icon. The native `<button>` owns activation, disabled state, form
behaviour, keyboard focus and the required accessible name. The icon is
decorative and uses `aria-hidden="true"`.

## Public axes

- emphasis: `default`, `tonal`, `outline`, `link`, or `surface`; `ghost` is a
  compatibility name for `link`;
- scheme: `primary`, `secondary`, or `on-surface` only in combinations backed
  by component styles;
- size: `1/3`, `1/2`, `1`, `2`, or `3`;
- density: default, `spacing-compact`, `spacing-comfortable`, or
  `spacing-spacious`; `tightness-low`, `tightness-high` and `tightness-highest`
  are the same steps under older names that read backwards;
- radius: the normal control radius `--sf-radius--ui`, or explicit
  `radius-square` and `radius-rounded` overrides.

`surface` takes its colour from the neutral alpha ramp instead of a scheme, so a
toolbar or a row action reads the same on any background and in both themes: a
faint fill and a hairline boundary. `tonal primary` tints with the primary
container role, as on the button. `ghost` was identical to `link` at rest and
differed only by a fainter hover, so it now reads as `link`.

`radius-default` maps to the large-surface radius and remains a compatibility
input only. It is not a normal Icon Button variation. Joined positions
`segment-start`, `segment-middle`, and `segment-end` belong to Button Group
composition and use an inset keyboard focus ring.

## States

Native `disabled` is the source of truth for an unavailable action. Loading
uses `loading sf-icon-button-state-loading`, `aria-busy="true"`, and native
`disabled`, preventing duplicate activation. A loading icon button shows the
spinner in place of its icon, at the icon's size (an element with
`sf-loader-container sf-loader--infinite sf-icon-button-spinner`; the
constructor draws it), in the disabled ink unless `--sf-loader--color` is set,
and a still arc under reduced motion. The stripes are gone;
`--sf-icon-button-loading-stripe` is read until 2026-12-01 (journal
`token-button-loading-stripe`). A real two-state action combines
`active` with `aria-pressed`; a colour change alone does not create toggle
semantics.

Pointer activation does not show a focus ring. Keyboard navigation uses
`:focus-visible`, including forced-colours fallback. Constructor-created
buttons default to `type="button"` so they do not submit a surrounding form by
accident.

Smart owner: `sf-icon-button`. The `icon` variant composes Smart Icons; the
`close` variant composes the decorative Smart Close glyph. Both retain one
native button as the action and focus owner.
