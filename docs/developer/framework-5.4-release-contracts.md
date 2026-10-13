# Framework 5.4 source contracts

SIMAI Framework 5.4 keeps the ordinary HTML-first integration model while
adding reusable contracts for production builds, fields, grouped actions,
Smart Studio metadata and the initial loading state.

## Production asset plans

A production builder may define `window.SF_PRELOADED` before Core starts. When
that object is present, Loader trusts its declared initial modules and does not
restore the plugin list of a previously visited page from `localStorage`.
Dynamic content is still discovered and loaded normally after the first pass.
Projects without a production asset plan keep the existing Loader behavior.

## Loading indicator

Boot and Loader use one shared preloader contract from
`src/core/js/preloader.js`. The default mark is 48 pixels high, uses the
theme-aware `--sf-on-surface` token with immediate light and dark fallbacks and
does not require an external image or stylesheet. Its motion uses a 1800 ms
cycle, a 6 pixel spread and a 90 degree rotation. Projects may still override
the existing preloader settings. When the operating system requests reduced
motion, the same compact mark remains visible without animation.

## Field contract

Ordinary and Smart Input and Textarea implementations now share stable control
and message identities. Required, invalid, hint and error states synchronize
the root element, native control and the following accessibility attributes:

- `aria-invalid`;
- `aria-describedby`;
- `aria-errormessage`.

An error message takes precedence over a hint while the field is invalid.
Existing markup remains valid; the contract fills missing identities and
attributes during initialization.

## Button Group

The ordinary `.sf-button-group` component and the `sf-button-group` Smart
Component own composition, selection and keyboard navigation without changing
the public Button contract. Supported Smart inputs include items, value, size,
tightness, scheme, orientation and disabled state. The component emits
`button-group-change` and supports Arrow, Home and End navigation.

## Smart Studio metadata

Smart Component manifests and reference fixtures are verified against their
source properties and optional `meta.mjs` descriptions. Maintainers use:

```bash
npm run studio:artifacts:verify
npm run studio:artifacts:refresh-metadata
npm run contract:verify
```

The verification command is read-only. Metadata refresh writes only the
source-owned manifests and fixtures and must be followed by the ordinary test
suite.

## Compatibility

- Existing `sfPath`, `sfSmartPath`, Core and Loader entry points are unchanged.
- Projects without a build step continue to use dynamic discovery.
- Existing Button, Input and Textarea markup remains supported.
- The release introduces no network call, global site skeleton or mandatory
  project configuration.
