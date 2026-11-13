# Theme palette

`SF.ThemePalette` makes a whole theme from one colour: the four theme
palettes -- primary, secondary, tertiary and neutral -- as the 64
`--sf-<palette>-<tone>` primitives and their 80 translucent steps. The four
status palettes are not part of a theme: core declares them as the static hues
below, and no theme writes them. Until 2027-01-01 the former shape still
works with a warning: a status override passed to `themeFromColor` or
`themeFromHct` (`{error: {...}}`) is ignored, and `theme.palettes.error`
(`warning`, `success`, `info`) reads the static hue core draws that status
with -- read-only, not enumerable. Each use is listed in
`SF.deprecations.list()` and printed in the console only when the page opts in
(`<html data-sf-deprecations="warn">` or `SF.deprecations.warn = true`); read
`staticPalette()[STATUS_HUES.error]` instead. After that date the override
throws a `TypeError` and the read is gone.

A grey makes a grey theme (C16): a colour no more chromatic than the greys
(HCT chroma under 5 -- black, white and the near-greys) keeps its own chroma,
and the secondary and tertiary palettes take it too, so no palette of the theme
is more chromatic than the colour it was made from. Every other colour gives
the neutral palette at most chroma 5 and never more than its own.
The theme generator uses it, and a page can load it alone -- a main-colour
swatch that applies the theme from the picked colour needs the calculation,
not the generator's panel.

## Loading it

```js
SF.Loader.ensurePlugin('theme-palette');
SF.Loader.ready('theme-palette', (palette) => {
  const restore = palette.applyTheme(palette.themeFromColor('#3366ff'));
  // restore() puts the variables it changed back
});
```

An element with `data-sf-theme-palette` on the page loads it too. The
`theme-palette:ready` window event carries the same object in `detail`.

## API

`themeFromColor`, `themeFromHct`, `colorToHct`, `themeToCss`,
`themeVariables`, `themeChecks`, `contrastRatio`, `applyTheme`,
`isThemeColor`, `staticPalette`, `staticVariables`, and the constants
`THEME_TONES`, `THEME_PALETTES`, `THEME_ALPHA`, `THEME_CHECKS`,
`STATIC_HUES`, `STATIC_HUE_NAMES`, `STATUS_HUES`, `STATIC_ALPHA`,
`DEFAULT_THEME_COLOR`.

`themeChecks(theme)` says what a person should know about a theme, as
`[{code, level, ...}]`: `contrast` (error: the text on a filled control is
under 4.5 : 1 in the `light` or `dark` scheme, with its `ratio`), `adjusted`
(warning: a light or a very dark colour whose buttons get tone 40, `to`,
instead of the colour, `from`), `close-to-status` (warning: a vivid colour
within 16 degrees of a status hue, `status`) and `grey` (notice: a nearly grey
colour). `THEME_CHECKS` holds their numbers, `contrastRatio(a, b)` is the WCAG
2 ratio of two colours.

## The static palette

Beside the theme's palettes, which move with the main colour, the Framework
has sixteen fixed hues (owner decision C17): red, orange, amber, yellow, lime,
green, teal, cyan, sky, blue, indigo, violet, purple, pink, brown and gray.
They come from the same generator, every one with the same sixteen tones and
translucent steps, as the `--sf-<hue>-<tone>` primitives (`--sf-green-50`,
`--sf-green-50--alfa-12`) that core.css declares; no theme colour moves them.
The statuses are four of them: error is red, warning amber, success green and
info blue (owner decision C100: blue reads best as information, and it does not shift on a
site whose brand colour is blue). `staticPalette()` returns each hue's numbers and tones,
`staticVariables()` the primitives, and `STATIC_HUES`, `STATIC_HUE_NAMES`,
`STATUS_HUES` and `STATIC_ALPHA` are the lists they are made from.

A component that needs a colour of its own takes the name of a hue; the class
`sf-hue-<name>` (any static hue, or `primary`, `secondary`, `tertiary`) gives
its element the roles `--sf-hue`, `--sf-on-hue`, `--sf-hue-container` (with
`-hover` and `-active`), `--sf-on-hue-container`,
`--sf-on-hue-container-graphic` and `--sf-hue-outline`, light and dark.

