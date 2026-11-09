# Chart colours

The colour roles of a chart, ordered by SIMAI Chart (simai/ui-chart, D4 and
`docs/research/parameters.md` 8.3-8.4). Declared in
`src/core/scss/_sf_css__theme.scss` with the other roles; the numbers below
are computed by `tests/chart-colours.contract.test.mjs`, which fails when a
retuned primitive breaks one of them.

## Series

One role per series, in order. Colour belongs to the category, not to the
position: a chart keeps a series' role when others are hidden or reordered.

| Role | Light | Dark | Hue |
| --- | --- | --- | --- |
| `--sf-chart-1` | blue-50 `#3375d9` | blue-60 `#538ff5` | blue |
| `--sf-chart-2` | amber-50 `#b26300` | amber-60 `#d87900` | amber |
| `--sf-chart-3` | teal-30 `#005140` | teal-85 `#20efc3` | teal |
| `--sf-chart-4` | violet-30 `#5a2a9d` | violet-85 `#e1cbff` | violet |
| `--sf-chart-5` | yellow-30 `#594400` | yellow-85 `#ffce41` | yellow |
| `--sf-chart-6` | pink-50 `#be4e8f` | pink-60 `#dd68a9` | pink |
| `--sf-chart-7` | green-50 `#198a27` | green-60 `#3ba53f` | green |
| `--sf-chart-8` | red-30 `#93000a` | red-85 `#ffc7c0` | red |
| `--sf-chart-brand` | primary-50 | primary-60 | the theme colour |

- **The order is fixed** (owner decision C17, 2026-11-08): eight hues of the
  static palette, the same under every theme colour, so a legend means the
  same on every site and no series becomes the brand colour's twin (the
  former series 1 was the primary, and under a green or a violet theme it
  stood a few degrees from another series).
- **One series is the brand.** A chart of one series takes `--sf-chart-brand`
  (the primary graphic tone, `--sf-on-primary-container-graphic`), which moves
  with a theme's colour.
- **Contrast.** Every series holds 3:1 on `--sf-surface-0`, `-1` and `-2` in
  both themes (WCAG 1.4.11): at least 3.94:1 light and 4.77:1 dark.
- **Colour-vision deficiency.** Series 1 to 5 stay apart under protanopia,
  deuteranopia and tritanopia (Machado 2009, severity 1.0; CIEDE2000, at
  least 15): light 15.0, 15.6, 18.4; dark 18.9, 17.2, 17.0. They do it by
  lightness as well as hue -- the order alternates tones 50/60 with 30/85 --
  which is why the steps differ from series to series. Use at most five
  series where colour is the only key; beyond five, add a direct label, a
  marker shape or a dash.
- **Order.** Each series is at least 25 (CIEDE2000) from the one before it --
  38.7 light, 40.1 dark at the closest -- and no two of the eight are closer
  than 21.2.
- **Status is not a series.** A red or a green series says nothing good or
  bad; data with a good and a bad side takes a diverging scale.

## Area fills

Each series has three fills on the fill family of the alpha scale, laid on
tone 50 of its hue, as the families' containers are:

| Role | Light | Dark |
| --- | --- | --- |
| `--sf-chart-N-fill` | 12 % | 24 % |
| `--sf-chart-N-fill-hover` | 16 % | 28 % |
| `--sf-chart-N-fill-active` | 20 % | 32 % |

So `--sf-chart-1-fill` is blue-50 at 12 % in the light theme and 24 % in
the dark; `--sf-chart-brand-fill` (with `-hover` and `-active`) is the same on
primary-50. A fill is not held to 3:1: the line of its series draws the edge.

## Warm and cool series

Two series sets of close hues, for a chart whose series belong together (C17,
dispatcher 2026-11-09). The hue orders are the palette research's; the steps
were picked by exhaustive search over the pairs 50/60, 30/85, 40/80 and 40/70
for the best worst case of the limits above, with 3:1 on surfaces 0 to 2 kept.

| Role | Warm | Cool |
| --- | --- | --- |
| `--sf-chart-warm-1` / `--sf-chart-cool-1` | red 30/85 | blue 30/85 |
| `-2` | orange 50/60 | teal 30/85 |
| `-3` | amber 40/80 | violet 50/60 |
| `-4` | pink 50/60 | cyan 50/60 |
| `-5` | brown 50/60 | indigo 40/70 |
| `-6` | yellow 50/60 | green 50/60 |

Six close hues cannot meet the distances of the eight series: series 1 to 5
under colour-vision deficiency are 6.9 apart (warm) and 7.2 light / 7.6 dark
(cool), against 15 for `--sf-chart-1`..`-8`; neighbours 12.5 / 18.2 (warm) and
31.3 / 30.5 (cool); any two 10.3 (warm) and 11.5 / 12.4 (cool). The test holds
these as floors. Where the series must be told apart, use `--sf-chart-1`..`-8`
or add a direct label.

## Diverging ends

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `--sf-chart-diverging-bad` | red-30 | red-80 | the bad side |
| `--sf-chart-diverging-good` | blue-30 | blue-80 | the good side |
| `--sf-chart-diverging-low` | purple-30 | purple-80 | low end, no meaning |
| `--sf-chart-diverging-high` | teal-30 | teal-80 | high end, no meaning |

Good and bad are blue and red, not success and error: red and green fall
together under protanopia and deuteranopia (8.8 and 6.9). Distances, normal /
protan / deutan / tritan: red-blue 42 / 45 / 52 / 55 light, 32 / 28 / 35 / 46
dark; purple-teal 39 / 31 / 23 / 41 light, 48 / 33 / 22 / 59 dark. A ladder
from an end to the midpoint reads the hue's own tones, `--sf-<hue>-<tone>`.

## Diverging midpoint

`--sf-chart-midpoint` is the middle of a diverging scale -- red to blue for
data with a good and a bad side, purple to teal for data without (C17) --
where the value is neither: neutral-90 `#e3e2e7` light,
neutral-20 `#2f3035` dark. It stands off surfaces 0 to 2 (1.14:1 and 1.15:1
at the closest) so a cell at the midpoint still reads as a cell, and both
ends grow out of it: the 40 steps of red, blue, purple, teal and the theme's
primary and tertiary are 4.99:1 or more from it in the light theme, the 80
steps 7.72:1 or more in the dark. Cells between the midpoint and
an end may fall under 3:1, so a diverging chart carries a scale legend and
its table.

```css
.series-1 { stroke: var(--sf-chart-1); fill: var(--sf-chart-1-fill); }
.series-1:hover { fill: var(--sf-chart-1-fill-hover); }
```
