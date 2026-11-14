# sf-confirm-change

Подготовленное изменение, которое ждёт «да» или «нет» человека: каждое значение как
было и как станет, два ответа (равноценных, а у удаления — красный и тихий), срок, до которого можно ответить, а после
ответа — только итог. Карточка родилась в `simai/ui-chat` как предложение ассистента
(`renderProposal`) и стала элементом (решение владельца 2026-10-25): тот же вопрос
задают и вне ассистента — правка коллеги в чате simai.chat, очередь модерации,
импорт, который ждёт согласия перед записью.

## Что она делает и чего не делает

Карточка **ничего не применяет**. Нажатие переводит её в `pending` — ответы
остаются на месте: нажатый занят (спиннер кнопки и `aria-busy`), другой
недоступен, так что дважды не нажать и видно, какой ответ применяется, — строка
состояния говорит, что происходит, и отправляет событие. Итог ставит хост: `accepted`, `declined` или
снова `open`, если ответ не удалось доставить. После «Отклонить» (`declined`)
строка состояния пуста: отказ ничего не изменил, сообщать нечего (решение C35,
R067). Отказ, который человек дал здесь, сворачивает вопрос (решение DEV D2 к C35): карточка
скрывается (`hidden`), а фокус возвращается с видимой рамкой на элемент, с которого
вопрос открыли (обычно кнопка «Удалить»), иначе — на ближайший фокусируемый элемент
вокруг или следующий элемент страницы, как после удаления строки. Отказ, который хост
рисует сам (решение принято раньше или в другом месте), остаётся на экране. Хост, отменивший событие
(`preventDefault()`), оставляет вопрос открытым.

Ответ человека — событие `sf-confirm-change-answer` с `{id, accepted}` (глагол
`answer` словаря 1.1.5). Сборка спрашивает карточку шагом `ask` (§19.4): `open`
ждёт ответа и отвечает `{accepted, reason, value}`.

Значения рисует `sf-change` списком (1.7.0, решение владельца C40): название поля и
«было → стало» текстом — старое тихим, новое полужирным, пустое — «пусто», без
плашек «Было» и «Станет».

Она не знает ни текста команды, ни формата кода, ни сервера: всё это осталось
в ui-chat.

## Подключение

```html
<sf-confirm-change heading="Переименовать раздел" change-id="c-17"
                   expires-at="2026-10-25T18:00:00+03:00">
  <span slot="description">Код 4821</span>
</sf-confirm-change>
```

```js
const card = document.querySelector('sf-confirm-change');
card.changes = [{label: 'Название', before: 'Новости', after: 'События'}];
card.addEventListener('sf-confirm-change-answer', async (event) => {
  const {id, accepted} = event.detail;
  try {
    await (accepted ? api.apply(id) : api.reject(id));
    card.state = accepted ? 'accepted' : 'declined';
  } catch {
    card.state = 'open';
  }
});
```

## Attributes

| Attribute | Default | Meaning |
|:---|:---|:---|
| `heading` | `""` | What the change is; without one the card is named «Что изменится». |
| `heading-level` | `3` | The heading's level, 2–6, where the card is placed. |
| `state` | `open` | `open`, `pending`, `accepted`, `declined`, `expired`. |
| `expires-at` | — | ISO 8601 date. Past it an open card reads as expired. |
| `change-id` | `""` | The host's name for the change, carried back in every event. |
| `disabled` | `false` | The answers are shown and cannot be pressed. |
| `status` | `""` | `danger` for a delete or anything that cannot be undone (1.8.0, decision C25): the accepting answer is a filled danger button, the declining one quiet. Without it both answers are outlined and weigh the same. |
| `accept-text` | «Подтвердить» / «Confirm» | The accepting answer. |
| `decline-text` | «Отклонить» / «Decline» | The declining answer («Отменить» for an assistant's offer). |
| `changes` | `[]` | The values as JSON, for markup; the `changes` property wins. |

## The answers

The answers stand at the start of the footer, the accepting one first, 8 apart
(4 in a compact region), and the status line («Подтвердить можно до …») after
them — one rule for every question (decisions C166, C157 (3), C159 (4); 1.8.0).
Below the sm breakpoint (32rem) the two answers share the row in halves.

```html
<sf-confirm-change heading="Удалить раздел «Архив 2019»" status="danger"
                   accept-text="Удалить" decline-text="Оставить"></sf-confirm-change>
```

## The change

`changes` is a list of `{label, before, after}`. A value is text; empty or `null`
reads as «пусто». Without a list the card still asks — a change with no values to
show (a deletion) is a heading and the answers.

## Actions

Each answers an outcome (`{outcome: 'applied'}` or `{outcome: 'refused', reason}`).

| Action | Meaning |
|:---|:---|
| `answer({accepted})` | As the person would: `true` confirms, `false` declines. Refused `closed`, `disabled` or `prevented` (the host cancelled the event). `answer('accept')` and `answer('decline')` are read until 2026-12-01 and noted in `SF.deprecations`. |
| `confirm()` | The acceptance; a page button reaches it as `data-sf-action="<id>.confirm"`. |
| `cancel()` | The declining answer; `data-sf-action="<id>.cancel"`. |
| `open()` | Puts the question again. Asked by an assembly (`ask`), it waits for the answer: `{accepted, reason: close \| cancelled \| expired, value: null}`. |

## Events

| Event | Detail | When |
|:---|:---|:---|
| `sf-confirm-change-answer` | `{id, accepted}` | The person answered. Cancelable: cancelled, the question stays open. |
| `sf-confirm-change-expired` | `{id}` | An open card passed `expires-at`; said once per time. |

The 1.0 names follow until 2026-12-01 and each use is noted in `SF.deprecations`:
`sf-change-confirm-accept` and `sf-change-confirm-decline` (the answer with
`accepted` true or false; one cancel for both names) and `sf-change-confirm-expire`.

## Slots

| Slot | Meaning |
|:---|:---|
| `description` | A line under the heading: a code, who proposed it. |

## Keyboard and reading

The two answers are native buttons (Tab, Enter, Space). The card is a section named
by its heading; the values are sf-change's description list (1.7.0, owner decision C40),
read as «Название: Новости на События». The status line is a polite live region that is in the page before
it speaks; when a press takes the answers away, focus moves to it instead of falling
to the page, and back to the first answer when the host cancels.

## CSS variables

Public variables, set on the card or any ancestor; the component never sets them.

| Variable | Default |
|:---|:---|
| `--sf-confirm-change-radius` | `var(--sf-radius-2)` |
| `--sf-confirm-change-inset` | `var(--sf-space-1\/2) var(--sf-space-1)` |
| `--sf-confirm-change-gap` | `var(--sf-space-1\/2)` |
| `--sf-confirm-change-before-background-color` | `transparent` (1.7.0; before it `var(--sf-surface-container)`) |
| `--sf-confirm-change-after-background-color` | `transparent` (1.7.0; before it `var(--sf-primary-container)`) |
| `--sf-confirm-change-after-color` | the new value colour of `sf-change` (1.7.0; before it `var(--sf-on-primary-container)`) |

Until 1.8.0 they were named after the former tag, `--sf-change-confirm-<name>`;
those names are read under the new ones until 2027-01-01 (see «Former names»).
The 1.0 hooks `--sf-change-confirm--before-fill`, `--after-fill` and
`--after-ink` are still read where they were.

## Words

English by default, the page's language otherwise (`lang/en.json`,
`lang/ru.json`); corrected through `SF.language.register('sf-confirm-change', 'ru', {…})`.
Keys: `changes-label`, `before-text`, `after-text`, `accept-text`, `decline-text`,
`accepting-text`, `declining-text`, `accepted-text`,
`expired-text`, `until-text`, `empty-value-text`.

## Former tag

Until 2027-01-01 the former tag `sf-change-confirm` is a dated alias of `sf-confirm-change`
(rename plan R2, 2026-11-03): markup with the old tag upgrades as this element,
the Loader forwards the former rule name `cl-change-confirm` to `cl-confirm-change`, and each
use is noted once in `SF.deprecations`. Write the new tag in new markup.

Every event keeps its former name beside the new one, with the same detail:
`sf-change-confirm-answer`, `sf-change-confirm-expired`.

## Former names

Since 1.8.0 the classes and the public variables carry the element's name too
(DEV change-time study CT-13). Until 2027-01-01 the former ones keep working:
the card writes each former class beside its new one, and each former variable
is read under its new name. Write the new names in new code.

| Former name | New name |
|:---|:---|
| `.sf-change-confirm` | `.sf-confirm-change` |
| `.sf-change-confirm--open`, `--pending`, `--accepted`, `--declined`, `--expired` | `.sf-confirm-change--open`, … |
| `.sf-change-confirm__heading` | `.sf-confirm-change__heading` |
| `.sf-change-confirm__description` | `.sf-confirm-change__description` |
| `.sf-change-confirm__changes` | `.sf-confirm-change__changes` |
| `.sf-change-confirm__list` | `.sf-confirm-change__list` |
| `.sf-change-confirm__footer` | `.sf-confirm-change__footer` |
| `.sf-change-confirm__status` | `.sf-confirm-change__status` |
| `.sf-change-confirm__actions` | `.sf-confirm-change__actions` |
| `--sf-change-confirm-radius`, `-inset`, `-gap` | `--sf-confirm-change-radius`, `-inset`, `-gap` |
| `--sf-change-confirm-before-background-color` | `--sf-confirm-change-before-background-color` |
| `--sf-change-confirm-after-background-color` | `--sf-confirm-change-after-background-color` |
| `--sf-change-confirm-after-color` | `--sf-confirm-change-after-color` |

## Changes

- 1.8.0 (2026-11-14) — the answers at the start, the accepting one first, 8
  apart (C166; CT-3); `status="danger"` (C25; CT-4); the classes and the public
  variables carry the element's name, the former ones until 2027-01-01 (CT-13).
