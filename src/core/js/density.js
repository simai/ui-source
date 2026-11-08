// Density (owner decision C22, 2026-11-09). data-sf-density="compact" on the
// root or on a container moves every component one ladder step down; the CSS
// does it (core/scss/_sf_css__density.scss): each step variable holds the step
// below, and an element with an explicit size takes the normal ladder back.
//
// "Explicit" is a size the page gave. A size a component's template gives an
// element it draws (sf-input's clear button, a pager's buttons, a submenu) is
// relative to the component's own size: under a compact sf-input its button
// has to come down with it, not stand at the normal ladder. Those are marked
// data-sf-size-relative here, once the component has drawn; the CSS leaves
// them in the region's ladder.
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

// The density an element stands in: the nearest region's, or "normal" under an
// explicit size (where the ladder is the normal one again); null outside any.
export function densityOf(from) {
  for (let node = from; node?.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute('data-sf-density')) return node.getAttribute('data-sf-density');
    if (node.hasAttribute('size') && !node.hasAttribute(RELATIVE) && !/^(input|select|textarea)$/u.test(node.localName)) return 'normal';
  }
  return null;
}
