# Tabs

The ordinary component uses `.sf-tabs`, an owned `.sf-tabs-top` containing
controls, and matching `.sf-tabs-main-tab` panels in DOM order. Text and icon
buttons may coexist. Use native `button type="button"`; icon-only tabs need an
author-provided accessible name. Name the header with `aria-label` or
`aria-labelledby`.

Keep the header structure `.sf-tabs > .sf-tabs-top-container > .sf-tabs-top`;
the `.sf-tabs-main-container` is its sibling. Skin selectors target that owned
header, so a nested Tabs inside a panel keeps its own skin. Do not place another
interactive Tabs inside a tab control. The Smart template uses the same shape.

Prefer short labels. Horizontal lists scroll locally when labels do not fit;
controls are not squeezed into columns of individual characters. A default
control wider than the list may wrap its long label without clipping. Full
controls share available space while keeping a content-based minimum width.
Containers can shrink inside flex/grid layouts while icons keep their size.
Wrapping/scrolling does not change keyboard navigation semantics.

The header is the tablist; panels are outside that role. The runtime assigns tab
and panel relationships, preserves unique author IDs and allocates missing IDs.
Generated `sf-tabs-tab-*`, `sf-tabs-panel-*` and `sf-tabs-label-*` IDs are reserved;
duplicates copied with a generated block receive fresh IDs on initialization.
Authors remain responsible for unique IDs they supply themselves.

Left/Right select and focus enabled tabs, mirrored in RTL. Vertical lists use
Up/Down. Home/End reach enabled endpoints; arrows wrap and skip disabled items.
Tab enters at the active enabled tab and then reaches the active panel. Native
Enter/Space retain the native button click event. Panel inputs and nested Tabs
are not controlled by an outer Tabs list.

`SF.Tabs.init(container)` is idempotent and refreshes markup. Added blocks and
structural changes, disabled/aria-disabled and active-index changes synchronize
automatically. The document observer does not retain detached roots; watched
state writes are idempotent and do not create a mutation loop. If an application changes author IDs/label relationships,
call init again to refresh the generated links. Match control/panel counts.

`SF.Tabs.activate(root,index)` selects without stealing focus; existing initial
index aliases remain supported. An explicitly selected disabled panel remains
selected, but the list entry point is an enabled tab (or absent if all disabled).
Prefer an enabled initial selection. Native disabled/aria-disabled are preferred
to the legacy styling-only `.disabled` class for accessible state announcements.

Ordinary runtime skips built-in Smart roots. Smart Tabs use their host.goTo()
method. Ordinary instances restrict control and panel queries to their own root.

Tabs controls use `--sf-radius--ui`; pills remain explicitly rounded. Borders
use `--sf-tabs--border-width` with `--sf-px` fallback, including the double-width
underline and its alignment offset. Vertical spacing uses `--sf-tabs--gap` with
`--sf-space-2` fallback. Typography comes from the base button profile and the
surrounding text for panels; Tabs does not introduce another text-size scale.

Keyboard focus is an inset ring whose foreground role follows the tab's painted
surface: on-primary for selected/filled primary, on-surface for underline and
transparent controls, and the matching foreground for other base button pairs.
Its width uses --sf-focus-outline-width; an optional --sf-tabs--focus-color
override lets authors supply a semantic role for a custom surface. Recheck
contrast after customization. Do not reuse the translucent external focus halo
inside a filled control. Pointer focus does not paint the keyboard ring;
forced-colors mode uses an inset system outline. Focus must not erase selected
fill while keeping selected foreground, including outline/link icon buttons.

Smart custom tab descriptors keep the owned wrapper as the single named tab and
keyboard-focus target; their rendered visual is inert. Arbitrary external
templates and author-defined wrappers still require separate assistive-
technology acceptance.
