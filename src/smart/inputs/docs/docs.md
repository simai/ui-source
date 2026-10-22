# Smart Input

Smart/runtime wrapper for the base `inputs` component.

Tag:

- `sf-input`

Loading model:

- detected by `tags: ['sf-input']` in `src/smart/inputs/rule.js`
- loaded as smart bundle `cl-inputs`
- base styles and base component JS are loaded through relation with `inputs`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `size`
- `type`
- `label`
- `required`
- `placeholder`
- `input-type` — `text`, `email`, `password`, `search`, `tel` or `url`
- `autocomplete`
- `inputmode`
- `minlength`
- `maxlength`
- `pattern`
- `hint`
- `value`
- `default-value`
- `name`
- `icon-start`
- `text-end`
- `hint-icon`
- `root-class`
- `root-style`
- `disabled`
- `error`
- `invalid`
- `error-message`
- `mask`
- `mask-pattern`
- `mask-lazy`
- `mask-placeholder-char`
- `mask-options`

For older SF5 templates, `left-icon` and `right-text` remain compatibility
aliases.

Runtime helpers:

- `element.value`
- `element.state`
- `element.setState({...})`
- `element.getInputElement()`
- `element.onInput(handler)`
- `element.onChange(handler)`
- `element.onKeyUp(handler)`
- `element.onKeyDown(handler)`
- `element.onFocus(handler)`
- `element.onBlur(handler)`

## A field whose label is drawn outside it

`label` draws the label above the control and names it through the wrapping
`<label>`. Where the label is drawn outside the component -- a record panel
prints it beside the field -- leave `label` unset and pass `aria-label`: the
name lands on the native input, which is what assistive technology reads, and
the label is not printed twice. On the host alone it named nothing, because the
host is not the control. With a visible label present `aria-label` is ignored,
so the name cannot say one thing while the page says another.

## Native input contract

The native `input` remains the owner of editing, focus, validation, form value,
autocomplete and reset. `input-type` selects a bounded one-line text type;
`autocomplete`, `inputmode`, `minlength`, `maxlength` and `pattern` are projected
to that native control. Use `sf-textarea`, Quantity, Select or date components
for different value semantics instead of making Input imitate them.

`size` is limited to `1/3`, `1/2`, `1`, `2` and `3`. Visible presentation is
`bordered` or `filled`. `hidden` is preserved for compatibility but is not a
visible control and should not replace a native hidden field in new markup.

## Value and native form reset

`element.value` reads the native field's current value, including user edits.
Assigning it synchronizes the native input and active mask immediately; it does
not dispatch a synthetic input/change event. `default-value` specifies the native
reset baseline independently of `value`; an explicitly empty default is valid.
Without `default-value`, the configured `value` supplies the reset baseline.
With only `default-value`, the field starts uncontrolled from that value.
Native form reset restores the baseline and reconciles any active mask without
emitting input/change; a cancelled reset has no effect. Updating an unrelated
hint preserves the current edit and does not redefine the reset baseline.

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Base Input supplies readable secondary label/hint roles. Bordered placeholder
uses on-surface-variant; filled placeholder uses on-surface to remain readable
on its interactive tonal surface. Explicit disabled overrides are separate.

The default visible and hidden input roots consume the shared rootStyle context;
the visible root also consumes rootClass. Author CSSOM token edits and root-style
updates therefore reach the actual root without styling the boxless host twice.

Supported through `SfBaseElement` with:

- `/local/smart/templates/input/<template>/index.js`
- `/local/smart/templates/input/<template>/index.css`

## Slot overrides

Supported light-DOM slot names:

- `label`
- `left`
- `right`
- `hint`
- `error`

Example:

```html
<sf-input label="Email">
  <span slot="left"><i class="sf-icon">mail</i></span>
  <span slot="hint">Custom hint text</span>
</sf-input>
```

`error` remains a backward-compatible visual alias. New integrations should
use `invalid` with `error-message`; the native input then receives
`required`, `aria-invalid`, `aria-describedby`, and `aria-errormessage` as
applicable.
