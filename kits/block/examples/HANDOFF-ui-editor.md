# Handoff to the ui-editor thread: sample.quote in the content editor

From the SIMAI Framework block author kit (ui-source branch
`feat/block-author-kit`, `kits/block/`). Done-when item 4 of the assignment
asks that a block made only from the kit appears and can be edited in the
content editor in ui-editor. The block passes the kit's check; the in-editor
run is yours.

## What to load

Everything is in `kits/block/examples/sample-quote/`:

- `type.json`: the type manifest of `sample.quote` 1.1.0 (registered renderer
  `sample.quote`, asset `sample/quote`; 1.1.0 adds its catalogue place and a
  variant for the one block editor, and draws every case as 1.0.0 did);
- `editor.json`: its editor manifest (author, role, source; align, size);
- `words.json`: the field words, en and ru, owner `sample.quote`;
- `renderer.mjs`: `export default ({node, slots}) => html`;
- `style.css`: the asset `sample/quote`;
- `cases/quote-center-large.json`: a Document holding the block
  (`input.document`) and the HTML it draws (`expect.html`).

On the host side:

```js
import type from '.../sample-quote/type.json' with {type: 'json'};
import editor from '.../sample-quote/editor.json' with {type: 'json'};
import words from '.../sample-quote/words.json' with {type: 'json'};
import drawQuote from '.../sample-quote/renderer.mjs';

const registry = SF.Composition.extendRegistry([type], {[type.renderer.name]: drawQuote});
SF.language.register('sample.quote', 'ru', words.words.ru);
SF.language.register('sample.quote', 'en', words.words.en);
contentEditor.editorManifests = [editor];        // the editor-manifests setting
contentEditor.document = pageWithAQuote;         // e.g. the case's input.document
// validate and render the saved Document with the same registry, and load
// style.css when the render result lists the asset sample/quote.
```

The component is sf-editor-content (formerly sf-content-editor; the old tag
stays an alias), at the ui-pro revision ui-editor pins.

## What to verify

1. The page with the quote opens; the quote is shown and is not lost.
2. The quote's parameters open (grip menu, Parameters; or the host panel with
   `parameters="host"`): author, role and source as text, align and size as
   choices, with the words from `words.json`.
3. Changing align to centre and size to large writes
   `props: {align: "center", size: "large"}` in the `change` event's Document;
   setting them back to the defaults removes the keys.
4. Changing the author writes `data.author`; clearing it is refused or
   flagged (it is required).
5. Moving and removing the block works whole; undo brings it back byte for
   byte.
6. The saved Document validates with the registry above and draws the HTML of
   the case when the parameters match it (`render` diagnostics empty).
7. Without the registration (a host that does not know `sample.quote`) the
   page still opens, the quote is shown as an unknown block and saved back
   unchanged.

Please reply with what passed, a screenshot or the change-event Document for
items 3 and 6, and each item that did not pass.

## Expected gaps (from reading ui-pro, not run)

The content editor today draws only the SIMAI Framework's types; a type it
does not know (`js/view.js`, `opaque`) is a placeholder with its type name.
So item 1 shows a placeholder, not the quote's preview, and the quote's
paragraphs cannot be edited in place. Also:

- the `/` menu and the gutter's `+` offer a fixed catalog (`js/catalog.js`):
  a product block cannot be inserted;
- a field's `required` comes from the built-in type manifests only
  (`editorFields`), so `author` is not marked required;
- field labels come from the editor's own words (`param-<key>`), not from
  the manifest's `label_key`, so the words of `words.json` are not used.

Each is ui-pro work, in sf-editor-content; please list what you find in your
list for the dispatcher (beside the content outlet, embed mode and shared
undo).
