
export let Modal = {
    loadtimeout         : '1000',       // Отсрочка загрузки до появления контента в ms
    width               : false,       // Ширина
    height              : false,       // Высота
    name                : false,        // Наименование
    src                 : false,        // Путь до загрузжаемого файла - по умолчанию пусто
    iframe              : false,        // Модальное в виде фрейма
    blur                : false,        // Размытие контента
    autoload            : false,        // Предварительная загрузка контента - три режима - hide-скрыто (default), - show-открыто, - collapsed-свернуто,
    unclose             : false,        // Принудительный кэш данных
    action              : 'click',      // Показывать при клике (click) или при наведении (hover)
    mode                : 'ajax',        // Режим загрузки данных (параметр src, атрибут sf-src) по умолчанию ajax, также inline - объект по селлектору, и gallery - фотогалерея
    init                : '[sf-modal]', // Селектор инициализации модального окна
    service             : '[data-name*="sf-service-bottom-area"]',    // Контейнер для вставки
    page                : '[data-name*="sf-pagewrap-area"]',          // Основная область страницы для blur
    container           : '.sf-modal-container',
    overlay             : 'sf-modal-overlay fixed w-full h-full top-0 right-0 bottom-0 left-0 items-cross-center content-main-center bg-surface-transparent-overlay', // Модификаторы подложки модального окна
    area                : 'sf-modal-area relative w-10/12 sm:w-10/12 w-2/3 lg:w-1/2 xl:w-1/2', // Модификаторы контейнера контентной части
    content             : 'sf-modal-content overflow-auto border-0 bg-surface-1 p-2', // Модификаторы контентной части
    html                : false,
    data                : {},
    // Перед созданием
    beforeCreateWindow  : () => {},
    // Перед загрузкой контента
    beforeContentUpload : () => {},
    // После загрузки контента
    afterContentUpload  : () => {},
    // Перед открытием
    beforeOpenWindow    : () => {},
    // После открытия
    afterOpenWindow     : () => {},
    // Перед тем как свернуть
    beforeHideWindow    : () => {},
    // Перед тем как свернуть
    beforeShowWindow    : () => {},
    // Перед закрытием
    beforeCloseWindow   : () => {},
    close :
    {
        active      : true,
        modifier    : 'sf-close transition', // Модификаторы кнопки закрыть модальное окно
    },
    'overlay-close': false,
    load :
    {
        // Добавляем | убираем анимацию загрузки контента
        active      : true,
        // Верстка анимации загрузки контента
        html        : '<div class="sf-progress"><div class="sf-progress-animation"></div></div>',
    },

    pointer :
    {
        active      : false,
        modifier    : 'absolute overflow-hidden',
    },
    hide :
    {
        active      : false,
        modifier    : 'cursor-pointer absolute top-b6 right-d0 w-b6 h-b6 z-1 opacity-4 transition border-0 bg-transparent before:content-empty before:absolute before:left-0 before:h-a2 before:w-full before:bg-gray-9',
    },
    // Модальное окно в виде подсказки. Позиция top, right, bottom,
    // left по отношению инициализатора и auto - адаптивный,
    // значение по умолчанию
    tooltip :
    {
        active      : false,        // Активность
        position    : 'bottom',     // Положение
        overlay     : 'absolute flex-col items-cross-start',
        area        : 'w-full overflow-auto p-4 elevation-3 border-1 radius-3 border-gray-3',
        content     : 'w-full',
    },
    event :
    {
        // Перед созданием
        beforeCreateWindow  : 'SFModalBeforeCreateWindow',
        // Перед загрузкой контента
        beforeContentUpload : 'SFModalBeforeContentUpload',
        // После загрузки контента
        afterContentUpload  : 'SFModalAfterContentUpload',
        // Перед открытием
        beforeOpenWindow    : 'SFModalBeforeOpenWindow',
        // После открытия
        afterOpenWindow     : 'SFModalAfterOpenWindow',
        // Перед тем как свернуть
        beforeHideWindow    : 'SFModalBeforeHideWindow',
        // Перед тем как развернуть
        beforeShowWindow    : 'SFModalBeforeShowWindow',
        // Перед закрытием
        beforeCloseWindow   : 'SFModalBeforeCloseWindow',
        // Скрыть анимацию загрузки
        animationLoadHidden : 'SFModalAnimationLoadHidden',
        // Показать анимацию загрузки
        animationLoadShow   : 'SFModalAnimationLoadShow',
    },
}

Object.freeze(Modal);

SF.Param = SF.Param || {};
SF.Param.Modal = SF.Param.Modal || {};
SF.Param.Modal = Modal;
SF.Param.Modal = Object.freeze(SF.Param.Modal);
