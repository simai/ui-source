# Attention List Smart Component

`sf-list-attention` lists the problems that need a person on an overview
screen: server health, site checks, import and migration errors, update
readiness, storage integrity, a form's validation summary. A heading with
their count, then each problem with its status, title, a line of text and one
action, the most serious first.

```html
<sf-list-attention>
  <script type="application/json" data-sf-settings>
    {"items": [
      {"id": "down", "status": "error", "title": "demo-php.test не отвечает",
       "text": "12 минут, код 502", "action": {"label": "Перезапустить", "event": "restart"}},
      {"id": "cert", "status": "warning", "title": "Сертификат истекает через 6 дней",
       "action": {"label": "Продлить", "href": "/sites/demo-static/ssl/"}}
    ]}
  </script>
</sf-list-attention>
```

With no problems it draws **nothing at all** and takes no room, so put it on
the page as it is, not in a card. `empty="line"` draws one quiet line instead
(«Всё в порядке», or `empty-text`).

The list orders, counts and draws. The host owns the problems: it checks,
sets the whole list again when one appears or ends, and does the actions.

## Settings

- `items` — `[{id, status, title, text?, action?}]`, a property or the JSON
  island a server prints. `status` is `error`, `warning`, `info` or `success`
  (`danger` reads as `error`, anything else as `info`). The order is error,
  warning, info, success; inside a status the host's. An item without an id
  or a title is left out.
- `action` — `{label, href}` is a link; its press asks
  `sf-list-attention-navigate` `{id, status, href}`, cancelable (a router
  cancels it and goes there itself). `{label, event}` is a button; its press
  sends `sf-list-attention-apply` `{action: event, scope: 'entry', ids: [id],
  id, status}` (vocabulary `apply`).
- `label` — the heading, «Требует внимания» / «Needs attention» by default;
  `heading-level` 2–6 (3) its level in the page's outline.
- `empty` `none|line`, `empty-text` — what an empty list shows.
- `size` `1|1/2` — the rung of the ladder; 1/2 for a side panel.

Host states: `data-status` (the most serious status shown) and `data-empty`.

## Geometry

One rung S: the heading and the titles are the rung's line, the texts the
rung below's, the status icon the title's line, icon-to-text the rung's
text-space-x. A one-line row is the rung's control height (40 px at size 1 on
a desktop), as a list row is; the dividers give up their hairline from the
row's inset. The action is an `sf-button` of the rung below, centred on the
row. In a column narrower than 360 px the action goes under the text.

## Public variables

`--sf-list-attention-background` (none by default),
`--sf-list-attention-divider-color`, `--sf-list-attention-heading-color`,
`--sf-list-attention-padding-inline` (0 by default: the rows line up with the
page's text), `--sf-list-attention-gap` (under the heading). The Framework
never sets them.

## Accessibility

A section named by its heading; the items are a list. Each item says its
status in words before its title («Ошибка: …»), so the icon is never the only
sign. The list is no live region and takes no focus; a host that wants a new
problem read out announces it itself.

## Changes

- 1.0.0 (2026-11-07) — the first version, for the Larena admin screens
  (Federation bus msg-993e1e39 item 2).
