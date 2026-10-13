# Menu

Menu is a disclosure navigation list. Wrap it in `nav` with an accessible name
when it represents site or section navigation. Keep native list and link
semantics; do not add `role="menu"` unless implementing the separate application
menu keyboard model.

A branch has one native button with `aria-expanded` and `aria-controls`. Its
indicator points right while collapsed and down while expanded, mirroring the
horizontal direction in RTL. When a branch title is also a destination, keep
the link and disclosure button as separate siblings inside the row.

`sf-menu`, `sf-menu-item`, `sf-menu-element`, `sf-menu-element-wrap` and
`sf-menu-element-text` form a complete layout without flex utilities. Levels
one through four use semantic spacing. Compact rows use `--sf-radius--ui`,
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

Use `aria-current="page"` on the current link. A disabled disclosure uses a
disabled button and cannot be toggled. Prefer removing unavailable navigation
destinations over presenting a disabled link.

Framework still recognizes existing server markup with a supplied icon button
or `div[role="button"]`. New generated branches use a native button. Context
Menu, Admin Menu and Smart Admin Menu have separate behavior contracts.
