# Pager Smart Component

`sf-pager` leads to the neighbouring document by meaning (decision C97): the
previous and the next page of a documentation site, the previous and the next
article, the next record in an admin card. It is not list paging:
`sf-pagination` pages a list by number (1, 2, 3 …). A wizard's steps are
`sf-wizard`'s; an image counter and carousel dots are `sf-gallery`'s and
`sf-slider`'s.

The page picks the look with `appearance`; the input is one of two forms:

- **two sides** — `prev-href`, `prev-title`, `next-href`, `next-title`
  (cards, row). A server prints them as plain links that work without the
  script;
- **items and current** — `items`, a list of `{id, title, href?, meta?}`,
  and `current`, a place in it from 0 (counter; cards and row take their
  sides from it when the side attributes are not given);
- **a place in a list** — counter with `total` (or `has-next`): `current` is
  the record's place in the whole list, across the list's pages.

The component owns the drawing, the place line, the keyboard and the
request before every move. The page owns the pages themselves, whether a
step is valid, loading the next record and keeping a course's progress.

## Appearances

- `cards` (the default) — two cards, «‹ Назад / title» and «Далее › /
  title», under a documentation page. A missing side keeps its place: on
  the first page the «Далее» card stays in the second column. On a phone
  (below the sm step) the cards stack, the previous one first.
- `row` — the previous and the next article by their titles, at the two
  ends, each whole up to two lines: under a post, a news item, a product. A
  row narrower than the sm step (a phone, a card, a side column) stacks, the
  next side at the end of the line below (1.3.2).
- `counter` — «‹ 3 из 240 ›» in a record card: the record's place in the
  list it was opened from. With `total` the place is in the whole list, so
  the arrows cross the list's pages: a move past the records the page holds
  is still asked (`sf-pager-navigate` carries `index`), and the host loads
  that page of the list or cancels and goes there itself. Without `total`
  and with `has-next` the place reads «3 из многих» and Next stays on while
  `has-next` is said. `list-href` puts a quiet «К списку» icon link before
  the arrows. With `keys`, ArrowLeft / ArrowRight and `[` / `]` on the page
  move too.

Deprecated until 2027-01-01 (change journal `value-pager-steps-course-retired`),
still drawn, each use noted in `SF.deprecations`:

- `steps` — a wizard's Back, «Шаг 2 из 5 · title» over a segmented track and
  Next («Готово» on the last step). Use `sf-wizard`.
- `course` — lesson dots and a card for the next lesson. No product walks a
  course; a list of lessons is a page of its own.

```html
<sf-pager prev-href="/docs/install/" prev-title="Подключение"
  next-href="/docs/fields/" next-title="Поля ввода"></sf-pager>

<!-- A record card opened from a list of 240 (its filter kept by the host):
     record 20, the list's page 1 of 20 records. -->
<sf-pager appearance="counter" size="1/2" current="19" total="240"
  list-href="/admin/articles/?page=1" keys></sf-pager>
```

```js
pager.addEventListener('sf-pager-navigate', async (event) => {
  // index is the record's place in the whole list: load its page when needed.
  const {index} = event.detail;
  if (!loaded.has(Math.floor(index / 20))) await loadPage(Math.floor(index / 20));
  openRecord(index);
});
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
- `current` — the current place in `items`, from 0 (counter with `total`:
  in the whole list).
- `total` — counter: how many records the list has across its pages.
- `has-next` — counter without `total`: another record follows.
- `list-href` — counter: the address of the list the record was opened from.
- `complete` — the walk is finished (steps, course).
- `label` — the navigation landmark's name; «Соседние страницы» /
  «Adjacent pages» when not set.
- `prev-label`, `next-label`, `done-label` — the words «Назад», «Далее»,
  «Готово» (English: Back, Next, Done) when not set.
- `keys` — ArrowLeft and ArrowRight on the page move to the previous and the
  next item (mirrored on a right-to-left page), and `[` / `]` on counter. A
  key pressed in a field, or one another component took, is left alone.

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
«Предыдущая запись» and «Следующая запись», the list link «К списку». A control that turns disabled
after a move (Back on the first step, an end of the counter) hands focus to
the other one, so focus never falls to the page. Transitions stand still
under `prefers-reduced-motion`.

## Look

Theme roles only: links `--sf-primary`, notes `--sf-on-surface-variant`,
cards on `--sf-surface-card` with the region edge `--sf-outline-variant`
(`--sf-outline-primary` on hover), the track `--sf-surface-container` and
the fill `--sf-primary`, as on sf-progress-bar. One ladder: at a rung the
title is the text line, a note the line a step down, a picture the line it
stands on, the buttons the rung's control height.

| Variable | Default | What it changes |
|:---|:---|:---|
| `--sf-pager-gap` | `var(--sf-ui-1--text-space-x)`, the rung's picture-to-label step | the space between the parts |
| `--sf-pager-card-background-color` | `var(--sf-surface-card)` | the cards' and the lesson card's fill |
| `--sf-pager-card-border-color` | `var(--sf-outline-variant)` | their edge |
| `--sf-pager-card-radius` | `var(--sf-radius--ui)` | their corners |
| `--sf-pager-link-color` | `var(--sf-primary)` | the titles of cards and row |
| `--sf-pager-meta-color` | `var(--sf-on-surface-variant)` | the direction words, notes and place lines |
| `--sf-pager-track-color` | `var(--sf-surface-container)` | the steps' track and the dots ahead |
| `--sf-pager-fill-color` | `var(--sf-primary)` | the done segments and dots |

## First paint

cards and row are links from string settings, so their build snapshot is
the markup a server prints, and it works and has its box before any code.
course and counter have their box from the settings: every text whose length
is data is one line with an ellipsis. The row's titles (up to two lines) and
the steps' place line wrap, so their box comes with the data the snapshot
prints.
