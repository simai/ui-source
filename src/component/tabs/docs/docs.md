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

Two looks (owner decision C96 (1)): the line, which `.sf-tabs` draws without a
look modifier (`.sf-tabs--underline` names it explicitly), and the plate,
`.sf-tabs--pills`; `.sf-tabs--vertical` is the menu column. Before, `.sf-tabs`
without a modifier drew filled primary buttons; that look is gone.
`.sf-tabs--full` is a former name until 2027-01-01: it draws the line with the
tabs sharing the row in equal columns (each at least as wide as its label),
and the Loader notes it in `SF.deprecations`.

Prefer short labels. A horizontal row that does not fit keeps its tabs in
their order up to the first that does not fit, each whole, and puts the rest
in «Ещё (n)» after the row (owner decision C54; since component.tabs 1.4.0 the
class's script does it for class markup as <sf-tabs> does): the selected tab
always stays, nothing scrolls, the arrows go round the tabs in the row. A row
the page wraps (`flex-wrap`, `.sf-tabs--overflow-wrap`) and the vertical look
are left as they are. Controls are not squeezed into columns of individual
characters. Containers can shrink inside flex/grid layouts while icons keep
their size.

A tab lays out its icon and label itself (no `flex items-cross-center` needed
on the button): the selected line lies on the row's line and the icon stands a
control's icon gap from the label. Only the selected label is medium; the
script copies a label of plain words into `data-sf-tabs-text`, and the label
keeps the width of its medium face, so selecting a tab moves no neighbour
(C96 item 3). A row of icon tabs puts its first icon on the row's start edge
and its last on the end, and the selected line is as wide as the icon (C242).

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

In `.sf-tabs--pills` the selected tab is the only filled one: it keeps the
fill every skin gives a selected tab (primary, with on-primary ink), and the
other tabs are text on the surface in `--sf-tabs-color` (on-surface by
default), with no fill and no border whatever the button scheme; the pointer
paints them only with the surface state layer -- 4 % on hover, 8 % with
keyboard focus, 12 % pressed -- in the light and dark themes alike.

Tabs controls use `--sf-radius--ui`; pills remain explicitly rounded. Borders
use `--sf-tabs--border-width` with `--sf-px` fallback, including the double-width
underline and its alignment offset. Underline tabs (owner decision C99) stand
edge to edge (`--sf-tabs-gap`, default `--sf-space-0`); each tab has the button
padding of its size (`--sf-ui-<size>--space-x`, or `--sf-tabs-padding-inline`),
the label none, the first tab none at its start and the last none at its end
(kept in a shared `fit` row), and the selected line is drawn under the label's
letters, not as the tab's border. The row of a `--overflow-more` list is a container
(`sf-tabs-row`): below the h1 step of its own width (44rem, owner decision C181
(2)) two to four tabs share it in the sheet, so a printed row is the row the
script lays; the script marks a narrow row whose tabs keep their own widths
with `data-sf-tabs-own` (`fit="never"`, a row that does not fit). Vertical rows stand `--sf-space-1/4` apart
with `--sf-space-1` padding. A tab's icon stands the button's icon gap from
its label in every look (owner decision C105 H1: `--sf-ui-<size>--text-space-x`,
7 / 8 / 10 at 1440, one step down in compact density, 6 / 6 / 8 on a phone);
in the line and vertical looks it is the tab's `column-gap`, so the label and
its line keep no padding. Plates stand `--sf-space-1/4` apart (C105 H5, as tags
and segments). With errors, «Ещё» puts its badge a quarter step after the
label and the chevron the icon gap after the badge. The panel spacing beside a vertical row uses
`--sf-tabs--gap` with `--sf-space-2` fallback. Typography comes from the base button profile and the
surrounding text for panels; Tabs does not introduce another text-size scale.

Keyboard focus is an inset ring whose foreground role follows the tab's painted
surface: on-primary for selected/filled primary, on-surface for underline and
transparent controls, and the matching foreground for other base button pairs.
Its width uses --sf-focus--width and it stands inside the tab by --sf-focus--inset; an optional --sf-tabs--focus-color
override lets authors supply a semantic role for a custom surface. Recheck
contrast after customization. Do not reuse the translucent external focus halo
inside a filled control. Pointer focus does not paint the keyboard ring;
forced-colors mode uses an inset system outline. Focus must not erase selected
fill while keeping selected foreground, including outline/link icon buttons.

Smart custom tab descriptors keep the owned wrapper as the single named tab and
keyboard-focus target; their rendered visual is inert. Arbitrary external
templates and author-defined wrappers still require separate assistive-
technology acceptance.

A tab's counter written straight in the button, beside its text container
(`<button class="sf-button sf-button--size-1"><span class="sf-button-text-container">События</span><span class="sf-tabs-count">3</span></button>`),
takes the text step of the button's size and the text family (1.5.1, Docara
audit FW-2): 16/24 at size 1 on a desktop, 14/20 at size 1/2. It took the
browser's button font before, Arial 13.33 on a line of «normal». A counter
inside the text container keeps the label's size, as before.
