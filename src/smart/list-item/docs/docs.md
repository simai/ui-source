# Smart List Item

The default template applies `root-class`, author `style` and `root-style`
to its visible root. Use Framework semantic tokens for geometry. These settings
do not belong to the boxless host and must not reset existing component state.

Smart/runtime wrapper for the list-item styles that live in the `dropdown`
component. `sf-list-item` is a declarative option descriptor for a direct
`sf-dropdown` child; Dropdown captures it and owns listbox semantics, focus,
selection, form state and events.

A standalone `sf-list-item` is a non-interactive visual preview. It deliberately
has no `role="button"`, Tab stop or click behavior. Use a Button or Link for an
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
