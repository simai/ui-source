export const BADGE_TYPES = Object.freeze(['main', 'tonal', 'outline']);
export const BADGE_SCHEMES = Object.freeze([
    'neutral',
    'primary',
    'secondary',
    'tertiary',
    'info',
    'success',
    'warning',
    'danger',
    'on-surface',
]);
export const BADGE_SIZES = Object.freeze(['1/3', '1/2', '1']);

const DEFAULT_BADGE_TYPE = 'main';
const DEFAULT_BADGE_SCHEME = 'neutral';
const DEFAULT_BADGE_SIZE = '1/3';

const normalizeEnum = (value, allowed, fallback) => {
    const normalized = String(value ?? fallback).trim().toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
};

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
    const normalizedScheme = normalizeEnum(
        scheme,
        BADGE_SCHEMES,
        DEFAULT_BADGE_SCHEME,
    );
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
