# Icon subset runtime

Framework Loader preserves the existing icon markup and supports two modes.

- Without a production build it discovers `.sf-icon` and `<sf-icon>` nodes,
  requests cumulative subsets and atomically replaces a family only after its
  font is ready.
- With a production build the initial manifest is already prepared; Loader
  handles only icons added later.

## A growing subset

An icon that already showed never blanks while the subset grows; only a new
name waits. When a page asks for a name its subset does not hold (a theme
button turning `light_mode` into `dark_mode`), the grown subset declares the
same family, and as a CSS `@font-face` it would shadow the loaded face while
its file is on the way: with `font-display: block`, a spec-following browser
draws every icon blank until the file arrives. So the Loader loads the grown
face with the FontFace API first, adds it to `document.fonts` once its file is
in, then puts in the subset stylesheet without its `@font-face` and retires the
old stylesheet together with the faces it carried. The faces ride on the
`<style>` element, so a copy of the Loader in another bundle retires them too.
The changed icon itself loses `sf-icon-loaded` before the next paint, so it
waits unseen instead of spelling its name out in a fallback font (probe
`tests/browser/icons-subset-grow.browser.mjs`).

## The next page on the same origin

A page whose origin already had the icon face draws its icons with their glyphs
from the first frame. The Loader asks the subset service once the page is
ready, and its `@font-face` goes in only when that answer is back; on
effects.simai.io (pair `ui-2d39b617a719`) the header's `sf-icon-button` squares
therefore painted empty for some 340 ms on every load, a warm cache included.
Two causes, both fixed:

- The Loader remembers the manifest the service sent with its last subset
  (`localStorage`, key `SF_ICON_SUBSET_MANIFEST`, `:rounded` / `:sharp` for the
  other families). A page that sets no `cacheVersion` -- most sites -- had it
  wiped with the rest of the `SF_` caches on every boot. The remembered subset
  is now kept through that wipe: it is not a list of a release's plugins but the
  service's own answer, checked again on every use.
- At boot, before any component renders, the core runtime writes the
  remembered subset's stylesheet into the head (the same `<style
  data-sf-icons-subset-family>` the Loader writes, marked
  `data-sf-icons-remembered`) with no `@font-face` of its own, fetches each of
  its font files with `fetch()` and builds the faces from their bytes
  (FontFace), and lifts `data-sf-icons="subset-pending"` as soon as they are
  loaded. A `fetch()` does not hold the window's `load` event, where a
  preload or an `@font-face` request made during parse does (R078: with the
  icon host held 25 s, `load` came at 25.9 s). On a warm HTTP cache the face is
  in before the first icon button draws. The Loader adopts that stylesheet when
  it restores the same manifest, waiting for its faces for no longer than the
  subset deadline (3 s; then the full font draws), so its icons count as
  loaded from their first render.

Then the Loader asks the service as before. A page that needs a name the
remembered subset does not hold grows it the way any subset grows (above): the
remembered face keeps drawing every icon it holds, and the new name waits
unseen until the grown face is loaded. Shared code:
`src/core/js/icon-subset-memory.js`.

What is reused is checked first. A remembered manifest is used only when its
family is the page's icon type, every icon name is a plain ligature name
(`[a-z0-9_]`), its family name and weights are plain values, and every font
file it names is on the subset host the page is configured with
(`icons.subsetHost`, by default `https://icons.simai.io`), over that host's own
scheme. Anything else is not used (and the Loader drops it); nothing but the
manifest the service sent is stored. Every storage access is guarded: a
sandboxed page without storage simply starts cold.

`font-display` stays `block`. An icon's fallback text is its name spelled out,
so an icon waits unseen rather than swap; a remembered face comes out of the
HTTP cache well inside the block period.

`icons.remember = false` turns this off: nothing is remembered between pages
(an existing entry is removed), and every page asks the service cold.

```html
<script>
  window.SF_BOOT_CONFIG = {icons: {remember: false}};
</script>
```

Measured with the probe `tests/browser/icons-warm-first-frame.browser.mjs`
(subset service stubbed with a 250 ms stylesheet and a 400 ms cold font file):
before, a warm page showed its icon buttons empty from about 100 ms to about
420 ms after navigation; after, the glyphs are drawn in the frame the buttons
first stand on screen, and no subset request is made for a page whose icons
the remembered subset holds. The cold first visit is unchanged.

### What a site can do on a pair without this

On a pair that predates the change (`ui-2d39b617a719` and earlier), a page
that sets a `cacheVersion` keeps the remembered subset already, and the
Loader's own restore then draws the header's icons from their first frame on a
warm cache (measured with the same probe). Use the pair id, and change it with
the pair, since it also versions the Loader's cached plugin lists:

```html
<script>
  window.SF_BOOT_CONFIG = {cacheVersion: 'ui-2d39b617a719' /* , ...the rest */};
</script>
```

For the cold first visit, two hints in the page's own `<head>`, before
`core.js`, start the work the core runtime would only start once it runs:

```html
<link rel="preconnect" href="https://icons.simai.io" crossorigin>
<!-- Only with a fixed icon list (icons.staticSubset): the font file the
     service answers that list with. Its name is the hash of the list, so it
     changes when the list does. -->
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="https://icons.simai.io/ms/font/<hash>.woff2">
```

The font preload only warms the file; the face is declared by the runtime. A
preload is a request of the document: while the icon host is slow it holds the
window's `load` event (not the page scan or the splash, which do not wait for
`load`).
Sites keep using the Framework's icons as they are -- no `@font-face` of their
own.

`outlined`, `rounded` and `sharp` are tracked independently. A manifest for one
family never replaces another family. `localStorage` is only a cache hint; a
font and manifest still have to pass runtime verification.

If the optional subset service is unavailable, Loader uses the exact local
Framework distribution under `window.sfPath`:

- `component/icons/fonts/MaterialSymbols-Outlined.woff2`;
- `component/icons/fonts/MaterialIconsRound-Regular.otf`;
- `component/icons/fonts/MaterialIconsSharp-Regular.otf`.

The production packaging contract treats the two fixed OTF files as local
Framework assets. They are shipped for the emergency `rounded` and `sharp`
fallbacks, but are not requested during the initial page load. The dynamic
subset path remains the preferred path for all three families.

There is no `@latest` fallback. A service failure produces one diagnostic per
family and does not expose a network dependency as a correctness requirement.

## An app that serves its own icons

The subset service is an optimisation, not a dependency. Four settings, all
read at boot, so they belong **before** `core.js` on the page:

```html
<script>
  window.sfPath = '/fw/';                       // where the distribution is served
  window.SF_BOOT_CONFIG = {icons: {enabled: false}};
</script>
```

- `icons.enabled = false` — no subset at all: no request, no preconnect, no
  `data-sf-icons="subset-pending"` wait. The icons stylesheet declares the full
  Material Symbols font from the distribution itself, so the page draws its
  icons from the app's own files. This is the setting for an offline or
  air-gapped app; it costs the whole font (about 409 KB) instead of a subset.
  An icon is marked `sf-icon-loaded` -- and drawn -- once that font has
  loaded, so its ligature text never shows; icons added later are marked the
  same way (probe `tests/browser/icons-local-font.browser.mjs`).
- `icons.subsetHost = 'https://icons.example.com'` — the same runtime against a
  subset service the app hosts itself.
- `icons.fallbackFonts = {outlined, rounded, sharp}` (or `icons.fallbackFontUrl`
  for one) — where the full-font fallback lives when the app serves the fonts
  from somewhere other than `<sfPath>/component/icons/fonts/`.
- `icons.remember = false` — nothing is remembered between pages on the
  origin: no subset is written at boot, every page asks the service cold (see
  "The next page on the same origin").
- `icons.staticSubset = {icons: [...], weights, fill, grade, optical_size, type}`
  — the icon list a production build already knows: one request for exactly
  those icons instead of discovery, and nothing is asked for again as the page
  grows. It still asks the service, so it is a build-time optimisation, not an
  offline mode.

The distribution carries the fonts the local paths point at:
`component/icons/fonts/MaterialSymbols-Outlined.woff2` and the two OTF files
for the `rounded` and `sharp` fallbacks. They are part of the published package
(`distr/component/icons/fonts/` in `simai/ui`, checked in the ui-mail M0
consumer case `ui-mail.icons-offline`, 2026-10-21): an app that serves the
distribution it installed serves them too. Offline, the words themselves
(`error`, `upload_file`) are what shows while a page waits for a font it cannot
fetch — the ligature text of an icon with no font behind it.
Projects do not need new markup or mandatory configuration.

## A face the page brings itself

With the subset on, an icon is also marked `sf-icon-loaded` when the face it is
drawn in was brought by the page and has loaded: the first family of the icon's
computed `font-family` is an icon font family (its name holds "Symbols
Outlined", "Symbols Rounded" or "Symbols Sharp") with a loaded face in
`document.fonts`, and it is not one of the Loader's own subset families. A
Docara example frame (`data-docara-example-frame`) gets its faces from the
shell -- "Material Symbols Outlined Full", its own subset and catalogue
families, Rounded and Sharp -- and marks the icons it draws; the Loader used to
know only the faces its own subset requests brought, so it took the class away
on every scan while Docara put it back. The Loader owns the class there too,
and keeps it while that face is loaded.

The Loader's own subset families still answer by their manifest only: a subset
face draws just the names it lists. A full face the Loader left in
`document.fonts` after a fallback does not mark a new name while the icon is
drawn in the subset family, and a text font (an icon whose stylesheet is not
in yet inherits it) never does. A face that loads later (`loadingdone`) or is
added already loaded (looked for every 100 ms for 10 s after the first icon the
Loader could not mark) syncs the icons once (core.runtime 1.54.1, probe
`tests/browser/icon-loaded-document-fonts.browser.mjs`).

## A page without the Loader

core.css holds every `.sf-icon` at font-size 0 until it is marked
`sf-icon-loaded`, and only the Loader marks icons. A page that links core.css
and the icons sheet by hand, with no Loader, therefore drew no icon. The
Loader now writes `data-sf-loader` on `html` when it boots; without it the
icons sheet (component.icons 1.1.0) lifts the hold, and its face
(`font-display: block`) keeps the name unseen while the font loads and then
draws the glyph. core.css alone carries no icon font: a page needs the icons
sheet to draw icons, with or without the Loader (probe
`tests/browser/icons-without-loader.browser.mjs`).
