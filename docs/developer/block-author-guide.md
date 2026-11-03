# How to make a block

A block is a Composition node type of your own. It stands in a page
(profile `structured-content`) or in a layout (profile `ui-layout`) beside the
SIMAI Framework's types, is drawn by the same `SF.Composition.render`, and is
edited by the same editors. There is no format of its own: a block is

- a **type manifest** (`simai.composition.type-manifest`, schema version 1):
  its name, data, parameters, slots, renderer and assets;
- an **editor manifest** (`simai.composition.editor-manifest`, schema version
  1): the fields of its parameter form;
- a **renderer** the host registers: a function from the node to HTML;
- **cases** (`simai.composition.structured-content-conformance-case`, schema
  version 1): Documents holding it and what they draw.

The kit is in `kits/block/`: a template to start from, a generator, and a check
a developer runs on a block. `kits/block/examples/sample-quote/` is a block
made from the kit alone.

## Quick start

```bash
node kits/block/new.mjs acme.price-card ../acme-blocks/price-card
# change type.json, editor.json, words.json, renderer.mjs, style.css, cases/
node kits/block/check.mjs ../acme-blocks/price-card --update   # write what it draws now into the cases, then read the diff
node kits/block/check.mjs ../acme-blocks/price-card            # BLOCK_CHECK_PASS acme.price-card@1.0.0 ...
```

The check runs against this checkout's `src/` by default; `--framework
<dir>` runs it against another SIMAI Framework, for instance a released
distribution (`--framework ../ui/distr`). `--json` prints the report as JSON.

## The files of a block

| File | Format | Holds |
|:---|:---|:---|
| `type.json` | `simai.composition.type-manifest` v1 (`src/core/contracts/composition-type-manifest.v1.schema.json`) | name, version, category, mode, profiles, `data_schema`, `props_schema`, slots, renderer, assets |
| `editor.json` | `simai.composition.editor-manifest` v1 | one field per parameter |
| `words.json` | `simai.composition.editor-words` v1 | the words of the fields, by locale |
| `renderer.mjs` | an ES module | `export default ({node, slots, locale}) => html` |
| `style.css` | CSS | the block's own sheet, one of its assets |
| `cases/*.json` | `simai.composition.structured-content-conformance-case` v1 | a Document and what it draws |

## Namespaces

A type's name is two or more lowercase segments: `<owner>.<name>`. The first
segment says whose it is.

- `content.*`: the SIMAI Framework's content types
  (`composition-content-types.md`);
- `layout.*`: the SIMAI Framework's layout types;
- `smart.*`: the SIMAI Framework's Smart components in a Composition;
- `<product>.*`: everything else, named after the product that owns it:
  `acme.price-card`, `sample.quote`.

A block never takes a SIMAI Framework namespace, and never the name of a type
the SIMAI Framework already has: the check refuses both
(`type_namespace_reserved`, `type_taken`). The namespace says who owns the
name, not where the block stands: `category` (`content`, `layout`) and
`profiles` say that. A content block is `category: "content"`, which every
content slot accepts, and lists `structured-content` (and `ui-layout` when it
may stand in a layout too).

## Data, parameters and the form

A node is a call: `data` is its content, `props` its parameters.

```json
{"id": "q", "type": "sample.quote", "data": {"author": "Ada Lovelace"}, "props": {"align": "center"},
 "slots": {"default": [{"id": "q1", "type": "content.paragraph", "data": {"content": [{"type": "text", "value": "..."}]}}]}}
```

`data_schema` and `props_schema` are closed objects (`type: "object"`,
`additionalProperties: false`). The Composition validator reads these
keywords, and only these: `type`, `const`, `enum`, `oneOf`, `minLength`,
`maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`,
`uniqueItems`, `items`, `required`, `properties`, `additionalProperties:
false` (and `title`, `description`, `default` as annotations). Any other
keyword (`format`, `$ref`, `anyOf`) would be silently ignored, so a Document
the author meant to refuse would pass; the check refuses it
(`schema_keyword_unsupported`). A key the Document format refuses anywhere
(`html`, `script`, `class`, `token`, `password` and the rest) cannot be a key
of a block either (`schema_key_forbidden`).

A parameter equal to its default is not written. The default lives in the
editor manifest's field, and the renderer draws the same default when the
key is absent.

### The editor manifest

Each parameter, and each scalar data key a node needs, has a field. A form
drawn from the editor manifest alone can then make a complete block
(`form_required_field_missing` otherwise).

```json
{"key": "align", "plane": "props", "target": "align", "property": {"type": "string", "version": 2},
 "constraints": {"min_length": 1, "max_length": 16}, "group": "basic", "visibility": "visible",
 "choices": ["start", "center"], "default": "start",
 "label_key": "sample.quote.align", "help_key": "sample.quote.align_help",
 "capability_hints": ["composition.props.align"], "permission_hints": ["composition.node.update"], "owner": "sample/quote"}
```

`type_version` binds the field list to one exact version of the type. The
property identity and the presence of `choices` pick one of the published
field kinds (`composition-editor-field-kinds.md`):

| Kind | `property` | `choices` | Draws |
|:---|:---|:---|:---|
| choice | `string` 1 or 2 | required | a select |
| integer | `integer` 1 | none; `min` and `max` required | a number input |
| text | `string` 2 | none; `max_length` required (up to 2000) | a text input |
| toggle | `boolean` 1 | none | a switch; `false` is not written |

`owner` is the block's own (`<product>/<name>`); `simai/framework` owns the
built-in fields (`editor_owner_foreign`). The labels are words, not text in
the manifest: `words.json` gives `label_key`, `help_key` and
`<label_key>.<choice>` for each locale, and the host registers them as it does
any component's words:

```js
SF.language.register('sample.quote', 'en', words.words.en);
```

The check builds the form for every node of the block in the cases
(`projectEditorFields`, then `renderFieldFallback` per field), and puts every
value the form offers (each choice, both states of a toggle, the least and
the greatest integer) into the Document: each must still validate
(`form_value_breaks_document`). A choice the type's schema does not allow is
caught here.

## Registering the renderer

`renderer: {"kind": "registered", "name": "sample.quote"}` says a host supplies
the drawing. The host adds the type to the built-in ones and registers the
function under that name:

```js
import type from './sample-quote/type.json' with {type: 'json'};
import drawQuote from './sample-quote/renderer.mjs';

const registry = SF.Composition.extendRegistry([type], {[type.renderer.name]: drawQuote});
const {html, assets, diagnostics} = await SF.Composition.render(document, {registry});
```

`extendRegistry` keeps the SIMAI Framework's types; `createRegistry(list)`
takes the list as the whole registry. The same call works on a server: the
renderer is a plain module and the Composition runtime runs in Node
(`core/js/composition/index.mjs` of a released distribution).

The renderer gets `{node, slots, locale, context, manifest, resolvedBindings}`
and returns a string (or a promise of one):

- `node` is the node as the Document holds it, validated. It is read, never
  changed: the check watches every call (`renderer_mutates_node`).
- `slots.<name>` is the HTML of a slot's children, drawn by their own
  renderers; `slots.<name>List` is the same, one string per child. A slot the
  type declares is placed (`renderer_slot_dropped`).
- `locale` is the Document's language (`en` when it has none).
- The outer element carries `data-sf-composition-id="<node id>"`, once
  (`renderer_node_id_missing`): the layout editors, the inline editor and the
  sortable find a node in the drawn page by it.

A type registered nowhere draws nothing in its place, and `render` reports
`renderer_unavailable` at `node:<id>`; the check asks this first, so a name a
SIMAI Framework renderer already answers to is caught
(`renderer_name_taken`). A block that is a web component is `"kind":
"custom-element"` with the element's tag as `name`: it is drawn as that
element with its props as attributes and listed in the render result's
`hydration`; the host loads the element's script as an asset.

## Slots and inline mapping

A slot is declared with its bounds and what it accepts:

```json
"slots": {"default": {"min": 1, "max": 20, "types": ["content.paragraph"]}}
```

`types` names the types a slot takes; `categories` (`content`, `layout`,
`smart`) takes a whole category. A child outside them is refused
(`slot_child_type_forbidden`, `slot_child_category_forbidden`), as is a count
outside `min` and `max` (`slot_cardinality`). A leaf block declares no slot.

Text with marks and links belongs in a slot of `content.paragraph` (or other
content types) rather than in the block's own data. There the SIMAI
Framework's inline model holds it: text runs with `strong`, `em` and `code`,
links of text runs, the inline component atoms. The Document's URL rule
applies to every link, the paragraph renderer escapes it, and the editors edit
it in place, each paragraph by its own `data-sf-composition-id`. The sample
quote keeps its words this way, and its author in plain data.

A block that must keep inline content in its own data can reuse the inline
schema of `content.paragraph`
(`BUILTIN_TYPE_MANIFESTS.find(({type}) => type === 'content.paragraph').data_schema.properties.content`),
but the validator applies the URL rule to the SIMAI Framework's own types by
name: a product type's data is its renderer's to check, links and addresses
alike. The check puts a link to `javascript:` into every inline field and
every text field the schemas let through, and refuses output that draws it.

## Assets and a safe preview

`assets` names what a drawn block needs beside its HTML. A SIMAI Framework
part is named as the built-in types name theirs (`component/alerts`,
`utility/table-frame`); a block's own sheet is named in its namespace
(`sample/quote`). `render` returns the set for the whole Document, and the
host loads each one it lists, so a page that holds no quote loads no quote
sheet. A block's sheet reads the SIMAI Framework's public variables
(`--sf-primary`, `--sf-on-surface`, `--sf-space-*`) so it follows the theme
and the dark mode.

The HTML a renderer writes is what an editor shows as the block's preview
and what a reader's page holds, so it is safe on its own:

- every value is escaped (`& < > " '`);
- every address is checked by the Document's URL rule (relative, a fragment,
  `http:`, `https:`, `mailto:`, `tel:`);
- no `script`, `style`, `iframe`, `object`, `embed`, `form`, `base`, `meta`,
  `link` or `template` element, no `on*` attribute, no `style` that loads or
  runs anything.

Behaviour (a carousel, a counter) is a custom element the host loads as an
asset, never a script in the HTML. The check reads every case's output and
the output of hostile values put into every text, address and inline field
(`output_element_forbidden`, `output_event_handler`, `output_unsafe_url`,
`output_unsafe_style`).

## Versioning

`version` in `type.json` is the block's version, and `type_version` in
`editor.json` names the same one exactly (`editor_type_registration_mismatch`
otherwise). A Document names a type, not its version: every Document saved
with the block must stay valid and draw the same under each later version of
that name. So the version moves the way the conformance kit's does:

- **patch**: a renderer fix that keeps every case's HTML, a case added, words
  corrected;
- **minor**: an optional data key or parameter added, a choice added, a slot's
  `max` raised; every existing case still passes as it is;
- **major**: anything that refuses or redraws a stored Document (a key removed
  or renamed, a new required key, a choice removed, the HTML of an existing
  case changed). Under the same name that needs the host to migrate its
  Documents first; otherwise it is a new type name, and the old one stays
  registered while Documents hold it.

A drift shows in the check as `case_html_mismatch`: either the renderer is
wrong, or the change is meant, the cases are rewritten with `--update` and the
version moves.

## Unknown types stay opaque

A host that does not know a type never guesses it:

- `validate` reports `type_unknown` at the node, the Document is invalid, and
  `render` draws nothing: a page is never half drawn;
- the content editor sf-editor-content (formerly sf-content-editor) shows an
  unknown node as a placeholder with its type name, keeps its data and slots
  byte for byte, and only moves or removes it whole; the inline editor does
  the same with an inline entry it does not know;
- nothing is dropped silently: the host learns of an unknown type when it
  validates, not by losing it.

So a Document holding a block survives a host without the block, and comes
back unchanged when it is saved there. The check asks this of the runtime: a
host without the block refuses the case Document whole (`unknown_not_refused`,
`unknown_drawn`), a type the block does not know inside its slot is refused
the same way and kept as it came (`unknown_child_accepted`,
`unknown_child_drawn`, `unknown_child_changed`), and the renderer leaves every
node byte for byte (`renderer_mutates_node`).

## The check

`node kits/block/check.mjs <block folder>` runs five groups on the SIMAI
Framework's own Composition runtime:

| Group | Asks |
|:---|:---|
| `manifest` | `type.json` against the published schema, the namespace, closed schemas with the validator's keywords, `editor.json` by `validateEditorManifest` and the field kinds |
| `renderer` | `renderer.mjs` exports a function; unregistered the type draws nothing, registered it draws the block with its id and its slots |
| `form` | every required scalar has a field, the form builds for every node in the cases, every offered value keeps the Document valid, the words |
| `output` | every case under the conformance kit's rule: `valid`, the HTML (`contracts/conformance/structured-content/README.md`, "Comparing HTML"), the diagnostics, the assets; every output and every hostile value drawn safely |
| `unknown` | the opaque rule above |

A group that cannot run says so (`SKIP`, with the reason) and the block does
not pass. A warning (`WARN`) names something worth adding: a parameter with
no field, a choice no case draws, a missing word, no case the block refuses.

```text
SIMAI Framework block check: sample.quote 1.0.0 (kits/block/examples/sample-quote)
  PASS  manifest  the type and editor manifests are valid
  PASS  renderer  the renderer is registered and draws the block
  PASS  form      the parameter form builds from the editor manifest
  PASS  output    JSON to HTML gives the expected output, and the output is safe
  PASS  unknown   an unknown type stays safe, the block is kept byte for byte
BLOCK_CHECK_PASS sample.quote@1.0.0 groups=5 cases=7 warnings=0
```

The exit code is 0 when the block passes, 1 when it does not, 2 when the
check could not run. `tests/block-author-kit.test.mjs` runs the check on the
sample and the template and on broken copies of the sample.
