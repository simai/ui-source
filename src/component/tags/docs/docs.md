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
- appearance: `sf-tag--appearance-outline`, `sf-tag--appearance-ghost`; `sf-tag--appearance-surface` is the former name of outline until 2027-01-01 (journal `value-tag-appearance-surface-to-outline`).

The appearance axis is separate from the type. `surface` and `ghost` take their
colour from the neutral alpha ramp rather than from a role, so a tag used as a
filter or a quiet label reads the same on any background and in both themes.
Because a tag is built without a border, both draw their boundary as an inset
line, which keeps a tag exactly as tall as its neighbours.

Height: `sf-tag--height-low`, `sf-tag--height-high` and
`sf-tag--height-highest` move a tag of any size to its neighbouring steps of
the height ladder (C27, as `sf-button--height-*`); the default needs no class.
`spacing-compact`, `spacing-comfortable` and `spacing-spacious` are their former
names until 2027-01-01 (journal `class-tag-spacing-to-height`).

A picture before the label (avatar, icon, colour swatch) is the tag less 4
above and below (owner decision C58: 24 in a 32 tag, 20 in 28, 16 in 24, 32 in
40); the check square stays the box of the checkbox of the step. On another control's text
line (`sf-tag--inline`, `line` on `sf-tag`) an avatar is that line, as the remove
button is, so a chip in a field and the field's list rows show one avatar step.

The small parts take the small steps of the tag's size (owner decision C132):
the remove cross is half the tag's text line rounded down to a small step, 8 px at 1/3 and 1/2, 12 px at 1 and 2,
16 px at 3 on a desktop and 12 px at 3 in compact and on a phone (a chip in a field is a tag and takes the same);
the status dot is 6 px at 1/3 and 1/2, 8 px at 1 and 2 and 12 px at 3.

## Semantic ownership

- static labels and statuses use a neutral container without an action role or
  Tab stop;
- selectable filters use a native button with `sf-tag--interactive` and
  `aria-pressed`;
- removable values keep the surface static and expose one separately named
  remove button;
- icon, color, avatar, dot and check visuals are decorative when the visible
  text already supplies the accessible name;
- a group owns wrapping and spacing through Framework flex and gap utilities:
  tags stand `gap-1/4` (4 px) apart, between their rows too (C105 H5, C58);
- a long name ends in an ellipsis; a tag is at most 20rem and its container,
  and never shrinks to give its width to a neighbour (C58);
- a colour from data is a palette step through `--sf-tag-background-color`,
  for example `var(--sf-teal-50--alfa-24)`: the step is translucent, so the
  label keeps its contrast in a light and in a dark theme; an author hex is
  not (C140 BG-7; a light hex reads 1.04:1 in the dark theme).

Tag is a compact UI control and therefore uses `--sf-radius--ui`. Geometry,
typography, role colors, focus and motion use Framework semantic tokens. A
static Tag does not receive hover or pressed affordance. Focus is shown only for
native keyboard-focusable actions and remains visible in forced colors.
