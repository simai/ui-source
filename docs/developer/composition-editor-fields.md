# Composition editor fields

`simai.composition.editor-manifest.v1` is the optional authoring companion for
one exact `simai.composition.type-manifest.v1` type and version. It does not
change Composition Recipe 1.0.1, Composition Document v1, rendering, storage or
publication.

Each field declares a stable key, destination plane and target, exact Property
type and version, owner-owned constraints, disclosure group, initial visibility,
optional closed choices and default, localization keys, advisory capability and
permission hints, and value owner. The only planes are
`props`, `data`, and `presentation`. Presentation fields may target the existing
scalar `view` or `preset` selectors; this contract adds no new variant grammar.

The host registers its Property type/version inventory and validates
`constraints` through that owner. Framework validates the destination against
the exact type manifest, keeps choices inside registered presentation values,
and rejects duplicate destinations, unknown fields, executable metadata and
secret-bearing keys. JSON contains no endpoints, actors, classes, methods or
handlers.

A product adapter may project a field directly into its existing Property
descriptor:

| Framework editor field | Property/Admin input |
| --- | --- |
| `key` | stable field key |
| `property.type`, `property.version` | exact registered Property identity |
| `constraints` | Property-owned constraint validation |
| `label_key`, `help_key` | product localization lookup |
| `choices` | registered-choice control after Property normalization |
| `default`, current projected value | request-local editor value |
| `visibility` | initial `visible`, `collapsed`, or `hidden` presentation hint |
| `capability_hints`, `permission_hints` | advisory host registry lookups |
| `owner` | persistence and authorization routing |

`group` and `visibility` are presentation-only progressive disclosure. Hints
are portable names for host-side lookup: Framework neither evaluates them nor
grants or denies access from them. They never replace a product policy or
capability registry. The manifest contains defaults, never current instance or
business values. The product owns instance IDs, translation, access checks,
draft/CAS state, persistence, audit, publication and rollback. Two placements
of the same type are projected as two records
keyed by their Composition node IDs; nesting does not merge their values.

Built-in fixtures cover `layout.section` surface/contrast,
`layout.columns` integer bounds, and the real `content.heading.data.level`
renderer parameter as an initially collapsed `advanced` integer field. Heading
level is constrained to `1..6` and changes the semantic `<h1>` through `<h6>`
output; it is not a decorative editor-only option. Consumer browser acceptance
must render these
descriptors through the product's already registered Property/Admin Smart
controls; Framework does not publish a product editor endpoint or persistence
handler.

Every field also maps to exactly one published field kind (`choice`,
`integer`, `text`, `toggle`); see
[Composition editor field kinds](composition-editor-field-kinds.md) for value,
normalization, accessibility and server-fallback rules. `layout.region`
publishes `placement`, `label`, `landmark` and `sticky` fields.
