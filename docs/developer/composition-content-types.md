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
| `content.html` | `markup` | | | the html@1 subset of sf-rich-text |
| `content.diagram` | `source` | `engine` (mermaid), `title` | | a renderer the host registers |
| `content.math` | `source` (TeX) | `label` | | a renderer the host registers |
| `content.outlet` | | | | where a layout draws the page's content |

Inline content (`content`, `title`, `summary`, `caption`, table cells) is the
inline model of `content.paragraph`: text runs with `strong`, `em`, `code`,
links of text runs and the inline component atoms. Every link and every image
source follows the Document's URL rule (relative, a fragment, http(s), mailto,
tel); anything else is `unsafe_url`.

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

## Editor manifests

Each type with parameters has an editor manifest
(`composition-editor-manifests.v1.json`): one field per parameter with its
`key`, `plane`, `choices`, `default` and `visibility`, each mapped to one
published field kind (choice, integer, text, toggle).

## Checks

- `tests/composition-content-types.contract.test.mjs`: every type positive and
  negative, every renderer's HTML pinned, html cleaning, native details, the
  outlet, diagram and math, the editor manifests, and every class a renderer
  writes named by a utility rule or a component sheet.
- `tests/browser/composition-content-types.browser.mjs`: the Document holding
  every type (`tests/fixtures/composition/structured-content.json`) drawn on
  the built bytes, light and dark, at 1280 and 390 px, with no horizontal
  overflow; the details open with script disabled.
- `tests/browser/card.browser.mjs`, `figure.browser.mjs`,
  `procedure.browser.mjs`: the three display parts on their built sheets.

Regenerate the registries after changing a manifest:

```bash
npm run composition:build
```
