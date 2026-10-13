# sf-close

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart wrapper for the decorative base `close` glyph. `sf-close` is not an
interactive control and renders with `aria-hidden="true"`. Compose it inside a
native Icon Button; the button owns the accessible name, focus and dismiss
effect.

Tag:

- `sf-close`

Main attributes:

- `size`
- `root-class`

Supported sizes are `1/4`, `1/3`, `1/2`, `1`, `2`, `3`, `4`, `5`, `6` and
`7`. Invalid values fall back to `1/3`. Interactive Icon Button composition
supports `1/3`, `1/2`, `1`, `2` and `3`.

Example:

```html
<button
  type="button"
  class="sf-icon-button sf-icon-button--close sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1 flex items-cross-center"
  aria-label="Close notification"
>
  <sf-close size="1"></sf-close>
</button>
```
