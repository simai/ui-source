# Progress Ring

`sf-progress-ring` draws a value from 0 to 100 as a ring in the room of a
control, with the percentage or a picture in the middle. It is CSS only: the
value is the public variable `--sf-progress-ring-value` on the root, so a page
that prints the classes fetches the sheet and no script. `sf-progress-ring`
(the Smart element) writes this markup and keeps the value, the role and the
name in step; a page that prints the class markup itself keeps them in step.

## Anatomy

```html
<div class="sf-progress-ring sf-progress-ring--size-2 sf-progress-ring--warning"
     style="--sf-progress-ring-value: 85">
  <span class="sf-progress-ring-indicator" role="meter" aria-label="Использовано"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="85"></span>
  <span class="sf-progress-ring-content" aria-hidden="true">85&nbsp;%</span>
</div>
```

- `.sf-progress-ring` is the box. `sf-progress-ring--size-1/4|1/3|1/2|1|2|3`
  puts it on the avatar's ladder (1.3.0, owner decision C131): the box is the
  sf-avatar box of the same size, 16 / 24 / 32 / 40 / 48 / 56 px on a wide
  screen, 16 / 20 / 28 / 36 / 44 / 52 on a phone, 16 / 20 / 24 / 32 / 40 / 48
  in a compact region (1.4.0: 1/4 is 16 on every screen, as sf-avatar 1/4,
  owner decision C132). Size 3 is also the circle of a page's empty state. The
  percentage is 14 / 16 px at 2 / 3 and is not shown up to size 1 (1.7.0, DEV
  look answer 2026-11-20): an aria-hidden percentage there is hidden; the value
  stays the ring's name (sf-progress-ring shows it as a tooltip). A value of
  four characters («100%») marked `sf-progress-ring-content--long` takes the
  next smaller text step at 2 and 3 (1.7.1); in a compact region on a wide
  screen it is not drawn at size 2 (a 32 px middle, 12 px the floor).
- `.sf-progress-ring-indicator` is the ring: the track and the filled part,
  one line 2 px wide inside the box. It carries `role="progressbar"` (a task)
  or `role="meter"` (an amount in a known range, such as a quota) and the
  value.
- `.sf-progress-ring-content` is the middle: the box less the line and a 2 px
  gap on every side. It holds the percentage (aria-hidden: the ring already
  says the value), written as the progress family writes it: the number, a
  no-break space and «%», «85 %» (owner decisions C203 (3), C219), or a picture. An `.sf-avatar` in it is fitted to it, so the
  gap between the picture and the line is 2 px at every size; an avatar a step
  smaller than the ring is that box already at sizes 1 and 2. A ring wraps the
  avatar one step down from size 1/3 up on a wide screen (an avatar of 1/4,
  16 px, in a ring of 1/3, 24 px) and from 1/2 up on a phone and in a compact
  region (a ring of 1/3 is 20 px there, its middle 12, below the smallest
  avatar). At 1/4 there is no avatar step below 16: the middle (8 px) holds
  neither an avatar nor the percentage, so a ring of 1/4 stands beside the
  avatar, not around it.

## Status

`sf-progress-ring--neutral` (grey, `--sf-on-surface-variant`), `--info`,
`--success`, `--warning` and `--error` colour the filled part with the role
tokens sf-progress-bar uses; without one it is `--sf-primary`. The track is
the family's one neutral fill, `--sf-surface-container`. The status is the page's: the ring never infers it from the
value.

## Indeterminate

`sf-progress-ring--indeterminate` turns the spinner's arc, 30% of the ring at
one turn a second, on the ring's track. Leave `aria-valuenow` out while the
value is unknown. Under `prefers-reduced-motion` no arc is drawn: the whole
ring is the track tinted with the fill at 32 % (interim, until the owner picks
the look), and the fill no longer moves between values.

## Variables

| Variable | What | Default |
|:---|:---|:---|
| `--sf-progress-ring-value` | the value, a number from 0 to 100, on the root | `0` |
| `--sf-progress-ring-size` | the box | `--sf-ui-<size>--control-height` |
| `--sf-progress-ring-line-width` | the line | `--sf-a2` (2 px) |
| `--sf-progress-ring-gap` | between the line and the middle | `--sf-a2` (2 px) |
| `--sf-progress-ring-fill-color` | the filled part | `--sf-primary`, or the status |
| `--sf-progress-ring-track-color` | the track | `--sf-surface-container` |
| `--sf-progress-ring-color` | the percentage | `--sf-on-surface` |

The lengths are read through registered lengths, so a bare `0` is valid.
`--sf-progress-ring--value`, the former name of the value (an internal double
dash), still draws when written on the root until 2027-01-01 (journal
`token-progress-ring-value-public`); write `--sf-progress-ring-value`.
