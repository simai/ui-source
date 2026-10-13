# Dropdown

Base selection component for choosing one or several machine values from a
concealed option list.

The root uses `.sf-dropdown`, one of the five size modifiers `1/3`, `1/2`, `1`,
`2`, or `3`, one appearance modifier (`outlined` or `filled`), and either the
`text` or `tag` presentation. The visible label stays separate from each
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
resize. This is the default; `portal="false"` keeps the legacy in-flow list. The historical
`data-multiple` and `data-portal` forms remain compatibility aliases. Native
Popover is preferred; the fallback projection is reversible, remains inside a
modal interaction boundary, and preserves Framework tokens, direction and
typography.

Option presentations are `text`, `icon`, `checkbox`, `avatar`, and `color`.
Checkboxes and icons inside an option are indicators, not independent controls.
Long labels and tag collections wrap without covering the toggle. The field
uses `--sf-radius--ui`; the popup surface uses `--sf-radius--surface`.

Native form reset restores the selection captured at first connection. `change`
bubbles after user selection and is the name to bind; `sf-dropdown:change` is
its legacy name with the same detail. The detail keeps visible labels separate
from machine values.

Smart owner: `sf-dropdown`, with direct `sf-list-item` children. It shares the
same interaction, form-reset and portal owners as the base component. List Item
is an option-row primitive, not a standalone action: use Button or Link for an
independent action and Checkbox/Radio for an independent choice.
