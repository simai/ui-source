# Card

`.sf-card` groups a few blocks of content -- a heading, a paragraph, a list, an
action -- on a surface of its own: the page surface fill, a hairline edge in
`--sf-outline-variant` and the surface radius. It is CSS only.

```html
<div class="sf-card">
  <h4>Portable project</h4>
  <p>Markdown and JSON stay next to the code and can be reviewed through Git.</p>
</div>
```

The blocks stand in one column with one gap between them (the text gap of the
content rhythm, `--sf-content--space-text`); their own outer margins are taken
off, so a heading or a paragraph inside does not add its page margin. The card
has no semantics: when its content is one article or one link, the page puts
that element inside it, not on it.

A heading inside the card is its title, whatever its level (`h2` to `h6`
keep their meaning, not their page size): the heading-6 step
(`--sf-heading-6--size`, the size of `--sf-text-size-1` at normal density) on
the card title line `--sf-title--height-card`, semibold -- 16 px on a 24 px
line on a desktop, 14 px on 20 on a phone, the line of the text under it, as
the titles of the other components (1.6.0, R082, C89). The title rule also rides the core sheet, so a card drawn before its own
sheet arrives already has its title size on the first frame (#261 N3; 1.8.3). Headings do not follow density (C44): in a compact region
(`data-sf-density="compact"` on `<html>` or on a container) the title is the
same; `--sf-card-title-size` and `--sf-card-title-weight` change it. In a narrow card (three in a row on a phone) the words wrap, a long
word breaks at a hyphen where the language allows it (`hyphens: auto`, with
the page's `lang`), and only a word with no hyphen point breaks anywhere.

A rounded block inside a card -- a card in a card, the picture of an
`.sf-figure` -- takes the nested corner (C173 (5)): the card's corner less its
inset, never under 4 px. With the surface radius (8) and the card's inset (20,
16 on a phone) that is 4 px at every width (1.6.1). A plain card has no frame,
so what it holds keeps its own corner.

## Header

The card's header (owner decision C231, 1.8.0; it fulfils C188 (1)) is one
row: the card's title and one action at its end, 8 px apart. The heading
inside is drawn as the card's title (16/24 600, 14/20 on a phone), whatever
its level, and wraps; the action is an `sf-icon-button` of size 1/2 (an
`<sf-button-icon size="1/2">` or its class markup), held to the title's line,
so the row is as tall as the title. `content.card` 1.1.0 draws it from its
`title` and `action_icon`, `action_label`, `action_href`.

```html
<div class="sf-card">
  <div class="sf-card-header">
    <h4>Заказ № 1042</h4>
    <button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/2" aria-label="Ещё"><i class="sf-icon" aria-hidden="true">more_vert</i></button>
  </div>
  <p>Оплачен, передан в доставку.</p>
</div>
```

## Actions row

A card has no footer or subtitle part (owner decision C188 (1)). Its buttons
stand in the core's `.sf-actions` row as the card's last block: one group,
8 px apart (4 in compact density), the main action first. As the last block
the row stands at the card's foot, so the rows of a grid of cards of one
height line up.

```html
<div class="sf-card">
  <h4>Оплата</h4>
  <p>Карта, счёт для юрлиц и оплата при получении.</p>
  <div class="sf-actions">
    <sf-button text="Сохранить"></sf-button>
    <sf-button appearance="outline" text="Отмена"></sf-button>
  </div>
</div>
```

## Picture at the edge

An `.sf-figure` as the card's first block goes to the card's edge (owner
decision C188 (2), 1.7.0): the card's inset is taken back above and beside
it, its top corners are the card's (the card's corner less its edge, 7 px),
its lower corners square, and its caption keeps the card's inset. The ratio
is the figure's own list (C188 (6)): `sf-figure--ratio-1x1`, `-4x3`, `-3x2`,
`-16x9`, `-21x9`, or none for the picture's own shape. Every other rounded
part inside the card follows the nested corner below.

```html
<div class="sf-card">
  <figure class="sf-figure sf-figure--ratio-16x9">
    <div class="sf-figure-media"><img src="/store.webp" alt="" width="1280" height="720"></div>
  </figure>
  <h4>Новый склад</h4>
  <p>Открыли 12 ноября, принимает с 8 утра.</p>
</div>
```

A card the page colours is that coloured place: `sf-card bg-success-container`
draws the success container (1.8.0, C16); the card's fills stand under the
utilities, and its variables still set them.

A card is positioned (`position: relative`, 1.10.0, cards study CV-6): a
visually hidden label (`sr-only`) or a control set in a corner (`absolute`)
inside it stands against the card, not against a far ancestor, so nothing
escapes the card or widens the page. The rule stands under the utilities: a
card the page places itself (`sf-card absolute`, `sticky`) keeps that place.

`sf-card--plain` keeps the column and drops the surface: no fill, no edge, no
padding. Use it inside a grid of cards that needs no frames.

`content.card` renders with it (`props.variant`: `default` or `plain`; the header since 1.1.0), and a
`content.grid` of cards lays them out in columns.

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-card-background-color` | the fill | `--sf-surface-card` |
| `--sf-card-color` | the text | `--sf-on-surface` |
| `--sf-card-border-color` | the edge | `--sf-outline-variant` |
| `--sf-card-border-width` | the edge's width | `--sf-px` |
| `--sf-card-radius` | the corners | `--sf-radius--surface` |
| `--sf-card-padding-block` | the space above and below the content | `--sf-space-2` |
| `--sf-card-padding-inline` | the space beside the content | `--sf-space-2`, or 8 % of the card's column when that is less (a narrow card) |
| `--sf-card-gap` | between the blocks | `--sf-content--space-text` |
| `--sf-card-title-size` | a heading's size inside the card | `--sf-heading-6--size` (16 px on a desktop, 14 on a phone, in a compact region too) |
| `--sf-card-title-weight` | a heading's weight inside the card | `--sf-text--font-weight-6` |

In forced colours the edge is drawn in `CanvasText`.
