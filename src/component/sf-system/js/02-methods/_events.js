SF.__internal.send = async function (event, element) {
    return new Promise(resolve => {
        let e;
        if (document.createEvent) {
             e = new Event(event, {
                bubbles: true,
                cancelable: false
            })
        } else if (document.createEventObject()) {
             e = document.createEventObject()
        } else {
            resolve(true)
            return
        }

        if (element.dispatchEvent) {
            element.dispatchEvent(e)
        } else if (element.fireEvent) element.fireEvent(event, e)
        resolve(true)
    })
}

/* ============================= */
SF.Events = function () {
    /**
     * Метод send() - Отправляет событие
     * @param {*} event
     */
    this.send = function (event, element) {
        let e;
        if (document.createEvent) {
             e = document.createEvent('Events')
            e.initEvent(event, true, false)
        } else if (document.createEventObject()) {
             e = document.createEventObject()
        } else return

        if (element.dispatchEvent) { element.dispatchEvent(e) } else if (element.fireEvent) element.fireEvent(event, e)
    }

    /**
     * Метод receive() - регистрирует обработчик события
     * @param {*} event
     * @param {*} handler
     */
    this.receive = function (event, el, handler) {
        if (window.addEventListener) { el.addEventListener(event, handler, false) } else if (window.attachEvent) { el.attachEvent(event, handler) }
    }

    /**
     * hotkey() - функция обработки нажатия нескольких клавиш и выполнения фукций обработчика
     * @param {*} handler - функтция обработчик события нажатия клавиш
     * @param {*} далее может следовать любое количество кодов сочетания клавиш в
     * кавычках ("17")
     */
    this.hotkey = function (handler) {
        const codes = [].slice.call(arguments, 1)
        let pressed = {}
        document.addEventListener('keydown', function (e) {
            e = e || window.event
            pressed[e.keyCode] = true
            for (let i = 0; i < codes.length; i++) { if (!pressed[codes[i]]) return }
            pressed = {}
            handler()
        })
        document.addEventListener('keyup', function (e) {
            e = e || window.event
            delete pressed[e.keyCode]
        })
    }

    /**
     * quickkey() - функция обработки нажатия клавиши и выполнения функции обработчика
     * @param {*} handler - функция обработчик события нажатия клавиши
     * @param {*} key - клавиша после нажатия которой срабатывает функция обрботчик
     */
    this.quickkey = function (handler, key) {
        addEventListener('keydown', function (e) {
            if (e.keyCode == key) { handler(e) }
        })
    }

    SF.Methods.call(this)
}
