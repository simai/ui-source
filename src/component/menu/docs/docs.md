# Menu

Menu is a disclosure navigation list. Wrap it in `nav` with an accessible name
when it represents site or section navigation. Keep native list and link
semantics; do not add `role="menu"` unless implementing the separate application
menu keyboard model.

A branch has one native button with `aria-expanded` and `aria-controls`. In a
column its indicator points right while collapsed and down while expanded,
mirroring the horizontal direction in RTL. In a horizontal row the first level
points down (up while open), and a deeper branch, whose panel opens to the
side, always points toward that side: inline end, or inline start when the
runtime flipped the panel at the screen edge. When a branch title is also a destination, keep
the link and disclosure button as separate siblings inside the row.

`sf-menu`, `sf-menu-item`, `sf-menu-element`, `sf-menu-element-wrap` and
`sf-menu-element-text` form a complete layout without flex utilities. Levels
one through four step in by one `space-1` each; deeper levels draw as the
fourth. A column whose first-level rows carry an icon starts its second level
under the first level's words (icon size plus the wrap gap), so the simple
admin column reads as one text axis. Compact rows use `--sf-radius--ui`,
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
puts the bar on a closed branch that holds it. A disabled disclosure uses a
disabled button and cannot be toggled. Prefer removing unavailable navigation
destinations over presenting a disabled link.

Framework still recognizes existing server markup with a supplied icon button
or `div[role="button"]`. New generated branches use a native button. Context
Menu, Admin Menu and Smart Admin Menu have separate behavior contracts.

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
Where there is no plate, a bar of `--sf-primary`, 3 by 16, stands at the
row's inline start: on a closed branch of a column whose list holds the
current page (found in the markup, or marked `sf-menu-element--holds-current`
when the list is not in the markup). A header row's first level draws no bar.
Rows stand `space-1/4` apart unless `--sf-menu-gap` says otherwise. In forced
colours the current page is framed instead and the bar takes the system's
highlight. Submenus keep their panel and take the same row states.

A navigation tree is up to four levels deep (decision C30, which replaces
the two-level limit of C24). In a horizontal row the first-level section that
holds the current page has a medium label and a `--sf-a2` primary line at its
block end (open question 4 of the C30 study); its open panel draws the bar on
closed branches that hold the current page, as a column does.

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

## Compact menu and counters

A row's counter is a `.sf-badge` with `data-count` inside
`.sf-menu-element-wrap`, after `.sf-menu-element-text`; it stands at the row's
end, capped at 99+, hidden at 0, and its phrase ends the row's name. Add
`sf-menu--compact` to the root `sf-menu` for a rail of top-level destinations:
each row shows its icon or avatar alone, its words stay in its name out of
sight, and the counter moves onto the icon's top end corner with the anchored
badge's geometry and ring (step 1). Branches do not open in a compact menu.
The row that is the current page takes the navigation plate; a row whose
hidden list holds the current page, or one marked
`sf-menu-element--holds-current`, takes the bar beside its icon (C23). See
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
