#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Every public variable (src/core/contracts/public-variables.v1.json) changes
// what it says it changes, on the built bytes. Each component is drawn by its
// Smart element at rest; each variable is set on an ancestor, as the contract
// says a page may, to a value nothing else uses, and the property its role
// names has to take that value on the component's root or on one of the parts
// inside it (an input paints its box on the field, a switch on its track). A
// variable the stylesheet reads but a more specific rule beats, or reads only
// inside a state, passes the source contract and fails here (2026-10-18: it
// found the button's border variables doing nothing on a non-outline button).
// Transitions are off: a style read during an ease reads where it started.
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-variables.v1.json', import.meta.url), 'utf8'));

// The element that draws each component at rest, its sheets and its module;
// `open` puts an overlay on the screen. A component the contract adds without
// an entry here fails, so the probe grows with the contract.
const DRAW = {
  // A count anchored on an icon besides the label: the ring is drawn on the
  // anchored badge alone (simai/ui-source#12).
  badge: {css: ['badges'], js: 'badge', html: '<sf-badge text="Новое" size="1"></sf-badge><span class="sf-badge-anchor"><i class="sf-icon" aria-hidden="true">mail</i><span class="sf-badge sf-badge--anchored" aria-hidden="true">3</span></span>'},
  // A pressed toggle beside the button: the pressed variables colour its resting look.
  button: {css: ['buttons'], js: 'button', html: '<sf-button text="Сохранить" size="1"></sf-button><sf-button text="Жирный" icon-start="format_bold" appearance="outline" scheme="on-surface" pressed size="1"></sf-button>'},
  // A variable of a state (standard 1.3.8 §6) is measured on an instance in
  // that state, drawn beside the one at rest.
  input: {css: ['inputs'], js: 'input', html: '<sf-input label="Имя" value="Текст" size="1"></sf-input><sf-input label="Ошибка" invalid size="1"></sf-input>'},
  alert: {css: ['alerts', 'icon-buttons'], js: 'alert', html: '<sf-alert title="Сообщение" supporting-text="Текст"></sf-alert>'},
  tag: {css: ['tags'], js: 'tag', html: '<sf-tag text="Метка" size="1"></sf-tag>'},
  'icon-button': {css: ['icon-buttons'], js: 'button-icon', html: '<sf-button-icon icon="add" aria-label="Добавить" size="1"></sf-button-icon><sf-button-icon icon="format_bold" aria-label="Жирный" appearance="outline" scheme="on-surface" pressed size="1"></sf-button-icon>'},
  checkbox: {css: ['checkbox'], js: 'checkbox', html: '<sf-checkbox label="Флажок" size="1"></sf-checkbox><sf-checkbox label="Отмечен" checked size="1"></sf-checkbox><sf-checkbox label="Ошибка" invalid size="1"></sf-checkbox>'},
  'radio-button': {css: ['radio'], js: 'radio', html: '<sf-radio label="Вариант" size="1"></sf-radio><sf-radio label="Выбран" name="r" checked size="1"></sf-radio><sf-radio label="Ошибка" invalid size="1"></sf-radio>'},
  switch: {css: ['switch'], js: 'switch', html: '<sf-switch label="Включено" size="1"></sf-switch>'},
  textarea: {css: ['textarea'], js: 'input-textarea', html: '<sf-input-textarea label="Текст" value="Строка" size="1"></sf-input-textarea><sf-input-textarea label="Ошибка" invalid size="1"></sf-input-textarea>'},
  toast: {css: ['toast', 'icon-buttons'], js: 'toast', html: '<sf-toast status="info" title="Сохранено" supporting-text="Изменения доступны."></sf-toast>'},
  modal: {css: ['modal', 'icon-buttons', 'buttons'], js: 'modal', html: '<sf-modal id="modal" title="Окно"><p>Текст</p><button slot="footer" type="button">Отмена</button><button slot="footer" type="button">Удалить</button></sf-modal>',
    open: 'document.getElementById("modal").open()'},
  tooltip: {css: ['tooltip'], js: 'tooltip', html: '<sf-tooltip text="Подсказка" supporting-text="Пояснение" size="1"></sf-tooltip>'},
  tabs: {css: ['tabs', 'buttons'], js: 'tabs', html: '<sf-tabs type="underline" size="1" items="Обзор|Настройки|История"></sf-tabs>'},
  avatar: {css: ['avatars'], js: 'avatar', html: '<sf-avatar text="АБ" size="1"></sf-avatar>'},
  // A drilling panel beside the flyout menu: the fixed width is a drilling
  // panel's (submenu="drill"), so one has to be on the stage to measure it.
  'context-menu': {css: ['context-menu', 'buttons', 'icons', 'icon-buttons'], js: 'menu-context', html: '<button id="anchor" type="button">Меню</button><sf-menu-context id="menu" popup aria-label="Меню"></sf-menu-context>'
    + '<sf-menu-context submenu="drill" aria-label="Настройки" entries=\'[{"id":"sound","type":"switch","text":"Звук","value":true},{"id":"lang","text":"Язык","value":"Русский","submenu":[{"id":"ru","text":"Русский"}]}]\'></sf-menu-context>',
    open: 'const m = document.getElementById("menu"); m.entries = [{id: "a", text: "Открыть"}, {id: "b", text: "Удалить"}]; m.toggleFor(document.getElementById("anchor"))'},
  // The variables belong to the segmented appearance; a count is drawn on a
  // segment that is not selected, so the count's own colour has a part to reach.
  'button-group': {css: ['button-group', 'buttons'], js: 'button-group',
    html: `<sf-button-group appearance="segmented" aria-label="Тема" value="all" items='[{"value":"all","label":"Все","count":24},{"value":"dark","label":"Тёмные","count":7}]'></sf-button-group>`},
  // A Smart element with a sheet of its own: a css entry with a slash is a
  // path in the output. Empty, so the glyph's thumbnail is drawn without an
  // image to wait for.
  'image-field': {css: ['buttons', 'smart/smart/input-image/css/input-image.css'], js: 'input-image',
    html: '<sf-input-image label="Логотип" size="1"></sf-input-image>'},
  // The class accordion's sheet, drawn by sf-accordion in each appearance: the
  // fill and radius are the default one's, the border the outline's, and the
  // first section is open so its content has a colour to take.
  accordion: {css: ['accordion', 'icons', 'smart/smart/accordion/css/accordion.css'], js: 'accordion',
    html: ['default', 'outline', 'flush'].map((appearance) => `<sf-accordion appearance="${appearance}" items='[{"id":"a","title":"Раздел","content":"Текст","open":true},{"id":"b","title":"Ещё раздел","content":"Текст"}]'></sf-accordion>`).join('')},
  // sf-quantity draws the class markup; the class sheet and the icon buttons
  // its steppers are draw it.
  quantity: {css: ['quantity', 'icon-buttons'], js: 'input-quantity',
    html: '<sf-input-quantity label="Количество" value="3" min="0" max="10" size="1"></sf-input-quantity><sf-input-quantity label="Ошибка" value="3" invalid size="1"></sf-input-quantity>'},
  // The class menu's sheet, drawn by sf-menu as a column and as a row whose
  // panel is open, so the panel's own variables have a part to reach.
  menu: {css: ['menu', 'icons', 'icon-buttons', 'smart/smart/menu/css/menu.css'], js: 'menu',
    html: `<sf-menu label="Разделы" items='[{"id":"a","label":"Обзор","href":"#a"},{"id":"b","label":"Каталог","href":"#b"}]'></sf-menu>`
      + `<div style="inline-size:900px"><sf-menu id="row" orientation="horizontal" label="Шапка" items='[{"id":"c","label":"Каталог","children":[{"id":"d","label":"Решения","href":"#d"}]},{"id":"e","label":"Контакты","href":"#e"}]'></sf-menu></div>`,
    open: 'document.getElementById("row").open("c")'},
  // The class verification's sheet, drawn by sf-code-input bordered and
  // filled: the fill varies with the appearance, the border is the bordered
  // one's, and a character in the cells has a colour to take. Neither has
  // focus, so the current cell is the only one drawn in its own colour.
  verification: {css: ['verification', 'smart/smart/input-code/css/input-code.css'], js: 'input-code',
    html: '<sf-input-code label="Код" value="12" size="1"></sf-input-code><sf-input-code label="Код" value="12" appearance="filled" size="1"></sf-input-code><sf-input-code label="Код" value="12" invalid size="1"></sf-input-code>'},
  // Group B of the form fields, with their move to standard 1.3.8
  // (2026-10-27). Each state a variable colours is drawn: the country list
  // open, a colour on a preset and one with nothing chosen, a value shown as
  // text, a file held over the second area, a chosen day and a chosen range.
  'country-code': {css: ['country-code'], js: 'input-country',
    html: '<sf-input-country label="Телефон" value="+7 999 123-45-67" size="1"></sf-input-country>',
    open: 'document.querySelector(".sf-country-code").classList.add("open")'},
  color: {css: ['smart/smart/input-color/css/input-color.css'], js: 'input-color',
    html: '<sf-input-color label="Цвет" value="#1f6feb" swatches="#1f6feb|Синий, #d1242f|Красный"></sf-input-color><sf-input-color label="Цвет"></sf-input-color>'},
  'range-slider': {css: ['range-slider'], js: 'slider-range',
    html: '<div style="inline-size:400px;padding:40px 20px"><sf-slider-range aria-label="Громкость" value="40" label="text"></sf-slider-range></div>'},
  'file-upload': {css: ['file-upload', 'featured-icon'], js: 'file-upload',
    html: '<sf-file-upload aria-label="Документы"></sf-file-upload><sf-file-upload id="held" aria-label="Документы"></sf-file-upload>',
    open: 'document.getElementById("held").setAttribute("data-dragged-over", "true")'},
  // Display group A (standard 1.3.8, 2026-10-27): each state a variable
  // colours is drawn -- a copy that succeeded and one that failed, an open
  // explanation.
  close: {css: ['close'], js: 'button-close', html: '<sf-button-close size="1"></sf-button-close>'},
  icon: {css: ['icons'], js: 'icon', html: '<sf-icon icon="home" size="1"></sf-icon>'},
  'reference-link': {css: ['reference-link', 'icons'], js: 'reference-link',
    html: '<sf-reference-link label="Документация" text="/docs/" href="#" size="1"></sf-reference-link>'},
  'download-file': {css: ['icons', 'download-file'], js: 'file-download',
    html: '<sf-file-download file-name="Отчёт.pdf" file-size="2 МБ" href="#"></sf-file-download>'},
  'copy-button': {css: ['icon-buttons', 'icons', 'smart/smart/button-copy/css/button-copy.css'], js: 'button-copy',
    html: '<sf-button-copy value="a" label="Копировать" duration="60000"></sf-button-copy><sf-button-copy value="b" label="Копировать" duration="60000"></sf-button-copy><sf-button-copy value="c" label="Копировать" duration="60000"></sf-button-copy>',
    open: 'const [, ok, failed] = document.querySelectorAll("sf-button-copy"); ok.setPhase("success", ""); failed.setPhase("error", "")'},
  'help-mark': {css: ['icon-buttons', 'icons', 'smart/smart/help-mark/css/help-mark.css'], js: 'help-mark',
    html: '<sf-help-mark id="hm" heading="Заголовок" text="Пояснение"></sf-help-mark>', open: 'document.getElementById("hm").open()'},
  datepicker: {css: ['datepicker', 'buttons', 'icon-buttons'], js: 'input-date',
    html: '<sf-input-date input="false" value="2026-09-03"></sf-input-date><sf-input-date input="false" range start-value="2026-09-01" end-value="2026-09-07"></sf-input-date>'},
  // The navigation family, with its move to standard 1.3.8 (2026-10-27): a
  // trail with a plain crumb, a link and the current page (the link's hover
  // colour is a state the probe does not reach); steps with one completed and
  // one current. sf-pagination is not in the contract yet: six of its nine
  // variables style page numbers and a top row the element no longer draws.
  breadcrumbs: {css: ['breadcrumbs', 'icons'], js: 'breadcrumbs',
    html: `<sf-breadcrumbs aria-label="Навигация" items='[{"label":"Главная","href":"#"},{"label":"Раздел"},{"label":"Страница"}]'></sf-breadcrumbs>`},
  steps: {css: ['step', 'icons'], js: 'steps',
    html: `<sf-steps aria-label="Этапы" current="1" items='[{"label":"Черновик"},{"label":"Проверка"},{"label":"Готово"}]'></sf-steps>`},
  // Display group B with its move to standard 1.3.8 (2026-10-27): each part a
  // variable reaches is drawn -- the percentage beside a bar, a spinner's
  // words, a wave and two bars, an error's actions, a file's row with its
  // buttons, a slider's thumbnails, a gallery's inline caption, a handle at
  // rest and one being dragged, a picker's folded trigger.
  'progress-bar': {css: ['progress-bar'], js: 'progress-bar',
    html: '<sf-progress-bar label="Загрузка" value="40" text-position="inline-end"></sf-progress-bar>'},
  'progress-scale': {css: ['progress-scale'], js: 'progress-scale',
    html: '<sf-progress-scale label="Этапы" value="45"></sf-progress-scale>'},
  // The percentage is shown, so its colour has a part to reach.
  'progress-ring': {css: ['progress-ring'], js: 'progress-ring',
    html: '<sf-progress-ring label="Загрузка" value="40" show-text></sf-progress-ring>'},
  spinner: {css: ['spinner'], js: 'spinner',
    html: '<sf-spinner label="Загрузка данных" size="2"></sf-spinner>'},
  skeleton: {css: ['skeleton'], js: 'skeleton',
    html: '<sf-skeleton count="2" animation="wave"></sf-skeleton>'},
  'empty-state': {css: ['featured-icon', 'buttons', 'smart/smart/empty-state/css/empty-state.css'], js: 'empty-state',
    html: '<sf-empty-state kind="error"></sf-empty-state>'},
  'file-preview': {css: ['file-preview', 'icon-buttons'], js: 'file-preview',
    html: '<sf-file-preview file-name="Отчёт.pdf" file-size="2 МБ" href="#"></sf-file-preview>'},
  slider: {css: ['slider', 'icon-buttons'], js: 'slider',
    html: '<div style="inline-size:600px"><sf-slider thumbs><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Один"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Два"></sf-slider></div>'},
  gallery: {css: ['slider', 'modal', 'icon-buttons', 'smart/smart/gallery/css/gallery.css'], js: ['slider', 'gallery'],
    html: '<div style="inline-size:600px"><sf-gallery thumbs="false"><figure slot="slide"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Один"><figcaption>Подпись</figcaption></figure></sf-gallery></div>'},
  resizer: {css: ['smart/smart/resizer/css/resizer.css'], js: 'resizer',
    html: '<nav style="position:relative;inline-size:300px;block-size:100px"><sf-resizer min="200" max="400"></sf-resizer></nav><nav style="position:relative;inline-size:300px;block-size:100px"><sf-resizer min="200" max="400" data-sf-resizing></sf-resizer></nav>'},
  'profile-picker': {css: ['smart/smart/profile-picker/css/profile-picker.css'], js: 'profile-picker',
    html: '<sf-profile-picker label="Профиль"></sf-profile-picker>'},
  // The editors and screens (2026-10-27): a favourite with an action, so the
  // star's colour and the actions' gap have a part to reach.
  'page-header': {css: ['badges', 'icon-buttons', 'icons', 'smart/smart/header-page/css/header-page.css'], js: 'header-page',
    html: '<sf-header-page heading="Каталог" count="4" star><button slot="actions" type="button">Создать</button></sf-header-page>'},
  // A two-line row of a sortable list: the supporting line and the handle
  // have parts to reach; the row stands alone, so its divider is drawn.
  'list-item': {css: ['dropdown', 'icons'], js: 'list-item',
    html: '<sf-list-item text="Заголовок" supporting="Пояснение" sortable-item="a" interactive size="1"></sf-list-item>'},
  // A tree with an open folder (a second level, so the indent has a row to
  // move) and a selected row; a standalone node marked as a drop target.
  tree: {css: ['tree', 'tree-item', 'icons', 'icon-buttons'], js: 'tree',
    html: '<sf-tree aria-label="Папки" selection="one" selected="b"><sf-tree-item label="Папка" value="a" open><sf-tree-item label="Файл" value="b" kind="file"></sf-tree-item></sf-tree-item></sf-tree>'},
  'tree-item': {css: ['tree-item', 'icons', 'icon-buttons'], js: 'tree-item',
    html: '<sf-tree-item id="node" label="Папка" value="a" open><sf-tree-item label="Файл" value="b" kind="file"></sf-tree-item></sf-tree-item>',
    open: 'document.querySelector("#node > .sf-tree-item").setAttribute("data-sf-drop-target", "")'},
  // The generator's own markup at rest: the labels and the palettes' rows.
  'theme-generator': {css: ['smart/smart/theme-generator/css/theme-generator.css'], js: 'theme-generator',
    html: '<sf-theme-generator value="#2e7d32"></sf-theme-generator>'},
  // The frame takes the fill, the border, the radius and the colour; the text
  // area the padding; the invalid instance the invalid border.
  'rich-text': {css: ['icon-buttons', 'icons', 'smart/smart/input-rich/css/input-rich.css'], js: 'input-rich',
    html: '<sf-input-rich label="Text" value="<p>Line</p>" rows="2"></sf-input-rich><sf-input-rich label="Error" invalid rows="2"></sf-input-rich>'},
  // The frame at rest and invalid; a third opened from its options, so the
  // list's surface is measured on its panel (the focused frame has its own
  // fill and border, as sf-input's).
  lookup: {css: ['tags', 'avatars', 'icon-buttons', 'icons', 'smart/smart/input-lookup/css/input-lookup.css'], js: 'input-lookup',
    html: '<sf-input-lookup label="Город" value="moscow"><script type="application/json" data-sf-settings>{"options":[{"value":"moscow","label":"Москва"}]}</script></sf-input-lookup><sf-input-lookup label="Ошибка" invalid></sf-input-lookup><sf-input-lookup id="lk" label="Список"><script type="application/json" data-sf-settings>{"options":[{"value":"moscow","label":"Москва"},{"value":"kazan","label":"Казань"}]}</script></sf-input-lookup>',
    open: 'const l = document.getElementById("lk"); l.querySelector("input").focus(); l.search("")'},
  // The error row (an address that cannot load: the page is about:blank)
  // takes the gap, padding, border, radius and message colour; the second,
  // with no address, waits with its placeholder, which takes the block size.
  include: {css: ['skeleton', 'buttons', 'icons', 'smart/smart/include/css/include.css'], js: ['include', 'skeleton'],
    html: '<sf-include src="/missing/part"></sf-include><sf-include lines="2"></sf-include>'},
  // Block confirm (2026-11-03): the card form of the plain question takes the
  // inset, corner, fill and edge; the change card its values' grounds.
  confirm: {css: ['buttons', 'smart/smart/confirm/css/confirm.css'], js: 'confirm',
    html: '<sf-confirm appearance="card" question="Удалить файл?" accept-text="Удалить" destructive></sf-confirm>'},
  // sf-alert-bar (2026-11-05): a bar per level, so each fill has a bar to
  // paint; the second holds two items and opens its list of all, the only
  // part that takes the list's background.
  'alert-bar': {css: ['buttons', 'icon-buttons', 'badges', 'icons', 'smart/smart/alert-bar/css/alert-bar.css'], js: ['alert-bar', 'badge'],
    html: ['danger', 'warning', 'info'].map((level, at) => `<sf-alert-bar id="ab-${level}"><script type="application/json" data-sf-settings>${JSON.stringify({items: [{id: 'a', level, text: 'Текст', action: {label: 'Открыть', href: '#a'}}, ...(at === 1 ? [{id: 'b', level: 'info', text: 'Ещё'}] : [])]})}</script></sf-alert-bar>`).join(''),
    open: 'document.getElementById("ab-warning").toggleList(true)'},
  // sf-tile-metric (2026-11-07): a plain tile; the value takes value-color.
  'tile-metric': {css: ['badges', 'icons', 'progress-bar', 'smart/smart/tile-metric/css/tile-metric.css'], js: ['tile-metric', 'badge', 'progress-bar'],
    html: '<sf-tile-metric label="Диск" value="83" max="100" warning-at="80" hint="Мало места"></sf-tile-metric>'},
  // sf-list-attention (2026-11-07): two items, so the divider is drawn.
  'list-attention': {css: ['buttons', 'badges', 'icons', 'smart/smart/list-attention/css/list-attention.css'], js: ['list-attention', 'badge'],
    html: `<sf-list-attention><script type="application/json" data-sf-settings>${JSON.stringify({items: [{id: 'a', status: 'error', title: 'A', action: {label: 'Go', href: '#a'}}, {id: 'b', status: 'warning', title: 'B'}]})}</script></sf-list-attention>`},
  // sf-progress-run (2026-11-07): two steps and the output open, so the
  // divider and the pane are drawn.
  'progress-run': {css: ['buttons', 'icon-buttons', 'icons', 'smart/smart/progress-run/css/progress-run.css'], js: ['progress-run', 'button-copy'],
    html: `<sf-progress-run label="Run" output-open><script type="application/json" data-sf-settings>${JSON.stringify({steps: [{id: 'a', title: 'A', state: 'done'}, {id: 'b', title: 'B', state: 'running'}], output: 'log'})}</script></sf-progress-run>`},
  // sf-list-description (2026-11-08): two rows with dividers, so the
  // divider is drawn; an empty value takes the label colour too.
  'list-description': {css: ['buttons', 'icon-buttons', 'icons', 'smart/smart/list-description/css/list-description.css'], js: ['list-description', 'button-copy'],
    html: `<sf-list-description dividers><script type="application/json" data-sf-settings>${JSON.stringify({items: [{label: 'Адрес', value: 'demo.test'}, {label: 'Путь', value: '/var/www', mono: true, copy: true}]})}</script></sf-list-description>`},
  // sf-list-timeline (2026-11-08): one day of two events, the first without
  // a status (the neutral marker) and with the connector under it.
  'list-timeline': {css: ['buttons', 'icons', 'smart/smart/list-timeline/css/list-timeline.css'], js: 'list-timeline',
    html: `<sf-list-timeline now="2026-10-27T12:00:00+03:00"><script type="application/json" data-sf-settings>${JSON.stringify({items: [{id: 'a', time: '2026-10-27T11:58:00+03:00', title: 'A', actor: 'Анна'}, {id: 'b', time: '2026-10-27T11:00:00+03:00', status: 'success', title: 'B'}]})}</script></sf-list-timeline>`},
  // sf-input-choice (2026-11-08): two cards, the first chosen, so the chosen
  // card's fill and edge are drawn beside a card at rest.
  choice: {css: ['badges', 'icons', 'smart/smart/input-choice/css/input-choice.css'], js: ['input-choice', 'badge'],
    html: `<sf-input-choice label="Тариф" value="a"><script type="application/json" data-sf-settings>${JSON.stringify({items: [{value: 'a', label: 'A', caption: 'Первый', icon: 'language'}, {value: 'b', label: 'B', caption: 'Второй', icon: 'storefront'}]})}</script></sf-input-choice>`},
  'change-confirm': {css: ['buttons', 'smart/smart/confirm-change/css/confirm-change.css'], js: 'confirm-change',
    html: '<sf-confirm-change heading="Переименовать раздел" changes=\'[{"label":"Название","before":"Новости","after":"События"}]\'></sf-confirm-change>'},
  // Block list (2026-11-05): a grouped list with an open row, so the heading
  // and the open tint have parts to reach; a feed with a run of one author and
  // a turn to another, so both spacings have an entry to move.
  list: {css: ['dropdown', 'icons', 'icon-buttons', 'buttons', 'smart/smart/list/css/list.css'], js: ['list', 'list-item'],
    html: '<sf-list group-by="key" selected="b"><script type="application/json" data-sf-settings>{"groups":[{"key":"x","text":"Входящие"}],"items":[{"id":"a","text":"Письмо","group":"x"},{"id":"b","text":"Ответ","group":"x"}]}</script></sf-list>'},
  'list-feed': {css: ['buttons', 'icon-buttons', 'smart/smart/list-feed/css/list-feed.css'], js: 'list-feed',
    html: '<div style="display:flex;flex-direction:column;block-size:300px"><sf-list-feed><script type="application/json" data-sf-settings>{"items":[{"id":"1","author":"a","author-name":"Анна","text":"Один"},{"id":"2","author":"a","author-name":"Анна","text":"Два"},{"id":"3","author":"b","author-name":"Борис","text":"Три"}]}</script></sf-list-feed></div>'},
  // sf-wizard (2026-11-06): two steps inline, the frame drawing its head,
  // body and footer; the frame takes the gap, the fill, the edge and the corner.
  wizard: {css: ['buttons', 'step', 'icons', 'smart/smart/wizard/css/wizard.css'], js: ['wizard', 'wizard-step', 'steps'],
    html: '<sf-wizard heading="Мастер"><sf-wizard-step name="a" label="Первый"><p>Текст</p></sf-wizard-step><sf-wizard-step name="b" label="Второй" type="result"><p>Готово</p></sf-wizard-step></sf-wizard>'},
  // The bar at rest, wide: the brand's picture takes brand-size, the row the gap.
  // Collapsed and open, so the side panel is on the stage: its width is the
  // only part that takes --sf-site-header-sheet-inline-size.
  'site-header': {css: ['icon-buttons', 'icons', 'smart/smart/header-site/css/header-site.css'], js: 'header-site',
    open: '(async () => { const header = document.querySelector("sf-header-site"); await header.updateComplete?.catch?.(() => {}); header.open(); await new Promise((settle) => setTimeout(settle, 200)); })()',
    html: '<sf-header-site collapse="always"><a slot="brand" href="/"><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg><span>SIMAI</span></a><nav aria-label="Разделы"><a href="#a">A</a></nav><button slot="tools" type="button">Тема</button></sf-header-site>'},
  // The window open with a query, so a title carries its mark: the field and
  // the card take the background, the card the radius, the scrim its colour.
  search: {css: ['icon-buttons', 'icons', 'kbd', 'smart/smart/search/css/search.css'], js: 'search',
    html: '<sf-search id="search"><button type="button">Поиск</button></sf-search>',
    open: `(async () => {
      const search = document.getElementById('search');
      search.provider = () => ({items: [{id: 'a', title: 'Таблица', path: 'Утилиты', href: '#a'}]});
      search.open();
      const input = document.querySelector('.sf-search-input');
      input.value = 'Таб';
      input.dispatchEvent(new Event('input', {bubbles: true}));
      await new Promise((settle) => setTimeout(settle, 400));
    })()`},
  // The pager as cards (fill, edge, corners, link and note colours, the gap)
  // and as steps on the second of three (the track and its fill).
  pager: {css: ['buttons', 'icons', 'smart/smart/pager/css/pager.css'], js: 'pager',
    html: '<sf-pager prev-href="#a" prev-title="A" next-href="#b" next-title="B"></sf-pager><sf-pager appearance="steps" current="1"><script type="application/json" data-sf-settings>{"items":[{"title":"A"},{"title":"B"},{"title":"C"}]}</script></sf-pager>'},
  // A column (its line, the current bar, the indent, the gap) and a bar (its
  // fill), each from links written inside; the first link is current.
  contents: {css: ['buttons', 'icons', 'smart/smart/contents/css/contents.css'], js: 'contents',
    html: '<sf-contents layout="column" sticky="false"><a href="#a">A</a><a href="#b" data-level="3">B</a></sf-contents><sf-contents layout="bar" sticky="false"><a href="#a">A</a><a href="#b">B</a></sf-contents>'},
  // The workspace layout, in a container below the wide width with the panel
  // open: a drawer, whose fill is the variable's. The core sheet draws it; no
  // Smart module. The region widths are measured by
  // tests/browser/workspace-layout.browser.mjs, in the container they follow.
  workspace: {css: [], js: [], html: '<div style="inline-size:800px;block-size:300px"><div class="sf-workspace" data-sf-workspace-panel="open"><nav class="sf-workspace-rail">R</nav><section class="sf-workspace-list">L</section><section class="sf-workspace-main">M</section><aside class="sf-workspace-panel">P</aside></div></div>'},
  // The display parts of the structured-content types: class markup, no
  // Smart module. A figure with a caption; a procedure of two steps, so the
  // line between the markers is drawn (the marker is a ::before, the line an
  // ::after).
  // Code in running text (2026-11-07, R024): the core sheet's base rule, no
  // module; a word in a paragraph, set on an ancestor as any site would.
  code: {css: [], js: [], html: '<p>Run <code>npm test</code> before a commit.</p>'},
  // A key in running text, a cap in a button, plain glyphs in a menu.
  kbd: {css: ['kbd'], js: [], html: '<p>Press <kbd>Esc</kbd> to close.</p><button type="button">Find <kbd class="sf-kbd--group"><kbd class="sf-kbd--square">⌘</kbd><kbd>Shift</kbd></kbd></button><div role="menu"><kbd>F2</kbd></div>'},
  card: {css: ['card'], js: [], html: '<div class="sf-card"><h4>Title</h4><p>Text</p></div>'},
  figure: {css: ['figure'], js: [], html: '<figure class="sf-figure sf-figure--ratio-16x9 sf-figure--contain"><div class="sf-figure-media"><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg></div><figcaption class="sf-figure-caption">Caption</figcaption></figure>'},
  procedure: {css: ['procedure'], js: [], html: '<ol class="sf-procedure"><li class="sf-procedure-step"><div class="sf-procedure-title">One</div><div class="sf-procedure-content"><p>Text</p></div></li><li class="sf-procedure-step"><div class="sf-procedure-title">Two</div></li></ol>'},
};

// The properties a role may change; a value nothing in the Framework uses.
const ROLES = {
  // A toast lays its tint over the raised surface as an image layer.
  background: {properties: ['background-color', 'background-image'], value: 'rgb(1, 2, 3)'},
  color: {properties: ['color'], value: 'rgb(4, 5, 6)'},
  // A divider between columns is a border at the inline edge (sf-workspace).
  'border-color': {properties: ['border-top-color', 'border-bottom-color', 'border-inline-start-color', 'border-inline-end-color'], value: 'rgb(7, 8, 9)'},
  // A drop target drawn with an outline (sf-tree-item).
  'outline-color': {properties: ['outline-color'], value: 'rgb(16, 17, 18)'},
  'border-width': {properties: ['border-top-width', 'border-bottom-width'], value: '7px'},
  radius: {properties: ['border-top-left-radius'], value: '13px'},
  'padding-inline': {properties: ['padding-inline-start', 'padding-left'], value: '17px'},
  'padding-block': {properties: ['padding-top'], value: '19px'},
  gap: {properties: ['column-gap', 'row-gap'], value: '23px'},
  // A level's indent: a flat tree's row stands in by a margin (sf-tree), a
  // nested group by its padding.
  indent: {properties: ['margin-inline-start', 'margin-left', 'padding-inline-start'], value: '31px'},
  size: {properties: ['block-size', 'height'], value: '29px'},
  // A text size: the card's title (sf-card).
  'font-size': {properties: ['font-size'], value: '29px'},
  // A typeface: code in running text.
  'font-family': {properties: ['font-family'], value: 'probe-family'},
  // Room on every side, written as one value (code in running text).
  padding: {properties: ['padding-top', 'padding-left'], value: '17px'},
  // A width a panel fixes, so its text cannot widen it.
  'inline-size': {properties: ['inline-size', 'width'], value: '211px'},
  // The ring's line and gap are drawn from registered lengths (a bare 0 stays
  // a length): the public variable has to reach the length the drawing reads.
  // The painted geometry is the conformance probe's (src/smart/progress-ring).
  'line-width': {properties: ['--sf-progress-ring--line-width'], value: '7px'},
  'ring-gap': {properties: ['--sf-progress-ring--gap'], value: '11px'},
  'indicator-color': {properties: ['border-bottom-color', 'background-color'], value: 'rgb(10, 11, 12)'},
  'indicator-width': {properties: ['border-bottom-width', 'block-size', 'height'], value: '5px'},
  // The ring of an anchored badge is a spread shadow in the surface's colour.
  'ring-color': {properties: ['box-shadow'], value: 'rgb(13, 14, 15)'},
  // The space above an entry of a feed (sf-list-feed): a run and a turn.
  'margin-block-start': {properties: ['margin-block-start', 'margin-top'], value: '37px'},
};

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const results = {};
try {
  for (const entry of contract.components) {
    const draw = DRAW[entry.component];
    if (!draw) { note({component: entry.component, said: 'no markup in the probe for this component'}); continue; }
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    // core.js added as an inline module cannot work out its own address; every
    // probe that adds it this way sees that one error, and it changes nothing here.
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({component: entry.component, said: `page error: ${error.message}`}); });
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="margin:20px"><div id="stage">${draw.html}</div></body></html>`);
    for (const folder of ['core', ...draw.css]) {
      const path = folder === 'core' ? 'core/core/css/core.css' : folder.includes('/') ? folder : `component/component/${folder}/css/${folder}.css`;
      await page.addStyleTag({path: join(out, path)}).catch(() => note({component: entry.component, said: `no sheet ${path}`}));
    }
    // js names one module, or several when a component draws with another
    // (sf-gallery's inline view is sf-slider).
    for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', ...[].concat(draw.js).map((js) => `smart/smart/${js}/js/${js}.js`)]) {
      await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
    }
    await page.waitForTimeout(700);
    if (draw.open) { await page.evaluate(draw.open); await page.waitForTimeout(500); }
    const measured = await page.evaluate(({selector, variables, roles}) => {
      const roots = [...document.querySelectorAll(selector)];
      if (!roots.length) return {missing: selector};
      // Every instance on the stage and its parts: a variant drawn beside the
      // first (the anchored badge) is part of the component too.
      const scope = roots.flatMap((root) => [root, ...root.querySelectorAll('*')]);
      const answers = [];
      for (const variable of variables) {
        const role = roles[variable.role];
        if (!role) { answers.push({name: variable.name, role: variable.role, unmeasured: true}); continue; }
        // A part may be a pseudo-element: the accordion's divider is the
        // header's ::after, a procedure's marker a ::before.
        const read = () => scope.flatMap((element) => [null, '::before', '::after'].flatMap((pseudo) => role.properties.map((property) => getComputedStyle(element, pseudo).getPropertyValue(property).trim())));
        const before = read();
        document.documentElement.style.setProperty(variable.name, role.value);
        const after = read();
        document.documentElement.style.removeProperty(variable.name);
        // Taken by some element that did not have it before.
        const ok = after.some((value, at) => (value === role.value || value.startsWith(`${role.value} `) || value.includes(`(${role.value}`) || value.includes(` ${role.value}`)) && before[at] !== value);
        answers.push({name: variable.name, role: variable.role, ok});
      }
      return {answers};
    }, {selector: entry.selector, variables: entry.variables, roles: ROLES});
    results[entry.component] = measured;
    if (measured.missing) note({component: entry.component, said: `nothing drawn for ${measured.missing}`});
    for (const answer of measured.answers ?? []) {
      if (!answer.unmeasured && !answer.ok) note({component: entry.component, variable: answer.name, role: answer.role, said: 'no part of the component took the value'});
    }
    await page.close();
  }
} finally {
  await browser.close();
}
const unmeasured = Object.entries(results).flatMap(([component, measured]) => (measured.answers ?? []).filter((answer) => answer.unmeasured).map((answer) => `${component}:${answer.name}`));
const measuredCount = Object.values(results).reduce((sum, measured) => sum + (measured.answers ?? []).filter((answer) => !answer.unmeasured).length, 0);
console.log(JSON.stringify({measured: measuredCount, unmeasured}));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_VARIABLES_OK');
