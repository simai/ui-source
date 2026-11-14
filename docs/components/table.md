# Table classes contract

## Component brief

The table classes draw a plain data table with no script: a reference, a
report, a comparison. They are utilities (`src/utility/table*`), loaded by the
RuleLoader when the class appears. Selection, row actions, sorting by a
server, loading and empty states belong to `sf-view-table` (SIMAI Pro), not to
these classes.

| Class | What it does |
| --- | --- |
| `.table` | The table: cells on size 1 of the ladder, lines between rows, the head bold and start aligned, the caption under the table in the supporting text. |
| `.table-sm`, `.table-small` | The dense table: cells on size 1/2. |
| `.table-frame` | A wrapper (`<div class="table-frame"><table class="table">`): a bordered, rounded surface that scrolls sideways, gridlines and a filled head. Docara draws its Markdown tables in it. |
| `.table-stripe`, `.table-stripe-col` | Odd rows (even columns) on the lightest state layer. |
| `.table-hover` | The row under the pointer on the hover state layer. |
| `.table-active` | An active row or cell on the select state layer. |
| `.table-border` | Lines between the columns too. |
| `.table-fixed`, `.table-auto` | `table-layout`. |
| `.table-numeric` (inside `.table`) | A column of numbers: end aligned, tabular digits. |

## Geometry

Every length is a token of the size ladder or the space system (owner
decision C18); the row's 1 px line is the one length taken off.

| | Row (head and body) | Edge inset (first and last cell) | Between two cells |
| --- | --- | --- | --- |
| `.table` | size 1: 40 at 1440, 32 compact, 36 on a phone | `--sf-space-1`: 16, 12 compact and phone (C77) | `--sf-space-1` (C105 H6), half on each cell |
| `.table-sm` | size 1/2: 32, 28, 28 | `max(--sf-space-1/2, --sf-b2)`: 12 (C77) | `--sf-space-1/2`, half on each cell |
| `.table-frame` body row | size 2: 48, 40, 44 | `--sf-space-1` with the frame's border inside: 16, 12 | `--sf-space-1` on each cell, a gridline between |
| `.table-frame` head | size 3: 56, 48, 52 | as the body | as the body |

A cell's block padding is the step's control height less the line of text
(`--sf-text-height-1`) and the row's line, halved, as a menu row's (C49): a one
line row stands on the step and a longer cell grows the row. The edge inset is
the inset of an `sf-list-item` row of the same step. The edge rules weigh less
than any host's own cell padding (`:where`), so a frame or a component that
sets its cells keeps them; `sf-view-table` sets its own block padding and takes
the inline padding from here.

The frame's public variables (`--sf-table-frame-head-padding-block`,
`--sf-table-frame-cell-padding-block`, `--sf-table-frame-cell-padding-inline`
and the rest) default to the values above; a page sets them instead of
writing rules.

Which heights a table takes and how its head looks are open owner questions
(table study 2026-11-14, `q-height`, `q-head`); the steps above are the steps
nearest to what the classes drew before, not a new look.

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
`sf-view-table` does this itself.
