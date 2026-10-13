export function receive(event, el, handler) {
    if(window.addEventListener)
        el.addEventListener(event, handler, false);
    else if(window.attachEvent)
        el.attachEvent(event, handler);
}

SF.receive = receive;