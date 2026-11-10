# Toast

Toast is concise transient overlay feedback that does not interrupt the current
task. It is distinct from persistent inline Alert content.

## Public contract

- Types: `default`, `primary`, `error`, `warning`, `success`.
- Optional decorative icon, title, supporting text, one short action and one
  explicitly named close action.
- Canonical behavior hooks: `data-action`, `data-close`, `data-duration`.
  `data-toast-action` and `data-toast-close` remain compatibility aliases.
- `sf-toast-action` reports the stable action value; `sf-toast-close` is emitted
  once before token motion removes the visual owner.
- A positive `data-duration` enables auto-dismiss. The remaining lifetime pauses
  while pointer or keyboard focus is inside the toast. Zero or no attribute is
  persistent.

## Layout (1.2.0, owner decision C35)

Inline padding `--sf-space-1` on both sides, block padding `--sf-space-1/2`;
the status icon is the line's size (`--sf-text-height-1`: 24, compact and
phone 20) and stands with the first line of text and the close in the box of a
low size-1 control (32, compact and phone 28). The title and its text are one
block (no gap); the actions follow at `--sf-space-1/2`, `--sf-space-1/3`
apart: `sf-button sf-button--tonal sf-button--primary sf-button--size-1
sf-button--height-low`. The close is `sf-icon-button sf-icon-button--close
sf-icon-button--size-1 sf-icon-button--height-low` with `sf-close
sf-close--size-1`; its plate hangs out over the inline padding. The public
`--sf-toast-padding-block`, `--sf-toast-padding-inline` and `--sf-toast-gap`
still win. The action's plate is the toast's own tone a step stronger
(`--sf-<tone>-container-strong`; neutral `--sf-surface-container-strong`; DEV
look note on C35): the primary container is translucent and over a toast of
the same hue merged with it. `--sf-button-background-color` still wins.

## Accessibility and ownership

Use `role="status"` only when non-urgent feedback is inserted dynamically and
`role="alert"` only for a newly inserted urgent error. Omit a live-region role
from content present at initial load. Keep actionable or essential content
persistent. The application owns stack placement, ordering, business effects
and any focus recovery required after removing a focused action.

## The page's notifications: SF.notify

A message that should pop up and go away is raised with `SF.notify`, not by
placing a toast where a component stands: the Framework keeps one notification
area per page and every message goes there.

```js
const handle = SF.notify({
  status: 'success',          // neutral | info | success | warning | error
  title: 'Пополнение выполнено',
  text: 'Средства будут зачислены в течение минуты.',
  action: {label: 'Открыть', onSelect: (record) => {}},  // optional
  duration: 5000,             // ms; 0 keeps it until closed; by status if omitted
  source: 'billing',          // who raised it, for a notification centre
  key: 'topup:42',            // optional: messages with one key count up
});
handle.close();
```

A string is the message's text: `SF.notify('Saved')`. With nothing to show the
call returns `null` and warns in the console.

- The area sits at one edge of the window in the top layer (bottom-end by
  default; `SF.notifications.configure({placement: 'top-end', max: 4})`).
  Messages stack with a gap; at most four show at once and the rest wait their
  turn; the same message again counts up (`×2`) instead of stacking twice.
- A timer pauses while the pointer or the focus is on its toast. An error is
  announced at once (`role="alert"`), everything else politely
  (`role="status"`).
- Every message is announced on the document as `sf-notification` with
  `{id, status, title, text, source, time}` before it is shown. A notification
  centre records it there; cancelling the event keeps the record and skips the
  toast. `SF.notifications.history()` lists the page's last fifty.

The toast component is fetched the first time a message is raised.
