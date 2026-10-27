# Smart Button

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `buttons` component.

Tag:

- `sf-button`

Loading model:

- detected by `tags: ['sf-button']` in `src/smart/button/rule.js`
- loaded as smart bundle `cl-button` (`cl-buttons` is its dated alias until
  2026-12-01, and `smart/buttons/js/buttons.js` a forwarding script that loads
  `smart/button/js/button.js`; change journal `path-smart-buttons-to-button`)
- base styles and base component JS are loaded through relation with `buttons`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching
- `loading` publishes `aria-busy="true"`, disables the native button against
  duplicate activation and shows the spinner at the icon's size: in place of
  the start icon (else the end icon; an icon-only button's icon); without an
  icon it lies over the label, which keeps its place, so the width does not
  change and the label stays the accessible name. Reduced motion: a still arc

Main attributes:

- `template`
- `size`
- `appearance="default|tonal|outline|link|surface|ghost"` — surface reads the
  neutral alpha ramp rather than a colour of its own: a faint fill and a border
  one step stronger, right in a light and in a dark theme without being
  redeclared. `ghost` is the link appearance under its old name, a dated alias.
- `scheme="primary|secondary|on-surface"` — which colour family the control
  takes.
- `status="error"` — what the control is about. The destructive one, for a
  control that deletes, discards or cannot be undone: it paints with the error
  family's twin of every primary role, so it behaves exactly like a primary
  control and only its colour says what it does. A status wins over the scheme,
  because the two cannot both colour the control.
- `text`
- `icon`
- `icon-start`
- `icon-end`
- `icon-position`
- `spacing="compact|normal|comfortable|spacious"`
- `radius="default|square|rounded"`
- `root-class`
- `loading`
- `disabled`
- `native-type`
- `expanded` — present, it writes `aria-expanded` on the native button
  (`expanded="false"` says closed); absent, nothing is said
- `aria-label` — a host attribute, passed to the native button

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `icon-left` and `icon-right` for `icon-start` and `icon-end`,
`tightness="low|high|highest"` for `spacing="compact|comfortable|spacious"`, and
the values `ghost` (link), `danger` and `critical` (error), `left` and `right`
(icon-position start and end). The shim writes the new attribute and notes each
use in `SF.deprecations`.

## Events

- `sf-button-press` — a person pressed the native button: a click, Enter or
  Space. It is sent once per press, with an empty `detail`, and never while the
  button is disabled or loading. The native `click` still bubbles as before; in
  an assembly a rule hears the press as `<role>.press`.

The empty radius is the normal UI radius. `default` is retained as a legacy
surface-radius override but should not be used for ordinary controls; prefer
`square` or `rounded` only when the design explicitly requires them.

Runtime helpers:

- `element.value`
- `element.onClick(handler)`
- `element.onFocus(handler)`
- `element.onBlur(handler)`
- `element.onMouseEnter(handler)`
- `element.onMouseLeave(handler)`
- `element.focus(options)` — focus the native control inside the host
- `element.blur()`
- `element.dataAttributes` — the `data-*` the author wrote on the host
- `element.removeHostDataAttribute(name)`

Metadata:

- `src/smart/button/meta.mjs`
- `src/smart/button/component.json` — the interface (standard 1.3.8)

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/button/<template>/index.js`
- `/local/smart/templates/button/<template>/index.css`

## The label

Three ways to give the button its label, in this order:

1. a `text` slot (`<span slot="text">…</span>`);
2. the `text` attribute;
3. a text child — `<sf-button>Добавить</sf-button>`, and the same from code:

```js
const add = document.createElement('sf-button');
add.textContent = 'Добавить';     // the label, like on any element
add.dataset.add = 'block';        // stays on the host, see below
panel.append(add);
```

The child is taken into the button as its label when the button draws; it is
not left beside it. An unslotted child *element* is not a label — wrap it in
`slot="text"` or use the attribute.

## Host attributes

Attributes the component does not own are copied to the native `<button>` it
renders, so an author's `aria-*` or `title` reach the real control.

A `data-*` is **moved, not copied**: it ends up on the native button and the
host no longer has it. One element carries it, and it is the one that has a
box, paints, takes focus, is clicked and is dragged — so a `data-*` works as a
handle:

```js
const save = panel.querySelector('[data-action="save"]');   // the native button
panel.querySelectorAll('[data-action="save"]').length;      // 1
save.focus();                      // it is natively focusable
save.getBoundingClientRect();      // it has a box, so a drag can read one
save.closest('sf-button');         // the host, when that is what you want
```

Delegation reads it either way: `event.target.dataset.action` on the control,
or `event.target.closest('[data-action]')`.

A host is never the match, because a Smart host lays out as
`display: contents`: it generates no box at all, so a selector that answered
the host would answer something that cannot be measured, dragged or painted.
Leaving the attribute on the host as well was worse — then every `data-*` was
on two elements and a count came back doubled.

What the author wrote is still readable from the host, under its own name:

```js
const add = document.createElement('sf-button');
add.textContent = 'Добавить';
add.dataset.add = 'block';         // written on the host as data-add
panel.append(add);
// after the first render:
add.dataAttributes.add;            // 'block' — the host's record
add.dataset.add;                   // undefined — the attribute is on the button
add.querySelector('[data-add]');   // the native button that carries it
add.removeHostDataAttribute('data-add');   // off the record and off the button
```

`element.dataAttributes` reads like `dataset` (`data-add` → `.add`).
Removing a `data-*` from the control alone is undone on the next render,
because the host's record is what the control is given again —
`removeHostDataAttribute()` takes it off both.

Focus reaches the control from the host too. The host takes no focus itself, so
`focus()` on it goes to the native button inside:

```js
const host = panel.querySelector('sf-button');
host.focus();                             // focus lands on the native button
panel.contains(document.activeElement);   // true
```

`blur()` works the same way. Asked before the button has drawn, the focus is
applied on its first render — and skipped if something else took focus while it
waited.

The component's own attributes (the list above, plus `class`, `style`, `id` and
`slot`) are not copied: they are what the component reads.

## Slot overrides

Supported light-DOM slot names:

- `icon-start`
- `icon-end`
- `text`

The legacy slot names `icon-left` and `icon-right` remain compatible.

Example:

```html
<sf-button text="Save">
  <span slot="icon-start"><i class="sf-icon">cloud_upload</i></span>
</sf-button>
```
