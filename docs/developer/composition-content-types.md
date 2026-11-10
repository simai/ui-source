# Composition content types

Page content is a Composition Document with the profile `structured-content`
(content standard, owner's decision 2026-10-31). It shares the Document v1
schema, ids, validation, canonical form and digest with a layout; the content
types are additive entries of `composition-types.v1.json`, each at 1.0.0. The
Recipe contract and its digest are unchanged.

```json
{
  "schema": "simai.composition.document",
  "schema_version": 1,
  "id": "guide",
  "profile": "structured-content",
  "root": {
    "id": "root",
    "type": "content.document",
    "data": {"title": "Getting started"},
    "slots": {"default": [
      {"id": "a", "type": "content.alert", "props": {"status": "warning"}, "data": {"title": [{"type": "text", "value": "Before you start"}]},
       "slots": {"default": [{"id": "a1", "type": "content.paragraph", "data": {"content": [{"type": "text", "value": "Save your work."}]}}]}}
    ]}
  }
}
```

A node is a call: `data` is its content, `props` its parameters, written only
when they differ from the default. Where a SIMAI Framework component has a word
for a parameter, the type uses it; elsewhere Docara's names stand.

| Type | Data | Props | Slots | Draws with |
|:---|:---|:---|:---|:---|
| `content.document` | `title` | | `default` | `article`, the title an `h1` |
| `content.list` | | `ordered`, `start` | `items`: `content.list-item` | `ul` / `ol` |
| `content.list-item` | `content` (inline) | | `default`: nested blocks | `li` |
| `content.quote` | | | `default` | `blockquote` |
| `content.code` | `code` | `lang`, `title`, `numbers` | | component `highlight` (`pre > code`, `data-lang`, `data-lines`) |
| `content.divider` | | | | component `contentDivider` (`hr.sf-divider`) |
| `content.table` | `rows` (cells inline), `caption` | `header` (row, column, both, none), `align` | | utility `table-frame` |
| `content.figure` | `src`, `alt`, `width`, `height`, `caption` | `ratio` (auto, 1/1, 4/3, 3/2, 16/9, 21/9), `fit` (cover, contain) | | component `figure` |
| `content.alert` | `title` (inline) | `status` (neutral, info, success, warning, error), `appearance` (default, outlined, flat) | `default` | component `alerts` (sf-alert's classes) |
| `content.details` | `summary` (inline) | `open`, `layout` (surface, lines) | `default` | native `details`: opens with no script |
| `content.tabs` | `label` | | `tabs`: `content.tab` | component `tabs` (`.sf-tabs`) |
| `content.tab` | `label` | | `default` | a `.sf-tabs-main-tab` panel |
| `content.steps` | | `current`, `layout` (timeline, list) | `steps`: `content.step` | component `procedure` |
| `content.step` | `title` (inline) | | `default` | `.sf-procedure-step` |
| `content.grid` | | `columns` (1-4), `gap` (0-4) | `default` | `grid` and `grid-col-*` utilities, one column on a phone |
| `content.card` | | `variant` (default, plain) | `default` | component `card` |
| `content.media` | `src`, `alt`, `width`, `height` | `side` (left, right), `ratio` | `default` | `grid` utilities and component `figure` |
| `content.file` | `href`, `value`, `label`, `mime`, `size` | | | component `download-file` (`a.sf-download-file[download]`) |
| `content.html` | `markup` | | | the html@1 subset of sf-rich-text |
| `content.diagram` | `source` | `engine` (mermaid), `title` | | a renderer the host registers |
| `content.math` | `source` (TeX) | `label` | | a renderer the host registers |
| `content.outlet` | | | | where a layout draws the page's content |

Inline content (`content`, `title`, `summary`, `caption`, table cells) is the
inline model of `content.paragraph`: text runs with `strong`, `em`, `code`,
links of text runs and the inline component atoms. Every link and every image
source follows the Document's URL rule (relative, a fragment, http(s), mailto,
tel); anything else is `unsafe_url`.

No rendered HTML carries a `style` attribute: a `content.table` column aligned
`center` or `end` puts the text-align utility class (`text-center`,
`text-end`) on its cells, which the `table-frame` sheet honours from the first
paint (`content.table` 1.0.1). `style` is a forbidden key anywhere in a
Document (`executable_or_secret_field_forbidden`), as `class` is. A Document
whose `profile` is unknown gets one `profile_unknown`; its nodes are then not
checked against a profile.

## Rules beyond a type's schema

- `content.list-item`, `content.tab` and `content.step` stand only in their own
  parent (`content_parent_invalid`).
- A layout holds at most one `content.outlet` (`outlet_duplicate`); the outlet
  is a `ui-layout` type only.
- `content.html` is the explicit escape hatch: its markup is cleaned at render
  by the one html@1 rule (`src/core/js/composition/html-subset.mjs`, which
  sf-rich-text re-exports): `p h2 h3 h4 strong em a[href] ul ol li blockquote
  br`, nothing else, no attribute but a safe `href`. Its key is `markup`:
  `html` is refused anywhere in a Document. A converter never produces it by
  accident: it is written only when an author asks for raw markup.

## Pasting into structured content

html@1 is a stored type and does not grow: a value never holds `pre` or
`table`. A structured-content editor reads a paste with the subset's paste
profile, which is html@1 plus two blocks it maps to its own types instead of
flattening them into paragraphs:

```js
import {cleanTree, parseHtml, treeFromDom} from 'core/js/composition/html-subset.mjs';
const blocks = cleanTree(treeFromDom(template.content), {mode: 'value', profile: 'paste'});
// html@1 blocks (p, h2-h4, blockquote, ul, ol) and:
// {type: 'pre', text}                  -> content.code {data: {code: text}}
// {type: 'table', caption, rows}       -> content.table {data: {caption, rows}}
//   rows: [{head, cells: [{header, leaves}]}]; a head row or header cells
//   suggest props.header 'row' or 'column'
```

- `pre` (and `listing`) keeps its text with its line breaks and indentation; a
  `<br>` is a line break, the newline right after `<pre>` and trailing blank
  lines are dropped, marks inside are dropped (code is text).
- A simple table: `thead`, `tbody`, `tfoot` or rows straight in the table,
  cells `th` and `td`, an optional `caption`. A cell's content is the subset's
  inline leaves (strong, em, safe links); its paragraphs and list items are
  lines of it. `colspan` and `rowspan` are not read. A row with no text is not
  kept, nor a table without one.
- Everything inside is cleaned by the one rule: the same marks, the same href
  check, `script` and the other dropped elements go with their content.
- A `pre` or a `table` inside a list item, and a table inside a cell, are read
  as html@1 reads them.
- `serialize` writes the two blocks in html@1 terms (the lines of one
  paragraph, a paragraph per cell), so its output is still the subset; a
  profile other than `html` or `paste` throws `rich_text_profile_unknown`.

The mapping to Document nodes is the editor's: the content model's limits
(1000 rows, 50 cells, 200000 characters of code) apply there.

## A file to download

`content.file` (1.0.0, after the first edition) is a file a reader downloads;
`content.media` is a picture that stands in the page. Its data is the shape
the SIMAI Framework already uses for a stored file (the property-view `file`
type, sf-image-field's value):

| Key | | Meaning |
|:---|:---|:---|
| `href` | required | the address the file is fetched from; the Document's URL rule, else `unsafe_url` |
| `value` | | the host's own reference to the stored file (an id, a key); stored, never drawn |
| `label` | | the name shown; without one, the last part of `href`, decoded, without its query and fragment |
| `mime` | | the media type, lowercase `type/subtype` with no parameters (`application/pdf`) |
| `size` | | bytes, a whole number |

```json
{"id": "report", "type": "content.file", "data": {"value": "file-42", "href": "/files/report.pdf", "label": "Annual report.pdf", "mime": "application/pdf", "size": 1468006}}
```

It draws sf-download-file's row as static HTML, with no script: an
`<a class="sf-download-file" href download type>` holding the icon of the
file's kind, the name and the size. The size reads in the Document's
`locale` by the rule sf-image-field uses (`composition/file-size.mjs`):
`1.4 MB` in English, `1,4 МБ` in Russian; another language takes its own
digits and the English unit words. The icon follows the media type:
`picture_as_pdf`, `image`, `movie`, `audio_file`, `folder_zip` (archives),
`table_chart` (spreadsheets and CSV), `slideshow` (presentations),
`description` (text and documents), else sf-download-file's own `download`.
The table is exported from `composition/file-size.mjs` as `FILE_ICONS`
([pattern, icon] pairs, the first match wins) with `fileIcon(mime)`, so an
editor that draws the same row takes the same icon without keeping a copy.
Its editor manifest has two text fields, `label` and `href`.

## Diagram and math

A diagram engine and a TeX typesetter are runtimes the SIMAI Framework does not
carry, so `content.diagram` and `content.math` are registered types: their
renderer kind is `registered` and the host supplies it, loading its assets on
demand (`composition/diagram`, `composition/math` are listed in the render
result's `assets`).

```js
const registry = SF.Composition.extendRegistry([], {
  'content.diagram': ({ node }) => drawDiagram(node.data.source, node.props),
  'content.math': ({ node }) => typeset(node.data.source, node.props),
});
const { html } = await SF.Composition.render(document, { registry });
```

Without one, `render` reports `renderer_unavailable` for the node and draws
nothing in its place.

## The page in a layout

`layout.region` names an area of a layout whose nodes are the layout's own; it
does not stand for a Document that comes from elsewhere. `content.outlet` does:
one layout serves many pages, and a page's author cannot change the layout.

```js
const { html } = await SF.Composition.render(layout, { content: pageDocument });
```

The page Document must be `structured-content` (`outlet_content_invalid`
otherwise); it is validated and rendered with the same registry, its
diagnostics are reported under `$.content`, and its assets join the layout's.
An invalid page draws nothing in the outlet.

## Drawing on a host's canvas

`layout.page` is the Document's main landmark: `render` draws it as `<main>`,
and a `layout.region` with `landmark: main` as `<main>` too. A host that shows
the Document inside its own page -- an editor's canvas, a preview pane --
already has a `main`, and a second one nested in it is an accessibility error
(`landmark-main-is-top-level`, `landmark-no-duplicate-main`). Such a host
renders embedded:

```js
const { html } = await SF.Composition.render(document, { registry, options: { embedded: true } });
```

Embedded, `layout.page` and a main region are drawn as `<div
data-sf-composition-landmark="main">` with the same id, children and classes;
every other element, the digest and the diagnostics stay as they are. The
default, `embedded: false`, is what a publishing host keeps. Anything but a
boolean throws `composition_embedded_invalid`. A layout's page content in a
`content.outlet` is drawn with the same option.

## Layout styles

`layout.columns` lists the asset `composition/layout`. Its styles are part of
`core/css/core.css`: a page that loads the core sheet draws the columns side
by side -- as many as `data-composition-columns` says, one where the columns
are set per screen, with the type's gap. The `grid`, `gap-*` and `grid-col-*`
utilities the renderer also prints are brought by the Loader where it runs and
win over the core sheet (it stands in the `sf.base` layer), so a column count
per screen applies there. A host needs nothing else for `composition/layout`.

## Text areas in a layout

For the one block editor (owner, 2026-11-03) a page keeps layout and content
in one Document: the author writes in `layout.area` nodes, and a page may
hold several. A text area takes content and Smart blocks (`categories:
content, smart`), not layout, and draws a plain `<div
data-sf-composition-area>`. Its `padding` (0 to 8) and `hidden` are layout
parameters held per screen and printed as SIMAI Framework utilities, never
inline styles:

```json
{"id": "main", "type": "layout.area", "props": {"padding": {"xs": 2, "lg": 4}, "hidden": {"md": true, "lg": false}}}
```

draws `<div class="md:hidden lg:block p-2 lg:p-4" data-sf-composition-area=""
data-sf-composition-id="main">`. Which nodes an author may write in is the
host's right to grant; the editor reads `layout.area` (capability
`content-area`) as the places it offers. `content.outlet` stays for a layout
that draws a separate page Document. The rules of layout parameters, own
modifiers, named places, site blocks and data are in
`block-author-guide.md`.

## Editor manifests

Each type with parameters has an editor manifest
(`composition-editor-manifests.v1.json`): one field per parameter with its
`key`, `plane`, `choices`, `default` and `visibility`, each mapped to one
published field kind (choice, integer, text, toggle). Every data field a type
requires has a field, so a parameters form drawn from the manifest alone is
complete: `content.figure` and `content.media` offer `src` (a text field up to
2048 characters; `validate` applies the Document's URL rule) beside `alt`.

## Checks

- `tests/composition-content-types.contract.test.mjs`: every type positive and
  negative, every renderer's HTML pinned, html cleaning, native details, the
  outlet, diagram and math, the editor manifests, and every class a renderer
  writes named by a utility rule or a component sheet.
- `tests/browser/composition-content-types.browser.mjs`: the Document holding
  every type (`tests/fixtures/composition/structured-content.json`) drawn on
  the built bytes, light and dark, at 1280 and 390 px, with no horizontal
  overflow; the details open with script disabled.
- `contracts/conformance/structured-content/`: the conformance kit, the
  Documents any renderer of structured content must draw and what it must
  draw (every type with its defaults and each parameter value, the inline
  model, escaping, the html@1 cleaning, the outlet, invalid Documents and
  their diagnostics), with its comparison rule in its README. A renderer in
  another language passes the same kit. `node
  scripts/generate-structured-content-conformance.mjs` writes it from the JS
  renderer, `--check` verifies it, and
  `tests/structured-content-conformance.contract.test.mjs` runs the JS
  renderer over it.
- `tests/browser/card.browser.mjs`, `figure.browser.mjs`,
  `procedure.browser.mjs`: the three display parts on their built sheets.

Regenerate the registries after changing a manifest:

```bash
npm run composition:build
```
