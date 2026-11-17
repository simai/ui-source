# Context Menu

`Context Menu` задаёт поверхность короткого списка действий и, при необходимости,
визуальный хвост, связывающий её с объектом. Обычный компонент отвечает только за
представление. Открытие, позиционирование относительно объекта, закрытие и возврат
фокуса принадлежат вызывающему сценарию.

## Структура

Корень `.sf-context-menu` содержит обязательную обёртку `.relative`, внутри которой
располагаются необязательный декоративный `.sf-context-menu-tooltip` и
`.sf-context-menu-content`. Такая структура оставляет хвост видимым, когда длинное
содержимое прокручивается внутри поверхности.

`<sf-menu-context>` вместо `.relative` пишет `.sf-context-menu-frame` и не ставит
утилит `flex`, `flex-col`, `flex-1`: раскладку его окна задаёт таблица компонента,
поэтому на странице не появляется поздно подключённых таблиц утилит.

Не назначайте обычной статической разметке `role="menu"`, если проект не реализует
полный клавиатурный контракт составного меню. Для готового плоского списка действий
используйте `<sf-menu-context aria-label="…">`: Smart-компонент назначает прямым
кнопкам и ссылкам `menuitem`, поддерживает один roving tab stop, `ArrowUp`,
`ArrowDown`, `Home` и `End`. Хост по-прежнему отвечает за открытие, `Escape`, `Tab`,
закрытие и возврат фокуса.

## Строки: разметка без скрипта

Строки меню — классы этого компонента; `<sf-menu-context>` рисует ту же разметку
(1.18.2: записано здесь, чтобы статичная разметка и примеры документации брали
строки, а не кнопки `sf-button`). Корень со строками получает
`sf-context-menu--entries`: он задаёт меню ширину, кегль, строку и иконку ступени.
Ступень — `sf-context-menu--size-1`; без неё — `1/2`.

```html
<div class="sf-context-menu sf-context-menu--entries">
  <div class="sf-context-menu-frame">
    <div class="sf-context-menu-content">
      <!-- действие с иконкой -->
      <button type="button" class="sf-context-menu-item">
        <span class="sf-context-menu-item-lead"><i aria-hidden="true" class="sf-icon sf-context-menu-item-icon">edit</i></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Изменить</span></span>
      </button>
      <!-- без иконки: пустая колонка держит текст на линии остальных строк -->
      <button type="button" class="sf-context-menu-item">
        <span class="sf-context-menu-item-lead"></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Копировать</span></span>
      </button>
      <!-- подпись под названием и значение в конце строки -->
      <button type="button" class="sf-context-menu-item">
        <span class="sf-context-menu-item-lead"></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Плотность</span><span class="sf-context-menu-item-under">Обычно</span></span>
      </button>
      <button type="button" class="sf-context-menu-item">
        <span class="sf-context-menu-item-lead"></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Сортировка</span></span>
        <span class="sf-context-menu-item-value">А–Я</span>
      </button>
      <!-- флажок: галочка в колонке иконок -->
      <button type="button" class="sf-context-menu-item" aria-pressed="true">
        <span class="sf-context-menu-item-lead"><i aria-hidden="true" class="sf-icon sf-context-menu-item-check">check</i></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Название</span></span>
      </button>
      <!-- вложенное меню -->
      <button type="button" class="sf-context-menu-item" aria-haspopup="menu" aria-expanded="false">
        <span class="sf-context-menu-item-lead"></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Вставить</span></span>
        <i aria-hidden="true" class="sf-icon sf-context-menu-item-chevron" data-sf-icon-mirror>chevron_right</i>
      </button>
      <!-- переключатель -->
      <button type="button" class="sf-context-menu-item sf-context-menu-item--switch" aria-pressed="true">
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Переносить строки</span></span>
        <span class="sf-context-menu-item-switch" aria-hidden="true"><span class="sf-context-menu-item-switch-thumb"></span></span>
      </button>
      <div class="sf-context-menu-separator" role="separator"></div>
      <button type="button" class="sf-context-menu-item sf-context-menu-item--danger">
        <span class="sf-context-menu-item-lead"><i aria-hidden="true" class="sf-icon sf-context-menu-item-icon">delete</i></span>
        <span class="sf-context-menu-item-text"><span class="sf-context-menu-item-label">Удалить</span></span>
      </button>
    </div>
  </div>
</div>
```

Состояния строки — модификаторы `.sf-context-menu-item`: `--chosen` (выбранный
вариант списка, где выбирают одно), `--current` (текущий раздел), `--danger`
(необратимое действие), `--disabled` вместе с `aria-disabled="true"` (строка видна,
но не нажимается). Заголовок группы — `.sf-context-menu-heading`, разделитель —
`.sf-context-menu-separator`. Роли `menu`/`menuitem` и клавиши ставит
`<sf-menu-context>`; статичной разметке их не назначают (см. «Структура»).
Кнопки `sf-button` прямо в `.sf-context-menu-content` по-прежнему строятся как
строки (раздел «Кнопки в меню»), но их разметка — не разметка строки: для
подписи, значения, флажка и стрелки берите строки этого раздела.

Варианты поля выбора (`.sf-dropdown`) — не строки меню: это `.sf-list-item`
списка поля (компонент Dropdown, раздел о вариантах), ту же разметку рисует
`<sf-dropdown>`.

## Ширина

Ширина зависит от того, что лежит в окне (решение C32). Разметке без атрибута
ширина меню: по самой длинной строке в пределах `--sf-popup-menu-min-width` и
`--sf-popup-menu-max-width` (10–18rem). Другие виды задаёт `data-sf-width` на
`.sf-context-menu-content`:

- `list` — варианты у поля: не уже кнопки, до `--sf-popup-list-max-width`
  (20rem) или до ширины кнопки, если она шире; длинный вариант переносится,
  и над текстом и под ним остаётся тот же отступ, что у строки в одну строку,
  (высота строки − строка текста) / 2, так что строка растёт на целые строки;
- `panel` — панель с поиском и действиями: `--sf-popup-panel-width` (20rem) или
  ширина кнопки, если она шире;
- `form`, `form-wide` — форма: `--sf-popup-form-width` (20rem) и
  `--sf-popup-form-wide-width` (24rem).

Ширину кнопки читают из `--sf-context-menu-trigger-inline-size`; `<sf-menu-context>`
пишет её сам, своя разметка задаёт её на `.sf-context-menu`. При
`data-sf-density="compact"` ступени уменьшаются вместе с текстом (×14/16 до
ступени шкалы): 9–16rem, 18rem, 18rem, 22rem. Окно не шире экрана без полей.
Атрибут `data-sf-sheet` на `.sf-context-menu` ставит окно шторкой снизу на всю
ширину экрана, над затемнением, — так `<sf-menu-context>` показывает форму на
телефоне.

## Положение хвоста

Для новой разметки используйте логические значения: `inline-start`,
`inline-start-top`, `inline-start-bottom`, `inline-end`, `inline-end-top`,
`inline-end-bottom`, `top`, `top-inline-start`, `top-inline-end`, `bottom`,
`bottom-inline-start`, `bottom-inline-end`. Они корректно отражаются в RTL.
Физические `left`/`right` варианты сохранены только для совместимости.

Без модификатора положения поверхность выводится без хвоста. Радиус поверхности —
семантический `--sf-radius--surface`; размер хвоста задаётся
`--sf-context-menu-tail-size` с токенным значением по умолчанию.

## Поиск

В меню с поиском содержимое получает `.sf-context-menu-content--search` и
тогда не прокручивается: сверху стоит шапка поиска
`.sf-context-menu-search` (и заголовок уровня панели с заходом), под ней —
`.sf-context-menu-list`, своя область прокрутки для пунктов и пояснения
«ничего не найдено». Шапка остаётся на месте, полоса прокрутки начинается под
ней.

Шапка поиска — не поле в рамке: без рамки и заливки, высотой в строку и
отступ панели сверху и снизу, под ней линия `--sf-outline-variant` на всю
ширину панели. Иконка поиска `.sf-context-menu-search-icon` и текст стоят
ровно над иконками и текстом строк: слева у шапки отступ панели и отступ
строки. В меню без ведущей колонки (ни у одной строки нет иконки, галочки
или картинки) текст поиска стоит над текстом строк, а иконка — в конце
шапки. Пока в поле фокус, линия под шапкой — цвета `--sf-primary`. Список
отступает от краёв панели на тот же отступ, что и без поиска. Проба:
`tests/browser/context-menu-search-scroll.browser.mjs`.

## Отступ панели

Подсветка строки отступает от края панели на `--sf-space-1/4` (переменные
`--sf-context-menu-padding-inline` и `--sf-context-menu-padding-block`) и
скруглена `--sf-radius--ui` (`--sf-context-menu-row-radius`); подсветка не во
всю ширину. Строка высотой в контрол своей ступени
(`--sf-ui-1/2--control-height`, у `size-1` — `--sf-ui-1--control-height`),
иконка и текст стоят в `--sf-space-1/2` от края подсветки, между иконкой и
текстом — `--sf-space-1/2`. На той же линии начинаются заголовки, пояснения,
строки со значением, заголовок уровня, шапка профиля и подвал. Все размеры —
переменные SIMAI Framework, без пикселей.

Рамка панели входит в отступ (1.9.3, решение владельца C105 H4, как отступ
полей C77): по горизонтали подсветки строк, поиск, заголовок уровня, подвал и
тело панели стоят на отступ минус ширина рамки от её внутреннего края, поэтому
иконка или текст строки — в 16 px от внешнего края панели (плотно и на
телефоне 12), а не в 17 (13). Промежутки по сторонам ползунка полосы
прокрутки — весь отступ.

Полоса прокрутки появляется, только когда строки не помещаются. Если она
занимает место (классическая полоса), она стоит в правом отступе: область
прокрутки получает `.sf-context-menu-content--scrollbar` или
`.sf-context-menu-list--scrollbar` и отдаёт свой правый отступ, а дорожка —
отступ, ползунок шириной `--sf-space-1/4` и снова отступ. От подсветки до
ползунка столько же, сколько от края панели до подсветки слева. Наложенная
полоса (по умолчанию в macOS) места не занимает, и отступ справа остаётся.
В Firefox полоса тонкая (`scrollbar-width: thin`).

Панель, которой до места у края окна не хватает меньше отступа от края,
занимает свою полную высоту: пункты, которые помещаются, не получают полосу
прокрутки. Проба: `tests/browser/context-menu-inset-overflow.browser.mjs`.

Прокрутка меню не уходит дальше него: у содержимого, у
`.sf-context-menu-list` и у тела панели с вкладками стоит
`overscroll-behavior: contain`, поэтому колесо, докрученное до конца списка,
не прокручивает страницу или таблицу под меню. Проба:
`tests/browser/context-menu-host-search.browser.mjs`.

## Выбранная строка

`.sf-context-menu-item--chosen` — выбранная строка списка, где выбирают
одно: мягкая заливка `--sf-primary-container` (ступень 12 в светлой теме,
24 в тёмной; выбранное и текущее — одна роль, C16), при наведении — следующая ступень. Галочки и места под неё в
конце строки нет. Галочка строки с флажком `.sf-context-menu-item-check`
стоит в колонке иконок `.sf-context-menu-item-lead`.

## Касание

При грубом указателе (`@media (pointer: coarse)` — палец) каждая строка меню —
действие, флажок, вариант выбора, строка-кнопка — не ниже 44px (`--sf-d1`):
строка 1/2 высотой 24–32px была меньше пальца (simai/ui-source#25). Содержимое
остаётся на средней линии строки. При мыши строки остаются на лестнице размеров.
Проба: `tests/browser/context-menu-touch-target.browser.mjs`.

## Строки в несколько строк

Строка, в которой больше одной строки текста, сохраняет отступы однострочной
строки — (высота строки − строка текста) / 2 — и растёт целыми строками
(решение C49, G1-b; `docs/foundation-composition-geometry.md` §4). Так
устроены строка с подписью или значением под названием в любом меню, строка
раскрывающейся панели (`sf-settings look="drill"`) и строка с переключателем,
которые переносят длинное название. Строка с подписью: 48 [6/6] на компьютере,
60 [14/14] при касании на телефоне (было 40 [2/2] и 44). Однострочные строки не
меняются: их высота — минимум строки.

## Кнопки в меню и цвет иконок (1.17.0, решения C105 H4, C107, C240)

Кнопки `.sf-button` / `sf-button`, положенные прямо в
`.sf-context-menu-content`, строятся как строки меню: плашка в 4 от края
панели, текст или иконка в 16 от края на компьютере и в 12 на телефоне,
между иконкой и текстом 12 (на телефоне 8), иконка — `--sf-on-surface-variant`,
при наведении — заливка строки `--sf-surface-state-select`, текст не меняет
цвета, иконка догоняет его. Ширина панели — как у меню из строк.

Иконка строки берёт цвет `--sf-context-menu-item--icon`
(`--sf-on-surface-variant`); при наведении и нажатии — цвет подписи, у
текущей и выбранной строки — `--sf-on-primary-container`, у недоступной —
`--sf-on-surface-disabled`. Если список прокручивается, правый отступ
содержимого убирается, и полоса прокрутки стоит в 4 от плашек строк (было 8);
браузер без scroll-timeline сохраняет прежний отступ.

