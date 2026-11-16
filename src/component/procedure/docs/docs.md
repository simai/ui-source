# Procedure

`.sf-procedure` is a numbered sequence of steps read from top to bottom, where
each step may hold rich content: paragraphs, lists, code. The number stands in
a round marker on the step's first line, and a line runs down from each marker
to the next. It is CSS only: the numbers are a CSS counter and the line a
pseudo-element.

The marker is the number marker of `sf-steps`: one step mark across SIMAI
Framework. It is the box of the body text line (24 px on a desktop, 20 px on a
phone and in compact density), an empty circle with a thin outline edge, and
the number at the small text size.

```html
<ol class="sf-procedure">
  <li class="sf-procedure-step sf-procedure-step--complete">
    <div class="sf-procedure-title">Install</div>
    <div class="sf-procedure-content"><p>Add the package.</p></div>
  </li>
  <li class="sf-procedure-step sf-procedure-step--current" aria-current="step">
    <div class="sf-procedure-title">Configure</div>
    <div class="sf-procedure-content">
      <p>Write the settings:</p>
      <pre><code data-lang="json">{"theme": "auto"}</code></pre>
    </div>
  </li>
  <li class="sf-procedure-step">
    <div class="sf-procedure-title">Publish</div>
    <div class="sf-procedure-content"><p>Build the site.</p></div>
  </li>
</ol>
```

## Anatomy

- `.sf-procedure` is the list, on a native `ol`. It drops the list's own
  markers and numbers its steps itself, from 1.
- `.sf-procedure-step` is one step, on a native `li`: the marker in the first
  column, the title and the content in the second. The marker has the size
  and look of the `sf-steps` number marker.
- `.sf-procedure-title` is the step's short title, centred on the marker. It
  is optional; without it the content's first line stands beside the marker.
- `.sf-procedure-content` holds the step's blocks in one column with the text
  gap between them; their own outer margins are taken off.

The number stands 12 before the title at every width and density, the
marker-to-label step of `sf-steps` (C234). The line ends where the next step
begins, so a step of any height keeps its markers joined. It stays the neutral
`--sf-outline-variant` between done steps too (C235): a procedure is text to
read, not a progress bar. `sf-procedure--list` drops the line, for a short
list.

## State

A procedure the reader goes through may say where they are:
`sf-procedure-step--complete` fills a done step's marker with the primary role
and draws a check in place of the number, and `sf-procedure-step--current`
fills the current one with its number and rings it 2 px through a 2 px gap --
the done and current marks of `sf-steps`. A step ahead keeps its number in the
explanation's ink. In forced colours a done step shows its number. Mark the current step
with `aria-current="step"` as well: the colour alone says nothing to a screen
reader. Without either class every marker is an empty circle.

`sf-steps` -- the indicator of where a person is in a process of screens -- is
another component; a procedure is reading content.

`content.steps` renders with it (`props.current` marks the steps before it
complete and it current; `props.layout`: `timeline` or `list`).

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-procedure-marker-background-color` | the marker's fill | `transparent` (an empty circle) |
| `--sf-procedure-marker-color` | the number of a step ahead | `--sf-on-surface-variant` |
| `--sf-procedure-line-color` | the line between markers | `--sf-outline-variant` |
| `--sf-procedure-line-width` | the line's width | `--sf-px` |
| `--sf-procedure-gap` | between the steps | `--sf-content--space-related` |
| `--sf-procedure-indent` | between the marker and the content | 12 at every width and density, as `sf-steps` (C234) |

In forced colours the markers' edges and the line are drawn in `CanvasText`.
