# Smart Search

`<sf-search>` is the site search of a SIMAI site: a window with a large
rounded field and a separate results card under it, over a light scrim. A
button in the header opens it, and so do Command/Control+K and `/`. On a phone
it is a full-screen sheet with the field on top and a back arrow.

The trigger is the page's own element, so the header looks the same before
the code arrives and after it. The results come from the site: a static JSON
index (`index`) or a function the page gives (`provider`).

```html
<sf-search index="/search-index.json">
  <sf-button icon-start="search" text="Поиск" appearance="tonal" scheme="on-surface" radius="rounded"></sf-button>
</sf-search>
```

## The trigger

The children without a `slot` attribute (the `trigger` slot) open the window
when pressed. A trigger that stands elsewhere on the page is named by `for`
(an id, or several separated by spaces):

```html
<sf-icon-button id="search-button" icon="search" aria-label="Поиск"></sf-icon-button>
<sf-search for="search-button" index="/search-index.json"></sf-search>
```

The component gives every trigger `aria-haspopup="dialog"`, `aria-expanded`,
`aria-controls` while open and `aria-keyshortcuts`.

`shortcut` lists the keys that open the window, separated by spaces: `mod` is
Command or Control (Command on a Mac, Control elsewhere; either works); a single printable key (`/`) acts only
outside a text field. The default is `mod+k /`; an empty value turns the keys
off. With several searches on one page, give each its own keys.

## The data

### A static index

`index` is the address of a JSON file. The built-in provider reads it once and
finds every entry whose title, path or text holds each word of the query,
case-insensitive: a title that starts with the query first, then one that holds
it, then the rest.

```json
{
  "groups": [
    {"id": "pages", "label": "Страницы"},
    {"id": "components", "label": "Компоненты"},
    {"id": "actions", "label": "Действия"}
  ],
  "popular": ["таблица", "тема", "кнопка"],
  "items": [
    {"group": "pages", "title": "Таблица в рамке", "path": "Утилиты › Таблицы", "href": "/utilities/table/", "icon": "table", "text": "рамка прокрутка"},
    {"group": "components", "title": "sf-button", "path": "Смарт-компонент", "href": "/smart/button/", "icon": "widgets"},
    {"group": "actions", "title": "Сменить тему", "path": "Команда", "action": "theme", "icon": "contrast", "shortcut": "⇧⌘L"}
  ]
}
```

An array of entries alone is an index too. An entry's `url` is read as `href`;
`path` may be a list, joined with ›.

### A provider

`provider` is a property: a function, usually async, that answers a query.

```js
document.querySelector('sf-search').provider = async (query, {scope, signal}) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {signal});
  return response.json(); // {groups, items, popular}
};
```

- It is called with the empty query when the window opens: answer the quick
  actions (entries with `action`) and `popular`.
- It is called again after the person stops typing (120 ms); the previous call
  is aborted through `signal`.
- `scope` is the pressed scope, a hint only: answer every group, so the counts
  on the scope pills stay right. The component filters by scope itself.
- An entry: `id`, `group`, `title`, `path`, `href` or `action`, `icon` (a
  Material Symbols name), `shortcut` (a hint shown on an action), `text`
  (matched by the static index, not shown).

While the first answer is awaited the card says so; an error says the search
is unavailable; no entries say «Ничего не нашлось по «…»».

## What the window shows

On an empty field: the recent queries, the popular queries as pills and the
quick actions. With a query: the scope pills, then the results under their
group captions. Each block is a setting, on by default:

| Setting | Block |
| --- | --- |
| `scopes` | Filter pills: all, then one per result group, with counts |
| `recent` | Recent queries, each with a remove button, and «Очистить» |
| `popular` | Popular queries on an empty field and under an empty result |
| `actions` | Results that run a command, with their shortcut hint |
| `path` | The path line under a result's title |
| `keys` | The footer: ↑↓ to select, ↵ to open, esc to clear or close |

A query is recorded as recent when one of its results is opened. The recent
queries are a view preference of the person, kept through `SF.Preferences`
under `sf-search/<recent-key>` (`recent-key` is `site` by default): in the
browser as `localStorage` `sf-pref:sf-search/site`, and by a host that keeps
preferences for its user. Give each search of a site its own key. An empty
`recent-key`, or a browser that refuses storage, keeps them for the page's
life.

## Choosing a result

Enter opens the selected result, a press opens the pressed one. The window
closes, the query is recorded and the page hears `sf-search-navigate` with
`{id, href, action, query, group}`. Unless the page cancels it, the browser
goes to `href`. An action result carries `action` and no `href`: the page runs
it.

```js
search.addEventListener('sf-search-navigate', (event) => {
  if (event.detail.action === 'theme') {
    event.preventDefault();
    toggleTheme();
  }
});
```

## Keyboard and screen readers

The open window is a modal dialog named by `label`. The field is a combobox:
the arrows move the selection through the results while the focus stays in
the field, and a polite status says how many results there are.

| Key | Result |
| --- | --- |
| `Command/Control+K`, `/` | Opens the window; in an open window, selects the field's text |
| `↓` `↑` | Moves the selection |
| `Enter` | Opens the selected result; a recent query is put into the field |
| `Escape` | Clears a filled field; closes an empty window and gives focus back |
| `Tab` | Moves through the window's buttons only |

The X in the field does the same as Escape: it clears a filled field and keeps
the focus, and closes an empty window. A press on the scrim closes it too.

The window is a layer of the Framework's shared layer stack, like `sf-modal`
and `sf-drawer`: only the top layer hears Escape and Tab, and the page does not
scroll while the window is open. Inside a `[data-sf-overlay-container]` (a
documentation example) the window stays in that box and the page is not
locked.

## Methods and events

| Method | What it does |
| --- | --- |
| `open()` | Opens the window with an empty field |
| `close({reason})` | Closes it |
| `toggle()` | Opens or closes |

| Event | When |
| --- | --- |
| `sf-search-open` | The window is about to open; cancelable |
| `sf-search-opened` | The window opened |
| `sf-search-close` | The window is about to close, `detail.reason`: `close`, `escape`, `outside` or `api`; cancelable |
| `sf-search-closed` | The window closed, `detail.reason` |
| `sf-search-navigate` | A result was chosen, `{id, href, action, query, group}`; cancelable |

## Customisation

| Variable | What it changes |
| --- | --- |
| `--sf-search-inline-size` | The window's width (36rem) |
| `--sf-search-inset-block-start` | The distance from the top of the window (4rem) |
| `--sf-search-background` | The field's and the card's surface |
| `--sf-search-scrim-color` | The scrim |
| `--sf-search-mark-color` | The fill of the matched text |
| `--sf-search-radius` | The results card's corners |
| `--sf-search-list-max-block-size` | The card's greatest height |

SIMAI sites do not override the Framework's values with their own: the
variables are for the Framework's own levels (a theme, an area).
