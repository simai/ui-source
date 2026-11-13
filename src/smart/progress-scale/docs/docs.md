# Progress Scale Smart Component

`sf-progress-scale` shows determinate progress as ten segments. Use it for
coarse or staged progress where segmentation supports the scenario; use
Progress Bar for ordinary continuous completion and Spinner when the value is
unknown.

The exact value remains in visible text and `aria-valuenow`; only the visual
segments round down to a whole tenth (1.1.5), so the scale never shows more
than is done: 61 % lights 6 of 10, 9 % none, 100 % all ten. A low percentage is not an error and a
high percentage is not success.

## Attributes

- `label` — required accessible name for the process; without it the host's
  `aria-label` names the scale.
- `value="0..100"` — exact current value, a number; values are clamped.
- `value-text` — optional human-readable stage description.
- `size="1/3|1/2|1|2|3"` — the bar's thickness, 4 / 4 / 8 / 8 / 12 px; the ten
  segments stand 2 px apart, each rounded (1.2.0). A segment lights only once
  its tenth is reached: 61 % lights 6.
- `show-text="true|false"` — controls only the visible percentage.
- `status="|neutral|info|success|warning|error"` (1.4.0, owner decision C131) — empty, the default, draws the theme's
  primary; `neutral` is grey, as in sf-dot and sf-badge; the others their
  roles. `primary`, the word used before, is read as the default.
- `warning-at`, `error-at` (1.2.0) — thresholds in per cent, set by the page,
  as on sf-progress-bar: the scale draws the more serious of `status` and the
  threshold reached, and says which on the host as `data-status`.
- `meter` (1.2.0, provisional name) — an amount within a known range, not a
  task's progress: role `meter`.

The application owns `aria-busy`, task lifecycle, completion and error
messages. The component never receives focus. Shared `root-class` and
`root-style` remain presentation-only Framework escape hatches.

## Actions

- `chunk({done, total})` — shows a part of a job: `value` becomes `done` of
  `total` in per cent (`total` defaults to 100). It answers an outcome,
  `applied` or `refused`. A job reports its progress as the stream fact
  `chunk {id, done, total}` (vocabulary 1.1.5 §5.2); an assembly's rule hands
  it on: `{"on": "upload.chunk", "steps": [{"ask": "scale.chunk", "with": {"done": {"from": "done"}, "total": {"from": "total"}}}]}`.

Dated aliases until 2026-12-01 (`aliases.json`): the attribute `tone` is
`status`, `setProgress(n)` is `chunk(n)` (n of 100), and the reader
`getProgress()` retires: read `value`.

## Example

```html
<sf-progress-scale
  label="Подготовка проекта"
  value="45"
  value-text="Этап 5 из 10"
></sf-progress-scale>
```
