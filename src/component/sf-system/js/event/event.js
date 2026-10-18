export async function send (event, element) {
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

SF.__internal.send = send

export function receive (event, el, handler) {
    if (window.addEventListener) { el.addEventListener(event, handler, false) } else if (window.attachEvent) { el.attachEvent(event, handler) }
}

SF.__internal.receive = receive
