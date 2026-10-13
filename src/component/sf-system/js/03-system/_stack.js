SF.Controller.Stack = {
    el: [],
    events: [],
    log: [],
}

window.stack = SF.Controller.stack;

SF.Controller.Stack.extend = function(def, options) {
    var i = 0;
    for(var key in options) {
        if(def.length > 0)
            for(var k = 0; k < def.length; k++)
                if(def[k] == options[key]) i++;
        if(i == 0) def.push(options[key]);
        i = 0;
    }
    return def;
}


SF.Controller.Stack.addevents = function(events) {
    var e = this.stack.events,
        i = 0;
    for(var k = 0; k < e.length; k++)
       if(e[k] == events) i++;
    if(i == 0) e.push(events);
}

SF.Controller.Stack.ev = function(ev) {
    var e = this.events,
        i = 0;
    for(var k = 0; k < e.length; k++)
        if(e[k] == ev) i++;
    if(i === 0) return true;
    else return false;
}