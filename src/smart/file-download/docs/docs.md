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

## The row (decision C51)

The row is as wide as its text, up to its container; `full-width` stretches it
to the container. The type and the size stand right after the name
(«Смета.csv  CSV · 112 Б»); below the `sm` step (32rem, a phone) they go under
the name, a step smaller. The name is never cut: it wraps whole. The row keeps
the height of an `sf-button` of the same size while the name fits one line.

A screen reader hears «Смета.csv, CSV, 112 байт»: the commas are pauses and the
unit is a word in the page's language and in the number's form («2,4
мегабайта», «1 kilobyte»). The visible «CSV · 112 Б» is hidden from it.

## Preparing, ready and failing (decisions C25, C51)

A file the application makes on demand: cancel the request, set
`state="preparing"`, then `state="ready"` with the `href`, or `state="error"`.

- **Preparing.** The spinner stands in the download sign's place and
  «Готовим файл…» in place of the type and the size; with `value` (0–100) the
  progress ring stands there and the words are «Готовим… 45 %». `aria-busy` is
  on the row and a second press does nothing. With `cancelable`, «Отменить»
  stands beside the row; its press sends the cancelable `sf-file-download-cancel`
  and, unless a listener prevents it, the row is ready again at once.
- **Ready.** The file the person pressed for is fetched by itself only if it
  came within 10 seconds of the press and the page is in sight. Otherwise the
  row shows the success sign, «Готово · CSV · 2,4 МБ» and «Скачать» beside it,
  so the download is a fresh press: the browser asks nothing and the download
  does not arrive unexpectedly.
- **Error.** The row itself says so: the error sign and border, «Не удалось
  собрать» in place of the type and the size, «Повторить» at its end, and
  `error-text` small under the row. The row and the line stand in one column
  of the component's own (`.sf-download-file__stack`), so a flex row around the
  element does not put them side by side. «Повторить» sends
  `sf-file-download-retry {href, fileName}`; the file is fetched when it is
  made, as after the first press.

The start («Готовим файл «…»»), the end («Файл готов: …») and a cancel are
said in a polite live region, an error in an assertive one. A state the page
was written with is shown, not said. When the element draws away what held the
focus, the focus goes to «Повторить» or «Скачать», else to the row: the file
is a button until it has an `href` and a link after, and the link takes the
focus the button held (only if it was on the file).

```js
file.addEventListener('sf-file-download-request', async (event) => {
  event.preventDefault();
  file.setAttribute('state', 'preparing');
  try {
    file.setAttribute('href', await buildReport((share) => file.setAttribute('value', share)));
    file.setAttribute('state', 'ready');
  } catch {
    file.setAttribute('error-text', 'Сервер не ответил. Файл соберётся заново.');
    file.setAttribute('state', 'error');
  }
});
file.addEventListener('sf-file-download-retry', () => { /* prepare again, as above */ });
file.addEventListener('sf-file-download-cancel', () => { /* stop the work */ });
```

## Events

- `sf-file-download-request` — a person pressed the file: the request to
  download it (standard 1.3.8 §8, vocabulary 1.1.5 §5.1). `detail` is
  `{href, fileName, download}`. It is **cancelable**: `preventDefault()` stops
  the browser's download or navigation, so a page can take the download over.
  Its former name `sf-file-download-download` said the word twice (decision
  C51); it follows with the same detail and the same cancel until 2027-01-01,
  as the older `sf-download-file-download` and `sf-download-file:click` do
  (`aliases.json`); listen to the new one.
- `sf-file-download-retry` — «Повторить» was pressed in a row that could not be
  made; `detail` is `{href, fileName}`.
- `sf-file-download-cancel` — «Отменить» was pressed beside a file being made;
  `detail` is `{href, fileName}`. Cancelable: a host that prevents it sets
  `state="ready"` itself when the work stopped.

## Attributes

- `size="1/3|1/2|1|2|3"` — as tall as an `sf-button` of the same size (one
  height per size, rule C01)
- `full-width` — the row fills its container; without it the row is as wide as
  its text
- `file-name` — empty: the link's last part, else «Файл»
- `file-type` — the type in words (PDF, XLSX), before the size: «PDF · 2,4 МБ»
- `file-size` — the size as text in the page's units; give it (see below)
- `state` — `ready` (default), `preparing`, `error`
- `value` — while preparing, the share made, per cent
- `cancelable` — while preparing, «Отменить» beside the row
- `error-text` — why the file could not be made, small under the row
- `icon` — former way to name the type by a glyph in the download sign's
  place; still drawn until 2027-01-01, give `file-type` instead
- `href`
- `download` — kept for compatibility; a file link downloads anyway
- `disabled`
- `target` — empty (default): download in the same tab; `_blank`: open to view
- `aria-label` — a host attribute, passed to the link or button

## Example

```html
<sf-file-download
  size="1"
  file-name="logo.svg"
  file-type="SVG"
  file-size="12 КБ"
  href="/assets/img/logo.svg"
></sf-file-download>
```

Give `file-size`. Without it the component asks the file's size with one `HEAD`
request only when the `href` is an http(s) address on the page's own origin; a
file on another server (the request fails without CORS), a `data:` or `blob:`
address (the page's own bytes) and an address that leads back to the page
itself (`#`, `#part`, the page's own URL) are never asked. That request is the
component's one network side effect, declared in `component.json`
(`side-effects: network`).

A browser downloads a cross-origin link only when its server sends
`Content-Disposition: attachment`; the `download` name is honoured on the same
origin. For a large server file let the browser fetch the URL (its own
download manager shows the progress); build a `Blob` only for a file the page
makes itself.

## Recipes

### In a table row

The file's name is a plain link to the file, the type and the size a quiet
line under it, and at the end of the row a quiet icon button whose name says
which file it fetches — an `sf-button-icon` with `href` is a real link:

```html
<td>
  <a href="/files/invoice-1043.pdf" download="Счёт 1043.pdf">Счёт 1043.pdf<span class="sr-only">, PDF, 164 килобайта</span></a>
  <span class="color-on-surface-variant text-1/2" aria-hidden="true">PDF · 164 КБ</span>
</td>
<td>
  <sf-button-icon size="1/2" appearance="ghost" scheme="on-surface-variant" icon="download"
    href="/files/invoice-1043.pdf" download="Счёт 1043.pdf" aria-label="Скачать Счёт 1043.pdf"></sf-button-icon>
</td>
```

The icon is visible at rest, not on hover: a phone has none. A file made on
demand sets `loading` on the icon button while it is made.

### Several files

Over the list say how many files there are and how much they weigh together,
and offer one archive: the application builds it (a file made on demand, as
above), and the browser fetches one file. Never start several downloads at
once: the browser asks whether the site may download several files.

```html
<div class="flex items-cross-center justify-between gap-1/2">
  <div><p class="m-0">Документы к сделке</p><p class="m-0 color-on-surface-variant text-1/2" id="deal-total">3 файла · 1,4 МБ</p></div>
  <sf-button height="low" appearance="tonal" scheme="primary" icon-start="download" text="Скачать всё архивом" aria-describedby="deal-total"></sf-button>
</div>
<sf-file-download file-name="Договор № 77.pdf" file-type="PDF" file-size="1,2 МБ" href="/files/contract-77.pdf"></sf-file-download>
<!-- … -->
```

### A very long export

An export that takes minutes (thousands of rows) is a long operation, not a
file row: run it in `sf-progress-run` (decision C34) and, when it is done, tell
the person with a notice «Готово — скачать» that links to the file.

## Public variables

Each falls back to the internal token (standard simai.smart-component 1.3.8
§6): `--sf-file-download-background-color` and `-border-color` (at rest),
`-radius`, `-padding`, `-gap`, `-icon-size` and `-icon-color`. Until
2027-01-01 each also reads its former name, `--sf-download-file-*`, under the
new one (change journal `token-file-download-variable-names`).
