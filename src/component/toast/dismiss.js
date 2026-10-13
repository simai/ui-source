function finiteAnimations(element) {
  if (!element || typeof element.getAnimations !== 'function') return [];
  return element.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getTiming?.().duration));
}

function dismissToastElement(toast, removalTarget = toast) {
  if (!(toast instanceof HTMLElement) || !(removalTarget instanceof Element)) return false;

  const remove = () => {
    if (removalTarget.isConnected) removalTarget.remove();
  };

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    remove();
    return true;
  }

  // Commit the initial frame before applying the exit state.
  void toast.offsetWidth;
  toast.classList.add('closing');
  const animations = finiteAnimations(toast);

  if (!animations.length) {
    remove();
    return true;
  }

  Promise.allSettled(animations.map((animation) => animation.finished)).then(remove);
  return true;
}

export { dismissToastElement };
