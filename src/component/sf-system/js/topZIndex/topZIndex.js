export function topZIndex () {
    let maxZ = 0;
    document.querySelectorAll('body *').forEach(el => {
        const z = Number(window.getComputedStyle(el).zIndex);
        if (!isNaN(z)) {
            maxZ = Math.max(maxZ, Number(z));
        }
    });
    return maxZ;
}

SF.topZIndex = topZIndex
