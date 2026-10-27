# Download File Smart Component

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

`sf-download-file` is a smart wrapper over the base `download-file` component.
With `href` it renders a native anchor; without `href` it renders a button for
an application-owned action. `disabled` renders a disabled button and no live
destination.

## Events

- `sf-download-file-download` — a person pressed the file: the request to
  download it (standard 1.3.8 §8, vocabulary 1.1.5 §5.1). `detail` is
  `{href, fileName, download}`. It is **cancelable**: `preventDefault()` stops
  the browser's download or navigation, so a page can take the download over.
  The old name `sf-download-file:click` follows it with the same detail and
  the same cancel until 2026-12-01 (`aliases.json`).

```js
file.addEventListener('sf-download-file-download', (event) => {
  event.preventDefault();
  startDownload(event.detail.href, event.detail.fileName);
});
```

## Attributes

- `size="1/3|1/2|1|2|3"`
- `file-name`
- `file-size`
- `icon`
- `href`
- `download`
- `disabled`
- `target`
- `aria-label` — a host attribute, passed to the link or button

## Example

```html
<sf-download-file
  size="1"
  file-name="logo.svg"
  href="/assets/img/logo.svg"
  download
></sf-download-file>
```

If `file-size` is omitted, the base component will try to resolve it from `Content-Length`.
Pass the known size when possible so rendering has no discovery request.

That request is the component's one network side effect, declared in
`component.json` (`side-effects: network`).

## Public variables

Each falls back to the internal token (standard simai.smart-component 1.3.8
§6): `--sf-download-file-background-color` and `-border-color` (at rest),
`-radius`, `-padding`, `-gap`, `-icon-size` and `-icon-color`.
