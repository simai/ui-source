# sf-alert

A persistent inline notice: a status, a heading, a supporting text, up to two
actions and an optional close button. It is not a replacement for the
transient Toast. The default template applies the shared `root-class`, `style`
and `root-style` settings to its root; the outer Smart host stays boxless.

## Basic Usage

```html
<sf-alert
  status="warning"
  appearance="default"
  heading="Warning"
  supporting-text="Please review this section."
  action-text="Review"
  action="review"
  closable
></sf-alert>
```

## Settings

- `status="neutral|info|success|warning|error"`
- `appearance="default|outlined|flat"`
- `icon` — `none` hides the leading status icon
- `heading`
- `supporting-text`
- `action-text`, `action` — the first action's words and the value its event carries
- `secondary-action-text`, `secondary-action`
- `closable`
- `close-label` — the close button's accessible name; the language file's
  «Закрыть сообщение» / «Close alert» when unset
- `root-class`

The old names keep working until 2026-12-01 and are noted in
`SF.deprecations.list()`: `title` is `heading`, `type` is `status` (with the
old words `clear` and `danger`), `variant` is `appearance`, and `dismiss()` is
`close()`.

## Accessibility

The root is a live region: `role="status"` (polite) for `neutral`, `info` and
`success`, `role="alert"` (assertive) for `warning` and `error`. Its name is the
heading, else the host's `aria-label`. The close control is a native button
inside sf-icon-button; pointer, Enter and Space use the same path.

## Actions

- `close()` — sends `sf-alert-close {reason: "api"}` first; a listener that
  calls `preventDefault()` keeps the alert and `close()` answers
  `{outcome: "refused", reason: "prevented"}`; otherwise the alert leaves and
  the answer is `{outcome: "applied"}`.
- `onAction(handler)`, `onClose(handler)` — listen to this alert's own events.

## Events

- `sf-alert-action {action}` — the person pressed an action button. Action
  buttons do not dismiss the alert.
- `sf-alert-close {reason}` — cancelable, sent before the alert leaves:
  `close` from its own button, `api` from `close()`.

The detail carries data only: the element is the event's target. Events are
delegated from the alert root, so a child render or a moved data attribute does
not lose the handler; a nested alert's events are its own.

## Public variables

`--sf-alert-background-color`, `--sf-alert-border-color`, `--sf-alert-color`,
`--sf-alert-border-width`, `--sf-alert-radius`, `--sf-alert-padding-inline`,
`--sf-alert-padding-block`, `--sf-alert-gap`.
