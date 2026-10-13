var sft = window.SF;

window.SF = window.SF || function(){}

if(sft)
{
    Object.keys(sft).forEach((key) => {
        window.SF[key] = sft[key];
    });
}

exports = window.SF;

SF.AjaxLoad = function(el, opt)
{
    /**
     * @function send() - Отправляет событие
     * @param {*} event
     */
     this.send = function(event, element,params=false)
     {
        let e = new Event(event,{bubbles:true})

        if(params)
        {
            e.params = params;
        }

        element.dispatchEvent(e);
    }

    /**
     * @function receive() - регистрирует обработчик события
     * @param {*} event
     * @param {*} handler
     */
    this.receive = function(event, el, handler)
    {
        if(window.addEventListener)
            el.addEventListener(event, handler, false);
        else if(window.attachEvent)
            el.attachEvent(event, handler);
    }

    this.getAjax = function(el)
    {
        BX.ajax.post(
            this.param.src,
            '',
            function (data)
            {
                el.innerHTML = data;
                el.load.style.display = 'none';
            }
        );
    }

    /**
     * extend() -
     * @param {*} defaults
     * @param {*} options
     */
     this.extend = function(defaults, options)
     {
        for(var key in options)
        {
            if(Object.prototype.hasOwnProperty.call(options, key))
            {
                if(Object.prototype.toString.call(options[key]) == '[object Object]')
                {
                    this.extend(defaults[key], options[key]);
                }
                else
                {
                    defaults[key] = options[key];
                }
            }
        }

        return defaults;
    }

    /**
     * @function checklayer() -
     * @param {*} el
     */
    this.checklayer = function(el)
    {
        let comp = getComputedStyle(el);

        if(el.getAttribute(this.param.data.loaded) !== 'loaded'
            && comp.display !== 'none')
        {
            el.setAttribute(this.param.data.loaded, 'loaded');
            el.innerHTML = this.param.load;

            setTimeout(this.getAjax.bind(this,el), 1000);

        }
        else
        {
            el.setAttribute(this.param.data.loaded, '');
        }

        if(el.hasAttribute(this.param.data.cancel)
            && el.getAttribute(this.param.data.loaded) == 'loaded')
        {
            this.send(this.param.events.cancel, el);
        }
    }

    this.clearInterval = function(callback)
    {
        clearInterval(callback);
    }

    this.init = function(el)
    {
        return setInterval(this.checklayer.bind(this,el),1000);
    }

    /**
     * @var param - параметры
     */
    this.param = {
        load: '<div class="sf-progress"><div class="sf-progress-animation"></div></div>',
        events:
        {
            init: 'ajaxloadinit',
            cancel: 'ajaxloadcanceltrack',
            create: 'ajaxloadcreate',
        },
        data:
        {
            init: 'sf-ajaxload',
            src: 'sf-src',
            cancel: 'sf-canceltrack',
            loaded: 'sf-ajaxloaded',
        },
        attributes: {},
        modifier:
        {
            src: '',
        },
    }

    // === Init

    this.param = this.extend(this.param, opt);

    this.clearTimeout = setInterval(this.checklayer.bind(this,el),1000);

    this.receive(this.param.events.cancel,el,
            this.clearInterval.bind(this,this.clearTimeout));
}
