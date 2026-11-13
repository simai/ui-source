# Dropdown

Base selection component for choosing one or several machine values from a
concealed option list.

The root uses `.sf-dropdown`, one of the five size modifiers `1/3`, `1/2`, `1`,
`2`, or `3`, one appearance modifier (`outlined` or `filled`), and either the
`text` or `tag` presentation. A filled field draws its bottom edge in
`--sf-outline` (C52, as `sf-input`); focus and an open list colour the whole
border that colour. The visible label stays separate from each
option's stable `data-value`. A named hidden input owns the submitted value.

The actual toggle button is the primary Tab stop. The shared interaction
adapter publishes a listbox popup, keeps decorative option content out of the
Tab order, supports ArrowUp/ArrowDown, Home/End, Enter/Space, Escape and native
Tab continuation, and derives an accessible name from the visible label when
the author did not provide one explicitly.

Use the short `multiple` behavior attribute for several values. The list is
positioned by the shared Framework positioning (`SF.Position`, built on Floating
UI): below the field, flipped above when it does not fit and there is more
room, shifted and height-limited inside the viewport, following scroll and
resize. This is the default; `portal="false"` keeps the legacy in-flow list, below
the field with the positioned list's height (the larger room above or below the
field; its rows scroll beyond it). The historical
`data-multiple` and `data-portal` forms remain compatibility aliases. Native
Popover is preferred; the fallback projection is reversible, remains inside a
modal interaction boundary, and preserves Framework tokens, direction and
typography.

Option presentations are `text`, `icon`, `checkbox`, `avatar`, and `color`.
Checkboxes and icons inside an option are indicators, not independent controls.
Long labels and tag collections wrap without covering the toggle. The field
uses `--sf-radius--ui`; the popup surface uses `--sf-radius--surface`.

The open list is a dropping panel with the context menu's geometry (owner
rules C05-C07, docs review R029; the shared partial
`src/component/context-menu/scss/_panel.scss`): a row's highlight stands
`--sf-space-1/4` from the panel's edge, is as tall as a control of the row's
size and rounded `--sf-radius--ui`, and its picture or text stands
`--sf-space-1/2` inside it, the picture `--sf-space-1/2` before the text. The
list (`.sf-list--size-*` says its size) draws no padding of its own when it has
a scroll area (`.sf-list-container-wrap`): that area holds the inset on every
side and is the only part that scrolls. A search is the panel's header,
`label.sf-list-search` holding `i.sf-list-search-icon` and
`input.sf-list-search-input`: no frame, no fill, a row's height and the inset
above and below, its icon and text over the rows' icon and text (when no row has
a picture -- icon, avatar, colour or checkbox -- its text over the rows' text
and the icon at the header's end), a hairline
under it across the panel that turns primary while it has the focus. A search
written as an `sf-input` (the markup before R029) still works and keeps its
box, the inset around it. The scrollbar shows only when the rows do not fit;
while it takes room in the layout the scroll area is marked
`sf-list-container-wrap--scrollbar` and gives up its inline-end padding, the
track being the inset, the page scrollbar's thumb (`--sf-scroll-thumb-width`)
and the inset again: 14, the page's `--sf-scroll-bg-width` (owner decision C106).
A projected list follows the page's scroll, never its own: a scroll inside the
list does not place the panel again, and placing keeps the rows' scroll
position (owner remark R171).

Native form reset restores the selection captured at first connection. `change`
bubbles after user selection and is the name to bind; `sf-dropdown:change` is
its legacy name with the same detail. The detail keeps visible labels separate
from machine values.

Smart owner: `sf-dropdown`, with direct `sf-list-item` children. It shares the
same interaction, form-reset and portal owners as the base component. List Item
is an option-row primitive, not a standalone action: use Button or Link for an
independent action and Checkbox/Radio for an independent choice.
