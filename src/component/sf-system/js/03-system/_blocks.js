/**
 * Blocks - модуль распределения обязанностей
 */
SF.Blocks = function() {
    var _this = this;

    if(this.stack.ev('providerend')) {
        this.receive('providerend', window, function(e) {
            _this.send(e.target.event, e.target);
        });
        this.stack.events.push('providerend');
    }

    if(this.stack.ev('blocksstart')) {
        this.receive('blocksstart', window, function(e) {
            _this.send('providerstart', e.target);
        });
        this.stack.events.push('blocksstart')
    }

    
}