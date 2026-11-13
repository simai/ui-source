# Toast

Toast is a short reply to an action, shown over the page, that does not
interrupt the current task (owner decision C114 (1)). The state of a page is
Alert; the state of the whole product is `sf-alert-bar`; the history of what
happened is the notification centre (the Larena admin menu); a decision is
`sf-confirm`.

## Public contract

- Statuses: `neutral`, `info`, `success`, `warning`, `error` (`default` and
  `primary` are still read as neutral and info).
- Optional decorative icon, title, supporting text, one short action and one
  explicitly named close action.
- Canonical behavior hooks: `data-action`, `data-close`, `data-duration`.
  `data-toast-action` and `data-toast-close` remain compatibility aliases.
- `sf-toast-action` reports the stable action value; `sf-toast-close` is emitted
  once before token motion removes the visual owner.
- A positive `data-duration` enables auto-dismiss. The remaining lifetime pauses
  while pointer or keyboard focus is inside the toast. Zero or no attribute is
  persistent.
- An error or a warning never leaves by itself (1.3.0, owner decision C114 (6),
  WCAG 2.2.1): it stays until a person closes it, whatever `data-duration` it
  carries. Only success, info and neutral messages keep a time.

## Layout (1.2.0, owner decision C35)

Inline padding `--sf-space-1` on both sides, block padding `--sf-space-1/2`;
the status icon is the line's size (`--sf-text-height-1`: 24, compact and
phone 20) and stands with the first line of text and the close in the box of a
low size-1 control (32, compact and phone 28). The title and its text are one
block (no gap); the actions follow at `--sf-space-1/2`, `--sf-space-1/3`
apart: `sf-button sf-button--tonal sf-button--on-surface sf-button--size-1
sf-button--height-low` (tonal surface, the same neutral plate on every level). The close is `sf-icon-button sf-icon-button--close
sf-icon-button--size-1 sf-icon-button--height-low` with `sf-close
sf-close--size-1`; its plate hangs out over the inline padding. The public
`--sf-toast-padding-block`, `--sf-toast-padding-inline` and `--sf-toast-gap`
still win.

## Where the action stands (1.3.0, owner decision C115)

A toast with one action puts it in the row with the text from 20rem (320 px)
of the toast's own width -- every toast of the notification area, which is
28rem wide -- centred on the text block; with a one-line text the label stands
on the title line, with the icon and the close. Narrower, or with two
actions, the action stands under the text from its start, at
`--sf-space-1/2` (12, phone 8), and the space under it equals the space above
the capitals of the first line (C114 (5), NS-10). A toast with an action is a
size query container (`container: sf-toast`). A title-only toast with one
action is 58 at 1440 (46 on a phone); it was 98 (78).

The modifier `.sf-toast--actions-under` (1.3.0, owner 2026-11-13,
#q-layout-override; on `sf-toast` the setting `actions-layout="under"`; for
the class toast `SF.Toast.create({actionsLayout: 'under'})`) keeps the action under the
text at every width, with the same gap and the even bottom, for a long text.

## Ink (1.2.1, C35 acceptance F1)

The status icon is the status's role `--sf-<status>` (neutral: the quiet
`--sf-on-surface-variant`, read from the container), as on the alert: the container's graphic tone
(`--sf-on-<status>-container-graphic`) it read before was 2.86-3.04:1 on a dark
toast.

The close's cross is a service glyph (1.2.5, owner decision C112, AA-13; it
refines C107 for service glyphs on coloured places): the on-surface ink at 64
of the alpha scale's ink family (48/64/80) --
`light-dark(var(--sf-black--alfa-64), var(--sf-white--alfa-64))` -- on every
level and on a neutral toast alike; under a pointer it catches the text ink.
Its size is the size-1 close, 16 in the 24 box of the status icon. It painted
the text ink (`--sf-on-<status>-container`) first, then
`--sf-on-surface-variant`. The level's graphic tone is not used: on a dark
toast it reads 2.93:1.

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
                              // (error and warning always stay until closed)
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
- Neutral, info and success leave after 5 s by default. An error and a warning
  stay until a person closes them (owner decision C114 (6)); they left after
  10 s and 8 s before. A timer pauses while the pointer or the focus is on its
  toast. An error is announced at once (`role="alert"`), everything else
  politely (`role="status"`).
- Every message is announced on the document as `sf-notification` with
  `{id, status, title, text, source, time}` before it is shown. A notification
  centre records it there; cancelling the event keeps the record and skips the
  toast. `SF.notifications.history()` lists the page's last fifty.

The toast component is fetched the first time a message is raised.

The line-size rule for icons reaches only the toast's own status icon, as its
status colour does: an icon button inside the toast keeps its own glyph size
(review R-N1, 2026-11-11).
