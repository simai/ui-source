# Pure JavaScript runtime

Simai Framework uses browser APIs for Core, Loader, utilities, and ordinary
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
