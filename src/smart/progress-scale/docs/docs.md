# Progress Scale Smart Component

`sf-progress-scale` shows determinate progress as ten segments. Use it for
coarse or staged progress where segmentation supports the scenario; use
Progress Bar for ordinary continuous completion and Spinner when the value is
unknown.

The exact value remains in visible text and `aria-valuenow`; only the visual
segments round upward to the nearest ten. A low percentage is not an error and a
high percentage is not success.

## Attributes

- `label` — required accessible name for the process.
- `value="0..100"` — exact current value; values are clamped.
- `value-text` — optional human-readable stage description.
- `size="1/3|1/2|1|2|3"`.
- `show-text="true|false"` — controls only the visible percentage.
- `tone="primary|success|warning|error"` — an explicit process state supplied
  by the application.

The application owns `aria-busy`, task lifecycle, completion and error
messages. The component never receives focus. Shared `root-class` and
`root-style` remain presentation-only Framework escape hatches.

## Example

```html
<sf-progress-scale
  label="Подготовка проекта"
  value="45"
  value-text="Этап 5 из 10"
></sf-progress-scale>
```
