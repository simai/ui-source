# Progress Ring Smart Component

`sf-progress-ring` shows a value from 0 to 100 as a ring in the room of a
control: in a toolbar, in a rail, around an avatar. With `indeterminate` it
shows that work goes on while the value is unknown. Use sf-progress-bar for a
long task in the body of a page, and sf-spinner where nothing but «busy» is
said.

The component owns the clamped value, the `progressbar` (or `meter`)
semantics and the optional percentage in the middle. The page provides a
localized `label` and owns the task, its completion, error, retry and
cancellation, and the status: thresholds such as «warning from 80 %» are the
page's, which passes `status`.

## Attributes

- `label` — the accessible name; without it the host's `aria-label` names the
  ring.
- `value="0..100"` — the value in per cent, a number; values are clamped.
- `value-text` — the value as people say it, such as «3 из 5 файлов».
- `status="|neutral|info|success|warning|error"` — the colour of the filled
  part, the same words and role tokens as sf-progress-bar (1.4.0, owner decision C131) — empty, the default, draws the theme's
  primary; `neutral` is grey, as in sf-dot and sf-badge; the others their
  roles. `primary`, the word used before, is read as the default.
- `warning-at`, `error-at` (1.2.0) — thresholds in per cent, set by the page:
  the ring draws the more serious of `status` and the threshold reached, and
  says which on the host as `data-status`. Without them the ring never infers
  a colour from the value.
- `size="1/4|1/3|1/2|1|2|3"` (1.2.0) — the avatar's ladder: at every step the
  ring is the box of an sf-avatar of the same size, 16 / 24 / 32 / 40 / 48 /
  56 px on a wide screen, 16 / 20 / 28 / 36 / 44 / 52 on a phone, 16 / 20 /
  24 / 32 / 40 / 48 in a compact region (1.3.0: 1/4 is 16 on every screen, as
  sf-avatar 1/4, owner decision C132); so a ring can stand where an avatar of
  its step stands. 3 is
  also the circle of a page's empty state, where sf-empty-state
  `kind="processing"` with a `value` draws it. The line is 2 px at every
  size.
- `indeterminate` — the value is unknown: the spinner's arc goes round the
  ring and no value is said.
- `meter` — the ring shows an amount within a known range (a quota used), not
  a task's progress: role `meter`.
- `show-text` — the percentage in the middle, 12 / 14 / 16 px at 1 / 2 / 3.
  Below size 1 no percentage is shown: the box leaves letters below the text
  ladder. The
  value stays the ring's `aria-valuenow`, so a screen reader still says it.

The ring carries the role and the value; what stands in the middle is beside
it, so a picture keeps its own name. It is not interactive and never takes the
focus. A ring inside a button is named by the button: give the button a name
that says the value too.

## The middle

The slot `content` takes the place of the percentage. Its box is the ring's
box less the line and a gap on every side, 2 px each, so a picture never
touches the line: an sf-avatar a step smaller than the ring (`size="1/2"` in a
ring of 1, `size="1"` in a ring of 2) fills it exactly, and a slotted
sf-avatar is fitted to it at every size. A ring wraps the avatar one step
down from size 1/3 up on a wide screen (`size="1/4"`, 16 px, in a ring of 1/3,
24 px) and from 1/2 up on a phone and in a compact region, where a ring of 1/3
is 20 px and its middle 12, below the smallest avatar. Size 1/4 has no avatar
step below its 16 px: its middle is 8 px, so it holds neither an avatar nor the
percentage -- put a ring of 1/4 beside the avatar, not around it.

A slotted avatar's presence point (`status="online"` or `away`) stands on the
ring itself at 45 degrees, towards the bottom end corner, at the ring's own
step (owner decisions C132 (7), C152 (8)): 12 px with a 2 px cut-out on a
ring of 1, centred on the middle of the line.

```html
<button type="button" class="account" aria-label="Анна Ким, использовано 62 % лимита">
  <sf-progress-ring value="62" meter label="Использовано">
    <sf-avatar slot="content" size="1/2" text="АК"></sf-avatar>
  </sf-progress-ring>
</button>
```

## Actions

- `chunk({done, total})` — shows a part of a job: `value` becomes `done` of
  `total` in per cent (`total` defaults to 100), as on sf-progress-bar. It
  answers `applied` or `refused`.

## Look

Public variables: `--sf-progress-ring-size`, `--sf-progress-ring-line-width`
(2 px), `--sf-progress-ring-gap` (2 px), `--sf-progress-ring-fill-color`,
`--sf-progress-ring-track-color` (`--sf-surface-container`) and
`--sf-progress-ring-color` (the percentage). A bare `0` is a valid line or
gap. The fill moves between two values, and stands still under
`prefers-reduced-motion`, as the indeterminate arc does.

## Example

```html
<sf-progress-ring label="Загрузка файлов" value="40" show-text></sf-progress-ring>
<sf-progress-ring label="Подготовка" indeterminate></sf-progress-ring>
```
