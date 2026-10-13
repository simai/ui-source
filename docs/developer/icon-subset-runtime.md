# Icon subset runtime

Framework Loader preserves the existing icon markup and supports two modes.

- Without a production build it discovers `.sf-icon` and `<sf-icon>` nodes,
  requests cumulative subsets and atomically replaces a family only after its
  font is ready.
- With a production build the initial manifest is already prepared; Loader
  handles only icons added later.

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
Projects do not need new markup or mandatory configuration.
