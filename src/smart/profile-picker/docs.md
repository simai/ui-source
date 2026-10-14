# Smart Profile Picker

`<sf-profile-picker>` — один способ работать с профилями: профилями меню, видами
записи и всем, у чего будут профили. В свёрнутом виде это кнопка, похожая на
поле: «Профиль: Обычный». В открытой панели всё делается на месте:

- строка на каждый профиль: значок (человек — личный, группа — общий),
  название и подпись «Личный» или «Для всех». Текущий отмечен галочкой;
- «Переименовать» и «Удалить» в самой строке. Удаление переспрашивает прямо в
  строке. У профиля без прав стоит замок, у стандартного этих действий нет;
- «Новый профиль…» открывает форму в списке: название и «Личный / Для всех».
  Новый профиль — копия текущего;
- «Сбросить к стандартному» внизу, если задан `resettable`.

```html
<sf-profile-picker id="profiles" label="Профиль" resettable></sf-profile-picker>
<script>
  profiles.profiles = [
    {id: 'regular', label: 'Обычный', shared: true, builtin: true},
    {id: 'editors', label: 'Редакторы', shared: true},
    {id: 'mine', label: 'Мой', shared: false},
  ];
  profiles.rights = {create: {personal: false, shared: true}};
  profiles.setAttribute('current', 'regular');
  profiles.addEventListener('sf-profile-select', (event) => console.log(event.detail.id));
</script>
```

Профили и права принадлежат сайту. Компонент не меняет свой список сам: он
сообщает, что попросил человек, — `sf-profile-select {id}`,
`sf-profile-create {label, shared, from}`, `sf-profile-rename {id, label}`,
`sf-profile-delete {id}`, `sf-profile-reset {id}`. Сайт отвечает новым списком
`profiles` и `current` или текстом в `message`, если отказал.

- `profiles` — `{id, label, shared, builtin, editable}`. `editable: false` —
  профиль можно выбрать, но нельзя менять. `builtin` — стандартный профиль, его
  не переименовывают и не удаляют.
- `rights.create` — `{personal, shared}`: какие профили человек может создать.
  Личный профиль у человека один: если он уже есть, сайт передаёт
  `personal: false`.
- `size` — `1/2` (по умолчанию) или `1`.

Клавиатура: стрелки, Home и End ходят по строкам, Enter выбирает, F2
переименовывает, Delete удаляет, Escape закрывает форму, а затем панель.
