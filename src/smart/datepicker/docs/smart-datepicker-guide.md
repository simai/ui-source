# Smart Datepicker

`<sf-datepicker>` combines the ordinary Datepicker surface with Framework
inputs, buttons, icon buttons and icons. It owns local calendar interaction;
the host owns persistence, timezone policy and domain validation.

## Choose the presentation from the task

- Use the default labelled field for a single date.
- Add `range` when the user must choose the start and end of one interval.
- Add `input="false"` for an always-visible calendar inside a prepared
  surface. The inline calendar is a group, not a dialog.
- Use `min-date` and `max-date` for hard selectable boundaries. Do not use
  disabled styling alone to explain a business rule.
- Set `close-on-select="false"` when the user needs to inspect or continue
  working in the calendar after a selection.

Values are ISO dates (`YYYY-MM-DD`). `format` changes the visible field value,
not the stored value.

## Quick ranges

In range mode `presets` puts a list of ready ranges beside the grid: built-in
ids, comma separated -- `today`, `yesterday`, `last-7-days`, `last-30-days`,
`this-week`, `this-month`, `last-month` -- or, as a property, your own list of
`{id, label, relative}` or `{id, label, range: [from, to]}`. A relative range
is resolved against today in the person's time zone, and weeks start where the
grid starts them. Ranges are clamped to `min-date` and `max-date`; one with
nothing left is disabled. «Свой период» at the end lets go of the quick range
and moves focus to the grid.

Choosing one sets the dates, shows the month the range ends in, and the
`change` detail carries `preset: {id, relative}` (or `{id}` for a fixed range,
`null` for a range picked on the grid), so a host can store «last 7 days»
rather than the dates it meant today. Give that id back in `preset` to restore
it: `preset` wins over `start-value` and `end-value`, is resolved when drawn,
and emits nothing. Where the panel has no room for the list beside the grid,
the list wraps above it as a row. The list is one tab stop; arrows move along
it.

## Interaction and accessibility

The popup field exposes `aria-haspopup`, `aria-expanded` and `aria-controls`.
ArrowDown, Enter or Space opens the calendar from the field. Inside the day
grid, arrow keys move by day or week, Home and End move to a week edge, and
PageUp and PageDown change the month. RTL reverses the physical horizontal
arrows while chronological movement remains correct. Escape closes the popup
and restores focus to the field.

Every day has a full localized date name. The current date uses
`aria-current="date"`; selection uses `aria-pressed`. Only the active day is in
the tab order.

## Visual contract

The popup is a large surface and therefore uses `--sf-radius--surface`. Days,
month cells and year cells are compact controls and use `--sf-radius--ui`.
Spacing, typography, focus and z-order use semantic Framework tokens. The
popup is constrained to the visual viewport, including browser zoom, and does
not use absolute pixel dimensions.

## Events

Listen to `change`, the name every form value control uses. Its detail
contains the ISO value, formatted value, range flag and format.
`sf-datepicker-change` and `sf-change` are legacy names for the same change
and are still emitted.
