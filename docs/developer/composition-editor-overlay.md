# Composition editor overlay

`<sf-composition-overlay>` (Smart component `smart.composition-overlay`,
loaded on demand when the tag is on the page) draws editor chrome over a rendered Composition Document: hover and selected
frames with a label and badges, a floating action toolbar outside the node,
insertion points between siblings and at the end of each slot of the selected
node, and a keyboard tree. It never changes the canvas DOM, so the published
HTML, digests and snapshots are identical with the editor open or closed.

```html
<sf-composition-overlay id="overlay" for="canvas"></sf-composition-overlay>
<div id="canvas"><!-- SF.Composition.render(document).html --></div>
```

```js
await customElements.whenDefined('sf-composition-overlay');
overlay.attach(canvas);
overlay.setDocument(document, {describe: (node) => ({label: titleOf(node), badges: node.shared ? ['Общий'] : []})});
overlay.setActions([{id: 'move-up', label: 'Выше'}, {id: 'move-down', label: 'Ниже'}]);
overlay.addEventListener('sf-composition-overlay-select', (event) => event.detail.node_id);
overlay.addEventListener('sf-composition-overlay-action', (event) => event.detail); // {action_id, node_id}
overlay.addEventListener('sf-composition-overlay-insert', (event) => event.detail); // {parent_id, slot, index}
overlay.setInsertionTarget({parent_id, slot, index}); // mark a target, or null
```

`SF.CompositionOverlay` exposes `OVERLAY_EVENTS`, `overlayNodes(document)` and
`checkOverlayActions(actions)` once the component is loaded. When `setDocument` no longer contains the selected node, the overlay clears the
selection (`sf-composition-overlay-select` with `node_id: null`); if keyboard
focus was on the toolbar, it selects the parent and focuses the tree instead.
Events report
intent only; the host changes and saves the Document. Place the
overlay before the canvas so its tree comes first in the Tab order. Keyboard:
the tree (`role="tree"`, one `treeitem` per node) uses ArrowUp/ArrowDown in
document order, ArrowLeft to the parent, ArrowRight to the first child,
Home/End, Enter to the toolbar and Escape to clear; in the toolbar arrows move
between actions and Escape returns to the tree. Selection is announced with the
node label and position. A click inside the canvas selects and never follows a
link. Actions are `{id, label}` only (id `^[a-z][a-z0-9-]{0,63}$`, up to 16).

Parts are `position: fixed` at `--sf-composition-overlay-z-index`
(default `--sf-z-index-8`), below drawers and modals. Colors use theme tokens
(`--sf-composition-overlay-color` defaults to `--sf-primary`); an insertion point is a
thin line with a 24px round "+" target, and only that target takes the pointer,
so blocks under the line stay clickable; RTL aligns the toolbar to the inline start;
`prefers-reduced-motion` removes frame animation. Frames follow scrolling and
resizing. Removing and re-inserting the element keeps a single subscription.
