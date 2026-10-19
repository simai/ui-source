# Smart Button Group

`sf-button-group` — управляемый взаимоисключающий выбор, визуально собранный из
Button Group и Smart Buttons. Это `radiogroup`, а не generic action group.

Передайте уникальные `value`, понятные `label`, начальный `value` и доступное
имя группы. Runtime создаёт ровно одну нативную radio-семантику на пункт,
поддерживает один roving tab stop, disabled items, стрелки, Home и End.

`orientation="horizontal|vertical"` одновременно меняет геометрию и допустимую
ARIA orientation. Состояние остаётся controlled через атрибут `value`; после
изменения компонент отправляет `change` — общее имя для всех полей значения;
прежнее имя `sf-button-group-change` приходит с тем же detail. Сохранение выбора и
бизнес-действие принадлежат приложению.

Для независимых команд используйте обычный `.sf-button-group` с `role="group"`,
не Smart-компонент.

## Сегментированный вид

`appearance="segmented"` рисует ту же группу как сегментированный контрол:
утопленную дорожку на заливке контейнера, сегменты без рамок и плашку под
выбранным. Семантика не меняется: `radiogroup`, один roving tab stop, стрелки,
Home и End, `change`, `select()` и `clear()`. Это не вкладки — панелей нет.

```html
<sf-button-group appearance="segmented" aria-label="Тема" value="all"
  items='[{"value":"all","label":"Все","count":24},
          {"value":"light","label":"Светлые","count":17},
          {"value":"dark","label":"Тёмные","count":7}]'></sf-button-group>

<sf-button-group appearance="segmented" plate="raised" full-width aria-label="Период" value="w"
  items='[{"value":"d","label":"День"},{"value":"w","label":"Неделя"},{"value":"m","label":"Месяц"}]'></sf-button-group>

<sf-button-group appearance="segmented" size="1/2" aria-label="Вид" value="list"
  items='[{"value":"list","label":"Список","icon":"list","icon-only":true},
          {"value":"grid","label":"Сетка","icon":"grid_view","icon-only":true}]'></sf-button-group>
```

- `plate="scheme|raised"` — плашка выбранного сегмента: заливка `scheme`
  (`primary`, `secondary`, `on-surface`) или приподнятая нейтральная поверхность.
- `full-width` — дорожка занимает ширину контейнера, сегменты делят её поровну.
- `radius="default|square|rounded"` — как у `sf-button`; пустое значение —
  обычный радиус элементов. Плашка — сегмент размером с кнопку, поэтому она
  получает радиус кнопки с тем же значением, а у дорожки радиус больше на её
  отступ, и углы концентричны: при `rounded` и плашка, и дорожка — «таблетки»,
  при `square` плашка прямоугольная, а дорожка скруглена на величину отступа.
  В обычном виде радиус получают внешние углы группы.
- `size` — та же лестница, что у кнопок: дорожка равна по высоте кнопке того
  же размера и `spacing`, поэтому группа и переключатель темы стоят в одном
  ряду с кнопками. Сегменты внутри на шаг меньше — компактный шаг кнопки, а
  отступ дорожки равен разнице. На размере `1/3` компактная кнопка не меньше
  обычной, поэтому отступ дорожки — 2 px.

  | `size` | кнопка и дорожка | сегмент | отступ дорожки |
  |---|---|---|---|
  | `1/3` | 24 | 20 | 2 |
  | `1/2` | 32 | 28 | 2 |
  | `1` | 40 | 32 | 4 |
  | `2` | 48 | 40 | 4 |
  | `3` | 56 | 48 | 4 |

  Значения — для экрана шире 60rem; на узком экране кнопки ниже, и группа
  меняется вместе с ними.
- Пункт: `value`, `label`, `icon`, `count`, `icon-only`, `aria-label`,
  `disabled`. `count` — число после подписи (табличные цифры), входит в
  доступное имя. `icon-only` показывает только иконку, `label` остаётся
  скрытым доступным именем; без `icon` флаг не действует.
- В узком контейнере дорожка прокручивается внутри себя и не расширяет страницу.
- Публичные переменные: `--sf-button-group-background-color` (дорожка),
  `--sf-button-group-padding`, `--sf-button-group-radius` (углы сегмента и
  плашки, дорожка — плюс отступ; атрибут `radius` важнее), `--sf-button-group-color` (сегмент),
  `--sf-button-group-plate-background-color`, `--sf-button-group-plate-color`,
  `--sf-button-group-count-color`.

## В форме

С атрибутом `name` группа участвует в форме, как другие Smart-поля: при
отправке форма получает `name=value` выбранного пункта, сброс формы
(`reset`) возвращает значение, с которым группа была написана, а
`disabled` исключает группу из отправки. Значение несёт скрытое поле
`<input type="hidden">` рядом с группой.

```html
<form>
  <sf-button-group appearance="segmented" name="period" value="w" aria-label="Период"
    items='[{"value":"d","label":"День"},{"value":"w","label":"Неделя"},{"value":"m","label":"Месяц"}]'></sf-button-group>
</form>
```

## Переключатель темы

Готовый переключатель темы — сегментированная группа с атрибутом
`theme-switch`:

```html
<sf-button-group appearance="segmented" theme-switch></sf-button-group>
```

- Группа сама рисует три пункта только с иконками: `system` («Как в системе»,
  `brightness_auto`), `light` («Светлая», `light_mode`) и `dark` («Тёмная»,
  `dark_mode`). Подписи и имя группы («Тема») берутся на языке страницы;
  `aria-label` на группе заменяет имя группы. `items` не используется.
- Выбран пункт **предпочтения** темы (`SF.Loader.themePreference`), а не
  нарисованной темы: «Как в системе» остаётся выбранным, когда система
  тёмная.
- Выбор вызывает `SF.Loader.setTheme('system' | 'light' | 'dark')`; Loader
  сохраняет выбор и ставит `theme-dark` или `theme-light` на `<html>`.
  `change` приходит, когда тема уже сменилась.
- Переключатель следует за темой, изменённой в другом месте: он слушает
  событие `sf-theme-change` (другой переключатель, `.sf-theme-button`,
  прямой вызов `SF.Loader.setTheme`).
- Клавиатура та же, что у группы: стрелки, Home и End, один tab stop.
- Без Loader или при `SF_BOOT_CONFIG.theme === false` выбор не меняется.
- Остальные атрибуты группы работают: `size`, `plate`, `radius`, `scheme`.
