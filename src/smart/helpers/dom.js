export function getElementRowGap(element) {
    return parseFloat(getComputedStyle(element).rowGap) || 0;
}

export function setParentSpace(items) {
    const firstRef = items.values().next().value;
    const firstValue = firstRef?.value;
    if (!firstValue) return;

    const parent = firstValue.parentNode;
    if (!parent) return;

    return {
        gap: getElementRowGap(parent),
        item: firstValue,
        parent: parent
    };
}

export function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}

export function getParent(item) {
    let current = item;

    while (current) {
        if (current.nodeName.toLowerCase().startsWith('sf-')) {
            return current.parentNode;
        }

        current = current.parentNode;
    }

    return null;
}
