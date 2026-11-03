# Container width and breakout

How the SIMAI Framework's container utilities set the width of a page's
content, and how a block leaves its container (`container-breakout`,
utility.container 1.2.0, 2026-11-03). Measured on the built sheets in a
left-to-right and a right-to-left page at 390, 800, 1100 and 1600px
(`tests/browser/container-breakout.browser.mjs`).

## What each class does

| Class | Where | What it does |
| --- | --- | --- |
| `container` | the element | full width up to the step of the current breakpoint (`--sf-breakpoint-*`), with the gutter as inline padding. It sets **no inline margins**: it starts at the inline start of its parent. |
| `m-inline-auto` | the element | centres it. A container that should stand in the middle of the page takes both: `container m-inline-auto`. |
| `max-container-1` … `max-container-8` | an **ancestor** of the container | `.max-container-N .container`: from the desktop breakpoint (`lg`), the descendant container's step becomes a wider ladder step (h5 … i4). On the same element as `container` it does nothing. |
| `max-w-prose` | the element | a text measure, 65ch. On the same element as `container` the two `max-width`s compete with equal weight, and which one wins depends on the order of the sheets, which the Loader does not fix. Put it on an element inside the container. |
| `container-flush` | a container | empties the container's own gutter (a nested container whose outer one already holds the edge). |
| `container-breakout` | a block inside a centred container | spans the page's whole width; see below. |

## The width parameter set

A block's `width` (parameter set `width`, `parameter-sets.mjs`) reaches three
elements, because the classes above work across elements:

| width | block element | `frame` part | `content` part |
| --- | --- | --- | --- |
| `narrow` | | `container m-inline-auto` | `max-w-prose m-inline-auto` |
| `normal` | | `container m-inline-auto` | |
| `wide` | `max-container-7` | `container m-inline-auto` | |
| `full` (the default) | | | |

```html
<section data-sf-composition-id="s" class="max-container-7">
  <div data-sf-composition-part="frame" class="container m-inline-auto">
    <div data-sf-composition-part="content">…the section's blocks…</div>
  </div>
</section>
```

At 1600px the text stands 656px wide (narrow), in a 1280px container (normal),
in a container as wide as the page (wide: the i3 step is wider than 1600px),
or edge to edge (full); each centred. Below the desktop breakpoint wide is
normal.

## container-breakout

A cover picture, a map or a strip of logos inside a page's centred container
spans the page's whole width:

```html
<div class="container m-inline-auto">
  <p>…</p>
  <div class="container-breakout bg-surface-container">
    <div class="container m-inline-auto">…centred again…</div>
  </div>
</div>
```

- Its margins reach out by half of what the page is wider than the
  container's content box, on both sides (`margin-inline-start` and
  `margin-inline-end`), so it is the same in a right-to-left page.
- The page's width is the root's content box: while the page holds a
  breakout, `<html>` is an inline-size query container and `<body>` measures
  it once (`100cqi`) into a length every breakout inherits. A classic
  scrollbar is outside that box, so the page never scrolls sideways (the
  `100vw` of the usual recipe counts the scrollbar). The root gets no layout
  containment: fixed and sticky elements keep their place.
- It needs a centred parent (`container m-inline-auto`, or the width set's
  frame). In a container that starts at the inline start the breakout is
  offset by the same amount.
- A product whose page is narrower than the root (a fixed side panel) sets
  `--sf-container-breakout-page` to that width.
- The `breakout` parameter set prints it.

Headless Chrome draws overlay scrollbars, so the browser test simulates a
classic scrollbar by making the root 17px narrower than the viewport; a
scrollbar question that needs the real gutter needs a headed browser.
