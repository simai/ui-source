# sf-reference-link

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart reference link built on top of the base `.sf-reference-link` component.
It preserves a native anchor when `href` is present, makes the complete surface
the pointer and focus boundary, and renders a non-focusable unavailable surface
when `disabled` is set. Use ordinary Link when no secondary reference is needed.

## Tag

- `sf-reference-link`

## Attributes

- `icon` — the type icon before the name; absent is the arrow in a card, a
  size or on a line and no icon in text; `icon=""` is no icon
- `label`
- `text` — the route or number: at the far end of a card or a line, after the
  name in a quiet ink in text
- `href`
- `target` — `_blank` adds the `open_in_new` sign after the words and
  «(откроется в новой вкладке)» / "(opens in a new tab)" to the name
- `disabled`
- `appearance="card|inline|plain"` — `card` is the box; `inline` is a link in
  running text (C147); `plain` is the link alone inside something that is
  already a box (a field, a table cell)
- `size`, `line` — a form size, or the text line of one (card and plain)
- `state="missing|forbidden"` — the target is gone: no link, the broken-link
  icon, the words dimmed and the reason after the name («удалена»,
  «нет доступа»)
- `copy` — a card only: a «Копировать ссылку» icon button at its end
- `aria-label` — a host attribute, passed to the link

The interface is `component.json` (standard 1.3.8); examples are
`examples.json`.

## Two looks (owner decision C147)

- **In text** (`appearance="inline"`): the reference flows and wraps with the
  sentence and takes the size of the text around it, so the line keeps its
  height. A record reference is the type icon, the name and the number:
  `<sf-reference-link appearance="inline" icon="task_alt" label="Подписать
  договор" text="№ 4812" href="/tasks/4812/">`. The icon is one line high and
  stands 4 before the name (C105 H3); the number never breaks.
- **Card** (default): the name (up to two lines, then an ellipsis) and the
  route at the far end; on a phone the route goes under the name.

The underline is always on in text; in a card, a field and a table (`line`,
`size`, `plain`) the link is underlined under the pointer and on keyboard
focus only.

`target="_blank"` adds `rel="noopener noreferrer"`, the `open_in_new` sign and
the words for a screen reader, in the page's language; do not write them by
hand. The icons are decorative and are not copied with the text.

A visited colour is shown only where the page asks for it: a site or
documentation marks a region (or `<html>`) `data-sf-visited="on"`, and only
references in text take `--sf-link-visited` there. Apps and tables never show
it.

A long name: a card shows two lines, a sized reference or one on a line one;
a cut name has its whole text in the Framework tooltip on hover and keyboard
focus (the tooltip component's `data-tooltip` route). Text in a sentence is
never cut.

`copy` uses the clipboard component's `data-sf-copy` route (decision C48): the
check and «Скопировано» for two seconds, the address in full.

The hover card of C59 (preview after 0.5 s) is not in the SIMAI Framework yet;
when it ships it anchors on `.sf-reference-link__link`. Nothing is drawn for
it now.

## Slots

- `label`
- `text`

## Example

```html
<sf-reference-link
  label="Getting Started"
  text="/guides/getting-started/"
  href="/guides/getting-started/"
></sf-reference-link>

<p>Details in task
  <sf-reference-link appearance="inline" icon="task_alt"
    label="Sign the contract" text="#4812" href="/tasks/4812/"></sf-reference-link>.
</p>

<sf-reference-link appearance="inline" icon="task_alt" label="#4790"
  state="missing"></sf-reference-link>
```

## Public variables

Each falls back to the internal token (standard simai.smart-component 1.3.8
§6): `--sf-reference-link-background-color` and `-border-color` (at rest; hover,
press and disabled keep their own), `-radius`, `-link-color`,
`-padding-inline`, `-padding-block` and `-gap`.
