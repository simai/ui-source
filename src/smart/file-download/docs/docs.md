# Download File Smart Component

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

`sf-file-download` is a smart wrapper over the base `download-file` component.
With `href` it renders a native anchor; without `href` it renders a button for
an application-owned action. `disabled` renders a disabled button and no live
destination.

A file link downloads in the same tab (decision C25): the download semantics
are on unless `target="_blank"`, which is a file opened to view. Such a link
shows the `open_in_new` sign after the name and tells a screen reader
«(откроется в новой вкладке)».

## Preparing and failing (decision C25)

A file the application makes on demand: cancel the request, set
`state="preparing"` (the spinner stands in the download sign's place, the
type and size give way to «Готовим файл…», `aria-busy="true"`, a second press
does nothing), then `state="ready"` with the `href` -- the file the person
pressed for is fetched once -- or `state="error"`: an error notice
«Не удалось подготовить файл» (`error-text` adds its words) with «Повторить»
under the file. The two stand in one column of the component's own
(`.sf-download-file__stack`), so a flex row around the element does not put
the notice beside the file. «Повторить» sends `sf-file-download-retry {href, fileName}`;
when the notice goes away, the focus it held moves to the file, not to the page.

```js
file.addEventListener('sf-file-download-download', async (event) => {
  event.preventDefault();
  file.state = 'preparing';
  try {
    file.href = await buildReport();
    file.state = 'ready';
  } catch {
    file.state = 'error';
  }
});
file.addEventListener('sf-file-download-retry', () => { /* prepare again, as above */ });
```

## Events

- `sf-file-download-retry` -- «Повторить» was pressed under a file that could
  not be prepared; `detail` is `{href, fileName}`.

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
- `file-name` -- empty: the link's last part, else «Файл»
- `file-type` -- the type in words (PDF, XLSX), before the size: «PDF · 2,4 МБ»
- `file-size` -- the size as text in the page's units; empty with `href`, it is
  asked of the file and written in the page's language («2,4 МБ»)
- `state` -- `ready` (default), `preparing`, `error`
- `error-text` -- more words in the error notice
- `icon` -- former way to name the type by a glyph in the download sign's
  place; still drawn until 2027-01-01, give `file-type` instead
- `href`
- `download` -- kept for compatibility; a file link downloads anyway
- `disabled`
- `target` -- empty (default): download in the same tab; `_blank`: open to view
- `aria-label` — a host attribute, passed to the link or button

## Example

```html
<sf-file-download
  size="1"
  file-name="logo.svg"
  file-type="SVG"
  href="/assets/img/logo.svg"
></sf-file-download>
```

If `file-size` is omitted, the base component will try to resolve it from `Content-Length`.
Pass the known size when possible so rendering has no discovery request. A
`data:` or `blob:` address is never asked: those bytes are the page's own, so
the page passes `file-size` with them. Nor is an address that leads back to the
page itself (`#`, `#part`, the page's own URL): it is no file.

That request is the component's one network side effect, declared in
`component.json` (`side-effects: network`).

## Public variables

Each falls back to the internal token (standard simai.smart-component 1.3.8
§6): `--sf-file-download-background-color` and `-border-color` (at rest),
`-radius`, `-padding`, `-gap`, `-icon-size` and `-icon-color`. Until
2027-01-01 each also reads its former name, `--sf-download-file-*`, under the
new one (change journal `token-file-download-variable-names`).
