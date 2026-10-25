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

## Compact menu and counters

A row's counter is a `.sf-badge` with `data-count` inside
`.sf-menu-element-wrap`, after `.sf-menu-element-text`; it stands at the row's
end, capped at 99+, hidden at 0, and its phrase ends the row's name. Add
`sf-menu--compact` to the root `sf-menu` for a rail of top-level destinations:
each row shows its icon or avatar alone, its words stay in its name out of
sight, and the counter moves onto the icon's top end corner with the anchored
badge's geometry and ring (step 1). Branches do not open in a compact menu. See
the Badges documentation, section «Бейдж на якоре» (simai/ui-source#12).

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
