# sf-slider

Smart slider component built on the shared `slider` component and Swiper.

For text/card content, root-class="sf-slider--content" puts controls below the
slides through the shared Component CSS and removes the default media minimum
height. Default media overlay is unchanged. Dot pointer targets use the shared
semantic UI control height independently of their small visible markers.

The default template projects author style, root-style and root-class to the
existing .sf-slider root. root-style takes precedence over author style. Changes
limited to those styles/classes update the root and recalculate the existing
Swiper layout without resetting the active slide, replacing thumbnails or
moving keyboard focus. They emit the shared sf-updated event with updateMode=dom,
not a new slide-change or a template render. Configuration/slot changes keep
the ordinary render and initialization path. afterRender(callback) retains the
base lifecycle callback API; it is not a command to reinitialize Swiper.

The shared adapter uses existing navigation aria-label values as default a11y
messages. Explicit data-swiper a11y messages keep their priority, disabled a11y
stays disabled and aria-labelledby keeps native precedence. Unbinding restores
owned labels without undoing later author changes. The default Smart arrow names
remain Previous slide / Next slide; configure the existing Swiper a11y messages
for another language. No separate localization API is introduced.

Pagination uses the shared Slider CSS: available pages are outlined and the
current page is filled, using semantic foreground roles. The existing dots-type
and dots-size options select the existing schemes and sizes. Transparent clear
dark indicators need an inverse backdrop. Keyboard focus is focus-visible,
bounded by the gap; forced-colors uses system colors. No Smart-only dot paint
or separate visual token scale is needed.

Omit `space-between` and `speed` to inherit the shared adaptive spacing and
motion tokens. Explicit numeric attributes remain supported for compatibility.
Reduced-motion users receive no slide transition and no autoplay. In normal
motion mode, explicitly enabled autoplay pauses while keyboard focus is inside
the Slider and while the document is hidden. Only active or visible slides are
kept in the keyboard order.

## Basic Usage

```html
<sf-slider arrows dots loop>
  <div slot="slide">Slide 1</div>
  <div slot="slide">Slide 2</div>
  <div slot="slide">Slide 3</div>
</sf-slider>
```

## Slide boundaries

Slider renders each meaningful item returned by the shared slide slot as one
slide. Whitespace-only text and comments are formatting, not slides. Meaningful
text remains unchanged, and an intentionally empty element remains a slide.

A direct child with only slot="slide" is a slot container: its children are
the items. Its wrapper is not the slide. A slotted element with another
attribute, such as class, is retained as one item. For a card with a heading,
paragraph and link use one attributed article, or put a whole article inside
the bare slot container. Do not leave the heading, text and link as separate
top-level children unless they are intended to be separate slides.

template slot="slide" similarly supplies its child items. setSlot('slide', ...)
uses the existing slot API and the same meaningful-item filtering. It does not
silently combine sibling nodes into a card. The public slides getter retains
the shared base Node/array result; normalization belongs to slide rendering.

## Swiper Options

`sf-slider` forwards Swiper data options from the host element to the internal `.sf-slider` root before initialization.

Use `data-swiper-options` for full Swiper configuration:

```html
<sf-slider
  data-swiper-options='{"loop":true,"autoplay":{"delay":3000},"slidesPerView":2}'
>
  <div slot="slide">Slide 1</div>
  <div slot="slide">Slide 2</div>
</sf-slider>
```

Use `data-swiper-*` for separate options:

```html
<sf-slider
  data-swiper-loop="true"
  data-swiper-autoplay="true"
  data-swiper-autoplay-delay="3000"
  data-swiper-keyboard-enabled="true"
  data-swiper-mousewheel-force-to-axis="true"
>
  <div slot="slide">Slide 1</div>
  <div slot="slide">Slide 2</div>
</sf-slider>
```

Nested Swiper option groups are supported through camel-cased dataset names, for example:

- `data-swiper-autoplay-delay` -> `autoplay.delay`
- `data-swiper-keyboard-enabled` -> `keyboard.enabled`
- `data-swiper-mousewheel-force-to-axis` -> `mousewheel.forceToAxis`
- `data-swiper-free-mode-enabled` -> `freeMode.enabled`

Short slider aliases are still accepted and forwarded:

- `data-loop`
- `data-speed`
- `data-space-between`
- `data-slides-per-view`
- `data-centered-slides`
- `data-autoplay`
- `data-autoplay-delay`
- `data-autoplay-disable-on-interaction`
- `data-autoplay-pause-on-mouse-enter`
- `data-autoplay-reverse-direction`
- `data-autoplay-stop-on-last-slide`

## Lifecycle

The component waits for nested smart arrow buttons to render before binding Swiper. This prevents Swiper navigation from initializing before `.sf-slider-button-prev` and `.sf-slider-button-next` exist.

Use `refresh()` after changing slides or Swiper-related data attributes programmatically.

## Actions and events

- `refresh()` — lays the slides out again; answers `{outcome: "applied"}`.
- `slideNext()`, `slidePrev()` — show the next or the previous slide; they
  answer `{outcome: "refused", reason: "not-ready"}` before Swiper has started.
- `change {activeIndex, realIndex, previousIndex}` — the shown slide changed
  (DOM name `change`). The detail carries the indexes only.

Until 2026-12-01 the old event `sf-slide-change` follows `change` with the same
detail, and `getSlider()` still answers the Swiper instance; both are noted in
`SF.deprecations.list()`.

The arrows say «Предыдущий слайд» and «Следующий слайд» from the language files
(`lang/ru.json`, `lang/en.json`); a product adds a language through
`SF.language.register("sf-slider", code, words)`.

Public variables: `--sf-slider-gap`, `--sf-slider-arrow-offset-inline`,
`--sf-slider-dots-offset-block`, `--sf-slider-thumbnail-size`,
`--sf-slider-thumbnail-radius`.
