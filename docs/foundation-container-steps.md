# Breakpoints and container steps

Part of the SIMAI Framework foundations standard (owner decision C181 (4);
index: [foundation-standard.md](foundation-standard.md)). Every rule names
the owner decision that set it. The numbers are what the built sheets hold;
`tests/foundation-container-steps-c181.contract.test.mjs` resolves every row
of the Numbers table against them, compares it with the Sass breakpoint array,
and checks that every step of the Pending ladder is a step of the size scale.

## Rules

1. One width switches the ladder: below 60rem (`lg`) the phone ladder, from
   60rem the desktop ladder, normal or compact. Nothing switches the ladder at
   a width of its own (C22, C01).
2. Screen breakpoints are steps of the size scale, in rem: `sm` 32, `md` 44,
   `lg` 60, `xl` 72, `xxl` 80. `--sf-breakpoint-*` names the same steps; each
   is declared from its own width up (C181, C18).
3. A component adapts to the width of its own place (a container query), not to
   the screen; screen media queries are for the page frame only (C181).
4. The `cq-*` utilities (`cq-sm:` ... `cq-xl:`, `cq-<bp>/sidebar:`) use the
   same breakpoints as container conditions, so a page has one ladder of
   widths for both (C181).

The container classes (`container`, `max-container-*`, `container-breakout`)
are described in [foundation-container-width.md](foundation-container-width.md),
the layout sizes in [foundation-layout-tokens.md](foundation-layout-tokens.md).

## Numbers

`normal` is a desktop page (1440 px wide), `phone` a 390 px page. A
breakpoint variable exists only from its own width up, so a phone has none
of them.

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C181 | `--sf-breakpoint-sm` | | 512 | 512 | — |
| C181 | `--sf-breakpoint-md` | | 704 | 704 | — |
| C181 C22 | `--sf-breakpoint-lg` | | 960 | 960 | — |
| C181 | `--sf-breakpoint-xl` | | 1152 | 1152 | — |
| C181 | `--sf-breakpoint-xxl` | | 1280 | 1280 | — |

## Pending

On `fix/foundations-c181` (64ee9b259), not in a released pair:

- C181 (2): one ladder of container steps for components, read from the size
  scale: the component steps below plus the screen breakpoints `sm`, `md`,
  `lg`, `xl`. A sheet writes `container-step(<step>)`; a lint
  (`tests/container-ladder-c181.contract.test.mjs` on that branch) fails on a
  container condition of its own length and on a component's screen query
  outside a listed few (page frame and a dialog on a narrow screen). It moves
  three breaks a little wider: the date picker's presets (28 → 30rem), a failed
  file row (22.5 → 24rem) and `sf-alert-bar` (38 → 40rem).
- C181 (1): `grid-col-fit` lays out as many columns as fit, none narrower than
  12rem (`grid-col-fit-<step>` for 10, 16, 20, 24 or 32rem), beside the
  fixed-count `grid-col-1..12`; no screen variants
  (`tests/grid-fit-c181.contract.test.mjs` on that branch). The class name is
  still to be confirmed.

The component steps, each a step of the size scale:

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C181 | `--sf-g0` | | 320 | 320 | 320 |
| C181 | `--sf-g2` | | 384 | 384 | 384 |
| C181 C28 | `--sf-g5` | | 480 | 480 | 480 |
| C181 C115 | `--sf-g8` | | 576 | 576 | 576 |
| C181 | `--sf-h0` | | 640 | 640 | 640 |
| C181 C115 | `--sf-h2` | | 768 | 768 | 768 |
| C181 | `--sf-f2` | | 192 | 192 | 192 |

(20 · 24 · 30 · 36 · 40 · 48rem; `--sf-f2`, 12rem, is the fluid grid's least
column. 30rem is the choice tiles' step from C28, 36 and 48rem the notice
actions' from C115.)

## Known gaps

- On the released pair, components still write 17 container conditions as
  literal lengths (alerts, toast, the composition regions, change,
  list-description, input-choice, input-image, list-attention, wizard,
  datepicker, file-preview, alert-bar);
  the branch above moves all of them.
- Several components still query the screen (header-site, alert-bar's site
  column, contents, modal, confirm, reference-link, admin-menu,
  download-file, pagination, pager, progress-run, search). The branch keeps
  the page-frame ones on a listed exception; the rest need an inner element as
  their container before they can move.

## Check

- `tests/foundation-container-steps-c181.contract.test.mjs`: the Numbers
  tables against the built sheets and the Sass breakpoint array, every rule
  names its decision.
- `tests/breakpoint-ladder.contract.test.mjs`: every breakpoint is a ladder
  step and its variable names the same step; no media query at a retired
  pixel width (rule 2).
- `tests/ladder-one-breakpoint.contract.test.mjs`: one width switches the
  ladder (rule 1).
- `tests/container-conditions.contract.test.mjs`: the container profile of the
  `cq-*` utilities (rule 4).
