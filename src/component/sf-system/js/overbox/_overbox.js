/**
 *  Modal search module
 * @description Модуль поиска и обнаружения модальных окон
 * @param {*} e - массив атрибутов элементов для поиска в DOM дереве
 * @param {*} param
 */

export default function Overbox(e, param) {

    var _o = this;
    _o.param = {
        action : 'hover',
        mode : 'inline',
        loadtimeout : '0',
        width : '300px',
        height : false,
        event : {},
        hide :
        {
            active : false
        },
        close :
        {
            active : false,
            modifier : 'sf-close transition'
        },
        load :
        {
            active : false,
        },
        tooltip :
        {
            active      : true,
            position    : 'auto',
            overlay     : 'absolute flex-col item-cross-center',
            area        : 'w-full overflow-auto p-4 border-1 radius-1 border-gray-1 elevation-4',
            content     : 'w-full',
        },
        pointer :
        {
            active : true,
            modifier : 'absolute overflow-hidden -top-c1 w-c6 h-c1 before:content-empty before:absolute before:w-b6 before:h-b6 before:rotate-6 before:top-b6 before:inline-start-a8'
        },
        data :
        {
            action              : 'sf-action',
            pointer             : 'sf-pointer',
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
            overbox             : 'sf-overbox',
            mode                : 'sf-mode',
            iframe	            : 'sf-iframe',
        }
    };

    _o.getElement = function(e)
    {
        return (typeof(e) == "object") ? e : document.querySelector(e);
    }

    _o.attrParamUpdate = function(e, param)
    {
        if(e)
        {
            var value = '';
            for(var kParam in _o.param.data)
            {
                if(e.hasAttribute(_o.param.data[kParam]))
                {
                    value = e.getAttribute(_o.param.data[kParam]);
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
                        case 'load':
                            param[kParam].active = true;
                            break;
                        case 'overbox':
                            { param.tooltip.active = true;
                            param.tooltip.position = value ? value : 'auto';
                            let overlay = e.getAttribute(_o.param.data.overlay),
                                area = e.getAttribute(_o.param.data.area),
                                content = e.getAttribute(_o.param.data.content);
                            param.tooltip.overlay = overlay ? overlay : param.tooltip.overlay;
                            param.tooltip.area = area ? area : param.tooltip.area;
                            param.tooltip.content = content ? content : param.tooltip.content;
                            break; }
                        case 'pointer':
                            param[kParam].active = (value !== 'false');

                            if(value !== 'true' && value !== 'false' && value !== true && value )
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
                    param[kParam] = _o.param[kParam];
                }
            }
        }

        return param;
    }

    _o.initPosition = function(e, w = 300, h = 300)
    {
        if(e)
        {
            let rP = {x:0, y:0, pointer: {x:8, y:-22}},
                pE = SF.curpos(e),
                bW = document.body.clientWidth,
                bH = document.body.clientHeight,
                pW = _o.param.width ? _o.param.width.replace(/[A-z\%]{1,4}/,'') : (w ? w : false),
                pH = _o.param.height ? _o.param.height.replace(/[A-z\%]{1,4}/,'') : (h ? h : false);

            w = Number(pW ? pW : w);
            h = Number(pH ? pH : h);

            switch(_o.param.tooltip.position)
            {
                case 'top':

                    if(pE.top >= h)
                    {
                        rP.y = (pE.top - h) - 2 - 11;
                        rP.x = (pE.left - 2);
                    }
                    else
                    {
                        rP.y = (pE.bottom - 2 - 11);
                        rP.x = (pE.left - 2);
                    }

                    if(_o.param.pointer.active)
                    {
                        rP.pointer.x = (pE.width / 2);
                        rP.pointer.y = h;
                        _o.overbox
                            .modal
                            .area
                            .pointer
                            .className = "absolute overflow-hidden -top-c1 w-c6 h-c1 before:content-empty before:absolute before:w-b6 before:h-b6 before:rotate-6 before:top-auto before:bottom-b6 before:inline-start-a8";
                        _o.overbox
                            .modal
                            .area
                            .pointer
                            .classList
                            .add('sf-overbox-bottom');
                    }

                    break;
                case 'right':

                    if((bH - pE.bottom) < h)
                    {
                        rP.y = (pE.bottom - h) - pE.height - 11;
                    }
                    else
                    {
                        rP.y = (pE.bottom + 2) - pE.height - 11;
                    }

                    if((bW - pE.right) > w)
                    {
                        rP.x = pE.right + 2 + 11;
                    }
                    else if(pE.left > w)
                    {
                        rP.x = (pE.right - pE.width) - 2 - 11;
                    }

                    if(_o.param.pointer.active)
                    {
                        rP.pointer.x = -26;
                        rP.pointer.y = (pE.height / 2);
                        _o.overbox.modal.area.pointer
                            .className = 'absolute top-b6 -inline-start-c3 rotate-270 overflow-hidden w-c6 h-c1 before:content-empty before:absolute before:w-b6 before:h-b6 before:rotate-6 before:top-b6 before:inline-start-a8';
                        _o.overbox
                            .modal
                            .area
                            .pointer
                            .classList
                            .add('sf-overbox-left');
                    }

                    break;
                case 'bottom':

                    rP.y = (pE.bottom + 2 + 11);
                    rP.x = (pE.left - (pE.width / 2));

                    if(_o.param.pointer.active)
                    {
                        rP.pointer.x = (pE.width / 2);
                        _o.overbox.modal.area.pointer.classList.add('sf-overbox-top');
                    }

                    break;
                case 'left':

                    if((bH - pE.bottom) < h)
                    {
                        rP.y = (pE.bottom - h) - pE.height - 11;
                    }
                    else
                    {
                        rP.y = (pE.bottom + 2) - pE.height - 11;
                    }

                    if(pE.left > w)
                    {
                        rP.x = ((pE.left - w) > 0) ? pE.left - w - 2 - 11 : 0;
                    }
                    else
                    {
                        rP.x = (pE.left + pE.width) + 2;
                    }

                    if(_o.param.pointer.active)
                    {
                        rP.pointer.x = w - 5;
                        rP.pointer.y = (pE.height / 2);
                        _o.overbox
                            .modal
                            .area
                            .pointer
                            .className = 'absolute overflow-hidden -top-c1 w-c6 h-c1 before:content-empty before:absolute before:w-b6 before:h-b6 rotate-7 before:top-b2 before:rotate-6 before:origin-center';
                        _o.overbox
                            .modal
                            .area
                            .pointer
                            .classList
                            .add('sf-overbox-right');
                    }

                    break;
                default:

                    rP.y = (pE.bottom + 2 + 11);
                    rP.x = (pE.left - (pE.width / 2));

                    if(_o.param.pointer.active)
                    {
                        rP.pointer.x = (pE.width / 2);
                    }

                    break;
            }

            return rP;

        }

        return false;
    }

    _o.pointer = function()
    {
        let pointer = {};

        pointer = document.createElement('div');
        pointer.className = _o.param.pointer.modifier;
        pointer.classList.add('sf-overbox-pointer');

        return pointer;
    }

    _o.setPosition = function(_m)
    {
        let pE = _o.initPosition(_o.el, _o.param.width, _m.modal.offsetHeight);

        _m.modal.style.top = pE.y + 'px';
        _m.modal.style.left = pE.x + 'px';

        if(_o.param.pointer.active)
        {
            _m.modal.area.pointer.style.top = pE.pointer.y + 'px';
            _m.modal.area.pointer.style.left = pE.pointer.x + 'px';
        }

    }

    _o.el = _o.getElement(e);

    if(_o.el.hasAttribute('sf-overbox'))
    {
        _o.attrParamUpdate(_o.el, param);
    }

    SF.cloneDeep(_o.param, param);

    // Event Handler afterContentUpload
    _o.param.afterContentUpload = function(_m)
    {
        if(_o.param.pointer.active)
        {
            _m.modal.area.pointer = _o.pointer();
            _m.modal.area.append(_m.modal.area.pointer);
        }

        _o.setPosition(_m);
        window.addEventListener('scroll',function(){_o.setPosition(_m)});
        window.addEventListener('resize',function(){_o.setPosition(_m)});
    }

    // Event Handler beforeOpenWindow
    _o.param.beforeOpenWindow = function(_m)
    {
        _o.setPosition(_m);
    }

    _o.param.beforeCloseWindow = function(_m)
    {
        if(_m.modal.area.pointer && _o.param.pointer.active)
        {
            _m.modal.area.pointer.remove();
        }
    }

    // Readonly param
    Object.freeze(_o.param);
    _o.overbox = new SF.Modal(e, _o.param);

}

SF.Overbox = Overbox;

