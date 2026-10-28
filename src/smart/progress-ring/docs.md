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
- `status="neutral|info|success|warning|error"` — the colour of the filled
  part, the same words and role tokens as sf-progress-bar; never inferred
  from the value.
- `size="1/2|1|2"` — the control ladder: the ring is the box of an
  sf-icon-button or sf-avatar of the same size (36 px at 1 on a narrow
  screen, 40 px on a wide one).
- `indeterminate` — the value is unknown: the spinner's arc goes round the
  ring and no value is said.
- `meter` — the ring shows an amount within a known range (a quota used), not
  a task's progress: role `meter`.
- `show-text` — the percentage in the middle.

The ring carries the role and the value; what stands in the middle is beside
it, so a picture keeps its own name. It is not interactive and never takes the
focus. A ring inside a button is named by the button: give the button a name
that says the value too.

## The middle

The slot `content` takes the place of the percentage. Its box is the ring's
box less the line and a gap on every side, 2 px each, so a picture never
touches the line: an sf-avatar a step smaller than the ring (`size="1/2"` in a
ring of 1, `size="1"` in a ring of 2) fills it exactly, and a slotted
sf-avatar is fitted to it at every size.

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
`--sf-progress-ring-track-color` (`--sf-outline-variant`) and
`--sf-progress-ring-color` (the percentage). A bare `0` is a valid line or
gap. The fill moves between two values, and stands still under
`prefers-reduced-motion`, as the indeterminate arc does.

## Example

```html
<sf-progress-ring label="Загрузка файлов" value="40" show-text></sf-progress-ring>
<sf-progress-ring label="Подготовка" indeterminate></sf-progress-ring>
```
