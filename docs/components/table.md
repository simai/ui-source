# Table classes contract

## Component brief

The table classes draw a plain data table with no script: a reference, a
report, a comparison. They are utilities (`src/utility/table*`), loaded by the
RuleLoader when the class appears. Selection, row actions, sorting by a
server, loading and empty states belong to `sf-view-table` (SIMAI Pro), not to
these classes.

| Class | What it does |
| --- | --- |
| `.table` | The table: rows on size 1 of the ladder, the head the same height, lines between rows, the row under the pointer on the hover state layer, a quiet head, the caption under the table in the supporting text. |
| `.table-sm`, `.table-small` | The dense table: rows on size 1/2. |
| `.table-frame` | A wrapper (`<div class="table-frame"><table class="table">`): a bordered, rounded surface that scrolls sideways under a first column that stands still, with gridlines. Docara draws its Markdown tables in it. |
| `.table-stripe`, `.table-stripe-col` | A zebra, only where the author of a wide read-only report wants one: odd rows (even columns) on the lightest state layer. |
| `.table-hover` | Kept for old markup: every `.table` has the row under the pointer now. |
| `.table-active` | A selected (active) row or cell on the select state layer. |
| `.table-border` | Lines between the columns too. |
| `.table-fixed`, `.table-auto` | `table-layout`. |
| `.table-numeric` (inside `.table`) | The number column type: end aligned in the head and the cells, tabular digits, no wrap. |

## The look (owner decision C146)

The table study (2026-11-14) and decision C146 set one table look for the
plain table and `sf-view-table`. What the classes draw:

| C146 | What the classes do |
| --- | --- |
| (1) Row 40, compact 32, two lines 48, the head the same height | A row is a step of the ladder: the step is the cells' least height and the content stands in its middle, so a line of text and a 24 badge keep the row on the step. A name clamped to two lines stands on the two-line rung. |
| (2) A quiet head | The head cells: the row's text, the medium weight, `--sf-on-surface-variant`, no fill of their own, the row's line under them. |
| (3) The number column type | `.table-numeric` on the column's `<th>` and `<td>`s: end aligned, `tabular-nums`, `white-space: nowrap`. The unit goes in the head (`Сумма, ₽`). |
| (4) Lines, hover and selected; zebra by choice | Lines between rows (`--sf-outline-variant`); the row under the pointer on the hover layer; a selected row (`.table-active`) on the select layer, also under the pointer; `.table-stripe` only when the author asks for it. |
| (5) Row actions | Not in the classes: a table with row actions is `sf-view-table`. |
| (6) The sort mark only on the sorted column | The classes draw no sort mark. A table that sorts puts `aria-sort` and the mark on the sorted column's head only (see Sorting). |
| (7) A name up to two lines, then an ellipsis and a tooltip | `.line-clamp-2` around the name in its cell, and the whole name in `title` (below). |
| (8) A table with actions is a grid | Not in the classes: a plain table has no keys of its own. |
| (9) On a phone a plain table scrolls in its frame, the first column still | `.table-frame` scrolls sideways and its first column (head and body) stands still. A table that can be wider than a phone stands in `.table-frame`. |

Badges in cells are tonal (C140): `<sf-badge appearance="tonal" scheme="success" text="Оплачен">`.

```html
<div class="table-frame">
  <table class="table">
    <caption class="sr-only">Orders this week</caption>
    <thead>
      <tr>
        <th scope="col">Order</th>
        <th scope="col">Name</th>
        <th scope="col">Status</th>
        <th scope="col" class="table-numeric">Total, ₽</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>A-101</td>
        <td><span class="line-clamp-2" title="Office paper, 80 g/m², A4, 500 sheets, delivery to the warehouse">Office paper, 80 g/m², A4, 500 sheets, delivery to the warehouse</span></td>
        <td><sf-badge appearance="tonal" scheme="success" text="Paid"></sf-badge></td>
        <td class="table-numeric">1 234 500,00</td>
      </tr>
      <tr class="table-active">
        <td>A-102</td>
        <td>Stapler</td>
        <td><sf-badge appearance="tonal" text="Draft"></sf-badge></td>
        <td class="table-numeric">980,50</td>
      </tr>
    </tbody>
  </table>
</div>
```

### A long name

A name keeps two lines and ends in an ellipsis: wrap it in `.line-clamp-2`
(the line-clamp utility) and give the whole name to `title`, the tooltip a
plain cell can have. The Framework's `data-tooltip` composition describes a
native control (component `tooltip`), so it belongs on a name that is a link
or a button, not on plain cell text. Give the name's column a width
(`max-inline-size` on its cells, or `.table-fixed` with a `<col>` width) so it
wraps at all. Other columns stay one line where the author chooses
(`.wrap-none`, `.truncate`).

## Geometry

Every length is a token of the size ladder or the space system (owner
decision C18); the row's 1 px line is the one length taken off.

| | Row (head and body) | Two lines | Edge inset (first and last cell) | Between two cells |
| --- | --- | --- | --- | --- |
| `.table` | size 1: 40 at 1440, 32 compact, 36 on a phone | the two-line rung, size 2: 48, 40, 44 | `--sf-space-1`: 16, 12 compact and phone (C77) | `--sf-space-1` (C105 H6), half on each cell |
| `.table-sm` | size 1/2: 32, 28, 28 | two lines and the line: 48, 40, 40 | `max(--sf-space-1/2, --sf-b2)`: 12 (C77) | `--sf-space-1/2`, half on each cell |
| `.table-frame` row and head | size 1: 40, 32, 36 | a wrapped reference text keeps the step's padding | `--sf-space-1` with the frame's border inside: 16, 12 | `--sf-space-1` on each cell, a gridline between |

A `.table` row stands on its step: the step's control height is the cells'
least height (`block-size`) and the content stands in the middle of the row
(the row groups' `vertical-align: middle`; a cell's own align utility still
wins). The block padding is what the two-line rung leaves around two lines of
text (`--sf-text-height-1`) and the row's line, halved: none at 1440 and
compact, where two lines fill the rung, 1.5 on a phone. A name clamped to two
lines (`.line-clamp-2`) gives the row's line its pixel, so its row is 48 / 40
/ 44; a text left to wrap freely stands a pixel past the rung at 1440 and
compact (49 / 41). The edge inset is the inset of an `sf-list-item` row of the
same step. The edge rules weigh less than any host's own cell padding
(`:where`), so a frame or a component that sets its cells keeps them;
`sf-view-table` sets its own block padding and takes the inline padding from
here (`--sf-table--row-text-inset` in SIMAI Pro is the cell spacing plus
`--sf-space-1`).

The frame is a reading table (documentation, reports): its cells keep the
padding of a one-line row, the step less a text line and the row's line,
halved (C49), so a wrapped reference text keeps that room above and below,
and its cells start at the top. The frame's public variables
(`--sf-table-frame-head-padding-block`, `--sf-table-frame-cell-padding-block`,
`--sf-table-frame-cell-padding-inline`, `--sf-table-frame-head-background`
and the rest) default to the values above; a page sets them instead of writing
rules.

A bare `.table` is as wide as its columns: on a phone a table with a number
column (which never wraps) can be wider than the screen. Put any table that
can be wider than its place in `.table-frame`; it scrolls there, under its
still first column, and the page does not.

## Accessibility

A data table is a native `<table>`: head cells are `<th scope="col">`, a row's
own head is `<th scope="row">`. Do not give a plain table `role="grid"`; it has
no keys of its own.

### The name: a caption

Every data table has a name, and the name is its `<caption>`, the first child
of the table. The caption is shown under the table in the supporting text.
When the page already shows a heading for the table, keep the caption and hide
it from view with `sr-only`: it stays the table's accessible name, and the
table classes drop the caption's padding for it.

```html
<table class="table">
  <caption>Orders this week</caption>
  …
</table>

<h2 id="users-title">Users</h2>
<table class="table">
  <caption class="sr-only">Users, 240 records</caption>
  …
</table>
```

`aria-labelledby` pointing at the visible heading is the alternative when a
caption cannot be written; do not use both.

### Total rows on a paged or partial table

When the table shows only part of the records (a page, a window of a long
list), tell assistive technology the whole: `aria-rowcount` on the table is the
number of rows of the full table, the head row included, and `aria-rowindex`
on each `<tr>` is that row's place in the full table (the head row is 1).
Leave both out when every row is in the DOM; the browser counts them itself.
`-1` means the total is not known.

```html
<table class="table table-stripe" aria-rowcount="241">
  <caption class="sr-only">Users, 240 records, page 3 of 12</caption>
  <thead>
    <tr aria-rowindex="1"><th scope="col">Name</th><th scope="col">Role</th></tr>
  </thead>
  <tbody>
    <tr aria-rowindex="42"><td>Anna</td><td>Administrator</td></tr>
    <tr aria-rowindex="43"><td>Boris</td><td>Editor</td></tr>
  </tbody>
</table>
```

Say the total in the caption as well when people choose pages: a screen
reader announces the caption with the table, and `aria-rowcount` is read only
by some.

### Sorting

A table whose order the person can change marks the sorted column's head with
`aria-sort` (`ascending` or `descending`; the others carry none) and puts the
sort control, a `<button>`, inside that `<th>`. The classes draw no sort mark;
a page that draws one shows it only on the sorted column (C146 (6)), the
others on hover and focus. `sf-view-table` does this itself.
