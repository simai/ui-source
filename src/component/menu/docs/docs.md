# Menu

Menu is a disclosure navigation list. Wrap it in `nav` with an accessible name
when it represents site or section navigation. Keep native list and link
semantics; do not add `role="menu"` unless implementing the separate application
menu keyboard model.

A branch has one native button with `aria-expanded` and `aria-controls`. In a
column its indicator points right while collapsed and down while expanded,
mirroring the horizontal direction in RTL. In a horizontal row the first level
points down (up while open), and a deeper branch, whose panel opens to the
side, is always › (mirrored in RTL only): the runtime puts the panel on the
side that has room, and the indicator does not turn with it (C30, R059). When a branch title is also a destination, keep
the link and disclosure button as separate siblings inside the row.

`sf-menu`, `sf-menu-item`, `sf-menu-element`, `sf-menu-element-wrap` and
`sf-menu-element-text` form a complete layout without flex utilities. Levels
one through four step in by one `space-1` each; deeper levels draw as the
fourth. A row that carries an icon starts its children under its own words
(icon size plus the wrap gap, `--sf-menu-element-wrap--gap`, `space-1/2` by
default: C105 H2), on every level (C30, C109), so a column with icons reads as
one text axis. Compact rows use `--sf-radius--ui`,
Framework typography and role colors.

Add `sf-menu--horizontal` only to the root `sf-menu` for navigation in a page
header. The first level becomes a single row. Direct submenus open below their
parent, deeper submenus open toward the logical inline end, and all submenu
contents retain the ordinary vertical menu layout. The runtime flips an open
submenu toward the available inline side when it would cross the viewport.

Opening a top-level horizontal branch closes its open sibling. Pointer input,
Enter and Space toggle a disclosure. Escape closes the active branch and
returns focus to its disclosure. A click outside the horizontal menu closes
its open top-level branch. On small screens, render the same navigation data in
a vertical drawer instead of shrinking the horizontal menu into several rows.

Use `aria-current="page"` on the current link. The documentation tree preset
marks it with the navigation plate (C23), leaves an open branch unfilled and
gives a closed branch that holds it a medium label (C30 amended, R065 a).
Every row of the tree stands on the size 1 step -- 40, 32 compact, 36 on a
phone -- whether it is a link, a split row or words: the tree draws the step
inside the words' box (the wrap's padding, `--sf-menu--wrap-padding-block`),
so the link is the whole row. Each level steps one `--sf-space-1` (16;
12 compact and on a phone, C109): the words stand at 16, 32, 48, 64. Every
chevron -- a split row's button and a branch's trailing glyph -- is centred on
a square of the row's step at the row's end, so they stand on one line. A
disabled disclosure uses a
disabled button and cannot be toggled. Prefer removing unavailable navigation
destinations over presenting a disabled link.

Framework still recognizes existing server markup with a supplied icon button
or `div[role="button"]`. New generated branches use a native button. Context
Menu, Admin Menu and Smart Admin Menu have separate behavior contracts.

## The border inside the inset (1.8.1, owner decision C105 H4)

A bordered row (the default look) gives its 1 px border up from its inline
padding, as it already does from its block padding and as the fields' C77
inset does: the icon or the first letters stand 16 from the row's outer edge
(compact and phone 12), not 17 (13). Rows without a border (navigation, the
documentation tree) are unchanged.

## Header navigation

Add `sf-menu--navigation` to the root `sf-menu` for a site's sections as a
header draws them, with or without `sf-menu--horizontal`: rows with no border
and no fill at rest, `--sf-on-surface` words, and the ordinary row's size 1
height, `space-1` side padding, text size 1, `--sf-radius--ui` and focus ring.
A pointer lays the state family of the alpha scale over a row
(`--sf-surface-transparent-hover`, `-active` on press); an open branch is not
filled, its open list shows it is open. The current page (`aria-current="page"`
or `"true"` on the row or on the link inside it; decision C23) is a primary
plate of the fill family, `--sf-primary-container-active` (primary at 20 in
the light theme, 32 in the dark one), with `--sf-on-primary-container` words
and icon and a medium label, and no bar; the pointer does not change it.
Rows stand `space-1/4` apart unless `--sf-menu-gap` says otherwise. In forced
colours the current page is framed instead and the path's line takes the
system's highlight. Submenus keep their panel and take the same row states.

The path to the current page (decision C30 amended 2026-11-09: R065, R072,
R084) has one sign. A row that leads to the current page without being it --
a closed branch of a column whose list holds it (found in the markup, or
marked `sf-menu-element--holds-current` when the list is not in the markup),
every level of the path in a row's panels -- has a medium label. Where the
box it stands in has a border of its own, a 2 px `--sf-primary` line lies on
that border at the row: it covers the border pixel and goes the rest inside,
as tall as the row, its inner corners rounded, clear of the corner's curve on
the box's first and last row. A row's panels always have their border; a
column has one with `sf-menu--bordered` on the root list (a hairline of
`--sf-outline-variant` at `--sf-radius--surface`, the plates `space-1/4` in
from it on every side). A box that scrolls (`sf-menu--scroll`) clips its
border area, so there the line stands one pixel inside. A branch's › stays
neutral: it says only that there is a level under the row. The 3 px bar is
retired everywhere: the compact rail, whose rows are an icon alone, takes the
same line on its start edge (it has no border and no inset), without the
weight. A list whose first row is not at its box's corner (sf-menu with
search and bordered: the frame goes round the head as well) sets
`--sf-menu--radius-block-start: 0`.

A column (`sf-menu--navigation` without `sf-menu--horizontal`; C05, R083)
stands its plates `space-1/4` (`--sf-menu--inset`) in from its edge on both
sides, and the words `space-1/2` (`--sf-menu--row-padding`) in from the
plate; each deeper level is a `space-1` step further. A group heading in a
column is a row's height, the rows' size and weight of type, in
`--sf-on-surface-variant`, its words on the first level's line (R070). When
the column scrolls and its scrollbar takes room, `sf-menu--scrollbar` gives
the scrollbar's own gap back from the end padding, so a plate stands as far
from the thumb as from the start edge (C07). Only the list's own scrolling
gives the gap back: a column that scrolls as a whole (sf-menu `sticky`) or
inside a page's scroller keeps the full inset, and the scrollbar stands
outside it. A row's link that leaves the
site may end with `.sf-icon.sf-menu-element-external` (↗, the half step's
icon in `--sf-on-surface-variant`). The words a search matched are drawn by
`::highlight(sf-menu-match)` with `--sf-mark`.

A navigation tree is up to four levels deep (decision C30, which replaces
the two-level limit of C24). In a horizontal navigation row (C30, R057-R060):

- the first-level section that is the current page or holds it has a medium
  label and a 2 px `--sf-primary` line under the whole control, lying on the
  header's bottom border as the tabs' indicator does (the line sits
  `--sf-site-header--edge` below the item, which `sf-header-site` publishes;
  0 elsewhere); with `sf-menu--indicator-fill` on the root it takes the C23
  plate instead, for a header with no bottom border;
- an open branch, on the first level and in a panel, has the neutral
  `--sf-surface-transparent-select` plate, never primary;
- in a panel, every row on the path to the current page has a medium label
  and the 2 px line on the panel's start border; the › stays neutral.

A section that is a page and has subsections is a split row: the link and
a native button beside it (`aria-expanded`, `aria-controls`, named
«<section>: подразделы»); under a coarse pointer the button is a whole
control wide. Under a fine pointer the button keeps the row's height (the
whole height of the row at the chevron presses it), and its plate -- hover,
press and focus ring -- is a square of the row's step, centred on the row:
40 x 40 for a size 1 row, 32 x 32 compact, the row's own height for a row
shorter than its step (R219). The glyph stays over the plain branches'
glyphs; the square takes the row's end padding and the gap before the link,
so the row's layout does not move.

A row's icon, branch indicator and counter sit inside the row's line height:
the icon and the split-row disclosure take `--sf-menu-element--line-height`,
the counter overhangs the line by negative block margins, so a compact row
with a counter is the compact control height (32 on the desktop), not the
badge's 24 plus padding.

A first-level item may carry a wide region instead of a panel:
`.sf-menu-region` (role `group`, hidden while closed) spans the header under
the row. `.sf-menu-region-columns` lays `.sf-menu-region-column`s on a grid;
a column has a `.sf-menu-region-head` link, a `.sf-menu-region-list` of
links (`.sf-menu-region-link`, `--small` for third-level text) and the region
may end with a `.sf-menu-region-foot` row. Smart Menu draws it from a
`<template slot="region-<name>">` or from the item's children.

```html
<nav aria-label="Sections">
  <ul class="sf-menu sf-menu--horizontal sf-menu--navigation">
    <li class="sf-menu-item"><a class="sf-menu-element sf-menu-element--level-1" href="/" aria-current="page"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Home</span></span></a></li>
    <li class="sf-menu-item"><a class="sf-menu-element sf-menu-element--level-1" href="/start/"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Quick start</span></span></a></li>
  </ul>
</nav>
```

## Rail and counters

A row's counter is a `.sf-badge` with `data-count` inside
`.sf-menu-element-wrap`, after `.sf-menu-element-text`; it stands at the row's
end, capped at 99+, hidden at 0, and its phrase ends the row's name. Add
`sf-menu--rail` to the root `sf-menu` for a rail of top-level destinations:
each row shows its icon or avatar alone, its words stay in its name out of
sight, and the counter moves onto the icon's top end corner with the anchored
badge's geometry and ring (step 1). Branches do not open in the rail.
`sf-menu--compact`, the rail's former class, draws the same until 2027-01-01:
the word compact means density only (`data-sf-density`, owner decision C134).
The row that is the current page takes the navigation plate; a row whose
hidden list holds the current page, or one marked
`sf-menu-element--holds-current`, takes the path's 2 px line on the rail's
start edge, as tall as the row (C30 amended). See
the Badges documentation, section «Бейдж на якоре» (simai/ui-source#12).

## Groups

A group is styling only: a heading over a list of first-level rows, the markup
`sf-menu` draws for a group of its data. It is not a branch: its rows keep the
first level, the heading is not a row, and the runtime draws no disclosure for
it. Write a group as

```html
<nav aria-label="Sections">
  <ul class="sf-menu">
    <li class="sf-menu-item sf-menu-item--group" data-sf-menu-group>
      <span class="sf-menu-group-heading" id="site-heading"><span class="sf-menu-group-label">Site</span></span>
      <ul class="sf-menu" aria-labelledby="site-heading">
        <li class="sf-menu-item"><a class="sf-menu-element" href="#address"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Address</span></span></a></li>
        <li class="sf-menu-item"><a class="sf-menu-element" href="#code"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Code</span></span></a></li>
      </ul>
    </li>
  </ul>
</nav>
```

The runtime recognises a group by `sf-menu-item--group`, `data-sf-menu-group`
or a direct `.sf-menu-group-heading`, and keeps it open. A collapsible group
has a `button.sf-menu-group-heading` (with `aria-expanded`, and a trailing
`.sf-icon` the runtime turns between `keyboard_arrow_up` and
`keyboard_arrow_down`); the runtime gives it `aria-controls`, hides the list
while it is closed, and the button opens and closes it with a pointer, Enter
or Space. A group writes `open` on the item, or `aria-expanded="true"` on its
button, to start open. Before 1.2.1 the runtime took a hand-written group for
a branch and nested it.

## Smart Menu and public variables

`sf-menu` (src/smart/menu) builds this markup from data or from a nested list
of links and keeps its state itself; it marks what it draws with
`data-sf-menu-owned`, and this runtime leaves that markup alone. The menu
offers nine public variables (src/core/contracts/public-variables.v1.json),
each wrapping the value it drew before: `--sf-menu-background-color`,
`--sf-menu-gap`, `--sf-menu-item-color`, `--sf-menu-item-background-color`,
`--sf-menu-item-border-color`, `--sf-menu-item-radius`,
`--sf-menu-submenu-background-color`, `--sf-menu-submenu-border-color` and
`--sf-menu-submenu-radius`. Hover, an open branch, focus and disabled keep
their own.
