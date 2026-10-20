# Smart Buttons

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `buttons` component.

Tag:

- `sf-button`

Loading model:

- detected by `tags: ['sf-button']` in `src/smart/buttons/rule.js`
- loaded as smart bundle `cl-buttons`
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
- `type="default|tonal|outline|link|surface|ghost"` — surface and ghost read the
  neutral alpha ramp rather than a colour of their own: surface keeps a faint
  fill and a border one step stronger, ghost keeps nothing until a pointer or the
  keyboard reaches it. Both are right in a light and in a dark theme without
  being redeclared.
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
- `aria-label`

For older SF5 templates, `icon-left`, `icon-right` and
`tightness="low|high|highest"` remain compatibility aliases.

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

Metadata:

- `src/smart/buttons/meta.mjs`

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/buttons/<template>/index.js`
- `/local/smart/templates/buttons/<template>/index.css`

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
