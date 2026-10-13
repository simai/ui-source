SF.Controller = function() {
    // Constructor

        this.stack = SF.Controller.Stack;
        var _this = this;

        // Подключение модулей
        SF.Events.call(this);
        SF.Search.call(this);
        SF.Blocks.call(this);
        SF.Provider.call(this);
        //SF.Property.call(this);

        if(this.el) {
            this.send('blocksstart', this.el);
        } else {
            
            if(this.stack.ev('specialinit')) {

                this.receive('specialinit', window, function(e) {
                    new SF.Special(e.target, e.target.params);
                });
                this.stack.events.push('specialinit');
            }

            if(this.stack.ev('searchend')) {
                this.receive('searchend', window, function(e) {
                    _this.send('blocksstart', e.target);
                });
                this.send('searchstart', window);
                this.stack.events.push('searchend');

            }
        }

    // end Constructor    
}