/*============================= */

SF.Methods = function() {

    /**
     * extend() -
     * @param {*} defaults
     * @param {*} options
     */
    this.extend = function(defaults, options) {
        for(var key in options)
            if(Object.prototype.hasOwnProperty.call(options, key))
                if(Object.prototype.toString.call(options[key]) == '[object Object]')
                    this.extend(defaults[key], options[key]);
                else defaults[key] = options[key];
        return defaults;
    }

    /**
     * Поиск наивысшего z-index в документе
     */
    this.topZIndex = function() {
        var e = document.querySelectorAll('*'),
            z = 1,
            style = '';
        for(var k = 0; k < e.length; k++) {
            style = getComputedStyle(e[k]);
            if(parseInt(style.zIndex) > z)
                z = parseInt(style.zIndex);
        }
        return z;
    }

    this.topZIndexElement = function(el) {
        var z = 1,
            e = false,
            style = '';
        for(var k = 0; k < el.length; k++) {
            style = getComputedStyle(el[k]);
            if(parseInt(style.zIndex) > z) {
                z = parseInt(style.zIndex);
                e = el[k];
            }
        }
        return e;
    }

    /**
     *
     */
    this.includeScript = function(path) {
        var s = document.createElement('script');
        s.src = path;
        document.querySelector('head').appendChild(s);
    }

    this.addcss = function(path) {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = path;
        document.querySelector('head').appendChild(l);
        return l;
    }

    /**
     *
     */
    this.cookies = {
        /**
         * get() - получить куки
         */
        get: function(name) {
            if(document.cookie.length > 0) {
                var start = document.cookie.indexOf(name + '=');
                if(start != -1) {
                    start = start + name.length + 1;
                    var end = document.cookie.indexOf(';', start);
                    if(end == -1) end = document.cookie.length;
                    return encodeURI(document.cookie.substring(start, end));
                }
            }
            return '';
        },
        /**
         * set() - установить куки
         */
        set: function(name, value, expiredays) {
            var exdate = new Date();
            exdate.setDate(exdate.getDate() + expiredays);
            document.cookie = name + '=' + decodeURI(value) +
                ((expiredays == null) ? '' : '; expires=' + exdate.toUTCString()) + '; path=/';
        },
        /**
         * check() - Проверка установлен ли параметр куки
         */
        check: function(name) {
            name = this.cookie.get(name);
            if(name != null && name != '') return true;
            else return false;
        }
    }


    this.bytelength = function(str) {
        var count = 0,
            ch = 0;
        for(var k = 0; k < str.length; k++) {
            ch = str.charCodeAt(k);
            if(ch <= 127) count++;
            else if(ch <= 2047) count += 2;
            else if(ch <= 65535) count += 3;
            else if(ch <= 2097151) count += 4;
            else if(ch <= 67108863) count += 5;
            else count += 6;
        }
        return count;
    }

    this.bytelengthlimit = function(str, limit) {
        var count = 0,
            ch = 0,
            strlimit = '',
            flaglimit = false,
            result = [];
        for(var k = 0; k < str.length; k++) {
            ch = str.charCodeAt(k);
            if(count <= limit) {
                flaglimit = true;
            }
            strlimit += str[k];
            if(ch <= 127) count++;
            else if(ch <= 2047) count += 2;
            else if(ch <= 65535) count += 3;
            else if(ch <= 2097151) count += 4;
            else if(ch <= 67108863) count += 5;
            else count += 6;

            if((count > limit && flaglimit) || (flaglimit && k == str.length - 1)) {
                //console.log(strlimit)
                result.push(strlimit);
                strlimit = '';
                count = 0;
                flaglimit = false;
            }
        }
        //console.log(result.length)
        if(result.length > 0) {
            //result.push(strlimit);
            return result;
        } else {
            result.push(strlimit);
            return result;
        }
    }
}
