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
