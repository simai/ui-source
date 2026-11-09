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

// The static palette (owner decision C17, 2026-11-08; research
// control/research/2026-11-08-palette.md 3.2): sixteen fixed hues run through
// the same generator as the theme, so every hue has the same sixteen tones and
// the same translucent steps, and no theme colour moves them. Every colour in
// the product comes from this palette or from the dynamic one the theme makes
// (C18). The four status hues keep their numbers, byte for byte: red is error,
// amber warning, green success, blue info. Information is a status, not the
// brand (owner, 2026-10-21, simai/ui-source#14): blue is the fixed palette of
// #005bbe, HCT hue 265.1 at chroma 58.6 -- the nearest tenth above #005bbe's
// own 58.5, the one that puts tone 40 on #005bbe itself. Every added hue is
// chroma 60, brown 30 and gray 0. No hue is shifted toward the theme colour
// (research 3.3): a hue keeps its name on every site.
//
// The order is the order of the hue circle, gray last; the CSS primitives
// --sf-<hue>-<tone> are written from it by scripts/generate-static-palette.mjs
// into src/core/scss/_sf_static_palette.scss.
export const STATIC_HUES = Object.freeze({
  red: Object.freeze({hue: 25, chroma: 85}),
  orange: Object.freeze({hue: 45, chroma: 60}),
  amber: Object.freeze({hue: 60, chroma: 60}),
  yellow: Object.freeze({hue: 90, chroma: 60}),
  lime: Object.freeze({hue: 120, chroma: 60}),
  green: Object.freeze({hue: 145, chroma: 65}),
  teal: Object.freeze({hue: 175, chroma: 60}),
  cyan: Object.freeze({hue: 205, chroma: 60}),
  sky: Object.freeze({hue: 235, chroma: 60}),
  blue: Object.freeze({hue: 265.1, chroma: 58.6}),
  indigo: Object.freeze({hue: 285, chroma: 60}),
  violet: Object.freeze({hue: 305, chroma: 60}),
  purple: Object.freeze({hue: 325, chroma: 60}),
  pink: Object.freeze({hue: 350, chroma: 60}),
  brown: Object.freeze({hue: 50, chroma: 30}),
  gray: Object.freeze({hue: 265, chroma: 0}),
});

export const STATIC_HUE_NAMES = Object.freeze(Object.keys(STATIC_HUES));

// The hue each status is.
export const STATUS_HUES = Object.freeze({error: 'red', warning: 'amber', success: 'green', info: 'blue'});

function statusRule(status) {
  const {hue, chroma} = STATIC_HUES[STATUS_HUES[status]];
  return {hue, chroma};
}

// The translucent steps of every static hue: the status steps, tone 50 at the
// state and fill families (4 to 32) and tone 90 at 4, 8, 12 and 24.
export const STATIC_ALPHA = Object.freeze({50: Object.freeze([4, 8, 12, 16, 20, 24, 28, 32]), 90: Object.freeze([4, 8, 12, 24])});

// The generator's defaults. `hue` and `chroma` are either a number or a
// function of the primary's; a caller may override any of them.
export const THEME_RULES = Object.freeze({
  primary: {hue: (source) => source.hue, chroma: (source) => source.chroma},
  secondary: {hue: (source) => source.hue, chroma: 20},
  tertiary: {hue: (source) => (source.hue + 60) % 360, chroma: 40},
  // The greys take the source's hue at chroma 5, or at the source's own chroma
  // when that is lower (C16): a near-grey brand colour made teal or violet
  // greys out of a hue it barely has.
  neutral: {hue: (source) => source.hue, chroma: (source) => Math.min(5, source.chroma)},
  // The four statuses are four hues of the static palette (C17): error is red,
  // warning amber, success green and info blue, by the same numbers, so a
  // status and its hue are one palette. A theme may still override a status
  // here; the hue it was made from stays as it is.
  error: statusRule('error'),
  warning: statusRule('warning'),
  success: statusRule('success'),
  info: statusRule('info'),
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
  info: {50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
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

/**
 * The static palette: for every hue its HCT numbers and its sixteen tones,
 * {name: {hue, chroma, tones}}. The same TonalPalette as the theme's, so a
 * status palette the theme makes is the static hue it names, byte for byte.
 */
export function staticPalette() {
  const palettes = {};
  for (const [name, {hue, chroma}] of Object.entries(STATIC_HUES)) {
    const palette = TonalPalette.fromHueAndChroma(hue, chroma);
    palettes[name] = {hue, chroma, tones: Object.fromEntries(THEME_TONES.map((tone) => [tone, hexFromArgb(palette.tone(tone))]))};
  }
  return palettes;
}

/** The static palette's CSS custom properties, {name: value}: --sf-<hue>-<tone> and --sf-<hue>-<tone>--alfa-<n>. */
export function staticVariables(palettes = staticPalette()) {
  const variables = {};
  for (const [name, palette] of Object.entries(palettes)) {
    for (const tone of THEME_TONES) {
      variables[`--sf-${name}-${tone}`] = palette.tones[tone];
      for (const step of STATIC_ALPHA[tone] ?? []) variables[`--sf-${name}-${tone}--alfa-${step}`] = `${palette.tones[tone]}${alphaHex(step)}`;
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
  window.SF.ThemePalette = Object.freeze({themeFromColor, themeFromHct, colorToHct, themeToCss, themeVariables, applyTheme, isThemeColor, staticPalette, staticVariables, THEME_TONES, THEME_PALETTES, THEME_ALPHA, STATIC_HUES, STATIC_HUE_NAMES, STATUS_HUES, STATIC_ALPHA, DEFAULT_THEME_COLOR});
}
