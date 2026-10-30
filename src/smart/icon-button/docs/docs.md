# Smart Icon Button

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `icon-buttons` component.

For the `icon` variant, the base component owns `--sf-icon--color` on the
button root. Standard `.sf-icon` content keeps its existing semantic foreground;
custom decorative content can inherit `currentColor`, including its native
disabled state. An explicit color on the child remains a child override. This
does not change the separate Close glyph contract or introduce a font dependency
for CSS/SVG decorations.

Tag:

- `sf-icon-button`

Loading model:

- detected by `tags: ['sf-icon-button']` in `src/smart/icon-button/rule.js`
- loaded as smart bundle `cl-icon-button` (`cl-icon-buttons` is its dated alias
  until 2026-12-01, and `smart/icon-buttons/js/icon-buttons.js` a forwarding
  script that loads `smart/icon-button/js/icon-button.js`; change journal
  `path-smart-icon-buttons-to-icon-button`)
- base styles and base component JS are loaded through relation with `icon-buttons`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `kind="icon|close"`
- `size`
- `appearance="default|tonal|outline|link|surface|ghost"` — surface and ghost read the
  neutral alpha ramp rather than a colour of their own: surface keeps a faint
  fill and a border one step stronger, ghost keeps nothing until a pointer or the
  keyboard reaches it. The icon keeps the scheme colour, because a fill that
  faint cannot carry one. Both are right in a light and in a dark theme without
  being redeclared.
- `scheme="primary|secondary|on-surface|on-surface-variant"` — which colour
  family the control takes. `on-surface-variant` is `on-surface` one step
  quieter: the same fill and edge, the glyph in `--sf-on-surface-variant`.
  That is what a quiet trigger wants — beside a field, in a panel's head,
  next to a row — and `sf-button` says it the same way. A filled
  (`appearance="default"`) control keeps the inverse glyph of `on-surface`:
  on a dark fill there is no quieter step.
- `status="error"` — what the control is about. The destructive one, for a
  control that deletes, discards or cannot be undone: it paints with the error
  family's twin of every primary role, so it behaves exactly like a primary
  control and only its colour says what it does. A status wins over the scheme,
  because the two cannot both colour the control.
- `icon`
- `spacing="compact|normal|comfortable|spacious"`
- `radius="default|square|rounded"`
- `root-class`
- `loading` — the spinner in place of the icon, at its size; `aria-busy` and
  native `disabled`
- `disabled`
- `native-type`
- `aria-label`
- `badge-count`, `badge-dot`, `badge-cap` (99), `badge-label` -- a count or a
  dot at the button's top end corner, sized by `size` (1/3 and 1/2: a dot
  only), the phrase joined to `aria-label`: «Уведомления, 3 непрочитанных».
  `0` hides it. See the Badges documentation, «Бейдж на якоре»
  (simai/ui-source#12).

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `variant` for `kind`, and `tightness="low|high|highest"` for
`spacing="compact|comfortable|spacious"`. The shim writes the new attribute and
notes each use in `SF.deprecations`.

- `button-attributes` — an object (a property) for an external project
  template; the built-in template does not read it.
  `element.setButtonAttributes(object)` writes it.

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

- `src/smart/icon-button/meta.mjs`
- `src/smart/icon-button/component.json` — the interface (standard 1.3.8)

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/icon-button/<template>/index.js`
- `/local/smart/templates/icon-button/<template>/index.css`

## Slot overrides

Supported light-DOM slot names:

- `icon`

Example:

```html
<sf-icon-button aria-label="Custom icon">
  <span slot="icon"><i class="sf-icon">favorite</i></span>
</sf-icon-button>
```

Close variant:

```html
<sf-icon-button
  variant="close"
  size="1/3"
  type="link"
  scheme="on-surface"
  aria-label="Close"
></sf-icon-button>
```

## Host attributes

Attributes the component does not own are copied to the native `<button>` it
renders, so an author's `aria-*` or `title` reach the real control.

A `data-*` is **moved, not copied** — the same rule as `<sf-button>`. It ends
up on the native button, which is the one element that has a box, paints, takes
focus, is clicked and is dragged:

```js
const toggle = menu.querySelector('[data-sf-admin-search-toggle]');  // the button
menu.querySelectorAll('[data-sf-admin-search-toggle]').length;       // 1
toggle.focus();                      // natively focusable
toggle.getBoundingClientRect();      // it has a box, so a drag can read one
toggle.closest('sf-icon-button');    // the host, when that is what you want
```

A Smart host lays out as `display: contents` and generates no box, so it is
never the match: a selector that answered the host would answer something that
cannot be measured, dragged or painted.

What the author wrote is readable from the host as
`element.dataAttributes` (`data-column-key` → `.columnKey`), and
`element.removeHostDataAttribute(name)` takes one off the host's record and the
control together.

`focus()` on the host goes to the native button inside, and `blur()` the same
way:

```js
const host = menu.querySelector('sf-icon-button');
host.focus();
menu.contains(document.activeElement);   // true
```
