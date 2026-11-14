# File Preview Smart Component

`sf-file-preview` renders the ordinary File Preview contract from source-owned
attributes and emits cancellable file-action events. It does not upload files,
request metadata or decide whether the current user may download or remove a
file.

## Looks (decision C149)

The decision names the look `view`; standard §3.1 reserves that word (the
runtime refuses it), so it is the `appearance` axis, as sf-confirm's.

- `appearance="row"` (default) — records and lists: the 48 holder (44 on a phone),
  the name in two lines, `PDF · 2,4 МБ · 12 нояб.` under it, the actions at the
  end, 8 apart (4 in compact density; C105 H5).
- `appearance="chip"` — a message attachment: 48 high, at most 288 (`--sf-f8`) wide, the 32
  holder, the name in one line, `PDF · 2,4 МБ`, only «×».
- `appearance="tile"` — a media library: the picture 4:3 on top, the name in
  one line the tile's width, the meta beside download and remove under it
  (under the picture, C94).
- `compact` — the holder alone, for a table cell.

## Attributes

- `file-name` — breaks only between words (spaces, and after `_ - – — / +`;
  C34). When it needs more lines than its view gives (two in a row, one in a
  chip or a tile) it is cut in the middle and keeps the tail with the
  extension: `Договор_поставки_обор…писано.pdf` (C149 (2)); the whole name is
  in its tooltip and for a screen reader (C88).
- With `href` the name is a link to the file (C51). A picture, a PDF or a video
  opens in the page's full-screen viewer (sf-gallery's `SF.Gallery.view`,
  C149 (5), (6)): the viewable files of the same list (the nearest parent
  holding more than one `sf-file-preview`), «2 из 4», download, open in a
  tab, close, ← →, Home, End, a swipe on a phone; Escape gives the focus back
  to the name of the file shown. Any other file downloads. A middle or
  modified press is the browser's (a new tab). The download button stays.
- `file-size` — a number of bytes (`2457600`) is drawn in the page's units
  (`2,3 МБ`) and said with the unit as a word (`2,3 мегабайта`); text a host
  already wrote is drawn as written (C25).
- `file-date` — the file's date when the page has one (ISO 8601): `12 нояб.`,
  with the year when it is not this year (C149 (7)).
- `kind="auto|icon|image"`
- `icon`, `mime-type`, `href` — unset `icon`: the glyph of the file's kind
  from `mime-type` or the name's extension (PDF, sheet, slides, archive, …
  each its own) in the grey holder, and the type as a word under the name; no
  colour (C81, C149 (3)). A screen reader hears the type, the size and the
  date after the name: «Отчёт.pdf, PDF, 2,3 мегабайта, 12 ноября» (C51).
- `image-url` — a picture for any file the server made (a photo's thumbnail, a
  PDF's first page, a video's frame); over a file that is not an image the
  type stands in the corner badge (C149 (4)). The component never draws a PDF.
- `duration` — a video's length in seconds (`84` → `1:24`) or as text: the
  badge beside the play sign over the video's picture.
- `state="ready|uploading|error"`, `value` (per cent while uploading),
  `error-text` — the upload core's rows (C81): the bar under the name while
  uploading, «Не загрузился: …» in the error colour and «Повторить» after a
  failure; remove stays, download waits for the file
- `surface`, `compact`
- `actions`, `download-action`, `remove-action` — remove is «×» «Убрать
  <имя>»: it takes a file out of a draft or a form field at once, and the page
  offers «Вернуть» in its notice (C25, C149 (8)).
- `stored` — the file is stored (a media library): remove is the trash
  «Удалить <имя>», which asks «Удалить «<имя>»?» in place (sf-confirm, the
  danger answer) and only on yes sends `sf-file-preview-detach` with
  `action: "delete"`.
- `download`, `target`, `disabled`
- `download-label`, `remove-label` — unset: «Скачать <имя>», «Убрать <имя>»
  («Удалить <имя>» with `stored`) in the page's language (C51); the host's
  `aria-label` names the row (the file name when unset)

The old names keep working until 2026-12-01 and are noted in
`SF.deprecations.list()`: `name` is `file-name`, `size` is `file-size`, `type`
is `kind` (its value `default` reads `auto`). `avatar-size`, `open`,
`setOpen()` and `toggleOpen()` remain callable, but actions are no longer hidden
in an inaccessible floating layer: they do nothing and retire on the same date.

## Events

- `sf-file-preview-download {id, action, value}` — the person pressed download;
  unprevented, the browser downloads or opens `href`.
- `sf-file-preview-detach {id, action, value}` — the person pressed «×»
  (`action: "remove"`; the host removes the file and offers «Вернуть» in its
  notice, C25) or answered yes to «Удалить «<имя>»?» (`action: "delete"`, with
  `stored`; the host erases the file).
- `sf-file-preview-retry {id, action, value}` — the person pressed «Повторить»
  in a row that did not upload; the host sends the file again and sets `state`.

Download and detach are vocabulary 1.1.5 requests; pressing the name link of
a file that is not viewed in place sends the same download request first. They bubble across
the Custom Element boundary and may be cancelled. `id` is the host's `id`, else
`href`, else the file name; `value` is the file as data. The old names
`sf-file-preview:download` and `sf-file-preview:remove` are sent after the new
ones with the same detail until 2026-12-01.

## Public variables

`--sf-file-preview-background-color`, `--sf-file-preview-padding`,
`--sf-file-preview-radius`, `--sf-file-preview-gap`,
`--sf-file-preview-holder-size`, `--sf-file-preview-holder-background-color`,
`--sf-file-preview-holder-color`.

## Example

```html
<sf-file-preview
  file-name="Техническое задание.pdf"
  file-size="2516582"
  file-date="2026-11-12"
  href="/files/specification.pdf"
></sf-file-preview>

<!-- Attachments of a message -->
<div class="flex flex-wrap gap-1/3">
  <sf-file-preview appearance="chip" file-name="Смета.xlsx" file-size="2411724"></sf-file-preview>
  <sf-file-preview appearance="chip" file-name="Фасад.jpg" file-size="1258291"
                   href="/files/facade.jpg"></sf-file-preview>
</div>

<!-- A media library: stored files, a PDF's first page and a video's frame -->
<sf-file-preview appearance="tile" stored file-name="Договор поставки.pdf"
                 href="/files/contract.pdf" image-url="/files/contract.page1.png"></sf-file-preview>
<sf-file-preview appearance="tile" stored file-name="Обход объекта.mp4" duration="84"
                 href="/files/walk.mp4" image-url="/files/walk.frame.jpg"></sf-file-preview>
```
