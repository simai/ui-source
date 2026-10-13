# Radio

Radio owns one value inside a mutually exclusive native group. Use the same
`name` for related `input[type="radio"]` elements and wrap the visible choices
in `fieldset` with a meaningful `legend`.

## Sizes

Two rungs, `1` and `2`, the same pair Switch carries. A control this small gains
nothing from the rungs that collapse onto their neighbours in the mobile mode,
and the rung is there to match the fields and buttons standing beside it in the
same form.

## Public variations

- `.sf-radio-button--size-1` is the normal form-control size.
- `.sf-radio-button--size-2` is the larger size, for forms built on size-2 fields.
- The constructor retains `type: "font"` for choosing among visual font
  previews; it still creates native radios and one submitted value.

The native input owns selection, disabled state, arrow-key behavior, form data
and reset. `.active` is only a synchronized visual projection. Invalid choices
use `aria-invalid="true"`, `.error` and a visible explanation.

The whole enabled label is the pointer target. Pointer interaction is visually
quiet; keyboard focus uses `:focus-visible`. Long text wraps, logical layout
follows direction, and system colors preserve selected and disabled states.

Use Framework typography, spacing and role-color tokens for adaptation. The
indicator remains circular; it is not a surface or a configurable card radius.
