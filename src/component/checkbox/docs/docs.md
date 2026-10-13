# Checkbox

Checkbox owns an independent native form choice. Use it to toggle one option or
to select any number of values. Use Radio when only one value may be selected.

## Anatomy and semantics

- Keep one `input[type="checkbox"]` inside the `.sf-checkbox` label.
- The visible `.sf-checkbox-box` and its icon are decorative projections of the
  native `checked` and `indeterminate` properties.
- Related choices use `fieldset` and a visible `legend`; add a hint such as
  “Select all that apply” when the multiplicity may not be obvious.
- Invalid input uses `aria-invalid="true"`, the `error` class and a specific
  visible explanation. Colour alone is insufficient.

The concise `data-indeterminate` input attribute initializes the native
`indeterminate` property for declarative markup. Runtime code should update the
property through `SF.Checkbox.setState(input, state)`. Mixed state does not
change the value submitted by the form.

## Sizes

Two rungs, `1` and `2`, the same pair Switch carries. A control this small gains
nothing from the rungs that collapse onto their neighbours in the mobile mode,
and the rung is there to match the fields and buttons standing beside it in the
same form.

## Public variations

`sf-checkbox--size-1` is the normal form size. `sf-checkbox--size-2` is the
compact option for dense, repeated interfaces. The indicator normally appears
at logical start; Smart Checkbox retains `position="end"` for intentional row
layouts. Both placements follow document direction.

The indicator uses `--sf-radius--ui`. Typography, spacing, border, colour and
motion use Framework tokens. Pointer interaction is visually quiet; keyboard
focus uses `:focus-visible`, with a forced-colours fallback. State transitions
stop under `prefers-reduced-motion`.
