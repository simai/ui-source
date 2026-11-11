# Toast

Toast is concise transient overlay feedback that does not interrupt the current
task. It is distinct from persistent inline Alert content.

## Public contract

- Types: `default`, `primary`, `error`, `warning`, `success`.
- Optional decorative icon, title, supporting text, one inline link or up to
  two short action buttons, and one explicitly named close action.
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
still win.

## Ink (1.2.1, C35 acceptance F1)

The status icon is the status's role `--sf-<status>` (neutral: the quiet
`--sf-on-surface-variant`, read from the container), as on the alert: the container's graphic tone
(`--sf-on-<status>-container-graphic`) it read before was 2.86-3.04:1 on a dark
toast. The close's cross is the toast's text ink, `--sf-on-<status>-container`.

The neutral icon is the theme's dim ink on a fill, the alert's (1.2.3): `#515257`
in light, `#d4d4d9` in dark. The toast is a popup place, and the popup's own
`--sf-on-surface-container-variant` is one step up in dark (C43, for the
controls' keys); the icon does not take it, so it stays quieter than the text.

The status colour is the toast's own icon only (1.2.2, C35 acceptance A-F1):
`.sf-toast > .sf-icon` and `.sf-toast > sf-icon > .sf-icon`. An icon-only
action button keeps its own icon role.

The Smart toast draws its status icon through `sf-icon` (sf-toast 1.2.1,
component.toast 1.2.4), as the Smart alert does: `.sf-toast > sf-icon > .sf-icon`
takes the place, size and colour of `.sf-toast > .sf-icon`, and
`.sf-toast > sf-icon:not(:defined)` holds the same box before the element is
defined. Class markup keeps `<i class="sf-icon">`.

## Actions (1.3.0, owner decision C50)

One light navigation action («Открыть», «Посмотреть», «Подробнее») is a link at
the end of the text: `SF.Toast.create({link: {text, href, action}})` draws
`<a class="sf-toast-link" data-action>` after the supporting text, in the
text's own ink, medium weight and underlined, with the Framework focus ring.
Undo, retry, extend and two actions are buttons under the text (C35, C46):
`actions: [{text, action}, {text, action}]` (at most two; `actionText` and
`action` remain the one-button form). A toast never mixes the two: a link takes
the place of the buttons. A link without `href` gets `#`, and its click does not
jump: the page answers `sf-toast-action`.

`SF.Toast.pause(toast, reason)` and `SF.Toast.resume(toast, reason)` stand and
restart a toast's timer for a reason of the page's own; the timer runs only
while no reason (pointer, focus or the page's) holds it, and resuming a reason
that was not standing changes nothing.

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
  action: {label: 'Открыть', href: '/billing'},           // optional: a link
  // actions: [{label: 'Отменить', onSelect: (record) => {}}],  // or buttons
  duration: 5000,             // ms; 0 keeps it until closed; by status if omitted
  source: 'billing',          // who raised it, for a notification centre
  key: 'topup:42',            // optional: messages with one key count up
});
handle.close();
```

A string is the message's text: `SF.notify('Saved')`. With nothing to show the
call returns `null` and warns in the console.

- The area sits at one edge of the window in the top layer (bottom-end by
  default; `SF.notifications.configure({placement: 'top-end', max: 4})`). At
  most four show at once and the rest wait their turn; the same message again
  counts up (`×2`) instead of stacking twice.
- The messages of the corner are a stack (core.runtime 1.55.0, owner decision
  C50): the newest in front, the two before it peeking out behind it by
  `--sf-space-1/2` (12; compact and phone 8), each 5 % narrower, their content
  out of sight; a fourth waits hidden behind them. A new message slides in from
  outside the window's edge and fades in. The stack opens into the
  list (every message whole, `--sf-space-1/2` apart) while the pointer is over
  it or the focus is in it, and on a tap until a tap elsewhere; while it is
  open every timer in it stands. The gaps between open messages take no
  pointer, so a click there reaches the page; the stack stays open while the
  pointer is inside it, in a gap too, and closes when it leaves. Tab enters the open stack at the
  newest message, then the older ones. Escape closes the message in focus and moves
  the focus to the next, or back where it came from when none is left. With
  reduced motion nothing moves, it only changes. There is no «ещё N».
  `SF.notifications.configure({layout: 'list'})` keeps the list of earlier
  pairs: every message whole with a gap.
- An action is `action: {label, href}` for one light navigation action, drawn
  as a link at the end of the text; `action: {label, onSelect}` or
  `actions: [one, two]` are buttons under the text. `onSelect(record)` runs on
  either, and the message closes.
- A timer pauses while the pointer or the focus is on its toast, and every
  timer stands while the page is out of sight (another tab, a minimised
  window) and resumes with the time it had left.
- Every message is said once, when it arrives, through the area's own live
  copy, visually hidden and in the accessibility tree, whatever place it takes
  (the fourth, hidden behind the stack, and one waiting its turn behind four,
  too): an error at once (`role="alert"`), everything else politely
  (`role="status"`). Messages arriving together are said together. The toasts
  of the area are not live regions of their own, so nothing is said twice.
- Until the toast's stylesheet is applied, and for the first message until
  the fonts it uses are in, the area waits hidden (at most two seconds), so a
  message never shows unstyled in the middle of the window or changes height
  while it slides in.
- Every message is announced on the document as `sf-notification` with
  `{id, status, title, text, source, time}` before it is shown. A notification
  centre records it there; cancelling the event keeps the record and skips the
  toast. `SF.notifications.history()` lists the page's last fifty.

The toast component is fetched the first time a message is raised.

The line-size rule for icons reaches only the toast's own status icon, as its
status colour does: an icon button inside the toast keeps its own glyph size
(review R-N1, 2026-11-11).
