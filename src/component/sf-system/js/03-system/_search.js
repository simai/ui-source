/**
 * Search модуль поиска инициализаций т.е. поиска элементов вызывающих определенные блоки/компоненты
 */
SF.Search = function() {

    // this.stack = SF.Controller.Stack;
    // SF.Events.call(this);
    /**
     * Search uninitialized Modal Window
     * Поиск неинициализированных модальных окон
     */
    this.search = function() {
        var el = document.body.querySelectorAll('*');   // Поиск всех элементов в DOM-дереве
        for(var j = 0; j < el.length; j++) {    // Обход найденых элементов
            var par = new SF.Parameters();
            var params = par.newparams();         // Новые параметры
            for(var key in params.blocks) {    // Проверка
                var init = el[j],
                    block = params.blocks[key];
                if(init.hasAttribute(block.data.init)) {    // Проверяем есть ли у элемента инициализация блока
                    var i = 0;
                    for(var k = 0; k < this.stack.el.length; k++)   // Проверяем был ли инициализированн текущий элемен ранее
                        if(this.stack.el[k] == init) i++;
                    if(i == 0) {
                        init.blocks = key;          // Записываем наименование блока
                        init.params = block;  // Присваиваем инициализатору список стандратных параметров
                        par.updateparams(init);
                        this.send('searchend', init); // Отправка сигнала (события) на элемент для дальнейшего построения
                    }
                }
            }
        }
    }

    /*
        this.searchModal = function(element) {
            var el = element.querySelectorAll('[sf-modal]');   // Поиск всех элементов в DOM-дереве
            for(var j = 0; j < el.length; j++) {    // Обход найденых элементов
                var par = new SF.Parameters();
                var params = par.newparams();         // Новые параметры
                for(var key in params.blocks) {    // Проверка
                    var init = el[j],
                        block = params.blocks[key];
                    if(init.hasAttribute(block.data.init)) {    // Проверяем есть ли у элемента инициализация блока
                        var i = 0;
                        for(var k = 0; k < this.stack.el.length; k++)   // Проверяем был ли инициализированн текущий элемен ранее
                            if(this.stack.el[k] == init) i++;
                        if(i == 0) {
                            init.blocks = key;          // Записываем наименование блока
                            init.params = block;  // Присваиваем инициализатору список стандратных параметров
                            par.updateparams(init);
                            this.send('searchend', init); // Отправка сигнала (события) на элемент для дальнейшего построения
                        }
                    }
                }
            }
        }
    */


    this.searchdata = function(content) {
        var el = content.querySelectorAll('*');   // Поиск всех элементов в DOM-дереве
        for(var j = 0; j < el.length; j++) {    // Обход найденых элементов
            var par = new SF.Parameters();
            var params = par.newparams();         // Новые параметры
            for(var key in params.blocks) {    // Проверка
                var init = el[j],
                    block = params.blocks[key];
                if(init.hasAttribute(block.data.init)) {    // Проверяем есть ли у элемента инициализация блока
                    var i = 0;
                    for(var k = 0; k < this.stack.el.length; k++)   // Проверяем был ли инициализированн текущий элемен ранее
                        if(this.stack.el[k] == init) i++;
                    if(i == 0) {
                        init.blocks = key;          // Записываем наименование блока
                        init.params = block;  // Присваиваем инициализатору список стандратных параметров
                        par.updateparams(init);
                        this.send('searchend', init); // Отправка сигнала (события) на элемент для дальнейшего построения
                    }
                }
            }
        }
    }

    // ================ CONSTRUCTOR ================ //
        var _this = this;
        // The module is normally mixed into a Controller, which owns the stack
        // and the event helpers. The loader also constructs it on its own once
        // the page is ready, and then there is no owner: borrow the shared
        // stack, and stay quiet if even that is missing. Throwing here stopped
        // the whole boot, so every component after it stayed uninitialised.
        if(!this.stack && SF.Controller) this.stack = SF.Controller.Stack;
        if(this.stack && typeof this.receive === 'function' && this.stack.ev('searchstart')) {
            this.receive('searchstart', window, function() {
                _this.search();
            });
            /*
                this.receive('searchstartmodal', window, function(e) {
                    _this.searchModal(document);
                });
            */
            this.stack.events.push('searchstart');
        }
    // ================ END CONSTRUCTOR ================ //
}
