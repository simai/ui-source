# File Preview Smart Component

`sf-file-preview` renders the ordinary File Preview contract from source-owned
attributes and emits cancellable file-action events. It does not upload files,
request metadata or decide whether the current user may download or remove a
file.

## Attributes

- `file-name`
- `file-size`
- `kind="auto|icon|image"`
- `icon`, `image-url`, `mime-type`, `href`
- `surface`, `compact`
- `actions`, `download-action`, `remove-action`
- `download`, `target`, `disabled`
- `download-label`, `remove-label`; the host's `aria-label` names the row
  (the file name when unset)

The old names keep working until 2026-12-01 and are noted in
`SF.deprecations.list()`: `name` is `file-name`, `size` is `file-size`, `type`
is `kind` (its value `default` reads `auto`). `avatar-size`, `open`,
`setOpen()` and `toggleOpen()` remain callable, but actions are no longer hidden
in an inaccessible floating layer: they do nothing and retire on the same date.

## Events

- `sf-file-preview-download {id, action, value}` — the person pressed download;
  unprevented, the browser downloads or opens `href`.
- `sf-file-preview-detach {id, action, value}` — the person pressed remove; the
  host removes the file.

Both are vocabulary 1.1.5 requests (`download`, `detach`); both bubble across
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
  file-size="2,4 МБ"
  icon="description"
  href="/files/specification.pdf"
  download-label="Скачать файл"
  remove-label="Удалить файл"
></sf-file-preview>
```
