# Composition inline editor

`SF.Composition.startInlineEdit(element, options)` (Smart component
`smart.inline-editor`) edits the text of a
rendered `content.heading` or `content.paragraph` in place, using the inline
content model those types already define: text runs with `strong`, `em` and
`code` marks, links whose children are text runs and, since type version
1.1.0, inline component atoms. Lists are not part of this model and are not
offered.

## Inline component atoms

An atom is `{type: 'component', name, props}`. `name` comes from a closed
list, `badge`, `kbd`, `icon` and `button`; `props` are that component's own
settings, and only the declared ones (`badge`: text, icon, appearance, scheme,
status, size, compact; `kbd`: text, required; `icon`: icon, required, label,
size, filled; `button`: text, icon, appearance, scheme, size). Text props are
strings, the others tokens or booleans. The Document validator refuses an
atom with marks, an atom inside a link, a name outside the list and an
undeclared or ill-typed prop.

An atom draws its element (`<sf-badge>`, `<kbd>`, `<sf-icon>`,
`<sf-button>`) with its props as attribute values, or for `kbd` as its text,
escaped like any text, so a prop never becomes markup or a handler.

In the editor an atom is one caret stop: it is not editable inside and takes
no marks; a link applied across it stops on each side. Arrow keys step over
it in one move, Backspace and Delete remove it whole, and a selection may
cross it. Copy and cut write the editor's own HTML, in which each atom
carries its entry in `data-sf-inline-node`, so pasting into an inline editor
gives the same atom back; a pasted `<kbd>` or an `<sf-badge>`, `<sf-icon>` or
`<sf-button>` with declared attributes becomes an atom too.

Any other entry -- a node from a newer producer, or an atom this model does
not know -- is opaque: it holds one caret stop, is drawn as a placeholder
while editing, and comes back out of every operation (`toSegments`,
`fromSegments`, `normalizeInline`, `toggleMark`, `setLink`, `replaceRange`,
the editor's read, copy and paste) unchanged. Before 1.1.0 `toSegments`
dropped every entry that was not text or a link, so editing next to one lost
it silently. Validation still refuses an unknown entry: the host learns of it
when it saves, not by losing it. `inlineText` returns the text runs only;
offsets count one unit for each atom or opaque entry.

The editor code loads on demand: place `<sf-inline-editor></sf-inline-editor>`
on the editor page and wait for it; before that `startInlineEdit` throws
`inline_editor_not_loaded`. `document.querySelector('sf-inline-editor').edit(element,
options)` is the same call.

```js
await customElements.whenDefined('sf-inline-editor');
canvas.addEventListener('dblclick', (event) => {
  const element = event.target.closest('[data-sf-composition-id]');
  const node = nodeById(element.dataset.sfCompositionId); // host model
  SF.Composition.startInlineEdit(element, {content: node.data.content, nodeId: node.id, label: 'Абзац'});
});
document.addEventListener('sf-inline-edit-input', (event) => event.detail.content); // live normalized value
document.addEventListener('sf-inline-edit-commit', (event) => save(event.detail.node_id, event.detail.content));
document.addEventListener('sf-inline-edit-cancel', (event) => event.detail.node_id);
```

Events carry normalized content arrays, never HTML. The host saves through its
own expected-revision contract, validates the Document and re-renders. Cancel
restores the element's exact original HTML and attributes; commit restores it
as well, so the canvas always returns to host-rendered HTML.

Editing: Ctrl/Cmd+B, I and E toggle bold, italic and code on the selection;
Ctrl/Cmd+K opens a link address field (http, https, mailto, tel, relative and
fragment links only; unsafe addresses show an accessible error); Ctrl/Cmd+Z,
Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y use the editor's own history; Enter commits,
Escape cancels, moving focus away commits. Paste keeps only bold, italic, code
and safe links from HTML (Word and web pages), drops styles, scripts, images
and unsafe links, and joins pasted paragraphs into one line. IME composition
is never interrupted; one value event follows the committed text. Drag-in drops
are ignored. `options.marks` narrows marks, `options.links: false` disables
links, `options.messages` overrides the Russian/English toolbar texts.

While editing, the element is a labelled `role="textbox"` with a visible
outline; the formatting toolbar floats above it (inline start in RTL) with
`aria-pressed` states and `aria-keyshortcuts`. The events are dispatched on
the edited element and bubble to `document`; `<sf-inline-editor>` itself stays
hidden. The pure helpers (`normalizeInline`, `toggleMark`, `setLink`,
`replaceRange`, `marksIn`, `inlineText`) stay in Core for server-side and test
use.
