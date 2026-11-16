# Pagination

Pagination navigates a collection divided into numbered pages. Its invariant is
a named navigation landmark containing a one-line list of page destinations or
page actions.

Use links when pages have stable URLs. Use buttons when the host application
owns data loading and reacts to a page action without navigation. Mark exactly
one visible current page with `selected` and `aria-current="page"`.

An omitted range is represented by the static
`.sf-page-number--ellipsis` indicator inside
`.sf-pagination-item--ellipsis`. It is never a button and never receives focus.

The compact square form uses `--sf-radius--ui`; the circle form uses
`--sf-radius-circle`. Geometry, typography, color, motion and focus are driven by
Framework semantic tokens. In RTL only directional arrows reverse. In a
narrow place -- a footer up to the container step h1 (44rem) wide, on a
phone or in a narrow column of a wide page (1.4.4; it read the screen's md
step before) -- secondary labels and omitted-range indicators may be hidden,
but the page controls remain on one line.

The controls of one row are one group of buttons (C105 H5): they stand
`--sf-space-1/3` apart -- 8, 4 in the compact density of a desktop (1.4.5;
outside the compatible footer the row had no gap before and its edge buttons
touched their neighbours). `--sf-pagination-gap` still sets it.

On a phone (below the sm step) the numbers row shows five places, and they fit
its column: a place takes the arrow's side padding there (the step's
tightness), so a two-digit place is as wide as the control is high, square like
the arrows and the plain `sf-page-number` (1.5.2; with the button's own side
padding two arrows and five places needed 350 in the 326 column of a 390
screen, and the row scrolled).

## The row's box

The page row's height is published on `:root`, one value per step of the size
ladder, so a page can hold the room of a list and its pages before either draws
(`sf-view-table` publishes its rows the same way):

    --sf-pagination-block-size-1/2
    --sf-pagination-block-size-1

Each is the step's control height plus the row's padding above and below it and
the line under it — `calc(2 * var(--sf-space-1) + var(--sf-ui-<step>--control-height) + var(--sf-px))`
— computed from the tokens the row is drawn with, never a number typed into a
page. Reserve the row with the variable, not with a measured pixel count: the
sum moves with the size tokens and a page that copied today's number would hold
the wrong room after the next ladder change.

The component provides presentation only. Result loading, URL policy, history,
selection state and batch actions belong to the host or to a Smart composition.
