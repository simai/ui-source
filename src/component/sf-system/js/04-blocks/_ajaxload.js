SF.AjaxLoad = function(el, opt) {

    SF.Events.call(this);

    this.el = el;

    var _this = this,
        par = new SF.Parameters(),
        param = par.newparams(),
        plugin = this.extend(param.blocks.ajaxload, opt);

    // eslint-disable-next-line no-undef
    this.stack = stack;

    if(this.el)
    {
        this.el.blocks = 'ajaxload';
        this.el.params = plugin;
    }

    this.receive(
        plugin.events.init,
        window,
        function(e)
        {
            var el = e.target,
                interval = setInterval(_this.checklayer, 1000, el);

            _this.receive(plugin.events.cancel, el, function() {
                clearInterval(interval);
            })
        }
    )

    this.receive(
        plugin.events.create, window,
        // eslint-disable-next-line no-undef
        _this.send.bind(_this,'ajaxloadinit',e.target)
    )

    this.checklayer = function(el)
    {
        var comp = getComputedStyle(el);

        if(el.getAttribute(plugin.data.loaded) !== 'loaded' && comp.display !== 'none')
        {

            el.setAttribute(plugin.data.loaded, 'loaded');
            el.innerHTML = plugin.load;

            setTimeout(function(){
                BX.ajax.post(
                    el.getAttribute(plugin.data.src),
                    '',
                    function (data) {
                        el.innerHTML = data;
                        el.load.style.display = 'none';
                    }
                );
            }, 1000);

        }
        else
        {
            el.setAttribute(plugin.data.loaded, '');
        }

        if(el.hasAttribute(plugin.data.cancel) && el.getAttribute(plugin.data.loaded) == 'loaded')
        {
            _this.send(plugin.events.cancel, el);
        }
    }
}
