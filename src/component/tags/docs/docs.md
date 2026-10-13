# Tags

Compact labels for categories, filters, selected values and statuses.

## Public classes

- root: `sf-tag`;
- types: `sf-tag--default`, `sf-tag--checkbox`, `sf-tag--icon`,
  `sf-tag--color`, `sf-tag--avatar`, `sf-tag--success`, `sf-tag--warning`,
  `sf-tag--error`;
- sizes: `sf-tag--size-1/2`, `sf-tag--size-1`;
- elements: `sf-tag-container`, `sf-tag-count`, `sf-tag-color-icon`,
  `sf-tag-check`;
- states: `active`, `disabled`;
- behavior markers: `sf-tag--interactive`, `sf-tag--removable`;
- appearance: `sf-tag--appearance-surface`, `sf-tag--appearance-ghost`.

The appearance axis is separate from the type. `surface` and `ghost` take their
colour from the neutral alpha ramp rather than from a role, so a tag used as a
filter or a quiet label reads the same on any background and in both themes.
Because a tag is built without a border, both draw their boundary as an inset
line, which keeps a tag exactly as tall as its neighbours.

## Semantic ownership

- static labels and statuses use a neutral container without an action role or
  Tab stop;
- selectable filters use a native button with `sf-tag--interactive` and
  `aria-pressed`;
- removable values keep the surface static and expose one separately named
  remove button;
- icon, color, avatar, dot and check visuals are decorative when the visible
  text already supplies the accessible name;
- a group owns wrapping and spacing through Framework flex and gap utilities.

Tag is a compact UI control and therefore uses `--sf-radius--ui`. Geometry,
typography, role colors, focus and motion use Framework semantic tokens. A
static Tag does not receive hover or pressed affordance. Focus is shown only for
native keyboard-focusable actions and remains visible in forced colors.
