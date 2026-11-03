# Composition editor field kinds

Field kinds give every `simai.composition.editor-manifest.v1` field fixed value,
default, normalization, validation, accessibility, theme, localization and
server-fallback rules. The normative text, fixtures and lock live in
`src/core/contracts/composition-editor-fields-v1/`; the registry is
`src/core/contracts/composition-editor-field-kinds.v1.json`.

| Kind | Property | Example field |
| --- | --- | --- |
| `choice` | string with choices | `layout.region.placement`, `layout.section.surface` |
| `integer` | integer@1 | `layout.columns.columns`, `layout.columns.gap` (1.1.0), `content.heading.level` |
| `text` (new) | string@2 without choices | `layout.region.label` |
| `toggle` (new) | boolean@1 | `layout.region.sticky` |

A kind is derived from the Property identity and `choices`; the editor manifest
format is unchanged. `SF.Composition.validateFieldKinds(manifest)` adds kind
rules on top of `validateEditorManifest`.

Server fallback and saving:

```js
const {fields} = SF.Composition.projectEditorFields(manifest, typeManifest, node, {propertyTypes});
const html = fields.map((field) => SF.Composition.renderFieldFallback(field, {instance: node.id, messages})).join('');
// On submit, for every rendered (non-hidden) field:
const result = SF.Composition.parseFieldSubmission(field, formData.get(`${node.id}.${field.plane}.${field.target}`));
if (!result.error) node = SF.Composition.applyFieldValue(node, field, result);
```

`text` keeps the exact string (no trimming, no Unicode normalization), rejects
control characters and counts code points; an empty value removes the key.
`toggle` stores only `true`; unchecking removes the key, so the digest equals a
never-set value. Validate the resulting Document before saving.

## Words of the built-in editor manifests

Every `label_key`, `help_key` and choice of the built-in editor manifests has a
word in English and Russian. A choice that is a stable segment reads
`<label_key>.<choice>` (`sf.composition.content_alert.status.warning`); any
other choice (`16/9`) is shown as it is. `SF.Composition.editorFieldMessages`
gives the `messages` a form reads:

```js
// The language of the node (nearest [lang], SF.language.use(), <html lang>):
const messages = SF.Composition.editorFieldMessages(manifest, {node: form});
// Or a language named outright, for a form drawn before it is placed:
const ru = SF.Composition.editorFieldMessages(manifest, {locale: 'ru'});
// With no manifest it answers every built-in one.
```

The words belong to the registry owner `sf-composition` (`SF.Composition.EDITOR_WORDS_OWNER`),
so a product adds a language or corrects one word as for any component:

```js
SF.language.register('sf-composition', 'de', {'sf.composition.content_figure.src': 'Bildadresse'});
```

A registered word wins over the shipped one; a language without a word falls
back to the language without its region, then English. A key with no word in
any language is left out of `messages`, so a host's own manifest keeps its own
words or shows the key. A host without JavaScript reads the same words from
`src/core/contracts/composition-editor-words.v1.json` (`words.<locale>.<key>`),
generated from `core/js/composition/editor-words.mjs`.
