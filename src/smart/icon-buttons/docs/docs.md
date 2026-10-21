# Smart Icon Buttons

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

- detected by `tags: ['sf-icon-button']` in `src/smart/icon-buttons/rule.js`
- loaded as smart bundle `cl-icon-buttons`
- base styles and base component JS are loaded through relation with `icon-buttons`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `variant="icon|close"`
- `size`
- `type="default|tonal|outline|link|surface|ghost"` — surface and ghost read the
  neutral alpha ramp rather than a colour of their own: surface keeps a faint
  fill and a border one step stronger, ghost keeps nothing until a pointer or the
  keyboard reaches it. The icon keeps the scheme colour, because a fill that
  faint cannot carry one. Both are right in a light and in a dark theme without
  being redeclared.
- `scheme="primary|secondary|on-surface"` — which colour family the control
  takes.
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

For older SF5 templates, `tightness="low|high|highest"` remains a
compatibility alias.

Runtime helpers:

- `element.value`
- `element.onClick(handler)`
- `element.onFocus(handler)`
- `element.onBlur(handler)`
- `element.onMouseEnter(handler)`
- `element.onMouseLeave(handler)`
- `element.focus(options)` — focus the native control inside the host
- `element.blur()`

Metadata:

- `src/smart/icon-buttons/meta.mjs`

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/icon-buttons/<template>/index.js`
- `/local/smart/templates/icon-buttons/<template>/index.css`

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

`data-*` are the exception: **they stay on the host, and only there** — the
same rule as `<sf-button>`. A `data-*` names one element, so
`querySelector('[data-sf-admin-search-toggle]')` answers the
`<sf-icon-button>` host and `querySelectorAll('[data-action="close"]')` counts
it once. Delegation reads it with `event.target.closest('[data-action]')`,
which reaches the host from the native button inside it.

The host lays out as `display: contents` and takes no focus itself, so
`focus()` on it goes to the native button inside — the element a `data-*`
selector finds is the element to focus:

```js
const toggle = menu.querySelector('[data-sf-admin-search-toggle]');
toggle.focus();                          // focus lands on the native button
menu.contains(document.activeElement);   // true
```

`blur()` works the same way.
