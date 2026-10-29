# Pager Smart Component

`sf-pager` leads to the neighbouring page or step by meaning: the previous
and the next page of a documentation site, a post or a product, a wizard's
steps, a course's lessons, the next record in an admin card. It is not list
paging: `sf-pagination` pages a list by number (1, 2, 3 …).

The page picks the look with `appearance`; the input is one of two forms:

- **two sides** — `prev-href`, `prev-title`, `next-href`, `next-title`
  (cards, row). A server prints them as plain links that work without the
  script;
- **items and current** — `items`, a list of `{id, title, href?, meta?}`,
  and `current`, a place in it from 0 (steps, course, counter; cards and
  row take their sides from it when the side attributes are not given).

The component owns the drawing, the place line, the keyboard and the
request before every move. The page owns the pages themselves, whether a
step is valid, loading the next record and keeping a course's progress.

## Appearances

- `cards` (the default) — two cards, «‹ Назад / title» and «Далее › /
  title», under a documentation page. A missing side keeps its place: on
  the first page the «Далее» card stays in the second column.
- `row` — one line with the two titles at the two ends, each cut with an
  ellipsis: under a post, a news item, a product.
- `steps` — a wizard: Back, «Шаг 2 из 5 · title» over a segmented track,
  and the primary Next, which says «Готово» on the last step. Pressing it
  there finishes the walk (`complete`).
- `course` — lesson dots (done, current, ahead) with «Урок 3 из 5», and a
  card for the next lesson with its note (`meta`, such as «6 минут») and the
  primary «Начать». On the last lesson the card offers «Готово»; a finished
  course says «Курс пройден» with «Сначала».
- `counter` — «‹ 3 из 12 ›» with two icon buttons, for browsing records one
  by one. With `keys`, ArrowLeft and ArrowRight on the page move too.

```html
<sf-pager prev-href="/docs/install/" prev-title="Подключение"
  next-href="/docs/fields/" next-title="Поля ввода"></sf-pager>

<sf-pager appearance="steps" current="1">
  <script type="application/json" data-sf-settings>
    {"items": [{"id": "source", "title": "Источник"}, {"id": "fields", "title": "Поля"},
               {"id": "check", "title": "Проверка"}, {"id": "import", "title": "Импорт"}]}
  </script>
</sf-pager>
```

## Attributes

- `appearance="cards|row|steps|course|counter"` — the look (above).
- `size="1/2|1"` — the ladder rung: the buttons take it, the text lines, the
  pictures and the card insets follow it.
- `prev-href`, `prev-title`, `next-href`, `next-title` — the two sides of
  cards and row. A side with neither is taken from `items`, else it stays
  empty.
- `items` (a property, or the JSON island) — the pages, steps, lessons or
  records in order.
- `current` — the current place in `items`, from 0.
- `complete` — the walk is finished (steps, course).
- `label` — the navigation landmark's name; «Соседние страницы» /
  «Adjacent pages» when not set.
- `prev-label`, `next-label`, `done-label` — the words «Назад», «Далее»,
  «Готово» (English: Back, Next, Done) when not set.
- `keys` — ArrowLeft and ArrowRight on the page move to the previous and the
  next item (mirrored on a right-to-left page). A key pressed in a field, or
  one another component took, is left alone.

## Events

- `sf-pager-navigate` — the cancelable request before every move a person
  makes, links included: `{direction: prev | next | finish | restart |
  go-to, index, id, href}`. `index` is the target's place in `items` (the
  current one for `finish`), `null` for a side given by `prev-href` or
  `next-href`. Cancel it with `preventDefault()` to keep the current page or
  step — a step that is not valid yet — or to go there yourself.
- `sf-pager-change` — the fact after a move in `items` a person made:
  `{previous, current, complete, item}`. A link's request is followed by the
  browser, not by a change; the actions and a value set from outside send
  none.

```js
pager.addEventListener('sf-pager-navigate', (event) => {
  if (event.detail.direction === 'next' && !form.checkValidity()) event.preventDefault();
});
```

An item with an `href` in steps, course or counter is opened after the
request is allowed.

## Actions

- `prev()`, `next()`, `goTo({index})` — move as a press does, after the same
  cancelable request, without a change event. `next()` on the last step or
  lesson finishes the walk. Each answers `applied` or `refused` (the first
  or the last item, the current one, or a cancelled request).

## Accessibility

The element draws a `<nav>` named by `label`. Links carry `rel="prev"` and
`rel="next"` and are named by the direction and the title (the row says the
direction to a screen reader only). The place line of steps, course and
counter is a polite live region; the track and the dots are its picture and
are hidden from assistive technology. The counter's icon buttons are named
«Предыдущая запись» and «Следующая запись». A control that turns disabled
after a move (Back on the first step, an end of the counter) hands focus to
the other one, so focus never falls to the page. Transitions stand still
under `prefers-reduced-motion`.

## Look

Theme roles only: links `--sf-primary`, notes `--sf-on-surface-variant`,
cards on `--sf-surface-0` with the region edge `--sf-outline-variant`
(`--sf-outline-primary` on hover), the track `--sf-surface-container` and
the fill `--sf-primary`, as on sf-progress-bar. One ladder: at a rung the
title is the text line, a note the line a step down, a picture the line it
stands on, the buttons the rung's control height.

| Variable | Default | What it changes |
|:---|:---|:---|
| `--sf-pager-gap` | `var(--sf-ui-1--text-space-x)`, the rung's picture-to-label step | the space between the parts |
| `--sf-pager-card-background` | `var(--sf-surface-0)` | the cards' and the lesson card's fill |
| `--sf-pager-card-border-color` | `var(--sf-outline-variant)` | their edge |
| `--sf-pager-card-radius` | `var(--sf-radius--ui)` | their corners |
| `--sf-pager-link-color` | `var(--sf-primary)` | the titles of cards and row |
| `--sf-pager-meta-color` | `var(--sf-on-surface-variant)` | the direction words, notes and place lines |
| `--sf-pager-track-color` | `var(--sf-surface-container)` | the steps' track and the dots ahead |
| `--sf-pager-fill-color` | `var(--sf-primary)` | the done segments and dots |

## First paint

cards and row are links from string settings, so their build snapshot is
the markup a server prints, and it works and has its box before any code.
steps, course and counter have their box from the settings: every text whose
length is data is one line with an ellipsis.
