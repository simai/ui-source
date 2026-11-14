# Smart Input

Smart/runtime wrapper for the base `inputs` component.

Tag:

- `sf-input`

Loading model:

- detected by `tags: ['sf-input']` in `src/smart/input/rule.js`
- loaded as smart bundle `cl-input` (`cl-inputs` is its dated Loader forward until 2026-12-01; the registry id `smart.inputs` is the dated alias of `smart.input`)
- base styles and base component JS are loaded through relation with `inputs`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `size` — the control ladder: `1/3`, `1/2`, `1`, `2`, `3`, the height of an
  sf-button of the same size
- `radius=""|default|square|rounded` — the field's corners; `rounded` is a
  pill, for a search field beside rounded buttons (1.6.0)
- `type`
- `label`
- `required`
- `placeholder`
- `input-type` — `text`, `email`, `password`, `search`, `tel`, `url` or
  `number`
- `min`, `max`, `step` — the range and step of a number field
- `autocomplete`
- `inputmode`
- `minlength`
- `maxlength`
- `pattern`
- `hint`
- `value`
- `inherited-value`, `inherited-text`, `reset-label` — see «Inherited value»
- `default-value`
- `name`
- `icon-start`
- `text-end`
- `shortcut` — a key combination drawn at the end of the field as kbd keys
  (`mod+k` reads ⌘K on a Mac, Ctrl K elsewhere) and written as
  `aria-keyshortcuts` on the native input; the keys take the text step one
  below the value's (decision C38). A hint only: the field does not listen to
  it -- a page that focuses the field on the combination listens itself
- `hint-icon`
- `root-class`
- `root-style`
- `clearable` — a clear (×) at the field's end while it holds a value (1.9.0); a
  search field has it without the setting
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

## Inherited value

`inherited-value` is what the field falls back to while it holds nothing of its
own -- a default that comes from a parent setting, a brand or a theme. The
empty field shows it as its placeholder, in the placeholder's ink, with a small
«наследуется» marker at its end, and the form value stays empty: «not set» and
«set to the same text» look different, and only the first follows the parent
when the parent changes. Once a value is typed the marker gives way to a reset
button in the same place.

```html
<sf-input name="unsubscribe" label="Unsubscribe link" inherited-value="https://brand.example/unsubscribe"></sf-input>
```

A number is sf-input with `inputmode="numeric"` or `"decimal"`, and takes it
the same way.

The reset is a native button named by `reset-label` («Сбросить к наследуемому»,
"Reset to inherited"); the marker's words are `inherited-text` («наследуется»,
"inherited"). Both follow the page's language when unset. Pressing the reset
fires `sf-field-reset` on the host -- bubbling, composed and **cancellable** --
before anything changes:

```js
field.addEventListener('sf-field-reset', (event) => {
  const {value, inheritedValue, name} = event.detail; // value: the own value being dropped
  if (!confirm(`Return ${name} to ${inheritedValue}?`)) event.preventDefault();
});
```

Not prevented, the field empties, says so with its ordinary `input` and `change` (from the native input, as typing does), shows the
inherited value again and takes focus back on the control. `element.resetToInherited()`
does the same from code and returns whether it reset. While inherited, the
control carries the value as `aria-description` («Наследуется: …»); the visible
marker is hidden from assistive technology so it is not read twice. A browser
reads `aria-describedby` instead of `aria-description`, so when a hint, an error
or a description also describes the control, the same sentence is a hidden note
in the element (`[data-sf-inherited-note]`) that `aria-describedby` names after
them.

The state is shared by sf-input, sf-textarea, sf-dropdown, sf-color and
sf-switch (`src/smart/helpers/inherited-value.js`), so a field reads and resets
the same way whichever control it is. The marker and the reset are one step
down the size ladder and sit inside the field's box with the same gap above,
below and after them.

## Native input contract

The native `input` remains the owner of editing, focus, validation, form value,
autocomplete and reset. `input-type` selects a bounded one-line text type;
`autocomplete`, `inputmode`, `minlength`, `maxlength` and `pattern` are projected
to that native control. Use `sf-textarea`, Quantity, Select or date components
for different value semantics instead of making Input imitate them.

`input-type="number"` is the browser's own number field (1.5.0): `min`, `max`
and `step` go to the native input as they are given, and the browser's
validation is the field's -- a value below `min`, above `max` or off `step`
makes the field and its form invalid (`rangeUnderflow`, `rangeOverflow`,
`stepMismatch`), as `required` does when it is empty. The value stays a
string, the text the native input holds (`""` while it holds no number), and
the form submits that string under `name`. `inputmode="numeric"` or `decimal`
picks the phone keyboard. A field with a stepper and its own buttons is
Quantity (`sf-input-quantity`).

```html
<sf-input name="limit" label="Лимит" input-type="number" min="1" max="100" step="1" inputmode="numeric" value="10"></sf-input>
```

`size` is limited to `1/3`, `1/2`, `1`, `2` and `3` (the other fields keep
`1/2`, `1` and `2`). Visible presentation is
`bordered` or `filled`. `hidden` is preserved for compatibility but is not a
visible control and should not replace a native hidden field in new markup.
Bordered is the default on every place. Filled is for a search or filter field
over a table or a list, on the page, a card or a popup (C52): at rest it draws
a thin bottom line in `--sf-outline` under its 8 % fill (C41), and a state
that colours the border (hover, press) colours the line with it.

## Actions inside the field

Since 1.9.0 (owner decision C123) the actions inside the field are glyphs
without a plate, the field layer's `.sf-field-action` (component.inputs): quiet
(`--sf-on-surface-variant`) at rest, the text's ink under the pointer and on a
press, the keyboard ring round the glyph inside the field. The glyph is the
leading icon's size (24 / 20 / 28 at sizes 1, 1/2, 2 on a desktop), its end on
the field's inset; the hit area is invisible, the field's height and never under
24. From the text to the edge: the clear, then the action (the password reveal,
a copy button), then an indicator (a dropdown's chevron).

- `clearable` draws the clear, «Очистить» («Clear»), while the field holds a
  value and can be changed. A press empties the field with `input` and `change`
  and gives the focus back to it. `input-type="search"` has it without the
  setting, in place of the browser's own.
- `input-type="password"` draws the reveal: a toggle button «Показать пароль»
  («Show password») with `aria-pressed`; the eye, crossed out while the password
  shows. `form.reset()` hides the password again.
- An `sf-button-copy` placed in the field (the `end` slot or the class markup's
  `.sf-input-field`) draws the same glyph and shows its check after a copy.

Buttons outside fields (toolbars, table rows, window headers) keep their plates.

## Required: the error after a submit attempt

Since 1.8.0 a `required` field left empty shows its error once the form's
check fails (a submit attempt, `checkValidity()`, `reportValidity()`), as
`sf-dropdown` does: the error outline (on `appearance="filled"` the error
fill), «Заполните поле» («Fill in this field») under the field in the field-message type at the field's
gap, and `aria-invalid` / `aria-errormessage` on the control. The browser's
own bubble and its focus on the first invalid field stay as they are. Typing
that fills the field, or `form.reset()`, clears it. The page's `invalid` with
`error-message` wins over it.

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
uses on-surface-variant; the filled placeholder is the place's dim ink too
(on a strong coloured place, the place's full ink). Explicit disabled overrides are separate.

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
