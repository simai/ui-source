# Pure JavaScript runtime

SIMAI Framework uses browser APIs for Core, Loader, utilities, and ordinary
components. Smart Components may use Lit for declarative templates. No other
third-party JavaScript library is part of the default runtime contract.

## Product boundaries

- `ui-source` owns Framework source and public browser contracts.
- `ui-builder` compiles deterministic distributions from an exact source
  revision.
- `ui` and `ui-smart` are generated distributions and are never edited by hand.
- `ui-studio` owns authoring tools, including the future embeddable Theme
  Builder.
- `ui-play` owns developer preview and source-editing tools such as Monaco.
- historical Framework 4 libraries remain available only in immutable legacy releases.

## Loader and browser cache

The JavaScript Loader discovers required modules, prevents duplicate loads in
the current page, and appends the configured asset version. HTTP caching is
performed by the browser and web server.

Production assets must therefore use immutable versioned URLs. CSS, JavaScript,
fonts, and images at those URLs should be served with a long-lived immutable
cache policy. A small manifest or entry document that selects the current
version must be revalidated. Runtime PHP compilation and minification are not
part of this contract.

## Loader readiness: `SF.ready`

`core.js` puts its own names on `window.SF` as it runs; the Loader is a chunk
core imports after that, and its names -- `SF.Loader`, `SF.loadSmartBase`,
`SF.smartBaseReady`, `SF.create`, `SF.createAsync`, `SF.whenDefined`,
`SF.whenFieldRenderers`, `SF.RuleLoader.registerPackage` -- arrive together at
the window event `sf-loader-init`. A script that listens for that event after
it was sent waits for ever. `SF.ready` is the readiness to wait on instead
(simai/ui-source#16, `src/core/js/ready.js`):

```js
const SF = await window.SF.ready;   // window.SF, with the Loader's names on it
SF.loadSmartBase();
```

- It is on `window.SF` as soon as `core.js` has run, before the next script.
- It is a thenable (`then`, `catch`, `finally`): `await SF.ready`,
  `SF.ready.then(fn)` and `Promise.resolve(SF.ready)` all settle with
  `window.SF` at the moment the Loader sends `sf-loader-init` -- not before,
  and the event is sent when it always was. A script that asks after that gets
  it already settled. It never rejects.
- One per page. Every bundle carries its own copy of the module, so the first
  copy to run creates it on the shared global, marked
  (`Symbol.for('simai.sf.ready')`), and every later copy -- a component bundle,
  a second `core.js` -- keeps it. The property ignores assignment: an older
  bundle that still writes `SF.ready = ...` does not replace it.
- Called as a function, `SF.ready(fn)` runs `fn` once the Loader is up and the
  document has been parsed, synchronously when both have already happened.
  This is the callback form components have always used; it now also waits
  for the Loader, which is a change only for a script that called it before
  the Loader started.
- A script that runs before `core.js` has no `SF.ready` to read. It queues a
  function, which is called with `window.SF` when `SF.ready` settles:

  ```html
  <script>
    (window.SF_ON_READY = window.SF_ON_READY || []).push((SF) => SF.loadSmartBase());
  </script>
  <script src=".../distr/core/js/core.min.js"></script>
  ```

  Core takes the queue when it runs; a later `push` chains on `SF.ready` at
  once.

`tests/sf-ready.contract.test.mjs`, `tests/browser/sf-ready.browser.mjs`.

## Migration order

1. Replace Swiper behavior with Framework-owned slider primitives, then retire
   the copied Swiper sources.
2. Use the standalone Theme Builder candidate in `ui-studio`; Theme Builder and
   its authoring dependencies are not part of Framework runtime.
3. Keep Monaco in `ui-play`; it is not part of the Framework component catalog.
4. Replace the remaining runtime packages with browser APIs or
   Framework-owned implementations. Keep data-generation packages as
   development-only tools when their generated output and provenance are
   checked into the owning component.

Each retirement requires consumer inventory, a migration note, regression
coverage for the replacement, and a new immutable distribution. Existing
immutable releases are not rewritten.
