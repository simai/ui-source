# File Preview Smart Component

`sf-file-preview` renders the ordinary File Preview contract from source-owned
attributes and emits cancellable file-action events. It does not upload files,
request metadata or decide whether the current user may download or remove a
file.

## Attributes

- `file-name` — breaks only between words (spaces, and after `_ - – — / +`),
  two lines at most, then an ellipsis; the whole name is in its tooltip and
  for a screen reader (decisions C34, C88). With `href` the name is a link to
  the file (C51).
- `file-size` — a number of bytes (`2457600`) is drawn in the page's units
  (`2,3 МБ`) and said with the unit as a word (`2,3 мегабайта`); text a host
  already wrote is drawn as written (C25).
- `kind="auto|icon|image"`
- `icon`, `image-url`, `mime-type`, `href` — unset `icon`: the glyph of the
  file's type from `mime-type` or the name's extension (PDF, sheet, slides,
  archive, … each its own; C81); a screen reader hears the type after the
  name: «Отчёт.pdf, PDF, 2,3 мегабайта» (C51)
- `state="ready|uploading|error"`, `value` (per cent while uploading),
  `error-text` — the upload core's rows (C81): the bar under the name while
  uploading, «Не загрузился: …» in the error colour and «Повторить» after a
  failure; remove stays, download waits for the file
- `surface`, `compact`
- `actions`, `download-action`, `remove-action`
- `download`, `target`, `disabled`
- `download-label`, `remove-label` — unset: «Скачать <имя>», «Удалить <имя>»
  in the page's language (C51); the host's `aria-label` names the row (the
  file name when unset)

The old names keep working until 2026-12-01 and are noted in
`SF.deprecations.list()`: `name` is `file-name`, `size` is `file-size`, `type`
is `kind` (its value `default` reads `auto`). `avatar-size`, `open`,
`setOpen()` and `toggleOpen()` remain callable, but actions are no longer hidden
in an inaccessible floating layer: they do nothing and retire on the same date.

## Events

- `sf-file-preview-download {id, action, value}` — the person pressed download;
  unprevented, the browser downloads or opens `href`.
- `sf-file-preview-detach {id, action, value}` — the person pressed remove; the
  host removes the file (and offers «Вернуть» in its notice, C25).
- `sf-file-preview-retry {id, action, value}` — the person pressed «Повторить»
  in a row that did not upload; the host sends the file again and sets `state`.

Download and detach are vocabulary 1.1.5 requests; pressing the name link
sends the same download request first. They bubble across
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
  href="/files/specification.pdf"
></sf-file-preview>
```
