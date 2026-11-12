# Smart Color

`sf-input-color` sets a colour anywhere one is set: a theme, a site's own look, a
label, a chart series. It is a field of the control ladder -- a swatch, the value
and a chevron -- that opens the Framework's own compact window (owner decision
C83). The browser's colour dialog is never used.

```html
<sf-input-color name="label-color" label="Цвет метки" value="blue"></sf-input-color>
<sf-input-color name="brand" label="Фирменный цвет" value="#1f6feb"
          swatches="#1f6feb|Фирменный синий, red|Тревога"></sf-input-color>
```

## The value

- A palette colour is stored by its name: `red`, `orange`, `amber`, `yellow`,
  `lime`, `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`,
  `pink`, `brown`, `gray` -- the sixteen hues of the static palette (C17). The
  name is the same in every language; the field shows the translated word
  («Синий», "Blue") and paints the tone the theme picks (50 on a light page, 70
  on a dark one). Labels, tags and chart series keep the name, so they follow
  the dark theme.
- An own colour is stored as its code: `#rrggbb`, or `#rrggbbaa` with `alpha`.
  `#rgb` and `#rgba` are read and stored long, lowercase.
- Empty means nothing is chosen and the inherited colour applies.

`input` fires while a colour moves (each step of a drag, each key in the code
field that reads as a colour), `change` once when it is committed; both carry
`{value, name}`. The form gets the value through ElementInternals.

## The window

A press on the field, `Enter` or `Space` opens the window under the field: 304
px wide on a desktop, never taller than the room it has, following the field
when the page scrolls; on a phone (below 44rem) a sheet at the bottom of the
screen. `Escape` closes it and focus returns to the field.

- «Палитра / Своё» is the standard `sf-segmented`. The window opens on the view
  the value comes from.
- «Палитра»: the product's own colours (`swatches`), the sixteen palette hues
  and, after a thin divider, the recent own colours. Each group is a radio
  group: arrows move and choose, `Home` and `End` go to the ends; a press
  chooses and closes the window.
- «Своё»: the shade area (saturation across, brightness up), the eyedropper
  (only where the browser has `EyeDropper`; elsewhere it is shown disabled with
  the reason), the hue strip, the alpha strip with `alpha`, and one row
  «format ▾ | code | %». The formats are Hex, RGB, HSL and HSB; any CSS colour
  may be pasted (`oklch(…)`, a name) and is shown back in the chosen format.
  Arrows move the area and the strips by one, `Shift` by ten.

Recent own colours are one list for every colour field of the site (a view
preference, `SF.Preferences` key `sf-color-recent`; the browser keeps it as
`sf-pref:sf-color-recent`): own colours only, newest first, sixteen kept,
eight shown. A field without `alpha` does not show translucent ones.

A translucent colour is drawn split everywhere: the left half without alpha, the
right half as it is over a checkerboard (C86).

## Settings

| Attribute | Default | What it does |
| --- | --- | --- |
| `label` | — | The field's label above it, as every field draws it; it also names the field. |
| `size` | `1` | `1/2`, `1` or `2`: the control ladder step. |
| `appearance` | `bordered` | How the swatch is bounded: `bordered`, `outlined`, `plain`. |
| `palette` | `true` | `palette="false"` hides the sixteen hues. |
| `custom` | `true` | `custom="false"` keeps the palette only (task labels, chart series). |
| `alpha` | `false` | An own colour may be translucent. |
| `swatches` | — | The product's colours: `#hex`, `#hex|Name` or `name|Name`, comma separated. |
| `clearable` | `false` | A button that empties the colour when there is no inherited one. |
| `variant` | `field` | `theme`: the page-theme circle (below). |

`openPicker()` and `closePicker()` open and close the window from code.

## Inherited value

`inherited-value` is the colour that applies while nothing is chosen. The field
shows it in the value's place with a «наследуется» marker at its end; the form
value stays empty, because «not set» follows the theme and «set to the same
colour» does not. Once a colour is chosen, the marker gives way to a reset
button (`reset-label`, or its first name `clear-label`). Pressing it fires the
cancellable `sf-field-reset` with `{value, inheritedValue, name}`; not
prevented, the colour empties with `input` and `change`, the inherited colour
shows again and focus returns to the field. `element.resetToInherited()` does
the same from code.

## Theme colour (`variant="theme"`)

`variant="theme"` is the colour a site header holds (C84): only a circle of the
current colour, named «Цвет темы» / "Theme colour" (`label` or `aria-label`
overrides it). A press opens the same window as the field, at its normal size.

```html
<sf-input-color variant="theme" size="1/2" clearable></sf-input-color>
```

- While the colour moves, the page theme follows it after 120 ms of quiet:
  `SF.ThemePalette.themeFromColor` applied to `<html>`. A chosen colour applies
  at once and `change` fires once.
- The value is always a code: a palette hue is stored as its tone 50.
- `clearable` adds a button («Вернуть исходный цвет темы» / "Use the original
  theme colour", or `clear-label`) that returns the page to the theme it had.
- A value written from code applies the theme silently; the control stores
  nothing. Removing the element leaves the theme applied.

`SF.ThemePalette` is not inside this bundle: the first theme control asks the
Loader for it (`SF.Loader.ensurePlugin('theme-palette')`).
