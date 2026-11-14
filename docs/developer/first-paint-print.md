# Printing the first paint of a page's own markup

`tools/first-paint/print.mjs` prints the first paint of the SIMAI Framework
elements a site writes in its own markup: for each `sf-*` element of a page,
the static markup it shows before any script runs, and the sheets that markup
needs. A documentation site (Docara) calls it at build time and prints the
result into each example frame, so the frame shows the element at once and
does not jump when the Framework's code arrives.

It is the snapshot the Framework takes of its own examples (standard
simai.smart-component 1.3.8 §5.4; `scripts/snapshot-first-paint.mjs`), taken
of markup the site wrote. Both run the same machinery from
`scripts/first-paint-lib.mjs` and `scripts/first-paint-page.js`: the same
page, the real Loader, the same settling (Inter loaded, the network quiet,
three serializations that agree) and the same serializer. For a Smart element
written as one of the Framework's examples, the print is byte for byte the
committed snapshot (`tests/browser/first-paint-print.browser.mjs`).

Nothing is guessed. Each element is drawn by the build in a headless browser.
If the build does not define a tag, the element is reported as `unknown` and
left in the page as written.

## Requirements

- Node 20 or later.
- The `playwright` package and its Chromium build (`npx playwright install
  chromium`, or `PLAYWRIGHT_BROWSERS_PATH` set to where it is).
- A SIMAI Framework build: a pair's `distr/` (the `simai/ui` repository's
  `distr/`, or the npm package `@simai-studio/ui`'s), or a ui-builder build
  output. The tool reads it and serves it on `127.0.0.1` for the browser.
  It never writes to it.

Take the tool from the ui-source revision the pair was built from. The
`Built from ui-source <sha>` line of the pair's Build commit names that
revision.

## Command line

```sh
node tools/first-paint/print.mjs --distr=<root> [options] <page.html ...>
node tools/first-paint/print.mjs --distr=<root> [options] -    # one page on stdin
```

| option | |
|---|---|
| `--distr=<root>` | the Framework build: a pair's `distr/` (or a ui-builder output). Required. |
| `--root=<dir>` | each page's `id` is its path relative to this folder (default: the current folder) |
| `--out=<file>` | write the JSON to this file (default: stdout) |
| `--out-dir=<dir>` | write one `<id without .html>.first-paint.json` per page in this folder instead |
| `--base=<url>` | also give the page and each element `links`: ready `<link>` tags under this URL of `distr/` |
| `--prefix=<text>` | the ids components make up are named `<text>-<element number>-<n>` (default `sf-first-paint`) |
| `--config=<file>` | a first-paint configuration: component packages (ui-pro's) and the frozen clock (`scripts/first-paint-lib.mjs` `readConfig`) |
| `--concurrency=<n>` | how many elements are drawn at once (default 4) |
| `--port=<n>` | the port of the build server (default: any free port) |
| `--strict` | exit 1 if an element is `unknown` or `failed` |

One page gives one result object. Several pages give `{"schema", "pages": [...]}`.
The progress (`<id>: N elements, N printed, N unknown, N failed`) goes to
stderr. The exit code is 0 unless the tool itself fails, or `--strict` finds an
element it could not print. Exit code 2 means the command line was wrong.

```sh
# every example of a docs site, one JSON beside each in a separate tree
cd examples && find . -name 'index.html' | xargs node /path/to/ui-source/tools/first-paint/print.mjs \
  --distr=/path/to/ui/distr --root=. --out-dir=../.first-paint --base=/assets/simai-framework/
```

## Module

```js
import {createPrinter, printFirstPaint, sheetLinks} from '<ui-source>/tools/first-paint/print.mjs';

// One build, many pages: one server and one browser for all of them.
const printer = await createPrinter({distr: '/path/to/ui/distr'});
try {
  const result = await printer.print(markup, {id: 'components/button/overview'});
  // result.html, result.sheets, result.elements ...
} finally {
  await printer.close();
}

// One page.
const result = await printFirstPaint(markup, {distr: '/path/to/ui/distr', id: 'one'});
```

- `createPrinter({distr, config, concurrency = 4, port = 0, timeout = 20000, browser})`
  returns `{print(markup, {id, prefix}), close(), origin}`. `distr` is required.
  `config` is a first-paint configuration file. `timeout` is how many ms an
  element may take to draw. `browser` is a Playwright browser to use instead of
  launching one; the printer does not close a browser it was given.
- `print(markup, {id = null, prefix = 'sf-first-paint'})`: `markup` is a
  fragment or a whole document, and `id` is copied into the result. `prefix`
  names the ids a component makes up. It is either a string, giving
  `<prefix>-<element number>`, or a function `(element, number) => string`.
- `printFirstPaint(markup, options)` prints one page with a printer of its own.
- `sheetLinks(sheets, base)` returns the `<link rel="stylesheet">` tags of
  sheet paths under a URL of `distr/`.
- `snapshotIndex(distr)` maps each of the build's committed snapshot bodies
  to its path. A printed element that matches one names it in `snapshot`.
- `SCHEMA` is `simai.first-paint-print.v1`, and `USAGE` is the command-line
  help.

## Output

```json
{
  "schema": "simai.first-paint-print.v1",
  "id": "components/badges/smart/index.html",
  "theme": ["theme-light", "theme-dark"],
  "html": "<div class=\"flex gap-2\">\n  <sf-badge text=\"Новый\" scheme=\"primary\" style=\"display: contents;\">\n<span class=\"sf-badge …\" data-sf-static>…</span>\n</sf-badge>\n  <sf-no-such-tag></sf-no-such-tag>\n</div>",
  "sheets": ["component/badges/css/badges.min.css", "core/css/core.css", "utility/gap/default/css/default.min.css"],
  "summary": {"elements": 2, "printed": 1, "unknown": 1, "failed": 0, "nested": 0, "snapshots": 1, "textShownTwice": 0},
  "elements": [
    {
      "index": 1,
      "tag": "sf-badge",
      "status": "printed",
      "html": "<sf-badge text=\"Новый\" scheme=\"primary\" style=\"display: contents;\">…</sf-badge>",
      "sheets": ["component/badges/css/badges.min.css", "core/css/core.css"],
      "snapshot": "smart/badge/static/default/reference.html",
      "nested": {"count": 0, "tags": [], "undefined": []},
      "notes": [],
      "source": "<sf-badge text=\"Новый\" scheme=\"primary\"></sf-badge>"
    },
    {
      "index": 2,
      "tag": "sf-no-such-tag",
      "status": "unknown",
      "reason": "this build defines no <sf-no-such-tag>: the Loader loaded nothing that does",
      "nested": {"count": 0, "tags": [], "undefined": []},
      "source": "<sf-no-such-tag></sf-no-such-tag>"
    }
  ]
}
```

- `html`: the page as the browser parses and writes it, with each printed
  element replaced by its first paint. An element that is not printed stays as
  written. A whole document comes back as its contents: the browser drops the
  `<html>`, `<head>` and `<body>` tags and keeps what was inside them.
- `sheets`: every sheet the page's first paint needs. That is each element's
  sheets, plus the sheets of the page as a whole (a wrapper's utilities, such
  as `gap-2`). Paths are relative to `distr/`, sorted. `core/css/core.css` is
  always among them.
- `theme`: the markup also needs one of these classes on `<html>`, as on any
  Framework page.
- `elements`: one entry for each top-level `sf-*` element of the page, in
  document order. An `sf-*` element inside another one is part of that
  element's first paint and is counted in its `nested`.
  - `"status"`: `"printed"`; `"unknown"` (the build defines no such tag);
    `"failed"` (it did not draw within `timeout`, or the page threw an error
    while it drew; see `reason` and `errors`).
  - `html`, `sheets`: the element's first paint and the sheets it needs (only
    when `printed`).
  - `"snapshot"`: the committed Framework snapshot this print is byte for byte
    (`smart/<folder>/static/<template>/<example>.html`), else `null`.
  - `"nested"`: how many `sf-*` elements it holds, their tags, and which of
    those tags the build does not define.
  - `"notes"`: what the printed first paint cannot hold, said rather than
    hidden:
    - `text-shown-twice`: the element took text the page gave it (for
      example, `<sf-button>Сохранить</sf-button>`) into its picture. A text
      node cannot be held out of view, so the page's text is printed after
      the picture and shows beside it until the element draws. Give the text
      as the element's setting (`text="Сохранить"`) and the note goes away.
  - `"source"`: the element as the page wrote it.
- `summary`: the counts of the entries above. `snapshots` counts the
  elements that matched a committed snapshot, and `textShownTwice` counts the
  elements with that note.
- With `--base`, `links` (the page) and each printed element's `links` hold
  the `<link>` tags.

The output is deterministic. The same page and the same build give the same
bytes: ids a component makes up are renamed from `prefix`, the clock is frozen
(`FIRST_PAINT_NOW`, or the configuration's `now`), sizes the code measured in
px are left out of inline styles, and the text is measured in Inter. The one
exception is a utility sheet that only the Loader's idle scan asks for. It is
waited for, but on a heavily loaded machine it can still come or not. The
Framework's own snapshots have the same exception (`sheetDrift` in
`snapshot-first-paint.mjs`).

## Printing it into a frame

1. In the frame's `<head>`, link the result's `sheets` under the site's URL
   of `distr/` (or use `links`), and put the theme class on `<html>`.
2. Print the result's `html` where the example's markup was.
3. Load the Framework (`core.js`) as usual. Each element finds its printed
   markup (`data-sf-static`) and replaces it in its first render.

Print again whenever the pair or the example changes. A print belongs to the
build it was taken from.

## What is drawn, and how

- Each top-level element is drawn alone on a page of its own (1280×800,
  reduced motion), as the Framework draws an example. It does not see the
  rest of the page: an `id` it points to outside itself is not there while
  it draws. The page as a whole is drawn once more, only for its sheets.
- A classic component (class markup, such as `<kbd class="sf-kbd">`) is not
  an element. Its markup is already its own first paint. It stays in `html`
  as written, and the page's `sheets` list its sheet, even on a page that has
  no `sf-*` element.
- An old tag (a dated alias, such as one renamed on 2026-11-03) is drawn as
  the element it now names, so it is printed like the element.
- An overlay (a window, a drawer, a menu) is printed closed, as on any first
  paint: its trigger, or nothing.
- No skeleton is printed. A docs example gives its data in its markup, so its
  first paint is the static markup. The Framework prints skeletons only for
  its own examples that give data late.
- A value the element sets as a property and not as an attribute (an
  `<input>`'s current value) is not in the markup, because the serializer
  prints attributes. The field's box is right, but its text appears when the
  element draws.
- Component packages (ui-pro's `pro`) are drawn when `--config` declares
  them, as for `snapshot-first-paint.mjs --config`.
