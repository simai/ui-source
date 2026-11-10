# Run Progress Smart Component

`sf-progress-run` shows a long job as a person sees it: creating a site, an
update, a backup or a restore, an import, a publish, a package install. One
tag in three looks (`look`, owner decision C34):

- `full` (the default) — the card: the title with the state badge, the
  overall bar with «4 812 из 12 000 товаров · 40 %» and the time left, the
  counts as one line, the steps with their states, times and a log each, and
  Pause/Continue, Cancel and Minimize. Once the job ended the same card is the
  summary: the result, the counts, the first five errors, «Ещё N ошибок»,
  Retry and Hide.
- `compact` — one line for a table row: a thin bar and «62 % · 3 мин» while
  it runs, the state badge once it stopped, icon actions.
- `notice` — one row for a corner panel: the ring in the icon field, the
  name, a line of figures and Expand. The panel itself (where it stands,
  several runs in it) is the page's composition.

```html
<sf-progress-run label="Импорт товаров из «Прайс_ноябрь.xlsx»"
    caption="Каталог «Электроника» · запущено в 14:02"
    total="12000" value="4812" unit="товар|товара|товаров"
    pausable cancelable minimizable>
  <script type="application/json" data-sf-settings>
    {"counters": [
       {"id": "added", "label": "Добавлено", "value": 3700},
       {"id": "updated", "label": "Обновлено", "value": 1100},
       {"id": "errors", "label": "{n} ошибка|{n} ошибки|{n} ошибок", "value": 12, "status": "error"}],
     "steps": [
       {"id": "read", "title": "Чтение файла", "state": "done", "duration": 4000},
       {"id": "rows", "title": "Товары", "state": "running", "value": 4812, "total": 12000, "unit": "товар|товара|товаров"},
       {"id": "images", "title": "Картинки", "state": "waiting"}]}
  </script>
</sf-progress-run>
```

```js
const run = document.querySelector('sf-progress-run');
job.on('progress', ({done}) => { run.value = done; run.step({id: 'rows', value: done}); });
job.on('output', ({text, step}) => run.chunk({text, step}));
run.addEventListener('sf-progress-run-pause', () => job.pause().then(() => { run.runState = 'paused'; }));
run.addEventListener('sf-progress-run-resume', () => job.resume().then(() => { run.runState = 'running'; }));
run.addEventListener('sf-progress-run-cancel', () => job.cancel());
run.addEventListener('sf-progress-run-retry', ({detail}) => job.start(detail)); // {scope: 'all'|'failed', from?}
run.addEventListener('sf-progress-run-minimize', () => { run.look = 'notice'; });
run.addEventListener('sf-progress-run-expand', () => { run.look = 'full'; });
run.addEventListener('sf-progress-run-report', () => openReport());
```

**The host drives it.** The component polls nothing and does none of the
actions: the host sets the numbers and the steps (or changes one with
`step`), appends the output (`chunk`), and answers `pause`, `resume`,
`cancel`, `retry`, `minimize`, `expand`, `report` and `close`. A drawer and a
confirmation around it (a change sheet) are the page's composition.

## Settings

- `look` `full|compact|notice` — the look; the data are the same in all.
  (`view` and `started` are names the element runtime keeps for itself, so the
  settings are `look` and `started-at`.)
- `label` — the job's name: the title and the region's name.
- `heading-level` `1–6` (3) — the title's level in the page outline. The
  title is drawn at the run's text line, semibold, whatever the level (16/24
  on a desktop, 14/20 on a phone and in compact density): a component title,
  not a page heading. Words wrap at spaces only, so a file name moves to the
  next line whole.
- `caption` — a line under the title: where and when.
- `value`, `total`, `unit` — how much is done of how much, and the word:
  `unit` holds the plural forms separated by `|` in the order of the page
  language's plural categories (`товар|товара|товаров`, `item|items`). The
  percentage is floored, so it reads 100 % only at the end. Without `total`
  the bar runs (indeterminate) and shows the elapsed time; once `total` is set
  the same bar fills, once.
- `remaining` — the time left in milliseconds when the host knows it. Without
  it the run works it out from the rate of `value` over the last 30 s, hidden
  («оцениваем время…») until the rate settles (5 s of change) and always
  rounded up: «осталось ≈ 6 мин», «осталось меньше минуты». After a pause the
  estimate starts afresh.
- `started-at`, `finished-at` — ISO 8601: the elapsed time and «заняло 8:08». Without
  them the run uses the moments it saw.
- `steps` — `[{id, title, state, text?, value?, total?, unit?, log?, started?,
  finished?, duration?}]`, a property or the JSON island a server prints.
  `state` is `waiting`, `running`, `done`, `failed` or `skipped` (anything
  else is `waiting`). A step's `value`/`total` are its own figures («18 240
  из 42 600 файлов»). `log` is the step's log so far. The time of a step is
  `duration` in milliseconds, else `finished − started`; a running step with
  `started` counts up each second. Written `m:ss`, `h:mm:ss` over an hour.
- `run-state` `auto|running|paused|done|partial|failed|cancelled` — `auto`
  (the default) works it out from the steps: failed when one failed, running
  while one runs, done when every step is done or skipped — partial when
  `errors-total` or an error counter is above 0 — else waiting (drawn as
  queued). `paused`, `cancelled` and the others come from the host. The state
  drawn is the host state `data-state`.
- `result-text` — the result in words once the job ended. Without it:
  «Готово», «Готово с ошибками», «Не удалось», «Отменено».
- `counters` — `[{id, label, value, status?, zero?}]`: the counts as one line
  of text in tabular figures, «Добавлено 9 227 · Обновлено 2 755 · 18 ошибок».
  The label is followed by the value, or holds `{n}` where the number stands,
  with plural forms separated by `|`. A counter at 0 is left out; a `status:
  "error"` counter at 0 shows its `zero` words («ошибок нет») in the quiet
  colour once the job ended. Only a non-zero error count is coloured, and it
  is a link that sends `report`.
- `errors` — `[{where?, key?, text}]`, the first errors; the summary shows
  five. `errors-total` says how many there are; «Ещё N ошибок» sends `report`.
- `output` — the output so far, plain text (never markup); `output-open`
  opens the pane (a person toggles it; a page may open it on a failure);
  `output-label` names its toggle («Вывод»); `file-name` (`output.txt`) is
  what download saves.
- `pausable` — shows Pause while the job runs and Continue while it is
  paused. Only where the host can really pause the job.
- `cancelable`, `retryable`, `hideable`, `minimizable` — show Cancel while
  the job runs or is paused, Retry after a failure, a cancel or a partial
  result, Hide once it ended, Minimize in the full look.
- `size` `1|1/2` — the rung of the ladder; 1/2 for a narrow drawer.

## States

One look per state in every `look` (decision C34):

| State | Badge (sf-badge) | Bar (sf-progress-bar) |
| --- | --- | --- |
| waiting | `activity="queued"` «В очереди», neutral | neutral |
| running | `activity="running"` «Идёт», spinner | neutral; indeterminate without `total` |
| paused | `activity="paused"` «Пауза», warning | warning, `paused` (said to a screen reader) |
| done | `activity="done"`, success | success |
| partial | `status="warning"`, warning icon, «С ошибками» — never success | warning |
| failed | `activity="failed"`, error | error |
| cancelled | `activity="stopped"` «Отменено», neutral | neutral (no grey status exists) |

## Actions

- `chunk({text, step?})` — appends to the output, or with `step` to that
  step's own log (the step's row becomes its toggle; a failed step's log is
  open by itself). The stream fact `chunk {id, text}` of vocabulary 1.1.5
  §5.2, handed on by a rule; a plain string, `chunk('text')`, is accepted as
  shorthand. The pane follows the newest line only while the reader is at its
  end. The run keeps the last 500 000 characters, dropping whole lines from
  the start. Refused `{reason: 'invalid'}` for no text, `{reason: 'missing'}`
  for an unknown step.
- `clear()` — empties the output and the step logs.
- `step({id, state?, text?, value?, total?, started?, finished?, duration?})` —
  changes one step until the host sets the list again; refused `{reason:
  'missing'}` for an unknown id.

## Events

- `sf-progress-run-pause`, `sf-progress-run-resume` — Pause or Continue
  pressed; requests: the host sets `run-state`.
- `sf-progress-run-cancel` — Cancel pressed; cancelable request.
- `sf-progress-run-retry` `{scope: 'all'|'failed', from?}` — Retry pressed:
  `failed` after a partial result, `all` (from the failed step's id) after a
  failure or a cancel.
- `sf-progress-run-minimize`, `sf-progress-run-expand` — Minimize in the full
  look, Expand in the notice look; the host changes `look`.
- `sf-progress-run-report` — the error link or «Ещё N ошибок»; cancelable:
  not cancelled, the link moves to the error list.
- `sf-progress-run-close` `{reason: 'close'}` — Hide pressed; cancelable; the
  host removes the run or closes its drawer.
- `sf-progress-run-download` `{file-name}` — cancelable; not cancelled, the
  browser saves the output as plain text.
- `sf-progress-run-toggle` `{open}` — the output pane opened or closed.

Copy is `sf-button-copy` with the output as its target.

## Geometry

The full look is groups by meaning, spaced by the system (R073): the head
(title and caption touching, the badge on the first title line), the progress
(bar to figures `--sf-space-1/3`), the results (result to counts
`--sf-space-1/4`), the errors, the steps (a divider opens them when a group
stands above), the output and the actions; between groups `--sf-space-1` (16
on a desktop, 12 on a phone and in compact density).

One rung S: a step's title is the rung's line, its text and time the rung
below's, the state icon the title's line (sf-steps' glyphs, the running one
turning), icon-to-text the rung's text-space-x. A one-line step is the rung's
control height (40 px at size 1 on a desktop); dividers give up their
hairline from the inset. The output and a step's log are monospace in the
rung below's type, sixteen lines high at most. The buttons and badges are of
the rung below and follow density (C22): their size is the run's, not the
page's. The notice's mark is one icon field of the rung's line; its ring
stands in it with 2 px of air (20 on a desktop, 16 on a phone).

## Public variables

`--sf-progress-run-gap` (between groups, `--sf-space-1`),
`--sf-progress-run-gap-tight` (bar to figures, `--sf-space-1/3`),
`--sf-progress-run-background-color` (none by default),
`--sf-progress-run-divider-color`, `--sf-progress-run-output-background-color`,
`--sf-progress-run-output-color`, `--sf-progress-run-output-max-height`,
`--sf-progress-run-padding-inline` (0 by default: a drawer has its own
inset). The Framework never sets them.

## Accessibility

A region named by its label (a group in the compact and notice looks); the
title is a heading of `heading-level`. The steps are an ordered list; each
says its state in words after its title, and the running one is
`aria-current="step"`; a step with a log is a button with `aria-expanded`
and `aria-controls`. The result line is the one status live region: it says
the result when the job ends and the state changes (paused, going on) —
never each percent; the figures and the time are not live. The overall bar
is `sf-progress-bar` named by the label; indeterminate, it says no value;
paused, its value text says so. The error count is a link to the error list.
The output toggle has `aria-expanded` and `aria-controls`; the output is a
log (not live) a keyboard can scroll. Nothing takes focus by itself; when
the host answers a press by swapping the run's buttons (Pause for Continue,
Minimize for the notice's Expand), focus moves to the button that took the
pressed one's place, so the next key goes on from there.

## Changes

- 1.3.1 (2026-11-10) — focus stays on the run's buttons when it swaps them
  (Pause ↔ Continue, Minimize ↔ Expand); a run of unknown size with no count
  shows no bare «0»; the running examples start when the page loads; in
  compact density the result line is regular weight, only the title bold.
- 1.3.0 (2026-11-10) — decision C34: `look` full|compact|notice, `value` /
  `total` / `unit` on the run and on each step, the time left, `run-state`
  paused and partial, `counters`, `errors` and `errors-total`, `retry`
  `{scope, from?}`, `chunk({text, step})` and a step's `log`, `pausable`,
  `minimizable`, `heading-level`, `caption`, `started-at`/`finished-at`, grouped
  spacing with `--sf-progress-run-gap` and `--sf-progress-run-gap-tight`.
- 1.0.0 (2026-11-07) — the first version, for the Larena admin screens
  (Federation bus msg-993e1e39 item 6).
