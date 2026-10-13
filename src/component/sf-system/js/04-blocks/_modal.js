SF.Modal = function(el, opt) {

    this.createNew = function(e) {
        var par = new SF.Parameters(),
            modPar = par.newparams();
        window.blocks = 'modal';
        window.params = this.extend(modPar.blocks.modal, window.params);
        e.target.blocks = 'modal';
        e.target.params = this.extend(modPar.blocks.modal, window.params);
        e.target.modal = _this.modal(e);
        window.modal = _this.modal(e);
        _this.create(e);
    }

    this.create = function(e) {
        //console.log(e.target)
        var modal = e.target.modal,
            el = e.target,
            container = null,
            opt = el.params;

            try {
                if(el.hasAttribute(opt.data.iframe))
                modal = this.iframe(e);
            } catch(ex) {
                console.warn(ex);
            }


        //console.log(modal)

        var service = document.body.querySelector('.sf-service-bottom-area');

        if(service == null || service == undefined) {
            service = document.createElement('div');
            service.classList.add(el.params.modifier.service);
            document.body.appendChild(service);
        } else container = service.querySelector('.sf-modal-container');

        if(container == null || container == undefined) {
            container = document.createElement('section');
            container.setAttribute('modal-container', '');
            container.className = opt.modifier.container;
        }
        //console.log(container)
        try {
            container.appendChild(modal);
        } catch(ex) {
            console.warn(ex);
            container.innerHTML = modal;
        }

        service.appendChild(container);

        setTimeout(function() {
            if(modal.hasAttribute(el.params.data.src)) {
                var link = modal.getAttribute(el.params.data.src).replace(" ", '');

                function simbol(ch) {
                    var str = 'abcdefghijklmnopqrstuvwxyz',
                        i = 0;
                    for(var k = 0; k < str.length; k++)
                        if(str[k] == ch) i++;
                    if(i > 0) return true;
                    else return false;
                }
                if(link != null && link != '') {
                    if(link[0] == '.' && simbol(link[1])) {

                        modal.area.content.appendChild(document.body.querySelector(link).cloneNode(true));
                        _this.searchdata(modal.area.content);
                        modal.load.style.display = 'none';
                        modal.area.style.opacity = '1';
                        _this.send(el.params.events.open, modal);

                    } else if(link[0] == '#') {
                        modal.area.content.appendChild(document.body.querySelector(link).cloneNode(true));
                        _this.searchdata(modal.area.content);
                        modal.load.style.display = 'none';
                        modal.area.style.opacity = '1';
                        _this.send(el.params.events.open, modal);
                    } else if(link[0] == '[') {
                        modal.area.content.appendChild(document.body.querySelector(link).cloneNode(true));
                        _this.searchdata(modal.area.content);
                        modal.load.style.display = 'none';
                        modal.area.style.opacity = '1';
                        _this.send(el.params.events.open, modal);
                    } else {

                        BX.ajax.post(
                            modal.getAttribute(el.params.data.src),
                            '',
                            function (data) {
                                try {
                                    if(el.hasAttribute(opt.data.iframe)) {
                                        //modal.area.content.contentWindow.document.body.innerHTML = data;
                                    } else modal.area.content.innerHTML = data;
                                } catch(ex) {
                                    console.warn(ex);
                                    modal.area.content.innerHTML = data;
                                }

                                _this.searchdata(modal.area.content);
                                modal.load.style.display = 'none';
                                modal.area.style.opacity = '1';
                                _this.send(el.params.events.open, modal);
                            }
                        );
                    }
                } else {
                    modal.area.content.innerHTML = '<div class="w-100 h-100"><h6 class="c-red">Error</h6></div>';
                    _this.searchdata(modal.area.content);
                    modal.load.style.display = 'none';
                    modal.area.style.opacity = '1';
                    _this.send(el.params.events.open, modal);
                }
            }

        }, 1000);
    }

    // ====== CONSTRUCTOR ====== //

        SF.Events.call(this)

        this.el = el;
    // eslint-disable-next-line no-undef
        this.stack = stack;
        var _this = this,
            par = new SF.Parameters(),
            param = par.newparams(),
            plugin = this.extend(param.blocks.modal, opt);

        if(this.el) {
            this.el.blocks = 'modal';
            this.el.params = plugin;
        }

        this.receive(plugin.events.init, window, function(e) {
            var ev = e;
            ev.target.addEventListener('click', function(e) {
                e.preventDefault();
                _this.create(ev);
            });
        });

        this.receive(plugin.events.create, window, function(e) {
            _this.createNew(e);
        });

        // Закрываем окно клавишей Escpe
        this.quickkey(function() {
            var overlay = _this.topZIndexElement(document.body.querySelectorAll('.sf-modal-overlay'));
            _this.send('modalclose', overlay);
        }, 27);

        /*window.addEventListener('click', function(e) {
            if(e.target.hasAttribute('sf-modal')) {
                if(e.target.params == undefined || e.target.params == null)
                    _this.send(plugin.events.create, e.target);
            }
        })*/

        SF.Controller.call(this);

    // ====== END CONSTRUCTOR ====== //

}
