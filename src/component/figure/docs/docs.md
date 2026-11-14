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

## Text on a picture

Three looks only (owner decisions C91, level 1, and C92). By default the
caption stands under the media, on the page, and nothing lies on the picture
(look 8): the strict card's default, its contrast independent of the photo.
When the author lays the caption on the picture:

- `sf-figure--caption-over` -- long and soft (look 3). The caption sits on the
  media's lower edge in white over a scrim of black 64 under the text; above
  the text a long ramp (four times `--sf-space-4`)
  steps down the alpha scale 48 -> 28 -> 16 -> 8 -> 0, weaker at the top.
  The ramp is the caption's top padding, so no line stands in it.
- `sf-figure--caption-plate` -- the plate (look 5): one flat band of black 64
  under the text. For long captions and busy photos.

Both hold 4.5:1 on light and dark photos, one to five lines, sizes 1/2 to 2,
both themes, 1440 and 390. A caption taller than the picture grows the box
instead of spilling onto the page. The same two looks are the utilities
`gradient-scrim` and `gradient-scrim gradient-scrim-plate` for a recipe.

```html
<figure class="sf-figure sf-figure--ratio-16x9 sf-figure--caption-over">
  <div class="sf-figure-media"><img src="/scene.webp" alt="" width="1280" height="720"></div>
  <figcaption class="sf-figure-caption"><b>Натюрморт с вазой</b><br>Студия, ноябрь 2026</figcaption>
</figure>
```

## Cover placeholder

A media box with no picture in it is a placeholder: flat, in the container
fill. Under the decorative level (owner decision C91, level 2) --
`sf-figure--expressive`, or `data-sf-style="expressive"` on the root or a
container -- it is a cover: its hue's container stepping into the next
container step, corner to corner, over the place's solid colour (an
`sf-hue-<name>` on the figure or above it, primary otherwise). Roles only, so
it follows the theme. `data-sf-style="strict"`, the default, keeps it flat;
the nearest one wins.

## Picture tile

`sf-figure--tile` is the one picture tile of the SIMAI Framework (owner
decision C150 (10)): sf-gallery draws it, and the file upload's gallery look,
ui-mail's «Изображения» and SIMAI Pro's chat previews use it too. Every tile
of a set takes one ratio -- 1:1 unless a ratio class names another
(`sf-figure--ratio-4x3`, `sf-figure--ratio-16x9`), `sf-figure--ratio-auto`
keeps each picture's own -- and the picture covers the box around its focus
point (the image field's focus written as the picture's `object-position`).
The box holds its shape, the quiet fill and the radius from the first frame,
so nothing moves when the picture arrives. The media box may be a `button`
or a link: it opens the viewer (`SF.Gallery.view`, see sf-gallery).

`sf-figure-grid` lays tiles out: as many columns as fit at the tile's minimum,
never fewer than the minimum count, one group's gap (`--sf-space-1/3`, 8; 4
in compact density).

| Class | Tile minimum | At least |
|:---|:---|:---|
| `sf-figure-grid sf-figure-grid--s` | `--sf-e2` (96) | 3 columns |
| `sf-figure-grid` | `--sf-f0` (160) | 2 columns |
| `sf-figure-grid sf-figure-grid--l` | `--sf-f5` (240) | 1 column |

A tile that can be chosen carries `sf-figure-pick`, a class check box on a
popup plate in its start corner, shown on hover and focus and on every tile
once the grid has `sf-figure-grid--selecting`; a chosen tile adds
`sf-figure--selected` (a primary ring inside the box, the picture a step in).

```html
<div class="sf-figure-grid sf-figure-grid--s" role="list" aria-label="Фото">
  <figure class="sf-figure sf-figure--tile" role="listitem">
    <button type="button" class="sf-figure-media" aria-label="Открыть фото 1 из 3">
      <img src="/a.webp" alt="" width="1280" height="960" loading="lazy">
    </button>
    <label class="sf-figure-pick sf-checkbox sf-checkbox--size-1 flex">
      <span class="sf-checkbox-box flex">
        <input type="checkbox" aria-label="Выбрать фото 1 из 3">
        <span class="sf-icon" aria-hidden="true"></span>
      </span>
    </label>
  </figure>
</div>
```

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-figure-background-color` | the box's fill, seen around contained media | `--sf-surface-container` |
| `--sf-figure-border-color` | the box's edge | `--sf-outline-variant` |
| `--sf-figure-border-width` | the box's edge's width | `--sf-0` (no edge) |
| `--sf-figure-radius` | the box's corners | `--sf-radius--surface` |
| `--sf-figure-caption-color` | the caption | `--sf-on-surface-variant` |
| `--sf-figure-gap` | between the media and the caption | `--sf-space-1/2` |

In forced colours the box's edge is drawn in `CanvasText`.
