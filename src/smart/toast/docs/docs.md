# sf-toast

Smart Toast projects the ordinary transient-feedback contract through a custom
element. It owns rendering, optional lifetime and removal of its host; the
application still owns stack placement and business effects.

```html
<sf-toast
  type="success"
  icon="check_circle"
  title="Saved"
  supporting-text="Your changes are available."
  role="status"
  action-text="Undo"
  action="undo"
  close-label="Close message"
></sf-toast>
```

`duration` is milliseconds. Its default `0` keeps the toast until explicit
dismissal; a positive value pauses while pointer or focus is inside the toast.
Keep messages with essential content or actions persistent.

The default template transfers shared `root-class`, `style` and `root-style`
settings to the visual root. Methods: `close()`, `dismiss()`,
`setState(nextState)`, `onAction(handler)` and `onClose(handler)`. Events:
`sf-toast-action` and `sf-toast-close`.
