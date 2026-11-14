# sf-alert

A persistent inline notice: the state of this page or section (owner decision
C114 (1)), with a status, a heading, a supporting text, up to two actions and
an optional close button. The state of the whole product is `sf-alert-bar`, a
short reply to an action is a toast (`SF.notify`), a decision is
`sf-confirm`. The default template applies the shared `root-class`, `style`
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
- `appearance="default|outlined|flat"` — the three looks (owner decision
  C110): `outlined` the border only, `default` the border and the status fill,
  `flat` the status fill without a border, with the card's shadow
  (`--sf-shadow-raised`; 1.4.0, component.alerts 1.3.0)
- `icon` — `none` hides the leading status icon
- `heading`
- `supporting-text`
- `action-text`, `action` — the first action's words and the value its event carries
- `secondary-action-text`, `secondary-action`
- `actions-layout="auto|under"` — where the actions stand: `auto` (the
  default) by the alert's width, `under` under the text at every width
- `closable`
- `close-label` — the close button's accessible name; the language file's
  «Закрыть сообщение» / «Close alert» when unset
- `root-class`

The old names keep working until 2026-12-01 and are noted in
`SF.deprecations.list()`: `title` is `heading`, `type` is `status` (with the
old words `clear` and `danger`), `variant` is `appearance`, and `dismiss()` is
`close()`.

## Layout

Layout (1.2.0, owner decision C35 with the toast's numbers; DEV acceptance D3
covers every notice), all in tokens, so a compact region
(`data-sf-density="compact"`) moves it by itself:

| | desktop | compact, phone |
|---|---|---|
| inline padding, both sides (`--sf-space-1`) | 16 | 12 |
| block padding (`--sf-space-1/2`) | 12 | 8 |
| status icon (the line's size) | 24 | 20 |
| icon to text (`--sf-space-1/2`) | 12 | 8 |
| title to text | 0 | 0 |
| text to the actions (`--sf-space-1/2`) | 12 | 8 |
| between the actions (`--sf-space-1/3`) | 8 | 4 (phone 8) |
| actions: size 1, `height="low"`; label = text | 32 · 16 | 28 · 14 |
| close: `sf-button-icon kind="close" height="low"`, centred on the first line | 32 | 28 |
| one-line alert, without the border | 56 | 44 |

The first action is tonal surface (`tonal on-surface`, the theme's neutral
plate, the same on every status), the second ghost on-surface. A notice never
holds a destructive or a filled action: it leads to the decision, and
`sf-confirm` takes it. The first line
stands in the box of the low control, so the icon, the first line of text and
the close share one centre; the first action's plate starts at the text edge;
the close's plate hangs out over the inline padding, so its cross stands where
the status icon stands on the other side.

### Where the actions stand (1.3.0, owner decision C115)

The actions stand in the row with the text while the alert is wide enough --
one action from 36rem (576 px) of its own width, two from 48rem (768 px) --
and under the text from its start when it is narrower (a container query on
the alert, layout L3a). In the row they are centred on the text block; with a
one-line text the button's label stands on the title line, with the icon and
the close. Under the text, the space under the last button equals the space
above the capitals of the first line (C114 (5)).

| One action, title and text | 320 | 480 | 640 | 800 |
|---|---|---|---|---|
| height at 1440 (border included) | 204 | 156 | 102 (row) | 78 (row) |

`actions-layout="under"` (owner 2026-11-13, #q-layout-override) keeps the
actions under the text at every width, with the same gap and the even bottom;
the sheet cannot count the text's lines, so a long text is the author's call.
In the row a three-line text with two actions is taller than under it (174
against 146 at 800). `auto`, the default, is the layout above; any other word
is `auto`. The class form is the modifier `sf-alert--actions-under`.

```html
<sf-alert status="warning" actions-layout="under"
  heading="Оплата не прошла"
  supporting-text="Банк отклонил платёж. Проверьте данные карты или выберите другой способ, затем повторите оплату. Заказ хранится 24 часа."
  action-text="Повторить" action="retry"
  secondary-action-text="Сменить способ" secondary-action="method"></sf-alert>
```

### Callout

Guidance before an action is a recipe of this element, not a component of its
own (owner decision C114 (7)): `status="info" appearance="outlined"`, without
`closable` and without actions.

```html
<sf-alert status="info" appearance="outlined"
  supporting-text="Новый адрес получат все письма сайта."></sf-alert>
```

## Help link (1.3.1, owner decision C126)

A link in the alert's text leads to help only -- «Узнать больше», the page
that explains the message. Every action is a button (`action-text`,
`secondary-action-text`), never a link in the text. Put the text with its link
in the `supporting-text` slot:

```html
<sf-alert status="info" heading="Доступ по ссылке включён"
  action-text="Скопировать ссылку" action="copy">
  <span slot="supporting-text">Открыть страницу сможет любой, у кого есть
    ссылка. <a href="/help/sharing">Узнать больше</a></span>
</sf-alert>
```

The link is the alert's own text ink -- on-surface on a neutral or outlined
alert, on-`<status>`-container on a status container -- not the theme's link
blue, so it holds the text's contrast on every status and look (4.5:1 and
more). It is underlined at the theme's link weight (1 px), the line doubles
under the pointer, and its keyboard ring is the same ink (3:1 and more against
every fill, light and dark). A notice has no saturated look (white text on a
strong status colour): the three looks stay, and the action stays tonal
surface on every status (C110 E).

## Accessibility

The root is a live region: `role="status"` (polite) for `neutral`, `info` and
`success`, `role="alert"` (assertive) for `warning` and `error` -- for an alert
put in the page after it has loaded (or taken out and put back). An alert
printed with the page, in it at the load event or carrying its server-printed
first paint, is `role="status"` at every level (1.2.2, NS-1): it is not news,
and an assertive region at load would interrupt the person. To have a notice
present at load speak as an alert, or a late one stay polite, set the host's
own `role="alert"` or `role="status"`; it always wins. Its name is the
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
