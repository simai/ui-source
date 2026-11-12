// A whole theme from one colour (owner, 2026-10-10: «a Smart component where
// you choose the main colour and it makes all the other variables»).
//
// The Framework's colours are tonal palettes of sixteen tones each --
// --sf-<palette>-<tone>, 98 down to 5 -- and every semantic token (--sf-primary,
// --sf-surface, --sf-outline, ...) reads them through light-dark(). A theme is
// the four dynamic palettes -- primary, secondary, tertiary and neutral, 64
// primitives and their 80 translucent steps -- and nothing else needs to
// change. The four status palettes are not the theme's: core declares them as
// var() of the static hues (C17), and a theme that wrote them as literal
// colours froze them at the hues of the day it was made (TG-01, 2026-11-11:
// info stayed blue on a themed page after core moved it to sky).
//
// The palettes are made the way the SIMAI generator makes them (ui-doc,
// fundamentals/color/color-generator), on Google's HCT colour space: the chosen
// colour gives the primary palette its hue and chroma, and the others follow
// fixed rules. Fed the Framework's own primary (#005bbe: hue 265, chroma 85 as
// the generator's UI Kit values), these rules give back the 64 shipped
// primitives of the dynamic palettes exactly -- tests/theme-palette.contract.test.mjs
// holds that.
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
import {noteDeprecated} from './deprecations.js';

export const THEME_TONES = Object.freeze([98, 95, 90, 85, 80, 70, 60, 50, 40, 35, 30, 25, 20, 15, 10, 5]);

// The static palette (owner decision C17, 2026-11-08; research
// control/research/2026-11-08-palette.md 3.2): sixteen fixed hues run through
// the same generator as the theme, so every hue has the same sixteen tones and
// the same translucent steps, and no theme colour moves them. Every colour in
// the product comes from this palette or from the dynamic one the theme makes
// (C18). The status hues keep their numbers, byte for byte: red is error,
// amber warning, green success, sky info. Information is a status, not the
// brand (owner, 2026-10-21, simai/ui-source#14), and not blue either: blue
// reads as the Framework's own primary (C17 as amended by the owner
// 2026-11-11), so info is sky. Blue is the fixed palette of #005bbe, HCT hue 265.1 at chroma 58.6 -- the nearest tenth above #005bbe's
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

// The hue each status is. Core's --sf-<status>-<tone> are var() of these
// hues' primitives; a theme does not write them (TG-01).
export const STATUS_HUES = Object.freeze({error: 'red', warning: 'amber', success: 'green', info: 'sky'});

// The translucent steps of every static hue: the status steps, tone 50 at the
// state and fill families (4 to 32), tone 90 at 4, 8, 12 and 24, and tone 20
// at the state and fill families and the ink steps 64 and 80 -- the dark ink of
// a coloured place (C16, research 2026-11-08-surfaces 4.3; dispatcher 2026-11-09).
export const STATIC_ALPHA = Object.freeze({
  20: Object.freeze([4, 8, 12, 16, 20, 24, 64, 80]),
  50: Object.freeze([4, 8, 12, 16, 20, 24, 28, 32]),
  90: Object.freeze([4, 8, 12, 24]),
});

// The greys' chroma, and the line under which a colour is a grey (C16): a
// colour no more chromatic than the greys has no hue to give a theme.
const NEUTRAL_CHROMA = 5;

// A grey colour makes a grey theme (C16, TG-03): its secondary and tertiary
// take its own chroma, not 20 and 40 in a hue it barely has -- #111111 is HCT
// hue 209, and a chroma-20 secondary of it is a bluish grey.
const accent = (chroma) => (source) => (source.chroma < NEUTRAL_CHROMA ? source.chroma : chroma);

// The generator's defaults. `hue` and `chroma` are either a number or a
// function of the primary's; a caller may override any of them.
export const THEME_RULES = Object.freeze({
  primary: {hue: (source) => source.hue, chroma: (source) => source.chroma},
  secondary: {hue: (source) => source.hue, chroma: accent(20)},
  tertiary: {hue: (source) => (source.hue + 60) % 360, chroma: accent(40)},
  // The greys take the source's hue at chroma 5, or at the source's own chroma
  // when that is lower (C16): a near-grey brand colour made teal or violet
  // greys out of a hue it barely has.
  neutral: {hue: (source) => source.hue, chroma: (source) => Math.min(NEUTRAL_CHROMA, source.chroma)},
  // No status rule: the four statuses are four hues of the static palette
  // (C17: error red, warning amber, success green, info sky), declared by core
  // and moved by no theme (TG-01).
});

export const THEME_PALETTES = Object.freeze(Object.keys(THEME_RULES));

// The translucent steps core defines on a dynamic palette's tone: --sf-<palette>-<tone>--alfa-<n>,
// the tone with n% opacity (the alpha scale: state 4/8/12, fill 12-32, ink
// 48/64/80). Core writes them as literal colours, so a theme that set the tones
// alone left every container fill and hover in the old hue (DEV, 2026-10-18:
// a tonal button stayed blue under a green theme). The theme writes them from
// its own tones; tests/theme-palette.contract.test.mjs holds this list to the
// one core declares.
export const THEME_ALPHA = Object.freeze({
  primary: {20: [4, 8, 12, 16, 20, 24, 64, 80], 50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  secondary: {20: [4, 8, 12, 16, 20, 24, 64, 80], 50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  tertiary: {20: [4, 8, 12, 16, 20, 24, 64, 80], 50: [4, 8, 12, 16, 20, 24, 28, 32], 90: [4, 8, 12, 24]},
  neutral: {50: [4, 8, 12, 16, 20, 24, 32, 48, 80], 60: [48, 64], 80: [48], 90: [4, 8, 12, 16, 20, 24, 32, 48]},
});

const STATUS_NAMES = Object.freeze(Object.keys(STATUS_HUES));

// The status palettes left the theme on 2026-11-12 (TG-01). Until
// STATUS_COMPAT.remove_after a status override in the options is ignored and
// theme.palettes.<status> still reads -- as the static hue core draws it with.
// Each use is noted in SF.deprecations, like every compatibility note
// (contracts/lifecycle-policy.json): always in the list, in the console only
// when the page opts in (data-sf-deprecations="warn" or SF.deprecations.warn)
// (journal option-theme-status-override, property-theme-status-palettes).
// After that date the override throws and the read is undefined.
export const STATUS_COMPAT = Object.freeze({since: '2026-11-12', remove_after: '2027-01-01',
  docs: 'https://ui.simai.io/ru/smart-components/forms/theme-generator/'});

function noteStatusUse(kind, names) {
  const from = kind === 'option' ? `themeFromHct options ${names.join(', ')}` : `theme.palettes.${names.join(', ')}`;
  noteDeprecated({component: 'theme-palette', kind, from,
    to: `SF.ThemePalette.staticPalette()[SF.ThemePalette.STATUS_HUES.<status>] (${STATUS_COMPAT.docs})`,
    since: STATUS_COMPAT.since, remove_after: STATUS_COMPAT.remove_after});
}

const compatOpen = (now = new Date()) => now.toISOString().slice(0, 10) <= STATUS_COMPAT.remove_after;

/**
 * The read-only status palettes of the former theme shape, until
 * STATUS_COMPAT.remove_after: theme.palettes.error (and warning, success,
 * info) is the static hue core draws that status with, each read noted in
 * SF.deprecations (the console only when the page opts in). Not enumerable, so Object.keys, JSON and the CSS
 * see the four theme palettes only. Returns the theme.
 */
export function withStatusCompat(theme) {
  const palettes = theme?.palettes;
  if (!palettes || !compatOpen()) return theme;
  for (const status of STATUS_NAMES) {
    if (Object.hasOwn(palettes, status)) continue;
    Object.defineProperty(palettes, status, {
      configurable: true,
      enumerable: false,
      get() {
        noteStatusUse('property', [status]);
        const {hue, chroma, tones} = staticPalette()[STATUS_HUES[status]];
        return {hue, chroma, tones: {...tones}};
      },
    });
  }
  return theme;
}

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
  // comes back no more chromatic than the colour itself. Not a grey, though
  // (C16, TG-03): at black and white the gamut holds no chroma at all, so
  // #000000 and #ffffff are "as vivid as they can be" and read as chroma 85
  // -- a pink theme from black, a teal one from white. A colour no more
  // chromatic than the greys keeps its own chroma.
  const limit = Hct.from(hct.hue, 200, hct.tone).chroma;
  const vivid = hct.chroma >= NEUTRAL_CHROMA && hct.chroma >= limit - 1;
  const chroma = vivid ? Math.max(VIVID_CHROMA, Math.round(hct.chroma)) : Math.round(hct.chroma);
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
  const overridden = STATUS_NAMES.filter((status) => options?.[status] !== undefined);
  if (overridden.length) {
    if (!compatOpen()) throw new TypeError(`${overridden.join(', ')}: a status palette is core's static hue, not a theme's (TG-01)`);
    noteStatusUse('option', overridden);
  }
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
  return withStatusCompat({schema: 'simai.framework.theme', schema_version: 1, source, palettes});
}

/** The theme one colour makes (see colorToHct for how it is read). */
export function themeFromColor(color = DEFAULT_THEME_COLOR, options = {}) {
  const read = colorToHct(color);
  const theme = themeFromHct(read, options);
  return {...theme, source: {...theme.source, hex: read.hex, tone: read.tone}};
}

/**
 * The theme's CSS custom properties, {name: value}: the dynamic palettes'
 * tones and translucent steps. A theme object stored before TG-01 still holds
 * the four status palettes; they are not written, so core's static hues apply.
 */
export function themeVariables(theme) {
  const variables = {};
  const palettes = THEME_PALETTES.map((name) => [name, theme?.palettes?.[name]]).filter(([, palette]) => palette);
  for (const [name, palette] of palettes) {
    for (const [tone, value] of Object.entries(palette.tones ?? {})) variables[`--sf-${name}-${tone}`] = value;
  }
  for (const [name, palette] of palettes) {
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
 * {name: {hue, chroma, tones}}. The same TonalPalette as the theme's.
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

// What a person should know about the theme a colour makes (docs study
// 2026-11-11 TG-04; the checks of prototypes/theme-generator-study.html, C84):
// the generator took a light colour to a darker button or a red one to a
// button beside «Удалить» and said nothing.
const relativeLuminance = (hex) => {
  const channel = (at) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/** WCAG 2 contrast ratio of two #rrggbb colours. */
export function contrastRatio(a, b) {
  const [high, low] = [relativeLuminance(expand(a)), relativeLuminance(expand(b))].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const hueDistance = (a, b) => {
  const apart = Math.abs(a - b) % 360;
  return apart > 180 ? 360 - apart : apart;
};

// The numbers of the checks: text on a filled control at 4.5 (WCAG AA); a
// colour lighter than tone 58 or darker than 25 is not the one its buttons
// get (tone 40); a vivid colour (chroma over 40) within 16 degrees of a
// status hue reads as that status; under chroma 8 the accent is a grey.
export const THEME_CHECKS = Object.freeze({contrast: 4.5, light: 58, dark: 25, statusHue: 16, statusChroma: 40, grey: 8});

// The light scheme's --sf-on-primary is --sf-white: tone 100 of any palette.
const ON_PRIMARY_LIGHT = hexFromArgb(TonalPalette.fromHueAndChroma(0, 0).tone(100));

/**
 * The checks of a theme, [{code, level, ...}], in this order:
 * - {code: 'contrast', level: 'error', scheme: 'light'|'dark', ratio}: the
 *   text on a filled control (--sf-on-primary on --sf-primary) is under 4.5;
 * - {code: 'adjusted', level: 'warning', from, to, lighter}: the colour is
 *   light or dark, and its buttons get tone 40 (`to`), not the colour itself;
 * - {code: 'close-to-status', level: 'warning', status, hue}: the colour is
 *   near a status hue (error red, warning amber, success green, info sky),
 *   which no theme moves (C17, C90);
 * - {code: 'grey', level: 'notice'}: the colour is nearly grey, so are its
 *   accents.
 * The ratios are rounded to a tenth. A theme made from a hue and a chroma
 * (no hex) has no 'adjusted' check.
 */
export function themeChecks(theme) {
  const checks = [];
  const primary = theme?.palettes?.primary?.tones;
  const source = theme?.source ?? {};
  if (!primary) return checks;
  const light = contrastRatio(ON_PRIMARY_LIGHT, primary[40]);
  const dark = contrastRatio(primary[20], primary[80]);
  if (light < THEME_CHECKS.contrast) checks.push({code: 'contrast', level: 'error', scheme: 'light', ratio: round(light)});
  if (dark < THEME_CHECKS.contrast) checks.push({code: 'contrast', level: 'error', scheme: 'dark', ratio: round(dark)});
  if (source.hex && Number.isFinite(source.tone) && (source.tone > THEME_CHECKS.light || source.tone < THEME_CHECKS.dark)
    && source.hex !== primary[40]) {
    checks.push({code: 'adjusted', level: 'warning', from: source.hex, to: primary[40], lighter: source.tone > THEME_CHECKS.light});
  }
  if (source.chroma > THEME_CHECKS.statusChroma) {
    for (const [status, hueName] of Object.entries(STATUS_HUES)) {
      if (hueDistance(source.hue, STATIC_HUES[hueName].hue) < THEME_CHECKS.statusHue) checks.push({code: 'close-to-status', level: 'warning', status, hue: hueName});
    }
  }
  if (source.chroma < THEME_CHECKS.grey) checks.push({code: 'grey', level: 'notice'});
  return checks;
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
  window.SF.ThemePalette = Object.freeze({themeFromColor, themeFromHct, colorToHct, themeToCss, themeVariables, themeChecks, contrastRatio, applyTheme, isThemeColor, staticPalette, staticVariables, THEME_TONES, THEME_PALETTES, THEME_ALPHA, STATIC_HUES, STATIC_HUE_NAMES, STATUS_HUES, STATIC_ALPHA, THEME_CHECKS, DEFAULT_THEME_COLOR});
}
