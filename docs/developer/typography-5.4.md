# Typography contract 5.4

SF5 5.4 publishes one adaptive typography contract for base scales and the
semantic Label, Body Text, Heading and Display roles. The contract source is
`src/core/contracts/adaptive-sizing.v1.json`; generated SCSS projections carry
its SHA-256 and must pass `npm run adaptive-sizing:check`.

## Public variables

Canonical 5.4 base variables use the double delimiter:

- `--sf-text--size-*`;
- `--sf-text--height-*`;
- `--sf-title--height-*`.

The historical `--sf-text-size-*`, `--sf-text-height-*` and
`--sf-title-height-*` names remain 5.x compatibility aliases. New first-party
styles use the canonical variables.

Semantic roles are exposed as:

- `--sf-label-small|medium|large--size/height`;
- `--sf-text-small|medium|large--size/height`;
- `--sf-heading-1..6--size/height`;
- `--sf-display-1..6--size/height`.

Heading flow uses `--sf-heading--space-top` and
`--sf-heading--space-bottom`. H1 has no top margin; H2-H6 use both tokens.
`--sf-heading--margin` is retained only as a deprecated compatibility alias.
Body flow uses `--sf-text--space-bottom`.

The shared content rhythm is exposed as:

- `--sf-content--space-text` for ordinary text rhythm;
- `--sf-content--space-related` for closely related elements inside one
  composition;
- `--sf-content--space-block` for independent blocks inside one section;
- `--sf-content--space-section` for a transition to a new section.

The parent flow selects the relationship token. A presentational component
does not own an outer margin by default. Existing text and heading variables
resolve through these content roles, so their computed 5.4 values remain
unchanged.

## Selectors

Native H1-H6, `.sf-h-*`, Display selectors, `.label-*` and
`.body-text-small|medium|large` resolve through their semantic role variables.
The existing `.text*` selectors remain aliases for Body Text. A numeric
`.text-N` utility can opt into title line height with `.heading`.
`utility/headers` remains a compatible entrypoint but consumes the same
Heading role variables as Core; it has no separate size or line-height table.

## Fonts and compatibility

Core ships Inter Variable (fontsource 5.3.0, OFL-1.1) as the default source for
`--sf-text--family`, `--sf-heading--family` and `--sf-display--family`. The
files live in `src/core/fonts/inter/`, one per script, and `core.css` declares
them with `unicode-range`, so a page fetches only the scripts its text uses —
Latin and Cyrillic come to about 67 KB. The contract does not load Google Fonts
or another remote font service. The licence travels in the third-party notices.

Before Inter is available, Framework uses a local `Inter Fallback` face: Arial
with metric overrides. It keeps the natural font-driven geometry of controls
and text while preventing the webfont swap from moving the header, navigation,
or page columns. Inter uses `font-display: optional`: a cold page keeps the
metric fallback for that document instead of swapping late, while cached
visits use Inter immediately. Projects do not need to preload the font or
reserve fixed heights, and custom font-family overrides continue to work as
before. The stack ends in the system fonts for an environment without Arial.

First-party typography does not declare a literal `13px`. Historical vendor
sources outside active Framework build roots are not part of this contract.
The correct public spelling is `--sf-body-text--family`; the color token is
`--sf-tertiary` (not `tertiaty`).

## Verification

Run:

```sh
npm test
npm run test:adaptive-sizing
node scripts/generate-adaptive-sizing-contract.mjs --check
UI_DOC_ROOT=/absolute/path/to/ui-doc npm run test:public-docs
```

Public token or behavior changes are incomplete until their generated
documentation projection and the corresponding `ui-doc` guide pass the
cross-repository check. See
`docs/developer/public-contract-documentation-gate.md`.

Core-only and Core plus Utility must yield the same computed H1-H6 and Display
matrix at mobile and desktop breakpoints. Overriding a semantic role must alter
the matching first-party selector; overriding a historical token must continue
to alter a legacy consumer.
