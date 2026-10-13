    /**
     * quickkey() - функция обработки нажатия клавиши и выполнения функции обработчика
     * @param {*} handler - функция обработчик события нажатия клавиши 
     * @param {*} key - клавиша после нажатия которой срабатывает функция обрботчик
     */
     export function quickkey(handler, key) {
        addEventListener('keydown', function(e) {
            if(e.code == key)
                handler(e);
        });
    }

    SF.quickkey = quickkey;