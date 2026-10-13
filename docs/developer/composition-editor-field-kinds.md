# Composition editor field kinds

Field kinds give every `simai.composition.editor-manifest.v1` field fixed value,
default, normalization, validation, accessibility, theme, localization and
server-fallback rules. The normative text, fixtures and lock live in
`src/core/contracts/composition-editor-fields-v1/`; the registry is
`src/core/contracts/composition-editor-field-kinds.v1.json`.

| Kind | Property | Example field |
| --- | --- | --- |
| `choice` | string with choices | `layout.region.placement`, `layout.section.surface` |
| `integer` | integer@1 | `layout.columns.columns`, `content.heading.level` |
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
