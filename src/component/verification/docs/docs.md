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
