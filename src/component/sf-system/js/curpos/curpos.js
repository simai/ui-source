/**
 * Определение поциции текущего элемента
 * @param {*} e - элемент
 * @param {*} relative - проверять на position:relative
 */

export default function curpos(e, relative = false) {
    if(!e) {
        return (new DOMRect()).toJSON();
    }

    if(e.ownerDocument === document && !relative) {
        const clientRect = e.getBoundingClientRect();
        const root = document.documentElement;
        const {body} = document;

        return {
            top     : Math.round(clientRect.top + (root.scrollTop || body.scrollTop)),
            left    : Math.round(clientRect.left + (root.scrollLeft || body.scrollLeft)),
            width   : Math.round(e.offsetWidth),//clientRect.right - clientRect.left),
            height  : Math.round(e.offsetHeight),//clientRect.bottom - clientRect.top),
            right   : Math.round(clientRect.right + (root.scrollLeft || body.scrollLeft)),
            bottom  : Math.round(clientRect.bottom + (root.scrollTop || body.scrollTop)),
        };
    }

    let x  = 0;
    let y = 0;
    const w = e.offsetWidth;
    const h = e.offsetHeight;
    let first = true;

    for(; e != null; e = e.offsetParent) {
        if(!first && relative && (getComputedStyle(e).position == 'relative')) {
            break;
        }
        x += e.offsetLeft;
        y += e.offsetTop;

        if(first) {
            first = false;
            continue;
        }

        x += Text.toNumber(Dom.style(e, 'border-left-width'));
        y += Text.toNumber(Dom.style(e, 'border-top-width'));
    }

    return (new DOMRect(x, y, w, h)).toJSON();
}

SF.curpos = curpos;
