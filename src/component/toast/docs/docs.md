# Toast

Toast is a short reply to an action, shown over the page, that does not
interrupt the current task (owner decision C114 (1)). The state of a page is
Alert; the state of the whole product is `sf-alert-bar`; the history of what
happened is the notification centre (the Larena admin menu); a decision is
`sf-confirm`.

## Public contract

- Statuses: `neutral`, `info`, `success`, `warning`, `error` (`default` and
  `primary` are still read as neutral and info).
- Optional decorative icon, title, supporting text, up to two short action
  buttons (the one light action may be a link button), and one explicitly named
  close action. A link in the text leads to help only (C126).
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

Since 1.3.3 (owner decision C105 H4/H6, as the fields' C77 inset) the 1 px
border is inside the inline inset: the padding is `--sf-space-1` less
`--sf-toast-border-width`, so the icon and the letters stand 16 from the outer
edge (compact and phone 12); before they stood 17 (13).

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

The action's label under the pointer in the dark theme (1.3.0, C113
follow-up): a toast is a popup place, lighter than the page in the dark theme,
and the neutral tonal and ghost plates step up the fill family over it
(12 / 16 / 20 %, C113). The label the buttons keep under the pointer in the
dark theme, `--sf-on-surface`, read 4.38:1 hovered and 4.01:1 pressed on a
neutral toast (4.43-4.72 pressed on the levels). On a toast the label and its
icon take the ink family's full step under the pointer, `--sf-alpha-base`
(white in the dark theme), so the plates keep C113's steps and the label holds
4.5:1 in every state and level (tonal 5.64-6.71 hovered, 5.16-6.08 pressed;
ghost 5.65-8.06 and 5.17-7.77); the light theme keeps the buttons' stepped
inks (`--sf-on-surface-hover` / `-active`).

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

## Actions (1.4.0, owner decisions C50 and C126)

Every action is a button (owner decision C126 (1)). One light navigation
action («Открыть», «Посмотреть», «Подробнее») is the one action button drawn as
a link: `SF.Toast.create({link: {text, href, action}})` draws
`<a class="sf-button sf-button--tonal ..." href data-action>` in the action's
place (C115), the same tonal low button as `actionText`. Undo, retry, extend
and two actions are buttons too (C35, C46): `actions: [{text, action}, {text,
action}]` (at most two; `actionText` and `action` remain the one-button form).
With `link` the other actions do not apply. A link without `href` gets `#`,
and its click does not jump: the page answers `sf-toast-action`. Before 1.4.0
the light action was `a.sf-toast-link` at the end of the text (C50); that link
and its no-break space are gone.

`SF.Toast.pause(toast, reason)` and `SF.Toast.resume(toast, reason)` stand and
restart a toast's timer for a reason of the page's own; the timer runs only
while no reason (pointer, focus or the page's) holds it, and resuming a reason
that was not standing changes nothing.

## Help link (1.3.2, owner decision C126)

A link inside `.sf-toast-wrap` leads to help only («Узнать больше»); every
action is a button. Any `a[href]` in the text takes the text's own ink
(`--sf-toast-color`, else the level's on-container role or on-surface), not
`--sf-link`; it is underlined at `--sf-link--underline-weight` with `--sf-a3`
offset, the line doubles on hover and press, and the keyboard ring is the same
ink, 3:1 and more against every level's fill in both themes. The rule is
shared by the notice family (core `mix/_mix__notice-link.scss`). A toast that
leaves by itself must not carry the only way to its help: keep such a toast
until it is closed (`duration` 0).

```html
<div class="sf-toast-supporting-text">Её можно отправить коллегам.
  <a href="/help/sharing">Узнать больше</a></div>
```

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
  action: {label: 'Открыть', href: '/billing'},           // optional: a link button
  // actions: [{label: 'Отменить', onSelect: (record) => {}}],  // or buttons
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
- An action is a button (C126): `action: {label, href}` for one light
  navigation action is the action button drawn as a link; `action: {label,
  onSelect}` or `actions: [one, two]` are buttons. `onSelect(record)` runs on
  either, and the message closes.
- Neutral, info and success leave after 5 s by default. An error and a warning
  stay until a person closes them (owner decision C114 (6)); they left after
  10 s and 8 s before.
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
  its parts' sheets (icon, close button) and fonts are in, the area waits
  hidden (at most two seconds), so a message never shows unstyled in the
  middle of the window or changes height while it slides in.
- Every message is announced on the document as `sf-notification` with
  `{id, status, title, text, source, time}` before it is shown. A notification
  centre records it there; cancelling the event keeps the record and skips the
  toast. `SF.notifications.history()` lists the page's last fifty.

The toast component is fetched the first time a message is raised.

The line-size rule for icons reaches only the toast's own status icon, as its
status colour does: an icon button inside the toast keeps its own glyph size
(review R-N1, 2026-11-11).

## Version notes (1.3.0, C50 return)

- dfd66644 says the first message waits for its fonts and so no longer steps
  back while it slides in. It did not cure that step: the step came from the
  sheets of the message's parts arriving late. 8467649e supersedes it (the
  first message waits for its parts' sheets as well as its fonts) and
  8167be32 narrows the wait to the first message.

## Version notes (1.3.1, C50 acceptance r3)

- The link keeps to the last word of the text it ends: a no-break space stands
  before it, so a full line no longer sends it alone onto a line of its own.
  (Gone in 1.4.0: the light action is a button, C126.)
- SF.notify (core.runtime 1.55.0): messages raised together while the toast
  sheet is still loading wait for it together, hidden, and then each slides
  in from the edge. Before, two messages of one task did not wait: they were
  drawn unstyled and opaque and jumped into place. The area is known placed
  by a value only the toast sheet gives it (it takes no pointer), not by
  `position: fixed`, which an open popover has from the browser's own style.
  The first message no longer waits for a stylesheet link that is switched
  off or answered with an error.

## Version notes (1.4.0, group build 3)

- 1.4.0 joins the integration's C50 actions (1.3.1) and the notices family's
  C114 / C115 / C126 / C105 work (written as 1.3.0, 1.3.2 and 1.3.3 on
  fix/notices-c114-c115). Where they overlap the newer decisions win: the light
  action is a button-link (C126 (1)), errors and warnings stay (C114 (6)), the
  action stands in the C115 place. C50's two actions, `data-action`, the timer
  pause and the SF.notify stack are kept.
