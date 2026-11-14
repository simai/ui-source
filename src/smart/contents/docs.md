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
| `sheet` | one button with the current section and a reading-progress line on its bottom edge; it opens the list, a bottom sheet on a phone | a phone, a narrow column |
| `rail` | a short stroke per section at the inline end, longer for the current one; the names show on hover and focus, and on a touch screen on the first tap on a stroke | articles and landings, where the contents should not compete |
| `bar` | a sticky row of anchor tabs with the current tab underlined; what does not fit goes into «Ещё (n)» | long forms and settings pages in an admin |
| `auto` (default) | `column` at and above the `collapse` step, `sheet` below it | a documentation page that serves every width |

`layout="compact"`, the sheet's former name, is a dated alias of `sheet` until
2027-01-01, noted in `SF.deprecations`; the element writes the class
`sf-contents--layout-compact` beside `sf-contents--layout-sheet` until then.
The word compact means density only (`data-sf-density`, owner decision C134).

`collapse` is the Framework breakpoint of `auto`: `sm` (32rem), `md` (44rem),
`lg` (60rem, the default), `xl` (72rem). The switch is a media rule in the
component's sheet, so the first paint is right before the script arrives.

## The line: whose it is, and the text's inset

`line` says who draws the line the entries stand on (column and bar):

- `own` (default) — the element draws its 1 px line along the list.
- `edge` — the host's divider is the line. The element draws none; the current
  section's 2 px mark lies on its inline-start edge (the bar: its bottom edge),
  over the divider's pixel. Put the element flush against the divider: the
  divider is the first inside pixel of the column (an inset shadow or
  `border-inline-start` on the column, the element its first child, no
  padding between them).
- `none` — no line and no mark; the current section is its ink and weight.

`--sf-contents-inset-inline` is the text's distance from the line, for the
heading and the links. Its default is the size's value inset, the one rule of
fields and lists (C77): size `1/2` is `max(--sf-space-1/2, --sf-b2)`, 12 on the
desktop, in a compact region and on a phone; size `1` is `--sf-space-1`, 16
(12 compact and on a phone). The rows of the sheet's open list stand at the
same inset. A host sets it once on its
column, and its own parts under the contents read the same variable:

```html
<style>
  .outline { box-shadow: inset 1px 0 0 var(--sf-outline-variant);
             --sf-contents-inset-inline: var(--sf-space-2); }
  .outline .after-contents { padding-inline-start: var(--sf-contents-inset-inline); }
</style>
<aside class="outline">
  <sf-contents line="edge" target="#article"></sf-contents>
  <p class="after-contents">Изменить страницу</p>
</aside>
```

Logical properties only: a right-to-left page needs nothing more.

The current section is the surface's ink at medium weight; the primary colour
is on its 2 px line only, as in sf-menu's column and sf-tabs.

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

The sheet's button sticks too, and the page scrolls under it, so it carries a
band of the page's surface (`--sf-contents-background-color`) as wide as the element.
Put the element where that band belongs: in the page's own column, not inside a
box with its own fill. A page that would rather let the button scroll away sets
`sticky="false"`.

The same rule decides whether it sticks at all. Stacked on a phone, an `aside`
is only as tall as the button, and a row of a grid is the limit of what stands
in it, so the button would scroll away with them. Below the step, take the
`aside` out of the way and let the page's column hold the button and the article:

```css
@media (max-width: 59.99rem) {
  .page { display: flex; flex-direction: column; }
  .page aside { display: contents; }
  .page .sf-contents { order: -1; }
}
```

In a flex row the same holds: leave the aside at `align-self: stretch`. The
column stops `--sf-contents-inset-block-start` below the top of the window
(`--sf-space-1` by default); a page with a sticky header sets it to the
header's height.

## Where the sections come from

1. `items` — `[{id, text, level?, count?, status?}]`, when a server knows the sections (Docara
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
   `data-level="3"` (or `aria-level`) for a deeper level, `data-count` and
   `data-status` for a mark. They are read once and drawn as the list.
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
none) without scrolling again, and writes `#id` to the address with
`history.replaceState`, so no history entry is added (`hash="choose"`, the
default). Scrolling does not touch the address unless `hash="scroll"`;
`hash="false"` leaves the address alone. A press with a modifier key keeps the browser's own behaviour.

## Marks: counts and statuses

An entry may carry `count` (a number above 0) and `status` (`error`,
`warning`, `success`), for a long form after a save attempt or a list of
sections with news. The mark is an `sf-badge line="text"`, sized by the entry's
text: its height is the entry's line (16 px in a compact column), its number
the entry's text size, centred on the line. The entry's name says it:
«Контакты: 2 ошибки». Choosing a section marked `error` goes to the first
invalid field of the section (`[invalid]`, `aria-invalid="true"`,
`:user-invalid`) and focuses it, not to the heading.

```js
contents.items = [
  {id: 'company', text: 'Компания'},
  {id: 'contacts', text: 'Контакты', count: 2, status: 'error'},
  {id: 'billing', text: 'Оплата', status: 'warning'},
];
```

## Nested entries

`expand="all"` (default) shows every level. `expand="current"` keeps only the
deeper entries of the section being read, the other branches folded to their
top entry: for a long documentation page whose list would not fit. The rail
and the bar show every entry.

## On a phone

Below `md` (44rem) the sheet view's list opens as a bottom sheet: the
screen's width up to 44rem, the top corners rounded, over a veil, clear of the
safe area, the rows the phone ladder's and at least the touch target under a
finger. Opening it focuses the current entry; Escape, the veil or a chosen
section closes it. For an article read from the top, put a `column` with
`sticky="false"` once at the top of the text instead (and the rail beside the
text on a wide screen).

## Settings

- `layout="auto|column|sheet|rail|bar"` (`compact` is a dated alias of `sheet`)
- `collapse="sm|md|lg|xl"` — the step of `auto`
- `target` — a selector of the content whose headings are collected
- `levels` — `2-3`, `2`, `2,3`
- `items` — a list, property or JSON island
- `size="1/2|1"` — the ladder rung of the text and of the sheet's button;
  `1/2` by default
- `sticky` — every layout stays in view while the page scrolls: the column, the rail, the bar and the sheet's button; on by default
- `hash="choose|scroll|false"` — when the address shows the current
  section: on a chosen section (default), also while scrolling, or never.
  Before 1.5.0 it was a boolean and on meant scroll; `true` now reads as
  `choose`
- `overflow="more|scroll"` — the bar: sections that do not fit go whole into a
  trailing «Ещё (n)» menu, the current one staying in the row (default, as
  sf-tabs); `scroll` lets the row scroll sideways
- `line="own|edge|none"` — who draws the line: the element (default), the
  host's divider, nobody
- `expand="all|current"` — every level (default) or only the current branch's
- `heading-level` — the outline level of the heading (2 by default)
- `label` — the heading and the navigation's name; «На этой странице» /
  «On this page» in the page language when not set

## Actions

- `refresh()` — collects the headings again, for content that changed after
  the contents drew.
- `toggle()` — opens or closes the sheet view's list, and shows or hides
  the rail's names; refused in the column and the bar.

## Fewer than two sections

With none or one section nothing is drawn: a contents of one entry says
nothing the page does not. The host carries `data-empty`, so a column that
holds only the contents can hide itself with
`aside:has(> sf-contents[data-empty])`. The printed markup is hidden by the
sheet as well, before the script counts.

## Accessibility

The element draws a `<nav>` named by its heading (`aria-labelledby`): a
navigation landmark. The heading is `role="heading"` at `heading-level`, so in
the column it is in a screen reader's list of headings; in the other layouts
it is not shown and still names the navigation. Do not
wrap it in a second `<nav>`. Tab reaches each link. In the sheet view the
button says «label: section» and `aria-expanded`; Enter or Space opens the
list, Escape closes it and gives focus back to the button, a press outside or
a chosen section closes it. In the rail view the names are hidden until hover
or focus but stay the links' names; on a screen without hover the first tap on
a stroke shows them and a tap on a name goes there. In the bar, «Ещё (n)»
comes after the row in Tab order and opens a menu of the sections it holds. The progress line is decoration.

## Public CSS variables

| Variable | What it changes | Default |
| --- | --- | --- |
| `--sf-contents-color` | the links' ink | `--sf-on-surface-variant` |
| `--sf-contents-current-color` | the current section's bar, stroke or underline, and the progress (not its text) | `--sf-primary` |
| `--sf-contents-line-color` | the column's line, the bar's edge, the progress track | `--sf-outline-variant` |
| `--sf-contents-background-color` | the bar's fill, the sticky sheet button's band and the sheet view's open list | `--sf-surface-page` / `--sf-surface-popup` |
| `--sf-contents-indent` | the step of a deeper level | the list's inset (H4, C109): 12 at size 1/2; 16 at size 1, 12 compact and on a phone |
| `--sf-contents-inset-inline` | the text's distance from the line (heading and links) | the size's value inset: 1/2 `max(--sf-space-1/2, --sf-b2)`, 1 `--sf-space-1` |
| `--sf-contents-gap` | the space between the links | `0` (column), `--sf-space-1/2` (rail), `--sf-space-1/4` (bar) |
| `--sf-contents-inset-block-start` | where the sticky column, rail, bar or sheet button stops | `--sf-space-1` |
| `--sf-contents-z-index` | the bar and the open list above the page | `--sf-z-index-5` |

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:
`sf-connected`, `sf-before-render`, `sf-after-render`, `sf-updated`,
`sf-disconnected`.
