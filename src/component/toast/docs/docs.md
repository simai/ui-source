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
