import {canonicalBadgeScheme} from "../../component/badges/js/contract.js";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// The hues of the static palette (owner decision C17), each with the OKLCH hue
// angle of its tone 50 (src/core/scss/_sf_static_palette.scss, rounded to the
// degree; tests/option-badge-palette.contract.test.mjs holds the two equal).
// Brown and gray are not reached from a hex: brown sits between orange and
// amber and differs from them by chroma alone, which a light or a dark hex
// does not keep; a colour with less chroma than GREY_CHROMA is gray. Both are
// reached by name.
export const OPTION_BADGE_HUES = Object.freeze({
    red: 28, orange: 47, amber: 60, yellow: 89, lime: 119, green: 144, teal: 173,
    cyan: 203, sky: 232, blue: 259, indigo: 279, violet: 299, purple: 320, pink: 347,
});
export const OPTION_BADGE_PALETTE = Object.freeze([...Object.keys(OPTION_BADGE_HUES), "brown", "gray"]);
const GREY_CHROMA = 0.03;

const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// {chroma, hue} in OKLCH of a #rgb[a] / #rrggbb[aa]; the alpha is not read.
function oklchOf(hex) {
    let digits = hex.slice(1);
    if (digits.length < 6) digits = [...digits].map((digit) => digit + digit).join("");
    const [r, g, b] = [0, 2, 4].map((at) => linear(parseInt(digits.slice(at, at + 2), 16)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return {chroma: Math.hypot(a, bb), hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360};
}

/** The static palette hue nearest a hex colour: gray when it has no hue to speak of. */
export function nearestPaletteHue(hex) {
    const {chroma, hue} = oklchOf(hex);
    if (chroma < GREY_CHROMA) return "gray";
    let best = "gray";
    let distance = Infinity;
    for (const [name, angle] of Object.entries(OPTION_BADGE_HUES)) {
        const apart = Math.abs(((hue - angle + 540) % 360) - 180);
        if (apart < distance) {
            best = name;
            distance = apart;
        }
    }
    return best;
}

// The fill of a hue: tone 50 at the fill step 24 (C43: no new tones or steps;
// the alpha scale's fill family), over the place in both themes, as the 24 %
// mix of the data's hex was. The text stays on the surface colour, so the
// label reads the same in both themes. Written to the badge's public
// variables, --sf-badge-background-color and --sf-badge-color (owner decision
// C140 (2), BG-7): a colour from data reaches the badge only through them and
// only as a palette step, never the author's hex.
const paletteStyle = (hue) =>
    `--sf-badge-background-color: var(--sf-${hue}-50--alfa-24); --sf-badge-color: var(--sf-on-surface)`;

/**
 * Badge look for a filter option with optionRenderer 'badge'. option.color is
 * a Framework badge scheme (success, error, info...), a hue of the static
 * palette (red, teal, gray...; C17) or a hex colour. A hue tints the badge with
 * its own palette step; a hex is drawn in the palette hue nearest it, never as
 * the raw colour (C18, C43; badges study BG-7), so the label stays readable in
 * both themes. Anything else is neutral.
 */
// The data view port names the badge look `scheme` on a column's options; a
// filter option has always said `color`. Both are read: reading only `color`
// left every port column's scheme unread and its badges neutral.
export function optionBadgeProps(option = {}) {
    const raw = option?.scheme ?? option?.color;
    const color = typeof raw === "string" ? raw.trim() : "";
    // A former name (danger) reads as its canonical scheme (error).
    const scheme = canonicalBadgeScheme(color);
    if (scheme) return {scheme, rootStyle: ""};
    const name = color.toLowerCase();
    if (OPTION_BADGE_PALETTE.includes(name)) return {scheme: "neutral", rootStyle: paletteStyle(name)};
    if (HEX_COLOR.test(color)) return {scheme: "neutral", rootStyle: paletteStyle(nearestPaletteHue(color))};
    return {scheme: "neutral", rootStyle: ""};
}
