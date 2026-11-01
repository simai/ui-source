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
