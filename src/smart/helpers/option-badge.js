import {canonicalBadgeScheme} from "../../component/badges/js/contract.js";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Badge look for a filter option with optionRenderer 'badge'. option.color is
 * a Framework badge scheme (success, error, info...) or a hex colour; a hex
 * colour tints the tonal background and keeps the text on the surface colour,
 * so the label stays readable in both themes. Anything else is neutral.
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
    if (HEX_COLOR.test(color)) {
        return {
            scheme: "neutral",
            rootStyle: `--sf-badge--background-color: color-mix(in srgb, ${color} 24%, transparent); --sf-badge--color: var(--sf-on-surface)`,
        };
    }
    return {scheme: "neutral", rootStyle: ""};
}
