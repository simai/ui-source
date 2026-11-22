// The name tooltip of the class icon button (owner decision C248,
// 2026-11-16; C160 (1), C224, C48): a .sf-icon-button the page wrote with an
// aria-label and no visible label shows that name as the Framework's tooltip
// by itself, as <sf-button-icon> does -- the same 0.5 s, the neighbours at
// once, keyboard focus at once, a long press on a touch screen, the flip at
// the edge (component.tooltip). It showed nothing: a page wrote fourteen
// lines of sf-tooltip-anchor + data-tooltip, or the browser's title.
//
// Nothing is drawn or fetched before the first hover, keyboard focus or long
// press on such a button, so the first paint is unchanged: then the tooltip
// surface (the tooltip composition, a .sf-tooltip the button names by
// data-tooltip) is made beside the button, the tooltip controller is asked
// for (the Loader's lazy plugin), and the event that woke it is handed over
// once the controller has linked the button.
//
// Left alone: data-tooltip="off" (the page's opt-out) and any data-tooltip of
// the page's own (its own link is stronger); a button with a title, its own
// or a host's around it (the page chose the browser's tooltip, or a component
// wrote its hint there -- the plain theme button, C244; drop the title for
// the Framework's): never a second tooltip; a button
// with visible words; a close button (sf-button-close, C14: it carries no
// name tooltip, as the Smart one does not); a button inside <sf-button-icon>,
// which shows its own; a disabled or hidden one.

const NAME_TIP = 'sf-icon-button-tooltip';
// What draws a glyph, not words: the icon (a ligature is text), the cross,
// an SVG, the loading spinner.
const GLYPHS = '.sf-icon, sf-icon, i, svg, .sf-close, sf-button-close, .sf-icon-button-spinner, [class*="sf-loader"]';
const SKIP_HOSTS = 'sf-button-icon, sf-icon-button, .sf-tooltip-anchor, [aria-hidden="true"], [inert]';

// A title on the button or on a host around it (the theme button writes its
// next-theme hint there, C244) is a tooltip of the page's own: the browser
// would draw it beside ours, so the button is left alone.
function hasTitle(button) {
  for (let node = button; node && node.nodeType === 1; node = node.parentElement) {
    if ((node.getAttribute('title') || '').trim()) return true;
  }
  return false;
}
// The surfaces' numbers are counted on the page, not in this file, and under
// a name of their own: every bundle that carries this file has its own copy
// of it (sf-button since C370, the icon buttons), and <sf-button-icon>
// numbers its own tooltips «sf-icon-button-tooltip-N» from 1 too; two
// counters from 1 made a second «sf-icon-button-tooltip-1», and the language
// glyph in the docs header showed the shrunk search's «Поиск ⌘K».
const MADE = Symbol.for('sf.icon-button.name-tooltip.made');
function nextTipId(doc) {
  let id = '';
  do {
    globalThis[MADE] = (globalThis[MADE] || 0) + 1;
    id = `sf-name-tooltip-${globalThis[MADE]}`;
  } while (doc.getElementById(id));
  return id;
}

function tooltipController() {
  return globalThis.SF?.ComponentRegistry?.Tooltip || globalThis.SF?.Loader?.ComponentRegistry?.Tooltip || null;
}

// The controller is there: run now; else ask the Loader for it (a lazy
// plugin) and run once it registered -- as <sf-button-icon> does.
function whenTooltipReady(run) {
  if (tooltipController()) {
    run();
    return;
  }
  const loader = globalThis.SF?.Loader;
  loader?.ensurePlugin?.('tooltip');
  if (typeof loader?.ready === 'function') loader.ready('Tooltip', () => run());
  else globalThis.addEventListener?.('Tooltip:ready', () => run(), {once: true});
}

// Whether the button shows words of its own beside (or instead of) its icon.
function hasVisibleLabel(button) {
  const walker = button.ownerDocument.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.data.trim()) continue;
    if (node.parentElement?.closest(GLYPHS)) continue;
    return true;
  }
  return false;
}

function nameOf(button) {
  return String(button.getAttribute('data-sf-shrink-tip') || button.getAttribute('aria-label') || '').replace(/\s+/gu, ' ').trim();
}

// An sf-button drawn as its glyph by its bar (shrink="icon", data-shrunk;
// owner decision C370): its words are hidden, so it shows its text and keys
// as this tooltip, «Поиск ⌘K» (data-sf-shrink-tip), as an icon button shows
// its name. Whole again, it shows none.
const SHRUNK = 'sf-button[shrink="icon"][data-shrunk="true"] > .sf-button[data-sf-shrink-tip]';

// A control a component draws with no words of its own and marks with
// data-sf-name-tip (a role=button part, not an .sf-icon-button: the phone
// field's country flag, sf-input-country, FS-11) shows its name the same way.
const MARKED = '[data-sf-name-tip]';

// The button a name tooltip is for, or null.
function nameTarget(node) {
  const marked = node instanceof Element ? node.closest(MARKED) : null;
  if (marked) {
    if (!nameOf(marked) || marked.hasAttribute('data-tooltip') || hasTitle(marked)) return null;
    if (marked.matches(':disabled, [aria-disabled="true"]') || marked.closest('[aria-hidden="true"], [inert]')) return null;
    return marked;
  }
  const shrunk = node instanceof Element ? node.closest(SHRUNK) : null;
  if (shrunk) {
    if (shrunk.hasAttribute('data-tooltip') || hasTitle(shrunk) || shrunk.matches(':disabled, [aria-disabled="true"]')) return null;
    return nameOf(shrunk) ? shrunk : null;
  }
  const button = node instanceof Element ? node.closest('.sf-icon-button') : null;
  if (!button || !nameOf(button)) return null;
  if (!(button.localName === 'button' || (button.localName === 'a' && button.hasAttribute('href')) || button.getAttribute('role') === 'button')) return null;
  if (button.hasAttribute('data-tooltip') || hasTitle(button)) return null;
  if (button.matches('.sf-button-close, .sf-icon-button--close, :disabled, [aria-disabled="true"]')) return null;
  if (button.parentElement?.closest(SKIP_HOSTS) || button.matches(SKIP_HOSTS)) return null;
  if (hasVisibleLabel(button)) return null;
  return button;
}

// A tooltip this file made keeps the button's name: an aria-label changed
// later (a toggle's «Показать» / «Скрыть») is said on the next hover.
function syncMadeTip(button) {
  const id = button?.getAttribute?.('data-tooltip');
  if (!id) return;
  const tip = button.ownerDocument.getElementById(id);
  if (!tip?.classList.contains(NAME_TIP)) return;
  const text = tip.querySelector('.sf-tooltip-text');
  const name = nameOf(button);
  if (text && name && text.textContent !== name) text.textContent = name;
}

function wake(event) {
  const origin = event.target;
  if (origin instanceof Element) syncMadeTip(origin.closest(`.sf-icon-button[data-tooltip], .sf-button[data-sf-shrink-tip][data-tooltip], ${MARKED}[data-tooltip]`));
  if (event.type === 'pointerdown' && event.pointerType !== 'touch') return;
  if (event.type === 'pointerover' && event.pointerType === 'touch') return;
  const button = nameTarget(origin);
  if (!button) return;
  if (event.type === 'focusin') {
    let shown = true;
    try { shown = button.matches(':focus-visible'); } catch { shown = true; }
    if (!shown) return;
  }
  const doc = button.ownerDocument;
  const tip = doc.createElement('span');
  tip.className = `sf-tooltip sf-tooltip--dark ${NAME_TIP}`;
  tip.id = button.id ? `${button.id}--tooltip` : nextTipId(doc);
  tip.hidden = true;
  const content = doc.createElement('span');
  content.className = 'sf-tooltip-content';
  const text = doc.createElement('span');
  text.className = 'sf-tooltip-text';
  text.textContent = nameOf(button);
  content.append(text);
  tip.append(content);
  button.after(tip);
  button.setAttribute('data-tooltip', tip.id);
  const kind = event.type;
  const pointerType = event.pointerType;
  let released = false;
  if (kind === 'pointerdown') button.addEventListener('pointerup', () => { released = true; }, {once: true});
  whenTooltipReady(() => setTimeout(() => {
    if (button.getAttribute('data-tooltip') !== tip.id) return;
    // The controller links the button on its own (its observer); the event
    // is handed over only while it still holds.
    if (kind === 'pointerover' && button.matches(':hover')) {
      button.dispatchEvent(new PointerEvent('pointerenter', {pointerType}));
    } else if (kind === 'focusin' && doc.activeElement === button) {
      button.dispatchEvent(new FocusEvent('focusin'));
    } else if (kind === 'pointerdown' && !released) {
      button.dispatchEvent(new PointerEvent('pointerdown', {pointerType}));
    }
  }, 0));
}

// One listener set per page, shared by every bundle that carries this file.
const BOUND = Symbol.for('sf.icon-button.name-tooltip');
if (typeof document !== 'undefined' && !globalThis[BOUND]) {
  globalThis[BOUND] = true;
  for (const type of ['pointerover', 'focusin', 'pointerdown']) {
    document.addEventListener(type, wake, {capture: true, passive: true});
  }
}

// A name tooltip this file made for a button is taken away (an sf-button
// whole again, shrink="icon"): the button no longer names it, and the
// surface goes.
function unlinkNameTip(button) {
  const id = button?.getAttribute?.('data-tooltip');
  if (!id) return;
  const tip = button.ownerDocument.getElementById(id);
  if (!tip?.classList.contains(NAME_TIP)) return;
  button.removeAttribute('data-tooltip');
  tip.remove();
}

export {nameTarget, unlinkNameTip};
