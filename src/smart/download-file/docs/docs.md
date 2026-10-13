# Download File Smart Component

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

`sf-download-file` is a smart wrapper over the base `download-file` component.
With `href` it renders a native anchor; without `href` it renders a button and
emits `sf-download-file:click` for an application-owned action. `disabled`
renders a disabled button and no live destination.

## Attributes

- `size="1/3|1/2|1|2|3"`
- `file-name`
- `file-size`
- `icon`
- `href`
- `download`
- `disabled`
- `target`
- `aria-label`

## Example

```html
<sf-download-file
  size="1"
  file-name="logo.svg"
  href="/assets/img/logo.svg"
  download
></sf-download-file>
```

If `file-size` is omitted, the base component will try to resolve it from `Content-Length`.
Pass the known size when possible so rendering has no discovery request.
