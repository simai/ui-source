# Skeleton

Skeleton temporarily reserves the geometry of content that is expected to
arrive. It is not a progress indicator, an empty state or an error message.

The shapes are decorative and use `aria-hidden="true"`. The host region of the
future content owns `aria-busy="true"` and clears that state when real content,
an empty state or an error replaces the skeleton.

## Anatomy and geometry

- `.sf-skeleton` groups related shapes and owns their spacing and animation.
- `.sf-skeleton-text` is one reserved shape.
- `sf-skeleton-text--size-*` follows the Framework typography scale. A text
  bar is as tall as the capitals of that text, rounded to an even pixel, and
  stands in the middle of one line of that size (1.3.0, owner decision C136):
  8 / 10 / 12 / 14 / 18 / 26 px on text of 12/16, 14/20, 16/24, 20/28, 24/36
  and 36/40 -- at size 1 on a wide screen, a 12px bar in the middle of a 24px
  line (it was the text size, 16px). The value is computed from the step's
  text size (0.727 of it, Inter's capital height), one per step, the same
  rule as the first-paint bars of Smart components; it is not read from the
  face in the browser. Lines follow each other with no gap, as lines of text
  do, so a loading block is as tall as the text it stands for. A host can set
  `--sf-skeleton-text--height` (the text size the bar is derived from) and
  `--sf-skeleton-text--line` (its line) separately.
- Ends: one radius on every text bar, `--sf-radius--ui` (4px; a body bar of
  8px is a full pill), with no variable of the skeleton's own beyond
  `--sf-skeleton-radius`; card and picture shapes take `--sf-radius--surface`
  (C136 (2)).
- `sf-skeleton-icon` makes inline and block size equal for avatar and icon
  placeholders.
- `sf-skeleton-circle`, `sf-skeleton-square` and `sf-skeleton-rounded` select
  the circle, the control radius (`--sf-radius--ui`) and the card radius
  (`--sf-radius--surface`) (owner decision C130 (1)). Given no width and no
  height of their own, they are the square box of their step: the control
  height at `1/3`...`3` (32/40/48/56 px at `1/2`...`3` on a wide screen, the
  box of an `sf-avatar` or an `sf-button` of the same size) and the text line
  at `4`...`7`; below `1/3`, the bar. Such a shape does not stretch its group.
- Steps `1/5`...`1/7` have no line of their own on the text ladder; their bars
  take the line of `1/4`.
- The fill is the neutral fill of the place (`--sf-surface-container`, 12 %
  with C113), given by one core rule shared with the first-paint bars of Smart
  components; `--sf-skeleton-background-color` still sets it.

Use Framework width and height utilities or the constructor's relative widths
and dimension tokens. Match the final content closely enough that replacement
does not shift the surrounding layout.

## Motion

The group accepts `sf-skeleton--animation-pulse`,
`sf-skeleton--animation-wave` or `sf-skeleton--animation-none`. Reduced-motion
preferences stop decorative movement without removing the reserved geometry.
Forced-colors mode keeps the shapes visible using a system color.

## Loading

Skeleton bars are CSS only: a page that uses the classes fetches the skeleton
sheet and no script, because a skeleton is what shows before any code. The
constructor below is fetched when it is called -- the `[!skeleton]` shortcode
or `SF.Loader.ensurePlugin('skeleton')`.

## Constructor compatibility

The existing `Skeleton` constructor keeps `size`, `width`, `height`, `count`,
`animation`, `variant`, `type`, `items` and root attributes. Size, animation,
variant and type are normalized to documented values; count is bounded and
dimensions accept only relative percentages or Framework tokens.
