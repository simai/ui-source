# Slider

The shared .sf-slider adapter initializes the pinned Swiper dependency for the
main slides, optional navigation/pagination and thumbnails. Smart Slider uses
this adapter rather than a separate navigation implementation.

## Navigation names

Nonempty aria-label on .sf-slider-button-prev and .sf-slider-button-next becomes
the default Swiper prevSlideMessage/nextSlideMessage. Explicit consumer a11y
messages take precedence. a11y:false and a11y.enabled:false remain respected;
the adapter does not force accessibility processing back on. Without author
labels the existing vendor defaults remain. aria-labelledby is never rewritten
and retains native accessible-name precedence.

Unbinding restores the original label only if the control still has the value
applied by that binding. A later application edit is preserved. The exact bound
controls are retained for cleanup; former messages must not silently become
author defaults on rebind. This does not introduce automatic locale detection
or a second public translation API.

Navigation names are one bounded accessibility contract, not certification of
every vendor option. The shared adapter keeps only active or visible slides in
the keyboard order and restores an authored `inert` value when it unbinds.

## Motion and spacing

When the author omits numeric overrides, Swiper receives slide spacing from
`--sf-slider--space-between`, thumbnail spacing from
`--sf-slider-thumbnails--space-between` and duration from
`--sf-slider--duration`. Their defaults reference Framework spacing and motion
tokens, so responsive token profiles remain effective. Existing
`data-space-between` and `data-speed` values remain explicit compatibility
overrides.

With `prefers-reduced-motion: reduce`, transition duration becomes zero and
autoplay is not started. When autoplay is explicitly enabled in the normal
motion mode, it stops while focus is inside the Slider or the document is
hidden and resumes only after every adapter-owned pause reason has cleared.
Autoplay is still an advanced opt-in: a product that keeps content moving must
provide a visible pause control and validate its timing separately.

## Pagination appearance

The dot's visible dimensions are separate from its pointer target. A centered
pseudo-element expands hit testing to --sf-slider-dots-dot--target-size,
defaulting to the smallest semantic UI control height. Group gap and insets
reserve that space without overlapping neighbors. This does not add another
focusable node or change native button activation. Explicitly reduced consumer
tokens do not imply guaranteed target-size compliance.

Available pages use a hollow contour; the current page uses a solid fill. Both
use the same semantic foreground, so selection is not encoded by color alone.
Primary uses primary on transparent surfaces, on-primary over the framed light
primary surface and on-primary-container over the framed dark container. Clear
uses on-surface for light and on-surface-inverse for dark. A transparent variant
requires an appropriate consumer backdrop; it cannot guarantee contrast over
arbitrary photographs. Sizes, gaps and the existing surface variants are retained.

Keyboard focus uses focus-visible without changing dimensions. Its outline is
capped at half the gap to avoid crossing an adjacent indicator. Pointer clicks
do not force a focus ring. Forced colors use system ButtonText/ButtonFace and
Highlight, preserving the contour/fill distinction. Smart Slider inherits this
shared CSS; do not create a Smart-only visual override.

## Content versus media

Default Slider controls overlay media. Add sf-slider--content to the root for
text or card slides: controls take normal flow below the slide viewport and may
wrap; slides use natural height rather than the default media minimum. Explicit
--sf-slider-slide--height/min-height overrides are still respected. No automatic
classification or DOM reordering occurs. Smart uses the existing root-class
projection. Overlay mode still requires the author to keep important text and
interactive content away from controls.
