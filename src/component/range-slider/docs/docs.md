# Range Slider

`Range Slider` selects one value or two numeric boundaries inside a known
range. Use a numeric input when the user must enter an exact value.

## Markup

```html
<div
  class="sf-range-slider"
  data-min="0"
  data-max="100"
  data-start="30"
  data-step="5"
  aria-label="Volume"
></div>
```

The component accepts the existing `data-min`, `data-max`, `data-start`,
`data-value`, `data-step`, `data-connect`, `data-keyboard`, `data-label`,
`data-prefix`, `data-suffix`, `data-decimals`, `data-tooltip-position`,
`data-text-position` and `data-label-position` settings. Add
`data-multiple="true"` for two handles and `data-margin` for their minimum
distance.

Use `data-lower-label` and `data-upper-label` to give two handles distinct
accessible names. A shared `aria-label` or `aria-labelledby` remains the
fallback. `aria-describedby` is forwarded to each handle.

Invalid ranges, steps, margins and connect values are normalized to a finite
safe configuration. Reversed finite bounds are ordered. Display precision does
not round the numeric values returned by the runtime or events.

## Runtime

`window.SF.RangeSlider` exposes `bind`, `unbind`, `getValue` and `setValue`.
The component emits bubbling and composed `sf-range-slider-update`,
`sf-range-slider-set`, `sf-range-slider-change`, `sf-range-slider-start` and
`sf-range-slider-end` events. A value the user commits also emits `change`, the
name every form value control uses; a value set with `setValue` does not, as
for a native control, while `sf-range-slider-change` still fires for it.

Direction is inherited at bind time. Rebind explicitly after changing the
direction of an already initialized tree.

## Presentation

Thumb geometry uses compact control tokens and remains circular. The rail uses
the UI radius. Value labels participate in layout, clamp to the track and merge
visually when they overlap; each handle keeps its independent accessible value.
Motion is limited to the affected paint and geometry properties and is removed
for `prefers-reduced-motion`.
