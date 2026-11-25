# Rendering a Smart component from its settings

`first-paint-render` prints the first paint of a Smart component from its
settings. A server sends a request such as
`{"tag": "sf-badge", "settings": {"text": "Оплачен", "status": "success"}}`.
The tool answers with the host as a server prints it: the attributes, a
JSON island for list and object settings, and the static markup marked
`data-sf-static`. It also gives the sheets that markup needs. The server prints
the markup and links the sheets. The page shows the component at once, and
it does not move when the Framework's code arrives and adopts it.

It is for a server that builds pages ahead of time and can run Node, such as a
documentation site (Docara). The tool replaces hand copies of a component's
markup in another language. Those copies drift: Docara's copy of `sf-badge`
already wrote `justify-center` where the component draws
`content-main-center`. A server that renders each request in PHP and cannot
run Node is not covered (see [Limits](#limits)).

Nothing is guessed. The tool draws the component with the build's own code, in
a headless browser, as `scripts/snapshot-first-paint.mjs` draws the Framework's
committed snapshots. Both use the same page, the real Loader, the same settling
and the same serializer (`scripts/first-paint-lib.mjs` `drawExample`). A request
with an example's settings is answered with that example's snapshot, byte for
byte. The answer's `snapshot` names it. If a request is not something the
component prints, the tool refuses it and says why. It never prints wrong
markup.

The request and the answer are the format `simai.first-paint-render` with
`schema_version` 1 (a format's name carries no version; its major is
`schema_version`): `contracts/schema/first-paint-render.schema.json`.

## Where it is

| | path |
|---|---|
| in a pair | `distr/core/js/composition/first-paint-render.mjs` (the command line and the module) and `distr/core/js/composition/first-paint/` (`render.mjs`, `engine.mjs`, `lib.mjs`, `page.mjs`) |
| in ui-source | `tools/first-paint/render.mjs`; the pair's copy is written by `scripts/build-first-paint-kit.mjs` from it, `tools/first-paint/kit-engine.mjs`, `scripts/first-paint-lib.mjs` and `scripts/first-paint-page.js` (`--check` fails on a stale copy) |

The pair's copy ships with the pair and is hashed with it. Pin it together
with the `distr/` it draws from. Its `--distr` defaults to the `distr/` it is in.

## Requirements

- Node 20 or later.
- Playwright with its Chromium, as a peer dependency. Use the version that
  ui-source `package.json` declares (`playwright` 1.63.0 since group build 19):
  run `npm i playwright@<version>`, then `npx playwright install chromium`, or
  set `PLAYWRIGHT_BROWSERS_PATH` to the folder that holds the browser. The pair's
  copy uses the playwright folder you give it (`--playwright=<dir>` or
  `SF_FIRST_PAINT_PLAYWRIGHT`). If you give none, it uses the playwright that the
  current folder resolves. A caller with its own browser passes `browser` to
  `createRenderer`.
- The Inter font is served from the pair (`core/fonts/`). Text is measured in
  it, never in the fallback.

## Command line

```sh
node distr/core/js/composition/first-paint-render.mjs --session [options]   # JSON lines
node distr/core/js/composition/first-paint-render.mjs [options] < request.json
```

| option | |
|---|---|
| `--distr=<root>` | the Framework build: a pair's `distr/` or a ui-builder output. The pair's copy defaults to its own `distr/`. |
| `--session` | JSON lines: one request per line on stdin, one answer per line on stdout, in the order the requests came |
| `--cache=<dir>` | keep answers by `key` in this folder. A request answered before is read from it and starts no browser. |
| `--build=<id>` | the build's identity in the key (give the pair id). Default: the sha256 of every file the build serves. |
| `--config=<file>` | a first-paint configuration: component packages (ui-pro's) and the clock (`scripts/first-paint-lib.mjs` `readConfig`) |
| `--concurrency=<n>` | how many components are drawn at once (default 2) |
| `--port=<n>` | the build server's port (default: any free port) |
| `--playwright=<dir>` | the playwright package folder, or a `node_modules` folder that holds it |
| `--strict` | exit 1 if a request is refused, unknown or failed |

Without `--session`, stdin holds one request (one answer comes back) or an
array of requests (an array of answers in the same order comes back). Each
run ends with one stderr line: `first-paint render: N requests, N drawn, N
from the cache, N refused, N unknown, N failed`. The exit code is 0 unless
the tool fails, or `--strict` meets a request that was not printed. Exit code
2 means the command line or stdin was wrong.

## How Docara calls it

At build time, the same way it runs the Composition Recipe runtime: a PHP
`Process` over the pinned pair, with one session for the whole build.

```sh
node <pair>/distr/core/js/composition/first-paint-render.mjs \
  --session --build=ui-b4f79e1c58b7 --cache=<site>/.cache/first-paint \
  --playwright=<site>/node_modules/playwright
```

One request per line:

```json
{"id": "badges/status-1", "tag": "sf-badge", "settings": {"text": "Оплачен", "status": "success"}, "prefix": "badges-status-1"}
```

One answer per line (wrapped here):

```json
{"schema": "simai.first-paint-render", "schema_version": 1, "id": "badges/status-1",
 "key": "sha256:…", "build": "ui-b4f79e1c58b7", "status": "printed",
 "tag": "sf-badge", "template": "default",
 "html": "<sf-badge text=\"Оплачен\" status=\"success\" style=\"display: contents;\">\n<span class=\"sf-badge sf-badge--tonal sf-badge--success sf-badge--size-1/3 inline-flex flex-row flex-nowrap content-main-center items-center\" data-sf-static>…</span>\n</sf-badge>",
 "sheets": ["component/badges/css/badges.min.css", "core/css/core.css", "utility/display/default/css/default.min.css", "…"],
 "theme": ["theme-light", "theme-dark"], "snapshot": "smart/badge/static/default/status.html", "notes": []}
```

Then:

1. Link `sheets` in the page's `<head>`, under the site's URL of `distr/`, and
   put a theme class on `<html>`.
2. Print `html` where the component goes.
3. Load the Framework (`core.js`) as usual. Each element adopts its printed
   markup in its first render.

If Node or Chromium is missing, print the empty host
(`<sf-badge text="Оплачен" status="success"></sf-badge>`), as today. Never
print a hand copy. Docara keeps no copy of any component's markup.

## Module

```js
import {createRenderer} from '<pair>/distr/core/js/composition/first-paint-render.mjs';

const renderer = await createRenderer({distr: '<pair>/distr', build: 'ui-b4f79e1c58b7', cache: '.cache/first-paint'});
try {
  const answer = await renderer.render({tag: 'sf-progress-bar', settings: {value: 40}});
  const answers = await renderer.renderMany([request1, request2]);
} finally {
  await renderer.close();
}
```

- `createRenderer({distr, config, build, cache, concurrency = 2, port = 0, timeout = 20000, browser, playwright})`
  returns `{render(request), renderMany(requests), close(), build, stats, origin}`.
  Nothing starts until the first request that must be drawn. A run whose
  requests all come from the cache, or are refused, starts no server and no
  browser (`origin` stays `null`).
- `renderFirstPaint(request, options)` answers one request with a renderer of
  its own.
- `canonicalJson(value)`, `buildIdentity(roots)`, `SCHEMA`
  (`simai.first-paint-render`), `SCHEMA_VERSION` (1), `USAGE` and `main(argv)` (the command
  line) are exported too.
- Component packages for the module: set `FIRST_PAINT_CONFIG`, as for the
  snapshot tool. `config` alone gives the server the packages, but not the
  page's boot configuration.

## Request

| field | |
|---|---|
| `tag` | required: an `sf-*` Smart component the build serves |
| `template` | one of the component's templates (default `default`). Another is written as the host's `template` attribute. A template given in `settings` instead (as the documented examples of `sf-avatar` give it) stays there and is written where the runtime writes it; given in both places, the two must agree. |
| `settings` | setting and value names of its `component.json`. Scalars become attributes, and lists and objects become one JSON island. Each name and each enum value is checked against the manifest. |
| `attributes` | what a page writes on a host that is not a setting: `aria-*`, `role`, `id`, `title`, `lang`, `dir`, `class`, `data-*` (not `data-sf-*`) |
| `children` | markup the page gives inside the host |
| `slots` | slot name → markup |
| `markup` | the page around the element (for example, the text a copy button copies) |
| `lang` | the page language, a language file of the build (`core/lang/<lang>.js`). Default `ru`. The component's words come from it. |
| `now` | the page's frozen clock (ISO date-time with its offset). The default is the snapshots' instant, `2026-10-27T12:00:00+03:00`. The time zone is Europe/Moscow. |
| `prefix` | ids a component makes up are named `<prefix>-<n>`. The default is `sf-<folder>`. Give every instance on one page its own prefix. |
| `url` | the page's address (absolute `http(s)` with a path). What a component resolves against the page, such as a copy link's full URL, is printed from it. It is never fetched. The default is `https://first-paint.invalid/page`, the same on every run, so give the real page address when the markup should hold it. |
| `id` | the caller's name for the instance. It is echoed in the answer and is not part of the key. |

## Answer

- `status`:
  - `printed`: `html`, `sheets`, `theme`, `snapshot` and `notes` follow.
  - `refused`: the request is not something the component prints. `reason`
    says what is wrong and `detail` explains it in words. The reasons are
    `unknown-field`, `tag`, `template`, `settings`, `unknown-setting`,
    `late-setting` (the setting arrives after the first paint; give it to
    the element on the page instead), `value` (an enum value or a type the
    manifest does not allow), `attributes`, `children`, `markup`, `slots`,
    `lang`, `now`, `url`, `prefix`, `schema`, `not-a-request` and `not-json`.
  - `unknown`: the build defines no such tag (`unknown-tag`).
  - `failed`: the component did not draw (`not-drawn`), or its page threw an
    error (`page-error`).
- `key`: `sha256:` of the canonical JSON (keys sorted) of the schema and its version, `build`,
  tag, template, settings, attributes, children, slots, markup, lang, now,
  prefix and url. The same key always gives the same answer. Cache by it.
- `build`: the build identity in the key.
- `html`: print it as is.
- `sheets`: paths relative to `distr/`, sorted: the sheets this page asked
  for, together with every sheet the component's committed first paint names
  (`smart/<folder>/static/sheets.json`). `core/css/core.css` is always among
  them.
- `theme`: one of these classes goes on `<html>`.
- `snapshot`: the committed snapshot this markup is
  (`smart/<folder>/static/<template>/<example>.html`), or `null`.
- `notes`: `overlay-closed`. An overlay is printed closed and its `open`
  setting is left out.

The output is deterministic. The same request and the same build give the
same bytes. The ids are renamed from `prefix`, the clock is frozen, px sizes
the code measured are left out of inline styles, and text is set in Inter.
A utility sheet that only the Loader's idle scan asks for can come or not on
a heavily loaded machine (`sheetDrift` in `snapshot-first-paint.mjs`); the
committed list in `sheets` keeps such a sheet in every answer of a documented
setting.

## Limits

- A browser at build time: Playwright with Chromium (about 150 MB) beside the
  site. The first request that must be drawn starts it, and cached answers do
  not.
- A server that renders each request in PHP cannot use this tool. That needs
  `template.html` compiled for both sides (standard §5.2), which is a separate
  decision.
- A setting that arrives after the first paint (late data) is refused. Its
  first paint is a skeleton the element draws itself.
- Draw on the platform you publish from. The snapshots are taken on macOS.
  The renderer's bytes on Linux CI have not been measured against them yet.
  The determinism check runs on one machine.

## The template files a manifest names

A Smart component's `component.json` names its templates
(`templates.<name>.file`). The distribution holds each one at that path. The
build ships a component's template folder (`js/templates/` or `template/` in
ui-source) as `template/`, so a manifest names `template/<file>`.
`scripts/check-shipped-paths.mjs [<build>]` fails when a path that a manifest
names is not in the distribution. Paths that are not shipped yet are migration
debt, listed by component in `contracts/shipped-template-paths.json`. The
check also fails on a listed path that ships now. The file is the template's
Lit source: it imports `lit` and Framework helpers by their ui-source paths, so
a server reads it but does not run it. Use this tool to print the component
from its settings.
