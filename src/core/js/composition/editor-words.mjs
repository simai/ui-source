import { localeText, pageLocale } from '../page-language.js';
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from './builtins.mjs';
import { CATALOGUE_GROUP_TABLE } from './catalogue.mjs';

// The words of the built-in editor manifests (simai/ui-source#65): every
// label_key, help_key and `<label_key>.<choice>` of a choice that is a stable
// segment, in English and Russian. A choice that is not a stable segment
// (`16/9`) is shown as it is, by the field kinds' localization rule.
//
// The words belong to the registry owner `sf-composition`, so a product adds a
// language or corrects one word the way it does for any component:
//
//   SF.language.register('sf-composition', 'de', {'sf.composition.content_figure.src': 'Bildadresse'});
//
// src/core/contracts/composition-editor-words.v1.json is generated from this
// file (scripts/generate-composition-contracts.mjs) for a host without
// JavaScript, which reads the same keys.

export const EDITOR_WORDS_OWNER = 'sf-composition';

const words = (prefix, entries) => Object.fromEntries(Object.entries(entries).map(([key, value]) => [`sf.composition.${prefix}.${key}`, value]));

const EN = {
  ...words('layout_section', {
    surface: 'Background',
    surface_help: 'How the section stands out from the page',
    'surface.surface': 'Regular',
    'surface.contrast': 'Contrasting',
  }),
  ...words('layout_columns', {
    columns: 'Columns',
    columns_help: 'How many columns the content is split into',
    gap: 'Gap',
    gap_help: 'Space between the columns, from 0 to 8 steps',
  }),
  // Parameter sets (parameter-sets.mjs), shared by every type that takes them.
  ...words('set_background', {
    background: 'Background',
    background_help: 'The fill behind the block',
    'background.surface': 'Page',
    'background.container': 'Container',
    'background.primary': 'Primary',
    'background.secondary': 'Secondary',
    'background.tertiary': 'Tertiary',
  }),
  ...words('set_spacing', {
    padding_y: 'Space above and below',
    padding_y_help: 'From 0 to 8 steps, per screen',
    padding_x: 'Space at the sides',
    padding_x_help: 'From 0 to 8 steps, per screen',
  }),
  ...words('set_width', {
    width: 'Width',
    width_help: 'How wide the content stands on the page',
    'width.narrow': 'Narrow',
    'width.normal': 'Normal',
    'width.wide': 'Wide',
    'width.full': 'Full width',
  }),
  ...words('set_grid', {
    columns: 'Columns',
    columns_help: 'How many columns the content is split into, per screen',
    gap: 'Gap',
    gap_help: 'Space between the columns, from 0 to 8 steps',
  }),
  ...words('set_alignment', {
    align: 'Alignment',
    align_help: 'How the text lines up, per screen',
    'align.start': 'Start',
    'align.center': 'Centre',
    'align.end': 'End',
  }),
  ...words('set_breakout', {
    breakout: 'Edge to edge',
    breakout_help: 'The block spans the whole page width',
  }),
  ...words('set_visibility', {
    hidden: 'Hidden',
    hidden_help: 'The block is not shown on this screen',
  }),
  ...words('layout_area', {
    content: 'Text',
    empty: 'Start writing or press / for a block',
    padding: 'Padding',
    padding_help: 'Space inside the area, from 0 to 8 steps',
    hidden: 'Hidden',
    hidden_help: 'The area is not shown on this screen',
  }),
  ...words('content_heading', {
    level: 'Heading level',
    level_help: 'From 1, the page title, to 6',
  }),
  ...words('layout_region', {
    placement: 'Placement',
    placement_help: 'Where the area stands in the layout',
    'placement.block': 'Full width',
    'placement.start': 'At the start',
    'placement.center': 'In the centre',
    'placement.end': 'At the end',
    label: 'Name',
    label_help: 'The area\'s name for screen readers',
    landmark: 'Landmark',
    landmark_help: 'The area\'s role in the page structure for assistive technology',
    'landmark.banner': 'Header',
    'landmark.navigation': 'Navigation',
    'landmark.main': 'Main content',
    'landmark.complementary': 'Sidebar',
    'landmark.contentinfo': 'Footer',
    'landmark.region': 'Region',
    'landmark.none': 'None',
    sticky: 'Sticky',
    sticky_help: 'The area stays in view while the page scrolls',
  }),
  ...words('content_list', {
    ordered: 'Numbered',
    ordered_help: 'Numbers instead of bullets',
    start: 'Start at',
    start_help: 'The number of the first item',
  }),
  ...words('content_code', {
    lang: 'Language',
    lang_help: 'The programming language, for highlighting',
    title: 'Caption',
    title_help: 'A file name or a short caption above the code',
    numbers: 'Line numbers',
    numbers_help: 'Number every line',
  }),
  ...words('content_table', {
    header: 'Table headers',
    header_help: 'Which cells are headers',
    'header.row': 'First row',
    'header.column': 'First column',
    'header.both': 'Row and column',
    'header.none': 'None',
  }),
  ...words('content_figure', {
    src: 'Picture address',
    src_help: 'A link to the image: http(s) or a path on the site',
    alt: 'Picture description',
    alt_help: 'What the picture shows, for those who cannot see it',
    ratio: 'Ratio',
    ratio_help: 'The picture\'s width to its height',
    'ratio.auto': 'As it is',
    fit: 'Fit',
    fit_help: 'How the picture fills its frame',
    'fit.cover': 'Fill',
    'fit.contain': 'Whole',
  }),
  ...words('content_alert', {
    status: 'Kind',
    status_help: 'What the message is about',
    'status.neutral': 'Plain',
    'status.info': 'Information',
    'status.success': 'Success',
    'status.warning': 'Warning',
    'status.error': 'Error',
    appearance: 'Look',
    appearance_help: 'Filled, outlined or flat',
    'appearance.default': 'Filled',
    'appearance.outlined': 'Outlined',
    'appearance.flat': 'Flat',
  }),
  ...words('content_details', {
    open: 'Open at first',
    open_help: 'The block is shown open when the page loads',
    layout: 'Look',
    layout_help: 'A filled box or lines between blocks',
    'layout.surface': 'Filled',
    'layout.lines': 'Lines',
  }),
  ...words('content_tabs', {
    label: 'Name',
    label_help: 'The name of the row of tabs for screen readers',
  }),
  ...words('content_tab', {
    label: 'Tab name',
    label_help: 'The text on the tab',
  }),
  ...words('content_steps', {
    current: 'Current step',
    current_help: 'The number of the step in progress',
    layout: 'Look',
    layout_help: 'A timeline or a numbered list',
    'layout.timeline': 'Timeline',
    'layout.list': 'List',
  }),
  ...words('content_grid', {
    columns: 'Columns',
    columns_help: 'How many columns on a wide screen; a narrow one shows fewer',
    gap: 'Gap',
    gap_help: 'The space between the cells, from 0 to 4',
  }),
  ...words('content_card', {
    variant: 'Look',
    variant_help: 'A card with a background or without one',
    'variant.default': 'Card',
    'variant.plain': 'No background',
  }),
  ...words('content_media', {
    src: 'Picture address',
    src_help: 'A link to the image: http(s) or a path on the site',
    alt: 'Picture description',
    alt_help: 'What the picture shows, for those who cannot see it',
    side: 'Picture',
    side_help: 'Which side the picture stands on',
    'side.left': 'Left',
    'side.right': 'Right',
    ratio: 'Ratio',
    ratio_help: 'The picture\'s width to its height',
  }),
  ...words('content_file', {
    label: 'File name',
    label_help: 'The name shown; when empty, the last part of the address',
    href: 'File address',
    href_help: 'A link to the file to download',
  }),
  ...words('content_diagram', {
    title: 'Caption',
    title_help: 'The diagram\'s name, also for screen readers',
    engine: 'Engine',
    engine_help: 'What draws the diagram',
    'engine.mermaid': 'Mermaid',
  }),
  ...words('content_math', {
    label: 'Caption',
    label_help: 'The formula\'s name for screen readers',
  }),
  // The layout and element types of the one block editor (2026-11-04).
  ...words('layout_spacer', {
    size: 'Height',
    size_help: 'From 1 to 8 steps, per screen',
  }),
  ...words('element_button', {
    text: 'Text',
    text_help: 'The words on the button',
    appearance: 'Look',
    appearance_help: 'How the button stands out',
    'appearance.default': 'Filled',
    'appearance.tonal': 'Tonal',
    'appearance.outline': 'Outlined',
    'appearance.link': 'Link',
    'appearance.surface': 'On the surface',
    size: 'Size',
    size_help: 'Small, regular or large',
    icon: 'Icon',
    icon_help: 'A SIMAI Framework icon name, such as arrow_forward',
    icon_position: 'Icon side',
    icon_position_help: 'Before or after the words',
    'icon_position.start': 'Before',
    'icon_position.end': 'After',
    scheme: 'Colour',
    scheme_help: 'The colour role of the button',
    'scheme.primary': 'Primary',
    'scheme.secondary': 'Secondary',
  }),
  ...words('element_button_icon', {
    icon: 'Icon',
    icon_help: 'A SIMAI Framework icon name, such as favorite',
    label: 'Label for screen readers',
    label_help: 'What the button does, said aloud',
    appearance: 'Look',
    appearance_help: 'How the button stands out',
    'appearance.default': 'Filled',
    'appearance.tonal': 'Tonal',
    'appearance.outline': 'Outlined',
    'appearance.surface': 'On the surface',
    'appearance.ghost': 'No background',
    size: 'Size',
    size_help: 'Small, regular or large',
    scheme: 'Colour',
    scheme_help: 'The colour role of the button',
    'scheme.primary': 'Primary',
    'scheme.secondary': 'Secondary',
  }),
  ...words('element_badge', {
    text: 'Text',
    text_help: 'The words on the badge',
    appearance: 'Look',
    appearance_help: 'How the badge stands out',
    'appearance.main': 'Filled',
    'appearance.tonal': 'Tonal',
    'appearance.outline': 'Outlined',
    scheme: 'Colour',
    scheme_help: 'The colour role of the badge',
    'scheme.neutral': 'Neutral',
    'scheme.primary': 'Primary',
    'scheme.secondary': 'Secondary',
    'scheme.tertiary': 'Tertiary',
    size: 'Size',
    size_help: 'From small to regular',
    icon: 'Icon',
    icon_help: 'A SIMAI Framework icon name before the words',
  }),
  ...words('element_icon', {
    icon: 'Icon',
    icon_help: 'A SIMAI Framework icon name, such as star',
    size: 'Size',
    size_help: 'A step of the size ladder',
    label: 'Label for screen readers',
    label_help: 'Leave empty when the icon only decorates',
  }),
  // The catalogue: groups, the built-in types that name themselves, variants.
  ...words('catalogue.group', {
    text: 'Text',
    media: 'Media',
    elements: 'Elements',
    layout: 'Layout',
    page_parts: 'Page parts',
    marketing: 'Marketing',
    data: 'Data',
    forms: 'Forms',
  }),
  ...words('catalogue.type', {
    layout_container: 'Container',
    layout_grid: 'Grid',
    layout_spacer: 'Empty space',
    element_button: 'Button',
    element_button_icon: 'Icon button',
    element_badge: 'Badge',
    element_icon: 'Icon',
  }),
  ...words('catalogue.variant', {
    'layout_section.plain': 'Empty',
    'layout_section.soft': 'On a soft background',
    'layout_section.accent': 'On an accent background',
    'layout_section.text': 'With a text area',
    'layout_section.two_columns': 'Two columns',
    'layout_container.narrow': 'Narrow, for text',
    'layout_container.normal': 'Page width',
    'layout_container.soft': 'On a soft background',
    'layout_grid.cards_2': 'Two cards',
    'layout_grid.cards_3': 'Three cards',
    'layout_grid.cards_4': 'Four cards',
    'element_button.plain': 'Button',
    'element_button.icon': 'With an icon',
    'element_button.outline': 'Outlined',
  }),
};

const RU = {
  ...words('layout_section', {
    surface: 'Фон',
    surface_help: 'Как раздел выделяется на странице',
    'surface.surface': 'Обычный',
    'surface.contrast': 'Контрастный',
  }),
  ...words('layout_columns', {
    columns: 'Колонки',
    columns_help: 'На сколько колонок делится содержимое',
    gap: 'Промежуток',
    gap_help: 'Расстояние между колонками, от 0 до 8 шагов',
  }),
  ...words('set_background', {
    background: 'Фон',
    background_help: 'Заливка под блоком',
    'background.surface': 'Страница',
    'background.container': 'Контейнер',
    'background.primary': 'Основной',
    'background.secondary': 'Дополнительный',
    'background.tertiary': 'Третий',
  }),
  ...words('set_spacing', {
    padding_y: 'Отступ сверху и снизу',
    padding_y_help: 'От 0 до 8 шагов, для каждого экрана',
    padding_x: 'Отступ по бокам',
    padding_x_help: 'От 0 до 8 шагов, для каждого экрана',
  }),
  ...words('set_width', {
    width: 'Ширина',
    width_help: 'Насколько широко стоит содержимое на странице',
    'width.narrow': 'Узкая',
    'width.normal': 'Обычная',
    'width.wide': 'Широкая',
    'width.full': 'Во всю ширину',
  }),
  ...words('set_grid', {
    columns: 'Колонки',
    columns_help: 'На сколько колонок делится содержимое, для каждого экрана',
    gap: 'Промежуток',
    gap_help: 'Расстояние между колонками, от 0 до 8 шагов',
  }),
  ...words('set_alignment', {
    align: 'Выравнивание',
    align_help: 'Как выравнивается текст, для каждого экрана',
    'align.start': 'К началу',
    'align.center': 'По центру',
    'align.end': 'К концу',
  }),
  ...words('set_breakout', {
    breakout: 'От края до края',
    breakout_help: 'Блок занимает всю ширину страницы',
  }),
  ...words('set_visibility', {
    hidden: 'Скрыт',
    hidden_help: 'Блок не показывается на этом экране',
  }),
  ...words('layout_area', {
    content: 'Текст',
    empty: 'Начните писать или нажмите / для блока',
    padding: 'Отступ',
    padding_help: 'Пространство внутри области, от 0 до 8 шагов',
    hidden: 'Скрыть',
    hidden_help: 'Область не показывается на этом экране',
  }),
  ...words('content_heading', {
    level: 'Уровень заголовка',
    level_help: 'От 1 (заголовок страницы) до 6',
  }),
  ...words('layout_region', {
    placement: 'Расположение',
    placement_help: 'Где область стоит в макете',
    'placement.block': 'Во всю ширину',
    'placement.start': 'В начале',
    'placement.center': 'По центру',
    'placement.end': 'В конце',
    label: 'Название',
    label_help: 'Название области для программ чтения с экрана',
    landmark: 'Ориентир',
    landmark_help: 'Роль области в структуре страницы для вспомогательных технологий',
    'landmark.banner': 'Шапка',
    'landmark.navigation': 'Навигация',
    'landmark.main': 'Основное содержимое',
    'landmark.complementary': 'Боковая колонка',
    'landmark.contentinfo': 'Подвал',
    'landmark.region': 'Область',
    'landmark.none': 'Нет',
    sticky: 'Закрепить',
    sticky_help: 'Область остаётся на виду при прокрутке страницы',
  }),
  ...words('content_list', {
    ordered: 'Нумерованный',
    ordered_help: 'Номера вместо маркеров',
    start: 'Начать с',
    start_help: 'Номер первого пункта',
  }),
  ...words('content_code', {
    lang: 'Язык',
    lang_help: 'Язык программирования для подсветки',
    title: 'Подпись',
    title_help: 'Имя файла или короткая подпись над кодом',
    numbers: 'Номера строк',
    numbers_help: 'Нумеровать каждую строку',
  }),
  ...words('content_table', {
    header: 'Заголовки таблицы',
    header_help: 'Какие ячейки — заголовки',
    'header.row': 'Первая строка',
    'header.column': 'Первый столбец',
    'header.both': 'Строка и столбец',
    'header.none': 'Нет',
  }),
  ...words('content_figure', {
    src: 'Адрес картинки',
    src_help: 'Ссылка на изображение: http(s) или путь на сайте',
    alt: 'Описание картинки',
    alt_help: 'Что на картинке — для тех, кто её не видит',
    ratio: 'Пропорции',
    ratio_help: 'Соотношение ширины и высоты картинки',
    'ratio.auto': 'Как есть',
    fit: 'Вписать',
    fit_help: 'Как картинка заполняет рамку',
    'fit.cover': 'Заполнить',
    'fit.contain': 'Целиком',
  }),
  ...words('content_alert', {
    status: 'Вид',
    status_help: 'О чём сообщение',
    'status.neutral': 'Обычная',
    'status.info': 'Сведения',
    'status.success': 'Успех',
    'status.warning': 'Внимание',
    'status.error': 'Ошибка',
    appearance: 'Оформление',
    appearance_help: 'Заливка, рамка или без фона',
    'appearance.default': 'Заливка',
    'appearance.outlined': 'Рамка',
    'appearance.flat': 'Плоско',
  }),
  ...words('content_details', {
    open: 'Открыт сразу',
    open_help: 'Блок показан раскрытым при загрузке страницы',
    layout: 'Оформление',
    layout_help: 'Заливка или линии между блоками',
    'layout.surface': 'Заливка',
    'layout.lines': 'Линии',
  }),
  ...words('content_tabs', {
    label: 'Название',
    label_help: 'Название ряда вкладок для программ чтения с экрана',
  }),
  ...words('content_tab', {
    label: 'Название вкладки',
    label_help: 'Текст на вкладке',
  }),
  ...words('content_steps', {
    current: 'Текущий шаг',
    current_help: 'Номер шага, который выполняется сейчас',
    layout: 'Оформление',
    layout_help: 'Линия или нумерованный список',
    'layout.timeline': 'Линия',
    'layout.list': 'Список',
  }),
  ...words('content_grid', {
    columns: 'Колонки',
    columns_help: 'Сколько колонок на широком экране; на узком их меньше',
    gap: 'Промежуток',
    gap_help: 'Расстояние между ячейками, от 0 до 4',
  }),
  ...words('content_card', {
    variant: 'Оформление',
    variant_help: 'Карточка с фоном или без него',
    'variant.default': 'Карточка',
    'variant.plain': 'Без фона',
  }),
  ...words('content_media', {
    src: 'Адрес картинки',
    src_help: 'Ссылка на изображение: http(s) или путь на сайте',
    alt: 'Описание картинки',
    alt_help: 'Что на картинке — для тех, кто её не видит',
    side: 'Картинка',
    side_help: 'С какой стороны стоит картинка',
    'side.left': 'Слева',
    'side.right': 'Справа',
    ratio: 'Пропорции',
    ratio_help: 'Соотношение ширины и высоты картинки',
  }),
  ...words('content_file', {
    label: 'Название файла',
    label_help: 'Показываемое название; если пусто — последняя часть адреса',
    href: 'Адрес файла',
    href_help: 'Ссылка на файл для скачивания',
  }),
  ...words('content_diagram', {
    title: 'Подпись',
    title_help: 'Название схемы, в том числе для программ чтения с экрана',
    engine: 'Движок',
    engine_help: 'Чем рисуется схема',
    'engine.mermaid': 'Mermaid',
  }),
  ...words('content_math', {
    label: 'Подпись',
    label_help: 'Название формулы для программ чтения с экрана',
  }),
  ...words('layout_spacer', {
    size: 'Высота',
    size_help: 'От 1 до 8 шагов, для каждого экрана',
  }),
  ...words('element_button', {
    text: 'Текст',
    text_help: 'Слова на кнопке',
    appearance: 'Вид',
    appearance_help: 'Насколько кнопка заметна',
    'appearance.default': 'Заливка',
    'appearance.tonal': 'Тональная',
    'appearance.outline': 'Контур',
    'appearance.link': 'Ссылка',
    'appearance.surface': 'На поверхности',
    size: 'Размер',
    size_help: 'Маленькая, обычная или крупная',
    icon: 'Значок',
    icon_help: 'Имя значка SIMAI Framework, например arrow_forward',
    icon_position: 'Где значок',
    icon_position_help: 'До или после слов',
    'icon_position.start': 'Слева',
    'icon_position.end': 'Справа',
    scheme: 'Цвет',
    scheme_help: 'Цветовая роль кнопки',
    'scheme.primary': 'Основной',
    'scheme.secondary': 'Дополнительный',
  }),
  ...words('element_button_icon', {
    icon: 'Значок',
    icon_help: 'Имя значка SIMAI Framework, например favorite',
    label: 'Подпись для экранного диктора',
    label_help: 'Что делает кнопка, вслух',
    appearance: 'Вид',
    appearance_help: 'Насколько кнопка заметна',
    'appearance.default': 'Заливка',
    'appearance.tonal': 'Тональная',
    'appearance.outline': 'Контур',
    'appearance.surface': 'На поверхности',
    'appearance.ghost': 'Без фона',
    size: 'Размер',
    size_help: 'Маленькая, обычная или крупная',
    scheme: 'Цвет',
    scheme_help: 'Цветовая роль кнопки',
    'scheme.primary': 'Основной',
    'scheme.secondary': 'Дополнительный',
  }),
  ...words('element_badge', {
    text: 'Текст',
    text_help: 'Слова на метке',
    appearance: 'Вид',
    appearance_help: 'Насколько метка заметна',
    'appearance.main': 'Заливка',
    'appearance.tonal': 'Тональная',
    'appearance.outline': 'Контур',
    scheme: 'Цвет',
    scheme_help: 'Цветовая роль метки',
    'scheme.neutral': 'Нейтральный',
    'scheme.primary': 'Основной',
    'scheme.secondary': 'Дополнительный',
    'scheme.tertiary': 'Третий',
    size: 'Размер',
    size_help: 'От маленькой до обычной',
    icon: 'Значок',
    icon_help: 'Имя значка SIMAI Framework перед словами',
  }),
  ...words('element_icon', {
    icon: 'Значок',
    icon_help: 'Имя значка SIMAI Framework, например star',
    size: 'Размер',
    size_help: 'Шаг шкалы размеров',
    label: 'Подпись для экранного диктора',
    label_help: 'Оставьте пустой, если значок только украшает',
  }),
  ...words('catalogue.group', {
    text: 'Текст',
    media: 'Медиа',
    elements: 'Элементы',
    layout: 'Макет',
    page_parts: 'Части страницы',
    marketing: 'Маркетинг',
    data: 'Данные',
    forms: 'Формы',
  }),
  ...words('catalogue.type', {
    layout_container: 'Контейнер',
    layout_grid: 'Сетка',
    layout_spacer: 'Пустое место',
    element_button: 'Кнопка',
    element_button_icon: 'Кнопка-значок',
    element_badge: 'Метка',
    element_icon: 'Значок',
  }),
  ...words('catalogue.variant', {
    'layout_section.plain': 'Пустая',
    'layout_section.soft': 'На мягком фоне',
    'layout_section.accent': 'На акцентном фоне',
    'layout_section.text': 'С областью текста',
    'layout_section.two_columns': 'Две колонки',
    'layout_container.narrow': 'Узкий, для текста',
    'layout_container.normal': 'Шириной страницы',
    'layout_container.soft': 'На мягком фоне',
    'layout_grid.cards_2': 'Две карточки',
    'layout_grid.cards_3': 'Три карточки',
    'layout_grid.cards_4': 'Четыре карточки',
    'element_button.plain': 'Кнопка',
    'element_button.icon': 'Со значком',
    'element_button.outline': 'Контурная',
  }),
};

export const EDITOR_FIELD_WORDS = Object.freeze({ en: Object.freeze(EN), ru: Object.freeze(RU) });

const STABLE_SEGMENT = /^[a-z][a-z0-9_]*$/u;

/** Every word key a field reads: its label, its help and its stable choices. */
/** The keys of the catalogue's words: the fixed groups, and the built-in types and variants that name one. */
export function catalogueWordKeys() {
  const keys = Object.values(CATALOGUE_GROUP_TABLE).map(({ label_key: key }) => key);
  for (const manifest of BUILTIN_TYPE_MANIFESTS) {
    keys.push(...[manifest.catalogue?.label_key, manifest.catalogue?.help_key].filter(Boolean));
    for (const variant of manifest.variants || []) if (variant.label_key) keys.push(variant.label_key);
  }
  return [...new Set(keys)];
}

export function editorFieldKeys(field) {
  if (!field || typeof field.label_key !== 'string') return [];
  const keys = [field.label_key];
  if (typeof field.help_key === 'string') keys.push(field.help_key);
  for (const choice of Array.isArray(field.choices) ? field.choices : []) {
    if (typeof choice === 'string' && STABLE_SEGMENT.test(choice)) keys.push(`${field.label_key}.${choice}`);
  }
  return keys;
}

/**
 * The `messages` renderFieldFallback and a host's form read, for one editor
 * manifest, a list of them, or every built-in one when none is given. The
 * language is `locale` when it is named, else the language of `node` (the
 * nearest [lang], SF.language.use(), <html lang>), else English. A word
 * registered for `sf-composition` wins over the shipped one; a key with no
 * word in any language is left out, so the host's own words or the key show.
 */
export function editorFieldMessages(manifests, { node = null, locale } = {}) {
  const list = manifests === undefined ? BUILTIN_EDITOR_MANIFESTS : Array.isArray(manifests) ? manifests : [manifests];
  const language = locale || pageLocale(node);
  const messages = {};
  // Without a manifest, the words of the built-in types' named places too
  // (a slot's label_key and empty_key; one block editor, 2026-11-03).
  // And the catalogue's words (2026-11-04): each group's name, and the name
  // of each built-in type and variant that gives a label_key.
  if (manifests === undefined) {
    for (const slot of BUILTIN_TYPE_MANIFESTS.flatMap((manifest) => Object.values(manifest.slots || {}))) {
      for (const key of [slot.label_key, slot.empty_key].filter(Boolean)) messages[key] = localeText(EDITOR_FIELD_WORDS, key, language, EDITOR_WORDS_OWNER);
    }
    for (const key of catalogueWordKeys()) messages[key] = localeText(EDITOR_FIELD_WORDS, key, language, EDITOR_WORDS_OWNER);
  }
  for (const manifest of list) {
    for (const field of manifest?.fields || []) {
      for (const key of editorFieldKeys(field)) {
        const word = localeText(EDITOR_FIELD_WORDS, key, language, EDITOR_WORDS_OWNER);
        if (word !== key) messages[key] = word;
      }
    }
  }
  return messages;
}

export default { EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER, catalogueWordKeys, editorFieldKeys, editorFieldMessages };
