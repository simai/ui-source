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

The component provides presentation only. Result loading, URL policy, history,
selection state and batch actions belong to the host or to a Smart composition.
