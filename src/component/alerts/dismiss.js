export function dismissAlertElement(alert, removalTarget = alert) {
  if (!alert?.isConnected || !removalTarget?.isConnected) {
    return Promise.resolve(removalTarget);
  }

  const remove = () => {
    if (removalTarget.isConnected) {
      removalTarget.remove();
    }
    return removalTarget;
  };

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || typeof alert.getAnimations !== 'function') {
    return Promise.resolve(remove());
  }

  // Commit the resting style before switching to the token-driven exit state.
  window.getComputedStyle(alert).opacity;
  alert.classList.add('closing');

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const animations = alert.getAnimations().filter(animation => {
        const timing = animation.effect?.getComputedTiming?.();
        return timing && timing.iterations !== Infinity;
      });

      if (animations.length === 0) {
        resolve(remove());
        return;
      }

      Promise.allSettled(animations.map(animation => animation.finished))
        .then(() => resolve(remove()));
    });
  });
}
