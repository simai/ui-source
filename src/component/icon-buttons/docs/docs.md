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
  are the same steps under older names that read backwards. Density moves
  the side padding only (1.2.0): an icon button of a size is as tall at every
  density, so a compact one is narrower than it is tall and a spacious one
  wider;
- radius: the normal control radius `--sf-radius--ui`, or explicit
  `radius-square` and `radius-rounded` overrides.

`surface` takes its colour from the neutral alpha ramp instead of a scheme, so a
toolbar or a row action reads the same on any background and in both themes: a
faint fill and a hairline boundary. `tonal primary` tints with the primary
container role, as on the button. `ghost` was identical to `link` at rest and
differed only by a fainter hover, so it now reads as `link`.

`radius-default` is the control radius `--sf-radius--ui`, the same as no
radius class; it stays for the Smart `radius="default"` value. The utility
class of that name and the `--sf-radius-default` token were removed on
2026-11-02 (journal `token-radius-default`). Joined positions
`segment-start`, `segment-middle`, and `segment-end` belong to Button Group
composition and use an inset keyboard focus ring. A join is one line, the end
edge of the segment before it, as on the button.

## States

Native `disabled` is the source of truth for an unavailable action. Loading
uses `loading sf-icon-button-state-loading`, `aria-busy="true"`, and native
`disabled`, preventing duplicate activation. A loading icon button shows the
spinner in place of its icon, at the icon's size (an element with
`sf-loader-container sf-loader--infinite sf-icon-button-spinner`; the
constructor draws it), in the disabled ink unless `--sf-loader--color` is set,
and a still arc under reduced motion. The stripes are gone;
`--sf-icon-button-loading-stripe` is read until 2026-12-01 (journal
`token-button-loading-stripe`). A two-state action -- bold in an editor's
toolbar, wrap lines in a code block -- keeps one name and says its state with
`aria-pressed`. Pressed, it wears the pressed look (1.3.0, owner decision
2026-11-07, rule C12) whatever its emphasis or scheme: the primary container
fill, the icon in `--sf-on-primary-container` and filled (`FILL 1`) -- two
cues, not colour alone -- and no visible edge (the border keeps its width and
is transparent over the fill, so the height does not move). Hover and press
step the container; focus draws the ring; disabled wears the disabled look.
`sf-icon-button--pressed` draws the same look without `aria-pressed`, for an
action whose name changes with the state («Добавить в избранное» → «Убрать из
избранного»): its name says the state, so it carries no `aria-pressed`
(`sf-button-icon` does it with `label-pressed`).
`--sf-icon-button-pressed-background-color` and
`--sf-icon-button-pressed-color` recolour the resting pressed look.

Pointer activation does not show a focus ring. Keyboard navigation uses
`:focus-visible`, including forced-colours fallback. Constructor-created
buttons default to `type="button"` so they do not submit a surrounding form by
accident.

Smart owner: `sf-icon-button`. The `icon` variant composes Smart Icons; the
`close` variant composes the decorative Smart Close glyph. Both retain one
native button as the action and focus owner.

## Count and dot

A count or a dot inside the button -- `<span class="sf-badge
sf-badge--anchored" data-count="3"></span>` after the icon -- sits at the top
end corner of the button, on its radius (the 45-degree point of a rounded or
round button, the corner of a square one), sized by the button's size; sizes
1/3 and 1/2 carry a dot only. The count joins the button's `aria-label`:
«Уведомления, 3 непрочитанных». See the Badges documentation, section «Бейдж на
якоре» (simai/ui-source#12).
