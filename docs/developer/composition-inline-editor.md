# Composition inline editor

`SF.Composition.startInlineEdit(element, options)` (Smart component
`smart.inline-editor`) edits the text of a
rendered `content.heading` or `content.paragraph` in place, using the inline
content model those types already define: text runs with `strong`, `em`,
`code` and, since inline model 1.2.0, `strike` marks, links whose children are
text runs and breaks, the soft line break and, since type version 1.1.0,
inline component atoms. Lists are not part of this model and are not offered.

Inline model 1.2.0 (2026-11-10; `content.heading` 1.3.0, `content.paragraph`
1.4.0 and every type with an inline field at its next minor) adds
`{"type": "break", "marks"?: [...]}` and the mark `strike`. Shift+Enter inserts
a break with the marks and link of the character before it; the editor draws
it as `<br>` (`data-sf-inline-break` when it carries marks), reads `<br>` and
`s`/`strike`/`del` back, and copies a break as a line end in plain text. The
model never removes a break: consecutive breaks, breaks at an edge, inside
marks and inside a link are kept. The toolbar offers bold, italic and code;
`strike` is a known mark (kept, toggled by `toggleMark`, drawn as `<s>`) with
no shortcut and a toolbar button only when `options.marks` names it. An older pair keeps a break opaque while
editing and refuses it at validation, so a producer writes breaks only to
hosts on this pair.

## Inline component atoms

An atom is `{type: 'component', name, props}`. `name` comes from a closed
list, `badge`, `kbd`, `icon` and `button`; `props` are that component's own
settings, and only the declared ones (`badge`: text, icon, appearance, scheme,
status, size, icon-only; `kbd`: text, required; `icon`: icon, required, label,
size, filled; `button`: text, icon, appearance, scheme, size). Text props are
strings, the others tokens or booleans. The Document validator refuses an
atom with marks, an atom inside a link, a name outside the list and an
undeclared or ill-typed prop. A badge's `compact` is the dated alias of
`icon-only` until 2027-01-01 (owner decision C134, inline model 1.3.0): still
valid, drawn as `icon-only`, and read back from the page as `icon-only`.

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

A mark the model does not know survives the same way (2026-11-10): marks are
sorted with the known ones first in their canonical order and the unknown ones
after them in the order they came; `toggleMark` touches only a known mark, and
the editor draws an unknown mark as a `span` carrying `data-sf-inline-mark`
and reads it back from there, never as an element of that name. The field's
`options.marks` limit the known marks only. Validation still refuses an
unknown mark, and the renderer draws no element for it.

An atom is never inside a link, whatever the model is given: a link that holds
one is split around it (`[link a, atom, link b]`), and an atom pasted inside an
`<a>` stands beside the link. An opaque entry from a newer producer keeps its
place in its link.

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
Ctrl/Cmd+K opens the link window (http, https, mailto, tel, relative and
fragment links only; a refused address names its reason); Ctrl/Cmd+Z,
Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y use the editor's own history; Enter commits,
Escape cancels, moving focus away commits, Shift+Enter inserts a soft line break (key effect `break`). Paste keeps only bold, italic, code
and safe links from HTML (Word and web pages), drops styles, scripts, images
and unsafe links, and joins pasted paragraphs into one line. Only HTML this
editor copied keeps its `data-sf-inline-*` attributes (atoms, marks it cannot
draw); a paste from elsewhere loses them first. IME composition
is never interrupted; one value event follows the committed text. Drag-in drops
are ignored. `options.marks` narrows marks, `options.links: false` disables
links, `options.messages` overrides the Russian/English toolbar texts.

`options.toolbar` says when the formatting toolbar shows (sf-inline-editor
1.3.0; owner decision C172, sf-editor-inline 1.9.0). `'selection'`, the default
since 1.9.0, shows it only while text is selected (or the link window is open)
and places it over the selected text: above its first line, centred on it,
below it when there is no room above, inside the viewport. `'session'`, the
default before 1.9.0, keeps it for the whole edit, over the element. Below the
md breakpoint the toolbar is a strip of icon buttons on rung 2 above the
screen keyboard (placed from `visualViewport`) for the whole edit, in either
mode. The bar carries `data-sf-toolbar="selection|session"`; any other value
throws `inline_toolbar_unknown`. The shortcuts work in both.

The toolbar is ghost icon buttons (1/2) in two groups -- the marks, then the
link -- 4 apart, a 1 px separator with 4 on each side (C144); what does not fit
leaves for ⋯ «Ещё» through the row engine (`core/js/overflow-row.js`, C155):
the link group first, the marks stay. Left/Right/Home/End move inside it,
Escape goes back to the text.

`options.enter` says what Enter does (C172 (2)): `'save'`, the default,
commits; `'new-block'` (a block editor's «Enter — новый блок») commits the text
before the caret and puts the text after it in the change detail as `next`
(`{id, content, next}`) for the host to make the next block of; the former
`sf-inline-edit-commit` detail stays `{node_id, content}`. Any other value
throws `inline_enter_unknown`.

The link window (C141 (6), C172 (4)) is a panel of its own under the selected
text, as sf-input-rich's: an `sf-input` 1/2 «Адрес ссылки» with its hint under
it, «Применить» and, on a link, «Убрать ссылку» in a row from the start; on a
phone a sheet standing on the keyboard over the scrim. A refused address names
its reason in the hint's place (`SF.InlineEditor.linkProblem`: empty, spaces,
another scheme, no start, a double slash or a backslash, too long) and the
reason goes as the address changes. Ctrl/Cmd+K with no selection takes the
word under the caret; with no word there, the address becomes the link's text.

```js
SF.Composition.startInlineEdit(element, {content, nodeId: node.id, label: 'Абзац', toolbar: 'selection'});
```

While editing, the element is a labelled `role="textbox"` with a visible
outline; the formatting toolbar floats above the selection (with
`toolbar: 'session'` above the element, inline start in RTL) with
`aria-pressed` states and `aria-keyshortcuts`. The events are dispatched on
the edited element and bubble to `document`; `<sf-inline-editor>` itself stays
hidden. The pure helpers (`normalizeInline`, `toggleMark`, `setLink`,
`replaceRange`, `marksIn`, `inlineText`) stay in Core for server-side and test
use.
