export const BADGE_TYPES = Object.freeze(['main', 'tonal', 'outline']);
export const BADGE_SCHEMES = Object.freeze([
    'neutral',
    'primary',
    'secondary',
    'tertiary',
    'info',
    'success',
    'warning',
    'error',
    'on-surface',
]);
// Former scheme names that still draw: `danger` was this component's word for
// the error status before the shared vocabulary (contracts/public-api-axes.json,
// journal class-status-aliases, until 2026-12-01). It is read as `error`, so the
// Native constructor emits the canonical class, as sf-badge does; the
// stylesheet matches `.sf-badge--danger` beside it for markup written by hand.
export const BADGE_SCHEME_ALIASES = Object.freeze({danger: 'error'});
export const BADGE_SIZES = Object.freeze(['1/3', '1/2', '1']);

const DEFAULT_BADGE_TYPE = 'main';
const DEFAULT_BADGE_SCHEME = 'neutral';
const DEFAULT_BADGE_SIZE = '1/3';

const normalizeEnum = (value, allowed, fallback) => {
    const normalized = String(value ?? fallback).trim().toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
};

// The canonical scheme for a name, a former one included; '' when the name is
// not a badge scheme.
export function canonicalBadgeScheme(value) {
    const name = String(value ?? '').trim().toLowerCase();
    const canonical = BADGE_SCHEME_ALIASES[name] ?? name;
    return BADGE_SCHEMES.includes(canonical) ? canonical : '';
}

export const BADGE_VARIANTS = Object.freeze(
    BADGE_SCHEMES.flatMap((scheme) =>
        BADGE_TYPES
            .filter((type) => !(scheme === 'on-surface' && type === 'tonal'))
            .flatMap((type) =>
                BADGE_SIZES.map((size) => Object.freeze({type, scheme, size})),
            ),
    ),
);

export function normalizeBadgeContract({type, scheme, size} = {}) {
    let normalizedType = normalizeEnum(type, BADGE_TYPES, DEFAULT_BADGE_TYPE);
    const normalizedScheme = canonicalBadgeScheme(scheme ?? DEFAULT_BADGE_SCHEME)
        || DEFAULT_BADGE_SCHEME;
    const normalizedSize = normalizeEnum(size, BADGE_SIZES, DEFAULT_BADGE_SIZE);

    if (normalizedType === 'tonal' && normalizedScheme === 'on-surface') {
        normalizedType = 'main';
    }

    return {
        type: normalizedType,
        scheme: normalizedScheme,
        size: normalizedSize,
    };
}
