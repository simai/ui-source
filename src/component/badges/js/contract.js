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

// The default look is tonal (owner decision C140 (1), badges study BG-1): a
// badge without an appearance is the calm grey mark. It was main, the dark
// grey fill nobody chose.
const DEFAULT_BADGE_TYPE = 'tonal';
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

// The looks that are drawn: tonal and outline in every colour, main only with
// the error status (C140 (4)).
export const BADGE_VARIANTS = Object.freeze(
    BADGE_SCHEMES.flatMap((scheme) =>
        BADGE_TYPES
            .filter((type) => type !== 'main' || scheme === 'error')
            .flatMap((type) =>
                BADGE_SIZES.map((size) => Object.freeze({type, scheme, size})),
            ),
    ),
);

// The filled look is the attention count's alone (owner decision C140 (4)):
// main with the error status. main with any other colour draws tonal; the
// spelling keeps working until this date and each use is noted in
// SF.deprecations (journal value-badge-appearance-main-to-tonal).
export const BADGE_MAIN_TONAL = Object.freeze({since: '2026-11-14', remove_after: '2027-01-01'});

// True when an appearance asked for is the filled one on a colour that draws
// it tonal: the caller notes the old spelling.
export function isRetiredMain({type, scheme} = {}) {
    const requested = String(type ?? '').trim().toLowerCase();
    return requested === 'main' && (canonicalBadgeScheme(scheme ?? DEFAULT_BADGE_SCHEME) || DEFAULT_BADGE_SCHEME) !== 'error';
}

export function normalizeBadgeContract({type, scheme, size} = {}) {
    let normalizedType = normalizeEnum(type, BADGE_TYPES, DEFAULT_BADGE_TYPE);
    const normalizedScheme = canonicalBadgeScheme(scheme ?? DEFAULT_BADGE_SCHEME)
        || DEFAULT_BADGE_SCHEME;
    const normalizedSize = normalizeEnum(size, BADGE_SIZES, DEFAULT_BADGE_SIZE);

    // main is the attention count's: with any other colour it is tonal. The
    // tonal on-surface badge is the grey tonal one (the stylesheet draws
    // sf-badge--on-surface tonal as neutral); it was drawn main, filled.
    if (normalizedType === 'main' && normalizedScheme !== 'error') {
        normalizedType = 'tonal';
    }

    return {
        type: normalizedType,
        scheme: normalizedScheme,
        size: normalizedSize,
    };
}
