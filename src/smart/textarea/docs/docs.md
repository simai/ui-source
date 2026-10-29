# Smart Textarea

`<sf-textarea>` is the declarative wrapper for the ordinary Textarea component.
It renders a native `<textarea>` and preserves native multiline editing, value,
validation, form submission and reset.

## Inputs

- `size`: `1/3`, `1/2`, `1`, `2` or `3`.
- `appearance` (legacy name `type`): `bordered`, `filled` or `flush`.
- `label`, `placeholder`, `hint`, `value`, `name` and positive `rows`.
- `autocomplete`, `inputmode`, `minlength`, `maxlength`, `spellcheck` and
  `wrap="soft|hard"` are projected to the native control.
- `required`, `readonly`, `disabled`, `invalid`, legacy `error` and
  `error-message` preserve native ownership and accessible relationships.
- `root-class` and `root-style` customize the component root without replacing
  its contract.
- `mask`, `mask-pattern` and `mask-options` enable the optional Mask adapter.
- `inherited-value`, `inherited-text` and `reset-label`: see «Inherited value».

## Auto-grow

`auto-grow` makes the field follow its text: it starts at `min-rows` (default
1), grows one line at a time and, past `max-rows`, stays at that height and
scrolls inside. With no `max-rows` it grows without a cap; a `max-rows` below
`min-rows` is read as `min-rows`. Deleting text shrinks it back. `rows` is not
used while `auto-grow` is on, and the field is not resizable by hand.

```html
<sf-textarea label="Comment" auto-grow min-rows="1" max-rows="6"></sf-textarea>
```

Heights stay on the size ladder: one row is exactly as tall as an `sf-input` or
`sf-button` of the same size, and each further row adds the text line height of
that size; the padding is the field's own. The browser does the sizing with CSS
`field-sizing: content` where it has it; elsewhere a script measures the text on
input, on a value set from code (`element.value`, `setState`), on form reset and
when the width changes. An IME composition is measured once, when it ends, and
the page does not scroll while the field is measured.

Enter stays a newline. Sending on Enter is a chat composer's own behaviour and is
not part of the textarea.

## Flush

`appearance="flush"` is the field inside a composite control -- a chat
composer, say -- whose own box draws the border, the fill, the shadow and the
focus:

```html
<form class="composer">
  <sf-textarea appearance="flush" auto-grow max-rows="8" aria-label="Message"></sf-textarea>
  <sf-button icon="send" text="Send"></sf-button>
</form>
```

```css
.composer:has(:focus-visible) { outline: var(--sf-focus--width) var(--sf-focus--style) var(--sf-focus--color); }
```

The field draws no border, no background, no box shadow, no radius, no inline
padding, no margin, no resize handle and no focus ring of its own, on hover,
press and keyboard focus alike. The composite has to show focus with
`:has(:focus-visible)`, because nothing else does; keep the field named with
`label` or `aria-label`. In forced colours the field keeps the system outline,
which a composite's box shadow would not replace.

Its text stays on the size ladder. The block padding is the bordered field's
padding plus its hairline (`--sf-ui-N--space-y-tightness-default`), so the text
stands where the text of an `sf-input` or `sf-button` of the same size stands,
and one row is exactly their height; each further row adds the size's line
height. Measured on the light theme at 1000px:

| size | one row (control height) | block padding | each further row |
| ---- | ------------------------ | ------------- | ---------------- |
| 1/2  | 32px                     | 6px           | 20px             |
| 1    | 40px                     | 8px           | 24px             |
| 2    | 48px                     | 10px          | 28px             |

With `auto-grow` and `max-rows="8"` a field of size 1 is 40px empty and
208px at eight rows, then scrolls inside. `min-rows`, `max-rows` and the
rest of auto-grow are unchanged.

The default resize policy is vertical. Framework utilities such as `resize-y`
and `resize-none` can be passed through `root-class` when a design has an
explicit reason to change it.

## Inherited value

`inherited-value` is what the field falls back to while it holds nothing of its
own. The empty textarea shows it as its placeholder, in the placeholder's ink,
with a «наследуется» marker in a row under the field, at its end; the form
value stays empty. Once text is typed, the marker gives way to a reset button
in the same place.

```html
<sf-textarea name="footer" label="Footer" inherited-value="Команда бренда"></sf-textarea>
```

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

Not prevented, the field empties, says so with its ordinary `input` and `change` (from the native textarea, as typing does), shows the
inherited value again and takes focus back on the control. `element.resetToInherited()`
does the same from code and returns whether it reset. While inherited, the
control carries the value as `aria-description` («Наследуется: …»); the visible
marker is hidden from assistive technology so it is not read twice.

The state is shared by sf-input, sf-textarea, sf-dropdown, sf-color and
sf-switch (`src/smart/helpers/inherited-value.js`), so a field reads and resets
the same way whichever control it is. The marker and the reset are one step
down the size ladder and sit inside the field's box with the same gap above,
below and after them.

## State and lifecycle

`element.value` reads current native text; assignment updates the visible
control. `element.state` reports current value, disabled and invalid state.
`setState()` updates the ordinary owner. Disconnect/re-render destroys and
rebinds field, reset and Mask hooks without duplicate listeners.

Use Smart Textarea for free text that may contain multiple lines. Use Input for
single-line values, and a specialized editor for rich text or code. Keep a
visible accessible label and a repair-oriented error message.
