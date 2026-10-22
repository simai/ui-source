# Inputs Component

`Inputs` is a `ComponentObserver`-based component for `.sf-input` markup.

JS class: `Inputs` (`src/component/inputs/js/_inputs.js`)  
Registration: `registerComponent('Inputs', Inputs)`

## Runtime behavior

- Existing `label.sf-input` nodes are auto-bound on init.
- Dynamically added `label.sf-input` nodes are auto-bound via `MutationObserver`.
- The native input owns its value, focus, validation, form submission and reset.
- Constructor `inputType` is bounded to `text`, `email`, `password`, `search`,
  `tel` or `url`; unsupported values fall back to `text`.
- Constructor `inputMode`, `autocomplete`, `minLength`, `maxLength` and
  `pattern` project the corresponding native metadata.
- `size` is bounded to `1/3`, `1/2`, `1`, `2` or `3`; `type` is bounded to
  `bordered`, `filled` or the compatibility-only `hidden` presentation.
- Read-only inputs remain focusable and selectable but do not use editable
  hover or active feedback.

## Global helper

Available as:

- `window.SF.Input.setState(target, state)`

`state` fields:

- `disabled: boolean`
- `error: boolean` (toggles `input.error`); `invalid: boolean` is the same
- `errorMessage: string` -- the text under the field. It is the error message
  (`aria-errormessage` points at it) while the field is invalid, and the hint
  otherwise, so `{invalid: false, errorMessage: hint}` restores the hint
- `value: string|number` (sets value and dispatches `input`)

`target` can be:

- root `.sf-input` element
- inner input element

## Mask support (SF.Mask adapter)

Mask is optional and provided by the project-owned `window.SF.Mask` browser runtime.

Enable mask:

- `data-mask="true"` on `.sf-input` or inner `<input>`

Mask config options:

- `data-mask-options='{"mask":"+{7}(000)000-00-00"}'` (JSON string)
- or `data-mask-pattern="+{7}(000)000-00-00"` (short form)
- `data-mask-lazy="false"` to show the mask skeleton
- `data-mask-placeholder-char="_"` to define the skeleton placeholder character

Pattern grammar:

- `0` a digit, `a` a letter, `*` any character;
- `{...}` a fixed part that belongs to the value: `+{7}` prints `+7`, and the
  unmasked value starts with `7`;
- `\` escapes the next character; every other character is a fixed part that
  is only shown;
- `[` and `]` are accepted and ignored: every slot is optional while the mask is
  lazy.

A number mask is `{"mask": "Number"}` with IMask's options: `scale` (fraction
digits, default 2), `radix` (default `,`; `.` and `,` typed are both read as
the radix), `thousandsSeparator`, `signed`, `min`, `max`, `padFractionalZeros`,
`normalizeZeros`. It groups while the number is typed and clamps, scales and
pads when the field is left.

Priority:

1. input `data-mask-options`
2. root `data-mask-options`
3. input/root `data-mask-pattern`

## Example

```html
<label class="sf-input sf-input--size-1 sf-input--bordered" data-mask="true">
  <span class="sf-input-field">
    <input
      type="text"
      data-mask-options='{"mask":"+{7}(000)000-00-00"}'
      data-mask-lazy="false"
      data-mask-placeholder-char="_"
      placeholder="+7(___)___-__-__"
    />
  </span>
</label>
```

## Touch phones

On a touch phone (`(hover: none) and (pointer: coarse)` below 60rem) the field
text is at least 16px, so iOS Safari does not zoom the page on focus; the line
height and the control height stay the step's. See
`docs/foundation-touch-fields.md`.
