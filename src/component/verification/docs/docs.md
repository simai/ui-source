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
for each complete value. Completion never submits a form automatically.

Bindings are stored in a `WeakMap`, removed with their DOM subtree and installed
only once when a script is repeated. Native `disabled`, `readonly`, reset and
`aria-invalid` remain owned by the input/form markup.

## Design contract

The joined control uses `--sf-radius--ui`, `--sf-px`, semantic role colors,
Framework size/typography/space tokens and `:focus-visible`. No absolute design
sizes or raw colors are part of the component contract.

The label is the field label of sf-input: regular weight, on-surface-variant, one text step below the field's text (14 at size 1), a quarter step above the cells; it was 16/500 on-surface (1.2.0, docs pre-check 2026-11-10 FB-10, CI-04). The current cell is marked only while the field has the focus: three fields at rest all looked focused (CI-02).

### States the owning runtime paints (1.3.0, owner R136-R139, decision C82)

The input is transparent (text, caret, selection and autofill fill), not
`opacity: 0`, and the runtime that owns the field (sf-input-code, or the class
runtime) paints its state on the cells:

- `.current` -- the cell typing replaces, only while the field has the focus,
  a primary border (error on a refused code);
- `.caret`, `.caret-end` -- the drawn caret in that cell, or after the last
  character of a whole code; it blinks unless motion is reduced;
- `.selected` -- a selection of more than one cell (primary-container);
- `.hover` -- the one cell under a mouse (primary-hover border; on `filled`
  the fill's hover step, no border); the group no longer hovers as a whole;
- `.sf-verification--pointer-focus` on `.sf-verification` -- a pointer focus:
  the focus ring is drawn on the current cell only for a keyboard focus,
  never around the row;
- `.sf-verification-separator` -- an aria-hidden separator between groups of
  cells (3 + 3, 4 + 4), a picture only, never in the value.

