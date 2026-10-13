/**
 *  Modal search module
 * @description Модуль поиска и обнаружения модальных окон
 * @param {*} e - массив атрибутов элементов для поиска в DOM дереве
 * @param {*} param
 */

//SF.Search = function(e = {modal:'[sf-modal]'}, param) {
export function Search(e = {modal:'[sf-modal]'}, param)
{

    var _s = this;
    var searchLiveStart = false;

    /**
     * @description Обновление параметров
     * @param {object} param - передаваемые параметры
     */
    _s.updateparam = function(param)
    {
        for(let key in param)
        {
            _s.param[key] = param[key];
        }
    }

    _s.uParam = function(param, prev)
    {
        for(let key in param)
        {
            prev[key] = param[key];
        }
        return prev
    }

    _s.noCloneInit = function(e, key)
    {
        for(let k = 0; k < _s.init[key]['el'].length; k++)
        {
            if(_s.init[key]['el'][k] == e)
            {
                return false;
            }
        }
        return true;
    }

    _s.attrParamUpdate = function(e)
    {
        let param = {},
            value = '';

        Object.assign(param, _s.param);

        for(let kParam in _s.param.data)
        {
            if(e.hasAttribute(_s.param.data[kParam]))
            {
                value = e.getAttribute(_s.param.data[kParam]);

                switch(kParam)
                {
                    case 'hide':
                        param[kParam].active = true;
                        param[kParam].modifier = value ? value : param[kParam].modifier;
                        break;
                    case 'close':
                        param[kParam].active = true;
                        param[kParam].modifier = value ? value : param[kParam].modifier;
                        break;
                    case 'close-modifier':
                        param['close'].active = true;
                        param['close'].modifier = value ? value : param['close'].modifier;
                        break;
                    case 'load':
                        param[kParam].active = true;
                        break;
                    case 'tooltip':
                        { let overlay = e.getAttribute(_s.param.data.overlay),
                            area = e.getAttribute(_s.param.data.area),
                            content = e.getAttribute(_s.param.data.content);

                        param[kParam].active = true;
                        param[kParam].position = value ? value
                            : param[kParam].position;

                        param[kParam].overlay = overlay ? overlay
                            : param[kParam].overlay;
                        param[kParam].area = area ? area
                            : param[kParam].area;
                        param[kParam].content = content ? content
                            : param[kParam].content;

                        break; }
                    case 'pointer':

                        param[kParam].active = (value !== 'false');

                        if (value !== 'true' && value !== 'false' && value !== true && value)
                        {
                            param[kParam].modifier = value ? value : param[kParam].modifier;
                        }
                        break;
                    default:
                        param[kParam] = value ? value : true;
                        break;
                }
            }
            else
            {
                param[kParam] = _s.param[kParam];
            }
        }
        return param;
    }

    _s.collection = function(map, key, e)
    {
        let obGallery = {};

        if(map.has(key) && (key != ''))
        {
            obGallery = map.get(key);
            obGallery.elements.push(e);
            map.set(key, obGallery);
            obGallery.container.append(obGallery.item(e));
        }
        else
        {
            // The legacy attribute gallery is built by nothing (its module is
            // not imported), so SF.Gallery is absent and [sf-gallery] markup
            // is left alone, as [sf-modal] and [sf-overbox] are without their
            // modules. It used to throw inside the sf-loader-ready handler.
            if (!SF.Gallery) return;
            obGallery = new SF.Gallery(e.e, [e], _s.attrParamUpdate(e.e));
            obGallery.elements = [e];
            map.set(key, obGallery);
        }
    }

    /**
     *
     * @param {*} e
     * @param {*} mod
     */
     _s.commonInit = function(e, mod)
     {
        switch(mod)
        {
            case 'modal':
                _s.init.modal.el.push(e);
                if(SF) {
                    if(SF.Modal) {
                        new SF.Modal(e, _s.attrParamUpdate(e));
                    }
                }
                break;
            case 'gallery':
                { let atr = _s.eSearch[mod].replace(/[\[\]]/g, ''), // Пересмотреть
                    aV = e.getAttribute(atr),
                    src = e.getAttribute('href') ? e.getAttribute('href')
                        : e.getAttribute('src'),
                    mode    = e.getAttribute('sf-mode')
                        ? e.getAttribute('sf-mode') : 'image';
                    _s.init.gallery.el.push(e);

                let obj = {
                    e       : e,
                    param   : _s.attrParamUpdate(e),
                    src     : src,
                    mode    : mode,
                    gallery : aV,
                }

                _s.collection(_s.init.gallery.map, aV, obj);

                break; }
            case 'overbox':
                _s.init.overbox.el.push(e);
                if(SF) {
                    if(SF.Overbox) {
                        new SF.Overbox(e, _s.attrParamUpdate(e));
                    }
                }
                break;
        }
    }

    _s.searchInit = function()
    {
        for(let key in _s.eSearch)
        {
            let element = document.querySelectorAll(_s.eSearch[key]);

            if(element) {
                element.forEach(item => {
                    if(_s.noCloneInit(item,key)) {
                        _s.commonInit(item,key);
                    }
                });
            }
        }

        searchLiveStart = true;
    }

    _s.search = function()
    {
        let callback = function(change)
        {
            change.map(function(e)
            {
                if(searchLiveStart)
                {
                    for(let key in _s.eSearch)
                    {
                        let mTarget = e.target.matches(_s.eSearch[key]);

                        if(mTarget)
                        {
                            if(_s.noCloneInit(e.target, key))
                            {
                                _s.commonInit(e.target, key);
                            }
                        }

                        let mChildTarget =
                            e.target.querySelectorAll(_s.eSearch[key]);

                        if(mChildTarget.length > 0)
                        {
                            for(let k = 0; k < mChildTarget.length; k++)
                            {
                                if(_s.noCloneInit(mChildTarget[k], key))
                                {
                                    _s.commonInit(mChildTarget[k], key);
                                }
                            }
                        }
                    }
                }
            });

        },
        watchDOM = new MutationObserver(callback),
        options = {
            childList: true,
            subtree: true,
            attributeFilter: ['sf-modal','sf-gallery','sf-overbox']
        }
        watchDOM.observe(document, options);
    }

    _s.init = {
        modal :
        {
            el  :[],
        },
        gallery :
        {
            el  :[],
            map :new Map(),
        },
        overbox :
        {
            el : [],
        }
    }

    _s.eSearch = {
        modal   : '[sf-modal]',
        gallery : '[sf-gallery]',
        overbox : '[sf-overbox]',
    }

    _s.param = {
        loadtimeout         : '1000',       // Отсрочка загрузки до появления контента в ms
        width               : 'auto',       // Ширина
        height              : 'auto',       // Высота
        name                : false,        // Наименование
        src                 : false,        // Путь до загрузжаемого файла - по умолчанию пусто
        iframe              : false,        // Модальное в виде фрейма
        blur                : false,        // Размытие контента
        // Предварительная загрузка контента - три режима - hide-скрыто (default),
        // - show-открыто, - collapsed-свернуто,
        autoload            : false,
        unclose             : false,        // Принудительный кэш данных
        action              : 'click',      // Показывать при клике (click) или при наведении (hover)
        mode                : 'ajax',        // Режим загрузки данных (параметр src, атрибут sf-src) по умолчанию ajax, также inline - объект по селлектору, и gallery - фотогалерея
        init                : '[sf-modal]', // Селектор инициализации модального окна
        service             : '[data-name*="sf-service-bottom-area"]',    // Контейнер для вставки
        page                : '[data-name*="sf-pagewrap-area"]',          // Основная область страницы для blur
        container           : '.sf-modal-container',
        // Модификаторы подложки модального окна
        overlay : 'sf-modal-overlay fixed w-full h-full top-0 inline-end-0 bottom-0 inline-start-0 items-cross-center content-main-center bg-surface-transparent-overlay',
        'overlay-close': false,
        area                : 'sf-modal-area relative w-10/12 sm:w-10/12 w-2/3 lg:w-1/2 xl:w-1/2', // Модификаторы контейнера контентной части
        // Модификаторы контентной части
        content             : 'sf-modal-content overflow-auto border-0 bg-surface-1 p-6',
        html : false,
        beforeCreateWindow      : function() {},   // Перед созданием
        beforeContentUpload     : function() {},   // Перед загрузкой контента
        afterContentUpload      : function() {},   // После загрузки контента
        beforeOpenWindow        : function() {},   // Перед открытием
        afterOpenWindow         : function() {},   // После открытия
        beforeHideWindow        : function() {},   // Перед тем как свернуть
        beforeShowWindow        : function() {},   // Перед тем как развернуть
        // Перед закрытием
        beforeCloseWindow       : function() {},
        // Модальное окно в виде подсказки. Позиция top, right, bottom,
        // left по отношению инициализатора и auto - адаптивный, значение по
        // умолчанию
        tooltip :
        {
            active      : false,        // Активность
            position    : 'bottom',     // Положение
            overlay     : 'absolute flex-col items-cross-start',
            area        : 'w-full overflow-auto p-4 elevation-3 border-1 radius-3 border-gray-3',
            content     : 'w-full',
        },
        load :
        {
            active : true,         // Добавляем | убираем анимацию загрузки контента
            html : '<div class="sf-progress"><div class="sf-progress-animation"></div></div>', // Верстка анимации загрузки контента
        },
        pointer :
        {
            active : false,
            html : '',
        },
        close :
        {
            active : true,
            modifier : 'sf-close transition', // Модификаторы кнопки закрыть модальное окно
        },
        hide :
        {
            active : false,
            modifier : 'cursor-pointer absolute top-b6 inline-end-d0 w-b6 h-b6 z-1 opacity-4 transition border-0 bg-transparent before:content-empty before:absolute before:inline-start-0 before:h-a2 before:w-full before:bg-gray-9',
        },
        event:
        {
            // Перед созданием
            beforeCreateWindow  : 'SFModalBeforeCreateWindow',
            // Перед загрузкой контента
            beforeContentUpload : 'SFModalBeforeContentUpload',
            afterContentUpload  : 'SFModalAfterContentUpload',  // После загрузки контента
            beforeOpenWindow    : 'SFModalBeforeOpenWindow',    // Перед открытием
            afterOpenWindow     : 'SFModalAfterOpenWindow',     // После открытия
            beforeHideWindow    : 'SFModalBeforeHideWindow',    // Перед тем как свернуть
            beforeShowWindow    : 'SFModalBeforeShowWindow',    // Перед тем как развернуть
            beforeCloseWindow   : 'SFModalBeforeCloseWindow',   // Перед закрытием
            animationLoadHidden : 'SFModalAnimationLoadHidden', // Скрыть анимацию загрузки
            animationLoadShow   : 'SFModalAnimationLoadShow',   // Показать анимацию загрузки
        },
        data :
        {
            action: 'sf-action',
            pointer: 'sf-pointer',
            width: 'sf-width',
            height: 'sf-height',
            name: 'sf-name',
            src: 'sf-src',
            overlay: 'sf-overlay-modifier',    // overlay
            'overlay-close': 'sf-overlay-close',
            area: 'sf-modal-modifier',      // area
            content: 'sf-content-modifier',    // content
            close: 'sf-close',
            'close-modifier': 'sf-close-modifier',      // close
            hide: 'sf-hide',
            'hide-modifier': 'sf-hide-modifier',
            blur: 'sf-blur',
            autoload: 'sf-autoload',        // Предварительная загрузка контента
            unclose: 'sf-unclose',        // Принудительный кэш данных
            tooltip: 'sf-tooltip',
            overbox: 'sf-overbox',
            mode: 'sf-mode',
            iframe: 'sf-iframe',
        }
    };

    //_s.overbox = {};
    //SF.extend(_s.param, SF.Param.Modal);
    //SF.extend(_s.overbox, SF.Param.Overbox);

    /*_s.param.data = {
        action              : 'sf-action',
        width               : 'sf-width',
        height              : 'sf-height',
        name                : 'sf-name',
        src		            : 'sf-src',
        overlay	            : 'sf-overlay-modifier',    // overlay
        area	            : 'sf-modal-modifier',      // area
        content	            : 'sf-content-modifier',    // content
        close               : 'sf-close',
        'close-modifier'    : 'sf-close-modifier',      // close
        hide                : 'sf-hide',
        'hide-modifier'     : 'sf-hide-modifier',
        blur	            : 'sf-blur',
        autoload            : 'sf-autoload',        // Предварительная загрузка контента
        unclose             : 'sf-unclose',        // Принудительный кэш данных
        tooltip             : 'sf-tooltip',
        overbox             : 'sf-overbox',
        mode                : 'sf-mode',
        iframe	            : 'sf-iframe',
    };*/

    SF.cloneDeep(_s.param, param);

    //_s.updateparam(param);
    //_s.uParam(e, _s.eSearch);
    Object.assign(e, _s.eSearch);
    Object.freeze(_s.param);
    Object.freeze(_s.eSearch);

    if(document)
    {
        _s.search();
        document.addEventListener('DOMContentLoaded',() => {searchLiveStart=true});
        document.addEventListener('load',() => {searchLiveStart=true});
        _s.searchInit();
    }
}


SF.Search = Search;
