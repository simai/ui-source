# Alert Bar Smart Component

`sf-alert-bar` is the full-width bar above a page or an admin header for the
conditions that need action now: a disk nearly full, a failed backup, a site
that does not answer, an update. One bar holds all of them; it is coloured by
the most serious and shows it first.

```html
<sf-alert-bar>
  <script type="application/json" data-sf-settings>
    {"items": [
      {"id": "disk", "level": "danger", "text": "Диск заполнен на 98%.",
       "source": "Сервер", "time": "2026-11-05T09:58:00Z",
       "action": {"label": "Освободить место", "href": "/server/disk/"}},
      {"id": "backup", "level": "warning", "text": "Последняя копия demo.test не удалась.",
       "action": {"label": "Открыть копии", "href": "/backups/"},
       "acknowledge": {"label": "Прочитано"}}
    ]}
  </script>
</sf-alert-bar>
```

Put it once per page, above the header. Its fill runs the page's whole width;
its content stands on the page column.

One job per notice (owner decision C114 (1)):

| Component | Its job |
|---|---|
| `sf-alert-bar` | the state of the whole product that needs action now |
| `sf-alert` | the state of this page or section |
| `sf-toast` (`SF.notify`) | a short reply to an action |
| the notification centre (the Larena admin menu) | the history: what happened while you were away |
| `sf-confirm` | a decision |

News that needs no action (a backup done) is a toast or a record in the
notification centre, not the bar; the state of one page is `sf-alert`.

The component owns the order, the colour, the list of all, the
minimized strip and the announcements. The host owns the conditions: which
there are, who may see them, when one ends, and what a person closed or
acknowledged. **The bar stores nothing.**

## Items

`items` is a list, given as a property or in the JSON island:

| Field | | |
|---|---|---|
| `id` | required | The host's name for the condition, carried in every event. |
| `level` | required | `danger`, `warning` or `info`. |
| `text` | required | What is wrong, as a sentence. |
| `source` | | Where it comes from: «Сервер», «Сайт demo.test». |
| `time` | | When it began, ISO 8601, drawn by `sf-time`: within a day «5 минут назад», older «вчера, 19:40» or «5 ноября»; the full moment in its tooltip (pointer and Tab, Escape hides it). |
| `action` | | `{label, href}`: the one action link. |
| `acknowledge` | | `{label}`: an «Прочитано» button. |
| `dismissible` | | `false` keeps a warning or an info item from being closed. |

The items are sorted: danger, warning, info; inside a level the newest
first. The bar takes the first item's colour and shows it. The host sets the
whole list again when a condition appears or ends; an empty list hides the
bar.

## Several items

With more than one item the bar shows the most serious one and «Все N», which
opens the list of all under the bar, each item with its own action,
acknowledge and close. It has no arrows to page through them (C114 (3)).
Escape closes the list.

## Layout

The steps are the Framework's horizontal standard (C105): 16 from the edge,
12 from the icon to the text, 16 from the text to the actions, 8 between the
buttons and from the actions to the end button (on a phone 12, 8, 12 and 8,
the same tokens).

The content stands on the page column. A site bar (`size="1"`) takes the
inset of the `.container` at the window's step, so its icon lines up with the
logo of `sf-header-site` under it. An admin bar (`size="1/2"`) has the whole
width for its column and keeps 16 from the edge.
`--sf-alert-bar-padding-inline` sets another inset for both.

Up to 608 px (38rem, the size step g9) of the bar's own width the icon, the
text and the close share the first line. The actions go under the text and
start where the text starts, 12 under it (8 on a phone); «Все N» stands at
the line's end. The space under the last button equals what the eye sees
above the first line, the top of its capitals.

The action is a tonal surface button (`tonal on-surface`); acknowledge,
«Все N» and close are ghost, as on sf-alert and sf-toast; in the list of all
the same. On
the bar's strong colour the tonal plate's hover and press go towards the bar's
colour in the light theme, so the white label keeps 4.5:1 and more.

The close cross is the notice's service glyph (1.4.2, owner decision C112), as
on sf-alert and sf-toast: the bar's own ink at 64 of the alpha scale's ink
family -- white at 64 in the light theme, the level's tone 20 at 64 in the
dark -- not the solid ink of the text; under a pointer it catches the text ink.
Its size is the bar's line, the size of its status icon.

An action is always as wide as its label: it is never shrunk or cut with an
ellipsis. When the bar is short of room, the message wraps first, down to
10rem (the size step f0), and then the actions wrap onto a line of their own.

## Help link (1.5.1, owner decision C126)

A link in the bar's text, or in an item of its open list, leads to help only
(«Узнать больше»); the item's action and acknowledgement are buttons. The link
is the text's own ink -- the level's on-colour on the bar's strong fill,
on-surface in the list -- underlined (1 px, doubled under the pointer), with a
keyboard ring of the same ink: the rule of the whole notice family (core
`mix/_mix__notice-link.scss`). The bar's strong fill stays (C114 (4)); the
other notices have no saturated look.

## Closing

- A **warning** closes «на сутки»: `sf-alert-bar-close` carries `hide: "day"`.
- An **info** item closes for good: `hide: "always"`.
- A **danger** item is never closed. Its button minimizes the whole bar to a
  thin strip that keeps the colour and the count; a press on the strip
  expands it again. A danger item that was not in the list before expands a
  minimized bar.

A closed or acknowledged item leaves the bar at once. The host keeps the
choice and leaves the item out when it sets the list again; a host that does
not keep it brings the item back with its next list.

## Events

All bubble and are composed.

- `sf-alert-bar-navigate` — `{id, level, href}`, cancelable: the action link
  was pressed. Not cancelled, the browser follows `href`; a page with a router
  cancels it and goes there itself.
- `sf-alert-bar-acknowledge` — `{id, level}`, cancelable: the person saw the
  condition. The host records it for every person it concerns until it
  happens again.
- `sf-alert-bar-close` — `{id, level, hide, reason}`, cancelable: `hide` is
  `day` or `always`, `reason` is `close` (its button) or `api` (`close()`).
- `sf-alert-bar-minimize` — `{minimized}`: the danger bar was minimized
  (`true`) or expanded (`false`). Keep it and set `minimized` on the next page
  to keep the bar minimized.

```js
const bar = document.querySelector('sf-alert-bar');
bar.addEventListener('sf-alert-bar-close', (event) => {
  const {id, hide} = event.detail;
  fetch('/api/alerts/hide', {method: 'POST', body: JSON.stringify({id, hide})});
});
```

## Attributes and properties

- `items` — the list above (a property, or the JSON island).
- `size="1/2|1"` — the ladder rung, `1/2` by default (the bar above an admin
  header); `1` for a site page with larger type. Every button of the bar and
  of its list is `height="low"` (C117): 28 at `1/2`, 32 at `1` on desktop, the
  height of the buttons in `sf-alert` and `sf-toast`; the bar's own height
  follows it (36 and 40 on one line).
- `label` — the region's name, «Важные уведомления» / «Important notices» by
  default.
- `minimized` — the danger bar is minimized to its strip.

## Methods

- `close(id)` — closes the item as its button would, with `reason: "api"`.
  Answers `{outcome: 'applied'}` or `{outcome: 'refused', reason}`: `missing`
  (no such item shown), `danger` (a danger item, or `dismissible: false`),
  `prevented` (a page cancelled the event).

## Accessibility

The bar is a region named by `label`; it never takes focus. A bar printed
with the page is not read out. What appears later is announced: a new danger
item at once (`role="alert"`), any other new item politely
(`role="status"`). Every control is a native button or link; when a closed
item takes the focused control with it, focus goes to the next control of
the bar. Motion is off under `prefers-reduced-motion: reduce`.

## States

- `data-level` on the host: the bar's level (`danger`, `warning`, `info`), absent when empty.
- `data-minimized` while the danger bar is minimized; `data-empty` when there is nothing to show.

## Public CSS variables

- `--sf-alert-bar-error-background-color`, `--sf-alert-bar-warning-background-color`,
  `--sf-alert-bar-info-background-color` — the level fills (the theme's error,
  warning and info roles by default; the text keeps their on- role).
- `--sf-alert-bar-padding-inline` — the bar's inline inset (16, or the page
  column on a site bar), to line the text up with the header under it.
- `--sf-alert-bar-gap` — the space between the bar's text and its actions
  (16).
- `--sf-alert-bar-list-background-color` — the list of all's surface (it scrolls
  past 352 px, the size step g1).
