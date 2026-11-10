# Attention List Smart Component

`sf-list-attention` lists the problems that need a person on an overview
screen: server health, site checks, import and migration errors, update
readiness, storage integrity, a form's validation summary. A card with a
heading and a badge per severity, then each problem with a filled status
icon, its title, what · how long · where, one quiet action and a «⋯» to
snooze or dismiss it; at most five, the rest behind «Все проблемы (N)», and
when the checks ran with a recheck (owner decision C37).

```html
<sf-list-attention triage checked-at="2026-11-09T14:05:00+03:00" more-href="/checks/">
  <script type="application/json" data-sf-settings>
    {"items": [
      {"id": "down", "status": "error", "title": "Сайт не отвечает, код 502",
       "object": {"label": "zdorovie-clinic.ru", "href": "/sites/7/"},
       "since": "2026-11-09T13:53:00+03:00", "source": "Мониторинг",
       "action": {"label": "Перезапустить", "event": "restart"}},
      {"id": "cert", "status": "warning", "title": "Сертификат истекает через 6 дней",
       "object": {"label": "crm.dealer-auto.ru"}, "source": "Сертификаты",
       "action": {"label": "Продлить", "href": "/sites/12/ssl/"}}
    ]}
  </script>
</sf-list-attention>
```

The list orders, counts and draws. The host owns the problems: it checks,
sets the whole list again when one appears or ends, does the actions, and
stores what a person snoozed or dismissed.

## Settings

- `items` — `[{id, status, title, …}]`, a property or the JSON island a
  server prints. `status` is `error`, `warning`, `info` or `success`
  (`danger` reads as `error`, anything else as `info`). An item without an id
  or a title is left out. The fields of an item:
  - `object` `{label, href?}` — what the problem is about, first on the
    second line; a link with `href`;
  - `text` — a short reason, after the object;
  - `since` — when it began (an ISO date-time or milliseconds); the row says
    how long it lasts («12 мин», «5 ч», «2 дня»);
  - `source` — the section or check it comes from, last on the line;
  - `affected` — how many objects it touches («14 заказов»): the aligned
    column of group mode;
  - `help` — a link about the check: «Подробнее о проверке» in the «⋯»;
  - `dismissible: false` — keeps «Не напоминать» off this item. The
    permission itself is the host's `dismissible`: an item can take it away,
    never give it (`dismissible: true` on an item grants nothing);
  - `action` — `{label, href}` is a link, `{label, event}` a button; one
    quiet `sf-button` (outline, on-surface) whose text names the result.
- Order: error, warning, info, success; inside a status the longest-lasting
  first where `since` is given, then the host's order.
- `label` — the heading, «Требует внимания» / «Needs attention» by default;
  `heading-level` 2–6 (3) its level in the page's outline. The summary
  stands beside it: «2 ошибки», «3 предупреждения», «3 рекомендации».
- `frame` `card|none` — `card` (the default) is a surface card; `none` the
  bare list, its rows on the page's text edge (for a list inside a card).
- `triage` — a «⋯» on each row: «Отложить на день», «Отложить на неделю»,
  «Не напоминать» (only with the host's `dismissible`, and not on an item
  with `dismissible: false`). A row with `help` has the «⋯» without `triage`
  too.
- `dismissible` — this person may dismiss problems: the page's permission,
  the only thing that grants «Не напоминать».
- `checked-at` — when the checks ran: the foot says «Проверено 5 мин назад»
  (within the hour), «в 14:05» (today) or «9 ноября в 14:05», with
  «Проверить снова».
- `limit` (5) — at most this many rows; 0 shows them all. The rest are
  behind «Все проблемы (N)», a link to `more-href`, or «Показать все (N)» in
  place without it.
- `group` `none|severity` — `severity` is the full checks page: a group per
  severity («Ошибки», «Предупреждения», «Рекомендации»), open, then
  `passed` — the checks that passed, strings or `{id?, title, text?}` — as a
  closed «Пройдено». The affected counts and the actions stand in columns;
  the time of the checks moves into the head; every row is shown.
- `empty` `line|none`, `empty-text` — with no problems `line` (the default)
  draws the head and one quiet line «Всё в порядке · проверено …» with a
  recheck; `none` draws nothing.
- The density is the page's (decision C22): the list is compact under
  `data-sf-density="compact"` on it, its region or the page.
- `size` — deprecated until 2027-01-01 (change journal
  `attribute-list-attention-size-to-density`). Until then `size="1/2"` still
  draws the list compact, is noted in `SF.deprecations` and said once in the
  console (one warning: `SF.deprecations` prints it where the page asked for
  its warnings, the list otherwise); write `data-sf-density="compact"`
  instead. Removing `size="1"`: inside a compact region the list becomes
  compact; `data-sf-density="normal"` keeps it normal.

Host states: `data-status` (the most serious status shown) and `data-empty`.

## Events

- `sf-list-attention-navigate` `{id, status, href, part}` — an action link
  (`part: action`), an object link (`part: object`) or «Подробнее о
  проверке» in the «⋯» (`part: help`) was pressed; cancelable (a router
  cancels it and goes there itself).
- `sf-list-attention-apply` `{action, scope: 'entry', ids, id, status}` — an
  action button (vocabulary `apply`).
- `sf-list-attention-snooze` `{id, until}` — «Отложить на день / на
  неделю»; `until` is the ISO instant. Cancelable; not cancelled, the row is
  set aside at once and a notice (`SF.notify`) says «Отложено на день: …»
  with «Вернуть».
- `sf-list-attention-dismiss` `{id}` — «Не напоминать»; cancelable, then the
  same notice «Больше не напомним: …».
- `sf-list-attention-undo` `{id, action}` — «Вернуть» on that notice
  (`action` is `snooze` or `dismiss`): the row is back; the host forgets
  what it stored.
- `sf-list-attention-recheck` `{}` — «Проверить снова».
- `sf-list-attention-all` `{href}` — «Все проблемы (N)» (cancelable; with
  `more-href` a link). Not `more`: that is the «⋯» button's name.

## Geometry

One rung for the whole block, and the density (C22) moves every value a step
together. A row is the UI ladder's rung 3 control height: 56 on a desktop,
48 compact, 52 on a phone; title (text 1) and meta line (text 1/2) fill it
exactly, a one-line row centres in it. The status icon is `--sf-icon-size-3`
(24, 20 compact) on the title's line. The action and the «⋯» are size 1/2
controls centred on the row. The card's text edge is `--sf-space-1` in from
its border, and the head, the rows and the foot start on it.

The rows are one grid: the actions (and in group mode the affected counts)
stand in a column. In a column narrower than 480 px (30rem; 640 px in group
mode) the action goes under the text at its start, the «⋯» stays at the end
of the title's line, the affected count joins the meta line and the foot
stacks on the text edge.

## Public variables

`--sf-list-attention-background-color` (the card surface, none without a
frame), `--sf-list-attention-divider-color` (the edge and the dividers),
`--sf-list-attention-heading-color`, `--sf-list-attention-padding-inline`
(the text edge: `--sf-space-1` in a card, 0 without), `--sf-list-attention-gap`
(under the heading without a frame). The Framework never sets them.

## Accessibility

A section named by its heading; the problems are a list. Each says its
status in words before its title («Ошибка: …»), so the icon is never the
only sign. The «⋯» is a button named «Ещё: <title>» with
`aria-haspopup="menu"`; the menu is `sf-menu-context` (arrows, Enter,
Escape). When a row is snoozed or dismissed the focus moves to the next
row's «⋯» (or the previous one's, or the list), and the notice holds
«Вернуть»; undo brings the focus back to the row. Group headers are buttons
with `aria-expanded`. The empty line is a status. The list is no live region
otherwise: a host that wants a new problem read out announces it itself.

## Changes

- 1.2.0 (2026-11-10, owner decision C37) — the card: summary badges, item
  fields `object`, `since`, `source`, `affected`, `help`, `dismissible`, the
  quiet action, triage with undo, `checked-at` and recheck, `limit` and
  `more-href` (event `all`), group mode with `passed`, rows on the ladder.
  The permission to dismiss is the host's; an item can only take it away.
  `size` is deprecated: the density is the page's. Changed defaults:
  `frame="card"` and `empty="line"`; a page that relied on the bare list or
  on nothing when empty sets `frame="none"` / `empty="none"`.
- 1.0.0 (2026-11-07) — the first version, for the Larena admin screens
  (Federation bus msg-993e1e39 item 2).
