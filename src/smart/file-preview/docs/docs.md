# File Preview Smart Component

`sf-file-preview` renders the ordinary File Preview contract from source-owned
attributes and emits cancellable file-action events. It does not upload files,
request metadata or decide whether the current user may download or remove a
file.

## Attributes

- `file-name`, or legacy alias `name`
- `file-size`, or legacy alias `size`
- `type="auto|icon|image"`
- `icon`, `image-url`, `mime-type`, `href`
- `surface`
- `actions`, `download-action`, `remove-action`
- `download`, `target`, `disabled`
- `aria-label`, `download-label`, `remove-label`

The historical `type="default"` value maps to `auto`. The historical `open`,
`setOpen()` and `toggleOpen()` surface remains callable for compatibility, but
actions are no longer hidden in an inaccessible floating layer.

## Events

- `sf-file-preview:download`
- `sf-file-preview:remove`

Both events bubble across the Custom Element boundary and may be cancelled.
Their detail contains `action` and the current `value`.

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
