# Inputs Component

`Inputs` is a `ComponentObserver`-based component for `.sf-input` markup.

JS class: `Inputs` (`src/component/inputs/js/_inputs.js`)  
Registration: `registerComponent('Inputs', Inputs)`

## Runtime behavior

- Existing `label.sf-input` and `div.sf-input` nodes are auto-bound on init.
- Dynamically added ones are auto-bound via `MutationObserver`.
- The native input owns its value, focus, validation, form submission and reset.
- Constructor `inputType` is bounded to `text`, `email`, `password`, `search`,
  `tel` or `url`; unsupported values fall back to `text`.
- Constructor `inputMode`, `autocomplete`, `minLength`, `maxLength` and
  `pattern` project the corresponding native metadata.
- `size` is bounded to `1/3`, `1/2`, `1`, `2` or `3`; `type` is bounded to
  `bordered`, `filled` or the compatibility-only `hidden` presentation.
  A filled field's placeholder keeps the quiet ink `--sf-on-surface-variant`
  (on the fill, `--sf-on-surface-container-variant`); only the value is
  `--sf-on-surface` (1.3.1, FA-08). Under the pointer the placeholder takes
  `--sf-on-surface-container-variant`, the dim ink made for a fill: on the
  hover step the place's dim ink fell under 4.5:1 in the dark theme (1.4.2,
  C113 follow-up).
- A filled field draws its bottom edge in `--sf-outline` at rest (C52): the
  12 % fill (C113, 1.4.2) alone stands 1.15 to 1.39 from its place. Hover and press
  colour the line with the border; focus turns the whole border
  `--sf-outline`. A project's `--sf-input-border-color` colours the line.
- Read-only inputs remain focusable and selectable but do not use editable
  hover or active feedback.
- An action inside a field (`.sf-field-action`, owner decision C123: the
  clear, the password reveal, a copy, a dropdown's chevron) has no plate in any
  state: `--sf-on-surface-variant` at rest, `--sf-on-surface` under the
  pointer, `--sf-primary` on a press (1.8.0, owner decision C201: the ink of
  the icon button's plain look, `sf-icon-button--plain`). Its hit area is the
  field's height and its keyboard ring stands round the glyph inside the
  field (C123). The value ends half an inset before the first glyph and
  glyphs stand half an inset apart at every size (C123 (4)); a hit area
  wider than its step -- the password eye's touch square (sf-input C191
  (2)) -- gives the extra back on its start side and overlaps the value's
  padding, so the steps hold on a touch screen too (1.14.1; it was 12
  instead of 6 at size 2 on a phone).
- A label row (`.sf-input-label`) that holds its text in `.sf-input-text`
  and an `sf-help-mark` is running text, not a flex row: the mark stands
  `--sf-input-label--gap` after the label's last word, centred on the line it
  stands on, so on a wrapped label it follows the last word on the last line
  (1.4.0, C33; written as 1.3.1 on fix/c33-wrapped-help-mark). A label row with bare text (the `label` slot of `sf-input`)
  stays a flex row.

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

## Markup with a hint (1.13.0, DF-3)

A wrapping `label.sf-input` names its input by everything inside it: the
label text, the hint under the field, a help mark's name, a counter. Until the
script points `aria-labelledby` at the label text, a screen reader reads the
hint as part of the label, and a page without the script keeps it so. The
`div.sf-input` root keeps the hint out of the name in the markup itself: the
label text is a `<label for>` of its own, `label.sf-input-text` inside the
label row, and the hint a sibling the input points at with `aria-describedby`.
The star and a help mark stand in the row beside the label, outside it.

```html
<div class="sf-input sf-input--size-1 sf-input--bordered flex flex-col">
  <span class="sf-input-label flex">
    <label class="sf-input-text" for="email">Work email</label>
  </span>
  <span class="sf-input-field items-cross-center transition flex">
    <i class="sf-icon" aria-hidden="true">mail</i>
    <input id="email" type="email" name="email" autocomplete="email" aria-describedby="email-hint">
  </span>
  <span class="sf-input-hint-text-wrap" id="email-hint">Used for notices only</span>
</div>
```

The name is the label text alone and the hint is the description, with or
without the script. Both roots draw the same (the stylesheet reads classes,
not tags). The script binds both; on a `div.sf-input` it also hands a press on
the box (its padding, an icon, the text before or after the value) to the
input, which the wrapping label did, and writes `for` on `label.sf-input-text`
when it has none. The constructor builds the `div` form. `label.sf-input`
stays supported.

The id the script gives the label text is its own: `<input id>-label` when no
element holds it, else the first free `<input id>-label-<n>`. Before 1.13.0 a
page whose field root already carried that id had the input labelled by the
root, the hint with it.

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

Layout without the script (1.9.0, RG-B-53): the layout the component's
script gives the parts it builds (`json/*.utility.json`) is in the stylesheet
too, so markup a page writes draws the same without the script and where the
script never builds the part: `.sf-input`, `.sf-input .sf-input-field`, `.sf-input .sf-input-label`, `.sf-input .sf-input-field input`. It stands in `@layer sf.base`, under
the utilities and the component rules, so a utility class on the element still
wins; a root a Smart element drew (a child of `[data-sf-started]`, or printed
`[data-sf-static]`) is left as it was. Generated by
`scripts/generate-utility-hint-layout.mjs` into
`scss/_css__utility_hint_layout.scss`.
