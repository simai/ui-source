# sf-header-page

The head of an admin page. The admin's top bar is gone, so this is where a page
says where it is, what it is called, how many records it holds, whether it is a
favourite, and what its main action is. It renders with Framework utilities
only; the outer Smart host remains boxless.

Tag:

- `sf-header-page`

Attributes:

- `heading` — the page heading, drawn as the fourth heading step. A long
  heading ends in an ellipsis on one line: beside the actions while it has
  at least 20rem (the g0 step) there, and the count, the install mark and the
  star stay whole right after it.
- `count` — how many records the page holds. The admin menu carries no totals,
  so this is where they are. Empty draws no count.
- `level` — `site` (default) or `install`. An install page is marked «для всех
  сайтов», the same mark the menu puts under the install root.
- `star` — an optional boolean: absent draws no star; `false` (or `off`) and
  `true` (or `on`) draw it in that state. Present and empty is `true`.
- `expressive` — the decorative level (owner decision C91, level 2): a tinted
  head, primary tone 50 at 16 (dark 24) fading down to nothing by the head's
  foot, in a padded field with the surface radius. A head narrower than 30rem
  (the g5 step, R164 variant C) stays plain: on a narrow column the colour adds nothing. Off by
  default; `data-sf-style="expressive"` on the root or a container turns it on
  for every head under it, `data-sf-style="strict"` turns it off again.
- `root-class`

Slots:

- `path` — where the page is, usually an `sf-breadcrumbs` starting at the site.
- `start` — the start of the line, for a phone's ☰.
- `actions` — the page's actions, the main one (a filled `sf-button`) last,
  at the end of the line, 8 apart (C105 H5). What does not fit leaves for ⋯
  «Ещё» at the row's end (`overflow="more"`, the default since 1.4.0, owner
  decision C155 (7), C161 (4)): ⋯ is an icon button of the actions' size,
  quiet (ghost), named and titled «Ещё»; it opens a menu with the actions
  that left, each with its icon and words, a pressed toggle checked, and a
  menu row presses the action itself. The actions leave from the end; an
  action's `priority` orders them — `priority="1"` is the most important, a
  bigger number leaves sooner, an action without one leaves first —
  `priority="pin"` keeps one in the row, and the main action and a pressed
  toggle never leave. The row keeps the line beside the heading while the
  heading has its room and takes a line of its own only when the actions that
  must stay do not fit there. `overflow="wrap"` keeps the former row that
  wraps onto further rows. Either way the page never scrolls sideways.

```html
<sf-header-page heading="Заказы">
  <sf-button slot="actions" appearance="outline" icon-start="upload" text="Импорт" priority="2"></sf-button>
  <sf-button slot="actions" appearance="outline" icon-start="download" text="Экспорт"></sf-button>
  <sf-button slot="actions" icon-start="add" text="Создать"></sf-button>
</sf-header-page>
```

Event:

- `sf-page-header-toggle` `{on}` — the person pressed the star (vocabulary
  1.1.5 `toggle`). It is cancelable: a host that waits for its own answer
  cancels it and sets `star` when it knows. Not cancelled, the header sets
  `star` itself. The former `sf-page-header-star` follows with the same detail
  until 2026-12-01 (`aliases.json`).

The host keeps favourites; the header keeps nothing.

Public variables (standard 1.3.8 §6): `--sf-page-header-gap` (between the path
and the line), `--sf-page-header-line-gap`, `--sf-page-header-actions-gap`,
`--sf-page-header-heading-color`, `--sf-page-header-star-color` (the
favourite's star).

The interface is `component.json`, the examples `examples.json`, the words
`lang/`.

```html
<sf-header-page heading="Каталог решений" count="448" star="false">
  <sf-breadcrumbs slot="path">
    <sf-breadcrumbs-item href="/">simai.ru</sf-breadcrumbs-item>
    <sf-breadcrumbs-item href="/data">Данные</sf-breadcrumbs-item>
  </sf-breadcrumbs>
  <sf-button slot="actions" icon-start="add">Создать</sf-button>
</sf-header-page>
```
