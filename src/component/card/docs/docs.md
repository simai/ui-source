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

`sf-card--plain` keeps the column and drops the surface: no fill, no edge, no
padding. Use it inside a grid of cards that needs no frames.

`content.card` renders with it (`props.variant`: `default` or `plain`), and a
`content.grid` of cards lays them out in columns.

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-card-background` | the fill | `--sf-surface-0` |
| `--sf-card-color` | the text | `--sf-on-surface` |
| `--sf-card-border-color` | the edge | `--sf-outline-variant` |
| `--sf-card-border-width` | the edge's width | `--sf-px` |
| `--sf-card-radius` | the corners | `--sf-radius--surface` |
| `--sf-card-padding-block` | the space above and below the content | `--sf-space-2` |
| `--sf-card-padding-inline` | the space beside the content | `--sf-space-2` |
| `--sf-card-gap` | between the blocks | `--sf-content--space-text` |

In forced colours the edge is drawn in `CanvasText`.
