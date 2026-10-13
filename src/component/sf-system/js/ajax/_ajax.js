import stableHash from "../../../../core/js/stableHash";
import registerComponent from "../../../register-helper";

/**
 *
 * @param {*} param
 * @param {*} callback
 * @param {*} calbackAfter
 */
export function Ajax(param, callback = function () {
}, calbackAfter = function () {
}) {
    this.controller = null;

    /**
     * @description Обновление параметров
     * @param {object} param - передаваемые параметры
     */
    this.updateparam = function (param) {
        for (var key in param) this.param[key] = param[key];
    }

    this.isFunction = function (item) {
        if (typeof item === 'function') {
            return true;
        }
        var type = Object.prototype.toString.call(item);
        return type === '[object Function]' || type === '[object GeneratorFunction]';
    }

    this.isString = function (v) {
        return typeof v === 'string';
    }

    this.isEmptySource = function (script, src, source = 'js') {
        for (var k = 0; k < script.length; k++) {
            switch (source) {
                case 'js':
                    if (script[k].src.indexOf(src) !== -1) {
                        return true;
                    }
                    break;
                case 'css':
                    if (script[k].href.indexOf(src) !== -1) {
                        return true;
                    }
                    break;
                case 'js-line':
                    if (script[k].innerHTML.indexOf(src) !== -1) {
                        return true;
                    }
                    break;
            }

        }
        return false;
    }


    this.processHTML = function (data) {
        var r = {
            script: /<script([^>]*)>/ig,
            script_end: /<\/script>/ig,
            script_src: /src=["\']([^"\']+)["\']/i,
            script_type: /type=["\']([^"\']+)["\']/i,
            space: /\s+/,
            ltrim: /^[\s\r\n]+/g,
            rtrim: /[\s\r\n]+$/g,
            style: /<link.*?(rel="stylesheet"|type="text\/css")[^>]*>/i,
            style_href: /href=["\']([^"\']+)["\']/i
        };
        var matchScript, matchStyle, matchSrc, matchHref, matchType, scripts = [], styles = [];
        var textIndexes = [];
        var lastIndex = r.script.lastIndex = r.script_end.lastIndex = 0;
        var allDocScript = document.querySelectorAll('script[src]'),
            allDocCSS = document.querySelectorAll('link[href]'),
            aDocScriptLine = document.querySelectorAll('script:not([src])');

        while ((matchScript = r.script.exec(data)) !== null) {
            r.script_end.lastIndex = r.script.lastIndex;

            var matchScriptEnd = r.script_end.exec(data);

            if (matchScriptEnd === null) {
                break;
            }

            var skipTag = false;

            if ((matchType = matchScript[1].match(r.script_type)) !== null) {
                if (matchType[1] == 'text/html' || matchType[1] == 'text/template') {
                    skipTag = true;
                }
            }

            if (skipTag) {
                textIndexes.push([lastIndex, r.script_end.lastIndex - lastIndex]);
            } else {
                textIndexes.push([lastIndex, matchScript.index - lastIndex]);

                var runFirst = this.param.scriptsRunFirst || (matchScript[1].indexOf('bxrunfirst') != '-1');

                if ((matchSrc = matchScript[1].match(r.script_src)) !== null) {
                    if (!this.isEmptySource(allDocScript, matchSrc[1].substr(0, matchSrc[1].lastIndexOf('.js') + 3))) {
                        scripts.push({"runFirst": runFirst, "isInternal": false, "JS": matchSrc[1]});
                    }
                } else {
                    var start = matchScript.index + matchScript[0].length,
                        start2 = matchScript.index;
                    data.substr(start2, (matchScriptEnd.index - start2) + 9);
                    var js = data.substr(start, matchScriptEnd.index - start);

                    if (!this.isEmptySource(aDocScriptLine, js, 'js-line')) {
                        scripts.push({"runFirst": runFirst, "isInternal": true, "JS": js});
                    }
                }
            }

            lastIndex = matchScriptEnd.index + 9;
            r.script.lastIndex = lastIndex;
        }

        textIndexes.push([lastIndex, lastIndex === 0 ? data.length : data.length - lastIndex]);
        var pureData = "";

        for (var i = 0, length = textIndexes.length; i < length; i++) {
            if (this.isString(data) && this.isFunction(data.substr)) {
                pureData += data.substr(textIndexes[i][0], textIndexes[i][1]);
            }
        }

        while ((matchStyle = pureData.match(r.style)) !== null) {
            if ((matchHref = matchStyle[0].match(r.style_href)) !== null && matchStyle[0].indexOf('media="') < 0) {
                if (!this.isEmptySource(allDocCSS, matchHref[1].substr(0, matchHref[1].lastIndexOf('.css') + 4), 'css')) {
                    styles.push(matchHref[1]);
                }

            }

            pureData = pureData.replace(matchStyle[0], '');
        }

        //pureData = pureData.replace(/\r?\n/g, "");

        return {'HTML': pureData, 'SCRIPT': scripts, 'STYLE': styles};
    }

    this.isInternalScript = function (script) {
        var num = 0;
        for (var k = 0; k < script.length; k++) {
            if (!script[k].isInternal) {
                num++;
            }
        }
        return num;
    }


    this.loadJSDoc = (script) => {
        for (let k = 0; k < script.length; k++) {
            const hash = stableHash(script[k].JS.trim()).substring(0, 16);

            if (SF.Loader.phpScriptsLoaded.indexOf(hash) !== -1) {
                continue;
            }
            if (script[k].isInternal) {
                const sDoc = document.createElement('script');
                sDoc.onerror = function (e) {
                    console.warn('Script failed to load:', e);
                };
                sDoc.type = 'text/javascript';
                sDoc.setAttribute('modalInlineScript', _this.param.url);
                sDoc.text = script[k].JS;
                document.head.append(sDoc);
            }
        }
    }

    this.loadJS = function (script) {
        this.lengthJS = this.isInternalScript(script);
        let arr = [];
        for (var k = 0; k < script.length; k++) {
            const hash = stableHash(script[k].JS).substring(0, 16);

            if (SF.Loader.phpScriptsLoaded.indexOf(hash) !== -1) {
                _this.lengthJS--;
                continue;
            }
            if (!script[k].isInternal) {
                let s = document.createElement('script');

                s.src = script[k].JS;
                s.setAttribute('modal-script', _this.param.url);
                s.onerror = function (e) {
                    console.warn('Script failed to load:', e);
                };
                s.async = true;
                arr.push(new Promise(resolve => {
                    s.addEventListener('load', () => {
                        _this.lengthJS--;
                        resolve();
                    });
                }))

                document.head.append(s);
            }
        }
        return arr;
    }

    this.loadCSS = function (css) {
        this.lengthCSS = css.length ? css.length : 0;
        let arr = [];
        for (let k = 0; k < css.length; k++) {
            const hash = stableHash(css[k]).substring(0, 16);

            if (SF.Loader.phpScriptsLoaded.indexOf(hash) !== -1) {
                _this.lengthCSS--;
                continue;
            }
            let c = document.createElement('link');
            c.href = css[k];
            c.rel = 'stylesheet';
            c.type = 'text/css';
            arr.push(new Promise(resolve => {
                c.addEventListener('load', () => {
                    _this.lengthCSS--;
                    resolve();
                });
            }))
            document.head.append(c);
        }
        return arr;
    }

    this.emulateOnLoad = function (DATA) {
        if (this.param.emulateOnload) {
            SF.receive('SFAjaxLoadedResouce', window, function () {
                if (_this.lengthCSS <= 0 && _this.lengthJS <= 0) {
                    _this.loadJSDoc(DATA.SCRIPT);
                    SF.send('DOMContentLoaded', window);
                    SF.send('load', window);
                }
            });
            if (this.lengthCSS <= 0 && this.lengthJS <= 0) {
                this.loadJSDoc(DATA.SCRIPT);
                SF.send('DOMContentLoaded', window);
                SF.send('load', window);
            }
        }
    }

    this.body = function () {
        let data;
        this.param.body.sfLoaded = {
            'frameworks': window.loadedFrameworks,
            'assets': window.loadedSfAssets
        }
        if (this.param.dataType == 'json') {
            data = JSON.stringify(this.param.body);
        } else {
            data = new FormData();
            for (var key in this.param.body) {
                data.append(key, this.param.body[key]);
            }
        }
        return data;
    }

    this.promise = function () {
        const request = {
            method: this.param.method,
            mode: this.param.mode,
            cache: this.param.cache,
            headers: this.param.headers,
            redirect: this.param.redirect,
            referrerPolicy: this.param.referrerPolicy
        };

        if (this.param.method !== 'GET') {
            request.body = this.body();
        }

        this.controller = new AbortController();
        request.signal = this.controller.signal;

        fetch(this.param.url, request).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            if (_this.param.dataType === 'json') {
                return response.json();
            } else {
                return response.text();
            }
        }).then(function (data) {
            if (_this.param.dataType === 'json') {
                callback(data);
            } else {
                var DATA = _this.processHTML(data);
                _this.loadCSS(DATA.STYLE);
                callback(DATA.HTML);
                _this.loadJS(DATA.SCRIPT);
                _this.emulateOnLoad(DATA);
            }
        }).catch(function (error) {
            if (error && error.name !== 'AbortError') {
                console.warn('SF.Ajax promise failed:', error);
            }
        }).finally(function () {
            calbackAfter();
            _this.controller = null;
        });
    }

    this.async = async function () {
        let paramFetch = {
            method: this.param.method,
            mode: this.param.mode,
            cache: this.param.cache,
            headers: this.param.headers,
            redirect: this.param.redirect,
            referrerPolicy: this.param.referrerPolicy,
        };

        if (this.param.method !== 'GET') {
            paramFetch.body = this.body()
        }
        this.controller = new AbortController();
        paramFetch.signal = this.controller.signal;

        try {
            var response = await fetch(this.param.url, paramFetch);
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            let data, DATA;
            if (this.param.dataType === 'json') {
                data = await response.json();
                callback(data);
            } else {
                data = await response.text(),
                    DATA = this.processHTML(data);
                let resolver = [...this.loadCSS(DATA.STYLE), ...this.loadJS(DATA.SCRIPT)];
                Promise.all(resolver).then(() => {
                    callback(DATA.HTML);
                    this.emulateOnLoad(DATA);
                    this.filterHash(DATA);
                })
            }
        } catch (error) {
            if (error && error.name !== 'AbortError') {
                console.warn('SF.Ajax async failed:', error);
            }
        } finally {
            calbackAfter();
            this.controller = null;
        }
    }

    this.abort = function () {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
    }

    this.filterHash = (items) => {
        Object.keys(items).forEach(key => {
            if (['SCRIPT', 'STYLE'].indexOf(key) !== -1) {
                items[key].length && items[key].forEach(item => {
                    const content = key === 'SCRIPT' ? item.JS : item;
                    const hash = stableHash(content).substring(0, 16);
                    if (SF.Loader.phpScriptsLoaded.indexOf(hash) === -1) {
                        SF.Loader.phpScriptsLoaded.push(hash)
                    }
                })
            }
        })
    }

    this.param = {
        url: false,
        method: 'GET',            // *GET, POST, PUT, DELETE, etc.
        mode: 'same-origin',           // no-cors, *cors, same-origin
        cache: 'no-cache',       // *default, no-cache, reload, force-cache, only-if-cached
        redirect: 'follow',         // manual, *follow, error
        referrerPolicy: 'no-referrer',    // no-referrer, *client
        body: {},
        dataType: 'html', // type of data loading: xml, json, script, or html
        async: true, // whether request is asynchronous or not
        scriptsRunFirst: true, // whether to run _all_ found scripts before onsuccess call. script tag can have an attribute "bxrunfirst" to turn  this flag on only for itself
        emulateOnload: true,
        headers: {
            //'Content-Type': 'text/plain;charset=utf-8',
            //'Content-Type'  : 'text/html;charset=utf-8',
            //'Content-Type': 'application/json;charset=utf-8',
        },
        //timeout: 0, // request timeout in seconds. 0 for browser-default
        //processData     : true, // any data processing is disabled if false, only callback call
        //skipAuthCheck: false, // whether to check authorization failure (SHOUD be set to true for CORS requests)
        //start: true, // send request immediately (if false, request can be started manually via XMLHttpRequest object returned)
        //----cache: true, // whether NOT to add random addition to URL
        //preparePost: true, // whether set Content-Type x-www-form-urlencoded in POST
        //----headers: false, // add additional headers, example: [{'name': 'If-Modified-Since', 'value': 'Wed, 15 Aug 2012 08:59:08 GMT'}, {'name': 'If-None-Match', 'value': '0'}]
        //lsTimeout: 30, //local storage data TTL. useless without lsId.
        //lsForce: false, //wheter to force query instead of using localStorage data. useless without lsId.
    }

    var _this = this;
    this.lengthJS = 0;
    this.lengthCSS = 0;

    this.updateparam(param);
    if (this.param.dataType === 'json') this.param.headers['Content-Type'] = 'application/json';
    if (this.param.async) this.async(); else this.promise();
}

SF.Ajax = Ajax;
Ajax.componentName = 'SF.Ajax';

registerComponent('SF.Ajax', Ajax)
