export function setLoaderDragState(value) {
    if (typeof SF === "undefined" || !SF.Loader) return;

    const loader = SF.Loader;
    const currentCount = Number(loader.dragObserverLockCount || 0);

    loader.dragObserverLockCount = value
        ? currentCount + 1
        : Math.max(currentCount - 1, 0);
    loader.stopObserver = loader.dragObserverLockCount > 0;
}
