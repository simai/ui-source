# Layers

Part of the SIMAI Framework foundations standard (owner decision C181 (4);
index: [foundation-standard.md](foundation-standard.md)). Every rule names
the owner decision that set it. The numbers are what the built sheets hold;
`tests/foundation-layers-c181.contract.test.mjs` resolves every row of the
Numbers table against them and checks that the five layers of the Pending
table keep their order on today's steps.

## Rules

1. What stands over what is one of five layers, in this order: base (the
   page), sticky (parts that stay while the page scrolls), popover (a panel
   dropping from its trigger), window (what covers the page), message (a
   tooltip, a value bubble, a notification). A component takes the layer of its
   role, not a number; the numbered steps stay as aliases until 2027-01-01
   (C181, C173).
2. Windows, drawers, surfaces and the notification area share one stack above
   the page: base `--sf-z-index-layer` plus their place times
   `--sf-z-index-layer-step`, in the order they opened
   (`src/core/js/layer-stack.js`, standard simai.smart-component 1.3.8 §19.1).
   Page content stays under the base (C181).
3. `sf-popover` stands in the browser's top layer, so no z-index of the page
   reaches over it; under a window it takes a step down (C59).

## Numbers

The same on every width and density. Plain numbers (z-index).

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| C181 | `--sf-z-index--1` | | -1 | -1 | -1 |
| C181 | `--sf-z-index-0` | | 0 | 0 | 0 |
| C181 | `--sf-z-index-1` | | 10 | 10 | 10 |
| C181 | `--sf-z-index-5` | | 50 | 50 | 50 |
| C181 | `--sf-z-index-9` | | 90 | 90 | 90 |
| C181 | `--sf-z-index-layer` | | 9000 | 9000 | 9000 |
| C181 | `--sf-z-index-layer-step` | | 2 | 2 | 2 |

## Pending

On `fix/role-layers-c173` (e035f88b4), not in a released pair: the five
layers as role tokens (names: the dispatcher's; C181 (3) gives the order in
words). Each points at a step that exists today; the test checks the order
below on the released steps.

| Layer | Token on the branch | Step |
| --- | --- | --- |
| base | `--sf-layer--base` | `--sf-z-index-0` |
| sticky | `--sf-layer--sticky` | `--sf-z-index-5` |
| popover | `--sf-layer--popover` | `--sf-z-index-9` |
| window | `--sf-layer--window` | `--sf-z-index-layer` |
| message | `--sf-layer--message` | `--sf-z-index-layer` |

The branch also moves the components that still write their own numbers
(country code 9, dropdown 10, `sf-popover` 3, editor utility 100, range-slider
bubble 3, loader 1000) onto these layers, and a raw-value lint
(`tools/lint-raw-values.mjs`, C178) keeps new numbers out. A part that stands
over its own siblings inside a component (-1 to 2) is not a layer and keeps a
local number.

## Known gaps

- Window and message are both 9000: the scale has no step above the stack's
  base, so «message over window» holds only through the stack's opening order,
  not through the number. Open question on the branch.
- On the released pair components still take numbered steps or raw numbers;
  the list above is what the branch moves.

## Check

- `tests/foundation-layers-c181.contract.test.mjs`: the Numbers table against
  the built sheets, the five layers' order on today's steps, every rule names
  its decision.
- `tests/layer-stack.contract.test.mjs`: one document layer stack, loaded as
  two bundles (rule 2).
- `tests/popover-top-layer.contract.test.mjs`: `sf-popover` in the top layer
  (C59).
- `tests/core-layer-order.contract.test.mjs`: the cascade layer order of the
  core sheets (CSS `@layer`, not stacking).
