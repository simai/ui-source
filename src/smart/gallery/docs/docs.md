# sf-gallery

Smart gallery component with inline slider and optional lightbox modal.

Nested Sliders inherit the same token-driven spacing, motion reduction,
autoplay pause and hidden-slide focus rules as the ordinary Slider unless the
author supplies explicit numeric compatibility overrides.

The gallery owns the selected position. `current`, `goTo(index)` and
`open(index)` use one-based slide numbers. Inline and lightbox views retain that
selection when the modal closes or a nested Slider is reinitialized. Consumers
do not need to reset the child Slider position after rendering.

Updates containing only `current` and/or `open` do not rerender Gallery's
contents: the existing inline Slider remains alive while Modal handles its
transition. These updates emit `sf-updated` with `updateMode: "dom"` rather
than `sf-after-render`. Configuration or slot changes still use rendering.

## Tag

- `sf-gallery`

## Loading model

- detected by `tags: ['sf-gallery']` in `src/smart/gallery/rule.js`
- also detected by `data-sf-gallery` for delegated lightbox usage
- loaded as smart bundle `cl-gallery`
- its composition stylesheet is loaded with the Smart bundle (`css: true`)
- related smart bundles are loaded through relations:
  - `cl-slider`
  - `cl-modal`
- related base components are loaded through transitive relations:
  - `slider`
  - `modal`
  - `icon-buttons`
  - `icons`

## Basic usage

The rendered Gallery root can shrink to the available width in block, grid and
flex containers. This prevents the inline Slider's measured width from imposing
an automatic minimum on its parent; content is not hidden to mask overflow.
An explicitly oversized author layout still needs its own responsive constraints.

Lightbox layout reuses Slider dimension/fit tokens and the Modal scroll area.
Authored `figure`, `picture`, image and caption styles are not overwritten.
Long captions remain in the scrollable modal content instead of being clipped
to a fixed image height. `width`, `height` and `fullscreen` still belong to Modal.
The image-height default is exposed as `--sf-gallery-media--max-height` and
uses the viewport minus a spacing-token reserve. Delegated defaults also use
spacing tokens instead of fixed pixel offsets.

```html
<sf-gallery arrows="true" dots="true" thumbs="true">
  <img slot="slide" src="/upload/photo-1.jpg" alt="Photo 1">
  <img slot="slide" src="/upload/photo-2.jpg" alt="Photo 2">
  <img slot="slide" src="/upload/photo-3.jpg" alt="Photo 3">
</sf-gallery>
```

## Lightbox only

```html
<sf-gallery inline="false" lightbox="true" width="min(96vw, 1200px)" height="80vh">
  <img slot="slide" src="/upload/photo-1.jpg" alt="Photo 1">
  <img slot="slide" src="/upload/photo-2.jpg" alt="Photo 2">
</sf-gallery>
```

## Delegated gallery

Use `data-sf-gallery` on links or images to create a shared lightbox without writing an explicit `sf-gallery` element.

```html
<a href="/upload/photo-1.jpg" data-sf-gallery="product">
  <img src="/upload/photo-1-thumb.jpg" alt="Photo 1">
</a>

<a href="/upload/photo-2.jpg" data-sf-gallery="product">
  <img src="/upload/photo-2-thumb.jpg" alt="Photo 2">
</a>
```

Elements with the same `data-sf-gallery` value are grouped. Empty `data-sf-gallery` opens only the clicked item.

## Delegated modal and slider options

Delegated gallery maps namespaced attributes to the internal components:

- `data-sf-modal-*` -> internal `sf-modal` options through `sf-gallery`
- `data-sf-slider-*` -> internal lightbox `sf-slider` options through `sf-gallery`

Example:

```html
<a
  href="/upload/photo-1.jpg"
  data-sf-gallery="product"
  data-sf-modal-surface-padding="0"
  data-sf-modal-show-header="false"
  data-sf-modal-width="900px"
  data-sf-modal-height="80vh"
  data-sf-slider-arrows="true"
  data-sf-slider-dots="false"
  data-sf-slider-thumbs="true"
>
  <img src="/upload/photo-1-thumb.jpg" alt="Photo 1">
</a>
```

Supported delegated modal attributes:

- `data-sf-modal-title`
- `data-sf-modal-text`
- `data-sf-modal-overlay`
- `data-sf-modal-show-header`
- `data-sf-modal-show-close`
- `data-sf-modal-close-on-esc`
- `data-sf-modal-close-on-overlay`
- `data-sf-modal-preserve-scroll-gap`
- `data-sf-modal-position`
- `data-sf-modal-fullscreen`
- `data-sf-modal-width`
- `data-sf-modal-height`
- `data-sf-modal-blur`
- `data-sf-modal-blur-type`
- `data-sf-modal-overlay-class`
- `data-sf-modal-close-class`
- `data-sf-modal-surface-class`
- `data-sf-modal-surface-padding`
- `data-sf-modal-panel-class`
- `data-sf-modal-header-class`
- `data-sf-modal-body-class`
- `data-sf-modal-content-class`
- `data-sf-modal-footer-class`

Supported delegated slider attributes:

- `data-sf-slider-arrows`
- `data-sf-slider-dots`
- `data-sf-slider-thumbs`
- `data-sf-slider-loop`
- `data-sf-slider-space-between`
- `data-sf-slider-speed`
- `data-sf-slider-button-type`
- `data-sf-slider-button-size`
- `data-sf-slider-dots-type`
- `data-sf-slider-dots-size`
- `data-sf-slider-slide-class`
- `data-sf-slider-lightbox-class`
- `data-sf-slider-class` alias for `lightbox-class`
- `data-sf-slider-root-class` alias for `lightbox-class`

Legacy `data-sf-gallery-*` options are still accepted as fallback for matching option names.

## Attributes

- `template`
- `modal-id`
- `title`
- `text`
- `open`
- `current`
- `inline`
- `lightbox`
- `arrows`
- `dots`
- `thumbs`
- `loop`
- `space-between`
- `speed`
- `button-type`
- `button-size`
- `dots-type`
- `dots-size`
- `root-class`
- `slide-class`
- `inline-class`
- `lightbox-class`
- `overlay`
- `show-header`
- `show-close`
- `close-on-esc`
- `close-on-overlay`
- `preserve-scroll-gap`
- `position="center|left|right|top|bottom"`
- `fullscreen`
- `width`
- `height`
- `blur`
- `blur-type="none|small|medium|large"`
- `overlay-class`
- `close-class`
- `surface-class`
- `surface-padding`
- `panel-class`
- `header-class`
- `body-class`
- `content-class`
- `footer-class`

## Slots

- `slide`

Each meaningful item returned by the shared `slide` slot is cloned into the
inline and lightbox sliders. Formatting whitespace and comments do not create
slides or increment the current index. Empty elements and meaningful text are
preserved. A node with only `slot="slide"` is a container whose children are
items; an attributed node (for example `figure slot="slide" class="p-2"`)
is retained whole. Keep a composite card inside one item, not separate sibling
heading/text/link nodes. Template and setSlot input use the same boundaries.

## Methods

- `open(index)`
- `close()`
- `toggle(index)`
- `goTo(index)`
- `next()`
- `prev()`
- `getModal()`
- `getInlineSlider()`
- `getLightboxSlider()`

## Events

The host dispatches component events through `SfBaseElement`:

- `sf-gallery-open`
- `sf-gallery-close`
- `sf-gallery-change`

Shared lifecycle events are also available:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`
