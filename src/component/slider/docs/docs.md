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

An arrow with nowhere to go is a disabled button: the script sets disabled with Swiper's swiper-button-disabled, so it leaves the tab order, and the arrow holding the focus hands it to the other one (1.1.2, docs pre-check 2026-11-10 SL-04). A button arrow draws the system's disabled look; another element keeps the 0.4 opacity.

## Region, swipe and keys (1.2.0)

The block is a region the reader can find and leave: `role="region"`,
`aria-roledescription` «карусель» / «carousel» and a name — the page's
`aria-label` or `aria-labelledby`, else `data-label`, else «Слайды» / «Slides».
Each slide is a group described as «слайд» / «slide» and named by its position,
«2 из 5» / «2 of 5»; `data-slide-label` (`{n}`, `{count}`) and
`data-slide-roledescription` give other words, and a product adds a language
with `SF.language.register('sf-slider', code, words)` (keys `label`,
`carousel`, `slide`, `position`). The strip is `aria-live="polite"`, and `off`
while autoplay turns it. An authored role, description or name stays, and
unbinding puts back what was there.

A finger, a pen or the mouse drags the slides (the engine, component.swiper
1.1.0): let go past 15 % of a slide, or with a flick, and the next or previous
slide shows; less, and the strip settles back. A vertical move scrolls the page
(`touch-action: pan-y`), a drag never ends in a click on a link under it, and
fields inside a slide keep their own pointer and keys. The thumbnail strip is
pressed, not dragged. `data-swiper-allow-touch-move="false"` turns dragging
off; `data-swiper-simulate-touch="false"` leaves the mouse out.

With `data-swiper-keyboard="true"`, ArrowLeft and ArrowRight page wherever the
focus is in the block — on an arrow, a dot or a slide — mirrored in a
right-to-left block. Before 1.2.0 the keys listened on the strip only, and the
focus is never there.

Several slides in view stand `--sf-slider--space-between` apart, by default
`--sf-space-1/2`; the engine read no gap before, so they touched. The
thumbnails take the small-part radius `--sf-radius--ui` (C18) instead of a
square corner and stand `--sf-slider-thumbnails--space-between` apart.


## Decision C143 (1.2.0)

- From eight slides (`.swiper-slide` in the strip) the pagination element is
  a counter «2 / 12» (`.sf-slider-dots--count`, drawn only, `aria-hidden`);
  up to seven it is dots: one Tab stop, ArrowLeft / ArrowRight / Home / End
  page and move the focus.
- Dots are 8 px in both sizes, the current one a 24 × 8 pill
  (`--sf-slider-dots-dot--active-width`). `.sf-slider-dots--plate` is the
  popup plate over a picture, `.sf-slider-dots--bare` the row start under
  cards; both draw filled on-surface-variant dots and a primary pill.
- `.sf-slider-arrows--plate` sets ghost arrows on popup plates with the
  overlay shadow; the button's state fill lies over the plate.
- `sf-slider--content` peeks the next card (1.15 per view, 2.2 from sm)
  unless `data-slides-per-view`, `data-swiper-slides-per-view` or options set
  the count; its controls are one row, arrows `--sf-space-1/3` apart.
- `data-ratio` (`16/9`, `4/3`, `3/2`, `1/1`, `21/9`) keeps the strip of a
  picture slider in that ratio.
- `data-autoplay` turns the slides only with a shown pause button,
  `.sf-slider-rotation` (a button, or an sf-button-icon whose button carries
  the class); `data-pause-label` / `data-play-label` name it, else «Остановить
  прокрутку» / «Запустить прокрутку». Without one the slider does not turn,
  and a pause button with nothing to pause is hidden. The thumbnails never
  autoplay.
- Thumbnails are buttons (gallery study GL-2): `role="button"`, named by the
  picture's `alt` (else «Перейти к слайду 2»), the shown one `aria-current`;
  they are one Tab stop -- the shown one -- and ArrowLeft / ArrowRight
  (mirrored right to left), Home and End move the slide and the focus, Enter
  and Space press. The focus ring is drawn inside the thumbnail's radius.
- With thumbnails, the controls over a picture stand over the slides only:
  the arrows are centred on the picture and the position sits at its bottom,
  not over the thumbnails.

## The light circle of --light (1.2.1)

- `.sf-slider-arrows--light` draws light circles with dark arrows in either
  theme. The circle was the fill of a link icon button only; the arrows are
  ghost buttons since sf-slider 1.1.10 (the former link), so a ghost arrow
  had no circle and its dark glyph lay on the slide: 1.30-1.32:1 over a dark
  slide in the dark theme (docs batch B, FW-B-3), under the 3:1 a control's
  glyph needs. A ghost or link icon button in `--light` stands on the light
  page surface, with the button's hover and press fill laid over it (as on
  `--plate`): 11.17:1 in both themes.

## Loaded by the class (1.3.2)

- The Loader rule reads the class token `sf-slider` (and its parts,
  `sf-slider-*`), not the name anywhere in an element's attributes. Before,
  `/sf-slider/` matched sf-slider-range's field label id
  `sf-slider-range-field-1` (its `id` and `data-labelledby`), and a page with
  a range field and no slider fetched the slider's sheet, its script and
  swiper.

## Joint pass 2026-11-16 (1.3.0, decisions C245, C246)

- The dots are 8 px and their pill 24 x 8 without a size step: `--plate` and
  `--bare` wrote none and drew 2 x 2 dots. They stand 8 apart
  (`--sf-slider-dots--gap`, `--sf-space-1/3`; owner decision C246), a step of
  16; a dot's press area is its step wide and a target high.
- An arrow button with nowhere to go is disabled by the engine (swiper 1.2.0,
  C245) and draws the button's disabled look once; the fade
  (`--sf-opacity-disabled`) is only for an arrow drawn with another element.
  Hidden slides are inert by the engine too; the slider's own guards are gone.
- `sf-slider--content` picks 1.15 or 2.2 cards by the slider's own width, not
  the window's: a 264 px column on a wide screen shows 1.15 cards.
- The pause button of class markup changes its glyph with its name (pause /
  play_arrow), as `<sf-slider>` does.
- `bindSlider(root, parts)` takes the class names of another block; the old
  `.sf-carousel` binds through it until 2027-01-01 (component.carousel 1.4.0,
  C247), and `data-delay` is read as the autoplay delay there.

## A ratio is the slide's height (1.4.1)

- A slider with `data-ratio` is as high as its ratio: the slide fills the
  frame and the slide floor (`--sf-slider-slide--min-height`, default
  `--sf-f2`, 192) does not apply. At 390 a 16/9 slider is a 280 x 158 window;
  the 192 floor stood under it and the window cut 34 px off the slide (about
  72 at 21/9), with the slide's number and its caption on the scrim. A content
  slider and a slider without a ratio (or `data-ratio="auto"`) keep the floor.

## Scroll track, arrows and the bar (2.0.0, owner decision 2026-11-21)

Carousel study ui-control `control/research/2026-11-21-carousel`; a major,
because the defaults change.

- **Track**: component.swiper 2.0.0 scrolls the strip natively with snap
  points (`swiper-css-mode`): a finger, a trackpad's two fingers and a
  horizontal wheel page with the platform's momentum, a vertical move scrolls
  the page, the mouse drags (grab cursor). `data-swiper-css-mode="false"` on
  the block or the strip keeps the transform strip of 1.x.
- **Pictures** (no `sf-slider--content`): the block is a grid. The arrows take
  the strip's row, centred, `--sf-slider-arrow-offset-inline` inside each edge
  (default `--sf-space-2`, 20 / 16; it was `--sf-space-1`, so a slide inset by
  the same step put the arrow on its edge). Under `(hover: hover) and
  (pointer: fine)` they are hidden until the pointer is over the block or the
  keyboard focus is in it, with a fade of `--sf-duration-normal`
  `--sf-ease-move` (no fade under reduced motion); an arrow with nowhere to go
  stays hidden there. On touch they are always shown. The position
  (`.sf-slider-dots`) and the pause button (`.sf-slider-rotation-place`) take
  a row under the strip (and the thumbnails), the block's gap below it, centred
  as one group, the pause button `--sf-space-1` after the dots. Markup is
  unchanged: `.sf-slider-controls` lends its parts to the grid
  (`display: contents`).
- **Cards** (`sf-slider--content`): unchanged — one row under the cards, the
  position at the start, the arrows at the end; the next card peeks (1.15, 2.2
  from the sm step).
- **Timed position** (`sf-slider-dots--timed`): with autoplay and dots the
  slider marks the dots timed and writes `--sf-slider-dots--delay`. While
  `data-rotation="playing"` the current dot is a `--sf-c6` (32) pill whose fill
  (the current colour) grows for the slide's time; `data-rotation-held` (the
  pointer over the block, a hidden tab) freezes it, and the turn waits with it
  (the engine's `autoplay.pause()` keeps the time left). Stopped, the pill
  stays full. The counter («2 / 12») is never timed.
- **Keys**: ArrowLeft and ArrowRight page wherever the focus is in the block,
  by default; `data-swiper-keyboard="false"` turns them off.
- **Thumbnails**: the shown one has a `--sf-focus--width` ring in
  `--sf-slider-thumbnails-ring--color` (default `--sf-primary`),
  `--sf-a1` outside it; the strip keeps that much room inside its edge, so the
  ring is whole.

