# sf-gallery

A set of pictures (owner decision C150, 2026-11-14): a grid of picture tiles
by default, or the main picture with a row of thumbnails under it (a product
card). A press on a picture opens the full-screen viewer of the page, which
pages, zooms and closes the same way everywhere. A media library chooses
pictures with check boxes. A row of slides that scrolls is `sf-slider`
(C143), not a gallery look.

The gallery owns the shown position. `current`, `goTo(index)` and
`open(index)` use one-based picture numbers.

## Tag

- `sf-gallery`

## Loading model

- detected by `tags: ['sf-gallery']` in `src/smart/gallery/rule.js`
- also detected by `data-sf-gallery` on the page's own links and pictures
- loaded as smart bundle `cl-gallery`, its stylesheet with it (`css: true`)
- relations: `cl-button-icon`, `cl-button-close` (the viewer's controls),
  `figure` (the tile and the grid), `checkbox` (the selection check box)

Before the code arrives core.styles already lays the page's pictures out as
the grid (or the main picture of the thumbnails look) in their ratio, with the
quiet container fill, so nothing moves when the gallery draws (C150 (6)).
Pictures after the first rows load lazily: the tiles are made with
`loading="lazy"` and `decoding="async"` unless the page wrote its own; give
the page's own pictures after the first `loading="lazy"` too, since the
browser fetches what the page itself writes.

## Basic usage

```html
<sf-gallery heading="Фото">
  <img src="/upload/photo-1.jpg" alt="Фасад" width="1280" height="960">
  <img src="/upload/photo-2.jpg" alt="Холл" width="1280" height="960" loading="lazy">
  <img src="/upload/photo-3.jpg" alt="Двор" width="1280" height="960" loading="lazy">
</sf-gallery>
```

Every child is a picture of the set: an `img`, a `picture`, a `figure` with
its `figcaption`, or a link to the large file around a small picture
(`<a href="/large.jpg"><img src="/small.jpg" alt="…"></a>`). The large file
is the link's address, else `data-src`, else the picture's own. The caption is
`data-caption`, the figure caption or `title`. A picture's `object-position`
(the image field's focus point) is kept in its tile.

## Looks and settings

| Setting | Values | What |
|:---|:---|:---|
| `layout` | `grid` (default), `thumbnails` | the grid of tiles, or the main picture whole in its frame with thumbnails and «3 / 12» under it |
| `tile-size` | `s` 96, `m` 160 (default), `l` 240 | the tile's minimum; as many columns as fit, never fewer than 3 / 2 / 1 |
| `ratio` | `1/1` (default), `4/3`, `16/9`, `auto` | one shape for every tile, the picture covering it around its focus point; `auto` keeps each picture's own. In the thumbnails look it is the main frame's (4/3 without the attribute) |
| `caption` | `viewer` (default), `under` | captions in the viewer, or also under the tiles |
| `selection` | `none` (default), `many` | check boxes on the tiles, «Выбрано N» and the page's actions over the grid |
| `heading` | text | the grid's and the viewer's accessible name («Галерея» by default) |
| `inline` | `true` (default) | `false` draws nothing on the page: the gallery is only its viewer |
| `lightbox` | `true` (default) | `false`: a press opens nothing |
| `loop` | `false` (default) | the viewer pages from the last picture to the first |

The grid's gap is one group's, `--sf-space-1/3`: 8, and 4 in compact density.

Values: `open` (the viewer is open), `current` (the one-based picture shown),
`selected` (the chosen pictures' numbers, a list; a page may write it).

## The viewer

Full screen and black in both themes (pictures are judged on black):

- the bar: «3 / 12» (and the file's name when it has one) at the start; the
  zoom, download, open-in-a-tab and «Закрыть» buttons at the end, 8 apart;
- arrows at the sides; none on a phone, where a horizontal swipe pages;
- the caption under the picture;
- keys: ← → page (mirrored right to left), Home and End go to the first and
  the last, + and − zoom, the arrow keys pan a zoomed picture, Escape first
  un-zooms, then closes;
- zoom: a double click or a double tap zooms to the picture's own pixels at
  that point and back, the zoom button, + and −, a pinch on a phone; a drag
  pans a zoomed picture;
- a swipe down closes, as does a press on the empty field around the picture;
- the focus goes to «Закрыть» on open, and back to the tile of the picture
  shown last on close.

A video plays in the browser's own player, a PDF file shows in the browser's
own viewer in a frame (C149 (6)).

## Selection (media library)

With `selection="many"` each tile has a check box in its start corner, shown
on hover and focus and on every tile once anything is chosen. A press on a
picture opens it while nothing is chosen and chooses it once something is;
Shift chooses a range; on a phone a long press chooses. Over the grid the bar
says «Выбрано N», holds the page's actions (slot `actions`) and «Снять выбор»;
Escape clears the choice.

```html
<sf-gallery selection="many" tile-size="s">
  <img src="/upload/a.jpg" alt="Фасад">
  <img src="/upload/b.jpg" alt="Холл">
  <sf-button slot="actions" appearance="ghost" size="1/2">Удалить</sf-button>
</sf-gallery>
```

## Delegated gallery

Use `data-sf-gallery` on links or pictures to open the viewer without an
`sf-gallery` element:

```html
<a href="/upload/photo-1.jpg" data-sf-gallery="product">
  <img src="/upload/photo-1-thumb.jpg" alt="Photo 1">
</a>
<a href="/upload/photo-2.jpg" data-sf-gallery="product">
  <img src="/upload/photo-2-thumb.jpg" alt="Photo 2">
</a>
```

Elements with the same `data-sf-gallery` value are one set. An empty value
opens only the pressed one. `data-sf-gallery-title` names the viewer
(`data-sf-modal-heading` and `data-sf-modal-title` are still read), and
`data-sf-gallery-loop` pages round.

## JavaScript

The viewer is the gallery's part, and its script API is `SF.Gallery`. It
exists once the gallery is loaded, so a page asks for it first:

```js
await SF.Loader.ensure(['sf-gallery']);
const viewer = SF.Gallery.view([
  {src: '/upload/plan.jpg', alt: 'План этажа', caption: 'Этаж 2'},
  {src: '/upload/tour.mp4', name: 'tour.mp4'},
  {src: '/upload/contract.pdf', name: 'Договор.pdf', meta: 'PDF · 1,2 МБ', download: true, open: true},
], {start: 1, opener: document.activeElement});
viewer.next();
```

`SF.Gallery.view(items, options)` opens the viewer (or shows new items in the
open one) and returns a handle `{close(), goTo(n), next(), prev(), current,
total, open}`; `SF.Gallery.close()` closes it; `SF.Gallery.current` and
`SF.Gallery.open` read the open viewer.

An item is `{src, type, mime, alt, caption, name, meta, width, height,
download, open, href}`; a string is `{src}`. `type` is `image` (the default),
`video` or `pdf`; without it `mime` or the address's extension says. `name`
shows in the bar above the counter; `download` (true, or a file name) and
`open` (true) add the download and open-in-a-tab buttons.

Options:

| Option | Default | What |
|:---|:---|:---|
| `start` | 1 | the one-based item to open at |
| `opener` | the focused element | where the focus goes back: an element, or a function `(current) => element` |
| `label` | «Просмотр» | the viewer's accessible name |
| `counter` | `slash` | `slash` «3 / 12», `words` «3 из 12» |
| `loop` | false | page from the last item to the first |
| `zoom` | true | false turns zoom off |
| `labels` | | `{previous, next}`: the side arrows' names («Предыдущее фото», «Следующее фото») |
| `onChange` | | `({current, previous, total})` after each page |
| `onClose` | | `({current, total})` after the focus went back |

### From sf-file-preview

The file preview (C149) opens its files in this viewer; it does not import the
module, it calls the global:

```js
await SF.Loader.ensure(['sf-gallery']);
SF.Gallery.view(files.map((file) => ({
  src: file.url, type: file.kind /* image | video | pdf */, name: file.name,
  meta: file.meta, download: file.name, open: true,
})), {
  start: index + 1,
  opener: (current) => tiles[current - 1] || trigger,
  counter: 'words',
  labels: {previous: 'Предыдущий файл', next: 'Следующий файл'},
});
```

## Actions

Each answers an outcome, `{outcome: "applied"}` or `{outcome: "refused", reason}`:

- `open(index)` — opens the viewer, at a one-based picture when given;
  refused (`no-lightbox`) with `lightbox="false"`, (`empty`) without pictures
- `close()` — refused (`closed`) when the viewer is closed
- `toggle(index)`
- `goTo(index)`, `next()`, `prev()`
- `clearSelection()` — refused (`empty`) when nothing is chosen

## Slots

- `slide` — the pictures (a child without a `slot` joins it)
- `actions` — the page's buttons in the selection bar

## Events

- `change {previous, current, total, from}` — the shown picture changed
  (`from`: `api` or `lightbox`).
- `sf-gallery-opened {current, total}` — the viewer opened.
- `sf-gallery-closed {current, total}` — the viewer closed.
- `sf-gallery-select {selected, count, total}` — the choice changed.

The detail carries data only. Until 2026-12-01 the old names keep working and
are noted in `SF.deprecations.list()`: the attribute `title` (now `heading`),
the events `sf-change`, `sf-open` and `sf-close`, and the readers
`getModal()`, `getInlineSlider()` and `getLightboxSlider()`, which now answer
`null`. Until 2027-01-01 the settings of the slider and the window the gallery
was built from (`arrows`, `dots`, `thumbs`, `modal-id`, `width`, `height`,
`backdrop-blur` and the rest) are read, ignored and noted.

Public variables: `--sf-gallery-min-inline-size` (the root's narrowest size),
`--sf-gallery-object-fit` (the thumbnails look's main picture),
`--sf-gallery-media-max-height`, `--sf-gallery-slide-min-height` and
`--sf-gallery-caption-color` (the viewer's picture and caption).

Shared lifecycle events are also available: `sf-connected`,
`sf-before-render`, `sf-after-render`, `sf-updated`, `sf-disconnected`.
