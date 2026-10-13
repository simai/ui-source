# sf-reference-link

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart reference link built on top of the base `.sf-reference-link` component.
It preserves a native anchor when `href` is present, makes the complete surface
the pointer and focus boundary, and renders a non-focusable unavailable surface
when `disabled` is set. Use ordinary Link when no secondary reference is needed.

## Tag

- `sf-reference-link`

## Attributes

- `icon`
- `label`
- `text`
- `href`
- `target`
- `disabled`
- `aria-label`

`target="_blank"` must be intentional and disclosed in the label. The template
adds `rel="noopener noreferrer"`. The icon is decorative.

## Slots

- `label`
- `text`

## Example

```html
<sf-reference-link
  label="Getting Started"
  text="/guides/getting-started/"
  href="/guides/getting-started/"
></sf-reference-link>
```
