// The colour arithmetic of sf-input-color's own picker (owner decision C83):
// reading what a person types or pastes, and the four ways the code field
// shows a colour (Hex, RGB, HSL, HSB -- R170, Figma's set). Pure functions, no
// DOM, so the unit suite reads them directly.

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// The sixteen hues of the static palette (owner decision C17), in the
// palette's own order. A palette colour is stored by this name, one in every
// language (C83); the screen shows the translated word and the theme picks
// the tone. tests/input-color-c83.contract.test.mjs holds the list equal to
// core/js/theme-palette.js STATIC_HUE_NAMES, which this bundle does not import
// (the HCT solver behind it is larger than the control).
export const PALETTE = Object.freeze([
    'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan',
    'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'gray',
]);

// The tone a palette colour is painted in: the graphic tone of C17's charts and
// markers, 50 on a light page and 70 on a dark one, picked by the page's own
// colour scheme.
export const paletteFill = (name) => `light-dark(var(--sf-${name}-50), var(--sf-${name}-70))`;

export const isPaletteName = (value) => PALETTE.includes(value);

// #rgb, #rgba, #rrggbb and #rrggbbaa.
const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

/** {rgb: [r, g, b] 0..255, a: 0..1} of a hex, or null. */
export function parseHex(text) {
    const match = HEX.exec(String(text ?? '').trim());
    if (!match) return null;
    let digits = match[1];
    if (digits.length < 5) digits = [...digits].map((digit) => digit + digit).join('');
    const channels = [0, 2, 4, 6].map((at) => parseInt(digits.slice(at, at + 2) || 'ff', 16));
    return {rgb: channels.slice(0, 3), a: channels[3] / 255};
}

const hex2 = (number) => Math.round(clamp(number, 0, 255)).toString(16).padStart(2, '0');

/** Lowercase #rrggbb, or #rrggbbaa when the colour is translucent. */
export function toHex([r, g, b], alpha = 1) {
    const a = Math.round(clamp(alpha, 0, 1) * 255);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 255 ? hex2(a) : ''}`;
}

/**
 * The value form of a hex: lowercase #rrggbb, #rrggbbaa below full alpha (an
 * opaque #rrggbbff is #rrggbb), or '' for anything that is not a hex.
 */
export function normaliseHex(text) {
    const parsed = parseHex(text);
    return parsed ? toHex(parsed.rgb, parsed.a) : '';
}

export const alphaOf = (value) => parseHex(value)?.a ?? 1;
export const solidOf = (value) => {
    const parsed = parseHex(value);
    return parsed ? toHex(parsed.rgb) : '';
};

export function hsvToRgb(h, s, v) {
    const f = (n) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export function rgbToHsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
}

export function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s, l];
}

export function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// Relative luminance and the WCAG ratio, for the ink of the check drawn inside
// a chosen swatch: black or white, whichever reads better on it.
const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb) => {
    const [r, g, b] = rgb.map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (one, two) => {
    const x = luminance(one);
    const y = luminance(two);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
export const darkInk = (rgb) => contrast(rgb, [0, 0, 0]) >= contrast(rgb, [255, 255, 255]);

export const FORMATS = Object.freeze(['hex', 'rgb', 'hsl', 'hsb']);
export const FORMAT_LABELS = Object.freeze({hex: 'Hex', rgb: 'RGB', hsl: 'HSL', hsb: 'HSB'});

/** The code field's text for the colour [h, s, v] in a format. */
export function formatColour([h, s, v], format) {
    const rgb = hsvToRgb(h, s, v);
    if (format === 'rgb') return rgb.map(Math.round).join(', ');
    if (format === 'hsl') {
        const [hue, sat, light] = rgbToHsl(rgb);
        return `${Math.round(hue)}°, ${Math.round(sat * 100)}%, ${Math.round(light * 100)}%`;
    }
    if (format === 'hsb') return `${Math.round(h)}°, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%`;
    return toHex(rgb).toUpperCase();
}

const FUNCTION = /^(rgba?|hsla?|hsb|hsv)\(|\)$/giu;

/**
 * What the code field holds, read in the chosen format: {rgb, a} or null. A hex
 * is a hex in every format; three numbers are the format's channels; anything
 * else the browser calls a colour (oklch(), a name) is asked of `cssColour`,
 * which the element answers through the page (CSS.supports and a computed
 * style), so a developer may paste any CSS colour (R170).
 */
export function parseColour(text, format, cssColour = () => null) {
    const value = String(text ?? '').trim();
    if (!value) return null;
    const hex = parseHex(value);
    if (hex && (format === 'hex' || value.startsWith('#'))) return hex;
    const body = value.replace(FUNCTION, '');
    const numbers = body.split(/[\s,/]+/u).filter(Boolean).map((part) => parseFloat(part));
    const plain = !/[a-z(]/iu.test(body.replace(/[°%]/gu, ''));
    if (plain && numbers.length >= 3 && numbers.slice(0, 3).every((n) => Number.isFinite(n))) {
        const [one, two, three] = numbers;
        const hue = ((one % 360) + 360) % 360;
        if (format === 'rgb' && [one, two, three].every((n) => n >= 0 && n <= 255)) return {rgb: [one, two, three], a: 1};
        if (format === 'hsl' && two >= 0 && two <= 100 && three >= 0 && three <= 100) return {rgb: hslToRgb(hue, two / 100, three / 100), a: 1};
        if (format === 'hsb' && two >= 0 && two <= 100 && three >= 0 && three <= 100) return {rgb: hsvToRgb(hue, two / 100, three / 100), a: 1};
    }
    if (hex) return hex;
    return cssColour(value);
}

/** Whether a typed colour names its own alpha (#rgba, #rrggbbaa). */
export const statesAlpha = (text) => /^#?(?:[0-9a-f]{4}|[0-9a-f]{8})$/iu.test(String(text ?? '').trim());
