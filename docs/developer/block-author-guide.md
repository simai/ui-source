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
<dir>` runs it against another SIMAI Framework: its `src/` folder or a built
distribution (`--framework ../ui/distr`), the folder that holds
`core/js/composition/index.mjs`. A checkout root is read as its `src/`; any
other folder is refused (`block_check_framework_missing`). `--json` prints
the report as JSON.

## The files of a block

| File | Format | Holds |
|:---|:---|:---|
| `type.json` | `simai.composition.type-manifest` v1 (`src/core/contracts/composition-type-manifest.v1.schema.json`) | name, version, category, mode, profiles, `data_schema`, `props_schema`, slots, renderer, assets |
| `editor.json` | `simai.composition.editor-manifest` v1 | one field per parameter |
| `words.json` | `simai.composition.editor-words` v1 | the words of the fields, by locale |
| `renderer.mjs` | an ES module | `export default ({node, slots, locale}) => html` |
| `style.css` | CSS | the block's own sheet, one of its assets |
| `cases/*.json` | `simai.composition.structured-content-conformance-case` v1 | a Document and what it draws |

`kits/block/examples/sample-cards/` shows what the one block editor reads
from a block (since core.runtime 1.23.0, type manifest schema 1.3.0): its
place in the catalogue, its variants, layout parameters as SIMAI Framework
utilities, a named place and data from a host. The sections from
"The catalogue and variants" on describe them.

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

## The catalogue and variants

The one block editor (owner, 2026-11-03) offers blocks from one catalogue
with two tabs: **Text** (what is written into a text flow) and **Blocks**
(what a page is built from). A type says where it stands:

```json
"catalogue": {"group": "data", "label_key": "sample.cards.name",
              "keywords": {"en": ["cards", "news"], "ru": ["карточки", "новости"]}}
```

- `group` is one of the fixed groups `text`, `media`, `structure`,
  `page-parts`, `marketing`, `data`, `forms`, or the type's own namespace
  (`acme` for `acme.*`): a product adds its own group and never edits the
  fixed list (`catalogue_group_unknown`). `category` keeps its meaning
  (`layout`, `content`, `component`, `smart`: what a slot accepts).
- `tab` is `text` or `blocks`; by default `text` for the text and media
  groups, `blocks` otherwise.
- `label_key`, `help_key`, `keywords` per locale (search reads names,
  keywords and the group in both languages), `preview` (an image address)
  and `order` (0 to 1000).

A type without `catalogue` falls into its namespace's group; the check warns
(`catalogue_missing`). The SIMAI Framework's own types stand in the table
`BUILTIN_CATALOGUE` (`src/core/contracts/composition-blocks.v1.json`).

A **variant** is a named starting state of a type: parameters, data and the
child blocks it is inserted with. A new kind of header is a variant, not a
new type; a new type is needed only when the data or the renderer differs.

```json
"variants": [
  {"id": "three-columns", "label_key": "sample.cards.three_columns",
   "props": {"cols": {"xs": 1, "md": 2, "lg": 3}},
   "slots": {"intro": [{"id": "title", "type": "content.heading", "data": {"level": 2, "content": [{"type": "text", "value": "News"}]}}]}}
]
```

`SF.Composition.instantiateVariant(type, id, {id})` makes the node to insert:
every child gets a new id (`<id>-<child id>`) and a runtime link between them
follows. The check makes each variant into a node and validates it as a
Document of the type's first profile: a variant the type refuses fails the
`manifest` group (`$.variants.<id>...`). A saved block (a site's snapshot)
is the host's, not the manifest's.

An editor that inserts a block from a variant records it in the node's
extension `simai.composition:variant` as `{"id": "<variant id>"}`,
so any editor can show which values came from the variant. A renderer
ignores it.

## Layout parameters as utilities

A layout parameter keeps a **value** in the Document, never a class: `cols:
3`, on the tablet 2, on the phone 1. The parameter declares the SIMAI
Framework utility it becomes:

```json
"cols": {"type": "integer", "minimum": 1, "maximum": 4,
         "x-simai-utility": {"class": "grid-col-{value}", "responsive": true}},
"gap":  {"type": "integer", "minimum": 0, "maximum": 8, "default": 3,
         "x-simai-utility": {"class": "gap-{value}", "responsive": true}},
"hidden": {"type": "boolean", "default": false,
         "x-simai-utility": {"values": {"true": "hidden", "false": "block"}, "responsive": true}}
```

- `class` is a utility name ending in `{value}`; `values` maps each value to
  one class (or none). The names are the SIMAI Framework's own:
  `grid-col-*` (grid-template-columns), `col-span-*`, `gap-*`, `p-*`,
  `p-x-*`, `p-y-*`, `grid`, `flex`, `block`, `hidden`. The check prints every
  class a parameter can print, at every screen, and holds each to the
  utility rules (`utility_class_unknown`).
- `responsive: true` lets the node hold one value per screen, keyed by the
  SIMAI Framework breakpoints `xs` (the phone, no prefix), `sm`, `md` (the
  tablet), `lg` (the desktop), `xl`, `xxl`: `{"cols": {"xs": 1, "md": 2,
  "lg": 3}}`. A scalar stands for every screen. Each value is checked by the
  property's schema; another key is refused (`breakpoint_unknown`).

The runtime prints the classes mobile first, a prefix only where the value
changes, and puts them on the element that carries the node's
`data-sf-composition-id`: `grid-col-1 md:grid-col-2 lg:grid-col-3 gap-6`. At
the phone a value equal to the property's `default` prints nothing: the
block draws its default without a class. The renderer writes no grid, gap,
padding or visibility of its own and never an inline style for them; it gets
the printed classes as `utilities` if it needs to know them. The block's own
look (its colours, a picture's ratio) stays its sheet.

The parameter form shows the phone's value and lists the screens that differ
(`projectEditorFields` gives each such field `screens`), so the editor offers
a per-screen switch. `layout.area`, the text area of a layout, declares its
`padding` and `hidden` this way, and `layout.columns` (1.1.0) its `columns`
and `gap`: `{"columns": {"xs": 1, "md": 2, "lg": 3}, "gap": {"xs": 2, "md":
4}}` draws `grid md:grid-col-2 lg:grid-col-3 gap-2 md:gap-4`. A Document
written for `layout.columns` 1.0.0 (one integer for every screen, no gap)
stays valid and draws that many columns on every screen with the type's own
gap (`gap-4`).

## Parameter sets

A block that takes the usual layout parameters names their **sets** instead
of declaring them again:

```json
"parameter_sets": ["background", "spacing", "width", "grid", "alignment", "breakout", "visibility"]
```

| Set | Parameters | Prints |
| --- | --- | --- |
| `background` | `background`: surface, container, primary, secondary, tertiary | `bg-surface`, `bg-surface-container`, `bg-primary-container`, … |
| `spacing` | `padding_y`, `padding_x`: 0..8, per screen | `p-y-*`, `p-x-*` |
| `width` | `width`: narrow, normal, wide, full (default) | on three elements, see below |
| `grid` | `columns` 1..12 (default 1), `gap` 0..8, per screen | `grid grid-col-*`, `gap-*` on the `content` part |
| `alignment` | `align`: start, center, end, per screen | `text-*` |
| `breakout` | `breakout`: true or false | `container-breakout` |
| `visibility` | `hidden`: true or false, per screen | `hidden` / `block` |

A registry (`extendRegistry`) adds the sets' properties to the type's
`props_schema`; the stored `type.json` keeps the names. A property the type
declares itself under a set's name is refused (`parameter_set_conflict`).
The fields come with the sets and their words are the SIMAI Framework's:
`SF.Composition.withParameterSetFields(editor, type)` adds them after the
block's own fields (the check does the same), so `editor.json` lists only the
block's own.

`width` and `grid` place classes on **parts**, inner elements the renderer
marks with `data-sf-composition-part`, because the container utilities work
across elements (measured, `docs/foundation-container-width.md`): a
container is centred by `m-inline-auto`, `max-container-N` widens a container
that is its descendant, and `container max-w-prose` on one element depends on
the order of the sheets.

| width | block element | `frame` | `content` |
| --- | --- | --- | --- |
| narrow | | `container m-inline-auto` | `max-w-prose m-inline-auto` |
| normal | | `container m-inline-auto` | |
| wide | `max-container-7` | `container m-inline-auto` | |
| full | | | |

The renderer draws the parts around its slots when those parameters are set,
before any child:

```js
const framed = ['width', 'columns', 'gap'].some((key) => node.props?.[key] !== undefined);
const inner = framed
  ? `<div data-sf-composition-part="frame"><div data-sf-composition-part="content">${slots.default || ''}</div></div>`
  : (slots.default || '');
return `<section data-sf-composition-id="${escapeHtml(node.id)}">${inner}</section>`;
```

A part the renderer does not draw gets nothing: its classes are left out and
reported (`utility_part_missing`; the check: `renderer_part_missing`).
`layout.section` 1.1.0 takes all seven sets this way.

A utility declaration may itself name a `part`, and `x-simai-utility` may be a
list of declarations (one per part); a value may become several classes
(`"grid grid-col-{value}"`), and a class a wider screen shares with a narrower
one is not printed again (`md:grid md:grid-col-2 lg:grid-col-3`).

## Smart elements in a block

A renderer may print `sf-button`, `sf-button-icon`, `sf-badge`, `sf-icon` and
the `sf-divider` class component, with the inputs their `smart.manifest.json`
declares and nothing else:

```js
export default function render({ node, elements }) {
  return `<div data-sf-composition-id="${escapeHtml(node.id)}">${elements.print('sf-button', { text: node.data.action, appearance: 'tonal' })}</div>`;
}
```

`elements.print(name, inputs)` (and `SF.Composition.printElement`) writes the
attributes in a fixed order, leaves out a value equal to the input's default
and prints a boolean only when true. An input the manifest does not take, a
value it refuses or a missing label (`sf-button` needs `text` or
`aria-label`, `sf-button-icon` an `aria-label`) prints nothing and is a
render diagnostic. Not printed: `root-style` (an inline style), `root-class`
(free classes), `template`, runtime state and the legacy and alias names (the
manifest marks them). `PRINTED_ELEMENTS` names the elements and
`elementInputs(name)` their inputs; the table is generated from the manifests
(`src/core/js/composition/elements.generated.mjs`).

HTML a renderer writes by hand is read the same way:
`SF.Composition.checkPrintedElements(html)` reports every attribute those
manifests do not take, an inline style and a refused value; the check runs it
over every case (output group). `class`, `id`, `slot` and `data-*` stay host
attributes.

## Own modifiers

Every block has one more field the author may fill: classes of their own,
with a screen prefix (`md:p-x-3`, `hidden`, `lg:gap-2`). They live in the
node's extension, not in its props:

```json
"extensions": {"simai.composition:modifiers": {"utilities": ["md:p-x-3", "lg:gap-2"]}}
```

Each class is checked against the RuleLoader's utility rules (`SF.RuleLoader`
on a page, `options.utilityRules` on a server). A class no rule knows is left
out of the HTML and reported in the result's `notices`
(`modifier_unknown`); it never refuses the Document. Without the rules
nothing unchecked is printed (`modifier_rules_unavailable`). A block needs
nothing for this: the classes join the element with its node id, as the
layout utilities do. `SF.Composition.checkModifiers(classes, {rules})` is the
editor's check while the author types.

## Named places

A block with places (a split hero: text and a picture) gives each place a
slot. Each slot says what it accepts and how the editor names it:

```json
"slots": {
  "intro": {"min": 0, "max": 5, "categories": ["content"], "groups": ["text"],
            "label_key": "sample.cards.intro", "empty_key": "sample.cards.intro_empty"}
}
```

- `types`, `categories` and, since schema 1.3.0, `groups` (catalogue groups)
  decide what may stand there; a child of another group is refused
  (`slot_child_group_forbidden`). The editor hides what a place cannot
  accept: `SF.Composition.catalogue(registry, {parent, slot})` lists only
  those, and a tab with nothing that fits is left out.
- `label_key` names the place; `empty_key` is what an empty place offers
  (“A picture or a video”). `slotPlaces(type)` lists them.

## Data from a host

A block never fetches. It declares which **shape** of data it takes, and the
host decides where the data comes from:

```json
"data_bindings": {"items": {"shapes": ["cards"], "empty_key": "sample.cards.empty"}},
"runtime": {"publishes": {"pagination": {"shape": "pagination", "binding": "items"}}}
```

- **Shapes** are small named contracts: `item`, `cards`, `gallery`,
  `section_title`, `menu`, and the runtime state `pagination`
  (`SF.Composition.DATA_SHAPES`). A host adds its own as `<owner>.<name>`
  (`createShapeRegistry`) and never changes these.
- **A binding** is the node's `bindings` entry of composition-document v1:
  `{owner, ref, target, revision}`, `ref` naming a source the host defines,
  `target` a key of `data_bindings`. What the host needs beside it lives in
  the extension `simai.composition:data`, keyed by the target: `shape`,
  `preset`, `mapping` (shape field to source field, e.g. `{"image":
  "PREVIEW_PICTURE"}`), `filter`, `sort`, `limit`, `page_param`, `params`
  (`{from: url | context | route, key}`) and `empty_text`. Only the host reads
  the query.
- **The source port** is what an editor asks a host: which sources give this
  shape, which fields a source has, and preview data for a binding.
  `SF.Composition.createSourcePort({sources, fields, preview})` checks every
  answer; Bitrix, Larena and the mail editor each implement the three
  functions.
- **Runtime links**: a pagination binds to the list's state with `{owner:
  "section", ref: "<list id>#pagination", target: "pagination"}`; the runtime
  resolves it inside the same section, never the host. The publishing type
  declares `runtime.publishes`, the accepting one `runtime.accepts`.

At render the host gives the data through `resolveBinding(binding, {node,
shape, settings})`. The renderer gets `resolvedBindings.<target>` and
`bindingStates.<target>`, one of `loading` (no answer yet), `empty`,
`error`, `ready` and `preview` (`render(..., {preview: true})`, demo data in
the editor). A source that throws, or answers outside its shape, leaves its
block in `error` (`binding_failed`, `binding_shape_mismatch`) and the page
still draws. The render result lists the runtime links in `runtime` for the
page to keep them live.

The check draws a data block in every state, with demo data of its shape
(`SF.Composition.demoData(shape)`) and with a hostile answer (markup in every
text, `javascript:` in every address): the block draws its element in each
state (`data_state_not_drawn`), and a host's answer is text the renderer
escapes and addresses it checks.

## Site blocks

The editor's block builder makes a **site block**: a type of the site's
catalogue (`site.*`) composed of existing blocks, with the parameters an
author may set. It is not written by hand:

```js
const {manifest, diagnostics} = SF.Composition.defineComposedType({
  type: 'site.promo', version: '1.0.0', profiles: ['ui-layout'],
  catalogue: {group: 'marketing', label_key: 'site.promo.name'},
  root: {id: 'box', type: 'layout.area', props: {padding: 4}, slots: {default: [/* heading "title", paragraph "lead" */]}},
  exposed: [{key: 'padding', path: 'box', target: 'props.padding'}],
}, registry);
```

The manifest's `composed.root` is the tree and `exposed` the parameters;
their schema is their target's, their default the tree's value, and the
renderer is the SIMAI Framework's `composed`. On a page an instance is
closed: it stores its type, the version it was written against (extension
`simai.composition:composed`), the exposed values in `props` and the texts
by path in `data.texts` (`"title/content": [...]`), nothing else. It draws
the type's **current** tree, so a new version reaches every instance while
the author's texts and values stay; the drawn ids are `<instance
id>:<tree id>`, so an editor maps a click back to a text path
(`composedPart`). A text whose block a new version removed is kept and not
drawn (`composed_text_orphaned`); `SF.Composition.upgradeComposed(document,
registry)` moves every instance to the current version and reports what it
dropped. The check accepts a site block's `type.json` (renderer `builtin`
`composed`) and holds its tree and its parameters to the definition
(`composed_schema_drift`).

### The form of a site block

A site block has no `editor.json`. Its form is its `exposed` list, each
parameter drawn by the field its target type's editor manifest declares for
that target, renamed to the exposed key and pointed at the instance's
`props.<key>`; the words are the exposed `label_key`, else the target
field's; the default is the tree's value:

```js
const form = SF.Composition.composedEditorFields(manifest, instance, {registry, editorManifests});
// form.manifest: an editor manifest v1 of the site block's version, made fresh, never stored
// form.fields:   projected as projectEditorFields does (value, source, screens)
// form.origins:  {padding: {path: 'box', type: 'layout.area', target: 'props.padding'}}
```

`editorManifests` are the product blocks' editor manifests (the SIMAI
Framework's own are always read). A target whose type declares no field for
it has no form field: `composed_editor_field_missing`, a warning in the
check. Texts are not in the form; the editor edits them in place by their
path.

### Where site blocks live

The host stores a site's blocks in the **site's scope**: the type manifests
the block builder made (each version an author saved stays, so an instance
written against an older one still names it) and their words. The SIMAI
Framework keeps no copy and no global catalogue of them. A site moves its
blocks with an **export file**:

```json
{
  "schema": "simai.composition.site-blocks",
  "schema_version": 1,
  "site": "example.com",
  "exported_at": "2026-11-03T12:00:00Z",
  "types": [ { "type": "site.promo", "version": "1.1.0", "composed": {"root": {}}, "exposed": [] } ],
  "words": { "en": {"site.promo.name": "Promo"}, "ru": {"site.promo.name": "Промо"} }
}
```

- `types` holds whole type manifests as `defineComposedType` returned them,
  the current version of each block (an older version only while a stored
  Document still names it).
- `words` holds the keys the manifests name (`catalogue.label_key`,
  `exposed[].label_key`), per locale.
- On import the host remakes each manifest with `defineComposedType` from its
  `type`, `version`, `profiles`, `category`, `catalogue`, `composed.root` and
  `exposed` against its own registry, and refuses one that differs
  (`validateTypeManifest` reports `composed_schema_drift`) or whose tree names
  a type the site does not have. A type already present at the same version
  with other content is a conflict the host shows; it is never overwritten
  silently.
- The file holds no Documents, no data and no secrets: pages move with their
  own export.

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
| `manifest` | `type.json` against the published schema, the namespace, closed schemas with the validator's keywords, the catalogue place, each variant as a Document, every utility a parameter prints, the data shapes, a site block's tree; `editor.json` by `validateEditorManifest` and the field kinds |
| `renderer` | `renderer.mjs` exports a function; unregistered the type draws nothing, registered it draws the block with its id and its slots |
| `form` | every required scalar has a field, the form builds for every node in the cases, every offered value keeps the Document valid, the words |
| `output` | every case under the conformance kit's rule: `valid`, the HTML (`contracts/conformance/structured-content/README.md`, "Comparing HTML"), the diagnostics, the assets; every output and every hostile value drawn safely; a data block in every state |
| `unknown` | the opaque rule above |

A group that cannot run says so (`SKIP`, with the reason) and the block does
not pass. A warning (`WARN`) names something worth adding: a parameter with
no field, a choice no case draws, a missing word, no case the block refuses.

```text
SIMAI Framework block check: sample.quote 1.1.0 (kits/block/examples/sample-quote)
  PASS  manifest  the type and editor manifests are valid
  PASS  renderer  the renderer is registered and draws the block
  PASS  form      the parameter form builds from the editor manifest
  PASS  output    JSON to HTML gives the expected output, and the output is safe
  PASS  unknown   an unknown type stays safe, the block is kept byte for byte
BLOCK_CHECK_PASS sample.quote@1.1.0 groups=5 cases=7 warnings=0
```

The exit code is 0 when the block passes, 1 when it does not, 2 when the
check could not run. `tests/block-author-kit.test.mjs` runs the check on the
samples and the template and on broken copies of the samples.
