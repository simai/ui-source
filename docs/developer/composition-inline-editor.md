# Composition inline editor

`SF.Composition.startInlineEdit(element, options)` (Smart component
`smart.inline-editor`) edits the text of a
rendered `content.heading` or `content.paragraph` in place, using the inline
content model those types already define: text runs with `strong`, `em` and
`code` marks and links whose children are text runs. Lists are not part of
this model and are not offered.

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
