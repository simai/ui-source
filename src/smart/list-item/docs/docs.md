# Smart List Item

The default template applies `root-class`, author `style` and `root-style`
to its visible root. Use Framework semantic tokens for geometry. These settings
do not belong to the boxless host and must not reset existing component state.

Smart/runtime wrapper for the list-item styles that live in the `dropdown`
component. `sf-list-item` is a declarative option descriptor for a direct
`sf-dropdown` child; Dropdown captures it and owns listbox semantics, focus,
selection, form state and events.

A standalone `sf-list-item` is a non-interactive visual preview, unless
`interactive` or `sortable-item` makes it a list row (see "List row" below). A
preview deliberately has no `role="button"`, Tab stop or click behavior. Use a Button or Link for an
action and Checkbox/Radio for an independent choice. Do not build an option with
independently interactive descendants; use a collection pattern that owns those
controls instead.

Tag:

- `sf-list-item`

Loading model:

- detected by `tags: ['sf-list-item']` in `src/smart/list-item/rule.js`
- loaded as smart bundle `cl-list-item`
- base styles are loaded through relations with `dropdown`, `checkbox`, `avatars`, `tags`

Current scope:

- types:
  - `text`
  - `icon`
  - `checkbox`
  - `avatar`
  - `color`
- sizes:
  - `1/3`
  - `1/2`
  - `1`
  - `2`
  - `3`

Main attributes:

- `template`
- `value` — stable machine value read by the parent Dropdown
- `type`
- `size`
- `text`
- `icon`
- `checked`
- `selected`
- `disabled`
- `color-class`
- `avatar-image-url`
- `avatar-title`
- `aria-label`

## Slot overrides

Supported light-DOM slot names:

- `leading`
- `text`
- `trailing`

Example:

```html
<sf-dropdown label="Статус" name="status" placeholder="Выберите статус">
  <sf-list-item value="open" text="Открыт"></sf-list-item>
  <sf-list-item value="done" text="Готов"></sf-list-item>
</sf-dropdown>
```

## Accessibility ownership

The shared renderer emits `role="option"`, `aria-selected`, `aria-disabled` and
the machine value only when Dropdown invokes it as an option. Dropdown owns
Arrow Up/Down, Home, End, Enter, Space and Escape. Visual checkbox marks and
leading icons are decorative and never add another focus target. Visible text
is the accessible option name unless `aria-label` explicitly overrides it.

## List row

The same row is the Framework's general list row (simai/ui-source#18 and #29,
requested by ui-mail): admin, chat and editor lists use it instead of a row of
their own. It was extended rather than duplicated as a new element because the
option row already holds what a list row needs -- the size ladder (a one-line
row is the control height of its size), the `leading`, `text` and `trailing`
slots, `selected` and `disabled` -- and a second element would have been a
second set of row geometry to keep on the ladder. What a list row adds is off
for a Dropdown option, so options are unchanged.

| Attribute | What it does |
| --- | --- |
| `supporting` (or a `slot="supporting"` child) | A second line under the title, one step of the ladder smaller (1/3 and 1/2 rows: 1/3; 1: 1/2; 2: 1; 3: 2). A two-line row is the control height plus that line. Kinds `text`, `icon` and `checkbox`. |
| `interactive` | A row a person acts on: hover, keyboard focus and `selected` states, a pointer cursor, and `sf-list-item-activate` (`detail: {value, trigger}`) on click or Enter. A click on a control inside the row (a trailing action) is that control's, not the row's. |
| `sortable-item="<id>"` | The row is an item of the surrounding `sf-sortable` list: the row's own box carries `data-sf-sortable-item` (the host is boxless, so the attribute does not go on the host) and a drag handle stands in a slot before the content. |
| `pinned` | A row of the list that does not move: no handle and not an item of the list, so it cannot be dragged or picked up. It keeps the handle's slot empty, so its text starts where the other rows' text does. |

**One Tab stop per list.** Interactive and sortable rows are one stop of their
list -- the nearest `sf-sortable`, `[role="listbox"]`, `[role="list"]` or
`[data-sf-list]`, else the row's parent. The row that last had the focus takes
Tab (else the selected one, else the first); ArrowDown, ArrowUp, Home and End
move between rows and skip disabled ones. While a row is picked up for a
keyboard reorder the arrows belong to `sf-sortable`. A control in the trailing
slot is a Tab stop of its own; for one stop per list give it `tabindex="-1"`
and offer it another way (a context menu on the row).

**In `sf-sortable`.** Space or Enter picks a row up, the arrows move it and
Space or Enter drops it, exactly as for any item of the list; Enter therefore
does not activate a sortable row (a click does). Where a pointer can hover, the
handle shows on the row under the pointer and on the focused row; on a touch
screen it is always shown. Its slot is always kept, so nothing moves.
When the host applies `sf-sortable-intent` and redraws, it moves or replaces the
`sf-list-item` elements themselves: the element carrying
`data-sf-sortable-item` is the row's box inside the host, and removing only
that box leaves an empty host behind.

```html
<sf-sortable id="blocks" group="blocks" label="Blocks">
  <sf-list-item pinned interactive size="1/2" text="Letter settings" value="settings"></sf-list-item>
  <sf-list-item sortable-item="hero" interactive size="1/2" kind="icon" icon="title"
                text="Heading" supporting="Hello" value="hero">
    <sf-icon-button slot="trailing" icon="more_horiz" tabindex="-1" aria-label="Actions"></sf-icon-button>
  </sf-list-item>
  <sf-list-item sortable-item="text" interactive size="1/2" kind="icon" icon="notes"
                text="Text" supporting="Paragraph" value="text"></sf-list-item>
</sf-sortable>
```

The list owns the role: a selected row says `aria-current="true"`, a disabled
one `aria-disabled="true"`. Probe: `tests/browser/list-row-general.browser.mjs`.
