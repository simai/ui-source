# Include Smart Component

`sf-include` puts a part of the page that the site's server answers at an
address into the page: a news block, a list rendered on the server, a part
below the fold that is loaded only when a person scrolls near it. It replaces
the retired class units `ajax`, `ajaxload` and `lazy-load`.

```html
<sf-include src="/parts/news/"></sf-include>

<sf-include src="/parts/reviews/" load="view"></sf-include>
```

While the part loads the element shows a placeholder; when it arrives, the
server's HTML takes its place and the components in it start; when it does
not, a short message and «Повторить» / «Retry».

The component owns the request, the placeholder, the error state and starting
the components of the part. The server owns the part itself and who may see
it: it answers the markup, or refuses with a status.

## Attributes

- `src` — the address. Relative to the page, like a link. Changing it loads
  the new part in place of the old one; empty, nothing is fetched and the
  placeholder stays.
- `load="now|view"` — `now` (the default) fetches as soon as the element is on
  the page; `view` fetches once, when the element comes within 200 px of the
  viewport. Where the browser has no IntersectionObserver, `view` loads at
  once. Nothing polls: the observer is gone after its first sighting.
- `lines` — how many text lines the placeholder skeleton draws (1–20, 3 by
  default; the last line is shorter).

## The placeholder

By default an `sf-skeleton` of `lines` lines. The page may give its own
instead, in the slot `placeholder`:

```html
<sf-include src="/parts/news/">
  <div slot="placeholder"><p>Загружаем новости…</p></div>
</sf-include>
```

The placeholder shows again while a part reloads (`refresh()`, a new `src`).
Give the region a height with `--sf-include-min-block-size` when the part's
height is known, so the page does not move when it arrives.

## What is inserted

The answer is read as text and inserted as HTML. A whole document is taken by
its `<body>`.

- **Scripts are not run.** Every `<script>` that is code is taken out, and so
  are inline event handlers (`onclick`, `onerror`, …) and `javascript:`
  addresses. A JSON island (`<script type="application/json"
  data-sf-settings>`) stays: the components of the part read their lists from
  it. Put behaviour into components, not into the part's scripts.
- **Components start.** The Loader scans the inserted markup as it scans any
  markup added to the page: Smart components, class components and utilities
  in the part are loaded and drawn. The element asks for the part's Smart tags
  at once, so they do not wait for the Loader's next pass.
- **It is not a sanitizer.** The part is the site's own markup. HTML from an
  untrusted source goes through `SF.sanitizeHtml` and is drawn by the page.

## The request

`fetch(src)` with `credentials: 'same-origin'` and `Accept: text/html`. An
address of the same site is loaded with the page's cookies; another origin is
loaded only when its server allows it by CORS, and without cookies. One
request at a time: a new `src` or `refresh()` aborts the request in flight,
and removing the element aborts it too.

## The error state

A network failure, a CORS refusal or an answer outside 200–299 shows one row:
an icon, «Не удалось загрузить эту часть страницы.» / «Could not load this part
of the page.» in a polite status, so a screen reader announces it, and the
outline button «Повторить» / «Retry», which calls `refresh()`. Focus that was
on Retry stays in the region while the part loads again.

## Events

- `sf-include-loaded` — `{src, status}`: the part is on the page. Sent after
  the markup is inserted, so a listener finds it in the element.
- `sf-include-load-failed` — `{src, status, reason}`: `reason` is `network`
  (`status` null) or `http` (`status` is the server's code).

Both bubble and are composed.

```js
document.querySelector('#news').addEventListener('sf-include-load-failed', (event) => {
  console.warn('news did not load', event.detail.status);
});
```

## Methods

- `refresh()` — fetches `src` again now, whatever `load` says. Answers a
  promise of `{outcome: 'applied'}`, `{outcome: 'refused', reason: 'no-src' |
  'network' | 'http'}` or `{outcome: 'cancelled'}` (a newer load replaced it, or
  the element was removed). A page button runs it with
  `data-sf-action="<id>.refresh"`.

## States

- `aria-busy="true"` on the region while the part loads; `data-loading` on the
  host while it loads and `data-failed` while it shows the error.

## Public CSS variables

- `--sf-include-min-block-size` — the placeholder's minimum block size (0 by
  default).
- `--sf-include-gap` — the space between the error's icon, message and Retry.
- `--sf-include-padding` — the error row's inset.
- `--sf-include-border-color` — the error row's edge.
- `--sf-include-radius` — the error row's corners.
- `--sf-include-message-color` — the error message's colour.
