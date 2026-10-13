# sf-range-slider

Smart wrapper for the project-owned `range-slider` component.

## Basic Usage

```html
<sf-range-slider
  min="0"
  max="100"
  start="30"
  label="tooltip"
  suffix="%"
  aria-label="Volume"
></sf-range-slider>
```

## Attributes

- `min`
- `max`
- `start`
- `value`
- `step`
- `margin`
- `connect`
- `keyboard`
- `label="none|text|tooltip"`
- `prefix`
- `suffix`
- `lower-label`
- `upper-label`
- `decimals`
- `tooltip-position="top|bottom"`
- `text-position="top|bottom"`
- `label-position="top|bottom"`
- `disabled`
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

Display `decimals` only rounds the visible label; events and `getValue()` retain
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
Thumbs remain circular; rail corners use the compact UI radius. Disabled state
uses disabled color roles and does not acquire an enabled hover treatment.

Value labels occupy a separate row inside the component. They stay within the
track width and wrap long units. Intersecting labels become one visual range
label joined with an en dash, then separate again when space permits. Both
handles retain their independent exact ARIA values and keyboard behavior.
Resize/font changes recompute label layout; removing or rebuilding the component
releases its label observer and scheduled work. The base component owns this
behavior; Smart templates do not add independent tooltip padding.

## Events

- `change` — a value the user committed; the name to bind. A value set from
  code does not emit it.
- `sf-range-slider-update`
- `sf-range-slider-set`
- `sf-range-slider-change`
- `sf-range-slider-start`
- `sf-range-slider-end`
