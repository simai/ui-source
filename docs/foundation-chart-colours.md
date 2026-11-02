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
| `--sf-chart-1` | primary-50 `#0073ed` | primary-60 `#488fff` | the brand (the primary graphic tone) |
| `--sf-chart-2` | tone-rose-50 `#b85871` | tone-rose-60 `#d7718b` | rose |
| `--sf-chart-3` | tone-green-30 `#00531f` | tone-green-85 `#95e79d` | green |
| `--sf-chart-4` | tone-violet-30 `#682e76` | tone-violet-85 `#f9c2ff` | violet |
| `--sf-chart-5` | tone-lime-50 `#7d7b00` | tone-lime-60 `#979523` | lime |
| `--sf-chart-6` | tone-teal-50 `#00857e` | tone-teal-60 `#00a299` | teal |
| `--sf-chart-7` | tone-amber-30 `#693c00` | tone-amber-60 `#cb8024` | amber |
| `--sf-chart-8` | tone-sky-30 `#004b72` | tone-sky-85 `#afd9ff` | sky |

- **Series 1 is the brand.** A chart of one series is drawn in the primary
  graphic tone (`--sf-on-primary-container-graphic`) and moves with a theme's
  colour. The other seven are the fixed hues of the initials (`sf-avatar`
  tones, HCT chroma 48), which keep their names under every theme; indigo is
  left out as the primary's neighbour. A theme whose primary lands near one
  of them should override that role.
- **Contrast.** Every series holds 3:1 on `--sf-surface-0`, `-1` and `-2` in
  both themes (WCAG 1.4.11): at least 3.94:1 light and 4.78:1 dark.
- **Colour-vision deficiency.** Series 1 to 5 stay apart under protanopia,
  deuteranopia and tritanopia (Machado 2009, severity 1.0; CIEDE2000, at
  least 15): light 18.1, 18.5, 20.5; dark 18.1, 18.3, 19.7. They do it by
  lightness as well as hue, which is why the steps differ from series to
  series. Use at most five series where colour is the only key; beyond five,
  add a direct label, a marker shape or a dash.
- **Order.** Each series is at least 25 (CIEDE2000) from the one before it --
  31.6 light, 32.3 dark at the closest -- and no two of the eight are closer
  than 18.9.
- **Status is not a series.** A rose or a green series says nothing good or
  bad; data with a good and a bad side takes the status roles
  (`--sf-on-success-container-graphic` and the rest).

## Area fills

Each series has three fills on the fill family of the alpha scale, laid on
tone 50 of its hue, as the families' containers are:

| Role | Light | Dark |
| --- | --- | --- |
| `--sf-chart-N-fill` | 12 % | 24 % |
| `--sf-chart-N-fill-hover` | 16 % | 28 % |
| `--sf-chart-N-fill-active` | 20 % | 32 % |

So `--sf-chart-1-fill` is primary-50 at 12 % in the light theme and 24 % in
the dark. A fill is not held to 3:1: the line of its series draws the edge.

## Diverging midpoint

`--sf-chart-midpoint` is the middle of a diverging scale -- `error` to
`success` for data with a good and a bad side, `primary` to `tertiary` for
data without -- where the value is neither: neutral-90 `#e3e2e7` light,
neutral-20 `#2f3035` dark. It stands off surfaces 0 to 2 (1.14:1 and 1.15:1
at the closest) so a cell at the midpoint still reads as a cell, and both
ends grow out of it: the 40 steps are 4.99:1 or more from it in the light
theme, the 80 steps 7.7:1 or more in the dark. Cells between the midpoint and
an end may fall under 3:1, so a diverging chart carries a scale legend and
its table.

```css
.series-1 { stroke: var(--sf-chart-1); fill: var(--sf-chart-1-fill); }
.series-1:hover { fill: var(--sf-chart-1-fill-hover); }
```
