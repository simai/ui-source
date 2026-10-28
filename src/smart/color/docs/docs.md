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

## Theme colour (`variant="theme"`)

`variant="theme"` turns the control into the button a product puts wherever
people pick a theme: one icon-only primary `sf-icon-button` with the icon
`palette`, named «Цвет темы» / «Theme colour» (`label` overrides it). A press
opens the platform's colour picker -- the native input lies under the button,
out of the focus order, so there is no popover of its own.

```html
<sf-color variant="theme" clearable></sf-color>
```

- While the colour moves (`input`), the page theme follows it after 120 ms of
  quiet: `SF.ThemePalette.themeFromColor` applied to `<html>`, so every
  `--sf-<palette>-<tone>` primitive such as `--sf-primary-40` changes.
- When the picker commits (`change`), the theme applies at once and `change`
  fires once with `{value, name}`.
- A colour that moved but was not committed (Escape, cancel) goes back to the
  last committed one -- when the browser restores the input, or at the next
  press or key on the page.
- `clearable` adds a second button («Вернуть исходный цвет темы» / «Use the
  original theme colour», or `clear-label`): the value empties and the
  variables the control changed go back to what the page had before -- the
  Framework colour unless the page set its own. `clear()` does the same.
- An empty value means the page's own theme. A value written from code or in
  markup (`value="#3366ff"`) applies the theme silently, so a page that keeps
  the colour restores it by setting `value`; the control stores nothing.
  Removing the element leaves the theme applied.

`SF.ThemePalette` is not inside this bundle: the first theme control asks the
Loader for it (`SF.Loader.ensurePlugin('theme-palette')`, the
`theme-palette:ready` event). The palette calculation is larger than the
colour control itself, and a field-variant colour does not need it.
