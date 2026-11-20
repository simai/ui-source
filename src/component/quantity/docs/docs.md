# Quantity Component

`Quantity` is a numeric stepper component with:
- label + required marker
- minus/plus icon buttons
- numeric input in the middle

JS class: `Quantity` (`src/component/quantity/js/_quantity.js`)  
Registration: `registerComponent('Quantity', Quantity)`

## Supported params (component constructor)

- `size`: `1/2 | 1 | 2` (default: `1`). Form fields have three sizes; a retired `1/3` or `3` renders as `1/2` or `2` with a console warning.
- `label`: string (default: `Label`)
- `required`: boolean (default: `true`)
- `value`: initial value (if omitted, value is taken from input attrs or left empty)
- `min`: minimum value
- `max`: maximum value
- `step`: increment/decrement step (default: `1`)
- `name`: input `name`
- `disabled`: boolean (default: `false`)
- `readonly`: boolean (default: `false`)
- `placeholder`: native input placeholder
- `decrementLabel`: accessible name of the decrement button
- `incrementLabel`: accessible name of the increment button
- `decrementIcon`: icon name for minus button (default: `remove`)
- `incrementIcon`: icon name for plus button (default: `add`)
- `precision`: decimal digits for display/rounding
- `grouping`: thousands grouping in UI (`true/false`, default: `true`)
- `locale`: locale for formatting (for example `ru-RU`, `en-US`)
- `inputMode`: `soft | strict` (default: `soft`)
- `allowNegative`: allow minus sign (`true/false`, default: `false`)
- `allowDecimal`: allow decimal separator (`true/false`, default: `precision > 0`)
- `mask`: enable Framework mask for this input (`true/false`, default: `false`)

## Runtime formatting attributes

You can configure formatting from markup as well:

- `data-precision="0|1|2|..."`
- `data-grouping="true|false"`
- `data-locale="ru-RU"`
- `data-input-mode="soft|strict"`
- `data-allow-negative="true|false"`
- `data-allow-decimal="true|false"`
- `data-mask="true|false"`

They can be set on `.sf-quantity` or on the internal `<input>`.

When `data-mask="true"` (or `mask: true`), the component uses `window.SF.Mask`
(project-owned mask runtime) for numeric typing. The mask runtime is loaded only when needed.

## Value behavior

- Internal editable text can contain grouped values (`2 567`, `2,567.50`, etc.).
- Component stores normalized number in `input.dataset.rawValue`.
- On `blur` and `+/-` clicks value is formatted according to:
  - `precision`
  - `grouping`
  - `locale`
- `+/-` respects `step`, `min`, `max`; a no-op boundary action does not emit
  an extra `change` event.
- A direct value is clamped to `min/max` on blur without implicit step-grid
  snapping.
- Buttons are auto-disabled when the input is disabled or readonly, and the
  corresponding button is disabled at its numeric boundary.

## Events

After `+/-` actions component dispatches on input:
- `change`

This allows external listeners to react without additional integration code.
Direct editing retains the browser's native `input` and `change` events.

## Look

A plain `sf-quantity` is bordered, as in the released pair (owner decision
C283, 2026-11-17). `sf-quantity--filled` draws it filled on request: the
container fill, no border, the bottom line in `--sf-outline` -- the look of
`sf-input--filled` and `sf-textarea--filled`.
Under the pointer the fill takes its hover step and the edge the text ink;
while someone types the fill gives way to the ordinary field's edge; an invalid
field takes the error container fill, a disabled one the disabled fill.
`sf-quantity--bordered` names the default.
`--sf-quantity-background-color` is the fill and `--sf-quantity-border-color`
the edge and the bottom line (1.7.0, owner decision C224; 1.9.0, C283: filled on request).

```html
<label class="sf-quantity sf-quantity--size-1 sf-quantity--filled">...</label>
```

## Focus and geometry

The field is on the size ladder: the box is `--sf-ui-<size>--control-height`
tall, exactly as an Input of the same size, with the same block padding, and
the value shares the Input's text line. The steppers are icon buttons one rung
down (a size `1` field carries size `1/2` steppers) whatever size class the
markup gives them, and stand as far from the field's side as from its top and
bottom. Their glyph is the field's own icon, the size an Input draws its icon
at the same size: 24 in a size `1` field on a desktop (1.1.2, QT-03).

The steppers are quiet neutral ghost icon buttons (`sf-icon-button--icon
sf-icon-button--ghost sf-icon-button--on-surface
sf-icon-button--on-surface-variant`, decision C15): no plate at rest, the
surface hover fill and the on-surface ink under a pointer, the disabled ink at a
bound. The retired `secondary` scheme drew no plate and no hover (1.1.2, QT-04);
old markup that still carries it keeps working without the hover.

A read-only field draws its edge with the region line `--sf-outline-variant`,
as an Input's read-only field does, and takes no hover border (1.1.2, QT-08).
Like that field it has no fill (`--sf-transparent`, also over
`--sf-quantity-background-color`; C16: a fill reads as a control to press),
keeps the value in full ink, shows no hover or press colour on the box, the
number or the placeholder, and its steppers are disabled buttons; the value
stays focusable and selectable (1.4.3).

The class markup (`label.sf-quantity` with `.sf-quantity-wrap` as its own
child) is as wide as its column: the number stretches between the steppers,
`--sf-quantity-gap` (`--sf-space-2`) stands between the parts and the number
keeps the field's text inset. The compact look of owner decision C53 (the
steppers hug the number, gap 0, the number as wide as its digits) is
`sf-input-quantity`'s; it reaches the box only through that element's
`.sf-quantity-row` (1.4.4).

The composite control uses the UI radius token `--sf-radius--ui`, the hairline
token `--sf-px`, semantic typography and spacing tokens. Focus by mouse and by
keys is one look (owner decision C153 (4)): a 2 px edge of the focus colour
inside the box, over its border, with no ring outside, as an Input; a stepper
reached by keys draws its own ring inwards, including forced-colors mode.
Disabled and readonly states do not alter the selected size geometry.

`sf-quantity--pointer-focus` no longer changes the look (1.10.0, C153 (4)
finished; it hid nothing that was still drawn). The script writes it on the
root while a pointer focus lasts until 2027-01-01, for a page selector that
reads it (journal `class-quantity-pointer-focus-c153`); a page that needs the
difference reads `:focus-visible` instead.

## Input mode behavior

- `soft`:
  - user can type freely,
  - value is softly sanitized on `input`,
  - full formatting is applied on `blur` and on `+/-`.

- `strict`:
  - invalid symbols are blocked during typing (`beforeinput`),
  - paste is sanitized/validated before insertion,
  - full formatting is applied on `blur` and on `+/-`.

## Markup example

```html
<label class="sf-quantity sf-quantity--size-1">
  <span class="sf-quantity-label">
    <span class="sf-quantity-text">Label</span>
    <span class="sf-quantity-required">*</span>
  </span>

  <span class="sf-quantity-wrap">
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--on-surface-variant sf-icon-button--size-1/3">
      <i class="sf-icon">remove</i>
    </button>
    <input
      type="text"
      value="2567.5"
      step="0.01"
      min="0"
      data-precision="2"
      data-grouping="true"
      data-locale="ru-RU"
    />
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--on-surface-variant sf-icon-button--size-1/3">
      <i class="sf-icon">add</i>
    </button>
  </span>
</label>
```

Layout without the script (1.5.0, RG-B-53): the layout the component's
script gives the parts it builds (`json/*.utility.json`) is in the stylesheet
too, so markup a page writes draws the same without the script and where the
script never builds the part: `.sf-quantity`, `.sf-quantity .sf-quantity-label`, `.sf-quantity .sf-quantity-wrap`, `.sf-quantity .sf-quantity-count`, `.sf-quantity .sf-quantity-wrap input`. It stands in `@layer sf.base`, under
the utilities and the component rules, so a utility class on the element still
wins; a root a Smart element drew (a child of `[data-sf-started]`, or printed
`[data-sf-static]`) is left as it was. Generated by
`scripts/generate-utility-hint-layout.mjs` into
`scss/_css__utility_hint_layout.scss`.

## Width (C396)

A field may be at most 20, 28 or 44 characters of the width ladder wide, and
the container's width below that: put `sf-field--width-short`, `-medium` or
`-long` on the field's root (`.sf-quantity`). The roles are core's
(`--sf-field--width-short / -medium / -long` on `--sf-measure-20 / -28 / -44`:
160 / 224 / 352 px at text 16, 140 / 196 / 308 in compact density and on a
phone) and the rule is core's too, so the class markup and `sf-input-quantity` (its
`width` setting, which writes the same class) draw the same width from the
first frame. Without the class the field is its container's width, as before.

```html
<div class="sf-quantity sf-field--width-short">…</div>
```
