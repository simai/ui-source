# sf-page-header

The head of an admin page. The admin's top bar is gone, so this is where a page
says where it is, what it is called, how many records it holds, whether it is a
favourite, and what its main action is. It renders with Framework utilities
only; the outer Smart host remains boxless.

Tag:

- `sf-page-header`

Attributes:

- `heading` — the page heading, drawn as the fourth heading step.
- `count` — how many records the page holds. The admin menu carries no totals,
  so this is where they are. Empty draws no count.
- `level` — `site` (default) or `install`. An install page is marked «для всех
  сайтов», the same mark the menu puts under the install root.
- `star` — empty draws no star; `off` and `on` draw it in that state.
- `root-class`

Slots:

- `path` — where the page is, usually an `sf-breadcrumbs` starting at the site.
- `start` — the start of the line, for a phone's ☰.
- `actions` — the main action, at the end of the line.

Event:

- `sf-page-header-star` `{on}` — the person pressed the star. It is
  cancelable: a host that waits for its own answer cancels it and sets `star`
  when it knows. Not cancelled, the header sets `star` itself.

The host keeps favourites; the header keeps nothing.

```html
<sf-page-header heading="Каталог решений" count="448" star="off">
  <sf-breadcrumbs slot="path">
    <sf-breadcrumbs-item href="/">simai.ru</sf-breadcrumbs-item>
    <sf-breadcrumbs-item href="/data">Данные</sf-breadcrumbs-item>
  </sf-breadcrumbs>
  <sf-button slot="actions" icon-start="add">Создать</sf-button>
</sf-page-header>
```
