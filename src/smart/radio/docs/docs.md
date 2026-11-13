# sf-radio

Smart Radio projects the ordinary `.sf-radio-button` over a native radio input.
Use it for one option in a visible group of mutually exclusive choices. Related
instances must share `name`; native form ownership also keeps identically named
groups in different forms independent.

## Tag

- `sf-radio`

## Attributes

- `size`
- `label`
- `description`
- `help` — the explanation: a «?» button (sf-help-mark) after the label opens
  it; a press on it never selects the option. The «?» stands 4 px (`--sf-space-1/4`)
  after the label's last word: when the label wraps, at the end of its last
  line, not of the first. The `help` slot takes an
  sf-help-mark of your own (links, a heading).
- `checked`
- `disabled`
- `name`
- `value`
- `error`

The default template applies the shared `root-class`, `style` and `root-style`
attributes to its label root. Use Framework utilities and semantic tokens for
customization; changing root styling preserves the native input and form state.
Sizes are closed to `1` and `2`. The `checked`, `disabled` and reset states are
native; reflected Smart attributes remain synchronized without synthetic change
events. Wrap the group in `fieldset` with a visible `legend`.

## Methods

- `getInputElement()`
- `isChecked()`
- `setChecked(value)`
- `setDisabled(value)`
- `onChange(handler)`

## Example

```html
<sf-radio
  name="group"
  value="one"
  label="Default"
  description="Description"
></sf-radio>
```
