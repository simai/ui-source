# sf-slider-range

Smart wrapper for the project-owned `range-slider` component.

## Basic Usage

```html
<sf-slider-range
  label="Price"
  name="price"
  min="0"
  max="50000"
  step="500"
  value="5000,20000"
  suffix=" ₽"
  field
></sf-slider-range>
```

## Attributes

- `label` — the visible name above the slider, as every field's label; it
  names the handles unless `aria-label`, `aria-labelledby` or
  `lower-label`/`upper-label` do. Until 2027-01-01 `label="none|text|tooltip"`
  still means `value-display` (noted in `SF.deprecations`).
- `value-display="none|text|tooltip"` — the value at the end of the name line,
  or in a bubble over a handle shown only while it is dragged or
  keyboard-focused (owner decision C78).
- `size="1/2|1|2"` — the slider row is the control height of the step
  (32/40/48, phone 28/36/44), the handle 20/24/28.
- `min`, `max`, `start`, `value`, `step`, `margin`, `connect`, `keyboard`
- `page-step` — PageUp, PageDown and Shift with an arrow; ten steps when empty.
- `prefix-text`, `suffix` — joined to the number by a no-break space.
- `precision`, `grouping`, `locale` — as `sf-input-quantity`; `decimals` is a
  dated alias of `precision` until 2027-01-01.
- `lower-label`, `upper-label`
- `field` — one from/to field «5 000 – 20 000 ₽» at the end of the track line;
  Enter or leaving the box moves the handle (owner decision C80).
- `ticks` — a dot per step (at most twenty) cut out of the track.
- `scale` — min and max under the track; `marks="1:bad,3:fine,5:great"` —
  labels at chosen values.
- `readonly` — focusable and read out, keys and pointer change nothing; a
  read-only field's light outline and a neutral handle.
- `disabled`
- `name` — a form control: one number, or two entries under the name for a
  range (`price=5000&price=20000`).
- `tooltip-position="top|bottom"`, `label-position` — where the bubble stands.
- `text-position` — no effect since 1.4.0 (kept for old markup).
- `root-class`

## Methods

- `getSliderRoot()`
- `getValue()`
- `setValue(value)`
- `setDisabled(value)`
- `onUpdateValue(handler)`
- `onChange(handler)`
- `onSet(handler)`
- `onStart(handler)`
- `onEnd(handler)`

`setValue([30, 70])`, `setValue('30,70')` and assigning `value` update both
handles in multiple mode. The reflected `value` contains the actual values
accepted by the slider after range, step and margin constraints, not an
out-of-range request. A scientific step such as `1e-3` retains three decimal
places in generated labels and numeric event values.

Display `precision` only rounds the shown and read-out value; events and `getValue()` retain
the actual admitted number. Standard `aria-label`, `aria-labelledby` and
`aria-describedby` on the host are forwarded to the focusable slider handles
and follow host changes. Explicit names on individual handles take precedence.
For two handles, use `lower-label` and `upper-label` to give each boundary a
distinct accessible name; the shared host name remains a compatibility fallback.
Numeric ARIA values retain fractional precision; value text includes units.

The inherited text direction at initialization controls the horizontal scale.
RTL puts the minimum on the right; no extra Smart direction prop is required.

Thumb dimensions use the compact control-height token, not a font-size token.
The existing `--sf-thumb-handle--width` and `--sf-thumb-handle--height` properties
configure both visible thumb and pointer/focus owner. Set inherited CSS variables
on an enclosing element, or pass a complete `style` / `root-style` declaration
to the Smart host. `root-style` updates apply without resetting the value or
recreating the slider; removing it restores the captured `style` defaults.
`--sf-range-slider-track--height` also supplies the default progress thickness.
Thumbs remain circular, plain solid discs with a soft shadow, and the inactive
track is a flat fill;
`--sf-range-slider-handle-inner-color` draws a hollow thumb with that centre.
Rail corners use the compact UI radius. Disabled state
uses disabled color roles and does not acquire an enabled hover treatment.

With `value-display="tooltip"` the bubble floats over the row and takes no
room, so the slider row stays the control height and lines up with the fields
beside it. A hand-written `.sf-range-slider` with `data-label="text"` still
draws text labels under the handles; the Smart host writes its value in the
name line instead.

## Events

- `change` — a value the user committed; the name to bind. A value set from
  code does not emit it.
- `sf-range-slider-update`
- `sf-range-slider-set`
- `sf-range-slider-change`
- `sf-range-slider-start`
- `sf-range-slider-end`
