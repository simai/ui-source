# sf-header-page

The head of a work page of an app. Which header where (owner decision C161
(1)): a site shows `sf-header-site`; an app with a side menu (the admin, SIMAI
Pro, mail) has no top bar, and each page's head is this header at the top of
the work area — the main region of `.sf-workspace` — with «назад» in the
`start` slot where the page opens from a list (a conversation, a letter, a
record). It says where the page is, what it is called, whether it is a
favourite, what its actions are and which of its views is shown. It renders
with Framework utilities only; the outer Smart host remains boxless.

Tag:

- `sf-header-page`

Attributes:

- `heading` — the page heading, drawn as the fourth heading step (20/24,
  phone 16/18): a work page titles itself there, an exception to C21's h1 at
  step 6 (C161 (2)); a page of a site keeps its own h1 at step 6. A long
  heading ends in an ellipsis on one line: beside the actions while it has
  at least 20rem (the g0 step) there, and the count, the install mark and the
  star stay whole right after it.
- `count` — how many records the page holds, for a page without a table
  footer (a folder, a settings section). A list page shows no count here: its
  table footer gives the total, «1–50 из 448» (C161 (6)). Empty draws no
  count.
- `level` — `site` (default) or `install`. An install page is marked «для всех
  сайтов», the same mark the menu puts under the install root.
- `star` — an optional boolean: absent draws no star; `false` (or `off`) and
  `true` (or `on`) draw it in that state. Present and empty is `true`.
  The star stands on its row's rung (one row, one rung, C103): while the
  actions keep the line beside it, it takes their size (the first action's,
  1 when the page gives none); else the size of the `start` control beside
  it; alone with the heading — no actions, or a phone's actions on a line of
  their own — the half step (32).
- `expressive` — the decorative level (owner decision C91, level 2): a tinted
  head, primary tone 50 at 16 (dark 24) fading down to nothing by the head's
  foot, in a padded field with the surface radius. A head narrower than 30rem
  (the g5 step, R164 variant C) stays plain: on a narrow column the colour adds nothing. Off by
  default; `data-sf-style="expressive"` on the root or a container turns it on
  for every head under it, `data-sf-style="strict"` turns it off again.
- `sticky` — off by default (C161 (7)). On, the header stays at the top of
  the work area that scrolls it (the nearest box that scrolls, else the
  window), with a half step of room (`--sf-space-1/2`) above and below its
  line on the page's surface. While content runs under it the host says
  `data-scrolled`, the header takes the raised place of C20 (raised surface
  and shadow, as `sf-header-site`'s bar) and its path folds away, so it holds
  only its line.
- `root-class`

Slots:

- `path` — where the page is, usually an `sf-breadcrumbs` starting at the site.
- `start` — the start of the line, before the heading: «назад» (an
  `sf-button-icon` `arrow_back`, ghost, on-surface) on the head of a page an
  app opens from a list, or a phone's ☰.
- `actions` — the page's actions, 8 apart (C105 H5). The header places the
  main one (a filled `sf-button`, one per page) last, at the end of the line,
  and the outlined and quiet ones before it in the page's order (C161 (3));
  written main-first, the row still reads «Импорт, Экспорт, Создать». The
  nodes are placed, not copied, so the reading and Tab order follow what is
  seen. Windows and panels keep the main action first (C157 (3), C159 (4));
  a confirm window keeps C39. What does not fit leaves for ⋯
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
  wraps onto further rows. Either way the page never scrolls sideways. On a
  phone the main action stays and the rest go under «Ещё» (C161 (4)).
- `tabs` — the page's views, an `sf-tabs` `type="underline"` (C161 (5)). They
  end the header the header's gap (`--sf-space-1/2`, 12) below the line, and
  the tabs' own line is the header's lower edge: do not place tabs under the
  header yourself or add a gap between them.

```html
<sf-header-page heading="Заказы">
  <sf-button slot="actions" appearance="outline" icon-start="upload" text="Импорт" priority="2"></sf-button>
  <sf-button slot="actions" appearance="outline" icon-start="download" text="Экспорт"></sf-button>
  <sf-button slot="actions" icon-start="add" text="Создать"></sf-button>
</sf-header-page>
```

```html
<sf-header-page heading="Каталог решений">
  <sf-button slot="actions" icon-start="add" text="Создать"></sf-button>
  <sf-tabs slot="tabs" type="underline" items='[{"id":"all","label":"Все","current":true},{"id":"draft","label":"Черновики"}]'></sf-tabs>
</sf-header-page>

<sf-header-page heading="Отпуск и перенос">
  <sf-button-icon slot="start" icon="arrow_back" appearance="ghost" scheme="on-surface" aria-label="К разговорам"></sf-button-icon>
  <sf-button slot="actions" appearance="outline" icon-start="group" text="Участники"></sf-button>
</sf-header-page>
```

Event:

- `sf-header-page-toggle` `{on}` — the person pressed the star (vocabulary
  1.1.5 `toggle`). It is cancelable: a host that waits for its own answer
  cancels it and sets `star` when it knows. Not cancelled, the header sets
  `star` itself. The former names `sf-page-header-toggle` (until 2027-01-01)
  and `sf-page-header-star` (until 2026-12-01) follow with the same detail
  (`aliases.json`).

The host keeps favourites; the header keeps nothing.

Public variables (standard 1.3.8 §6): `--sf-page-header-gap` (between the path
and the line), `--sf-page-header-line-gap`, `--sf-page-header-actions-gap`,
`--sf-page-header-heading-color`, `--sf-page-header-star-color` (the
favourite's star).

The interface is `component.json`, the examples `examples.json`, the words
`lang/`.

```html
<sf-header-page heading="Каталог решений" star="false">
  <sf-breadcrumbs slot="path">
    <sf-breadcrumbs-item href="/">simai.ru</sf-breadcrumbs-item>
    <sf-breadcrumbs-item href="/data">Данные</sf-breadcrumbs-item>
  </sf-breadcrumbs>
  <sf-button slot="actions" icon-start="add">Создать</sf-button>
</sf-header-page>
```
