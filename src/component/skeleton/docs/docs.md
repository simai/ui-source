# Skeleton

Skeleton temporarily reserves the geometry of content that is expected to
arrive. It is not a progress indicator, an empty state or an error message.

The shapes are decorative and use `aria-hidden="true"`. The host region of the
future content owns `aria-busy="true"` and clears that state when real content,
an empty state or an error replaces the skeleton.

## Anatomy and geometry

- `.sf-skeleton` groups related shapes and owns their spacing and animation.
- `.sf-skeleton-text` is one reserved shape.
- `sf-skeleton-text--size-*` follows the Framework typography scale.
- `sf-skeleton-icon` makes inline and block size equal for avatar and icon
  placeholders.
- `sf-skeleton-circle`, `sf-skeleton-square` and `sf-skeleton-rounded` select
  circle, unrounded and surface-radius geometry.

Use Framework width and height utilities or the constructor's relative widths
and dimension tokens. Match the final content closely enough that replacement
does not shift the surrounding layout.

## Motion

The group accepts `sf-skeleton--animation-pulse`,
`sf-skeleton--animation-wave` or `sf-skeleton--animation-none`. Reduced-motion
preferences stop decorative movement without removing the reserved geometry.
Forced-colors mode keeps the shapes visible using a system color.

## Constructor compatibility

The existing `Skeleton` constructor keeps `size`, `width`, `height`, `count`,
`animation`, `variant`, `type`, `items` and root attributes. Size, animation,
variant and type are normalized to documented values; count is bounded and
dimensions accept only relative percentages or Framework tokens.
