/**
 * Modal window module
 * @description Модуль модальных окон
 * @param {*} e - Селектор HTML либо объект DOM
 * @param {*} param - Параметры модального окна
 */

// SF.Modal = function(e, param) {

export function Modal(e, param) {
  const _m = this;
  _m.awaitEvent = () => {};
  _m.isOpening = false;
  _m.allowOpenEvent = true;

  /**
   * @description Обновление параметров
   * @param {object} param - передаваемые параметры
   */
  _m.updateparam = function (param) {
    for (const key in param) {
      _m.param[key] = param[key];
    }
  };

  _m.getElement = function (e) {
    return typeof e === 'object' ? e : document.querySelector(e);
  };

  _m.removerBlur = function (page) {
    if (_m.param.blur && _m.param.blur !== false) {
      if (page !== null && page !== undefined) {
        page.classList.remove('blur-4');
      }
    }
  };

  _m.setBlur = function (page) {
    if (_m.param.blur) {
      if (page !== null && page !== undefined) {
        page.classList.add('blur-4');
      }
    }
  };

  _m.build = function () {
    let constructor = {
      load: {},
      container: null,
      overlay: null,
      area: {
        content: {},
        close: {},
        hide: {},
        pointer: {},
        next: {},
        prev: {},
        topPanel: {},
        bottomPanel: {},
      },
    };
    let float = {};

    constructor.container = document.createElement('div');
    constructor.overlay = document.createElement('div');
    constructor.area = document.createElement('div');
    constructor.container.appendChild(constructor.overlay);
    if (_m.param.iframe && _m.param.iframe !== false) {
      constructor.area.content = document.createElement('iframe');
      constructor.area.content.allowfullscreen = 'allowfullscreen';
      constructor.area.content.allow = 'autoplay;fullscreen';
      constructor.area.content.src = _m.param.src;
    } else {
      constructor.area.content = document.createElement('div');
    }

    constructor.container.className = `sf-modal-wrap fixed w-full h-full top-0 inline-end-0 bottom-0 inline-start-0 items-cross-center content-main-center`;
    constructor.overlay.className = `sf-modal-overlay ${_m.param.overlay}`;
    constructor.container.style.display = 'none';
    constructor.container.style.zIndex = SF.topZIndex() + 1;
    constructor.area.className = 'sf-modal-area ' + _m.param.area;
    // alert('Добавить модификатор для container на базе simai/admin/block/template/column.panel.php:169 И проверить табы')
    if (!_m.param.width) {
      _m.param.width = 'auto';
    }

    if (!_m.param.height) {
      _m.param.height = 'auto';
    }

    if (_m.param.tooltip.active) {
      constructor.area.style.maxWidth = _m.param.width;
      constructor.area.style.maxHeight = _m.param.height;
    }

    constructor.area.content.className = 'sf-modal-content ' + _m.param.content;
    constructor.area.style.opacity = '0';

    if (_m.param.hide.active || _m.param.autoload == 'collapsed') {
      constructor.area.hide = {};
      float = {
        message: {
          container: {
            close: {},
            show: {},
          },
        },
      };

      constructor.area.hide = document.createElement('button');
      constructor.area.hide.className =
        'sf-modal-hide ' + _m.param.hide.modifier;

      constructor.area.hide.addEventListener(
        'click',
        SF.__internal.send.bind(_m, _m.param.event.beforeHideWindow, constructor),
      );

      constructor.area.appendChild(constructor.area.hide);
      _m.isService();

      if (!_m.service.querySelector('.sf-modal-floatContainer')) {
        float = document.createElement('div');
        float.className =
          'sf-modal-floatContainer fixed inline-end-0 bottom-0 flex flex-col items-cross-end content-main-end';
        _m.service.appendChild(float);
      } else {
        float = _m.service.querySelector('.sf-modal-floatContainer');
      }

      float.message = document.createElement('div');
      float.message.container = document.createElement('div');
      float.message.container.close = document.createElement('div');
      float.message.container.show = document.createElement('div');
      float.message.className = 'float-wrapper m-inline-end-3';
      float.message.style.display = 'none';
      float.message.container.className =
        'float-container w-full relative flex items-cross-start content-main-end border-primary m-border-2 border-1 inline-end-1';
      float.message.container.close.className =
        'float-close p-2 border-inline-start-1 b-primary text-1/2 string-none cursor-pointer hover:opacity-4 transition';
      float.message.container.close.innerHTML =
        '<svg style="width:1em;height:1em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M310.6 361.4c12.5 12.5 12.5 32.75 0 45.25C304.4 412.9 296.2 416 288 416s-16.38-3.125-22.62-9.375L160 301.3L54.63 406.6C48.38 412.9 40.19 416 32 416S15.63 412.9 9.375 406.6c-12.5-12.5-12.5-32.75 0-45.25l105.4-105.4L9.375 150.6c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L160 210.8l105.4-105.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-105.4 105.4L310.6 361.4z"/></svg>';
      float.message.container.show.className =
        'float-btnShow p-2 border-inline-start-1 border-primary text-1/2 string-none cursor-pointer hover:opacity-4 transition';
      float.message.container.show.innerHTML =
        '<svg style="width:1em;height:1em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M128 32H32C14.31 32 0 46.31 0 64v96c0 17.69 14.31 32 32 32s32-14.31 32-32V96h64c17.69 0 32-14.31 32-32S145.7 32 128 32zM416 32h-96c-17.69 0-32 14.31-32 32s14.31 32 32 32h64v64c0 17.69 14.31 32 32 32s32-14.31 32-32V64C448 46.31 433.7 32 416 32zM128 416H64v-64c0-17.69-14.31-32-32-32s-32 14.31-32 32v96c0 17.69 14.31 32 32 32h96c17.69 0 32-14.31 32-32S145.7 416 128 416zM416 320c-17.69 0-32 14.31-32 32v64h-64c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c17.69 0 32-14.31 32-32v-96C448 334.3 433.7 320 416 320z"/></svg>';

      if (_m.param.name) {
        float.message.container.name = {};
        float.message.container.name = document.createElement('div');
        float.message.container.name.className =
          'h-full flex items-cross-center overflow-hidden m-inline-end-2 m-inline-start-2 text-1/2 t-truncate wrap-none';
        float.message.container.name.style.maxWidth = '150px';
        float.message.container.name.innerHTML = _m.param.name;
        float.message.container.name.setAttribute('title', _m.param.name);
        float.message.container.appendChild(float.message.container.name);
      } else {
        float.message.container.classList.add('p-inline-start-6');
      }

      float.message.container.appendChild(float.message.container.close);
      float.message.container.appendChild(float.message.container.show);
      float.message.appendChild(float.message.container);
      float.appendChild(float.message);

      _m.float = float.message;

      float.message.container.close.addEventListener('click', function () {
        SF.__internal.send(_m.param.event.beforeCloseWindow, constructor);
      });

      float.message.container.show.addEventListener('click', function () {
        SF.__internal.send(_m.param.event.beforeShowWindow, constructor);
      });
    }

    constructor.area.appendChild(constructor.area.content);

    if (_m.param.close.active) {
      constructor.area.close = document.createElement('button');
      constructor.area.close.className =
        'sf-modal-close sf-close ' + _m.param.close.modifier;
      constructor.area.appendChild(constructor.area.close);

      constructor.area.close.addEventListener(
        'click',
        SF.__internal.send.bind(_m, _m.param.event.beforeCloseWindow, constructor),
      );
    }

    if (_m.param.load.active) {
      constructor.load = document.createElement('div');
      constructor.load.innerHTML = _m.param.load.html;

      if (_m.param.tooltip.active) {
        constructor.load.className =
          'loader-container w-full p-3 elevation-3 border-1 border-gray-3 radius-2';
      } else {
        constructor.load.className =
          'loader-container w-full fixed top-0 inline-start-0';
      }

      constructor.container.appendChild(constructor.load);

      SF.__internal.receive(
        _m.param.event.animationLoadHidden,
        constructor.load,
        function (e) {
          e.target.style.display = 'none';
        },
      );

      SF.__internal.receive(
        _m.param.event.animationLoadShow,
        constructor.load,
        function (e) {
          e.target.style.display = 'flex';
        },
      );
    }

    constructor.container.appendChild(constructor.area);

    if (!_m.param['overlay-close']) {
      constructor.overlay.addEventListener('click', function (e) {
        if (e.target == e.currentTarget) {
          const beforeClose = new Event(_m.param.event.beforeCloseWindow, {
            bubbles: true,
          });
          beforeClose.modal = _m;
          e.currentTarget.dispatchEvent(beforeClose);
        }
      });
    }

    SF.__internal.receive(
      _m.param.event.beforeContentUpload,
      constructor.container,
      _m.beforeContentUpload,
    );
    SF.__internal.receive(
      _m.param.event.afterContentUpload,
      constructor.container,
      _m.afterContentUpload,
    );
    SF.__internal.receive(
      _m.param.event.beforeCloseWindow,
      constructor.container,
      _m.beforeCloseWindow,
    );
    SF.__internal.receive(
      _m.param.event.beforeOpenWindow,
      constructor.container,
      _m.beforeOpenWindow,
    );
    SF.__internal.receive(
      _m.param.event.afterOpenWindow,
      constructor.container,
      _m.afterOpenWindow,
    );
    SF.__internal.receive(
      _m.param.event.beforeHideWindow,
      constructor.container,
      _m.beforeHideWindow,
    );
    SF.__internal.receive(
      _m.param.event.beforeShowWindow,
      constructor.container,
      _m.beforeShowWindow,
    );
    SF.__internal.receive(
      _m.param.event.close,
      constructor.container,
      SF.__internal.send.bind(_m, _m.param.event.beforeCloseWindow, constructor.container),
    );

    return constructor;
  };

  _m.beforeContentUpload = function () {
    const { container } = _m.modal;
    const page = _m.getElement(_m.param.page);

    container.style.display = 'flex';

    if (_m.param.tooltip.active) {
      const pE = _m.initPosition(
        _m.el,
        container.clientWidth,
        container.clientHeight,
      );
      container.style.top = pE.y + 'px';
      container.style.left = pE.x + 'px';
    } else {
      document.body.style.overflow = 'hidden';
    }

    _m.status = 'open';
    _m.setBlur(page);
    _m.param.beforeContentUpload(_m);
  };

  _m.beforeCloseWindow = function () {
    _m.param.beforeCloseWindow(_m);

    const { container, area, load } = _m.modal;
    const page = _m.getElement(_m.param.page);

    area.style.opacity = '0';
    container.style.display = 'none';

    if (!_m.param.unclose) {
      area.content.innerHTML = '';
      _m.status = 'close';

      if (_m.param.load.active) {
        load.style.display = 'flex';
      }

      if (container.parentNode != null) {
        container.parentNode.removeChild(container);
        _m.modal.container.remove();
      }
    } else {
      _m.status = 'collapsed';
    }

    if (_m.param.hide.active || _m.param.autoload == 'collapsed') {
      _m.float.style.display = 'none';
    }

    document.body.style.overflow = 'auto';

    _m.removerBlur(page);

    document.querySelectorAll('[modalinlinescript]').forEach((s) => {
      s.remove();
    });

    window.removeEventListener(
      _m.param.event.beforeContentUpload,
      _m.beforeContentUpload,
      false,
    );
    window.removeEventListener(
      _m.param.event.beforeOpenWindow,
      _m.beforeOpenWindow,
      false,
    );
    window.removeEventListener(
      _m.param.event.afterContentUpload,
      _m.afterContentUpload,
      false,
    );
    window.removeEventListener(
      _m.param.event.afterOpenWindow,
      _m.afterOpenWindow,
      false,
    );
    window.removeEventListener(
      _m.param.event.beforeShowWindow,
      _m.beforeShowWindow,
      false,
    );
    window.removeEventListener(
      _m.param.event.beforeHideWindow,
      _m.beforeHideWindow,
      false,
    );
    window.removeEventListener(
      _m.param.event.beforeCloseWindow,
      _m.beforeCloseWindow,
      false,
    );
  };

  _m.afterContentUpload = function () {
    _m.param.afterContentUpload(_m);
  };

  _m.beforeOpenWindow = function () {
    const { container } = _m.modal;

    if (_m.param.tooltip.active) {
      const pE = _m.initPosition(
        _m.el,
        container.clientWidth,
        container.clientHeight,
      );
      _m.modal.style.top = pE.y + 'px';
      _m.modal.style.left = pE.x + 'px';
    }
    _m.param.beforeOpenWindow(_m);
  };

  _m.afterOpenWindow = function () {
    _m.param.afterOpenWindow(_m);
  };

  _m.beforeShowWindow = function () {
    if (!_m.allowOpenEvent) return;
    _m.isOpening = true;
    const { container, load, area } = _m.modal;
    const page = _m.getElement(_m.param.page);

      if (_m.param.load.active) {
      load.style.display = 'none';
    }

    container.style.display = 'flex';

    if (!_m.param.tooltip.active) {
      document.body.style.overflow = 'hidden';
    }

    area.style.opacity = '1';
    _m.status = 'show';

    if (_m.param.hide.active || _m.param.autoload == 'collapsed') {
      _m.float.style.display = 'none';
    }

    _m.setBlur(page);
    _m.param.beforeShowWindow(_m);
  };

  _m.afterShowWindow = function () {
    if (!_m.isOpening) return;
    _m.isOpening = false;
    _m.param.afterOpenWindow(_m);
    SF.__internal.send(_m.param.event.afterOpenWindow, _m.modal.container);
  };

  _m.beforeHideWindow = function () {
    const { container, area, load } = _m.modal;
    const page = _m.getElement(_m.param.page);

    if (container.parentNode != null) {
      area.style.opacity = '0';
      container.style.display = 'none';
      if (_m.param.load.active) {
        load.style.display = 'none';
      }
    }

    _m.status = 'collapsed';
    _m.float.style.display = 'flex';
    document.body.style.overflow = 'auto';
    _m.removerBlur(page);
    _m.param.beforeHideWindow(_m);
  };

  _m.pasteContent = function (data) {
    if (typeof data === 'object') {
      _m.modal.area.content.append(data);
    } else {
      _m.modal.area.content.innerHTML = data;
    }
    SF.__internal.send(_m.param.event.afterContentUpload, _m.modal.container);
    _m.beforeShowWindow();
    requestAnimationFrame(_m.afterShowWindow);
  };

  _m.ajaxLoad = function () {
    if (!_m.param.iframe) {
      if (self.fetch) {
        new SF.Ajax(
          {
            url: _m.param.src ? _m.param.src : false,
            method: 'POST',
            dataType: 'html',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
            },
            body: {
              METHOD: 'PUT',
            },
          },
          function (data) {
            _m.pasteContent(data);
          },
        );
      }
    } else {
      if (_m.param.load.active) {
        _m.modal.load.style.display = 'none';
      }
      _m.modal.area.style.opacity = '1';
      _m.beforeShowWindow();
      requestAnimationFrame(_m.afterShowWindow);
    }
  };

  _m.selectAutoload = function () {
    switch (_m.param.autoload) {
      case 'hide':
        _m.status = 'open';
        _m.status = 'show';
        _m.param.hide.active = true;
        _m.allowOpenEvent = true;
        break;
      case 'show':
        SF.__internal.send(_m.param.event.beforeContentUpload, _m.modal.container);
        _m.allowOpenEvent = true;
        break;
      case 'collapsed':
        _m.status = 'open';
        _m.status = 'collapsed';
        SF.__internal.send(_m.param.event.beforeContentUpload, _m.modal.container);
        SF.__internal.send(_m.param.event.beforeHideWindow, _m.modal.container);
        _m.allowOpenEvent = false;
        break;
      default:
        _m.status = 'open';
        _m.status = 'show';
        _m.allowOpenEvent = true;
        break;
    }
  };

  _m.autoloadMode = function () {
    if (_m.param.autoload) {
      _m.selectAutoload();

      SF.ready(() => {
        _m.ajaxLoad();
      });
    } else {
      const send = SF.__internal.send(
        _m.param.event.beforeContentUpload,
        _m.modal.container,
      );

      if (send) {
        send.then(() => {
          _m.ajaxLoad();
        });
      } else {
        _m.ajaxLoad();
      }

      /* .then(e => {
                console.log(e)
                _m.ajaxLoad()
            }) */
    }
  };

  /**
   * Режим загрузки данных:
   * ajax - загрузка данных из файла;
   * inline - загрузка данных из объекта в документе;
   * gallery - фотогалерея.
   */

  _m.modeLoad = function () {
    switch (_m.param.mode) {
      case 'ajax':
        _m.autoloadMode();
        break;
      case 'inline': {
        const inContent = document.querySelector(_m.param.src);
        if (inContent) {
          const copy = inContent.cloneNode(true);
          copy.removeAttribute('id');
          copy.style.display = 'block';

          const appendAndShow = () => {
            SF.__internal.send(_m.param.event.beforeContentUpload, _m.modal.container);
            _m.modal.area.content.appendChild(copy);
            SF.__internal.send(_m.param.event.afterContentUpload, _m.modal.container);
            _m.beforeShowWindow();
            requestAnimationFrame(_m.afterShowWindow);
          };

          if (_m.param.autoload) {
            SF.ready(appendAndShow);
          } else {
            setTimeout(appendAndShow);
          }
        }
        break;
      }
      case 'image':
        SF.__internal.send(_m.param.event.beforeContentUpload, _m.modal.container);
        setTimeout(function () {
          if (typeof _m.param.html === 'object') {
            _m.modal.area.content.append(_m.param.html);
          } else {
            _m.modal.area.content.innerHTML = _m.param.html;
          }
          SF.__internal.send(_m.param.event.afterContentUpload, _m.modal.container);

          // _m.modal.area.content.appendChild(copy);
          // _m.modal.load.style.display      = 'none';
          // SF.__internal.send(_m.param.event.animationLoadHidden, _m.modal.load);
          if (_m.param.load.active) {
            _m.modal.load.style.display = 'none';
          }
          _m.modal.area.style.opacity = '1';
          SF.__internal.send(_m.param.event.beforeOpenWindow, _m.modal.container);
        }, _m.loadtimeout);
        break;
      case 'video':
        break;
      case 'iframe':
        break;
      default:
        _m.autoloadMode();
        break;
    }
  };

  _m.isService = function () {
    _m.service = _m.service || _m.getElement(_m.param.service);

    if (!_m.service) {
      SF.ready(SF.__internal.send.bind(_m, 'onSFServiceAvailability', window));
    }
  };

  _m.contentUpload = function () {
    _m.isService();

    if (_m.status !== 'collapsed' && _m.status !== 'show') {
      _m.service.appendChild(_m.modal.container);
      _m.modeLoad();
    } else {
      _m.allowOpenEvent = true;
      SF.__internal.send(_m.param.event.beforeShowWindow, _m.modal.container);
    }
  };

  /**
   * Определение позиции инизиализатора с последующим определением координат
   * размещения модального окна
   * @param {*} e - Элемент - инициализатор
   * @param {*} w - Шрина модального окна
   * @param {*} h - Высота модального окна
   */
  _m.initPosition = function (e, w = 300, h = 300) {
    if (e) {
      const rP = { x: 0, y: 0 };
      const eH = e.offsetHeight;
      const pE = SF.curpos(e);
      const bW = document.body.clientWidth;
      const bH = document.body.clientHeight;
      const pW = _m.param.width.replace(/[A-z\%]{1,4}/, '');
      const pH = _m.param.height.replace(/[A-z\%]{1,4}/, '');

      w = Number(pW || w);
      h = Number(pH || h);

      switch (_m.param.tooltip.position) {
        case 'top':
          if (pE.top >= h) {
            rP.y = pE.top - h - 2;
            rP.x = pE.left - 2;
          } else {
            rP.y = pE.bottom - 2;
            rP.x = pE.left - 2;
          }

          break;
        case 'bottom':
          rP.y = pE.bottom + 2;
          rP.x = pE.left;
          break;
        case 'left':
          if (bH - pE.bottom < h) {
            rP.y = pE.bottom - h - eH;
          } else {
            rP.y = pE.bottom + 2 - eH;
          }

          if (pE.left >= w) {
            rP.x = pE.left - w > 0 ? pE.left - w - 2 : 0;
          } else {
            rP.x = pE.left + pE.width + 2;
          }
          break;
        default:
          if (bH - pE.bottom < h) {
            rP.y = pE.bottom - h - eH - 2;
          } else {
            rP.y = pE.bottom - 2 - eH;
          }

          if (pE.left + pE.width + w < bW) {
            rP.x = pE.left + pE.width + 2;
          } else {
            rP.x = pE.left - w - 2;
          }
          break;
      }
      return rP;
    }
    return false;
  };

  _m.create = function () {
    const beforeCreate = new Event(_m.param.event.beforeCreateWindow, {
      bubbles: true,
    });
    beforeCreate.modal = _m;
    _m.el.dispatchEvent(beforeCreate);
    _m.param.beforeCreateWindow(_m);
    _m.modal = _m.build();
    _m.status = 'close';

    if (_m.param.tooltip.active) {
      const pE = _m.initPosition(_m.el);
      _m.modal.container.style.top = pE.y + 'px';
      _m.modal.container.style.left = pE.x + 'px';
    }
  };

  if (e) {
    _m.el = _m.getElement(e);

    _m.param = {
      loadtimeout: '1000', // Отсрочка загрузки до появления контента в ms
      width: false, // Ширина
      height: false, // Высота
      name: false, // Наименование
      src: false, // Путь до загрузжаемого файла - по умолчанию пусто
      iframe: false, // Модальное в виде фрейма
      blur: false, // Размытие контента
      autoload: false, // Предварительная загрузка контента - три режима - hide-скрыто (default), - show-открыто, - collapsed-свернуто,
      unclose: false, // Принудительный кэш данных
      action: 'click', // Показывать при клике (click) или при наведении (hover)
      mode: 'ajax', // Режим загрузки данных (параметр src, атрибут sf-src) по умолчанию ajax, также inline - объект по селлектору, и gallery - фотогалерея
      init: '[sf-modal]', // Селектор инициализации модального окна
      service: '[data-name*="sf-service-bottom-area"]', // Контейнер для вставки
      page: '[data-name*="sf-pagewrap-area"]', // Основная область страницы для blur
      container: '.sf-modal-container',
      overlay:
        'sf-modal-overlay fixed w-full h-full top-0 inline-end-0 bottom-0 inline-start-0 items-cross-center content-center bg-surface-transparent-overlay',
      'overlay-close': false,
      area: 'sf-modal-area relative w-10/12 sm:w-10/12 w-2/3 lg:w-1/2 xl:w-1/2', // Модификаторы контейнера контентной части
      content: 'sf-modal-content overflow-auto border-0 bg-surface-1 p-2', // Модификаторы контентной части
      html: false,
      data: {},
      beforeCreateWindow: () => {}, // Перед созданием
      beforeContentUpload: () => {}, // Перед загрузкой контента
      afterContentUpload: () => {}, // После загрузки контента
      beforeOpenWindow: () => {}, // Перед открытием
      afterOpenWindow: () => {}, // После открытия
      beforeHideWindow: () => {}, // Перед тем как свернуть
      beforeShowWindow: () => {}, // Перед тем как развернуть
      beforeCloseWindow: () => {}, // Перед закрытием
      close: {
        active: true,
        modifier: 'sf-close transition', // Модификаторы кнопки закрыть модальное окно
      },
      load: {
        active: true, // Добавляем | убираем анимацию загрузки контента
        html: '<div class="sf-progress"><div class="sf-progress-animation"></div></div>', // Верстка анимации загрузки контента
      },
      pointer: {
        active: false,
        modifier: 'absolute overflow-hidden',
      },
      hide: {
        active: false,
        modifier:
          'cursor-pointer absolute top-b6 inline-end-d0 w-b6 h-b6 z-1 opacity-4 transition border-0 bg-transparent before:content-empty before:absolute before:inline-start-0 before:h-a2 before:w-full before:bg-gray-9',
      },
      // Модальное окно в виде подсказки. Позиция top, right, bottom,
      // left по отношению инициализатора и auto - адаптивный,
      // значение по умолчанию
      tooltip: {
        active: false, // Активность
        position: 'bottom', // Положение
        overlay: 'absolute flex-col items-cross-start',
        area: 'w-full overflow-auto p-4 elevation-3 border-1 radius-3 border-gray-3',
        content: 'w-full',
      },
      event: {
        // Перед созданием
        beforeCreateWindow: 'SFModalBeforeCreateWindow',
        // Перед загрузкой контента
        beforeContentUpload: 'SFModalBeforeContentUpload',
        // После загрузки контента
        afterContentUpload: 'SFModalAfterContentUpload',
        // Перед открытием
        beforeOpenWindow: 'SFModalBeforeOpenWindow',
        // После открытия
        afterOpenWindow: 'SFModalAfterOpenWindow',
        // Перед тем как свернуть
        beforeHideWindow: 'SFModalBeforeHideWindow',
        // Перед тем как развернуть
        beforeShowWindow: 'SFModalBeforeShowWindow',
        // Перед закрытием
        beforeCloseWindow: 'SFModalBeforeCloseWindow',
        // Скрыть анимацию загрузки
        animationLoadHidden: 'SFModalAnimationLoadHidden',
        // Показать анимацию загрузки
        animationLoadShow: 'SFModalAnimationLoadShow',
        // Закрывает окно
        close: 'modalclose',
      },
    };

    SF.cloneDeep(_m.param, param);
    _m.isService();

    if (_m.el) {
      if (_m.param.tooltip.active) {
        _m.param.overlay = _m.param.tooltip.overlay;
        _m.param.area = _m.param.tooltip.area;
        _m.param.content = _m.param.tooltip.content;
      }

      _m.create();

      if (_m.param.action == 'hover') {
        _m.el.addEventListener('mouseover', function (e) {
          e.preventDefault();
          _m.contentUpload();
        });

        _m.el.addEventListener('mouseout', function (e) {
          e.preventDefault();
          SF.__internal.send(_m.param.event.beforeCloseWindow, _m.modal.container);
        });
      } else {
        _m.el.addEventListener('click', (e) => {
          e.preventDefault();

          if (_m.status == 'open') {
            SF.__internal.send(_m.param.event.beforeCloseWindow, _m.modal.container);
          } else {
            _m.contentUpload();
          }
        });
      }

      if (_m.param.autoload) {
        _m.contentUpload();
      }
    }

    addEventListener('keydown', function (e) {
      if (e.key == 'Escape') {
        if (_m.status == 'open') {
          if (getComputedStyle(_m.modal.overlay).display == 'flex') {
            SF.__internal.send(_m.param.event.beforeCloseWindow, _m.modal.container);
          }
        }
      }
    });
  }
}

SF.Modal = Modal;
