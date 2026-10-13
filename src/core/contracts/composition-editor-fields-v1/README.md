# Composition Editor Fields 1.0.0: нормативный комплект

Комплект публикует типы полей визуального редактора и новые manifests полей.
`simai.composition.editor-manifest.v1`, Recipe 1.0.1, Document v1 и type
manifest v1 не меняются. Реестр типов полей —
`composition-editor-field-kinds.v1.json` (схема записи
`composition-editor-field-kind.v1.schema.json`). Владелец — ui-source.

## Файлы

- README.md — этот текст, нормативный.
- fixtures/field-kinds.json — разбор отправленных значений, применение к узлу,
  проверки manifests и серверные fallback-разметки с точными результатами.
- checks/schemas.py — независимая проверка Draft 2020-12.
- checks/normalization-parity.php — независимое PHP-чтение правил: те же
  результаты и те же канонические байты узла.
- contract.lock.json — отпечатки нормативных файлов и manifests.

## Как определяется тип поля

Тип поля выводится из точной идентичности Property поля и наличия `choices`;
новых полей в editor manifest нет. Сопоставление должно быть однозначным,
иначе `field_kind_unknown`.

| Тип | Property | choices | Статус |
|---|---|---|---|
| `choice@1` | string@1 или string@2 | обязательны | формализует существующее |
| `integer@1` | integer@1 | запрещены | формализует существующее |
| `text@1` | string@2 | запрещены | новый |
| `toggle@1` | boolean@1 | запрещены | новый |

Новые типы добавлены только под реальные универсальные сценарии с видимым
результатом renderer: `text` — доступное название области (`aria-label` у
landmark), `toggle` — закрепление области при прокрутке (`sticky`).

## Правила типов

| | choice | integer | text | toggle |
|---|---|---|---|---|
| value schema | строка из choices | safe integer | строка 1..2000 code points | boolean |
| default | обязан быть choice | обязан пройти ограничения | обязан пройти ограничения | false или отсутствует |
| ограничения | min_length, max_length | min, max (обязательны) | min_length, max_length (max обязателен) | нет |
| форма → значение | точная строка | `^-?(0\|[1-9][0-9]*)$` | точная строка без trim и без Unicode-нормализации | `true` → true, отсутствие → false |
| пусто/нет значения | ключ удаляется | ключ удаляется | ключ удаляется | ключ удаляется |
| хранение | строка | число | строка | только true; false удаляет ключ |

Проверка `text`: корректный Unicode (`field_value_unicode`), без управляющих
символов U+0000–U+001F и U+007F, включая перевод строки (`field_value_control`),
длина в code points (`field_value_length`). Атрибут `maxlength` в fallback —
подсказка браузеру (он считает UTF-16), сервер проверяет code points. Остальные
коды: `field_value_choice`, `field_value_type`, `field_value_range`,
`field_submission_invalid` (toggle принимает только `true`).

Проверка manifest по типам — `validateFieldKinds`, в дополнение к
`validateEditorManifest`: `field_kind_unknown`, `field_constraint_unknown`,
`field_constraint_required`, `field_constraint_invalid` (min больше max),
`field_choice_invalid` (вариант нарушает min_length/max_length), `field_default_invalid`. Она не встроена в
`validateEditorManifest`, поэтому manifests продуктов с другими Property не
ломаются.

API: `resolveFieldKind`, `validateFieldValue`, `parseFieldSubmission(field,
raw)` (raw — строка или null), `applyFieldValue(node, field, result)` — новый
узел; исходный не меняется; результат с ошибкой — TypeError. Ключ `props.<target>` удаляется при unset, пустая
плоскость удаляется целиком. Итоговый узел нормализуется Document v1, поэтому
digest одинаков в JS и PHP.

## Новые manifests полей

`layout.region@1.0.0`, все поля — план `props`, владелец `simai/framework`,
подсказка прав `composition.node.update`:

- `placement` — choice string@2 (block, start, center, end), default block,
  basic, visible;
- `label` — text string@2, 1..120, basic, visible;
- `landmark` — choice string@2 (семь landmark), без default, advanced, collapsed;
- `sticky` — toggle boolean@1, default false, advanced, collapsed.

Имя области (`name`) намеренно не редактируется: это структурная идентичность,
по которой продукт связывает области со своими источниками.

## Доступность, темы, локализация

Имя поля — `label_key`, описание — `help_key` через `aria-describedby`.
Роли: choice — combobox (`select`), integer — spinbutton, text — textbox с
`dir="auto"`, toggle — switch (`input type=checkbox role=switch`). Клавиатура —
нативная. Поля `collapsed` выводятся внутри `<details>` с summary-названием;
`hidden` не выводятся и при сохранении пропускаются, их значения не меняются.
Цвета — токены `--sf-surface-1`, `--sf-on-surface`, `--sf-outline`,
`--sf-primary` в `@layer sf.components`, темы light и dark, видимый
`:focus-visible`, цель — WCAG 2.2 AA. Тексты — только через ключи
локализации продукта; подпись варианта — ключ `<label_key>.<choice>` для
стабильных значений. Нет перевода — выводится сам ключ или значение.

## Серверный fallback

`renderFieldFallback(projectedField, {instance, messages})` выдаёт разметку без
JavaScript: `<div class="sf-editor-field" data-sf-field-kind data-sf-field-group>`
с нативным контролом, `label for`, `name="<instance>.<plane>.<target>"` и
`<small class="sf-editor-field-help">`. Экранирование значений атрибутов и текста: `&` → `&amp;`, `<` → `&lt;`,
`>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`; других замен нет. Продукт может
заменить контрол на `sf-dropdown`, `sf-input` или `sf-switch`, сохраняя имя,
описание и нормализацию. Отправка разбирается `parseFieldSubmission`.

## Совместимость и откат

Прежние три поля и их Property не меняются; они лишь получают формальный тип.
Продукт, которому нужен новый тип, регистрирует его Property (string@2,
boolean@1) — без новой грамматики. Откат — возврат к предыдущей паре Core/Smart:
manifest `layout.region` исчезает вместе с типом, прежние поля не затрагиваются.
