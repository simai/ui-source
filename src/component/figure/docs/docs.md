# Figure

`.sf-figure` is an image, a video or an illustration with its caption under
it. It is CSS only and draws on the native `figure` and `figcaption`.

```html
<figure class="sf-figure sf-figure--ratio-16x9">
  <div class="sf-figure-media">
    <img src="/scene.webp" alt="A project dashboard with a chart" width="1280" height="720">
  </div>
  <figcaption class="sf-figure-caption">The dashboard after the first import.</figcaption>
</figure>
```

## Anatomy

- `.sf-figure` is the column: the media, then the caption, a small gap between.
- `.sf-figure-media` is the media box. It clips what it holds to the surface
  radius. An `img`, `video`, `svg`, `canvas`, `iframe` or `picture` in it takes
  its full width.
- `.sf-figure-caption` is the caption, in the page's small text and the
  `--sf-on-surface-variant` role. It is optional.

## Ratio and fit

Without a ratio the box keeps the media's own proportions. A named ratio --
`sf-figure--ratio-1x1`, `-4x3`, `-3x2`, `-16x9` or `-21x9` -- gives the box
that ratio, and the media fills it, cropped at the edges. With
`sf-figure--contain` the media stands whole inside the box instead, and the
rest of the box shows its fill (`--sf-surface-container`), so a logo or a
diagram is never cut.

Give an image its `width` and `height`, so the page reserves its room before
it arrives. An image that only decorates has an empty `alt`.

`content.figure` renders with it (`props.ratio`: `auto`, `1/1`, `4/3`, `3/2`,
`16/9`, `21/9`; `props.fit`: `cover` or `contain`), and `content.media` draws
its picture with it.

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-figure-background` | the box's fill, seen around contained media | `--sf-surface-container` |
| `--sf-figure-border-color` | the box's edge | `--sf-outline-variant` |
| `--sf-figure-border-width` | the box's edge's width | `--sf-0` (no edge) |
| `--sf-figure-radius` | the box's corners | `--sf-radius--surface` |
| `--sf-figure-caption-color` | the caption | `--sf-on-surface-variant` |
| `--sf-figure-gap` | between the media and the caption | `--sf-space-1/2` |

In forced colours the box's edge is drawn in `CanvasText`.
