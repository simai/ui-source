# Metric Tile Smart Component

`sf-tile-metric` shows one number that matters on an admin or dashboard
screen: server load, storage used of a quota, visitors against last week,
queue depth, licence seats. A label, the value with its unit, the change
against a previous period, a limit as a meter, a status with a short hint, a
place for a chart, a skeleton while it loads, and the whole tile as one link
or button.

```html
<div class="sf-tile-metric-grid">
  <sf-tile-metric label="Подкачка" value="83" max="100" format="integer" unit="%"
    warning-at="80" error-at="95" hint="Серверу не хватает памяти"></sf-tile-metric>
  <sf-tile-metric label="Посетители" value="12480" previous="11020" format="integer"
    period-text="к прошлой неделе" href="/traffic/"></sf-tile-metric>
  <sf-tile-metric label="Диск" value="45.3" max="100" format="unit-gigabyte" openable></sf-tile-metric>
</div>
```

The tile formats, compares and draws. The host owns the number and what it
means: it sets `value` (the tile loads nothing), says whether a rise is good
(`better`), and sets the thresholds (`warning-at`, `error-at`) or the status.

## Settings

- `label` — what the number is; the tile's accessible name. Without it the
  tile is named «Показатель» / «Metric».
- `value` — the number; unset, the tile says «—». `format` writes it in the
  page language (`number`, `integer`, `decimal-<n>`, `percent` for a share
  0..1, `compact`, `currency-<CODE>`, `unit-<Intl unit>` such as
  `unit-gigabyte`); `value-text` replaces the written number when the page
  writes it itself; `unit` is a word after it for a unit Intl does not know
  («сайтов», «запросов/с»).
- `previous` or `delta` — the change: `delta` when the page has it, else
  `value − previous`. `delta-format` `percent` (the default, its share of the
  previous value), `absolute` or `both`; `period-text` says what it is against
  («к прошлой неделе»). `better` `up` (the default), `down` (load, errors, a
  queue) or `none`: the change's tone follows its meaning, not its sign, and
  its direction is also said in words for a reader.
- `max` — a limit: «45 ГБ из 100 ГБ» with a meter (`limit-text` replaces the
  words). `warning-at` and `error-at`, in per cent of `max` as on
  `sf-progress-bar`, make the meter and the tile a warning or an error by
  themselves.
- `status` `neutral|success|warning|error|info` and `hint` — the page's
  statement about the number, drawn as a status icon and a short line. With
  thresholds the tile draws the more serious of `status` and the threshold
  reached; the status drawn is the host state `data-status`.
- `href` — the whole tile is one link. `openable` — without `href`, the whole
  tile is one button that sends `sf-tile-metric-open` `{id}` (the element's
  id). Nothing interactive belongs inside a tile.
- `loading` — the value is on its way: the label stays, the value and the
  change are skeleton bars, `aria-busy` is true, `data-loading` is on the host.
- `size` `1/2|1|2` — the rung of the ladder: 1/2 for a dense row, 2 for a
  page's headline figure.

## Chart

A chart is the page's: give it as a child with `slot="chart"`, for example an
`sf-chart-sparkline` of the chart set. The tile moves that very node under
the numbers, so the page can feed it data later.

```html
<sf-tile-metric label="Запросы" value="320" format="integer" unit="в минуту">
  <sf-chart-sparkline slot="chart" label="Запросы за час"></sf-chart-sparkline>
</sf-tile-metric>
```

## A row of tiles

The class `sf-tile-metric-grid` on the tiles' parent is a grid of columns at
least `--sf-tile-metric-min-width` (14rem) wide that wraps, one column on a
phone; tiles in a row share their height.

## Geometry

One rung S: the label, the change, the limit's words and the hint are the
rung below's line; the value two rungs up (1/2: text 2, 1: text 3, 2: text
4); the status icon the hint's line; the gap between lines and icon-to-text
the rung's text-space-x; the inset the rung's space-x less the hairline. The
surface is the card's: `surface-0`, an `outline-variant` hairline, the
surface radius.

## Public variables

`--sf-tile-metric-background-color`, `--sf-tile-metric-border-color`,
`--sf-tile-metric-radius`, `--sf-tile-metric-padding`,
`--sf-tile-metric-value-color`, `--sf-tile-metric-hover-background-color`,
`--sf-tile-metric-min-width`. The Framework never sets them.

## Accessibility

A plain tile is a group named by its label and takes no focus. A link or
button tile is one Tab stop with the focus ring on its whole surface. The
limit is a `meter` with its words as `aria-valuetext`; the progress bar under
it is its picture. The change and the status say their meaning in words
beside the arrow and the icon, so colour is never the only sign.

## Changes

- 1.0.0 (2026-11-07) — the first version, for the Larena admin screens
  (Federation bus msg-993e1e39 item 1).
