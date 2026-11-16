# Icon Buttons

`icon-buttons` defines a compact native action whose visible content is a
single icon. The native `<button>` owns activation, disabled state, form
behaviour, keyboard focus and the required accessible name. The icon is
decorative and uses `aria-hidden="true"`.

## Public axes

- emphasis: `default`, `tonal`, `outline` and the ghost look, drawn by
  `sf-icon-button--link` (sf-button-icon calls it `ghost`, decision C15);
  `surface` is kept for markup written before and draws as `tonal` does with
  the destructive status;
- scheme: `primary`, `on-surface`, or `on-surface-variant` (written beside
  `on-surface`); `secondary` is kept for older markup;
- status: `sf-icon-button--danger` for a destructive control, in every
  emphasis (decision C13); `sf-icon-button--error` is its former name, the
  same rules, until 2027-01-01 (journal class-c13-control-error-to-danger).
  The danger outline's border is red, the error role at the ink family's 64
  step (1.8.0, owner decision C118, as on the buttons); the other outlines
  keep the shared grey `--sf-outline`;
- on a place with its own ink (1.9.0, inverse places 2026-11-14) -- a strong
  coloured place (`bg-primary` ... `bg-error`, a strong alert bar), the duo
  gradient, glass (`sf-surface-media`) or an inverse place: a filled
  `on-surface` (or `secondary`) icon button is the place's ink with the
  place's accent label as its glyph (`--sf-on-primary`: the place's colour,
  black on glass), not `--sf-on-surface-inverse`, which read 1.29:1 on the
  white, as on `sf-button` (component.buttons 1.14.0); an `outline` or ghost
  danger icon button draws its glyph in the place's ink (red read 1.22-2.05:1
  there), its edge and state fills keep their hue. A card or a popup on such
  a place takes the theme's look back;
- size: `1/3`, `1/2`, `1`, `2`, or `3`;
- density: default, `spacing-compact`, `spacing-comfortable`, or
  `spacing-spacious`; `tightness-low`, `tightness-high` and `tightness-highest`
  are the same steps under older names that read backwards. Density moves
  the side padding only (1.2.0): an icon button of a size is as tall at every
  density, so a compact one is narrower than it is tall and a spacious one
  wider;
- height (1.5.0, decisions C27 and C35): the default,
  `sf-icon-button--height-low`, `sf-icon-button--height-high` or
  `sf-icon-button--height-highest` -- the size's tightness step on all four
  sides, so the button stays square and stands at the size's line + 2 x the
  step (size 1 on desktop 32 / 40 / 48 / 56; compact 28 / 32 / 40 / 48; phone
  28 / 36 / 44 / 52); the icon keeps the size. A close takes the same heights.
  The constructor's option is `height`. Declared after the density classes;
- radius: the normal control radius `--sf-radius--ui`, or explicit
  `radius-square` and `radius-rounded` overrides.

The glyph inside an icon button keeps the bottom alignment (1.9.1, owner
decision C151): an icon in running text sits on the middle of the line, but
inside a button the glyph is the whole content. A button laid out without flex
-- `sf-file-preview`'s actions, class markup without `.flex` -- stays on its
ladder height (28 at size 1/2 compact and on a phone, not 28.55).

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

A link drawn as an icon button, `<a class="sf-icon-button" href>` (what
`sf-button-icon` draws for its `href`, decision C51), takes no link underline,
as `a.sf-button` does; its ink is the icon button's own (1.6.1).

## Name tooltip

A class icon button with an `aria-label` and no visible words shows that name
as the Framework's tooltip by itself (owner decision C248, 1.16.0), as
`<sf-button-icon>` does (C160 (1)): after 0.5 s of hover, its neighbours at
once, keyboard focus at once, a long press on a touch screen, below the
button and flipped above at the bottom edge. Nothing is drawn or fetched
before the first hover, focus or long press; then a `.sf-tooltip` is made
beside the button, linked by `data-tooltip`, and the tooltip controller is
loaded. `data-tooltip="off"` turns it off; a `data-tooltip` naming the page's
own tooltip wins. Left alone as well: a button with a `title` (the browser's
tooltip the page chose -- drop the title to get the Framework's), a close
button (`sf-button-close`, C14), a disabled or hidden button, and the button
inside `<sf-button-icon>`, which shows its own.

```html
<button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1" aria-label="Курсив">
  <i class="sf-icon" aria-hidden="true">format_italic</i>
</button>
```

## States

Native `disabled` is the source of truth for an unavailable action. Loading
uses `loading sf-icon-button-state-loading`, `aria-busy="true"`, and native
`disabled`, preventing duplicate activation. A loading icon button shows the
spinner in place of its icon, at the icon's size (an element with
`sf-loader-container sf-loader--infinite sf-icon-button-spinner`; the
constructor draws it), and a still arc under reduced motion. A loading icon
button keeps its scheme colour (1.5.1, the C36 follow-up): the disabled look's
rules skip `sf-icon-button-state-loading`, so the fill, the edge and the icon
colour are the resting button's, and the spinner takes the icon colour unless
`--sf-loader--color` is set; its background ring is that colour at 16 % (the
fill family of the alpha scale; `--sf-spinner-track-color` wins). A button that
is disabled and loading at once adds `.disabled` and wears the disabled look,
the spinner in the disabled ink; the constructor does that for `loading` with
`disabled`. Markup with the bare `loading` class and no state class keeps the
disabled look. Tonal danger greys when disabled, as every other look does.
`aria-disabled="true"` is disabled for the look as well (1.10.0, owner remark
2026-11-15 on the copy button): the disabled look, no hover or press fill, the
arrow cursor; focus and its ring stay. The stripes are gone;
`--sf-icon-button-loading-stripe` is read until 2026-12-01 (journal
`token-button-loading-stripe`). A two-state action -- bold in an editor's
toolbar, wrap lines in a code block -- keeps one name and says its state with
`aria-pressed`. Pressed, it wears the pressed look (1.3.0, owner decision
2026-11-07, rule C12) whatever its emphasis or scheme: the primary container
fill, the icon in `--sf-on-primary-container` and filled (`FILL 1`) -- two
cues, not colour alone -- and no visible edge (the border keeps its width and
is transparent over the fill, so the height does not move). Hover and press
step the container. A tonal (or surface) toggle (1.6.1, TB-3), whose resting
plate is already a container, takes the container's pressed step when pressed
(`--sf-primary-container-active`, 20 % light / 32 % dark), so the fill differs
from its unpressed plate; hover and press over it lay the surface's state
layer (`--sf-surface-state-hover` / `-active`) on that fill. A neutral
toggle (tonal or surface, on-surface or secondary) rests on the neutral fill,
which the dark theme draws as a light tone, so the pressed container alone
barely differs from it: pressed, it also carries the selected state's layer
(`--sf-surface-state-select`, 8); hover over it takes the press layer (12)
and press adds the hover layer (12 and 4). Focus draws the
ring; disabled wears the disabled look.
`sf-icon-button--pressed` draws the same look without `aria-pressed`, for an
action whose name changes with the state («Добавить в избранное» → «Убрать из
избранного»): its name says the state, so it carries no `aria-pressed`
(`sf-button-icon` does it with `label-pressed`). With the Loader's icon subset,
mark the icon of a pressed toggle `sf-icon--filled` as well: the subset holds
the filled glyph only for an icon marked filled.
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
