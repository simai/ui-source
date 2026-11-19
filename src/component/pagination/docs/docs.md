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

A page number draws as the page button of `<sf-pagination appearance="numbers">`
(1.5.0; C224, the plain component looks as its Smart twin): the ghost on-surface
button -- no plate at rest, the button's hover and press fills, words of
`--sf-on-surface` at the medium weight -- and the current page (`selected` or
`aria-current="page"`) the tonal primary button: `--sf-primary-container` with
`--sf-on-primary-container` words and no frame. It was a plate of
`--sf-surface-page` (a white square on a card, C42 (2)) and a framed current
page. A number is square at least and as wide as its number with the button's
side padding (`--sf-ui-1--space-x`, the 1/2 step in `sf-pagination--size-1/2`);
a row that writes `--sf-pagination--digits` (the digits of its widest number)
gives every place that one width. The corner is the button's,
`--sf-radius--ui`. `sf-page-number--circle` is a retired name (owner decision
C237): it draws the square until 2027-01-01 and the Loader notes it in
`SF.deprecations`. Geometry, typography, color, motion and focus are driven by
Framework semantic tokens.

`sf-pagination--size-1/2` sizes the whole row (C103): the numbers and the
arrows written as `sf-icon-button--size-1` take the 1/2 step (32, glyph 20).
The arrows keep the icon button's ink, `--sf-on-surface-icon`, in every row
(C107 (3); the count row forced `--sf-on-surface-variant` before 1.5.0). In RTL only directional arrows reverse. In a
narrow place -- a footer up to the container step h1 (44rem) wide, on a
phone or in a narrow column of a wide page (1.4.4; it read the screen's md
step before) -- secondary labels and omitted-range indicators may be hidden,
but the page controls remain on one line.

The controls of one row are one group of buttons (C105 H5): they stand
`--sf-space-1/3` apart -- 8, 4 in the compact density of a desktop (1.4.5;
outside the compatible footer the row had no gap before and its edge buttons
touched their neighbours). `--sf-pagination-gap` still sets it.

A numbers place is as wide as the widest number with the button's side
padding while the row has room, and shrinks when it has none: a phone's
column or a narrow column of a wide page, the Smart row and a class row of
`sf-page-number` alike (1.5.2; the places could not shrink, so two arrows and
five places needed 350 in the 326 column of a 390 screen, and a class long
range of seven stood 17 past it). A place never shrinks below its own number:
square at least, and as wide as its digits with the label's side padding
(1.6.2; a place counted two digits whatever the row wrote, and «10240» spilled
out of a 48 place of `<sf-pagination>` and of a 40 class place in a narrow
column). The widest number's digits are the row's `--sf-pagination--digits`;
without it a place counts two.

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

The line under the row closes a list that stands on the page (1.7.0). Inside a
place -- a card, a grey plate, a `bg-surface-*` block, a docked drawer, a
popup -- the place's own edge or ground closes the list, so the line is
transparent there: it no longer draws a second rule a pixel above a framed
box's edge or under a list on a pane. The pixel stays, so the row keeps the
height published above. `--sf-pagination-divider-color` (public) colours this
line as well as the Show more row's; a page's own frame that is not a place
sets it to `transparent`:

    .list-box { border: var(--sf-px) solid var(--sf-outline-variant); --sf-pagination-divider-color: transparent; }

The component provides presentation only. Result loading, URL policy, history,
selection state and batch actions belong to the host or to a Smart composition.
