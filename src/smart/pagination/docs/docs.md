# sf-pagination

`sf-pagination` navigates a collection split into numbered pages. The host owns
data loading and reacts to `sf-pagination-change`; the component owns only presentation,
bounded page state and user interaction.

The visible root is a named `nav`. Page actions are native buttons because the
Smart component does not invent URLs. A server-rendered ordinary pagination may
use links instead. The current page exposes `aria-current="page"`; omitted pages
are represented by a non-interactive ellipsis.

## Core example

```html
<sf-pagination
  aria-label="Страницы результатов поиска"
  current="4"
  total="96"
  page-size="10"
  selected-count="2"
  top="false"
  bottom="false"
></sf-pagination>
```

The standard numbered mode should not be combined with `show more` unless the
product intentionally offers both strategies. The existing `top`, `middle` and
`bottom` switches remain compatible:

- `top` contains the optional show-more action;
- `middle` contains summary, numbered navigation and optional page-size control;
- `bottom` contains the legacy optional batch-action composition and renders
  only when `actions` is non-empty.

`show more` and numbered pagination are alternative data-navigation patterns.
Batch actions belong conceptually to a selection toolbar; they remain here only
for compatibility and must not own authorization or backend effects.

## Data and labels

`total` is the number of collection items, not the page count. `page-size`
determines `pageCount`, while `current` is clamped to that range. A zero `total`
renders no numbered page action. `selected-count` is clamped between zero and
`total`, so the summary never repeats stale hardcoded values.

Every reader-facing label can be localized with the short source attributes:
`aria-label`, `pages-label`, `page-label`, `previous-label`, `next-label`,
`last-label`, `total-label`, `selected-label`, `page-size-label`,
`show-more-text`, `actions-label`, `action-apply-text` and
`action-for-all-label`.

A product that adds a language registers the words under the same keys, the
attributes' names: `SF.language.register('sf-pagination', 'de', {'total-label':
'Gesamt:'})`. The camelCase keys of the words before standard 1.3.8
(`totalLabel`, `pageSizeLabel`, …) are read until 2026-12-01, each noted once in
`SF.deprecations` (change journal
`option-pagination-word-keys-camel-to-kebab`).

## Adaptation

The default template applies `root-class`, author `style` and `root-style` to
the visible `nav`. `top-class`, `main-class` and `bottom-class` extend only their
named regions. Use Framework utilities and semantic tokens; page controls use
the UI radius, while `sf-page-number--circle` is an explicit shape override.

Page controls stay on one line. On narrow viewports a long range keeps the
current page, adjacent pages and directional actions; secondary labels, edge
pages and ellipsis indicators yield space. Directional icons mirror in RTL;
numeric order does not.

## Runtime API

- `goToPage(page)` (the action `go-to-page`) and `lastPage()` update bounded
  local state and emit `sf-pagination-change {previous, current, total,
  page-count, page-size}` only when the page changes; `goToPage` answers
  `{outcome: 'applied'}` or `{outcome: 'refused', reason}` (`empty`,
  `invalid`, `current`). Writing `current` or `page-size` as a setting sends
  nothing;
- `showMore()` (the action `show-more`) emits `sf-pagination-load-more
  {direction: 'after', current, total, page-size, page-count, has-next}` and
  performs no network request;
- `setPageSize(size)` emits `sf-pagination-size-change` and clamps the current
  page;
- without a count, `lastPage()` and «for all» ask for it with
  `sf-pagination-count {reason, current, page-size}`;
- `setAction(action)`, `setActionForAll(value)` and `applyAction()` support the
  compatible optional batch-action region: `sf-pagination-action-change`,
  `sf-pagination-action-for-all-change`, `sf-pagination-apply {action, scope:
  selection | filter, …}`; the panel's cross sends
  `sf-pagination-selection-clear`;
- `onPageChange(handler)` and `onShowMore(handler)` register convenience
  listeners; their detail also carries the old camelCase names.

Every detail is data only. The old names -- `sf-page-change`,
`sf-page-size-change`, `sf-count-request`, `sf-show-more`, `sf-selection-clear`,
`sf-action-change`, `sf-action-for-all-change`, `sf-action-apply` -- follow
each new one until 2026-12-01 with their old detail (`component`, `tagName`,
`template` and the camelCase fields), each use noted in `SF.deprecations` with
its dates.

Public variables: `--sf-pagination-background-color`, `--sf-pagination-color`,
`--sf-pagination-gap`, `--sf-pagination-divider-color`,
`--sf-pagination-page-background-color`, `--sf-pagination-page-color`,
`--sf-pagination-page-radius`, `--sf-pagination-current-background-color`,
`--sf-pagination-current-color`.

## The row's box

So that a page can hold the room of a list and its pages before they draw (no
shift when they arrive), the pagination publishes the height of its page row
on `:root`, from the same tokens it draws the row with. One value per step of
the size ladder (`size="1/2"` and `size="1"`; in CSS the slash is escaped:
`1\/2`):

| Variable | What it is | 1/2 | 1 |
|---|---|---|---|
| `--sf-pagination-block-size-<step>` | the page row on one line | 65px | 73px |

The row is the control height of its step, the row's padding above and below
it and the line under it:
`2 × --sf-space-1 + --sf-ui-<step>--control-height + 1px`. The row is never
shorter (a row of text alone, a count and no pages, is as tall as one with
the arrows). The numbers are those of the default theme on a wide screen
(`--sf-space-1` is 16px there and smaller on a phone); a page reads the
variables, not the numbers. A row that wraps in a narrow column, and the
band of bulk actions while rows are marked, add to it.

A data view of 20 rows of a table and its pages under it:

```css
.list-room {
  min-block-size: calc(var(--sf-table-toolbar-block-size-1\/2) + var(--sf-table-toolbar-gap)
    + var(--sf-table-head-block-size-1\/2) + 20 * var(--sf-table-row-block-size-1\/2)
    + var(--sf-data-view-gap, var(--sf-space-3)) + var(--sf-pagination-block-size-1\/2));
}
```

These two are outputs a page reads, not a look it sets; the look variables
are the nine above.

Focus is shown with the shared `:focus-visible` treatment, including forced
colors. Disabled actions are not operable, ellipses are not focusable, and
reduced-motion removes state transitions.
