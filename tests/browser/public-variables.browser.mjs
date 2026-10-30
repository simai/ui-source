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
  button: {css: ['buttons'], js: 'button', html: '<sf-button text="Сохранить" size="1"></sf-button>'},
  // A variable of a state (standard 1.3.8 §6) is measured on an instance in
  // that state, drawn beside the one at rest.
  input: {css: ['inputs'], js: 'input', html: '<sf-input label="Имя" value="Текст" size="1"></sf-input><sf-input label="Ошибка" invalid size="1"></sf-input>'},
  alert: {css: ['alerts', 'icon-buttons'], js: 'alert', html: '<sf-alert title="Сообщение" supporting-text="Текст"></sf-alert>'},
  tag: {css: ['tags'], js: 'tag', html: '<sf-tag text="Метка" size="1"></sf-tag>'},
  'icon-button': {css: ['icon-buttons'], js: 'icon-button', html: '<sf-icon-button icon="add" aria-label="Добавить" size="1"></sf-icon-button>'},
  checkbox: {css: ['checkbox'], js: 'checkbox', html: '<sf-checkbox label="Флажок" size="1"></sf-checkbox><sf-checkbox label="Отмечен" checked size="1"></sf-checkbox><sf-checkbox label="Ошибка" invalid size="1"></sf-checkbox>'},
  'radio-button': {css: ['radio'], js: 'radio', html: '<sf-radio label="Вариант" size="1"></sf-radio><sf-radio label="Выбран" name="r" checked size="1"></sf-radio><sf-radio label="Ошибка" invalid size="1"></sf-radio>'},
  switch: {css: ['switch'], js: 'switch', html: '<sf-switch label="Включено" size="1"></sf-switch>'},
  textarea: {css: ['textarea'], js: 'textarea', html: '<sf-textarea label="Текст" value="Строка" size="1"></sf-textarea><sf-textarea label="Ошибка" invalid size="1"></sf-textarea>'},
  toast: {css: ['toast', 'icon-buttons'], js: 'toast', html: '<sf-toast status="info" title="Сохранено" supporting-text="Изменения доступны."></sf-toast>'},
  modal: {css: ['modal', 'icon-buttons', 'buttons'], js: 'modal', html: '<sf-modal id="modal" title="Окно"><p>Текст</p><button slot="footer" type="button">Отмена</button><button slot="footer" type="button">Удалить</button></sf-modal>',
    open: 'document.getElementById("modal").open()'},
  tooltip: {css: ['tooltip'], js: 'tooltip', html: '<sf-tooltip text="Подсказка" supporting-text="Пояснение" size="1"></sf-tooltip>'},
  tabs: {css: ['tabs', 'buttons'], js: 'tabs', html: '<sf-tabs type="underline" size="1" items="Обзор|Настройки|История"></sf-tabs>'},
  avatar: {css: ['avatars'], js: 'avatar', html: '<sf-avatar text="АБ" size="1"></sf-avatar>'},
  // A drilling panel beside the flyout menu: the fixed width is a drilling
  // panel's (submenu="drill"), so one has to be on the stage to measure it.
  'context-menu': {css: ['context-menu', 'buttons', 'icons', 'icon-buttons'], js: 'context-menu', html: '<button id="anchor" type="button">Меню</button><sf-context-menu id="menu" popup aria-label="Меню"></sf-context-menu>'
    + '<sf-context-menu submenu="drill" aria-label="Настройки" entries=\'[{"id":"sound","type":"switch","text":"Звук","value":true},{"id":"lang","text":"Язык","value":"Русский","submenu":[{"id":"ru","text":"Русский"}]}]\'></sf-context-menu>',
    open: 'const m = document.getElementById("menu"); m.entries = [{id: "a", text: "Открыть"}, {id: "b", text: "Удалить"}]; m.toggleFor(document.getElementById("anchor"))'},
  // The variables belong to the segmented appearance; a count is drawn on a
  // segment that is not selected, so the count's own colour has a part to reach.
  'button-group': {css: ['button-group', 'buttons'], js: 'button-group',
    html: `<sf-button-group appearance="segmented" aria-label="Тема" value="all" items='[{"value":"all","label":"Все","count":24},{"value":"dark","label":"Тёмные","count":7}]'></sf-button-group>`},
  // A Smart element with a sheet of its own: a css entry with a slash is a
  // path in the output. Empty, so the glyph's thumbnail is drawn without an
  // image to wait for.
  'image-field': {css: ['buttons', 'smart/smart/image-field/css/image-field.css'], js: 'image-field',
    html: '<sf-image-field label="Логотип" size="1"></sf-image-field>'},
  // The class accordion's sheet, drawn by sf-accordion in each appearance: the
  // fill and radius are the default one's, the border the outline's, and the
  // first section is open so its content has a colour to take.
  accordion: {css: ['accordion', 'icons', 'smart/smart/accordion/css/accordion.css'], js: 'accordion',
    html: ['default', 'outline', 'flush'].map((appearance) => `<sf-accordion appearance="${appearance}" items='[{"id":"a","title":"Раздел","content":"Текст","open":true},{"id":"b","title":"Ещё раздел","content":"Текст"}]'></sf-accordion>`).join('')},
  // sf-quantity draws the class markup; the class sheet and the icon buttons
  // its steppers are draw it.
  quantity: {css: ['quantity', 'icon-buttons'], js: 'quantity',
    html: '<sf-quantity label="Количество" value="3" min="0" max="10" size="1"></sf-quantity><sf-quantity label="Ошибка" value="3" invalid size="1"></sf-quantity>'},
  // sf-toggle (deprecated, standard 1.3.8 §6): off and checked.
  toggle: {css: ['toggle'], js: 'toggle', html: '<sf-toggle label="Тумблер"></sf-toggle><sf-toggle label="Включён" checked></sf-toggle>'},
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
  verification: {css: ['verification', 'smart/smart/code-input/css/code-input.css'], js: 'code-input',
    html: '<sf-code-input label="Код" value="12" size="1"></sf-code-input><sf-code-input label="Код" value="12" appearance="filled" size="1"></sf-code-input><sf-code-input label="Код" value="12" invalid size="1"></sf-code-input>'},
  // Group B of the form fields, with their move to standard 1.3.8
  // (2026-10-27). Each state a variable colours is drawn: the country list
  // open, a colour on a preset and one with nothing chosen, a value shown as
  // text, a file held over the second area, a chosen day and a chosen range.
  'country-code': {css: ['country-code'], js: 'country-code',
    html: '<sf-country-code label="Телефон" value="+7 999 123-45-67" size="1"></sf-country-code>',
    open: 'document.querySelector(".sf-country-code").classList.add("open")'},
  color: {css: ['smart/smart/color/css/color.css'], js: 'color',
    html: '<sf-color label="Цвет" value="#1f6feb" swatches="#1f6feb|Синий, #d1242f|Красный"></sf-color><sf-color label="Цвет"></sf-color>'},
  'range-slider': {css: ['range-slider'], js: 'range-slider',
    html: '<div style="inline-size:400px;padding:40px 20px"><sf-range-slider aria-label="Громкость" value="40" label="text"></sf-range-slider></div>'},
  'file-upload': {css: ['file-upload', 'featured-icon'], js: 'file-upload',
    html: '<sf-file-upload aria-label="Документы"></sf-file-upload><sf-file-upload id="held" aria-label="Документы"></sf-file-upload>',
    open: 'document.getElementById("held").setAttribute("data-dragged-over", "true")'},
  // Display group A (standard 1.3.8, 2026-10-27): each state a variable
  // colours is drawn -- a copy that succeeded and one that failed, an open
  // explanation.
  close: {css: ['close'], js: 'close', html: '<sf-close size="1"></sf-close>'},
  icon: {css: ['icons'], js: 'icon', html: '<sf-icon icon="home" size="1"></sf-icon>'},
  'reference-link': {css: ['reference-link', 'icons'], js: 'reference-link',
    html: '<sf-reference-link label="Документация" text="/docs/" href="#" size="1"></sf-reference-link>'},
  'download-file': {css: ['icons', 'download-file'], js: 'download-file',
    html: '<sf-download-file file-name="Отчёт.pdf" file-size="2 МБ" href="#"></sf-download-file>'},
  'copy-button': {css: ['icon-buttons', 'icons', 'smart/smart/copy-button/css/copy-button.css'], js: 'copy-button',
    html: '<sf-copy-button value="a" label="Копировать" duration="60000"></sf-copy-button><sf-copy-button value="b" label="Копировать" duration="60000"></sf-copy-button><sf-copy-button value="c" label="Копировать" duration="60000"></sf-copy-button>',
    open: 'const [, ok, failed] = document.querySelectorAll("sf-copy-button"); ok.setPhase("success", ""); failed.setPhase("error", "")'},
  'help-mark': {css: ['icon-buttons', 'icons', 'smart/smart/help-mark/css/help-mark.css'], js: 'help-mark',
    html: '<sf-help-mark id="hm" heading="Заголовок" text="Пояснение"></sf-help-mark>', open: 'document.getElementById("hm").open()'},
  datepicker: {css: ['datepicker', 'buttons', 'icon-buttons'], js: 'datepicker',
    html: '<sf-datepicker input="false" value="2026-09-03"></sf-datepicker><sf-datepicker input="false" range start-value="2026-09-01" end-value="2026-09-07"></sf-datepicker>'},
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
  'page-header': {css: ['badges', 'icon-buttons', 'icons', 'smart/smart/page-header/css/page-header.css'], js: 'page-header',
    html: '<sf-page-header heading="Каталог" count="4" star><button slot="actions" type="button">Создать</button></sf-page-header>'},
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
  'rich-text': {css: ['icon-buttons', 'icons', 'smart/smart/rich-text/css/rich-text.css'], js: 'rich-text',
    html: '<sf-rich-text label="Text" value="<p>Line</p>" rows="2"></sf-rich-text><sf-rich-text label="Error" invalid rows="2"></sf-rich-text>'},
  // The frame at rest and invalid; a third opened from its options, so the
  // list's surface is measured on its panel (the focused frame has its own
  // fill and border, as sf-input's).
  lookup: {css: ['tags', 'avatars', 'icon-buttons', 'icons', 'smart/smart/lookup/css/lookup.css'], js: 'lookup',
    html: '<sf-lookup label="Город" value="moscow"><script type="application/json" data-sf-settings>{"options":[{"value":"moscow","label":"Москва"}]}</script></sf-lookup><sf-lookup label="Ошибка" invalid></sf-lookup><sf-lookup id="lk" label="Список"><script type="application/json" data-sf-settings>{"options":[{"value":"moscow","label":"Москва"},{"value":"kazan","label":"Казань"}]}</script></sf-lookup>',
    open: 'const l = document.getElementById("lk"); l.querySelector("input").focus(); l.search("")'},
  // The bar at rest, wide: the brand's picture takes brand-size, the row the gap.
  'site-header': {css: ['icon-buttons', 'icons', 'smart/smart/site-header/css/site-header.css'], js: 'site-header',
    html: '<sf-site-header collapse="none"><a slot="brand" href="/"><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg><span>SIMAI</span></a><nav aria-label="Разделы"><a href="#a">A</a></nav><button slot="tools" type="button">Тема</button></sf-site-header>'},
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
  // Compact settings at rest, inline: a tile and a choice row (drill), and
  // a chosen pill and a compact select (rows).
  'settings-menu': {css: ['switch', 'icons', 'smart/smart/settings-menu/css/settings-menu.css'], js: 'settings-menu',
    html: '<sf-settings-menu inline><script type="application/json" data-sf-settings>{"items": [{"key": "sound", "type": "boolean", "label": "Звук", "icon": "volume_up", "value": false, "tile": true}, {"key": "lang", "type": "choice", "label": "Язык", "value": "ru", "options": [{"value": "ru", "label": "Русский"}, {"value": "en", "label": "English"}, {"value": "kk", "label": "Қазақша"}]}]}</script></sf-settings-menu>'
      + '<sf-settings-menu inline template="rows"><script type="application/json" data-sf-settings>{"items": [{"key": "follow", "type": "choice", "label": "Ответы", "value": "queue", "options": [{"value": "queue", "label": "Очередь"}, {"value": "steer", "label": "Сразу"}]}, {"key": "density", "type": "choice", "label": "Плотность", "value": "normal", "options": [{"value": "compact", "label": "Плотно"}, {"value": "normal", "label": "Обычно"}, {"value": "loose", "label": "Свободно"}]}]}</script></sf-settings-menu>'},
  // The pager as cards (fill, edge, corners, link and note colours, the gap)
  // and as steps on the second of three (the track and its fill).
  pager: {css: ['buttons', 'icons', 'smart/smart/pager/css/pager.css'], js: 'pager',
    html: '<sf-pager prev-href="#a" prev-title="A" next-href="#b" next-title="B"></sf-pager><sf-pager appearance="steps" current="1"><script type="application/json" data-sf-settings>{"items":[{"title":"A"},{"title":"B"},{"title":"C"}]}</script></sf-pager>'},
  // A column (its line, the current bar, the indent, the gap) and a bar (its
  // fill), each from links written inside; the first link is current.
  contents: {css: ['buttons', 'icons', 'smart/smart/contents/css/contents.css'], js: 'contents',
    html: '<sf-contents layout="column" sticky="false"><a href="#a">A</a><a href="#b" data-level="3">B</a></sf-contents><sf-contents layout="bar" sticky="false"><a href="#a">A</a><a href="#b">B</a></sf-contents>'},
};

// The properties a role may change; a value nothing in the Framework uses.
const ROLES = {
  // A toast lays its tint over the raised surface as an image layer.
  background: {properties: ['background-color', 'background-image'], value: 'rgb(1, 2, 3)'},
  color: {properties: ['color'], value: 'rgb(4, 5, 6)'},
  'border-color': {properties: ['border-top-color', 'border-bottom-color'], value: 'rgb(7, 8, 9)'},
  // A track drawn with an outline (sf-toggle).
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
    for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/icon-button/js/icon-button.js', ...[].concat(draw.js).map((js) => `smart/smart/${js}/js/${js}.js`)]) {
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
        // header's ::after.
        const read = () => scope.flatMap((element) => [null, '::after'].flatMap((pseudo) => role.properties.map((property) => getComputedStyle(element, pseudo).getPropertyValue(property).trim())));
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
