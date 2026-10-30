# Smart Contents

`<sf-contents>` — the table of contents of one page: its sections as in-page
links, the current one marked while the page scrolls. One list, drawn four
ways, for documentation, help, long articles and long settings forms.

```html
<div class="page">
  <article id="article">
    <h2 id="intro">Введение</h2> …
    <h2 id="install">Подключение</h2> …
    <h3 id="cdn">Через CDN</h3> …
  </article>
  <aside><sf-contents target="#article" levels="2-3"></sf-contents></aside>
</div>
```

## Layouts

`layout` chooses the drawing; the list and its behaviour are the same.

| `layout` | What it is | Where |
| --- | --- | --- |
| `column` | a heading and the list on a line, the current section's bar on it; sticky | documentation and help on a wide screen |
| `compact` | one button with the current section and a reading-progress line under it; it opens the list | a phone, a narrow column |
| `rail` | a short stroke per section at the inline end, longer for the current one; the names show on hover and focus | articles and landings, where the contents should not compete |
| `bar` | a sticky row of anchor tabs with the current tab underlined | long forms and settings pages in an admin |
| `auto` (default) | `column` at and above the `collapse` step, `compact` below it | a documentation page that serves every width |

`collapse` is the Framework breakpoint of `auto`: `sm` (32rem), `md` (44rem),
`lg` (60rem, the default), `xl` (72rem). The switch is a media rule in the
component's sheet, so the first paint is right before the script arrives.

## Sticky: the room to stick in, and the band behind the button

A sticky element sticks inside its parent: it can travel only as far as the
parent's own box reaches. The column (and the rail and the bar) stays in view
only when the element that holds it is as tall as the content beside it — a
grid cell that stretches, which is the grid's default. With
`align-items: start` (or `align-self: start`) on the cell, the cell is only as
tall as the contents list, and the list scrolls away with the page.

```html
<style>
  .page { display: grid; grid-template-columns: minmax(0, 1fr) 14rem; gap: 1.5rem; }
  /* no align-items: start here: the aside stretches to the article's height */
</style>
<div class="page">
  <article id="article">…</article>
  <aside><sf-contents target="#article"></sf-contents></aside>
</div>
```

The compact button sticks too, and the page scrolls under it, so it carries a
band of the page's surface (`--sf-contents-background`) as wide as the element.
Put the element where that band belongs: in the page's own column, not inside a
box with its own fill. A page that would rather let the button scroll away sets
`sticky="false"`.

In a flex row the same holds: leave the aside at `align-self: stretch`. The
column stops `--sf-contents-inset-block-start` below the top of the window
(`--sf-space-1` by default); a page with a sticky header sets it to the
header's height.

## Where the sections come from

1. `items` — `[{id, text, level?}]`, when a server knows the sections (Docara
   prints them). An attribute cannot hold a list: give it as the property, or
   as the JSON island a server prints inside the element:

   ```html
   <sf-contents layout="auto">
     <script type="application/json" data-sf-settings>{"items": [
       {"id": "intro", "text": "Введение", "level": 2},
       {"id": "cdn", "text": "Через CDN", "level": 3}
     ]}</script>
   </sf-contents>
   ```

2. Links written inside the element — `<a href="#id">text</a>`, with
   `data-level="3"` (or `aria-level`) for a deeper level. They are read once
   and drawn as the list.
3. Otherwise the headings of `target` (a CSS selector; empty: the page's
   `<main>`, else its `<body>`) in the `levels` range — `2-3` by default, or
   one level like `2`. A heading without an `id` gets one made from its words.
   A heading inside `[hidden]` or `[data-sf-contents-skip]` is left out.

The drawn list is plain links (`<a href="#intro">`), so the contents work
without the script: the browser jumps to the section. A server prints the
element's first paint as its snapshot form (`static/default/*.html`): the
host, the island and the list marked `data-sf-static`.

## The current section

The current section is the last one whose top is at or above the top of the
scroll area; at the end of the scroll area it is the last section in view. The
top of the scroll area is its `scroll-padding-top`: a page with a sticky header
sets `html { scroll-padding-top: … }` (and the headings' `scroll-margin-top`
if it wants), and both the jump and the mark follow it. The sections may live
in a scrolling container instead of the window; its nearest scrolling ancestor
is used.

- The current link carries `aria-current="location"`.
- `element.current` is its id.
- `sf-contents-change` is sent when it changes — by scrolling or by a section
  chosen — with `detail: {id, previous}`. It is not sent for the first answer.

A chosen link scrolls to its section, smoothly unless the person asked for
reduced motion, moves focus to the section (it gets `tabindex="-1"` when it has
none) without scrolling again, and, with `hash` on (the default), writes
`#id` to the address with `history.replaceState`, so no history entry is
added. The section scrolled to writes it too. `hash="false"` leaves the
address alone. A press with a modifier key keeps the browser's own behaviour.

## Settings

- `layout="auto|column|compact|rail|bar"`
- `collapse="sm|md|lg|xl"` — the step of `auto`
- `target` — a selector of the content whose headings are collected
- `levels` — `2-3`, `2`, `2,3`
- `items` — a list, property or JSON island
- `size="1/2|1"` — the ladder rung of the text and of the compact button;
  `1/2` by default
- `sticky` — every layout stays in view while the page scrolls: the column, the rail, the bar and the compact button; on by default
- `hash` — the address shows the current section; on by default
- `label` — the heading and the navigation's name; «На этой странице» /
  «On this page» in the page language when not set

## Actions

- `refresh()` — collects the headings again, for content that changed after
  the contents drew.
- `toggle()` — opens or closes the compact view's list; refused in another
  view.

## Accessibility

The element draws a `<nav>` named by `label`: a navigation landmark. Do not
wrap it in a second `<nav>`. Tab reaches each link. In the compact view the
button says «label: section» and `aria-expanded`; Enter or Space opens the
list, Escape closes it and gives focus back to the button, a press outside or
a chosen section closes it. In the rail view the names are hidden until hover
or focus but stay the links' names. The progress line is decoration.

## Public CSS variables

| Variable | What it changes | Default |
| --- | --- | --- |
| `--sf-contents-color` | the links' ink | `--sf-on-surface-variant` |
| `--sf-contents-current-color` | the current link, its bar, stroke or underline, and the progress | `--sf-primary` |
| `--sf-contents-line-color` | the column's line, the bar's edge, the progress track | `--sf-outline-variant` |
| `--sf-contents-background` | the bar's fill, the sticky compact button's band and the compact view's open list | `--sf-surface-0` / `--sf-elevation-2--surface` |
| `--sf-contents-indent` | the step of a deeper level | `--sf-space-1/2` |
| `--sf-contents-gap` | the space between the links | `0` (column), `--sf-space-1/2` (rail), `--sf-space-1/4` (bar) |
| `--sf-contents-inset-block-start` | where the sticky column, rail, bar or compact button stops | `--sf-space-1` |
| `--sf-contents-z-index` | the bar and the open list above the page | `--sf-z-index-5` |

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:
`sf-connected`, `sf-before-render`, `sf-after-render`, `sf-updated`,
`sf-disconnected`.
