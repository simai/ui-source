# Download File Smart Component

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

`sf-file-download` is a smart wrapper over the base `download-file` component.
With `href` it renders a native anchor; without `href` it renders a button for
an application-owned action. `disabled` renders a disabled button and no live
destination.

## Events

- `sf-file-download-download` — a person pressed the file: the request to
  download it (standard 1.3.8 §8, vocabulary 1.1.5 §5.1). `detail` is
  `{href, fileName, download}`. It is **cancelable**: `preventDefault()` stops
  the browser's download or navigation, so a page can take the download over.
  The former names follow it with the same detail and the same cancel until
  their dates (`aliases.json`); listen to this one.

```js
file.addEventListener('sf-file-download-download', (event) => {
  event.preventDefault();
  startDownload(event.detail.href, event.detail.fileName);
});
```

## Attributes

- `size="1/3|1/2|1|2|3"` — as tall as an `sf-button` of the same size (one
  height per size, rule C01); the file name is one line and ends in an
  ellipsis when it does not fit, never broken inside a word
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
<sf-file-download
  size="1"
  file-name="logo.svg"
  href="/assets/img/logo.svg"
  download
></sf-file-download>
```

If `file-size` is omitted, the base component will try to resolve it from `Content-Length`.
Pass the known size when possible so rendering has no discovery request.

That request is the component's one network side effect, declared in
`component.json` (`side-effects: network`).

## Public variables

Each falls back to the internal token (standard simai.smart-component 1.3.8
§6): `--sf-download-file-background-color` and `-border-color` (at rest),
`-radius`, `-padding`, `-gap`, `-icon-size` and `-icon-color`.
