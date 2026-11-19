# Verification

`Verification` renders a one-time-code control. The canonical contract uses one
native input as the form, focus, paste, autofill and accessibility owner. Its
segmented cells are a decorative projection created by JavaScript.

## Markup contract

- `.sf-verification-form` is the labelled field container.
- `.sf-verification` is the visual control.
- `.sf-verification-input` is the only canonical form field.
- `data-length` sets the number of cells from 1 to 12; default is 6.
- `data-mode="numeric|alphanumeric|text"` controls normalization.
- `bordered` and `filled` change only the surface treatment.
- size modifiers `1/3`, `1/2`, `1`, `2`, `3` use Framework typography and size tokens.

Use `type="text"`, `inputmode="numeric"` where appropriate and
`autocomplete="one-time-code"`. The input always has LTR character order, while
labels and surrounding layout retain the document direction.

Legacy markup with one input per symbol remains supported for compatibility, but
must not be used for new examples because it fragments paste, autofill and the
accessible editing target.

## Runtime

`window.SF.Verification` exposes `initAll`, `getValue` and `setValue`. Completion
dispatches the bubbling `verification:complete` event with `detail.value` once
for each complete value the person types or pastes; a field that loads, resets
or is set by `setValue` already holding a whole code dispatches nothing (1.5.0:
it fired on page load). Completion never submits a form automatically.

Bindings are stored in a `WeakMap`, removed with their DOM subtree and installed
only once when a script is repeated. Native `disabled`, `readonly`, reset and
`aria-invalid` remain owned by the input/form markup.

## Design contract

The joined control uses `--sf-radius--ui`, `--sf-px`, semantic role colors,
Framework size/typography/space tokens and `:focus-visible`. No absolute design
sizes or raw colors are part of the component contract.

The label is the field label of sf-input: regular weight, on-surface (the text ink; the hint keeps on-surface-variant), one text step below the field's text (14 at size 1, and 14 on a phone too), a quarter step above the cells (1.5.0, owner decision C153 (1); 1.2.0 drew it on-surface-variant and 12 on a phone). The current cell is marked only while the field has the focus: three fields at rest all looked focused (CI-02).

A cell is square: its side is the control height of its size (32 / 40 / 48
on a desktop, 28 / 36 / 44 on a phone at 1/2, 1 and 2), or
`--sf-verification-cell-size` when the page sets it, at every size (1.9.0).
In a column too narrow for the row the cells give way in width, all alike,
down to the touch rung 1/2 (C284); their height stays. Before 1.9.0 the
cells stood at that floor in every column -- 32 x 40 at size 1, 32 x 48 at
size 2 on a desktop -- and the public variable changed only their height.

### States the owning runtime paints (1.3.0, owner R136-R139, decision C82)

The input is transparent (text, caret, selection and autofill fill), not
`opacity: 0`, and the runtime that owns the field (sf-input-code, or the class
runtime) paints its state on the cells:

- `.current` -- the cell of the real caret (`selectionStart`), only while the
  field has the focus: the text field's focus look, a 2 px edge of the focus
  colour inside the cell, by mouse and keys alike, no ring outside (1.5.0,
  owner decision C153 (4));
- `.caret`, `.caret-end` -- the drawn caret in that cell, or after the last
  character of a whole code; it blinks unless motion is reduced. A bare caret
  inside the code becomes a one-cell selection, which typing replaces; the
  arrows, Home and End move by cells, a click puts the caret in the cell
  clicked (1.5.0: the class runtime drew it after the last character
  whatever the caret did);
- `.selected` -- a selection of more than one cell (primary-container): a
  drag, a double click, Shift with the arrows, select-all;
- `.hover` -- the one cell under a mouse (the text ink border, as a hovered
  sf-input; on `filled` the fill's hover step, no border); the group no longer
  hovers as a whole;
- `.sf-verification--pointer-focus` on `.sf-verification` -- set while a
  pointer focus lasts; since 1.5.0 it no longer changes the look;
- `.sf-verification-separator` -- an aria-hidden separator between groups of
  cells (3 + 3, 4 + 4), a picture only, never in the value.

