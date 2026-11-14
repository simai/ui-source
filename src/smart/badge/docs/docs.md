# Smart Badge

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `badges` component. Badge is static metadata,
not a button or a filter chip, so it does not add keyboard or pointer behavior.

Tag:

- `sf-badge`

Loading model:

- detected by `tags: ['sf-badge']` in `src/smart/badge/rule.js`
- loaded as smart bundle `cl-badge` (`cl-badges` is its dated alias until
  2026-12-01, and `smart/badges/js/badges.js` a forwarding script that loads
  `smart/badge/js/badge.js`; change journal `path-smart-badges-to-badge`)
- base styles and base component JS are loaded through relation with `badges`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `size`
- `appearance`
- `scheme`
- `status`
- `activity`
- `icon-only`
- `line`
- `text`
- `icon`
- `icon-start`
- `icon-end`
- `icon-position`
- `aria-label`

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `icon-left` and `icon-right` for `icon-start` and `icon-end`, and
the values `danger` (status error), `left` and `right` (icon-position start
and end). The shim writes the new attribute and notes each use in
`SF.deprecations`. A status word written as `scheme` still reaches `status`.

Supported `appearance` values (owner decision C140: five jobs, five looks):

- `tonal` — the default: a status or a value in its colour, a quantity in grey
- `outline` — a mark beside a title (a version, a type)
- `main` — the attention count alone, with `status="error"`; with any other
  colour it draws `tonal`, and that spelling is noted in `SF.deprecations`
  until 2027-01-01 (journal `value-badge-appearance-main-to-tonal`)

Supported `scheme` values:

- `neutral`
- `primary`
- `secondary`
- `tertiary`
- `info`
- `success`
- `warning`
- `danger`
- `on-surface`

Supported `size` values:

- `1/3` — compact metadata using the `1/3` typography and UI-spacing tokens
- `1/2` — medium metadata using the `1/2` token profile
- `1` — standard metadata using the `1` token profile

The three heights are 24 · 28 · 32 on the desktop and on the phone (C140 (5):
a badge is a mark, it does not shrink with the phone ladder); the phone keeps
its text size 12 · 12 · 14. A compact region on the desktop draws 24 · 24 · 28.
The three computed sizes must remain increasing in every supported breakpoint.

## Variant contract

57 combinations are drawn (C140 (4)): `tonal` and `outline` in every colour —
`neutral`, `primary`, `secondary`, `tertiary`, `on-surface`, `info`,
`success`, `warning` and `error` (`danger` is its former name) — in all three
sizes, and `main` with `error` alone, the attention count. All colours are
resolved through theme-aware semantic tokens.

`tonal + on-surface` draws the grey tonal badge. Unknown type, scheme and size
values fall back to `tonal`, `neutral` and `1/3` respectively.

A mark beside a title is `outline + on-surface`:

```html
<sf-badge appearance="outline" scheme="on-surface" size="1/2" text="PHP 8.2"></sf-badge>
```

When no text or `text` slot is supplied, the text container is omitted. This
keeps icon-only badges at their designed width.

Icons created from `icon`, `icon-start` or `icon-end` are decorative and hidden
from assistive technology. Visible text is the default accessible content. For
an icon-only badge or a shortened count such as `99+`, provide a full
`aria-label`; the template projects it as `sr-only` text. With neither text nor
label the badge is decorative. The host owns any `aria-live` or `role="status"`
policy because only the application knows whether an update must be announced.

## Side room and height

Every badge of one size has one height and one side room, whatever its
appearance: the outline's border is drawn inside the size. By default the text
sits `--sf-space-1/2` from the edges at every size; `tight` takes the space
step under it, `--sf-space-1/3` (8 px, 4 in a compact region, 8 on the phone),
for dense places -- a table, a counter, a chip in a row:

```html
<sf-badge appearance="tonal" text="Черновик"></sf-badge>
<sf-badge appearance="tonal" text="Черновик" tight></sf-badge>
```

A badge whose text is one character and that draws no icon -- a single-figure
count -- carries `sf-badge--figure`, takes `--sf-space-1/4` at the sides and
stays round in either room. `icon-only` is unchanged.

## On the line of a text

`line="text"` sizes a badge by the text it stands beside, not by a badge size:
a count or a mark in a contents entry, a tab or a list row. Its height is that
text's line, its number the text's own size, no block padding; one figure is a
circle the line high, and it lies on the line with no offset. It inherits the
size and line height, so it follows the host's size and density by itself
(owner decision C95 point 6):

```html
<a href="#contacts">Контакты <sf-badge line="text" status="error" text="2"></sf-badge></a>
```

## Run state

`activity` says where a run stands. It is a second axis beside `status`, which
says how something went:

| `activity` | Mark                   | Colour role | Word (en)        |
| ---------- | ---------------------- | ----------- | ---------------- |
| `running`  | spinner                | neutral     | Running          |
| `waiting`  | icon `pending_actions` | warning     | Needs your input |
| `done`     | icon `check_circle`    | success     | Ready            |
| `stopped`  | icon `stop_circle`     | neutral     | Stopped          |
| `failed`   | icon `error`           | error       | Failed           |
| `paused`   | icon `pause_circle`    | warning     | Paused           |
| `queued`   | icon `schedule`        | neutral     | Queued           |

`paused` and `queued` (1.4.0, decision C34): a run that stopped and will go on
is a warning; a run in a queue is neutral. `waiting` is the warning «needs your
input», not a queue.

```html
<sf-badge activity="waiting"></sf-badge>
<sf-badge activity="running" appearance="tonal"></sf-badge>
<sf-badge activity="done" text="Published"></sf-badge>
```

- The word is in the page's language (`lang/`, runtime `activity-*`). `text` and
  the `text` slot override it; `icon` overrides the icon or the spinner.
- A set `activity` wins over `status` and `scheme` for the icon, the text and the
  colour. Both stay readable on the element for a host that still sets them.
- A state always has a shape: an empty `icon-start` or `icon-end` at the icon's
  place does not take the mark away.
- The badge is no live region and says nothing when the state changes. A host
  that wants an announcement uses its own polite region.
- Under `prefers-reduced-motion: reduce` the spinner stands still (its still
  frame, from the spinner sheet).

`icon-only` shows the icon alone, for a tight list row. The text stays as the
accessible name, the box closes to a square, and `appearance` keeps its own
meaning. It needs something to show: with no icon, spinner or icon slot the text
stays visible.

```html
<sf-badge activity="failed" icon-only></sf-badge>
```

The former boolean `compact` draws the same until 2027-01-01 and is noted in
`SF.deprecations`: the word compact means density only (`data-sf-density`,
owner decision C134).

## Slot overrides

Supported light-DOM slot names:

- `icon-start`
- `icon-end`
- `text`

The legacy slot names `icon-left` and `icon-right` remain compatible.

Example:

```html
<sf-badge appearance="main" status="error" text="99+">
  <span slot="icon-start"><i class="sf-icon">arrow_upward</i></span>
</sf-badge>
```

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/badge/<template>/index.js`
- `/local/smart/templates/badge/<template>/index.css`
