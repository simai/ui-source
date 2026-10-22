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

## Auto-grow

`auto-grow` makes the field follow its text: it starts at `min-rows` (default
1), grows one line at a time and, past `max-rows`, stays at that height and
scrolls inside. With no `max-rows` it grows without a cap; a `max-rows` below
`min-rows` is read as `min-rows`. Deleting text shrinks it back. `rows` is not
used while `auto-grow` is on, and the field is not resizable by hand.

```html
<sf-textarea label="Comment" auto-grow min-rows="1" max-rows="6"></sf-textarea>
```

Heights stay on the size ladder: one row is exactly as tall as an `sf-input` or
`sf-button` of the same size, and each further row adds the text line height of
that size; the padding is the field's own. The browser does the sizing with CSS
`field-sizing: content` where it has it; elsewhere a script measures the text on
input, on a value set from code (`element.value`, `setState`), on form reset and
when the width changes. An IME composition is measured once, when it ends, and
the page does not scroll while the field is measured.

Enter stays a newline. Sending on Enter is a chat composer's own behaviour and is
not part of the textarea.

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
