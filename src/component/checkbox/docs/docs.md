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

A checkbox is named by its label row and described by its description (aria-labelledby, aria-describedby), as the switch is since 1.2: the box, the label and the description sit in one <label>, which named the input by all its text (1.1.1, docs pre-check 2026-11-10 CH-03). The helper is src/component/checkable-text-helper.js; an author's aria-label or aria-labelledby wins, ids come from the instance path.

The help mark stands beside the <label>, not inside it (.sf-checkable-row, 1.2.0, C59): pressing «?» never presses the control. The Smart element's own <label> hugs its content (inline-size: fit-content), so a press on the empty rest of the row does nothing; class markup in list rows, menus, choice lists and table rows keeps the full row as its target.

A Smart element with text is a row of its step (C63 W5): (control height − line) / 2 above and below, 40 at size 1, 60 with a description, 32 in compact, the touch target under a coarse pointer. The label is regular in all three choice controls (W6). The three share one base (W9): src/smart/helpers/checkable-row.js and checkable-row.css, and the name binding src/component/checkable-text-helper.js.
