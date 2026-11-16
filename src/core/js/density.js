// Density (owner decision C22, 2026-11-09). data-sf-density="compact" on the
// root or on a container moves every component one ladder step down; the CSS
// does it (core/scss/_sf_css__density.scss): each step variable holds the step
// below. An explicit size is a step on the region's ladder (owner decision
// C79, 2026-11-12, changing C22): it comes down with the region, and only
// data-sf-density="normal" takes the normal ladder back.
//
// A size a component's template gives an element it draws (sf-input's clear
// button, a pager's buttons, a submenu) is relative to the component's own
// size; those are still marked data-sf-size-relative once the component has
// drawn. Since C79 the density CSS treats both alike; the mark stays a
// published runtime mark (host-runtime-marks) for hosts that read it.
//
// What a component holds of the page's own (captured slot content, children
// left in place) keeps its size explicit. The store is on the shared global:
// every bundle carries its own copy of this module.

const store = () => {
  const SF = (globalThis.SF = globalThis.SF || {});
  const internal = SF.__internal || (SF.__internal = {});
  return (internal.density ||= {authored: new WeakSet(), depth: 0});
};

export const RELATIVE = 'data-sf-size-relative';

// Page content a component captured to place in its own drawing. Content a
// template hands to a child while it draws is the template's, not the page's.
export function noteAuthored(nodes) {
  const state = store();
  if (state.depth > 0) return;
  for (const node of nodes) if (node && typeof node === 'object') state.authored.add(node);
}

export function drawing(callback) {
  const state = store();
  state.depth += 1;
  try {
    return callback();
  } finally {
    state.depth -= 1;
  }
}

// The sized elements present before a host first draws are the page's.
// A printed first-paint picture is the drawing's, not the page's.
export function sizedBefore(host) {
  return new Set(Array.from(host.querySelectorAll?.('[size]') ?? []).filter((element) => {
    const picture = element.closest('[data-sf-static]');
    return !picture || !host.contains(picture);
  }));
}

// After a host drew: every sized element its drawing holds that is not the
// page's is relative to the host.
export function markRelativeSizes(host, before = null) {
  const {authored} = store();
  for (const element of host.querySelectorAll?.('[size]') ?? []) {
    if (element.hasAttribute(RELATIVE) || before?.has(element)) continue;
    let node = element;
    let page = false;
    while (node && node !== host) {
      if (authored.has(node)) {
        page = true;
        break;
      }
      node = node.parentNode;
    }
    if (!page) element.setAttribute(RELATIVE, '');
  }
}

// A popup a component builds itself and places outside its own box (a menu on
// <body>, in an open dialog): sized from the component, so relative, and in
// the component's density, not the density of where it was placed.
export function followDensity(element, from) {
  if (!element?.setAttribute) return element;
  if (element.hasAttribute('size')) element.setAttribute(RELATIVE, '');
  const density = densityOf(from);
  if (density) element.setAttribute('data-sf-density', density);
  else element.removeAttribute('data-sf-density');
  return element;
}

// The density an element stands in: the nearest region's (an explicit size
// follows its region since C79); null outside any.
export function densityOf(from) {
  for (let node = from; node?.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute('data-sf-density')) return node.getAttribute('data-sf-density');
  }
  return null;
}

// The size step of the control a popup opens from (owner remark 2026-11-15:
// the row menu of a table of size 1 opened at 1/2). A popup a component
// builds outside itself -- a menu on <body> or in the open dialog -- stood on
// the default step whatever opened it. The step is the first size written
// from the opener up: the opener's own (a row's «⋯», the native button an
// sf-button draws), else its component's, else the Smart component that
// holds it (sf-view-table size="1"). A size a template gave a part it draws
// (data-sf-size-relative) follows its host, so the walk goes on past it. It
// ends on the default step (null) at the second custom element without a
// size: the opener's own component may stand on its default, the host
// holding it decides.
export function sizeOf(from) {
  let own = true;
  for (let node = from; node?.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute('size')) {
      if (!node.hasAttribute(RELATIVE)) return node.getAttribute('size');
      continue;
    }
    if (!node.localName.includes('-')) continue;
    if (!own) return null;
    own = false;
  }
  return null;
}

// A size step as a number of the ladder ("1/2" is 0.5, "2" is 2); NaN for
// anything else.
export function sizeStep(size) {
  const [top, bottom = '1'] = String(size ?? '').trim().split('/');
  const step = Number(top) / Number(bottom);
  return top !== '' && Number.isFinite(step) && step > 0 ? step : Number.NaN;
}
