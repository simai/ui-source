# Progress Bar Smart Component

`sf-progress-bar` shows continuous determinate progress from 0 to 100. Use
Spinner when the current value is unknown and Progress Scale only when the
segmented presentation has product meaning.

The component owns normalized value, `progressbar` semantics and optional
visible percentage. The author must provide a localized `label`. The application
owns the task, `aria-busy` on the affected region, completion, error, retry and
cancellation.

## Attributes

- `label` — required accessible name for the process.
- `value="0..100"` — exact current value; values are clamped.
- `value-text` — optional human-readable value such as “3 of 5 files”.
- `size="1/3|1/2|1|2|3"`.
- `text-position="none|inline-end|bottom"`; `right` is a physical legacy alias.
- `tone="primary|success|warning|error"` — a process state supplied by the
  application, never inferred from the percentage.

The component is not interactive, does not receive focus and does not create an
assertive live region. Shared `root-class` and `root-style` settings apply only
presentation through Framework utilities and semantic tokens.

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
