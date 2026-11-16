# SIMAI Framework foundations standard

One standard for the system decisions every component stands on (owner
decision C181 (4), 2026-11-14). Each theme is one page `docs/foundation-*.md`
in English; every rule on it names the owner decision that set it (`C##`,
recorded in ui-control `control/docs-review/decisions.md` and mapped in
`control/standards/rule-map.json`). The Russian version for readers is the
ui-doc guide (`content/ru/guide/`); it is written there, not generated from
these pages.

## Themes

| Theme | Page | Check in the pair build |
| --- | --- | --- |
| Sizes and the size ladder | [foundation-size-ladder.md](foundation-size-ladder.md) | `tests/foundation-size-ladder-c181.contract.test.mjs` |
| Icons | [foundation-icons.md](foundation-icons.md) | `tests/foundation-icons-c181.contract.test.mjs` |
| Spacing roles H1-H6 | [foundation-spacing-roles.md](foundation-spacing-roles.md) | `tests/foundation-spacing-roles-c181.contract.test.mjs` |
| Layers | [foundation-layers.md](foundation-layers.md) | `tests/foundation-layers-c181.contract.test.mjs` |
| Breakpoints and container steps | [foundation-container-steps.md](foundation-container-steps.md) | `tests/foundation-container-steps-c181.contract.test.mjs` |

Not written yet, from the list in C181 (4): colours, focus, motion and names.
Their rules live in the decisions and in the older pages below until they get
a page of their own.

## How a theme page is built

- `## Rules`: numbered, plain, each with its decision id.
- `## Numbers`: a table `Rule | Token | On | normal | compact | phone`.
  `Token` is a custom property, or a `calc()` over them; `On` names the
  element's classes when a component sets the token. `normal` is a desktop
  page (1440 px), `compact` a `data-sf-density="compact"` region on it,
  `phone` a 390 px page; px at a 16 px root, plain numbers where the token is
  a number; `—` where the token does not exist at that width.
- `## Pending`: what a branch carries that no released pair has yet, with the
  branch and its commit.
- `## Known gaps`: where the code and a decision disagree today. A gap is
  listed, not fixed, on the page; the fix goes through the component's own
  work.
- `## Check`: the tests that hold the theme.

The theme's contract test resolves every Numbers row against the built
sheets (`UI_CORE_ROOT`, which the pair build sets), with a small cascade in
`tests/support/foundation-tokens.mjs`: `@layer` order, `@media` widths,
specificity and inheritance of custom properties. A changed token fails the
test until the page says the new number, and a changed page fails until the
token does.

## Older foundation pages

These came before the standard and stay as the detailed references the theme
pages link to: [foundation-composition-geometry.md](foundation-composition-geometry.md)
(ladder parts, padding, axes, rows, the six roles in detail),
[foundation-control-spacing.md](foundation-control-spacing.md) (density),
[foundation-container-width.md](foundation-container-width.md),
[foundation-layout-tokens.md](foundation-layout-tokens.md),
[foundation-radius-nesting.md](foundation-radius-nesting.md),
[foundation-chart-colours.md](foundation-chart-colours.md),
[foundation-backgrounds.md](foundation-backgrounds.md),
[foundation-paper-and-well.md](foundation-paper-and-well.md),
[foundation-touch-fields.md](foundation-touch-fields.md),
[foundation-logical-sides.md](foundation-logical-sides.md),
[foundation-modern-utilities.md](foundation-modern-utilities.md).
`foundation-control-spacing.md` is still in Russian.
