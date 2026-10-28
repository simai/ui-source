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
`themeVariables`, `applyTheme`, `isThemeColor`, and the constants
`THEME_TONES`, `THEME_PALETTES`, `THEME_ALPHA`, `DEFAULT_THEME_COLOR`.
