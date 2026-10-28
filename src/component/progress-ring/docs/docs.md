# Progress Ring

`sf-progress-ring` draws a value from 0 to 100 as a ring in the room of a
control, with the percentage or a picture in the middle. It is CSS only: the
value is the custom property `--sf-progress-ring--value` on the root, so a page
that prints the classes fetches the sheet and no script. `sf-progress-ring`
(the Smart element) writes this markup and keeps the value, the role and the
name in step; a page that prints the class markup itself keeps them in step.

## Anatomy

```html
<div class="sf-progress-ring sf-progress-ring--size-1 sf-progress-ring--warning"
     style="--sf-progress-ring--value: 85">
  <span class="sf-progress-ring-indicator" role="meter" aria-label="Использовано"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="85"></span>
  <span class="sf-progress-ring-content" aria-hidden="true">85%</span>
</div>
```

- `.sf-progress-ring` is the box. `sf-progress-ring--size-1/2|1|2` puts it on
  the control ladder: the box is `--sf-ui-<size>--control-height`, the box of
  an icon button or an avatar of the same size.
- `.sf-progress-ring-indicator` is the ring: the track and the filled part,
  one line 2 px wide inside the box. It carries `role="progressbar"` (a task)
  or `role="meter"` (an amount in a known range, such as a quota) and the
  value.
- `.sf-progress-ring-content` is the middle: the box less the line and a 2 px
  gap on every side. It holds the percentage (aria-hidden: the ring already
  says the value) or a picture. An `.sf-avatar` in it is fitted to it, so the
  gap between the picture and the line is 2 px at every size; an avatar a step
  smaller than the ring is that box already at sizes 1 and 2.

## Status

`sf-progress-ring--info`, `--success`, `--warning` and `--error` colour the
filled part with the role tokens sf-progress-bar uses; without one it is
`--sf-primary`. The status is the page's: the ring never infers it from the
value.

## Indeterminate

`sf-progress-ring--indeterminate` turns the spinner's arc, 30% of the ring at
one turn a second, on the ring's track. Leave `aria-valuenow` out while the
value is unknown. Under `prefers-reduced-motion` the arc stands still and the
fill no longer moves between values.

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-progress-ring-size` | the box | `--sf-ui-<size>--control-height` |
| `--sf-progress-ring-line-width` | the line | `--sf-a2` (2 px) |
| `--sf-progress-ring-gap` | between the line and the middle | `--sf-a2` (2 px) |
| `--sf-progress-ring-fill-color` | the filled part | `--sf-primary`, or the status |
| `--sf-progress-ring-track-color` | the track | `--sf-outline-variant` |
| `--sf-progress-ring-color` | the percentage | `--sf-on-surface` |

The lengths are read through registered lengths, so a bare `0` is valid.
