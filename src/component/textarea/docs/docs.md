# Textarea

`Textarea` renders or upgrades a native multiline form control. The nested
`<textarea>` owns its value, selection, line breaks, validation, form submission
and reset. The Framework root owns label, hint, variants, size and states.

## Markup and variants

Use `label.sf-textarea` with a visible `.sf-textarea-text` and one native
`<textarea>`. The supported surfaces are `bordered` and `filled`; supported
sizes are `1/3`, `1/2`, `1`, `2` and `3`.

The control resizes vertically by default. Use the Framework utilities
`resize-none`, `resize-y`, `resize-x` or `resize` only when the containing layout
has an explicit alternative policy. Horizontal resizing can break responsive
containers and is not the default.

## Native metadata

Authors may use the complete native textarea API in markup. The constructor also
projects `autocomplete`, `inputMode`, `minLength`, `maxLength`, `spellcheck` and
`wrap`. A visible label is the accessible name; placeholder is supplementary.

Readonly fields remain focusable and copyable but do not receive editable hover.
Disabled fields keep the same geometry and do not participate in form submission.
Use `invalid` as the canonical runtime state; `error` remains a visual alias.
Hint and error messages are synchronized through `aria-describedby` and
`aria-errormessage`.

## Runtime

Existing and dynamically inserted roots are upgraded automatically. The public
`SF.Textarea.setState(root, state)` updates `value`, `disabled`, `invalid` or
`errorMessage`. Form reset restores the native default value. Optional Mask
integration accepts the same short `data-mask`, `data-mask-pattern` and
`data-mask-options` contract as Input.

Pointer focus is visually quiet; keyboard focus remains visible. Presentation,
hairline, UI radius, spacing, typography, semantic colors and motion use only
Framework tokens.
