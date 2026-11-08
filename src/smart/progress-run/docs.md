# Run Progress Smart Component

`sf-progress-run` shows a long job as a person sees it: creating a site, an
update, a backup or a restore, an import, a publish, a package install. Its
steps with their states and times, a collapsible output pane, the result once
the job ended, and Cancel, Retry and Hide.

```html
<sf-progress-run label="Создание сайта demo.test" cancelable retryable hideable>
  <script type="application/json" data-sf-settings>
    {"steps": [
      {"id": "dns", "title": "Адрес", "state": "done", "duration": 1200},
      {"id": "files", "title": "Файлы сайта", "state": "running", "started": "2026-11-07T09:00:00Z"},
      {"id": "ssl", "title": "Сертификат", "state": "waiting"}
    ]}
  </script>
</sf-progress-run>
```

```js
const run = document.querySelector('sf-progress-run');
job.on('output', (text) => run.chunk({text}));
job.on('step', ({id, state, duration}) => run.step({id, state, duration}));
run.addEventListener('sf-progress-run-cancel', () => job.cancel());
run.addEventListener('sf-progress-run-retry', () => job.start());
```

**The host drives it.** The component polls nothing and does none of the
actions: the host sets the steps (or changes one with `step`), appends the
output (`chunk`), and answers `cancel`, `retry` and `close`. A drawer and a
confirmation around it (a change sheet) are the page's composition.

## Settings

- `label` — the job's name: the heading and the region's name.
- `steps` — `[{id, title, state, text?, started?, finished?, duration?}]`,
  a property or the JSON island a server prints. `state` is `waiting`,
  `running`, `done`, `failed` or `skipped` (anything else is `waiting`). The
  time of a step is `duration` in milliseconds, else `finished − started`
  (ISO 8601); a running step with `started` counts up each second. Written
  `m:ss`, `h:mm:ss` over an hour.
- `run-state` `auto|running|done|failed|cancelled` — `auto` (the default)
  works it out from the steps: failed when one failed, running while one
  runs, done when every step is done or skipped, else waiting. `cancelled`
  only comes from the host, after it stopped the job. The state drawn is the
  host state `data-state`.
- `result-text` — the result in words once the job ended: «Сайт создан», or
  the reason of a failure. Without it: «Готово», «Не удалось», «Отменено».
- `output` — the output so far, plain text (never markup); `output-open`
  opens the pane (a person toggles it; a page may open it on a failure);
  `output-label` names its toggle («Вывод»); `file-name` (`output.txt`) is
  what download saves.
- `cancelable`, `retryable`, `hideable` — show Cancel while the job runs,
  Retry after a failure or a cancel, Hide once it ended.
- `size` `1|1/2` — the rung of the ladder; 1/2 for a narrow drawer.

## Actions

- `chunk({text})` — appends to the output (the stream fact `chunk {id, text}`
  of vocabulary 1.1.5 §5.2, handed on by a rule). The object is the canonical
  form, so the fact can grow fields; a plain string, `chunk('text')`, is
  accepted as shorthand. The pane follows the newest
  line only while the reader is at its end; a reader who scrolled up keeps
  their place. The run keeps the last 500 000 characters, dropping whole
  lines from the start.
- `clear()` — empties the output.
- `step({id, state?, text?, started?, finished?, duration?})` — changes one
  step until the host sets the list again; refused `{reason: 'missing'}` for
  an unknown id.

## Events

- `sf-progress-run-cancel` — Cancel pressed; cancelable request.
- `sf-progress-run-retry` — Retry pressed.
- `sf-progress-run-close` `{reason: 'close'}` — Hide pressed; cancelable; the
  host removes the run or closes its drawer.
- `sf-progress-run-download` `{file-name}` — cancelable; not cancelled, the
  browser saves the output as plain text. A page that keeps the full log
  cancels it and serves its own file.
- `sf-progress-run-toggle` `{open}` — the output pane opened or closed.

Copy is `sf-button-copy` with the output as its target.

## Geometry

One rung S: a step's title is the rung's line, its text and time the rung
below's, the state icon the title's line (sf-steps' glyphs, the running one
turning), icon-to-text the rung's text-space-x. A one-line step is the rung's
control height (40 px at size 1 on a desktop); dividers give up their
hairline from the inset. The output is monospace in the rung below's type,
sixteen lines high at most, inset by the rung below's space-x. The buttons
are `sf-button` of the rung below.

## Public variables

`--sf-progress-run-background` (none by default),
`--sf-progress-run-divider-color`, `--sf-progress-run-output-background`,
`--sf-progress-run-output-color`, `--sf-progress-run-output-max-height`,
`--sf-progress-run-padding-inline` (0 by default: a drawer has its own
inset). The Framework never sets them.

## Accessibility

A region named by its label. The steps are an ordered list; each says its
state in words after its title, and the running one is `aria-current="step"`.
The result line is a status live region, so it is read when the job ends; the
steps are not read as they change. The output toggle has `aria-expanded` and
`aria-controls`; the output is a log (not live) a keyboard can scroll.
Nothing takes focus by itself.

## Changes

- 1.0.0 (2026-11-07) — the first version, for the Larena admin screens
  (Federation bus msg-993e1e39 item 6).
