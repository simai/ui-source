# sf-pagination

`sf-pagination` navigates a collection split into numbered pages. The host owns
data loading and reacts to `sf-page-change`; the component owns only presentation,
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

- `goToPage(page)` and `lastPage()` update bounded local state and emit
  `sf-page-change` only when the page changes;
- `showMore(item)` emits `sf-show-more` and performs no network request;
- `setPageSize(size)` emits `sf-page-size-change` and clamps the current page;
- `setAction(action)`, `setActionForAll(value)` and `applyAction()` support the
  compatible optional batch-action region;
- `onPageChange(handler)` and `onShowMore(handler)` register convenience
  listeners.

Focus is shown with the shared `:focus-visible` treatment, including forced
colors. Disabled actions are not operable, ellipses are not focusable, and
reduced-motion removes state transitions.
