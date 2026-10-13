SF.Special = function(el, opt) {
    // #region Method
        this.updateparam = (param) =>
        {
            for(var key in param)
            {
                if(_this.cookies.get(key))
                {
                    param[key] = _this.cookies.get(key);
                }
            }

            return param;
        }
    // #endregion

    // ====== CONSTRUCTOR ====== //
        SF.Events.call(this);
        //SF.Property.call(this);

        this.el = el;
        var _this = this,
            par = new SF.Parameters(),
            param = par.newparams(),
            plugin = this.extend(param.blocks.special, opt);

        this.stack = SF.Controller.Stack;
        this.html = document.documentElement;
        var html = document.documentElement,
            body = document.body,
            service = document.querySelector('[data-name*="sf-service-top-area"]');

        if(this.el) {
            this.el.blocks = 'special';
            this.el.params = plugin;
        }

        plugin.cookies = this.updateparam(plugin.cookies);


        this.close = () => {
            this.send(this.el.params.events.soundoff, window);
            this.send(this.el.params.events.defaultsetting, this.el);
            this.html.classList.remove('special')
            this.el.special.remove();
            this.cookies.set('specialstate', 'off', 7);
        }

        if(this.stack.ev(plugin.events.close))
        {
            this.receive(this.el.params.events.close, window, this.close.bind(this));
            // this.receive(plugin.events.close, window, function(e) {
            //     var panel = e.target;
            //     panel.remove();
            //     _this.send(plugin.events.soundoff, window);
            //     html.classList.remove('special');
            //     _this.cookies.set('specialstate', 'off', 7);
            // });

            this.stack.events.push(plugin.events.close);
        }

        if(this.stack.ev(plugin.events.open))
        {
            this.receive(plugin.events.open, window, function(e) {

                _this.cookies.set('specialstate', 'on', 7);
                _this.updateparam(plugin.cookies);
                service.prepend(_this.el.special);
                html.classList.add('special');

                switch(plugin.cookies.specialfont)
                {
                    case 'sans':
                        _this.send(plugin.events.fontsans, e.target);
                        break;
                    case 'serif':
                        _this.send(plugin.events.fontserif, e.target);
                        break;
                    case 'mono':
                        _this.send(plugin.events.fontmono, e.target);
                        break;
                }

                switch(plugin.cookies.specialkerning)
                {
                    case 'normal':
                        _this.send(plugin.events.kerningnormal, e.target);
                        break;
                    case 'middle':
                        _this.send(plugin.events.kerningmiddle, e.target);
                        break;
                    case 'big':
                        _this.send(plugin.events.kerningbig, e.target);
                        break;
                    default:
                        _this.send(plugin.events.kerningnormal, e.target);
                        break;
                }

                switch(plugin.cookies.specialinterval)
                {
                    case '1':
                        _this.send(plugin.events.intervalone, e.target);
                        break;
                    case '1.5':
                        _this.send(plugin.events.intervalhalf, e.target);
                        break;
                    case '2.0':
                        _this.send(plugin.events.intervaltwo, e.target);
                        break;
                    default:
                        _this.send(plugin.events.intervalone, e.target);
                        break;
                }

                switch(plugin.cookies.specialcolor)
                {
                    case 'specialwhite':
                        _this.send(plugin.events.colorwhite, el.special.color.content.btnwhite);
                        break;
                    case 'specialblack':
                        _this.send(plugin.events.colorblack, el.special.color.content.btnblack);
                        break;
                    case 'specialyellow':
                        _this.send(plugin.events.coloryellow, el.special.color.content.btnyellow);
                        break;
                    case 'specialblue':
                        _this.send(plugin.events.colorblue, el.special.color.content.btnblue);
                        break;
                    case 'specialgreen':
                        _this.send(plugin.events.colorgreen, el.special.color.content.btngreen);
                        break;
                    default:
                        _this.send(plugin.events.colorwhite, el.special.color.content.btnwhite);
                        break;
                }

                html.style.fontSize = plugin.cookies.specialkegl + 'px';
                body.style.fontSize = plugin.cookies.specialkegl + 'px';

                switch(plugin.cookies.specialimage) {
                    case 'off':
                        _this.send(plugin.events.imageoff,e.target);
                        break;
                    case 'oncolor':
                        _this.send(plugin.events.imagecolor,e.target);
                        break;
                    case 'onblack':
                        _this.send(plugin.events.imageblack,e.target);
                        break;
                }

                var stateImage = _this.cookies.get('specialimage');

                if(stateImage == 'off')
                {
                    document.querySelectorAll('.sf-special-hidden').forEach((elem) => {
                        elem.classList.remove('sf-special-hidden');
                        elem.classList.add('sf-special-show')
                    });
                }
                else if(stateImage == 'onblack' || stateImage == 'oncolor') {
                    document.querySelectorAll('.sf-special-show').forEach((elem) => {
                        elem.classList.add('sf-special-hidden');
                        elem.classList.remove('sf-special-show');
                    });
                }

                var panel = document.body.querySelector('[sf-special-panel]');

                if(plugin.cookies.specialsound == 'on')
                {
                    _this.send(plugin.events.soundon, panel);
                }
            });

            this.stack.events.push(plugin.events.open);
        }

        // #region Font

        if(this.stack.ev(plugin.events.fontsans))
        {
            this.receive(plugin.events.fontsans, window, () =>
            {
                html.classList.add('special-font-sans');
                html.classList.remove('special-font-serif');
                html.classList.remove('special-font-mono');
                el.special.font.content.btnsans.style.setProperty('background-color','#d1d5da','important');
                el.special.font.content.btnserif.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnmono.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnsans.classList.add('sf-special-btn--noclick');
                el.special.font.content.btnserif.classList.remove('sf-special-btn--noclick');
                el.special.font.content.btnmono.classList.remove('sf-special-btn--noclick');
                _this.cookies.set('specialfont', 'sans', 7);
            });

            this.stack.events.push(plugin.events.fontsans);
        }

        if(this.stack.ev(plugin.events.fontserif))
        {
            this.receive(plugin.events.fontserif, window, () =>
            {
                html.classList.remove('special-font-sans');
                html.classList.add('special-font-serif');
                html.classList.remove('special-font-mono');
                el.special.font.content.btnsans.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnserif.style.setProperty('background-color','#d1d5da','important');
                el.special.font.content.btnmono.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnsans.classList.remove('sf-special-btn--noclick');
                el.special.font.content.btnserif.classList.add('sf-special-btn--noclick');
                el.special.font.content.btnmono.classList.remove('sf-special-btn--noclick');
                _this.cookies.set('specialfont', 'serif', 7);
            });
            this.stack.events.push(plugin.events.fontserif);
        }

        if(this.stack.ev(plugin.events.fontmono)) {
            this.receive(plugin.events.fontmono, window, function() {
                html.classList.remove('special-font-sans');
                html.classList.remove('special-font-serif');
                html.classList.add('special-font-mono');
                el.special.font.content.btnsans.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnserif.style.setProperty('background-color','#FFF','important');
                el.special.font.content.btnmono.style.setProperty('background-color','#d1d5da','important');
                el.special.font.content.btnsans.classList.remove('sf-special-btn--noclick');
                el.special.font.content.btnserif.classList.remove('sf-special-btn--noclick');
                el.special.font.content.btnmono.classList.add('sf-special-btn--noclick');
                _this.cookies.set('specialfont', 'mono', 7);
            });
            this.stack.events.push(plugin.events.fontmono);
        }

        // #endregion Font

        if(this.stack.ev(plugin.events.keglless)) {
            this.receive(plugin.events.keglless, window, function() {
                _this.updateparam(plugin.cookies);
                if(plugin.cookies.specialkegl < 24) {
                    var kegl = Number(plugin.cookies.specialkegl);
                    kegl++;
                    html.style.fontSize = kegl + 'px';
                    body.style.fontSize = kegl + 'px';
                    _this.cookies.set('specialkegl', kegl, 7);
                }
            });
            this.stack.events.push(plugin.events.keglless);
        }

        if(this.stack.ev(plugin.events.keglmore)) {
            this.receive(plugin.events.keglmore, window, function() {
                _this.updateparam(plugin.cookies);
                if(plugin.cookies.specialkegl > 14) {
                    var kegl = Number(plugin.cookies.specialkegl);
                    kegl--;
                    html.style.fontSize = kegl + 'px';
                    body.style.fontSize = kegl + 'px';
                    _this.cookies.set('specialkegl', kegl, 7);
                }
            });

            this.stack.events.push(plugin.events.keglmore);
        }

    // Kerning
        if(this.stack.ev(plugin.events.kerningnormal)) {
            this.receive(plugin.events.kerningnormal, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-kerning-middle');
                html.classList.remove('special-kerning-big');

                el.special.kerning.content.btnnormal.style.setProperty('background-color','#d1d5da','important');
                el.special.kerning.content.btnmiddle.style.setProperty('background-color','#FFF','important');
                el.special.kerning.content.btnbig.style.setProperty('background-color','#FFF','important');

                el.special.kerning.content.btnnormal.classList.add('sf-special-btn--noclick');
                el.special.kerning.content.btnmiddle.classList.remove('sf-special-btn--noclick');
                el.special.kerning.content.btnbig.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialkerning', 'normal', 7);
            });

            this.stack.events.push(plugin.events.kerningnormal);
        }
        //
        if(this.stack.ev(plugin.events.kerningmiddle)) {
            this.receive(plugin.events.kerningmiddle, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.add('special-kerning-middle');
                html.classList.remove('special-kerning-big');

                el.special.kerning.content.btnnormal.style.setProperty('background-color','#FFF','important');
                el.special.kerning.content.btnmiddle.style.setProperty('background-color','#d1d5da','important');
                el.special.kerning.content.btnbig.style.setProperty('background-color','#FFF','important');

                el.special.kerning.content.btnnormal.classList.remove('sf-special-btn--noclick');
                el.special.kerning.content.btnmiddle.classList.add('sf-special-btn--noclick');
                el.special.kerning.content.btnbig.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialkerning', 'middle', 7);
            });

            this.stack.events.push(plugin.events.kerningmiddle);
        }
        if(this.stack.ev(plugin.events.kerningbig)) {
            this.receive(plugin.events.kerningbig, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-kerning-middle');
                html.classList.add('special-kerning-big');

                el.special.kerning.content.btnnormal.style.setProperty('background-color','#FFF','important');
                el.special.kerning.content.btnmiddle.style.setProperty('background-color','#FFF','important');
                el.special.kerning.content.btnbig.style.setProperty('background-color','#d1d5da','important');

                el.special.kerning.content.btnnormal.classList.remove('sf-special-btn--noclick');
                el.special.kerning.content.btnmiddle.classList.remove('sf-special-btn--noclick');
                el.special.kerning.content.btnbig.classList.add('sf-special-btn--noclick');

                _this.cookies.set('specialkerning', 'big', 7);
            });

            this.stack.events.push(plugin.events.kerningbig);
        }
    //===========

    // Interval Увеличение интервала текста
        if(this.stack.ev(plugin.events.intervalone)) {
            this.receive(plugin.events.intervalone, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-interval-15');
                html.classList.remove('special-interval-20');

                el.special.interval.content.btnone.style.setProperty('background-color','#d1d5da','important');
                el.special.interval.content.btnhalf.style.setProperty('background-color','#FFF','important');
                el.special.interval.content.btntwo.style.setProperty('background-color','#FFF','important');

                el.special.interval.content.btnone.classList.add('sf-special-btn--noclick');
                el.special.interval.content.btnhalf.classList.remove('sf-special-btn--noclick');
                el.special.interval.content.btntwo.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialinterval', '1', 7);
            });

            this.stack.events.push(plugin.events.intervalone);
        }

        if(this.stack.ev(plugin.events.intervalhalf)) {
            this.receive(plugin.events.intervalhalf, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.add('special-interval-15');
                html.classList.remove('special-interval-20');

                el.special.interval.content.btnone.style.setProperty('background-color','#FFF','important');
                el.special.interval.content.btnhalf.style.setProperty('background-color','#d1d5da','important');
                el.special.interval.content.btntwo.style.setProperty('background-color','#FFF','important');

                el.special.interval.content.btnone.classList.remove('sf-special-btn--noclick');
                el.special.interval.content.btnhalf.classList.add('sf-special-btn--noclick');
                el.special.interval.content.btntwo.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialinterval', '1.5', 7);
            });

            this.stack.events.push(plugin.events.intervalhalf);
        }

        if(this.stack.ev(plugin.events.intervaltwo)) {
            this.receive(plugin.events.intervaltwo, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-interval-15');
                html.classList.add('special-interval-20');

                el.special.interval.content.btnone.style.setProperty('background-color','#FFF','important');
                el.special.interval.content.btnhalf.style.setProperty('background-color','#FFF','important');
                el.special.interval.content.btntwo.style.setProperty('background-color','#d1d5da','important');

                el.special.interval.content.btnone.classList.remove('sf-special-btn--noclick');
                el.special.interval.content.btnhalf.classList.remove('sf-special-btn--noclick');
                el.special.interval.content.btntwo.classList.add('sf-special-btn--noclick');

                _this.cookies.set('specialinterval', '2.0', 7);
            });

            this.stack.events.push(plugin.events.intervaltwo);
        }

    // =======================================================

        if(this.stack.ev(plugin.events.imagecolor)) {
            this.receive(plugin.events.imagecolor, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-img-none');
                html.classList.remove('special-img-black');

                el.special.img.content.btnoff.style.setProperty('background-color','#FFF','important');
                el.special.img.content.btnbw.style.setProperty('background-color','#FFF','important');
                el.special.img.content.btncolor.style.setProperty('background-color','#d1d5da','important');

                el.special.img.content.btnoff.classList.remove('sf-special-btn--noclick');
                el.special.img.content.btnbw.classList.remove('sf-special-btn--noclick');
                el.special.img.content.btncolor.classList.add('sf-special-btn--noclick');

                _this.cookies.set('specialimage', 'oncolor', 7);
            });

            this.stack.events.push(plugin.events.imagecolor);
        }

        if(this.stack.ev(plugin.events.imageblack)) {
            this.receive(plugin.events.imageblack, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.remove('special-img-none');
                html.classList.add('special-img-black');

                el.special.img.content.btnoff.style.setProperty('background-color','#FFF','important');
                el.special.img.content.btnbw.style.setProperty('background-color','#d1d5da','important');
                el.special.img.content.btncolor.style.setProperty('background-color','#FFF','important');

                el.special.img.content.btnoff.classList.remove('sf-special-btn--noclick');
                el.special.img.content.btnbw.classList.add('sf-special-btn--noclick');
                el.special.img.content.btncolor.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialimage', 'onblack', 7);
            });

            this.stack.events.push(plugin.events.imageblack);
        }

        if(this.stack.ev(plugin.events.imageoff)) {
            this.receive(plugin.events.imageoff, window, function() {
                _this.updateparam(plugin.cookies);
                html.classList.add('special-img-none');
                html.classList.remove('special-img-black');

                el.special.img.content.btnoff.style.setProperty('background-color','#d1d5da','important');
                el.special.img.content.btnbw.style.setProperty('background-color','#FFF','important');
                el.special.img.content.btncolor.style.setProperty('background-color','#FFF','important');

                el.special.img.content.btnoff.classList.add('sf-special-btn--noclick');
                el.special.img.content.btnbw.classList.remove('sf-special-btn--noclick');
                el.special.img.content.btncolor.classList.remove('sf-special-btn--noclick');

                _this.cookies.set('specialimage', 'off', 7);
            });

            this.stack.events.push(plugin.events.imageoff);
        }


    // ============================================

        this.buttonColorNotActive = (button) => {
            button.classList.remove('sf-special-btn--noclick');
            button.style.boxShadow = 'none';
            button.style.zIndex = 'auto';
        }

        this.buttonColorActive = (button) => {
            button.classList.add('sf-special-btn--noclick');
            button.style.boxShadow = '0 0px 0px 4px lightgrey';
            button.style.zIndex = 1;
        }

        if(this.stack.ev(plugin.events.colorwhite))
        {
            this.receive(plugin.events.colorwhite, window, () => {
                let button = el.special.color.content;

                _this.updateparam(plugin.cookies);
                // service.insertBefore(_this.el.special, service.firstChild);
                html.classList.add('special');
                body.classList.add('sf-special-white');
                body.classList.remove('sf-special-black','sf-special-yellow','sf-special-blue','sf-special-green');
                // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
                // _this.el.linkcss = _this.addcss(plugin.modifier.specialwhite);

                _this.buttonColorActive(button.btnwhite);
                _this.buttonColorNotActive(button.btnblack);
                _this.buttonColorNotActive(button.btnyellow);
                _this.buttonColorNotActive(button.btnblue);
                _this.buttonColorNotActive(button.btngreen);

                _this.cookies.set('specialcolor', 'specialwhite', 7);
            });

            this.stack.events.push(plugin.events.colorwhite);
        }

        if(this.stack.ev(plugin.events.colorblack))
        {
            this.receive(plugin.events.colorblack, window, () => {
                let button = el.special.color.content;
                //var service = document.body.querySelector('.sf-service-top-area');
                // service.insertBefore(_this.el.special, service.firstChild);
                html.classList.add('special')
                body.classList.add('sf-special-black');
                body.classList.remove('sf-special-white','sf-special-yellow','sf-special-blue','sf-special-green');
                // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
                // _this.el.linkcss = _this.addcss(plugin.modifier.specialblack);
                _this.buttonColorActive(button.btnblack);
                _this.buttonColorNotActive(button.btnwhite);
                _this.buttonColorNotActive(button.btnyellow);
                _this.buttonColorNotActive(button.btnblue);
                _this.buttonColorNotActive(button.btngreen);
                _this.cookies.set('specialcolor', 'specialblack', 7);
            });

            this.stack.events.push(plugin.events.colorblack);
        }

        if(this.stack.ev(plugin.events.coloryellow))
        {
            this.receive(plugin.events.coloryellow, window, () => {
                let button = el.special.color.content;
                //var service = document.body.querySelector('.sf-service-top-area');
                // service.insertBefore(_this.el.special, service.firstChild);
                html.classList.add('special');
                body.classList.add('sf-special-yellow');
                body.classList.remove('sf-special-white','sf-special-black','sf-special-blue','sf-special-green');
                // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
                // _this.el.linkcss = _this.addcss(plugin.modifier.specialyellow);
                _this.buttonColorActive(button.btnyellow);
                _this.buttonColorNotActive(button.btnwhite);
                _this.buttonColorNotActive(button.btnblack);
                _this.buttonColorNotActive(button.btnblue);
                _this.buttonColorNotActive(button.btngreen);
                _this.cookies.set('specialcolor', 'specialyellow', 7);
            });

            this.stack.events.push(plugin.events.coloryellow);
        }

        if(this.stack.ev(plugin.events.colorblue))
        {
            this.receive(plugin.events.colorblue, window, () => {
                let button = el.special.color.content;
                //var service = document.body.querySelector('.sf-service-top-area');
                // service.insertBefore(_this.el.special, service.firstChild);
                html.classList.add('special');
                body.classList.add('sf-special-blue');
                body.classList.remove('sf-special-white','sf-special-black','sf-special-yellow','sf-special-green');
                // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
                // _this.el.linkcss = _this.addcss(plugin.modifier.specialblue);
                _this.buttonColorActive(button.btnblue);
                _this.buttonColorNotActive(button.btnwhite);
                _this.buttonColorNotActive(button.btnblack);
                _this.buttonColorNotActive(button.btnyellow);
                _this.buttonColorNotActive(button.btngreen);
                _this.cookies.set('specialcolor', 'specialblue', 7);
            });
            this.stack.events.push(plugin.events.colorblue);
        }

        if(this.stack.ev(plugin.events.colorgreen))
        {
            this.receive(plugin.events.colorgreen, window, () => {
                let button = el.special.color.content;
                // service.insertBefore(_this.el.special, service.firstChild);
                html.classList.add('special');
                body.classList.add('sf-special-green');
                body.classList.remove('sf-special-white','sf-special-black','sf-special-yellow','sf-special-blue');
                // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
                // _this.el.linkcss = _this.addcss(plugin.modifier.specialgreen);
                _this.buttonColorActive(button.btngreen);
                _this.buttonColorNotActive(button.btnwhite);
                _this.buttonColorNotActive(button.btnblack);
                _this.buttonColorNotActive(button.btnyellow);
                _this.buttonColorNotActive(button.btnblue);
                _this.cookies.set('specialcolor', 'specialgreen', 7);
            });

            this.stack.events.push(plugin.events.colorgreen);
        }


        if(this.stack.ev(plugin.events.soundoff))
        {
            this.receive(plugin.events.soundoff, window, () => {
                var btnplay = document.body.querySelectorAll('[sf-play]');

                for(var k = 0; k < btnplay.length; k++)
                {
                    btnplay[k].parentNode.removeChild(btnplay[k]);
                }

                _this.cookies.set('specialsound', 'off', 7);
            });

            this.stack.events.push(plugin.events.soundoff);
        }

        // end Sound


        this.defaultSetting = () => {
            let defaultParams = new SF.Parameters().newparams().blocks.special;
            let panel = this.el.special;

            html.classList.remove('special-font-sans', 'special-font-serif', 'special-font-mono');
            this.cookies.set('specialfont', defaultParams.cookies.specialfont, 7);
            panel.font.status.innerText = BX.message("SF_SPECIAL__FONT_DEFAULT");

            html.style.fontSize = `${defaultParams.cookies.specialkegl}px`;
            body.style.fontSize = `${defaultParams.cookies.specialkegl}px`;
            panel.kegl.status.innerText = `${defaultParams.cookies.specialkegl}${BX.message("SF_SPECIAL__SPECIAL_KEGL")}`;
            this.cookies.set('specialkegl', defaultParams.cookies.specialkegl, 7);

            html.classList.remove('special-kerning-middle', 'special-kerning-big');
            this.cookies.set('specialkerning', defaultParams.cookies.specialkerning, 7);
            this.send(defaultParams.events.kerningnormal, this.el.special.kerning.content.btnnormal);
            panel.kerning.status.innerText = BX.message("SF_SPECIAL__KERNING_NORMAL");

            html.classList.remove('special-interval-15', 'special-interval-20');
            this.cookies.set('specialinterval', '1', 7);
            this.send(defaultParams.events.intervalone, this.el.special.interval.content.btnone);
            panel.interval.status.innerText = BX.message("SF_SPECIAL__INTERVAL_1_0");

            console.log('defaultSettings');
            body.classList.remove('sf-special-white', 'sf-special-black', 'sf-special-yellow', 'sf-special-blue', 'sf-special-green');
            this.cookies.set('specialcolor', defaultParams.cookies.specialcolor);
            this.send(defaultParams.events.colorwhite, this.el.special.color.content.btnwhite);
            panel.color.status.innerText = BX.message("SF_SPECIAL__BTN_WHITE");

            panel.img.status.innerText = BX.message("SF_SPECIAL__IMG_ON_COLOR");
            html.classList.remove('special-img-none','special-img-black');
            this.cookies.set('specialimage', 'on', 7);
            this.send(defaultParams.events.imagecolor, this.el.special.img.content.btncolor);
        }

        if(this.stack.ev(plugin.events.defaultsetting))
        {
            this.receive(plugin.events.defaultsetting, window, this.defaultSetting.bind(this));
            // this.receive(plugin.events.defaultsetting, window, function(e) {
            //     var o  = new SF.Parameters().newparams(),
            //         p = o.blocks.special,
            //         panel = e.target;

            //     html.classList.remove('special-font-sans', 'special-font-serif', 'special-font-mono');
            //     _this.cookies.set('specialfont', p.cookies.specialfont, 7);
            //     panel.font.status.innerText = BX.message("SF_SPECIAL__FONT_DEFAULT");

            //     html.style.fontSize = p.cookies.specialkegl + 'px';
            //     panel.kegl.status.innerText = p.cookies.specialkegl + BX.message("SF_SPECIAL__SPECIAL_KEGL");
            //     _this.cookies.set('specialkegl', p.cookies.specialkegl, 7);

            //     html.classList.remove('special-kerning-middle', 'special-kerning-big');
            //     _this.cookies.set('specialkerning', p.cookies.specialkerning, 7);
            //     _this.send(plugin.events.kerningnormal, el.special.kerning.content.btnnormal);
            //     panel.kerning.status.innerText = BX.message("SF_SPECIAL__KERNING_NORMAL");

            //     html.classList.remove('special-interval-15', 'special-interval-20');
            //     _this.cookies.set('specialinterval', '1', 7);
            //     _this.send(plugin.events.intervalone, el.special.interval.content.btnone);
            //     panel.interval.status.innerText = BX.message("SF_SPECIAL__INTERVAL_1_0");

            //     body.classList.remove('sf-special-white', 'sf-special-black', 'sf-special-yellow', 'sf-special-blue', 'sf-special-green');
            //     _this.cookies.set('specialcolor', p.cookies.specialcolor);
            //     _this.send(plugin.events.colorwhite, el.special.color.content.btnwhite);
            //     panel.color.status.innerText = BX.message("SF_SPECIAL__BTN_WHITE");

            //     panel.img.status.innerText = BX.message("SF_SPECIAL__IMG_ON_COLOR");
            //     html.classList.remove('special-img-none','special-img-black');
            //     // html.classList.remove();
            //     _this.cookies.set('specialimage', 'on', 7);
            //     _this.send(plugin.events.imagecolor, el.special.img.content.btncolor);
            // });

            this.stack.events.push(plugin.events.defaultsetting);
        }

        if(this.stack.ev(plugin.events.up)) {
            this.receive(plugin.events.up, window, function(e) {
                var panel = e.target;
                if(_this.cookies.get('specialup') == 'down') {
                    panel.style.marginTop = '-' + panel.clientHeight + 'px';
                    panel.onoff.content.btnup.style.bottom = '-' + panel.onoff.content.btnup.clientHeight + 'px';
                    panel.onoff.content.btnup.style.transform = 'rotate(180deg)';
                    _this.cookies.set('specialup', 'up', 7);
                } else {
                    panel.style.marginTop = '0';
                    panel.onoff.content.btnup.style.bottom = '0';
                    panel.onoff.content.btnup.style.transform = 'rotate(0deg)';
                    _this.cookies.set('specialup', 'down', 7);
                }
            });
            this.stack.events.push(plugin.events.up);
        }


        this.actionButtonClick = (e) => {
            e.preventDefault();

            switch(this.cookies.get('specialstate'))
            {
                case 'off':
                    this.send(this.el.params.events.open, this.el);
                    break;
                case 'on':
                    this.send(this.el.params.events.close, this.el);
                    break;
                default:
                    this.send(this.el.params.events.open, this.el);
                    break;
            }
        }


    // ============================================

        if(plugin.cookies.specialstate == 'off')
        {
            this.el.addEventListener('click', this.actionButtonClick.bind(this));
            // _this.el.addEventListener('click', function(e) {
            //     e.preventDefault();

            //     switch(_this.cookies.get('specialstate'))
            //     {
            //         case 'off':
            //             _this.send(_this.el.params.events.open, _this.el);
            //             break;
            //         case 'on':
            //             // plugin.events.defaultsetting
            //             _this.send(_this.el.params.event.defaultsetting, _this.el);
            //             _this.el.special.remove();
            //             // panel.parentNode.removeChild(panel);
            //             // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
            //             _this.cookies.set('specialstate', 'off', 7);
            //             break;
            //         default:
            //             _this.send(_this.el.params.events.open, _this.el);
            //             break;
            //     }
            // });
        }
        else
        {
            this.updateparam(plugin.cookies);
            this.send(plugin.events.open, this.el);
            this.el.addEventListener('click', this.actionButtonClick.bind(this));

            // _this.el.addEventListener('click', function(e)
            // {
            //     switch(_this.cookies.get('specialstate'))
            //     {
            //         case 'off':
            //             _this.send(_this.el.params.events.open, _this.el);
            //             break;
            //         case 'on':
            //             _this.send(_this.el.params.event.defaultsetting, _this.el);
            //             _this.el.special.remove();
            //             // var panel = document.body.querySelector('[sf-special-panel]').remove();
            //             // panel.parentNode.removeChild(panel);
            //             // _this.el.linkcss.parentNode.removeChild(_this.el.linkcss);
            //             _this.cookies.set('specialstate', 'off', 7);
            //             break;
            //         default:
            //             _this.send(_this.el.params.events.open, _this.el);
            //             break;
            //     }
            // });
        }
    // ====== END CONSTRUCTOR ====== //
}
