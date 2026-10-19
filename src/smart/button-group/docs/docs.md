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
- `size` — та же лестница, что у кнопок: сегмент равен по высоте кнопке того же
  размера, дорожка добавляет только свой отступ.
- Пункт: `value`, `label`, `icon`, `count`, `icon-only`, `aria-label`,
  `disabled`. `count` — число после подписи (табличные цифры), входит в
  доступное имя. `icon-only` показывает только иконку, `label` остаётся
  скрытым доступным именем; без `icon` флаг не действует.
- В узком контейнере дорожка прокручивается внутри себя и не расширяет страницу.
- Публичные переменные: `--sf-button-group-background-color` (дорожка),
  `--sf-button-group-padding`, `--sf-button-group-color` (сегмент),
  `--sf-button-group-plate-background-color`, `--sf-button-group-plate-color`,
  `--sf-button-group-count-color`.
