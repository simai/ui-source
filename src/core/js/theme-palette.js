// A whole theme from one colour (owner, 2026-10-10: «a Smart component where
// you choose the main colour and it makes all the other variables»).
//
// The Framework's colours are eight tonal palettes of sixteen tones each --
// --sf-<palette>-<tone>, 98 down to 5 -- and every semantic token (--sf-primary,
// --sf-surface, --sf-outline, ...) reads them through light-dark(). So a theme
// is those 128 primitives, and nothing else needs to change.
//
// The palettes are made the way the SIMAI generator makes them (ui-doc,
// fundamentals/color/color-generator), on Google's HCT colour space: the chosen
// colour gives the primary palette its hue and chroma, and the others follow
// fixed rules. Fed the Framework's own primary (#005bbe: hue 265, chroma 85 as
// the generator's UI Kit values), these rules give back all 128 shipped
// primitives exactly -- tests/theme-palette.contract.test.mjs holds that.
//
// The generator's own inputs are a hue and a chroma in whole numbers
// (themeFromHct). A colour is read as them (themeFromColor): its hue to the
// degree, and its chroma -- unless the colour is as vivid as its hue can be at
// its tone, which a dark or a light brand colour always is. Then its own
// chroma is the gamut's limit, not the palette it stands for, and the
// generator's default vivid chroma is taken. #005bbe has chroma 59, the most
// hue 265 holds at tone 40; the palette it stands for is 85.
//
// HCT is Google's material-color-utilities 0.4.0 (Apache-2.0), the eight files
// it needs copied unchanged under ./vendor/material-color-utilities.
import {Hct} from './vendor/material-color-utilities/hct/hct.js';
import {TonalPalette} from './vendor/material-color-utilities/palettes/tonal_palette.js';
import {argbFromHex, hexFromArgb} from './vendor/material-color-utilities/utils/string_utils.js';

export const THEME_TONES = Object.freeze([98, 95, 90, 85, 80, 70, 60, 50, 40, 35, 30, 25, 20, 15, 10, 5]);

// The generator's defaults. `hue` and `chroma` are either a number or a
// function of the primary's; a caller may override any of them.
export const THEME_RULES = Object.freeze({
  primary: {hue: (source) => source.hue, chroma: (source) => source.chroma},
  secondary: {hue: (source) => source.hue, chroma: 20},
  tertiary: {hue: (source) => (source.hue + 60) % 360, chroma: 40},
  neutral: {hue: (source) => source.hue, chroma: 5},
  error: {hue: 25, chroma: 85},
  warning: {hue: 60, chroma: 60},
  success: {hue: 145, chroma: 65},
  // Information is told in the brand's own colour.
  info: {hue: (source) => source.hue, chroma: (source) => source.chroma},
});

export const THEME_PALETTES = Object.freeze(Object.keys(THEME_RULES));

// The translucent steps core defines on a tone: --sf-<palette>-<tone>--alfa-<n>,
// the tone with n% opacity (the alpha scale: state 4/8/12, fill 12-32, ink
// 48/64/80). Core writes them as literal colours, so a theme that set the tones
// alone left every container fill and hover in the old hue (DEV, 2026-10-18:
// a tonal button stayed blue under a green theme). The theme writes them from
// its own tones; tests/theme-palette.contract.test.mjs holds this list to the
// one core declares.
export const THEME_ALPHA = Object.freeze({
  primary: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  secondary: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  tertiary: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  neutral: {50: [4, 8, 12, 16, 20, 24, 32, 48, 80], 60: [48, 64], 80: [48], 90: [4, 8, 12, 16, 20, 24, 32, 48]},
  error: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  warning: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  success: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  info: {50: [12, 16, 20, 24, 28, 32]},
});

const alphaHex = (percent) => Math.round((percent * 255) / 100).toString(16).padStart(2, '0');

// The Framework's own primary: the theme every page has until one is chosen.
export const DEFAULT_THEME_COLOR = '#005bbe';

const HEX = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

export function isThemeColor(value) {
  return typeof value === 'string' && HEX.test(value.trim());
}

const expand = (value) => {
  const text = value.trim().replace(/^#/u, '').toLowerCase();
  return `#${text.length === 3 ? [...text].map((digit) => digit + digit).join('') : text}`;
};

const round = (number) => Math.round(number * 10) / 10;

// The chroma the generator gives a vivid colour (UI Kit primary).
export const VIVID_CHROMA = 85;

/**
 * The generator's inputs a colour stands for: {hue, chroma, hex, tone}.
 */
export function colorToHct(color) {
  if (!isThemeColor(color)) throw new TypeError(`A theme colour is a hex colour, #rgb or #rrggbb: ${String(color)}`);
  const hex = expand(color);
  const hct = Hct.fromInt(argbFromHex(hex));
  // As vivid as the hue holds at this tone: asked for far more, the tone
  // comes back no more chromatic than the colour itself.
  const limit = Hct.from(hct.hue, 200, hct.tone).chroma;
  const chroma = hct.chroma >= limit - 1 ? Math.max(VIVID_CHROMA, Math.round(hct.chroma)) : Math.round(hct.chroma);
  return {hex, hue: Math.round(hct.hue) % 360, chroma, tone: round(hct.tone)};
}

/**
 * The theme of a primary hue and chroma, the generator's own inputs: each
 * palette's hue, chroma and tones. `options[palette]` overrides that palette's
 * rule: {hue?, chroma?}.
 */
export function themeFromHct({hue, chroma} = {}, options = {}) {
  if (!Number.isFinite(hue) || !Number.isFinite(chroma)) throw new TypeError('A theme is made from a hue and a chroma');
  const source = {hue: ((hue % 360) + 360) % 360, chroma: Math.max(0, chroma)};
  const palettes = {};
  for (const name of THEME_PALETTES) {
    const rule = {...THEME_RULES[name], ...(options[name] ?? {})};
    const paletteHue = typeof rule.hue === 'function' ? rule.hue(source) : Number(rule.hue);
    const paletteChroma = typeof rule.chroma === 'function' ? rule.chroma(source) : Number(rule.chroma);
    if (!Number.isFinite(paletteHue) || !Number.isFinite(paletteChroma)) throw new TypeError(`${name}: hue and chroma are numbers`);
    const palette = TonalPalette.fromHueAndChroma(((paletteHue % 360) + 360) % 360, Math.max(0, paletteChroma));
    palettes[name] = {
      hue: round(palette.hue),
      chroma: round(palette.chroma),
      tones: Object.fromEntries(THEME_TONES.map((tone) => [tone, hexFromArgb(palette.tone(tone))])),
    };
  }
  return {schema: 'simai.framework.theme', schema_version: 1, source, palettes};
}

/** The theme one colour makes (see colorToHct for how it is read). */
export function themeFromColor(color = DEFAULT_THEME_COLOR, options = {}) {
  const read = colorToHct(color);
  const theme = themeFromHct(read, options);
  return {...theme, source: {...theme.source, hex: read.hex, tone: read.tone}};
}

/** The theme's CSS custom properties, {name: value}. */
export function themeVariables(theme) {
  const variables = {};
  for (const [name, palette] of Object.entries(theme?.palettes ?? {})) {
    for (const [tone, value] of Object.entries(palette.tones ?? {})) variables[`--sf-${name}-${tone}`] = value;
  }
  for (const [name, palette] of Object.entries(theme?.palettes ?? {})) {
    for (const [tone, steps] of Object.entries(THEME_ALPHA[name] ?? {})) {
      const base = palette.tones?.[tone];
      if (!base) continue;
      for (const step of steps) variables[`--sf-${name}-${tone}--alfa-${step}`] = `${base}${alphaHex(step)}`;
    }
  }
  return variables;
}

/** The theme as a stylesheet rule, for a page's or a site's own CSS. */
export function themeToCss(theme, selector = ':root') {
  const lines = Object.entries(themeVariables(theme)).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

/**
 * Applies the theme to an element's inline style (the page by default) and
 * returns a function that takes it off again.
 */
export function applyTheme(theme, target = globalThis.document?.documentElement) {
  if (!target?.style) return () => {};
  const variables = themeVariables(theme);
  const before = Object.fromEntries(Object.keys(variables).map((name) => [name, target.style.getPropertyValue(name)]));
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
  return () => {
    for (const [name, value] of Object.entries(before)) {
      if (value) target.style.setProperty(name, value);
      else target.style.removeProperty(name);
    }
  };
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.ThemePalette = Object.freeze({themeFromColor, themeFromHct, colorToHct, themeToCss, themeVariables, applyTheme, isThemeColor, THEME_TONES, THEME_PALETTES, THEME_ALPHA, DEFAULT_THEME_COLOR});
}
