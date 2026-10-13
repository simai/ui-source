

export function Gallery(e, item, param) {

    /**
     * @var _g - Текущий контекст - this
     */
    var _g = this;

    _g.width = function()
    {
        let content = _g.gallery.modal.area.content;

        content.style.width = _g.slideActive.width + 'px';
        content.style.height = _g.slideActive.height + 'px';
    }

    _g.maxWidth = function() {
        return Math.ceil(window.innerWidth * 0.6)
    }

    _g.maxHeight = function() {
        return Math.ceil(window.innerHeight * 0.85)
    }

    _g.scrollSlide = function(item) {
        let w = 0;
        for(let k = 0; k < _g.slides.length; k++) {
            _g.slides[k].number = k;
            _g.slides[k].position = -w;
            if(_g.slides[k] == item) {
                _g.slides[k].active = true;
                _g.slides[k].mediatype = item.mediatype;
                _g.slideActive = _g.slides[k];
                _g.container.style.transform = 'translate3d(-' + w + 'px,0,0)';
            } else {
                _g.slides[k].active = false;
            }
            w += _g.slides[k].width;
        }
    }

    _g.sMove = function(e, start = 0) {
        _g.container.style.transform = 'translate3d(' + (_g.slideActive.position - (start - e.pageX)) + 'px,0,0)';
    }

    _g.sUp = function(e, start) {
        let tar = e.target;
        if(!tar.classList.contains('slide--next') && !tar.classList.contains('slide--prev')) {
            if(start > e.pageX) {
                _g.next();
                if(!_g.slides[_g.slideActive.number + 1]) {
                    _g.container.style.transform = 'translate3d(' + _g.slideActive.position + 'px,0,0)';
                }
            } else if(start < e.pageX) {
                _g.prev();
                if(!_g.slides[_g.slideActive.number - 1]) {
                    _g.container.style.transform = 'translate3d(' + _g.slideActive.position + 'px,0,0)';
                }
            }
        }
    }

    _g.mediaType = function(src)
    {
        if(/\.jpg|\.jpeg|\.png\.bmp\.gif\.tif\.tiff\.jfi\.jfif\.exif\.svg/i.test(src)) {
            return 'img'
        } else if(/\.mp4|\.m3u8|\.mpd/i.test(src)) {
            return 'video'
        } else if(/youtube\./i.test(src)) {
            return 'youtube'
        } else if(/vimeo\./i.test(src)) {
            return 'vimeo'
        } else if(/\.mp3/i.test(src)) {
            return 'audio'
        } else if(/.pdf/i.test(src)) {
            return 'iframe'
        } else if(/.html/i.test(src)) {
            return 'html'
        } else if(/.php/i.test(src)) {
            return 'php'
        }

        return 'img';
    }

    _g.touchMedia = function(el)
    {
        SF.receive('galleryVideoPause', _g.gallery.modal, function() {
            switch(_g.slides[_g.slideActive.number - 1].mediatype)
            {
                case 'video':
                    if(!el.paused)
                    {
                        el.pause()
                    }
                    else
                    {
                        el.play()
                    }

                    break;
            }
        });
    }

    _g.contentType = function(src)
    {
        let type = _g.mediaType(src),
            el = false;

        if(type)
        {
            switch(type)
            {
                case 'img':
                    el = document.createElement(type);
                    el.src = src;
                    break;
                case 'html':
                case 'php':
                case 'iframe':
                case 'youtube':
                    el = document.createElement('iframe');
                    el.src = src;
                    el.setAttribute('allowfullscreen', 'allowfullscreen');
                    el.setAttribute('allow', 'autoplay; fullscreen');
                    el.setAttribute('scrolling', 'no');
                    //_g.touchMedia(el);
                    break;
                case 'video':
                    el = document.createElement(type);
                    el.src = src;
                    el.controls = true;
                    _g.touchMedia(el);
                    break;
                case 'vimeo':
                    break;
                case 'audio':
                    break;
            }
        }

        return el;
    }

    _g.mediaSize = function(el, item) {
        let w = el.width,
            h = el.height,
            curW = 0,
            curH = 0,
            maxW = _g.maxWidth(),
            maxH = _g.maxHeight(),
            px = 'px';

        if(/video/i.test(el.tagName)) {
            w = el.videoWidth;
            h = el.videoHeight;
        }

        if(w <= 0 && h <= 0) {
            if(window.innerWidth > window.innerHeight) {
                w = maxW;
                h = (maxH / maxW) * w;
            } else if(window.innerWidth < innerHeight) {
                h = maxW / (maxH / maxW);
                w = maxW;
            } else {
                w = maxW;
                h = maxH;
            }
        }

        if(w > h) {
            if(w >= maxW) {
                curW = maxW;
            } else {
                if(w <= 0) {
                    curW = maxW;
                    w = maxW;
                    h = maxH;
                } else {
                    curW = w;
                }
            }
            curH = (h / w) * curW;
            el.classList.add('w-full','h-auto');
        } else if(w < h) {
            if(h >= maxH) {
                curH = maxH;
            } else {
                if(h <= 0) {
                    curH = maxH;
                    //w = maxW;
                    //h = maxH;
                } else {
                    curH = h;
                }
            }
            curW = curH / (h / w);
            el.classList.add('w-auto','h-full');
        } else {
            if(w >= maxW) {
                curW = maxH;
                curH = maxH;
            } else {
                if(w <= 0 && h <= 0) {
                    curW = maxW;
                    curH = maxH;
                } else if(w <= 0) {
                    curW = maxW;
                    curH = h;
                } else if(h <= 0) {
                    curW = h;
                    curH = maxH;
                } else {
                    curW = h;
                    curH = h;
                }
            }
            el.classList.add('w-full','h-auto');
        }

        curW = Math.ceil(curW);
        curH = Math.ceil(curH);
        item.width = curW;
        item.height = curH;
        item.style.width = curW + px;
        item.style.height = curH + px;
    }

    _g.item = function(item) {
        let cItem = {
            param       : item.param,
            mediatype   : false,
            img         : {},
            width       : _g.maxWidth(),
            height      : _g.maxHeight(),
            number      : _g.slides.length,
            active      : (_g.slides.length == 0) ? true : false,
        }

        cItem       = document.createElement('div');
        cItem.img   = _g.contentType(item.src);

        cItem.className         = 'slider--item ' + _g.param.slide;
        cItem.img.className     = 'slider--image ' + _g.param.image;
        cItem.param = item.param;

        switch(_g.mediaType(item.src))
        {
            case 'video':
                cItem.mediatype = 'video';
                cItem.img.onloadeddata = function() {
                    _g.mediaSize(this, cItem);
                }
                break;
            case 'html':
            case 'php':
            case 'iframe':
            case 'youtube':
                cItem.mediatype = 'iframe';
                _g.mediaSize(cItem.img, cItem);
                cItem.img.classList.add('w-full', 'h-full', 'border-0', 'bg-transparent', 'flex', 'm-0', 'overflow-hidden', 'p-0');
                break;
            default:
                cItem.mediatype = 'image';
                cItem.img.onload = function() {
                    _g.mediaSize(this, cItem);
                }
                break;
        }

        cItem.setAttribute('gallery-slide', _g.slides.length);
        cItem.append(cItem.img);

        cItem.onmousedown = function(e) {
            let start = e.pageX;

            cItem.onmousemove = function(e) {
                _g.sMove(e, start);
            }

            _g.gallery.modal.onmouseup = function(e) {
                _g.sUp(e, start);
                SF.send('galleryVideoPause', _g.gallery.modal);
                cItem.onmousemove = null;
                _g.gallery.modal.onmouseup = null;
            }
        }

        cItem.ontouchstart = function(e) {
            let start = e.touches[0].pageX;

            cItem.ontouchmove = function(e) {
                _g.sMove(e.touches[0], start);
            }

            _g.gallery.modal.ontouchend = function(e) {
                _g.sUp(e.changedTouches[0], start);
                //SF.send('galleryVideoPause', _g.gallery.modal);
                cItem.ontouchmove = null;
                _g.gallery.modal.ontouchend = null;
            }
        }

        cItem.ondragstart = function() {return false}

        _g.slides.push(cItem);

        item.e.addEventListener('click', function(e) {
            e.preventDefault();
            _g.scrollSlide(cItem);
            _g.width();
            _g.onBtn();
            _g.gallery.contentUpload();
        });

        return cItem;
    }

    _g.addAnimationSlide = function() {
        _g.container.style.transitionDuration = _g.param.animation.duration + 'ms';
        setTimeout(function() {
            _g.container.style.transitionDuration = '0ms';
        }, _g.param.animation.duration);
    }

    _g.imageLoad = function(item) {
        let container = {};
        container = document.createElement('div');
        container.className = 'container--slider ' + _g.param.container;
        for(let k = 0; k < item.length; k++) {
            container.append(_g.item(item[k]));
        }
        return container;
    }

    _g.btn = function()
    {
        let btn = {};

        btn = document.createElement('div');
        btn.className = 'absolute flex items-cross-center content-main-center radius-1 z-2 cursor-pointer';
        btn.style.width = '3rem';
        btn.style.height = '3rem';
        btn.style.backgroundColor = 'rgba(255,255,255,0.37)';
        btn.style.backdropFilter = 'blur(10px)';

        return btn;
    }

    _g.onBtn = function()
    {
        let next = _g.control.next,
            prev = _g.control.prev;

        if(!_g.slides[_g.slideActive.number + 1]) {
            next.classList.add('hidden');
            next.classList.remove('flex');
        } else if(next.classList.contains('hidden')) {
            next.classList.add('flex');
            next.classList.remove('hidden');
        }

        if(!_g.slides[_g.slideActive.number - 1]) {
            prev.classList.add('hidden');
            prev.classList.remove('flex');
        } else if(prev.classList.contains('hidden')) {
            prev.classList.add('flex');
            prev.classList.remove('hidden');
        }
    }

    _g.next = function()
    {
        let content = _g.gallery.modal.area.content,
            sA = _g.slideActive,
            w = 0,
            nS = _g.slides[sA.number + 1],
            px = 'px';

        if(nS) {
            content.style.width = nS.width + px;
            content.style.height = nS.height + px;
            for(let k = 0; k <= sA.number; k++) {
                w += _g.slides[k].width;
            }
            _g.slideActive = nS;
            _g.container.style.transform = 'translate3d(-' + w + px + ',0,0)';
            _g.onBtn();
        }
        _g.addAnimationSlide();
        SF.send('galleryNextSlide', _g.gallery.modal);
    }

    _g.prev = function()
    {
        let content = _g.gallery.modal.area.content,
            sA = _g.slideActive,
            w = 0,
            pS = _g.slides[sA.number - 1],
            px = 'px';
        if(pS) {
            content.style.width = pS.width + px;
            content.style.height = pS.height + px;
            for(let k = 0; k < sA.number - 1; k++) {
                w += _g.slides[k].width;
            }
            _g.slideActive = pS;
            _g.container.style.transform = 'translate3d(-' + w + px + ',0,0)';
            _g.onBtn();
        }
        _g.addAnimationSlide();
        SF.send('galleryPrevSlide', _g.gallery.modal);
    }

    _g.createControl = function()
    {
        let next = {},
            prev = {};

        next = _g.btn();
        next.classList.add('slide--next');
        next.style.top = 'calc(50% - 1.5rem)';
        next.style.insetInlineEnd = '-1.5rem';
        next.innerHTML = '<i class="far fa-angle-right color-white text-1"></i>';

        next.addEventListener('click', _g.next.bind(_g));

        prev = _g.btn();
        prev.classList.add('slide--prev');
        prev.style.top      = 'calc(50% - 1.5rem)';
        prev.style.insetInlineStart     = '-1.5rem';
        prev.innerHTML      = '<i class="far fa-angle-left color-white text-1"></i>';

        prev.addEventListener('click', _g.prev.bind(_g));

        return {next:next, prev:prev}
    }

    _g.fullscreen = function()
    {
        let btn = {};
        btn = document.createElement('div');
        btn.innerHTML = '<svg style="width:1em;height:1em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M128 32H32C14.31 32 0 46.31 0 64v96c0 17.69 14.31 32 32 32s32-14.31 32-32V96h64c17.69 0 32-14.31 32-32S145.7 32 128 32zM416 32h-96c-17.69 0-32 14.31-32 32s14.31 32 32 32h64v64c0 17.69 14.31 32 32 32s32-14.31 32-32V64C448 46.31 433.7 32 416 32zM128 416H64v-64c0-17.69-14.31-32-32-32s-32 14.31-32 32v96c0 17.69 14.31 32 32 32h96c17.69 0 32-14.31 32-32S145.7 416 128 416zM416 320c-17.69 0-32 14.31-32 32v64h-64c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c17.69 0 32-14.31 32-32v-96C448 334.3 433.7 320 416 320z"/></svg>';
        btn.classList.add('gallery--fullscreen', 'p-inline-end-3','p-inline-start-3', 'p-top-2','p-bottom-2', 'line-solid', 'cursor-pointer',
            'text-1', 'bg-gray-9', 'border-radius-1', 'border-gray-8', 'hover:bg-gray-8', 'transition');

        btn.addEventListener('click', function() {
            if(!document.fullscreenElement)
            {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)
                });
            }
            else
            {
                document.exitFullscreen();
            }
        });

        return btn;
    }

    _g.close = function()
    {
        let btn = {};
        btn = document.createElement('div');
        btn.innerHTML = '<svg style="width:1em;height:1em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M310.6 361.4c12.5 12.5 12.5 32.75 0 45.25C304.4 412.9 296.2 416 288 416s-16.38-3.125-22.62-9.375L160 301.3L54.63 406.6C48.38 412.9 40.19 416 32 416S15.63 412.9 9.375 406.6c-12.5-12.5-12.5-32.75 0-45.25l105.4-105.4L9.375 150.6c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L160 210.8l105.4-105.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-105.4 105.4L310.6 361.4z"/></svg>';
        btn.classList.add('gallery--close', 'p-inline-end-3','p-inline-start-3', 'p-top-2','p-bottom-2', 'line-solid', 'cursor-pointer', 'text-1', 'bg-gray-9', 'hover:bg-gray-8', 'transition');
        btn.addEventListener('click', function() {
            SF.send(_g.gallery.param.event.beforeCloseWindow, _g.gallery.modal);
        })
        return btn;
    }

    _g.topPanel = function()
    {
        let container = {
            slidenav : {
                start : {},
                end : {}
            },
            nav : {
                slideshow : {},
                close : {},
                fullscreen : {}
            },
        };
        container = document.createElement('section');
        container.nav = document.createElement('div');

        if(_g.param.panel.slidenav)
        {
            container.slidenav = document.createElement('div');
            container.slidenav.start = document.createElement('span');
            container.slidenav.end = document.createElement('span');
            container.slidenav.classList.add('panel--slidenavigation', 'grow-none', 'flex', 'text-0', 'line-solid', 'items-cross-center', 'p-2');
            container.slidenav.start.classList.add('slidenavigaion--start', 'm-inline-end-1');
            container.slidenav.end.classList.add('slidenavigation--end', 'm-inline-start-1');
            container.slidenav.start.append('1');
            container.slidenav.append(container.slidenav.start);
            container.slidenav.append('/');
            container.slidenav.append(container.slidenav.end);
            container.slidenav.end.append(_g.slideActive.number + 1);
            container.append(container.slidenav);
        }

        if(_g.param.panel.fullscreen) {
            container.nav.fullscreen = _g.fullscreen();
            container.nav.append(container.nav.fullscreen);
        }

        container.classList.add('panel--top', 'flex', 'content-between', 'color-white', 'border-white', 'theme-dark', 'bg-transparent');
        container.nav.classList.add('panel--navigation', 'grow', 'flex', 'content-main-end', 'items-cross-end');

        // Close -
        if(_g.param.panel.close)
        {
            container.nav.close = _g.close();
            container.nav.append(container.nav.close);
        }

        SF.receive('galleryNextSlide', _g.gallery.modal, function() {
            container.slidenav.end.innerHTML = _g.slideActive.number + 1;
        });

        SF.receive('galleryPrevSlide', _g.gallery.modal, function() {
            container.slidenav.end.innerHTML = _g.slideActive.number + 1;
        });

        container.append(container.nav)

        return container;
    }

    _g.galleryNextSlide = function(container)
    {
        if(_g.slideActive.param.name)
        {
            container.header.classList.add('p-2');
            container.header.innerHTML = _g.slideActive.param.name;
        }
        else
        {
            container.header.classList.remove('p-2');
            container.header.innerHTML = '';
        }
    }

    _g.galleryPrevSlide = function(container)
    {
        if(_g.slideActive.param.name)
        {
            container.header.classList.add('p-2');
            container.header.innerHTML = _g.slideActive.param.name;
        }
        else
        {
            container.header.classList.remove('p-2');
            container.header.innerHTML = '';
        }
    }

    _g.bottomPanel = function() {
        let container = {
            header : {}
        };

        container = document.createElement('section');
        container.classList.add('panel--bottom', 'flex', 'items-cross-center', 'content-main-center', 'color-white', 'backdrop-blur-9', 'text-1');
        container.header = document.createElement('div');
        container.header.classList.add('gallery--header');

        if(_g.slideActive.param.name)
        {
            container.header.classList.add('p-2');
            container.header.innerHTML = _g.slideActive.param.name;
        }

        SF.receive('galleryNextSlide', _g.gallery.modal, _g.galleryNextSlide.bind(_g,container));
        SF.receive('galleryPrevSlide', _g.gallery.modal, _g.galleryPrevSlide.bind(_g,container));

        container.append(container.header);

        return container;
    }

    _g.param = {
        container: 'w-full h-full flex items-cross-center relative transition-transform transition-transform z-1 transform-t3d bSizing-cBox',
        slide: 'w-full h-full flex items-cross-center content-center shrink-none relative transition-transform',
        image: '',
        control:
        {
            next:
            {
                modifier : '',
                icon : ''
            },
            prev:
            {
                modifier : '',
                icon : ''
            },
        },
        animation:
        {
            duration: 300,
        },
        modal:
        {
            content: 'sf-modal-content bg-transparent p-0 overflow-hidden backdrop-blur-9',
            area: 'sf-modal-area relative w-auto bg-transparent w-max-full',
            close:
            {
                active: true,
                modifier: 'sf-close transition z-1',
            },
            unclose: true,
            mode: 'image',
        },
        panel:
        {
            close : true,
            fullscreen : true,
            slidenav : true,
        }
    }

    _g.slides = [];
    _g.slideActive = {
        number : '',
    }
    _g.container = _g.imageLoad(item);
    _g.control = _g.createControl();
    param.html = _g.container;
    param.mode = _g.param.modal.mode,
    param.unclose = _g.param.modal.unclose;
    param.content = _g.param.modal.content;
    param.area = _g.param.modal.area;
    param.close.active = false;
    param.tooltip.active = false;
    param.hide.active = false;


    param.afterContentUpload = function(_m)
    {
        _m.modal.area.next = _g.control.next;
        _m.modal.area.prev = _g.control.prev;
        _m.modal.area.topPanel = _g.topPanel();
        _m.modal.area.bottomPanel = _g.bottomPanel();
        _m.modal.area.append(_m.modal.area.next);
        _m.modal.area.append(_m.modal.area.prev);
        _m.modal.area.prepend(_m.modal.area.topPanel);
        _m.modal.area.append(_m.modal.area.bottomPanel);
        _g.width();
        _g.onBtn();
    }

    param.beforeCloseWindow = function(_m)
    {
        _m.modal.area.next.remove();
        _m.modal.area.prev.remove();
        _m.modal.area.topPanel.remove();
        _m.modal.area.bottomPanel.remove();
    }

    _g.gallery = new SF.Modal(e, param);

}


SF.Gallery = Gallery;
