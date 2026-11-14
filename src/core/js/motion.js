// Whether to keep things still: the device asks for less motion
// (prefers-reduced-motion: reduce), or the person stopped motion on this site
// (<html data-sf-motion="reduce">, written by the sf-display-settings panel
// through SF.displaySettings; owner decision C196, 2026-11-15). Core's own
// scripts read this one function; the core sheet stops CSS animations and
// transitions under the same mark (core/scss/_sf_css__display.scss).
//
// No state and no side effect, so every bundle may carry it.

export const MOTION_ATTRIBUTE = 'data-sf-motion';
export const MOTION_CHANGE = 'sf-display-change';

export function reducedMotion(root = globalThis.document?.documentElement, win = globalThis) {
  try {
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {
    // No media queries here: only the page's own mark.
  }
  return root?.getAttribute?.(MOTION_ATTRIBUTE) === 'reduce';
}

// Calls `listener` when either source changes; returns the stop.
export function watchMotion(listener, win = globalThis) {
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  const doc = win.document;
  media?.addEventListener?.('change', listener);
  doc?.addEventListener?.(MOTION_CHANGE, listener);
  return () => {
    media?.removeEventListener?.('change', listener);
    doc?.removeEventListener?.(MOTION_CHANGE, listener);
  };
}
