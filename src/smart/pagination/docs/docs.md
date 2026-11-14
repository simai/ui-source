# sf-pagination

`sf-pagination` is page navigation for a collection split into pages
(decision C97). The host owns data loading and reacts to
`sf-pagination-change`; the component owns only presentation, bounded page
state and user interaction. The visible root is a named `nav` that holds the
way between pages and nothing else.

## Appearances

`appearance` picks the look for the scenario:

| appearance | Looks like | Where |
|---|---|---|
| `field` (default) | `⇤ ‹ [3] из 12 › ⇥` | a dense table (Larena, SIMAI Pro, sf-view) |
| `numbers` | `‹ 1 … 4 [5] 6 … 12 ›` | a site, a catalogue, search results |
| `arrows` | `‹ Назад · Страница 3 · Далее ›` | the count is not known or only estimated |
| `cursor` | `В начало · Дальше ›` | a cursor list: no number, never a last page |
| `more` | `Показать ещё 20` / `Показано 40 из 240` | a feed, a picker in a window |

- **field**: the field is as wide as the longest page number there is and
  says «из 12» after itself (an estimate «из ~23», no count nothing). Enter
  goes to the typed page; a number outside the range is brought back to it.
- **numbers**: up to seven places, five below the sm step (32rem): the first
  and the last page always, a gap («…», not a control) where pages are left
  out; every place as wide as the widest number. The current page says
  `aria-current="page"`. With `href` every number is a link, so a
  server-printed list pages without the script. Without an exact count the
  row reaches the page `has-next` promises and ends in a gap.
- **arrows**: «Назад» and «Далее» with the page between them as a polite
  status. No last page and no number to type.
- **cursor**: «В начало» (page 1) and «Дальше» (the next portion, while
  `has-next`). There is no last page: a cursor list never knows one (Larena).
- **more**: «Показать ещё 20» adds a portion (`sf-pagination-load-more`);
  `current` is the number of portions shown. Under it «Показано 40 из 240»
  and a thin bar. When everything is shown the button goes and the line
  stays. Never in one row with the arrows.

In every appearance a control at an end is **disabled, not removed**, so the
row keeps its width while a person pages.

```html
<!-- A dense admin table -->
<sf-pagination appearance="field" size="1/2" current="3" total="240" page-size="20"></sf-pagination>

<!-- A news list printed by the server: links ?page=N, rel prev/next -->
<sf-pagination appearance="numbers" href="?page={page}" page-in-title
  current="5" total="120" page-size="10"></sf-pagination>

<!-- A cursor list -->
<sf-pagination appearance="cursor" count-known="false" has-next current="2"></sf-pagination>
```

## The footer of a list

The range «41–60 из 240» and the page size «По 20 ▾» are not navigation:
they belong to the list that shows them. A list composes them beside an
`sf-pagination` of its own appearance, from existing parts, in one row:

```html
<div class="flex items-cross-center">
  <span role="status">41–60 из 240</span>
  <sf-button size="1/2" appearance="ghost" scheme="on-surface" icon-end="arrow_drop_down"
    text="По 20" aria-haspopup="menu" aria-label="На странице: 20"></sf-button>
  <sf-menu-context popup size="1/2" aria-label="На странице:"></sf-menu-context>
  <sf-pagination appearance="field" size="1/2" current="3" total="240" page-size="20"></sf-pagination>
</div>
```

The button opens the menu with radio rows (`entries: [{id: '20', text: 'По
20', kind: 'radio', checked: true}, …]`, `menu.toggleFor(button, {align:
'end'})`), and `sf-menu-context-select` gives the size. The band of bulk
controls for marked rows is `sf-view`'s.

### Compatible footer (until 2027-01-01)

An `sf-pagination` written **without** `appearance` draws the footer it drew
before 1.5.0, in the look of C97: the range «41–60 из 240» (in place of
«Всего: 240»; «из ~450» and «из многих» with «посчитать» when the host can
count), the quiet «По 20 ▾» button with its menu (in place of the labelled
select), the field «из 12» last, Show more on a line of its own above the
row (`top`), and the band below (`bottom`, `actions`, …). Each part it keeps
is noted once in `SF.deprecations` (change journal
`value-pagination-footer-parts-to-view`, `value-pagination-show-more-to-more`,
`setting-pagination-band-to-view`, `attribute-pagination-footer-labels`).
An author's own `total-label` still draws «Всего: 240», an author's own
`pages-label` its label. `sf-view` uses this footer until it composes its
own.

## Data and labels

`total` is the number of collection items, not the page count. `page-size`
determines `pageCount`, while `current` is clamped to that range. A zero
`total` renders no page action. Without a count (`count-known="false"`) the
host says `has-next`; an estimate (`total-exact="false"`) reads «~N».

Every word can be localized with its attribute or registered under the same
key: `SF.language.register('sf-pagination', 'de', {range: '{from}–{to} von
{total}'})`. The words of 1.5.0: `of-pages`, `range`, `range-many`,
`page-size-text`, `previous-text`, `next-text`, `cursor-next-text`,
`show-more-count`, `shown`. The camelCase keys of the words before standard
1.3.8 (`totalLabel`, …) are read until 2026-12-01, each noted once in
`SF.deprecations` (change journal `option-pagination-word-keys-camel-to-kebab`).

## Adaptation

The default template applies `root-class`, author `style` and `root-style` to
the visible `nav`. Use Framework utilities and semantic tokens; page controls
use the UI radius. Directional icons mirror in RTL; numeric order does not.
The compatible footer wraps rather than stacks: on a narrow screen the range
and «По 20 ▾» share the first line and the field ends the next one.

The last-page button is drawn only where the jump can be answered: the count
is exact, or the host can count (`can-count`).

## Links, address and title

Three settings, all off by default (1.4.0):

- `href="?page={page}"` — the arrows and the numbers are links to their
  pages (`{page}` is the number, `{page-size}` the page size), previous and
  next with `rel="prev"` / `rel="next"`; a page typed in the field is opened
  by its address. A press is still reported as `sf-pagination-change`,
  cancelable for a link: a listener that loads the rows itself calls
  `preventDefault()` and the link is not followed. A followed link opens
  the page its address showed (1.5.1). A press with a modifier
  (new tab) is the browser's alone. At an end a link keeps its place with
  no address (`aria-disabled`).
- `page-param="page"` — the page lives in the address's query: it is read
  when the element is placed and on Back / Forward (and reported as
  `sf-pagination-change`, so the host loads it), and a move writes it as a new
  history entry. Page 1 is the address without the parameter.
- `page-in-title` — the page joins the document title («Новости — Страница
  3»); page 1 and a removed element give the title back.

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
  page (the compatible footer's page-size part; deprecated with it);
- without a count, `lastPage()` and «for all» ask for it with
  `sf-pagination-count {reason, current, page-size}`;
- `setAction(action)`, `setActionForAll(value)` and `applyAction()` support the
  compatible optional batch-action region (deprecated until 2027-01-01: the
  band is sf-view's): `sf-pagination-action-change`,
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
colors. Disabled actions are not operable, the gap of numbers is not
focusable, and reduced-motion removes state transitions.
