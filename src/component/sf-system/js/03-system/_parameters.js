SF.Parameters = function() {
    /**
     * newparams - генерация новых параметров
     */
    this.newparams = function() {
        return this.params;
    }

    /**
     * Обновление существующих параметров
     * @param {*} el
     */
    this.updateparams = function(el) {
        var par = el.params,
            mod = par.modifier,
            data = par.data;
        for(var key in mod) {
            mod[key] = el.hasAttribute(data[key]) ? mod[key] + ' ' + el.getAttribute(data[key]) : mod[key];
        }
    }

// ================ CONSTRUCTOR ================ //
    this.params = {
        ajax: {
            events: {
                init: 'ajaxinit',
                load: 'endcontentload',
            },
            method: 'GET',
            type: 'html',
            timeout: 0,
            async: true,
            emulateOnload: true,
            cache: true
        },
        controller: {

        },
        search: {

        },
        provider: {

        },
        blocks: {
            special: {
                cookies: {
                    specialfont: 'default',
                    specialstate: 'off',
                    specialcolor: 'specialwhite',
                    specialkegl: '16',
                    specialinterval: '1',
                    specialkerning: 'normal',
                    specialimage: 'off',
                    specialup: 'down',
                    specialsound: 'off',
                },
                events: {
                    init: 'specialinit',
                    create: 'specialcreate',
                    open: 'specialopen',
                    close: 'specialoff',
                    up: 'specialup',
                    soundon: 'specialsoundon',
                    soundoff: 'specialsoundoff',
                    defaultsetting: 'specialdefaultsetting',
                    // === События панели Special
                    fontsans: 'specialfontsans',
                    fontserif: 'specialfontserif',
                    fontmono: 'specialfontmono',
                    keglmore: 'specialkeglmore',
                    keglless: 'specialkeglless',
                    intervalone: 'specialintervalone',
                    intervalhalf: 'specialintervalhalf',
                    intervaltwo: 'specialintervaltwo',
                    imageoff: 'specialimageoff',
                    imageblack: 'specialimageblack',
                    imagecolor: 'specialimagecolor',
                    colorwhite: 'specialcolorwhite',
                    colorblack: 'specialcolorblack',
                    coloryellow: 'specialcoloryellow',
                    colorblue: 'specialcolorblue',
                    colorgreen: 'specialcolorgreen',
                    kerningnormal: 'specialkerningnormal',
                    kerningmiddle: 'specialkerningmiddle',
                    kerningbig: 'specialkerningbig',
                },
                data: {
                    init: 'sf-special',
                    panel: 'sf-special-panel',
                    kegl: 'sf-special-kegl',
                    interval: 'sf-special-interval',
                    color: 'sf-special-color',
                    img: 'sf-special-img',
                    on: 'sf-special-on',
                },
                attributes: {

                },
                modifier: {
                    panel: 'special-panel flex items-cross-start content-main-center flex-wrap flex-row w-full',
                    font: 'flex items-cross-center content-main-center flex-col',
                    kegl: 'flex items-cross-center content-main-center flex-col',
                    interval: "flex items-cross-center content-main-center flex-col",
                    kerning: 'flex items-cross-center content-main-center flex-col',
                    color: "flex items-cross-center content-main-center flex-col",
                    img: "flex items-cross-center content-main-center flex-col",
                    onoff: "flex items-cross-center content-main-center flex-col",
                    sound: "flex items-cross-center content-main-center flex-col",
                    black: 'sf-special-black',
                    white: 'sf-special-white',
                    yellow: 'sf-special-yellow',
                    blue: 'sf-special-blue',
                    green: 'sf-special-green',
                    // Путь до стилей
                    // specialwhite: '/simai/asset/simai.framework/sf4.master/plugin/special/css/white.min.css',
                    // specialblack: '/simai/asset/simai.framework/sf4.master/plugin/special/css/black.min.css',
                    // specialyellow: '/simai/asset/simai.framework/sf4.master/plugin/special/css/yellow.min.css',
                    // specialblue: '/simai/asset/simai.framework/sf4.master/plugin/special/css/blue.min.css',
                    // specialgreen: '/simai/asset/simai.framework/sf4.master/plugin/special/css/green.min.css',
                    specialsoundscript: 'https://webasr.yandex.net/jsapi/v1/webspeechkit.js',
                },
            },
            /*
            modal: {
                load: '<div class="sf-progress"><div class="sf-progress-animation"></div></div>',
                events: {
                    init: 'modalinit',
                    create: "modalcreate",
                    open: 'modalopen',
                    close: 'modalclose',
                },
                data: {
                    init: 'sf-modal',
                    src: 'sf-src',
                    modal: 'sf-modal-modifier',
                    content: 'sf-content-modifier',
                    close: "sf-close-modifier",
                    overlay: 'sf-overlay-modifier',
                    blur: 'sf-blur',
                    iframe: 'sf-iframe',
                },
                attributes: {
                    overlay: 'sf-modal-overlay',
                    load: 'sf-modal-loadanimation',
                    modal: 'sf-modal-area',
                    content: 'sf-modal-content',
                    close: 'sf-modal-close',
                    number: 'sf-modal-number'
                },
                modifier: {
                    src: '',
                    service: 'sf-service-bottom-area',
                    container: 'sf-modal-container',
                    overlay: 'sf-modal-overlay',
                    load: 'sf-modal-load',
                    modal: 'sf-modal-area',
                    content: 'sf-modal-content sf-scroll',
                    close: 'sf-close',
                    blur: 'blur',
                    page: 'sf-pagewrap-area',
                },
            },
            */
            ajaxload: {
                load: '<div class="sf-progress"><div class="sf-progress-animation"></div></div>',
                events: {
                    init: 'ajaxloadinit',
                    cancel: 'ajaxloadcanceltrack',
                    create: 'ajaxloadcreate',
                },
                data: {
                    init: 'sf-ajaxload',
                    src: 'sf-src',
                    cancel: 'sf-canceltrack',
                    loaded: 'sf-ajaxloaded',
                },
                attributes: {

                },
                modifier: {
                    src: '',
                },
            }
        },
    }
// ================ END CONSTRUCTOR ================ //
}
