# Smart Datepicker

`<sf-input-date>` combines the ordinary Datepicker surface with Framework
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
not the stored value. With `mode="datetime"` or `mode="time"` the field also
holds a time of day: see «A date and a time, or a time».

The `value` attribute is the initial value, as on a native input. Once the
person or code clears the date -- emptying the field, `element.value = ''` --
the value is empty and stays empty: the attribute does not come back. The
component keeps the cleared state as `date=""` on the host and reports it with
the usual `change`, whose detail `value` is `''`.

## A date can be typed

The field of a single-date picker accepts typing. What is typed is read through
`format`, and an ISO date is accepted as well, so both `14.10.2026` and
`2026-10-14` land on the same value.

Without `format` the field writes and reads the date as the page's language
and country do (owner decision C62): the order of day, month and year and the
signs between them come from the browser's
`Intl.DateTimeFormat(locale).formatToParts` -- `DD.MM.YYYY` for `ru` and `de`,
`MM/DD/YYYY` for `en-US` (September 3 is `09/03/2026`), `DD/MM/YYYY` for
`en-GB` and `fr`, `YYYY-MM-DD` for `sv-SE`. The locale is `locale`, else the
nearest `lang`. An empty field shows that format in the letters of the
language's names for the parts -- `ДД.ММ.ГГГГ`, `MM/DD/YYYY`, `TT.MM.JJJJ` --
unless `placeholder` says otherwise, and `mask` (digits only, the signs typed
for the person) follows it too. An explicit `format` wins over the locale. The whole text has to be one date in that
format: `YYYY` is four digits, `YY` two, the day and the month one or two, and
between them any of `.` `/` `-` `,` or a space. The year is 1000 to 9999. Text
that is not such a date -- two dates glued together by a paste
(`20.11.202630.10.2026`), a five-digit year, a date with something after it, a
day the month does not have -- or a date outside `min-date`/`max-date`, puts the
field back to the value it held: a half-typed date must not clear a stored one,
and nothing is ever read as a different date than the one typed. Emptying the field clears the value, because
deleting the text is how a person says there is no date. Enter commits what is
typed; ArrowDown still opens the calendar.

Add `readonly` for a value the person may see but not change: the field cannot
be typed in and does not open the calendar -- a click, ArrowDown, Enter and
Space do nothing, `open-panel` is refused, and the field names no popup
(owner decision C62). The value is still submitted. A read-only inline
calendar (`input="false"`) can be walked through but takes no choice. A
`range` field is never typed -- one field holding two dates has no single
format to read back -- and is chosen on its calendar, which opens. Its `start-value` and `end-value`
are read with the same parser, so a value holding two dates is not a date.

The mask properties (`mask`, `mask-pattern`, `mask-lazy`,
`mask-placeholder-char`, `mask-options`) reach the field only where it can be
typed in, which is what they were always for.

## A period: one field, or two as a recipe

A period is one field: `range` holds the start and the end, and the field
shows them as «с – по», the two dates with an en dash between spaces
(`01.09.2026 – 07.09.2026`; owner decision C62). The value is
`[start-value, end-value]` and the form gets the ISO 8601 interval
`start/end`.

Two fields -- check-in and check-out, departure and return -- are a recipe,
not a component: two single-date pickers, the second bound to the first. Each
is labelled on its own, each submits its own name, and the second cannot end
before the first starts. With `min-date` set, an empty check-out opens on the
check-in's month (the calendar opens on today's month held to `min-date`).

```html
<div class="flex gap-1/2">
  <sf-input-date id="check-in" name="check_in" label="Заезд"></sf-input-date>
  <sf-input-date id="check-out" name="check_out" label="Выезд"></sf-input-date>
</div>
<script>
  const checkIn = document.getElementById('check-in');
  const checkOut = document.getElementById('check-out');
  checkIn.addEventListener('change', (event) => {
    const start = event.detail.value; // YYYY-MM-DD, '' when cleared
    if (start) checkOut.setAttribute('min-date', start);
    else checkOut.removeAttribute('min-date');
    // A check-out before the new check-in is cleared, not moved.
    if (start && checkOut.value && checkOut.value < start) checkOut.value = '';
  });
</script>
```

Use the one field when the period is one thing to the person (a report's
dates, a filter); use two when each end is a decision of its own and is read
on its own (a booking).

## A date and a time, or a time

`mode` says what is chosen:

- `date` (the default) -- a date, as everything above describes;
- `datetime` -- a date and a time: the calendar, and under it the time row;
  the value is `YYYY-MM-DDThh:mm`;
- `time` -- a time of day alone: the panel is the time row; the value is
  `hh:mm`, and the field's icon is `schedule`.

The value is the wall clock as the host writes it, without a zone: the host owns
the time zone. A stored value with seconds, a fraction or a zone
(`2026-11-15T10:30:15+03:00`) is read as its day and minute; a change writes
the minute (`2026-11-15T18:05`). A stored day alone in datetime mode reads as
midnight. The form gets the value as it is, as a native `datetime-local` or
`time` input sends it.

The time row is the hours and the minutes, each a spinbutton between a «−»
and a «+». ArrowUp and ArrowDown step the part -- an hour, or the minute step
-- and wrap inside it (23 to 00) as a native time field does; Home and End take
its first and last allowed value; digits type it, and two digits of the hours
move on to the minutes; ArrowLeft and ArrowRight move between the parts; Enter
closes the panel and returns to the field. The steppers are out of the tab
order, as the spinbutton pattern has them: the keys already do what they do.
Without a time, the first step takes the first allowed time (up) or the last
(down). The row reads `hh:mm` left to right in every writing direction.

In datetime mode a day chosen on the grid keeps the time shown -- or takes the
first one the day allows -- and the panel stays open with the focus on the
hours, so the time follows the day; Enter or Escape closes it. A time set
before any day is chosen waits for the day.

The field is typed as the format says: `DD.MM.YYYY HH:mm` by default in
datetime mode, `HH:mm` in time mode, `HH` the hours 00-23 and `mm` the
minutes. A date format given to datetime mode (`format="YYYY-MM-DD"`) gets
` HH:mm` added. The ISO form is read too (`2026-11-05T10:30`,
`2026-11-05 10:30`, `10:30`). The whole value has to be typed: a date without
its time is not read as midnight.

Bounds:

- `min-time` and `max-time` (`hh:mm`) hold on every day;
- in datetime mode `min-date` and `max-date` may carry a time
  (`2026-11-05T09:00`), which holds on that day only;
- `minute-step` (1 to 60, default 1) is the minutes a step moves, counted from
  the hour: with 15 the minutes are 00, 15, 30 and 45.

A typed time outside the bounds or off the step puts the field back to the
value it held, as a date outside `min-date`/`max-date` does. `range` is a
range of dates and is read in date mode only.

The `change` detail carries `mode` and, in datetime and time mode, `time`
(`hh:mm`, `''` for none) beside the usual `value`.

```html
<sf-input-date mode="datetime" label="Начало" value="2026-11-05T10:30" minute-step="15"
    min-time="09:00" max-time="18:00"></sf-input-date>
<sf-input-date mode="time" label="Напоминание" value="09:30"></sf-input-date>
```

## The month the calendar opens on

The calendar opens on the month of the value: a date picked, typed (committed
with Enter, or still standing in the field when it is clicked or ArrowDown is
pressed), or set by the `value` property or attribute -- a range opens on its
start. With no value it opens on today's month. Either way the month is inside
`min-date`/`max-date`. A month the person moved to is forgotten when the
calendar closes; a `month`/`year` a host sets is kept while there is no value.

## An invalid field

`invalid` draws the field invalid -- the error border, and `aria-invalid="true"`
on the native input -- and `error-message` is the text under it. Removing
`invalid` restores the valid field: no border, no `aria-invalid`, no message.

## A hint under the field

`hint` is the helper text under the field, and `hint-icon` the marker at its
end. They are the settings of `sf-input` and they behave as they do there: the
hint is read to the native input as its description (`aria-describedby`), and
while the field is invalid `error-message` takes its place -- removing `invalid`
brings the hint back. The marker stays either way.

Trailing text (`text-end` on `sf-input`) is not a setting here. The calendar
trigger owns the field's end: the whole field opens the panel, so text there
would read as part of the date while being a click target that opens a
calendar. A date that needs a unit or a suffix beside it is a case for
`sf-input`.

## A field whose label is drawn outside it

`label` draws the label above the control. A host that prints the label itself --
a record panel does -- passes `aria-label` instead and leaves `label` unset: the
name reaches the native input, and the label is not printed twice.

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

## Days off

Days off are drawn in the calendar's day-off ink (`--sf-datepicker-day-off`,
the palette red, not the error role) and their name says «выходной». Which days
they are follows the locale: Saturday and Sunday for `ru`, `de` and `en-US`,
Friday and Saturday for `ar-EG` (`Intl.Locale#getWeekInfo`; Saturday and Sunday
where the browser does not say). A product sets them with `weekend`:

- `weekend="none"` -- no day off, for a product whose weekends are working days;
- `weekend="5,6"` -- the days listed, `0` or `7` Sunday, `1` Monday to `6`
  Saturday (Intl writes Saturday and Sunday as `6,7`).

Holidays and transferred days off are not drawn yet: they are an open owner
question (C67).

## Interaction and accessibility

The popup field exposes `aria-haspopup`, `aria-expanded` and `aria-controls`.
ArrowDown opens the calendar from the field; in a range field, which is not
typed, Enter and Space open it too, while in a field that can be typed in they
belong to the text and Enter commits it. A `readonly` field opens nothing. Inside the day
grid, arrow keys move by day or week, Home and End move to a week edge, and
PageUp and PageDown change the month. RTL reverses the physical horizontal
arrows while chronological movement remains correct. Escape closes the popup
and restores focus to the field, and the press goes no further: a drawer, a
modal or a record panel the field sits in stays open, and text typed into the
field stays. The open calendar holds the shared open-surface mark
(`document.documentElement.dataset.sfPopoverOpen`) and acts only as the
innermost open layer, so a calendar inside a popover closes before the popover.

Every day has a full localized date name. The days are an ARIA grid: a row per
week, column headers with the weekdays' full names, each day a `gridcell`. The
current date uses `aria-current="date"`; selection uses `aria-selected`. Only
the active day is in the tab order. PageUp and PageDown turn a month, with Shift
a year; Home and End go to the week's ends, held to `min-date` and `max-date`.
The shown month is said when it changes. The month and year lists are one tab
stop each; the arrows move in them, and the focus goes back to the toggle when
one closes. Tab out of the field and the panel closes the panel.

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
