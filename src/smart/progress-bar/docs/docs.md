# Progress Bar Smart Component

`sf-progress-bar` shows continuous progress from 0 to 100, or work of a size
not known yet (`indeterminate`). Progress Scale is only for a segmented
presentation with product meaning.

The component owns normalized value, `progressbar` semantics and optional
visible percentage. The author must provide a localized `label`. The application
owns the task, `aria-busy` on the affected region, completion, error, retry and
cancellation.

## Attributes

- `label` — required accessible name for the process; without it the host's
  `aria-label` names the progress bar.
- `value="0..100"` — exact current value, a number; values are clamped.
- `value-text` — optional human-readable value such as “3 of 5 files”.
- `size="1/3|1/2|1|2|3"`.
- `text-position="none|inline-end|bottom"`; `right` is a physical legacy alias.
- `status="neutral|info|success|warning|error"` — a process state supplied by
  the application.
- `warning-at`, `error-at` (1.2.0) — thresholds in per cent, set by the page:
  from `warning-at` on the bar is a warning by itself, from `error-at` an
  error. A meter of a disk, a quota or licence seats turns its tone when it
  fills: `<sf-progress-bar label="Диск" value="83" warning-at="80" error-at="95">`
  is a warning. The bar draws the more serious of `status` and the threshold
  reached, and says which on the host as `data-status`. Without thresholds the
  bar never infers a tone from the percentage.
- `indeterminate` (1.3.0) — the work runs and its size is not known yet: a
  segment of the fill crosses the track, and the bar leaves out
  `aria-valuenow` and the percentage text. Take it off once the size is known:
  the same bar then fills from `value`, once, never back. Reduced motion stands
  the segment still. Class markup: `sf-progress-bar--indeterminate`.
- `paused` (1.3.0) — the work stopped and will go on. The bar is a warning
  (an error from `status` or a threshold stays an error) and a screen reader
  hears it: the value text reads «35 %, на паузе» / «35%, paused» unless the
  page gives `value-text`. Set it only where the work really stopped. An
  indeterminate bar that is paused stands still (1.3.1): its segment stops at
  the start of the track. Class markup: `sf-progress-bar--paused`.

The component is not interactive, does not receive focus and does not create an
assertive live region. Shared `root-class` and `root-style` settings apply only
presentation through Framework utilities and semantic tokens.

## Actions

- `chunk({done, total})` — shows a part of a job: `value` becomes `done` of
  `total` in per cent (`total` defaults to 100). It answers an outcome,
  `applied` or `refused`. A job reports its progress as the stream fact
  `chunk {id, done, total}` (vocabulary 1.1.5 §5.2); an assembly's rule hands
  it on: `{"on": "upload.chunk", "steps": [{"ask": "bar.chunk", "with": {"done": {"from": "done"}, "total": {"from": "total"}}}]}`.

Dated aliases until 2026-12-01 (`aliases.json`): the attribute `tone` is
`status`, `setProgress(n)` is `chunk(n)` (n of 100), and the reader
`getProgress()` retires: read `value`.

## Example

```html
<section aria-busy="true">
  <sf-progress-bar
    label="Загрузка файлов"
    value="40"
    value-text="2 из 5 файлов"
    text-position="inline-end"
  ></sf-progress-bar>
</section>
```
