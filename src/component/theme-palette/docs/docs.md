# Theme palette

`SF.ThemePalette` makes a whole theme from one colour: the eight tonal
palettes as the `--sf-<palette>-<tone>` primitives and their translucent steps.
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
`themeVariables`, `applyTheme`, `isThemeColor`, `staticPalette`,
`staticVariables`, and the constants `THEME_TONES`, `THEME_PALETTES`,
`THEME_ALPHA`, `STATIC_HUES`, `STATIC_HUE_NAMES`, `STATUS_HUES`,
`STATIC_ALPHA`, `DEFAULT_THEME_COLOR`.

## The static palette

Beside the theme's palettes, which move with the main colour, the Framework
has sixteen fixed hues (owner decision C17): red, orange, amber, yellow, lime,
green, teal, cyan, sky, blue, indigo, violet, purple, pink, brown and gray.
They come from the same generator, every one with the same sixteen tones and
translucent steps, as the `--sf-<hue>-<tone>` primitives (`--sf-green-50`,
`--sf-green-50--alfa-12`) that core.css declares; no theme colour moves them.
The statuses are four of them: error is red, warning amber, success green and
info sky (info is not blue, which reads as the Framework's own primary). `staticPalette()` returns each hue's numbers and tones,
`staticVariables()` the primitives, and `STATIC_HUES`, `STATIC_HUE_NAMES`,
`STATUS_HUES` and `STATIC_ALPHA` are the lists they are made from.

A component that needs a colour of its own takes the name of a hue; the class
`sf-hue-<name>` (any static hue, or `primary`, `secondary`, `tertiary`) gives
its element the roles `--sf-hue`, `--sf-on-hue`, `--sf-hue-container` (with
`-hover` and `-active`), `--sf-on-hue-container`,
`--sf-on-hue-container-graphic` and `--sf-hue-outline`, light and dark.

