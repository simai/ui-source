// While a transient surface is open the root says so, and a component whose own
// Escape closes something larger -- a drawer, a modal, a record panel -- stands
// back. They all listen on the document in capture, where stopPropagation
// cannot reach a listener on the same node and the one registered first wins
// whatever it is: without a shared mark, one press closed the surface and the
// window behind it together.
//
// The mark started inside sf-popover, which made it that component's state
// instead of the protocol it is: a dropdown list is the same kind of surface and
// raised nothing, so Escape over an open list closed the record panel behind it
// (Larena storage QA, 2026-10-22) -- and a drawer and a modal read the same mark,
// so the same press closed those too. It lives here now, raised by every surface
// that owns Escape while it is open and read by every component that owns Escape
// for something larger.
//
// The attribute name is unchanged, because it is already the published protocol:
// `document.documentElement.dataset.sfPopoverOpen`.
import {closeLayer, hasLayer, isTopLayer, openLayer} from './layer-stack.js';

const OPEN_MARK = 'sfPopoverOpen';

// A count, not a flag: two surfaces can be open at once -- a dropdown inside a
// popover -- and the first to close must not clear the mark the second needs.
const held = new WeakSet();

// The same holders are layers of the one document stack (layer-stack.js,
// standard 1.3.8 §19.1): the mark answers "is anything open", the stack answers
// "is it me" -- for a surface, and for the drawer and the modal under it. Two
// surfaces that both listen on the document in capture cannot settle it with
// stopPropagation, which does not reach a listener on the same node: a calendar
// opened inside a popover closed together with the popover, and a popover closed
// over a dropdown list it held and left the list open.
//
// The list a bundle of an older pair reads (sf.openSurfaceLayers) is kept as
// well, so a package built against it still sees the surfaces this one opens.
const LAYERS_KEY = Symbol.for('sf.openSurfaceLayers');
function legacyLayers() {
    const scope = globalThis;
    if (!Array.isArray(scope[LAYERS_KEY])) scope[LAYERS_KEY] = [];
    return scope[LAYERS_KEY];
}

function step(delta) {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    const next = Math.max(0, Number(root.dataset[OPEN_MARK] || 0) + delta);
    if (next) root.dataset[OPEN_MARK] = String(next);
    else delete root.dataset[OPEN_MARK];
}

// Idempotent for one owner, so a component can call it from every update with
// its own open state and only a change moves the count. An owner that is removed
// while open releases it the same way, from wherever it tears down.
export function holdOpenSurfaceMark(owner, open) {
    if (!owner) return;
    const wanted = Boolean(open);
    if (wanted === held.has(owner)) return;
    const layers = legacyLayers();
    if (wanted) {
        held.add(owner);
        layers.push(owner);
        openLayer(owner, {kind: 'surface'});
    } else {
        held.delete(owner);
        const at = layers.lastIndexOf(owner);
        if (at >= 0) layers.splice(at, 1);
        // A surface returns focus itself, to its own trigger.
        closeLayer(owner, {restoreFocus: false});
    }
    step(wanted ? 1 : -1);
}

// What a surface asks before its own Escape closes it: whether it is the top
// layer of the document -- above a modal or a drawer as well as above another
// surface. A holder that left the document without releasing is passed over
// rather than allowed to hold every Escape on the page. An owner that holds
// nothing is the top only when nothing else is open.
export function isTopOpenSurface(owner) {
    if (!isTopLayer(owner)) return false;
    // A holder that only a bundle of an older pair registered -- it is in the
    // old list and not in the stack -- stands above whatever opened before it.
    const layers = legacyLayers();
    for (let at = layers.length - 1; at >= 0; at -= 1) {
        const layer = layers[at];
        if (layer?.isConnected === false) continue;
        return layer === owner || hasLayer(layer);
    }
    return true;
}

// What a component asks before its own Escape closes something larger.
export function isOpenSurfaceMarked() {
    return Boolean(globalThis.document?.documentElement?.dataset?.[OPEN_MARK]);
}

export const OPEN_SURFACE_MARK = OPEN_MARK;
