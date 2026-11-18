// SF.menu.open: the page's one menu of actions (owner decision C184 (4),
// 2026-11-14; the public name is the owner's; study control/research/
// 2026-11-14-toolbar-menu-open.md, K-03).
//
// A row's «⋯», a toolbar's «Ещё», the right button and the menu key on a row
// all open the standard menu -- sf-menu-context -- and every component used to
// place its own and wait for it (nine in SIMAI Pro, more in the Framework).
// Now one call opens the one menu of the page:
//
//   const choice = await SF.menu.open({anchor, entries, label});
//   const choice = await SF.menu.open({x, y, entries, label, returnTo: row});
//   // choice: {id, entry} of the row chosen, or null (closed without one)
//
// - anchor: the control the menu hangs from (a press on the same control
//   while its menu is open closes it, as a toggle); or x, y: a point in the
//   window -- where a right-click was, or a row's corner for Shift+F10 -- the
//   menu's corner exactly there;
// - entries: the rows, as sf-menu-context takes them;
// - label: the menu's name, read by a screen reader;
// - size: the menu's size step, as sf-menu-context's size attribute; left
//   out, the step of what opens it (the anchor's, its component's or the
//   Smart component holding it: a row menu of a table of size 1 is size 1);
// - returnTo: where the focus goes when the menu closes (the row it acted
//   on); left out, the menu gives the focus back to where it was, or to the
//   anchor;
// - align: 'start' (the default) lines the menu's start edge up with the
//   anchor's, 'end' its end edge -- for a control at the end of a toolbar,
//   whose menu would otherwise run past it towards the window's edge (view
//   round 1, table group). Start and end follow the page's direction (in a
//   right-to-left page 'end' is the left edge), and a menu that does not fit
//   still flips to the other side and is shifted inside the window. At a
//   point, 'end' puts the menu's end corner at the point.
//
// The menu is fetched by the Loader the first time (SF.Loader.ensure), one on
// the page -- on the body, or in the open modal dialog the anchor is in, since
// a modal dialog makes the rest of the page inert. A second opening while one
// is open closes the first, which answers null. The answer never rejects:
// without a menu (no Loader, no sf-menu-context) it is null.
//
// Every bundle may carry a copy of this module (bundles each carry their own
// module copy), so the one menu and its pending answer live behind the shared
// global: the first copy to run publishes SF.menu.open and every other copy
// calls the published one.

import {followDensity, RELATIVE} from './density.js';

const SHARED = 'data-sf-menu-shared';
const ALIGNS = new Set(['start', 'end']);

function installMenuOpen() {
  let pending = null;
  let point = null;
  // The opening the menu belongs to now, kept past its answer: a choice
  // answers before the menu closes, and the focus goes back on closing.
  let shown = null;

  const settle = (value) => {
    const waiting = pending;
    pending = null;
    waiting?.resolve(value);
    return waiting;
  };

  function sharedMenu(anchor) {
    const doc = globalThis.document;
    let menu = doc.querySelector(`[${SHARED}]`);
    if (!menu) {
      menu = doc.createElement('sf-menu-context');
      menu.setAttribute('popup', '');
      menu.setAttribute(SHARED, '');
      menu.addEventListener('sf-menu-context-select', (event) => {
        if (event.target !== menu) return;
        settle({id: event.detail?.id ?? null, entry: event.detail?.entry ?? null});
      });
      menu.addEventListener('sf-menu-context-closed', (event) => {
        if (event.target !== menu) return;
        settle(null);
        const opening = shown;
        shown = null;
        const back = opening?.returnTo;
        if (!back?.isConnected) return;
        // After the menu's own return: the row the person acted on, when the
        // focus fell to the page, stayed in the closed menu or went back to
        // the «⋯» that opened it (a pointer's control, not a Tab stop).
        const anchor = opening.anchor;
        setTimeout(() => {
          const active = doc.activeElement;
          if (!active || active === doc.body || active === doc.documentElement || menu.contains(active)
            || (anchor && (active === anchor || anchor.contains?.(active)))) {
            back.focus?.({preventScroll: true});
          }
        }, 0);
      });
    }
    // In the open modal dialog the opener is in, or on the body.
    const home = anchor?.closest?.('dialog[open]') || doc.body;
    if (menu.parentNode !== home && !menu.isOpen) home.append(menu);
    return menu;
  }

  // A point in the window as an anchor of no size: sf-menu-context hangs its
  // corner exactly there and reads the page under it (density, focus back).
  function pointAnchor(x, y, near) {
    const doc = globalThis.document;
    if (!point?.isConnected) {
      point = doc.createElement('span');
      point.setAttribute('aria-hidden', 'true');
      point.setAttribute('data-sf-menu-point', '');
    }
    const home = near?.closest?.('dialog[open]') || doc.body;
    if (point.parentNode !== home) home.append(point);
    point.style.cssText = `position:fixed;left:${x}px;top:${y}px;inline-size:0;block-size:0;pointer-events:none;overflow:hidden`;
    return point;
  }

  return async function open(options = {}) {
    const {anchor = null, x, y, entries = [], label = '', size = '', returnTo = null} = options || {};
    // Logical, so a right-to-left page mirrors it; anything else is start.
    const align = ALIGNS.has(options?.align) ? options.align : 'start';
    const atPoint = !(anchor instanceof Element);
    if (atPoint && !(Number.isFinite(Number(x)) && Number.isFinite(Number(y)))) return null;
    const doc = globalThis.document;
    if (!doc) return null;
    await globalThis.SF?.Loader?.ensure?.(['sf-menu-context']);
    if (!globalThis.customElements?.get('sf-menu-context')) return null;
    const menu = sharedMenu(atPoint ? returnTo : anchor);
    // The same control again: its open menu closes (a toggle).
    if (!atPoint && menu.isOpen && pending?.anchor === anchor) {
      menu.close({reason: 'api'});
      return null;
    }
    if (menu.isOpen) {
      settle(null);
      shown = null;
      menu.close({restoreFocus: false, reason: 'api', ask: false});
    }
    if (label) menu.setAttribute('aria-label', label);
    else menu.removeAttribute('aria-label');
    if (size) menu.setAttribute('size', String(size));
    else {
      menu.removeAttribute('size');
      menu.removeAttribute(RELATIVE);
    }
    // In the density of the control or the row it opens from (C22, C79), not
    // of the body it stands on.
    followDensity(menu, atPoint ? returnTo : anchor);
    menu.search = null;
    menu.entries = Array.isArray(entries) ? entries : [];
    return new Promise((resolve) => {
      pending = {resolve, anchor, returnTo: returnTo instanceof Element ? returnTo : null};
      shown = pending;
      const mine = pending;
      const opening = atPoint
        ? (typeof menu.openAt === 'function'
          ? menu.openAt(Number(x), Number(y), {target: returnTo ?? undefined, align})
          : menu.openFor(pointAnchor(Number(x), Number(y), returnTo), {side: 'block-end', align, focus: 'first'}))
        : menu.openFor(anchor, {side: 'block-end', align, focus: 'first'});
      Promise.resolve(opening).then((answer) => {
        // Refused (a listener kept it closed) or no surface: nothing chosen.
        if (pending === mine && answer && answer !== true && answer.outcome !== 'applied') settle(null);
      }, () => { if (pending === mine) settle(null); });
    });
  };
}

// The published one, or this copy published.
export function publishMenu() {
  const SF = (globalThis.SF = globalThis.SF || {});
  SF.menu = SF.menu || {};
  if (typeof SF.menu.open !== 'function') SF.menu.open = installMenuOpen();
  return SF.menu;
}

export function menuOpen(options) {
  return publishMenu().open(options);
}

export default menuOpen;
