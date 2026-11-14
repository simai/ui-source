# Smart Search

`<sf-search>` is the search window of a SIMAI site or product: one window for
pages, records and commands (owner decisions C162, C175). It is one surface
over the scrim every window of the Framework draws (core `--sf-scrim-color`,
`--sf-scrim-opacity`): the field is its head, with no frame and a line under
it, then the filters, the rows and, once the arrows are used, the key hints. A
field-like button in the header opens it, and so do Command/Control+K and `/`.
Below lg (60rem) the window is the whole screen with «Назад» at the field's
start.

The trigger is the page's own element, so the header looks the same before
the code arrives and after it. The results come from a host through the port
`simai.search-port` 1.1.0 (1.0.0 still accepted); a site with no server of its
own uses one of the two built-in hosts: a static JSON index (`index`) or a
function the page gives (`provider`).

```html
<sf-search index="/search-index.json">
  <sf-button icon-start="search" text="Поиск" appearance="tonal" scheme="on-surface" text-position="start" shortcut="mod+k"></sf-button>
</sf-search>
```

## The trigger

The children without a `slot` attribute (the `trigger` slot) open the window
when pressed. A trigger that stands elsewhere on the page is named by `for`
(an id, or several separated by spaces):

```html
<sf-button-icon id="search-button" icon="search" aria-label="Поиск"></sf-button-icon>
<sf-search for="search-button" index="/search-index.json"></sf-search>
```

On a wide header the trigger looks like a field (owner decision C162 (2)): a
tonal `sf-button` with the search glyph, its words at the start and the
shortcut's hint «Ctrl K» / «⌘K» at the end (`shortcut="mod+k"`). Below md the
header has no room for it: an `sf-button-icon` with the same glyph opens the
same window.

```html
<sf-search for="search-wide search-narrow" index="/search-index.json"></sf-search>
<sf-button id="search-wide" class="hidden md:content" icon-start="search" text="Поиск"
  appearance="tonal" scheme="on-surface" text-position="start" shortcut="mod+k"></sf-button>
<sf-button-icon id="search-narrow" class="md:hidden" icon="search" aria-label="Поиск"></sf-button-icon>
```

The component gives every trigger `aria-haspopup="dialog"`, `aria-expanded`,
`aria-controls` while open and `aria-keyshortcuts`.

`shortcut` lists the keys that open the window, separated by spaces: `mod` is
Command or Control (Command on a Mac, Control elsewhere; either works); a single printable key (`/`) acts only
outside a text field. The default is `mod+k /`; an empty value turns the keys
off. With several searches on one page, give each its own keys.

## The data

### A static index

`index` is the address of a JSON file. The built-in host reads it once and
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

Port 1.1 fields an entry may carry: `badge` (a short type mark after the
title, «Заказ»), `time` (an ISO moment drawn with `sf-time` at the row's end),
`avatar` (`{name, image}` for a person or a chat: an `sf-avatar` in place of the
glyph) and, on a command, `steps` (its next step's options, each
`{id, title, icon}`). A group may name `more`, the address of the product's
results page for that group.

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
  Material Symbols name), `shortcut` (a hint shown on an action: written as
  sf-button's, `mod+l`, it is drawn in the platform's words -- ⌘L, Ctrl+L --
  and other text as written; the keys are the kbd component's plain glyphs),
  `text` (matched by the static index, not shown), and the port 1.1 fields
  above. A command with `steps: true` asks the provider for its options:
  the provider is called with `{scope, signal, step}`, `step` the command's
  id, and answers its options as entries.
- An answer may carry `more` (the results page's address for the whole
  query) and `total` (the count behind it).

While an answer is awaited the rows on screen stay, a step paler -- the last
answer's, or on a first query the recent queries and commands -- and after
1 s a «Поиск…» line with a spinner stands over them (owner decisions C139 (4),
C130 (8)); a faster answer simply replaces them. No entries draw the inline
empty state «Ничего не нашлось по «…»» (search_off) with the popular queries
under it; a host that is unavailable draws the error state with «Повторить»,
which asks again; a forbidden answer draws the no-access state (owner decision
C120). A refusal such as a query too short is the host's sentence alone.

### A host

A server search answers through the port. The page hands a host with
`connectPort`, at once or in answer to the bubbling `sf-host-port-request` the
element raises once per connection; a connected host takes over from `index`
and `provider`.

```js
search.connectPort({
  port: 'simai.search-port',
  version: '1.1.0',
  capabilities: ['scopes', 'recent', 'popular', 'actions', 'preview', 'spelling', 'operators'],
  async raise(intent, payload, {signal} = {}) {
    if (intent === 'query.change') {
      const data = await askServer(payload, signal);
      return {answer: 'applied', sequence: payload.sequence, data};
    }
    return {answer: 'unavailable', reason: 'intent-unknown'};
  },
});
```

`raise` answers one envelope: `{answer, reason?, text?, data?, sequence?}`, with
`answer` one of `applied`, `refused` and `unavailable`. A read (`query.change`,
`result.preview`) names its `sequence`, and an answer to an older one is
dropped. Every intent and its answer is announced on `sf-search-intent`.

| Intent | When | Capability behind it |
| --- | --- | --- |
| `query.change` | A keystroke, a scope, a chosen query, a correction, the empty query on opening; in a command's step with `step`, with the field's tags as `operators` and an operator being typed as `operator` | none (`operators` for the last two) |
| `result.open` | A page result is chosen; a refusal keeps the window open and says why | none |
| `action.run` | A command is chosen | `actions` |
| `recent.forget`, `recent.clear` | A recent query (`query`) or page (`id`) is removed, the list is cleared | `recent` |
| `result.preview` | The person stands on a row and the window has room for the pane | `preview` |

The capability says what is possible, the setting says what is wanted: a block
is drawn where the host announced its capability and the page left its setting
on, and a setting cannot turn on what the host cannot do. The pane and the
«Возможно, вы искали …» line have no setting: `preview` and `spelling` are the
host's to announce. The pane needs a window of 60rem or wider. A correction is
offered, never applied: choosing it is an ordinary query.

| Host | Announces | Keeps the recent queries |
| --- | --- | --- |
| `index` | `scopes`, `recent`, `popular`, `actions` | In the person's view preferences |
| `provider` | `scopes`, `recent`, `popular`, `actions` | In the person's view preferences |
| Neither, and no port | Nothing: the field, the results and the keyboard | Nowhere |
| A connected host | What it says | The host keeps them, `recent-key` is not read |

The full contract and its conformance kit are in
`core/contracts/ports/simai.search-port/1.1.0` (1.0.0 beside it).

## What the window shows

On an empty field: the recent queries and pages, the popular queries and the
quick actions. With a query: the filters, then the results under their group
captions, at most five a group; a group with more ends in «Все результаты: N»,
which leads to the product's results page (`more`) or, without one, presses
that group's filter. The window loads no more rows itself (C175 (9)). Each
block is a setting, on by default, over the host's capability of the same
name where the table says so:

| Setting | Block |
| --- | --- |
| `scopes` | Filters: an `sf-tag-group` of one choice -- all, then one per result group, with counts; the chosen has a check (C145, C175 (4)) |
| `recent` | Up to 5 recent queries and 3 pages opened from the window, each with a remove button, and «Очистить», which clears both (C162 (6)) |
| `popular` | Popular queries on an empty field and under an empty result |
| `actions` | Results that run a command, with their keys |
| `path` | The path line under a result's title |
| `keys` | The key hints at the foot: none until the first ↑/↓ in the window, then three on one line; none under a finger (C175 (11)) |

There is no preset setting (C175 (10)): what a window shows follows what its
host can do and the settings above. The rows are menu and list rows: a glyph
20, or an `sf-avatar` for a person; a type mark (`badge`); a time at the end.
A row is 40 on one line and 48 with its path (44 compact), 44 and 60 under a
finger. The preview pane is drawn only for a host that announces `preview`,
from lg, in the 48rem window, the list and the pane halves with a line
between them.

A query is recorded as recent when one of its results is opened, a page when
it is opened. The recent queries are a view preference of the person, kept
through `SF.Preferences` under `sf-search/<recent-key>` (`recent-key` is `site`
by default): in the browser as `localStorage` `sf-pref:sf-search/site`, and by
a host that keeps preferences for its user. Give each search of a site its own
key. An empty `recent-key`, or a browser that refuses storage, keeps them for
the page's life.

The part of a title that matches the query is drawn in medium weight on the
row's own colour (owner decision C139 (8), as `sf-input-lookup`). A title or
path cut by its ellipsis shows the whole of them as the row's tooltip.

### Commands and their steps

A command whose entry has `steps` opens its next step in the same window
(C175 (7)): the command's tag stands in the field, its options are the rows,
the words typed narrow them. «Назад», Backspace on an empty field and Escape
go back to where the command was found. Choosing an option runs the command
with it (`action.run` with `value`), and the page hears `sf-search-navigate`
with the command as `action` and the option as `value`.

### Operators

A host that announces `operators` names them in its answer to the empty query
(`operators: [{id, suggest}]`, ids `from`, `subject`, `has`, `date`). Typed in
the field -- in the interface's language («от:», «тема:», «есть:», «дата:») or in
English -- an operator and its value become a tag in the field (C175 (8)); for
an operator with `suggest` the host suggests values while it is typed (people
for «от:»), and a «Уточнить» section offers the operators not used yet.
Backspace on an empty field removes the last tag. Without the capability the
words are just words of the query.

## Choosing a result

Enter opens the selected result, a press opens the pressed one. The window
closes, the query is recorded and the page hears `sf-search-navigate` with
`{id, href, action, query, group}`. Unless the page cancels it, the browser
goes to `href`. An action result carries `action` and no `href`: the page runs
it.

A page row is a link (C175 (6)): Command/Control+Enter, a Command/Control
press and the middle button open it in a new tab and the window stays. The
selected page row offers «Открыть в новой вкладке» and «Копировать ссылку»; a
command shows its own keys instead.

```js
search.addEventListener('sf-search-navigate', (event) => {
  if (event.detail.action === 'theme') {
    event.preventDefault();
    toggleTheme();
  }
});
```

## Recipes

Four configurations of the one window (C175 (10)); none needs a new setting.

**Documentation site.** A static index with pages and components, a preview
for a host that has one:

```html
<sf-search index="/search-index.json" recent-key="docs">
  <sf-button icon-start="search" text="Поиск" appearance="tonal" scheme="on-surface" text-position="start" shortcut="mod+k"></sf-button>
</sf-search>
```

**Admin command palette.** Records, sections and commands from one host
(`scopes`, `actions`, `recent`); commands carry `shortcut` and, where they ask
for a value, `steps`; record groups name `more`. The ui-pro admin palette is
such a host of `sf-search`.

```html
<sf-search id="palette" shortcut="mod+k" placeholder="Раздел, запись или действие" popular="false"></sf-search>
```

**Mail.** A host with `operators` and `avatar` on people's rows; scopes are
the folders:

```js
mail.connectPort({port: 'simai.search-port', version: '1.1.0',
  capabilities: ['scopes', 'recent', 'operators'], raise: mailSearch});
```

**Phone.** Nothing to set: below lg the window is the whole screen, rows are
44 and 60 under a finger, the key hints and the keys on rows are not drawn, the
keyboard opens at once.

## Keyboard and screen readers

The open window is a modal dialog named by `label`. The field is a combobox:
the arrows move the selection through the results while the focus stays in
the field, and a polite status says how many results there are, a filter
pressed with its count, a step opened with its options and a link copied.

| Key | Result |
| --- | --- |
| `Command/Control+K`, `/` | Opens the window; in an open window, selects the field's text |
| `↓` `↑` | Moves the selection; the first press shows the key hints |
| `Enter` | Opens the selected result; a recent query is put into the field; a command with a step opens the step |
| `Command/Control+Enter` | Opens the selected page in a new tab |
| `→` at the end of the field | Reaches the selected row's buttons; `←` and `Escape` come back |
| `Backspace` on an empty field | Goes back from a step; removes the last tag |
| `Escape` | Clears a filled field; goes back from a step; closes an empty window and gives focus back -- to what had it, or to the trigger when the window was opened by a key with nothing focused |
| `Tab` | Moves through the window's stops: the field, then the filters as one stop (`←` `→` inside) |

The X in the field clears it and keeps the focus; it is not a Tab stop
(Escape is its key). A press on the scrim closes the window.

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
| `sf-search-intent` | The panel raised an intent to the host, `{intent, payload, answer}` |

## Customisation

| Variable | What it changes |
| --- | --- |
| `--sf-search-inline-size` | The window's width (36rem, 48rem with the preview pane) |
| `--sf-search-inset-block-start` | The distance from the top of the window (4rem) |
| `--sf-search-background-color` | The window's surface |
| `--sf-search-scrim-color` | The scrim, a colour with its own transparency (by default the shared scrim) |
| `--sf-search-mark-color` | A fill behind the matched text (none by default: the match is medium weight) |
| `--sf-search-radius` | The window's corners (the window radius) |
| `--sf-search-list-max-block-size` | The rows' area's greatest height |

SIMAI sites do not override the Framework's values with their own: the
variables are for the Framework's own levels (a theme, an area).
