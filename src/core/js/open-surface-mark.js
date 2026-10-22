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
const OPEN_MARK = 'sfPopoverOpen';

// A count, not a flag: two surfaces can be open at once -- a dropdown inside a
// popover -- and the first to close must not clear the mark the second needs.
const held = new WeakSet();

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
    if (wanted) held.add(owner);
    else held.delete(owner);
    step(wanted ? 1 : -1);
}

// What a component asks before its own Escape closes something larger.
export function isOpenSurfaceMarked() {
    return Boolean(globalThis.document?.documentElement?.dataset?.[OPEN_MARK]);
}

export const OPEN_SURFACE_MARK = OPEN_MARK;
