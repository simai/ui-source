# Smart Textarea

`<sf-textarea>` is the declarative wrapper for the ordinary Textarea component.
It renders a native `<textarea>` and preserves native multiline editing, value,
validation, form submission and reset.

## Inputs

- `size`: `1/3`, `1/2`, `1`, `2` or `3`.
- `type`: `bordered` or `filled`.
- `label`, `placeholder`, `hint`, `value`, `name` and positive `rows`.
- `autocomplete`, `inputmode`, `minlength`, `maxlength`, `spellcheck` and
  `wrap="soft|hard"` are projected to the native control.
- `required`, `readonly`, `disabled`, `invalid`, legacy `error` and
  `error-message` preserve native ownership and accessible relationships.
- `root-class` and `root-style` customize the component root without replacing
  its contract.
- `mask`, `mask-pattern` and `mask-options` enable the optional Mask adapter.

The default resize policy is vertical. Framework utilities such as `resize-y`
and `resize-none` can be passed through `root-class` when a design has an
explicit reason to change it.

## State and lifecycle

`element.value` reads current native text; assignment updates the visible
control. `element.state` reports current value, disabled and invalid state.
`setState()` updates the ordinary owner. Disconnect/re-render destroys and
rebinds field, reset and Mask hooks without duplicate listeners.

Use Smart Textarea for free text that may contain multiple lines. Use Input for
single-line values, and a specialized editor for rich text or code. Keep a
visible accessible label and a repair-oriented error message.
