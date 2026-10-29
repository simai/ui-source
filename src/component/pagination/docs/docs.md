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
Framework semantic tokens. In RTL only directional arrows reverse. On narrow
screens secondary labels and omitted-range indicators may be hidden, but the
page controls remain on one line.

## The row's box

The page row's height is published on `:root`, one value per step of the size
ladder, so a page can hold the room of a list and its pages before either draws
(`sf-table` publishes its rows the same way):

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
