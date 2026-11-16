import { ariaKeyShortcuts, parseShortcut } from '../../kbd/js/shortcut.js';

// A tooltip that shows its trigger's shortcut (sf-tooltip shortcut="mod+b")
// says it on the trigger too: aria-keyshortcuts in the WAI-ARIA words of this
// platform (Meta+B on an Apple platform, Control+B elsewhere), as sf-button
// and sf-input do for their own shortcut. The keys in the tooltip are only
// seen; a screen reader hears the trigger. A trigger that names its own
// aria-keyshortcuts keeps it; what was written here is taken back when the
// shortcut goes. The value written is kept on the trigger under a shared
// symbol, so every bundle's copy of this file reads the same memory.
const WRITTEN = Symbol.for('simai.sf.tooltip.keyShortcuts');

/** The shortcut a tooltip surface shows: sf-tooltip's shortcut setting. */
export function surfaceShortcut(surface) {
  if (!surface?.getAttribute) return '';
  const tooltip = surface.localName === 'sf-tooltip' ? surface : surface.closest?.('sf-tooltip');
  return String(tooltip?.getAttribute('shortcut') ?? '').trim();
}

/** Writes (or takes back) the trigger's aria-keyshortcuts for a shortcut. */
export function writeTriggerKeyShortcuts(trigger, shortcut) {
  if (!trigger?.setAttribute) return;
  const written = trigger[WRITTEN];
  const current = trigger.getAttribute('aria-keyshortcuts');
  // The page's own value wins.
  if (current !== null && current !== written) return;
  const next = shortcut ? ariaKeyShortcuts(parseShortcut(shortcut)) : '';
  if (next) {
    if (current !== next) trigger.setAttribute('aria-keyshortcuts', next);
    trigger[WRITTEN] = next;
    return;
  }
  if (written !== undefined) {
    if (current === written) trigger.removeAttribute('aria-keyshortcuts');
    delete trigger[WRITTEN];
  }
}
