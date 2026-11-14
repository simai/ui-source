# Slider engine

Project-owned browser runtime used by the Framework Slider and Carousel components.
It provides navigation, pagination, keyboard control, autoplay, responsive settings,
and lifecycle methods without an external runtime dependency.

## Gestures, keys, spacing (1.1.0)

- Drag and swipe: pointer events on the strip, touch and mouse. A press turns
  into a drag after a few pixels of horizontal travel; a vertical move is left
  to the page (`.swiper-touch` sets `touch-action: pan-y pinch-zoom`). Released
  past 15 % of a slide or with a flick it pages, otherwise it settles back;
  past the first or last slide (no loop) the strip gives a third of the move.
  The click after a drag is swallowed. `allowTouchMove: false` turns it off,
  `simulateTouch: false` leaves the mouse out; inputs, text areas, editable
  content and `.swiper-no-swiping` never start a drag. Under reduced motion the
  strip settles without travel.
- Keys: `keyboard.el` names where ArrowLeft / ArrowRight listen (the strip by
  default); a key in a field is the field's; right to left mirrors them.
- `spaceBetween` (px) stands the slides that far apart: each slide is
  `(100% - gaps) / slidesPerView` wide.
- `previousIndex` is the slide shown before the last change.
- `a11y.slideLabelMessage` (`{{index}}`, `{{slidesLength}}`),
  `a11y.itemRoleDescriptionMessage` and `a11y.slideRole` name and describe the
  slides, as Swiper's own options do.


## Pagination, peek, resize (1.1.0, decision C143)

- `pagination.type: 'fraction'` writes «2 / 12» into the element
  (`currentClass`, `totalClass`) instead of bullets.
- `pagination.keyboard: true` makes the bullets one Tab stop (the current one
  takes it) paged by ArrowLeft / ArrowRight, Home and End, mirrored right to
  left; the focus follows the current bullet.
- A fractional `slidesPerView` (2.2) shows a part of the next slide; the last
  stop lays the last slide whole at the end.
- With `breakpoints` the engine reads them again when the window changes width
  and emits `breakpoint` and `resize`; `update` is emitted after each update.
