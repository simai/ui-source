# Smart Context Menu

`<sf-context-menu>` добавляет к поверхности Context Menu проверенное управление
фокусом для плоского списка действий. Компоненту обязательно задают доступное имя
через `aria-label`.

Прямые нативные `button` и `a[href]`, а также нативные контролы прямых
`<sf-button>`, получают роль `menuitem` и один roving tab stop. Недоступные,
скрытые и `inert` элементы пропускаются. `ArrowUp`/`ArrowDown` перемещают фокус с
циклическим переходом, `Home`/`End` переходят к краям списка; активация остаётся
нативной.

## Стандартное меню

Любое меню действий строится одинаково: пункты задаются данными в свойстве
`entries`, меню открывается методом `openFor(кнопка)` или `toggleFor(кнопка)`.
Атрибут `popup` прячет меню до открытия.

```html
<button id="more" type="button">Ещё</button>
<sf-context-menu id="menu" popup aria-label="Действия со страницей"></sf-context-menu>
<script>
  menu.entries = [
    {type: 'heading', text: 'Страница'},
    {id: 'rename', text: 'Переименовать', icon: 'edit', shortcut: 'F2'},
    {id: 'lang', text: 'Язык', icon: 'translate', value: 'Русский', submenu: [
      {id: 'lang:ru', text: 'Русский', kind: 'radio', checked: true},
      {id: 'lang:en', text: 'English', kind: 'radio'},
    ]},
    {id: 'pin', text: 'Закрепить', icon: 'push_pin', kind: 'check', checked: false},
    {type: 'separator'},
    {id: 'archive', text: 'В архив', icon: 'archive', danger: true, caption: 'Можно вернуть'},
  ];
  more.addEventListener('click', () => menu.toggleFor(more));
  menu.addEventListener('sf-context-menu-select', (event) => {
    console.log(event.detail.id, event.detail.checked);
  });
</script>
```

Пункт содержит иконку, подпись и вторую строку `caption`, а в конце строки —
значение `value`, сочетание клавиш `shortcut`, отметку для `kind: 'check'` или
`'radio'` и стрелку подменю. Есть разделитель `{type: 'separator'}` и заголовок
группы `{type: 'heading'}`. Опасное действие отмечается `danger`, недоступное —
`disabled`. Если хотя бы у одного пункта есть иконка, место под иконку
сохраняется у всех, и подписи начинаются на одной линии.

Открытое меню находится в верхнем слое страницы: его не обрезает прокручиваемый
блок и не перекрывает таблица. Оно открывается под кнопкой по её началу, без
хвостика, а у края окна переворачивается вверх или сдвигается. Подменю
открывается сбоку, и его первый пункт стоит на одной линии с пунктом, который
его открыл.

Меню, открытое через `openFor`, управляет собой само. Стрелки перемещают фокус,
`→` открывает подменю, `←` и `Escape` закрывают текущий уровень, а `Tab` и
нажатие вне меню закрывают всё меню. Буква переводит фокус на следующий пункт,
который с неё начинается. После выбора меню закрывается и возвращает фокус
кнопке. Выбор на любом уровне приходит одним событием `sf-context-menu-select`;
чтобы меню осталось открытым, отмените событие или задайте пункту `keepOpen`.

### Меню профиля

Меню профиля собирается из тех же записей. Блок `{type: 'header'}` показывает,
о ком меню: имя, строки `caption` и фото `avatar` (без фото — инициалы). Ряд
`{type: 'choice'}` ставит несколько вариантов рядом, например тему; выбранный
вариант отмечается сразу, а меню остаётся открытым. Подменю с `search` открывается
с полем поиска: оно сужает пункты по подписи, второй строке и `keywords`, а `↓`
переводит к пунктам. Строка `{type: 'note'}` — пояснение мелким текстом.

```js
menu.entries = [
  {type: 'header', text: 'Анна Белова', caption: ['anna@example.com', 'Администратор']},
  {type: 'separator'},
  {type: 'choice', id: 'theme', text: 'Тема', options: [
    {id: 'light', text: 'Светлая', icon: 'light_mode', checked: true},
    {id: 'dark', text: 'Тёмная', icon: 'dark_mode'},
    {id: 'system', text: 'Как в системе', icon: 'contrast'},
  ]},
  {id: 'language', text: 'Язык', icon: 'translate', value: 'Русский',
    search: {placeholder: 'Найти язык', empty: 'Ничего не найдено'},
    submenu: [
      {id: 'ru', text: 'Русский', caption: 'Russian', kind: 'radio', checked: true, lang: 'ru'},
      {id: 'en', text: 'English', caption: 'English', kind: 'radio', lang: 'en'},
    ]},
  {type: 'separator'},
  {id: 'sign-out', text: 'Выйти', icon: 'logout', danger: true},
];
```

### Список, который ищет хост

Когда пунктов много и ищет сервер — например, сайты, — поиск задают с
`remote: true`. Меню не фильтрует пункты само: оно сообщает запрос событием
`sf-context-menu-search` и показывает те записи, которые хост поставит в
`entries`. В начале строки может стоять картинка `avatar` (логотип сайта, фото)
или инициалы `initials`.

```js
menu.search = {placeholder: 'Найти сайт', empty: 'Ничего не найдено', remote: true};
menu.addEventListener('sf-context-menu-search', async (event) => {
  menu.entries = await findSites(event.detail.query);
});
```

## Меню, которым управляет хост

Если меню открыто без `openFor`, жизненный цикл остаётся за хостом, как и раньше.
Кнопка вызова или другой хост открывает меню, передаёт фокус методом `focus()`,
закрывает его по `Escape`, `Tab` и внешнему действию, а затем возвращает фокус
инициатору. Атрибут `position` рисует хвостик, направленный к цели; меню,
открытому через `openFor`, он не нужен.

Автоматическое управление пунктами действует только для шаблона `default` с
`role="menu"`. Произвольные виджеты и пользовательские роли остаются под
ответственностью приложения.
