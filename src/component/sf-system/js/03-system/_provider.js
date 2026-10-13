/**
 * ProviderDom - модуль создания блоков, другими словами поставщик блоков/компонентов
 */
SF.Provider = function() {

    this.special = function(e) {

        function selectcolor() {
            switch(_this.cookies.get('specialcolor')) {
                case 'specialwhite':
                    return BX.message("SF_SPECIAL__SPECIAL_WHITE");
                case 'specialblack':
                    return BX.message("SF_SPECIAL__SPECIAL_BLACK");
                case 'specialyellow':
                    return BX.message("SF_SPECIAL__SPECIAL_YELLOW");
                case 'specialblue':
                    return BX.message("SF_SPECIAL__SPECIAL_BLUE");
                case 'specialgreen':
                    return BX.message("SF_SPECIAL__SPECIAL_GREEN");
            }
            return BX.message("SF_SPECIAL__SPECIAL_WHITE");
        }

        function selectkegl() {
            var v = _this.cookies.get('specialkegl');
            if(v != '') return v + BX.message("SF_SPECIAL__SPECIAL_KEGL");
            else return BX.message("SF_SPECIAL__KEGL_16");
        }

        this.selectkerning = () =>
        {
            switch(this.cookies.get('specialkerning'))
            {
                case 'normal':
                    return BX.message("SF_SPECIAL__KERNING_NORMAL");
                case 'middle':
                    return BX.message("SF_SPECIAL__KERNING_MIDDLE");
                case 'big':
                    return BX.message("SF_SPECIAL__KERNING_BIG");
            }

            return BX.message("SF_SPECIAL__KERNING_NORMAL");
        }

        function selectimg() {
            switch(_this.cookies.get('specialimage')) {
                case 'off':
                    return BX.message("SF_SPECIAL__IMG_OFF");
                case 'onblack':
                    return BX.message("SF_SPECIAL__IMG_ON_BLACK");
                case 'oncolor':
                    return BX.message("SF_SPECIAL__IMG_ON_COLOR");
            }
            return BX.message("SF_SPECIAL__IMG_ON_COLOR");
        }

        this.changeStateAlt = (state) =>
        {
            if(state == 'off')
            {
                document.querySelectorAll('.sf-special-hidden').forEach((elem) => {
                    elem.classList.remove('sf-special-hidden');
                    elem.classList.add('sf-special-show');
                });
            }
            else if(state == 'onblack' || state == 'oncolor')
            {
                document.querySelectorAll('.sf-special-show').forEach((elem) => {
                    elem.classList.add('sf-special-hidden');
                    elem.classList.remove('sf-special-show');
                });
            }
        }

        function selectinterval()
        {
            switch(_this.cookies.get('specialinterval'))
            {
                case '1':
                    return BX.message("SF_SPECIAL__INTERVAL_1_0");
                case '1.5':
                    return BX.message("SF_SPECIAL__INTERVAL_1_5");
                case '2.0':
                    return BX.message("SF_SPECIAL__INTERVAL_2_0");
            }

            return BX.message("SF_SPECIAL__INTERVAL_1_0");
        }

        this.buttonColorStyle = (button, param) =>
        {
            button.className = param.class;
            button.style.setProperty('background-color', (param.backgroundColor ? param.backgroundColor : '#FFF'),'important');
            button.style.setProperty('border-color', (param.borderColor ? param.borderColor : '#d1d5da'), 'important');
            button.style.setProperty('color', (param.color ? param.color : '#000'), 'important');
            button.style.setProperty('line-height', 1, 'important');
            button.style.setProperty('letter-spacing', 'normal', 'important');
            button.style.fontSize = param.fontSize ? param.fontSize : '.875em';
            button.style.padding = '0.75em 1em';
            button.style.borderTopRightRadius = param.borderTopRightRadius ? param.borderTopRightRadius : 0;
            button.style.borderBottomRightRadius = param.borderBottomRightRadius ? param.borderBottomRightRadius : 0;
            button.style.borderTopLeftRadius = param.borderTopLeftRadius ? param.borderTopLeftRadius : 0;
            button.style.borderBottomLeftRadius = param.borderBottomLeftRadius ? param.borderBottomLeftRadius : 0;
            button.innerText = param.text;
            button.title = param.title;

            button.addEventListener('mouseover', () =>
            {
                if(!button.classList.contains('sf-special-btn--noclick'))
                {
                    button.style.boxShadow = `0 0px 0px 4px ${param.boxShadowColor ? param.boxShadowColor : 'lightgrey'}`;
                    button.style.zIndex = 1;
                    button.style.borderWidth = 0;
                }
            });

            button.addEventListener('mouseout', () =>
            {
                if(!button.classList.contains('sf-special-btn--noclick'))
                {
                    button.style.boxShadow = 'none';
                    button.style.zIndex = 'auto';
                }
            });

            button.addEventListener('focus', () => {
                button.style.outline = 'none';
            });
        }

        this.addbtn = (btn, param) => {
            btn.className = param.class;
            btn.style.setProperty('background-color', (param.backgroundColor ? param.backgroundColor : '#FFF'), 'important');
            btn.style.setProperty('border-color', (param.borderColor ? param.borderColor : '#d1d5da'), 'important');
            btn.style.setProperty('line-height', 1, 'important');
            btn.style.setProperty('letter-spacing', 'normal', 'important');

            btn.addEventListener('mouseover', () => {
                if(!btn.classList.contains('sf-special-btn--noclick'))
                {
                    btn.style.setProperty('background-color', (param.backgroundColorHover ? param.backgroundColorHover : '#d1d5da'), 'important');
                }
            });

            btn.addEventListener('mouseout', () => {
                if(!btn.classList.contains('sf-special-btn--noclick'))
                {
                    btn.style.setProperty('background-color', (param.backgroundColor ? param.backgroundColor : '#FFF'), 'important');
                }
            });

            btn.addEventListener('focus', () => {
                btn.style.outline = 'none';
            });

            btn.style.setProperty('color', (param.color ? param.color : '#000'), 'important');
            btn.style.fontSize = param.fontSize ? param.fontSize : '.875em';
            btn.style.padding = '.75em 1em';
            btn.innerHTML = param.text;
            btn.title = param.title;
        }

        function selectfont() {
            //console.log(_this.cookies.get('specialfont'));
            switch(_this.cookies.get('specialfont')) {
                case 'default':
                    return BX.message("SF_SPECIAL__FONT_DEFAULT");
                case 'sans':
                    return BX.message("SF_SPECIAL__FONT_SANS");
                case 'serif':
                    return BX.message("SF_SPECIAL__FONT_SERIF");
                case 'mono':
                    return BX.message("SF_SPECIAL__FONT_MONO");
            }
            return BX.message("SF_SPECIAL__FONT_DEFAULT");
        }


        this.setLocalStatusStyle = (panel=false, className = false, status = () => {}) => {
            panel.status.className = className;
            panel.status.style.setProperty('margin-top', '0.75em', 'important');
            panel.status.style.setProperty('letter-spacing', 'normal', 'important');
            panel.status.style.setProperty('line-height', 1, 'important');
            panel.status.style.fontSize = '.875em';
            panel.status.style.setProperty('color', '#000', 'important');
            panel.status.innerText = status();
        }

        this.setLocalNameStyle = (panel = false, className = false, name = false) => {
            panel.name.className = className;
            panel.name.style.fontSize = '.875em';
            panel.name.style.setProperty('margin-bottom', '.75em','important');
            panel.name.style.setProperty('color','#000','important');
            panel.name.style.setProperty('letter-spacing', 'normal', 'important');
            panel.name.style.setProperty('line-height', 1, 'important');
            panel.name.innerText = name;
        }

        var _this = this,
            par = e.target.params;

        var panel = {
            font: {
                name: {},
                content: {
                    btnsans: {},    // Arial
                    btnserif: {},   // Times New Roman
                    btnmono: {},    // Courier New
                },
                status: {},
            },
            kegl: {
                name: {},
                content: {
                    btnmore: {},
                    btnless: {},
                },
                status: {},
            },
            interval: {
                name: {},
                content: {
                    btnone: {},
                    btnhalf: {},
                    btntwo: {},
                },
                status: {},
            },
            kerning: {
                name: {},
                content: {
                    btnnormal: {},
                    btnmiddle: {},
                    btnbig: {},
                },
                status: {},
            },
            color: {
                name: {},
                content: {
                    btnwhite: {},
                    btnblack: {},
                    btnyellow: {},
                    btnblue: {},
                    btngreen: {},
                },
                status: {},
            },
            img: {
                name: {},
                content: {
                    btnoff: {},
                    btnbw: {},
                    btncolor: {},
                },
                status: {},
            },
            sound: {
                name: {},
                content: {
                    btnon:{},
                    btnoff: {},
                },
                status: {},
                play: {},
            },
            onoff: {
                name: {},
                content: {
                    btnup: {},
                    btndefault: {},
                    btnonoff: {},
                },
                status: {},
            },
        };

        panel = document.createElement('nav');

        panel.className = par.modifier.panel;
        panel.style.setProperty('border-bottom', '1px solid #D1D5DA','important');
        panel.style.setProperty('font-size', '16px', 'important');
        panel.setAttribute('sf-special-panel', '');
        panel.classList.add('relative');
        panel.style.setProperty('background-color', '#fff', 'important');
        panel.style.transition = 'margin-top 1s ease';

        panel.font = document.createElement('div');
        panel.font.className = par.modifier.font;
        panel.font.style.setProperty('padding','1em','important');

        panel.font.name = document.createElement('div');
        panel.font.content = document.createElement('div');
        panel.font.status = document.createElement('div');

        this.setLocalNameStyle(panel.font, 'font-text', BX.message("SF_SPECIAL__FONT"));

        // panel.font.name.classList.add('font-text');
        // panel.font.name.style.fontSize = '.875em';
        // panel.font.name.style.setProperty('margin-bottom', '.75em','important');
        // panel.font.name.style.setProperty('color','#000','important');
        // panel.font.name.style.setProperty('letter-spacing', 1, 'important');
        // panel.font.name.style.setProperty('line-height', 1, 'important');
        // panel.font.name.innerHTML = BX.message("SF_SPECIAL__FONT");

        panel.font.appendChild(panel.font.name);

        panel.font.content.style.setProperty('border-color', '#d1d5da', 'important');
        panel.font.content.classList.add('font-content','flex','border-1','radius-3','overflow-hidden');
        panel.font.content.btnsans = document.createElement('button');
        panel.font.content.btnserif = document.createElement('button');
        panel.font.content.btnmono = document.createElement('button');

        this.addbtn(
            panel.font.content.btnsans,
            {
                class: 'cursor-pointer line-none border-inline-end-1 focus:outline-0 appearance-none',
                text: 'Arial',
                title: BX.message("SF_SPECIAL__BTN_SANS_ARIAL"),
            }
        );

        panel.font.content.btnsans.addEventListener('click', function() {
            _this.send(par.events.fontsans, panel.font.content.btnsans);
            panel.font.status.innerText = BX.message("SF_SPECIAL__BTN_SANS");
        });

        this.addbtn(
            panel.font.content.btnserif,
            {
                class: 'cursor-pointer line-none border-inline-end-1 focus:outline-0 appearance-none',
                text: 'Times',
                title: BX.message("SF_SPECIAL__BTN_SERIF_TIMES"),
            }
        );

        panel.font.content.btnserif.addEventListener('click', function() {
            _this.send(par.events.fontserif, panel.font.content.btnserif);
            panel.font.status.innerHTML = BX.message("SF_SPECIAL__BTN_SERIF");
        });

        this.addbtn(
            panel.font.content.btnmono,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                text: 'Courier',
                title: BX.message("SF_SPECIAL__BTN_MONO_COURIER"),
            }
        );

        panel.font.content.btnmono.addEventListener('click', function() {
            _this.send(par.events.fontmono, panel.font.content.btnmono);
            panel.font.status.innerHTML = BX.message("SF_SPECIAL__BTN_MONO");
        });


        this.setLocalStatusStyle(panel.font, 'status-text', selectfont);

        // panel.font.status.classList.add('status-text');
        // panel.font.status.style.fontSize = '.875em';
        // panel.font.status.style.setProperty('margin-top', '12px', 'important');
        // panel.font.status.style.setProperty('color','#000','important');
        // panel.font.status.style.setProperty('letter-spacing', 1, 'important');
        // panel.font.status.style.setProperty('line-height', 1, 'important');
        // panel.font.status.innerHTML = selectfont();

        panel.font.content.appendChild(panel.font.content.btnsans);
        panel.font.content.appendChild(panel.font.content.btnserif);
        panel.font.content.appendChild(panel.font.content.btnmono);

        panel.font.appendChild(panel.font.content);
        panel.font.appendChild(panel.font.status);
        panel.appendChild(panel.font);

        // #endregion Font

        // === Kegl ====== //

        panel.kegl = document.createElement('div');
        panel.kegl.className = par.modifier.kegl;
        panel.kegl.style.setProperty('padding', '1em', 'important');

        panel.kegl.name = document.createElement('div');
        panel.kegl.content = document.createElement('div');
        panel.kegl.status = document.createElement('div');

        panel.kegl.content.style.setProperty('border-color', '#d1d5da', 'important');

        this.setLocalNameStyle(panel.kegl, 'kegl-text', BX.message("SF_SPECIAL__KEGL"));

        // panel.kegl.name.classList.add('kegl-text');
        // panel.kegl.name.style.setProperty('margin-bottom', '0.75em', 'important');
        // panel.kegl.name.style.fontSize = '.875em';
        // panel.kegl.name.style.setProperty('color','#000','important');
        // panel.kegl.name.style.setProperty('letter-spacing', 1, 'important');
        // panel.kegl.name.style.setProperty('line-height', 1, 'important');
        // panel.kegl.name.innerText = BX.message("SF_SPECIAL__KEGL");

        panel.kegl.appendChild(panel.kegl.name);

        panel.kegl.content.classList.add('kegl-content','flex','border-1','radius-3','overflow-hidden');

        panel.kegl.content.btnmore = document.createElement('button');
        panel.kegl.content.btnless = document.createElement('button');

        this.addbtn(
            panel.kegl.content.btnmore,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                text: 'A-',
                title: BX.message("SF_SPECIAL__BTN_MORE"),
            }
        );

        panel.kegl.content.btnmore.addEventListener('click', function() {
            _this.send(par.events.keglmore, panel.kegl.content.btnmore);
            panel.kegl.status.innerText = selectkegl();
        });

        this.addbtn(
            panel.kegl.content.btnless,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                text: 'A+',
                title: BX.message("SF_SPECIAL__BTN_LESS"),
            }
        );

        panel.kegl.content.btnless.addEventListener('click', function() {
            _this.send(par.events.keglless, panel.kegl.content.btnless);
            panel.kegl.status.innerText = selectkegl();
        });

        // panel.kegl.status.classList.add('status-text');
        // panel.kegl.status.style.setProperty('margin-top', '0.75em', 'important');
        // panel.kegl.status.style.setProperty('letter-spacing', 1, 'important');
        // panel.kegl.status.style.setProperty('line-height', 1, 'important');
        // panel.kegl.status.style.fontSize = '.875em';
        // panel.kegl.status.style.setProperty('color', '#000', 'important');
        // panel.kegl.status.innerText = selectkegl();

        this.setLocalStatusStyle(panel.kegl,'status-name',selectkegl);


        panel.kegl.content.appendChild(panel.kegl.content.btnmore);
        panel.kegl.content.appendChild(panel.kegl.content.btnless)
        panel.kegl.appendChild(panel.kegl.content);
        panel.kegl.appendChild(panel.kegl.status);
        panel.appendChild(panel.kegl);

        // === Kerning ======

            panel.kerning = document.createElement('div');
            panel.kerning.className = par.modifier.kerning;
            panel.kerning.style.setProperty('padding', '1em', 'important');
            panel.kerning.name = document.createElement('div');
            panel.kerning.content = document.createElement('div');
            panel.kerning.status = document.createElement('div');


            this.setLocalNameStyle(panel.kerning, 'name-text', BX.message("SF_SPECIAL__KERNING"));

            // panel.kerning.name.classList.add('name-text');
            // panel.kerning.name.style.setProperty('margin-bottom', '0.75em', 'important');
            // panel.kerning.name.style.setProperty('letter-spacing', 1, 'important');
            // panel.kerning.name.style.setProperty('line-height', 1, 'important');
            // panel.kerning.name.style.fontSize = '.875em';
            // panel.kerning.name.style.setProperty('color','#000','important');
            // panel.kerning.name.innerHTML = BX.message("SF_SPECIAL__KERNING");

            panel.kerning.appendChild(panel.kerning.name);

            panel.kerning.content.style.setProperty('border-color', '#d1d5da', 'important');
            panel.kerning.content.classList.add('kerning-content','flex','border-1','radius-3','overflow-hidden');


            this.setLocalStatusStyle(panel.kerning, 'status-text', this.selectkerning);

            // panel.kerning.status.classList.add('status-text');
            // panel.kerning.status.style.setProperty('margin-top', '0.75em', 'important');
            // panel.kerning.status.style.setProperty('letter-spacing', 1, 'important');
            // panel.kerning.status.style.setProperty('line-height', 1, 'important');
            // panel.kerning.status.style.fontSize = '.875em';
            // panel.kerning.status.style.setProperty('color','#000','important');
            // panel.kerning.status.innerHTML = this.selectkerning();

            panel.kerning.content.btnnormal = document.createElement('button');
            panel.kerning.content.btnmiddle = document.createElement('button');
            panel.kerning.content.btnbig = document.createElement('button');

            this.addbtn(
                panel.kerning.content.btnnormal,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none border-inline-end-1',
                    text: '1.0',
                    title: BX.message("SF_SPECIAL__BTN_NORMAL")
                }
            );

            panel.kerning.content.btnnormal.addEventListener('click', function() {
                _this.send(par.events.kerningnormal, panel.kerning.content.btnnormal);
                panel.kerning.status.innerHTML = _this.selectkerning();
            });

            this.addbtn(
                panel.kerning.content.btnmiddle,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none border-inline-end-1',
                    text: '1.5',
                    title: BX.message("SF_SPECIAL__BTN_MIDDLE"),
                }
            );

            panel.kerning.content.btnmiddle.addEventListener('click', function() {
                _this.send(par.events.kerningmiddle, panel.kerning.content.btnmiddle);
                panel.kerning.status.innerHTML = _this.selectkerning();
            });

            this.addbtn(
                panel.kerning.content.btnbig,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none',
                    text: '2.0',
                    title: BX.message("SF_SPECIAL__BTN_BIG")
                }
            );

            panel.kerning.content.btnbig.addEventListener('click', function() {
                _this.send(par.events.kerningbig, panel.kerning.content.btnbig);
                panel.kerning.status.innerHTML = _this.selectkerning();
            });

            panel.kerning.content.appendChild(panel.kerning.content.btnnormal);
            panel.kerning.content.appendChild(panel.kerning.content.btnmiddle);
            panel.kerning.content.appendChild(panel.kerning.content.btnbig);
            panel.kerning.appendChild(panel.kerning.content);
            panel.kerning.appendChild(panel.kerning.status);
            panel.appendChild(panel.kerning);

        // === End Kerning ====== #endregion


        // === Interval ======

            panel.interval = document.createElement('div');
            panel.interval.className = par.modifier.interval;
            panel.interval.style.setProperty('padding', '1em', 'important');

            panel.interval.name = document.createElement('div');

            this.setLocalNameStyle(panel.interval, 'kegl-text', BX.message("SF_SPECIAL__INTERVAL"));

            // panel.interval.name.classList.add('kegl-text');
            // panel.interval.name.style.setProperty('margin-bottom', '0.75em', 'important');
            // panel.interval.name.style.fontSize = '.875em';
            // panel.interval.name.style.setProperty('color','#000','important');
            // panel.interval.name.innerHTML = BX.message("SF_SPECIAL__INTERVAL");

            panel.interval.appendChild(panel.interval.name);

            panel.interval.content = document.createElement('div');
            panel.interval.status = document.createElement('div');
            panel.interval.content.style.setProperty('border-color', '#d1d5da', 'important');
            panel.interval.content.classList.add('interval-content','flex','border-1','radius-3','overflow-hidden');

            panel.interval.content.btnone = document.createElement('button');
            panel.interval.content.btnhalf = document.createElement('button');
            panel.interval.content.btntwo = document.createElement('button');

            this.addbtn(
                panel.interval.content.btnone,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                    text: '1.0',
                    title: BX.message("SF_SPECIAL__BTN_ONE"),
                }
            );

            panel.interval.content.btnone.addEventListener('click', function() {
                _this.send(par.events.intervalone, panel.interval.content.btnone);
                panel.interval.status.innerHTML = selectinterval();
            });

            this.addbtn(
                panel.interval.content.btnhalf,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                    text: '1.5',
                    title: BX.message("SF_SPECIAL__BTN_HALF"),
                }
            );

            panel.interval.content.btnhalf.addEventListener('click', function() {
                _this.send(par.events.intervalhalf, panel.interval.content.btnhalf);
                panel.interval.status.innerHTML = selectinterval();
            });

            this.addbtn(
                panel.interval.content.btntwo,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                    text: '2.0',
                    title: BX.message("SF_SPECIAL__BTN_TWO"),
                }
            );

            panel.interval.content.btntwo.addEventListener('click', function() {
                _this.send(par.events.intervaltwo, panel.interval.content.btntwo);
                panel.interval.status.innerHTML = selectinterval();
            });

            this.setLocalStatusStyle(panel.interval, 'status-text', selectinterval);

            // panel.interval.status.classList.add('status-text', 'm-top-2','line-none');
            // panel.interval.status.style.fontSize = '.875em';
            // panel.interval.status.style.setProperty('color','#000','important');
            // panel.interval.status.innerHTML = selectinterval();

            panel.interval.content.appendChild(panel.interval.content.btnone);
            panel.interval.content.appendChild(panel.interval.content.btnhalf);
            panel.interval.content.appendChild(panel.interval.content.btntwo);
            panel.interval.appendChild(panel.interval.content);
            panel.interval.appendChild(panel.interval.status);
            panel.appendChild(panel.interval);

        // === End Interval ======

        // === Color ======

            panel.color = document.createElement('div');
            panel.color.className = par.modifier.color;
            panel.color.style.setProperty('padding', '1em', 'important');

            panel.color.name = document.createElement('div');

            this.setLocalNameStyle(panel.color, 'color-text', BX.message("SF_SPECIAL__COLOR"));

            // panel.color.name.classList.add('color-text');
            // panel.color.name.style.setProperty('margin-bottom','0.75em', 'important');
            // panel.color.name.style.fontSize = '.875em';
            // panel.color.name.style.setProperty('color','#000','important');
            // panel.color.name.innerText = BX.message("SF_SPECIAL__COLOR");

            panel.color.appendChild(panel.color.name);

            panel.color.content = document.createElement('div');
            panel.color.status = document.createElement('div');

            panel.color.content.classList.add('color-content','flex');
            panel.color.content.style.boxShadow = '0 1px 2px 1px rgb(0,0,0,0.1)';
            panel.color.content.style.borderRadius = '6px';

            // panel.color.status.classList.add('status-text');
            // panel.color.status.style.setProperty('margin-top', '0.75em', 'important');
            // panel.color.status.style.fontSize = '.875em';
            // panel.color.status.style.setProperty('color','#000','important');

            this.setLocalStatusStyle(panel.color, 'status-text', selectcolor);

            panel.color.status.innerText = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");

            // === Color ====== Кнопки управления цветовой схемой

            panel.color.content.btnwhite = document.createElement('button');
            panel.color.content.btnblack = document.createElement('button');
            panel.color.content.btnyellow = document.createElement('button');
            panel.color.content.btnblue = document.createElement('button');
            panel.color.content.btngreen = document.createElement('button');

            this.buttonColorStyle(
                panel.color.content.btnwhite,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none border-0 transition-shadow',
                    backgroundColor: '#FFF',
                    color: '#000',
                    padding: '12px',
                    borderTopLeftRadius: '6px',
                    borderBottomLeftRadius: '6px',
                    text: 'C',
                    title: BX.message("SF_SPECIAL__BTN_WHITE"),
                }
            );

            this.setColorTheme = (color, button) =>
            {
                if(this.cookies.get('specialcolor') != par.events[`color${color}`])
                {
                    this.send(par.events[`color${color}`], button);
                    panel.color.status.innerText = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
                }
            }

            panel.color.content.btnwhite.addEventListener('click',this.setColorTheme.bind(this, 'white', panel.color.content.btnwhite));

            // panel.color.content.btnwhite.addEventListener('click', function(e) {
            //     if(_this.cookies.get('specialcolor') != par.events.colorwhite) {
            //         _this.send(par.events.colorwhite, panel.color.content.btnwhite);
            //         panel.color.status.innerHTML = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
            //     }
            // });

            this.buttonColorStyle(
                panel.color.content.btnblack,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none border-0 transition',
                    backgroundColor: '#000',
                    color: '#FFF',
                    borderColor: '#000',
                    padding: '12px',
                    text: 'C',
                    title: BX.message("SF_SPECIAL__BTN_BLACK"),
                }
            );

            panel.color.content.btnblack.addEventListener('click', this.setColorTheme.bind(this, 'black', panel.color.content.btnblack));

            // panel.color.content.btnblack.addEventListener('click', function(e) {
            //     if(_this.cookies.get('specialcolor') != par.events.colorblack) {
            //         _this.send(par.events.colorblack, e.target);
            //         panel.color.status.innerHTML = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
            //     }
            // });

            this.buttonColorStyle(
                panel.color.content.btnyellow,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none border-0 transition-shadow',
                    backgroundColor: '#FF0',
                    // boxShadowColor: '#FF0',
                    color: '#000',
                    borderColor: '#FF0',
                    padding: '12px',
                    text: 'C',
                    title: BX.message("SF_SPECIAL__BTN_YELLOW"),
                }
            );

            panel.color.content.btnyellow.addEventListener('click', this.setColorTheme.bind(this, 'yellow', panel.color.content.btnyellow));

            // panel.color.content.btnyellow.addEventListener('click', function(e) {
            //     if(_this.cookies.get('specialcolor') != par.events.coloryellow) {
            //         _this.send(par.events.coloryellow, e.target);
            //         panel.color.status.innerHTML = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
            //     }
            // });

            this.buttonColorStyle(
                panel.color.content.btnblue,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none border-0 transition-shadow',
                    backgroundColor: '#9fd7ff',
                    color: '#000',
                    borderColor: '#9fd7ff',
                    padding: '12px',
                    text: 'C',
                    title: BX.message("SF_SPECIAL__BTN_BLUE"),
                }
            );

            panel.color.content.btnblue.addEventListener('click',this.setColorTheme.bind(this, 'blue', panel.color.content.btnblue));

            // panel.color.content.btnblue.addEventListener('click', function(e) {
            //     if(_this.cookies.get('specialcolor') != par.events.colorblue) {
            //         _this.send(par.events.colorblue, e.target);
            //         panel.color.status.innerHTML = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
            //     }
            // });

            this.buttonColorStyle(
                panel.color.content.btngreen,
                {
                    class: 'cursor-pointer focus:outline-0 appearance-none border-0 transition-shadow',
                    backgroundColor: '#a9dd38',
                    color: '#000',
                    borderColor: '#a9dd38',
                    padding: '12px',
                    borderTopRightRadius: '6px',
                    borderBottomRightRadius: '6px',
                    text: 'C',
                    title: BX.message("SF_SPECIAL__BTN_GREEN"),
                }
            );

            panel.color.content.btngreen.addEventListener('click', this.setColorTheme.bind(this, 'green', panel.color.content.btngreen));

            // panel.color.content.btngreen.addEventListener('click', function(e) {
            //     if(_this.cookies.get('specialcolor') != par.events.colorgreen) {
            //         _this.send(par.events.colorgreen, e.target);
            //         panel.color.status.innerHTML = selectcolor() + BX.message("SF_SPECIAL__SCHEMA");
            //     }
            // });

            panel.color.content.appendChild(panel.color.content.btnwhite);
            panel.color.content.appendChild(panel.color.content.btnblack);
            panel.color.content.appendChild(panel.color.content.btnyellow);
            panel.color.content.appendChild(panel.color.content.btnblue);
            panel.color.content.appendChild(panel.color.content.btngreen);

            panel.color.appendChild(panel.color.content);
            panel.color.appendChild(panel.color.status);
            panel.appendChild(panel.color);

        // === End Color ======



        // === Image ======

        panel.img = document.createElement('div');
        panel.img.className = par.modifier.img;
        panel.img.style.setProperty('padding', '1em', 'important');

        panel.img.name = document.createElement('div');

        this.setLocalNameStyle(panel.img, 'image-text', BX.message("SF_SPECIAL__IMG"));

        // panel.img.name.classList.add('color-text');
        // panel.img.name.style.setProperty('margin-bottom', '0.75em', 'important');
        // panel.img.name.style.fontSize = '.875em';
        // panel.img.name.style.setProperty('color','#000','important');
        // panel.img.name.innerHTML = BX.message("SF_SPECIAL__IMG");

        panel.img.appendChild(panel.img.name);

        panel.img.content = document.createElement('div');
        panel.img.status = document.createElement('div');

        this.setLocalStatusStyle(panel.img, 'status-text', selectimg);

        // panel.img.status.classList.add('status-text');
        // panel.img.status.style.setProperty('margin-top', '0.75em', 'important');
        // panel.img.status.style.fontSize = '.875em';
        // panel.img.status.style.setProperty('color','#000','important');
        // panel.img.status.innerHTML = selectimg();

        panel.img.content.style.setProperty('border-color', '#d1d5da', 'important');
        panel.img.content.classList.add('img-content','flex','border-1','radius-3','overflow-hidden');

        panel.img.content.btnoff = document.createElement('button');
        panel.img.content.btnbw = document.createElement('button');
        panel.img.content.btncolor = document.createElement('button');

        this.addbtn(
            panel.img.content.btnoff,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                text: BX.message("SF_SPECIAL__BTN_OFF_TEXT"),
                title: BX.message("SF_SPECIAL__BTN_OFF"),
            }
        );

        panel.img.content.btnoff.addEventListener('click', function() {
            _this.send(par.events.imageoff, panel.img.content.btnoff);
            panel.img.status.innerHTML = selectimg();
            _this.changeStateAlt('off');
        });

        this.addbtn(
            panel.img.content.btnbw,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                text: BX.message("SF_SPECIAL__BTN_BW_TEXT"),
                title: BX.message("SF_SPECIAL__IMG_BTN_BW"),
            }
        );

        panel.img.content.btnbw.addEventListener('click', function() {
            _this.send(par.events.imageblack, panel.img.content.btnbw);
            panel.img.status.innerHTML = selectimg();
            _this.changeStateAlt('onblack');
        });

        this.addbtn(
            panel.img.content.btncolor,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                text: BX.message("SF_SPECIAL__IMG_BTN_COLOR_TEXT"),
                title: BX.message("SF_SPECIAL__IMG_BTN_COLOR"),
            }
        );

        panel.img.content.btncolor.addEventListener('click', function() {
            _this.send(par.events.imagecolor, panel.img.content.btncolor);
            panel.img.status.innerHTML = selectimg();
            _this.changeStateAlt('oncolor');
        });

        panel.img.content.appendChild(panel.img.content.btnoff);
        panel.img.content.appendChild(panel.img.content.btnbw);
        panel.img.content.appendChild(panel.img.content.btncolor);


        panel.img.appendChild(panel.img.content);
        panel.img.appendChild(panel.img.status);
        panel.appendChild(panel.img);

        // =================================

        /*
            sound: {
                name: {},
                content: {
                    btnon:{},
                    btnoff: {},
                },
                status: {},
            },
        */
        /*if(_this.getproperty('special_speech') == 'Y') {

            panel.sound = document.createElement('div');
            panel.sound.className = par.modifier.sound;

            // ========== name
            panel.sound.name = document.createElement('div');
            panel.sound.name.classList.add('sound-text', 'm-bottom-2')
            panel.sound.name.style.setProperty('color','#000','important');
            panel.sound.name.innerHTML = 'Звук';

            panel.sound.appendChild(panel.sound.name);
            // ===========
            panel.sound.content = document.createElement('div');
            panel.sound.content.classList.add('sound-content','flex','border-1','radius-3','overflow-hidden');
            panel.sound.content.btnon = document.createElement('button');
            panel.sound.content.btnoff = document.createElement('button');

            this.addbtn(
                panel.sound.content.btnon,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                    // background: 'white',
                    // border: 'black',
                    // font: '.875em',
                    text: 'Вкл',
                    title: "Включить озвучивание текста",
                }
            );

            panel.sound.content.btnon.addEventListener('click', function(e) {
                _this.send(par.events.soundon, panel);
                panel.sound.status.innerHTML = selectsound();
            });

            this.addbtn(
                panel.sound.content.btnoff,
                {
                    class: 'cursor-pointer line-none focus:outline-0 appearance-none',
                    // background: 'white',
                    // border: 'black',
                    // font: '.875em',
                    text: 'Выкл',
                    title: "Выключить озвучивание текста",
                }
            );

            panel.sound.content.btnoff.addEventListener('click', function(e) {
                _this.send(par.events.soundoff, panel);
                panel.sound.status.innerHTML = selectsound();
            });

            // ===========
            panel.sound.status = document.createElement('div');
            panel.sound.status.classList.add('status-text', 'm-top-2');
            panel.sound.status.style.setProperty('color','#000','important');
            panel.sound.status.innerHTML = selectsound();
            // ===========

            panel.sound.content.appendChild(panel.sound.content.btnon);
            panel.sound.content.appendChild(panel.sound.content.btnoff);

            panel.sound.appendChild(panel.sound.content);
            panel.sound.appendChild(panel.sound.status);
            panel.appendChild(panel.sound);

            this.includeScript(par.modifier.specialsoundscript);
        }*/



        // =================================

        panel.onoff = document.createElement('div');
        panel.onoff.className = par.modifier.onoff;
        panel.onoff.style.setProperty('padding', '1em', 'important');

        panel.onoff.name = document.createElement('div');

        this.setLocalNameStyle(panel.onoff, 'onoff-text', BX.message("SF_SPECIAL__PANEL"));

        // panel.onoff.name.classList.add('onoff-text');
        // panel.onoff.name.style.setProperty('margin-bottom', '0.75em', 'important');
        // panel.onoff.name.style.fontSize = '.875em';
        // panel.onoff.name.style.setProperty('color','#000','important');
        // panel.onoff.name.innerHTML = BX.message("SF_SPECIAL__PANEL");

        panel.onoff.appendChild(panel.onoff.name);

        panel.onoff.content = document.createElement('div');
        panel.onoff.content.style.setProperty('border-color', '#d1d5da', 'important');
        panel.onoff.content.classList.add('onoff-content','flex','border-1','radius-3','overflow-hidden');

        panel.onoff.content.btnup = document.createElement('button');
        panel.onoff.content.btndefault = document.createElement('button');
        panel.onoff.content.btnonoff = document.createElement('button');


        this.addbtn(
            panel.onoff.content.btndefault,
            {
                class: 'cursor-pointer line-none focus:outline-0 appearance-none border-inline-end-1',
                text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" style="width:1em;height:1em"><path d="M142.9 142.9c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5c0 0 0 0 0 0H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8zM16 312v7.6 .7V440c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2l41.6-41.6c87.6 86.5 228.7 86.2 315.8-1c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.2 62.2-162.7 62.5-225.3 1L185 329c6.9-6.9 8.9-17.2 5.2-26.2s-12.5-14.8-22.2-14.8H48.4h-.7H40c-13.3 0-24 10.7-24 24z"/></svg>',
                title: BX.message("SF_SPECIAL__BTN_DEFAULT"),
            }
        );

        panel.onoff.content.btndefault.addEventListener('click', function() {
            _this.send(par.events.defaultsetting, panel);
        });

        this.addbtn(
            panel.onoff.content.btnonoff,
            {
                class: 'cursor-pointer focus:outline-0 appearance-none',
                text: BX.message("SF_SPECIAL__BTN_OFF_TEXT"),
                title: BX.message("SF_SPECIAL__BTN_OFF"),
            }
        );

        panel.onoff.content.btnonoff.addEventListener('click', function() {
            _this.send(par.events.close, panel);
            _this.changeStateAlt('onblack');
        });

        this.addbtn(
            panel.onoff.content.btnup,
            {
                class: 'cursor-pointer focus:outline-0 appearance-none',
                text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="width:1em;height:1em"><path d="M201.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 205.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z"/></svg>',
                title: BX.message("SF_SPECIAL__BTN_UP"),
            }
        )

        panel.onoff.content.btnup.classList.add('absolute','bottom-0','inline-end-0','radius-none');
        // panel.onoff.content.btnup.style.bottom = '0';
        // panel.onoff.content.btnup.style.right = '0';
        panel.onoff.content.btnup.style.borderBottom = '0 solid black';
        // panel.onoff.content.btnup.style.borderRadius = '0';

        if(_this.cookies.get('specialup') == 'down')
        {
            panel.style.marginTop = `-${panel.clientHeight}px`;
            panel.onoff.content.btnup.style.bottom = '-' + panel.onoff.content.btnup.clientHeight + 'px';
            panel.onoff.content.btnup.style.transform = 'rotate(180deg)';
            _this.cookies.set('specialup', 'up', 7);
        }
        else
        {
            panel.style.marginTop = '0';
            panel.onoff.content.btnup.style.bottom = '0';
            panel.onoff.content.btnup.style.transform = 'rotate(0deg)';
            _this.cookies.set('specialup', 'down', 7);
        }

        panel.onoff.content.btnup.addEventListener('click', this.send.bind(this, par.events.up, panel));
        // function(e) {
        //     _this.send(par.events.up, panel);
        // });

        panel.onoff.content.appendChild(panel.onoff.content.btndefault);
        panel.onoff.content.appendChild(panel.onoff.content.btnonoff);

        panel.onoff.appendChild(panel.onoff.content);
        panel.appendChild(panel.onoff);
        panel.appendChild(panel.onoff.content.btnup);

        // #endregion =================================

        return panel;
    }

    // #endregion Panel Special

    /**
     *
     * @param {*} e
     */
    /*
        this.modal = function(e) {
            var overlay = {
                load: {},
                area: {
                    content: {},
                    close: {},
                },
            },
            _this = this,
            par = e.target.params,
            page = document.body.querySelector('.sf-pagewrap-area'),
            el = e.target;

            overlay = document.createElement('div');
            overlay.load = document.createElement('div');
            overlay.load.innerHTML = par.load;
            overlay.area = document.createElement('div');
            overlay.area.content = document.createElement('div');
            overlay.area.close = document.createElement('button');

            overlay.load.setAttribute(par.attributes.load, '');
            overlay.className = par.modifier.overlay;
            overlay.style.display = 'flex';
            overlay.load.style.position = 'fixed';
            overlay.load.style.top = '0';
            overlay.load.style.left = '0';
            overlay.load.style.width = '100%';
            overlay.setAttribute(par.attributes.overlay, '');

            overlay.addEventListener('click', function(e) {
                if(e.target.hasAttribute(par.attributes.overlay))
                    _this.send(par.events.close, overlay);
            });

            overlay.classList = par.modifier.overlay;
            overlay.setAttribute(par.data.src, par.modifier.src);
            overlay.style.zIndex = this.topZIndex() + 1;

            overlay.area.setAttribute(par.attributes.modal, '');
            overlay.area.className = par.modifier.modal;
            overlay.area.content.setAttribute(par.attributes.content, '');
            overlay.area.content.className = par.modifier.content;
            overlay.area.style.opacity = '0';
            overlay.area.appendChild(overlay.area.content);

            overlay.area.close.addEventListener('click', function(e) {
                _this.send(par.events.close, overlay);
            });

            overlay.area.close.setAttribute(par.attributes.close, '');
            overlay.area.close.className = par.modifier.close;
            overlay.area.appendChild(overlay.area.close);
            overlay.appendChild(overlay.load);
            overlay.appendChild(overlay.area);

            // Событие происходит перед открытием окна
            this.receive(par.events.open, overlay, function(e) {
                overlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';

                try {
                    if(el.hasAttribute(par.data.blur) || (par.attributes.blur != null && par.attributes.blur != undefined)) {
                        //console.log(page)
                        if(page !== null && page !== undefined) {
                            //console.log(par.modifier.blur)
                            page.classList.add(par.modifier.blur.replace(" ", ''));
                        }
                    }
                } catch(exp) {

                }


            });

            // Событие происходит перед закрытием окна
            this.receive(par.events.close, overlay, function(e) {
                if(overlay.parentNode != null) {
                    overlay.area.style.opacity = '0';
                    overlay.area.content.innerHTML = '';
                    overlay.load.style.display = 'flex';
                    overlay.parentNode.removeChild(overlay);
                }
                document.body.style.overflow = 'auto';
                try {
                    if(el.hasAttribute(par.data.blur) || (par.attributes.blur != null && par.attributes.blur != undefined))
                    if(page !== null && page !== undefined)
                        page.classList.remove(par.modifier.blur.replace(" ", ""));
                } catch(exp) {

                }

            });

            return overlay;
        }

        this.iframe = function(e) {
            var overlay = {
                load: {},
                area: {
                    content: {},
                    close: {},
                },
            },
            _this = this,
            par = e.target.params,
            page = document.body.querySelector('.sf-pagewrap-area'),
            el = e.target;



            overlay = document.createElement('div');
            overlay.load = document.createElement('div');
            overlay.load.innerHTML = par.load;
            overlay.area = document.createElement('div');
            overlay.area.content = document.createElement('iframe');
            overlay.area.content.src = par.modifier.src;
            overlay.area.close = document.createElement('button');

            overlay.load.setAttribute(par.attributes.load, '');
            overlay.load.className = par.modifier.load;
            overlay.load.style.position = 'fixed';
            overlay.load.style.top = '0';
            overlay.load.style.left = '0';
            overlay.load.style.width = '100%';
            overlay.setAttribute(par.attributes.overlay, '');

            overlay.addEventListener('click', function(e) {
                if(e.target.hasAttribute(par.attributes.overlay))
                    _this.send(par.events.close, overlay);
            });

            overlay.classList = par.modifier.overlay;
            overlay.setAttribute(par.data.src, par.modifier.src);
            overlay.style.zIndex = this.topZIndex() + 1;

            overlay.area.setAttribute(par.attributes.content, "");
            overlay.area.className = par.modifier.modal;
            overlay.area.content.setAttribute(par.attributes.content, "");
            overlay.area.content.className = par.modifier.content;
            overlay.area.style.opacity = "0";
            overlay.area.appendChild(overlay.area.content);


            overlay.area.close.addEventListener('click', function(e) {
                _this.send(par.events.close, overlay);
            });


            overlay.area.close.setAttribute(par.attributes.close, '');
            overlay.area.close.className = par.modifier.close;
            overlay.area.appendChild(overlay.area.close);
            overlay.appendChild(overlay.load);
            overlay.appendChild(overlay.area);

            this.receive(par.events.open, el || window, function(e) {
                overlay.style.opacity = 1;
                document.body.style.overflow = 'hidden';
                overlay.style.display = 'flex';
                if(el.hasAttribute(par.data.blur) || par.attributes.blur)
                    if(page !== null && page !== undefined)
                        page.classList.add(par.modifier.blur);
            });

            this.receive(par.events.close, overlay, function(e) {
                if(overlay.parentNode != null) {
                    overlay.area.style.opacity = '0';
                    overlay.area.content.innerHTML = '';
                    overlay.load.style.display = 'flex';
                    overlay.parentNode.removeChild(overlay);
                }
                document.body.style.overflow = 'auto';
                if(el.hasAttribute(par.data.blur) || par.attributes.blur)
                    if(page !== null && page !== undefined)
                        page.classList.add(par.modifier.blur);
            });


            this.send(par.events.open, el);
            return overlay;
        }
    */

    this.providercreate = function(e) {
        var b = e.target.blocks,
            el = e.target,
            par = el.params;
        switch(b) {
            /*
            case 'modal':
                el.modal = this.modal(e);
                el.event = par.events.init;
                this.send("providerend", el);
                break;
            */
            case "special":
                el.special = this.special(e);
                el.event = par.events.init;
                this.send('providerend', el);
                break;
            case 'ajaxload':
                el.event = par.events.init;
                this.send('providerend', el);
                break;
        }
    }

    var _this = this;

    if(this.stack.ev('providerstart')) {
        this.receive('providerstart', window, function(e) {
            _this.providercreate(e);
        });
        this.stack.events.push('providerstart');
    }

}
