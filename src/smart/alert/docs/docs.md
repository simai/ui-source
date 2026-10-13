# sf-alert

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart wrapper for the `alerts` component.

## Basic Usage

```html
<sf-alert
  type="warning"
  variant="default"
  title="Warning"
  supporting-text="Please review this section."
  action-text="Review"
  closable
></sf-alert>
```

## Attributes

- `type="clear|info|danger|warning|success"`
- `variant="default|outlined|flat"`
- `icon`
- `title`
- `supporting-text`
- `action-text`
- `action`
- `secondary-action-text`
- `secondary-action`
- `closable`
- `close-label` — accessible name of the close button; defaults to `Close alert`.
- `root-class`

## Methods

- `dismiss()`
- `close()`
- `onAction(handler)`
- `onClose(handler)`

## Events

- `sf-alert-action`
- `sf-alert-close`

The close control is a native button inside sf-icon-button; pointer, Enter and
Space use the same dismissal path. Events are delegated from the alert root,
so child rendering or moving data attributes does not lose the handler. Actions
inside a nested alert do not generate an additional outer action event.
Events and onAction/onClose callbacks retain normal DOM bubbling. In nested
layouts, filter detail.alert when handling only a specific notice's events.
The close event is emitted before removal. The application may use it to focus
a known next action when focus was inside the dismissed notice. Reattaching the
same element restores its listeners; action buttons do not dismiss by default.

`icon="none"` hides the leading semantic icon. Generated controls use the short
`data-action` and `data-close` hooks; the longer legacy aliases remain on the
rendered nodes for compatibility. Alert is a persistent inline notice, not a
replacement for transient Toast. Choose a live-region role only for a message
inserted dynamically.
