# Smart Color

`sf-color` sets a colour anywhere one is set: a theme, a site's own look, a
label, a chart series. A swatch opens the platform's colour picker; `swatches`
offers the colours a product already has (`#hex` or `#hex|Name`, comma
separated). The value is `#rgb`, `#rrggbb` or `#rrggbbaa`; `name` submits it
through a hidden input, empty while nothing is chosen.

`input` fires on every step of a drag across the picker, `change` once when a
colour is committed; both carry `{value, name}`.

```html
<sf-color name="brand" label="Brand colour" inherited-value="#336699"
          swatches="#1f6feb|Brand blue, #e5534b|Alert"></sf-color>
```

## Inherited value

`inherited-value` is the colour that applies while nothing is chosen. The chip
paints it and a «наследуется» marker stands after it; the form value stays
empty, because «not set» follows the theme and «set to the same colour» does
not. Once a colour is chosen, the marker gives way to a reset button
(`reset-label`, or its first name `clear-label`). Pressing it fires the
cancellable `sf-field:reset` with `{value, inheritedValue, name}`; not
prevented, the colour empties with `input` and `change`, the inherited colour
shows again and focus returns to the picker. `element.resetToInherited()` does
the same from code.

The state is the one sf-input, sf-textarea, sf-dropdown and sf-switch share
(`src/smart/helpers/inherited-value.js`). Without `inherited-value`,
`clearable` still offers a button that empties the colour.
