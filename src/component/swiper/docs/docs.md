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

## The engine owns the strip's accessibility (1.2.0, decision C245)

- Owner decision C245 (2026-11-16): the engine, not each component above it,
  makes the strip accessible, so the slider, the carousel and any later strip
  get it from one place. `a11y: false` (or `a11y: {enabled: false}`) leaves
  all of it to the caller:
  - a slide out of view is `inert` (its links leave the Tab order); an `inert`
    the page wrote stays and comes back on `destroy()`;
  - a navigation `<button>` with nowhere to go (or the one button inside the
    element named as `prevEl` / `nextEl`) is `disabled`: out of the Tab order,
    drawn by its own disabled look; when it held the focus, the focus moves to
    the other button. A button the page disabled stays disabled;
  - `update()` counts the slide names again (`a11y.slideLabelMessage`): a slide
    added, or copied from another, is «3 / 3», not the copied «1 / 2»; a name
    the page wrote stays;
  - autoplay does not start under reduced motion.
- `.swiper-button-disabled` takes the pointer away; the pale mark is only for
  an element that is not a disabled button, at `--sf-opacity-disabled` (new in
  tokens.opacity 1.1.0, one step of the scale: 40 %). It was a raw 0.38 on
  every button too, so the slider's disabled arrow faded twice.
- With a fractional `slidesPerView` and few slides (three at 2.2) a drag
  reaches the last stop, as the button does; it did not move the strip.
- `breakpoints` are read against the strip's own width by default
  (`breakpointsBase: 'container'`, a component follows the width of its
  place, C181 (2)), and again when that width changes; `breakpointsBase:
  'window'` keeps the window width.

## The scroll track (2.0.0, owner decision 2026-11-21)

- `cssMode` (Swiper's name) is on by default: the wrapper is the browser's own
  horizontal scroll (`overflow-x: auto`, `scroll-snap-type: x mandatory`, each
  slide `scroll-snap-align: start` and `scroll-snap-stop: always`,
  `overscroll-behavior-x: contain`, no scroll bar). A finger, a pen, a
  trackpad's two fingers and a horizontal wheel move it with the platform's
  momentum and stop at a slide; a vertical move and a vertical wheel stay the
  page's. `cssMode: false` keeps the 1.x transform strip and its pointer drag.
- The engine follows the scroll: the slide whose stop is nearest becomes the
  active one (`slideChange`), the last stop at the end of the strip; the
  slides in view are measured, and the hidden ones stay `inert`. A scroll the
  person makes stops autoplay (`disableOnInteraction`).
- `slideTo`, the arrows, the dots and the keys scroll to the slide's stop,
  smoothly unless the speed is 0 or the person asked for reduced motion; the
  travel is the browser's own smooth scroll. A loop goes from the last slide
  back to the first, and from the first to the last.
- The mouse has no scroll gesture, so a press and horizontal drag pulls the
  strip (`swiper-mouse-drag`, a grab cursor; snap off while it pulls) and
  pages past 15 % of a slide or with a flick; `simulateTouch: false` leaves the
  mouse out, `allowTouchMove: false` leaves the strip to the buttons
  (`overflow-x: hidden`). The click after a drag is swallowed.
- When the strip's width changes the active slide is laid at its stop again.
- Autoplay: `autoplay.pause()` holds the time left and `resume()` goes on from
  it (events `autoplayPause`, `autoplayResume`); `stop()` / `start()` stay the
  person's. At the last slide it goes back to the first (`stopOnLastSlide`
  stops there); `reverseDirection` turns backwards; a slide changed by other
  means starts its own full time.

