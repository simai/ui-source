# The port declared on the element

A port-fed element (a list, a property view) asks its host for data only once
its code is defined. On a cold page that is seconds after the page arrived,
and the port's answer comes on top of that. A page that knows the element's
first call can declare it in the element. Core then sends that call when it
runs, before any component's code, and the element takes the answer when it is
defined. One request, in parallel with the code (stand 27: rows 0.3–0.7 s
earlier on fast-4G with a 4× CPU).

Core runtime 1.2.0 (`src/core/js/early-port.js`, `SF.EarlyPort`).

## The island

```html
<sf-data-view id="list" aria-label="Каталог">
  <script type="application/json" data-sf-port>{
    "port": "simai.dataview-port",
    "version": "1.12.0",
    "url": "/admin/catalog/port",
    "capabilities": ["row-actions", "count-on-request"],
    "first": {"intent": "query.change",
              "payload": {"query": {"filters": {}, "search": "", "sort": [], "page": 1, "per_page": 20}}}
  }</script>
  …the element's first paint…
</sf-data-view>
```

| field | |
|---|---|
| `port` | the port id (required) |
| `version` | the port's version; the element refuses a version it does not take |
| `url` | the port's endpoint on the standard wire: `POST {intent, payload, page}`, same-origin with cookies, a JSON answer. Without `url` the port comes from the page's registry (below) |
| `capabilities` | what the port offers; the element draws by them before the port answers (sf-data-view 1.5.0), so its first draw is final |
| `first` | `{intent, payload}`: the call the element sends first, without `sequence` and `reason`. Optional `body`: the request body sent as is instead of the standard one (a product's own wire) |
| `connect` | `false`: Core starts the call only; the page connects its own adapter, which asks `SF.EarlyPort.take(…)` first |
| `csrf` | `"meta:<name>"`: the content of `<meta name="<name>">` goes in `X-CSRF-TOKEN` |

The island is the element's own child, it is JSON, and `</` inside it is
escaped (`</`). It stays in place: the element reads its capabilities
and first query from it.

## What Core does

1. When it runs (DOMContentLoaded at the latest), Core reads every island and
   sends `first` once. An element added later is read when the Loader finds it.
2. When the element is defined, Core hands it the port with the base action
   `connect-port`, in the task that defines it. The page writes no code to
   connect it. A port the page connected first is left alone.
3. The port's first call of that intent takes the early answer when the port
   id, the version, the intent and the canonical payload (object keys sorted,
   `sequence` and `reason` left out) are the same, the call started less than
   10 s ago, and the page was not restored from the back/forward cache. The
   answer carries the asker's `sequence`. Otherwise the port is asked, and an
   early call still running is aborted.
4. Taken once, matched or not. An early call that failed is asked again; it is
   never the element's failure.
5. The Loader asks for the element's parts first (its rule, the parts inside
   it, their relations), and the Smart base defines them in a batch of their
   own, before the other definitions queued in that frame.

A malformed island (not JSON, no port, a url that is not a string) is a console
warning and nothing else: the element falls back to the port the page
connects.

## The page must not guess

The first payload is the query the element will really send: the page size
printed on its page row, the sort and filters the server keeps for the person.
A preference only the browser keeps (a page size in `localStorage`) cannot be
printed. Then the call does not match, the element asks again, and the early
call is one wasted request, never wrong rows.

## A product's own adapter

```js
SF.EarlyPort.register('simai.dataview-port', adapter); // {port, version, capabilities, raise}
```

An island without `url` takes its port from this registry. The early call is
the adapter's `raise`, sent when the adapter is registered (before Core or
after it). An adapter that keeps its own wire and connects itself uses the
adoption contract directly:

```js
const early = SF.EarlyPort.take({port, version, url, intent, payload});
const answer = (early && await early) || await post(intent, payload);
```

`SF.EarlyPort.start({port, version, url, intent, payload}, send?)` starts such a
call from page code.
