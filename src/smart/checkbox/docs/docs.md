# sf-checkbox

Smart checkbox built on top of the base `.sf-checkbox` component.

## Tag

- `sf-checkbox`

## Attributes

- `size`
- `label`
- `description`
- `help` — the explanation, a sentence (a single lowercase word such as
  `help="info"` gives a development warning): a «?» button (sf-help-mark) after the label opens
  it; a press on it never toggles the box. The «?» stands 4 px (`--sf-space-1/4`)
  after the label's last word: when the label wraps, at the end of its last
  line, not of the first. The `help` slot takes an
  sf-help-mark of your own (links, a heading).
- `position="start|end"` — `end` puts the box at the end of the row (the text
  column takes the rest).
- `controls` — a parent checkbox (owner decision C165 (2)): the ids of the
  checkboxes it stands for, space-separated. It computes its own state —
  checked when all are checked, indeterminate (`aria-checked="mixed"`) when
  some are, unchecked when none are — and follows them as they change. A press
  on it, from the keyboard too, checks them all, or unchecks them all when all
  were checked; each changed child sends `change` as a press would. A disabled
  child is counted in the state and left as it is: a press checks the ones that
  can change, or unchecks them when all of those were checked. The inner input carries `aria-controls`.
- `checked`
- `disabled`
- `indeterminate`
- `name`
- `value`
- `error`

The default template applies the shared `root-class`, `style` and `root-style`
attributes to its label root. Use Framework utilities and semantic tokens for
customization; changing root styling preserves the native input and form state.

## Methods

- `getInputElement()`
- `isChecked()`
- `setState({ checked, indeterminate, disabled })`
- `setChecked(value)`
- `setIndeterminate(value)`
- `setDisabled(value)`
- `onChange(handler)`

## State model

`sf-checkbox` is controlled through smart-component state. Use
`setState(...)`, `setChecked(...)`, `setIndeterminate(...)`, or
`setDisabled(...)` for programmatic changes.

The base `.sf-checkbox` DOM component still supports direct input updates
through `SF.Checkbox.setState(input, state)`. Smart `sf-checkbox` renders its
state icon through nested `sf-icon`, while the base DOM component updates the
standalone `.sf-icon` text content.

The base indicator styles also cover the nested Smart icon. Checked and mixed
non-error enabled states use the `on-primary` role on the primary box; state and size
styling must not depend on whether the icon has a Smart wrapper.

The native input remains the value, keyboard and form owner. `indeterminate`
is a mixed visual state for a checkbox that summarizes related choices; it is
not a third submitted value. `error` publishes `aria-invalid="true"`, and the
author must provide a specific visible explanation.

Use logical `position="start"` for normal forms. The retained `end` option is
for layouts that intentionally place the indicator after its label. Related
choices still need a host-owned `fieldset` and `legend`.

## Parent checkbox

```html
<sf-checkbox label="All notifications" controls="n-mail n-push n-sms"></sf-checkbox>
<sf-checkbox id="n-mail" label="Email"></sf-checkbox>
<sf-checkbox id="n-push" label="Push"></sf-checkbox>
<sf-checkbox id="n-sms" label="SMS"></sf-checkbox>
```

## Checkbox or switch

In a form saved by a button («Сохранить») a choice is a checkbox, never a
switch (owner decision C165 (4)). A switch is for a setting that acts at once.

## Example

```html
<sf-checkbox
  label="Default"
  description="Description"
  checked
></sf-checkbox>
```
