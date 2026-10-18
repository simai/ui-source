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

        if (element.dispatchEvent) { element.dispatchEvent(e) } else if (element.fireEvent) element.fireEvent(event, e)
        resolve(true)
    })
}

SF.__internal.send = send
