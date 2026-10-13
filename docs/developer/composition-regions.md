# Composition regions

`layout.regions` and `layout.region` let one Composition Document declare
several named page areas. The normative text, fixtures and lock live in
`src/core/contracts/composition-regions-v1/`. Recipe 1.0.1, Document v1 and the
type-manifest v1 schema are unchanged; the two types are additive registry
entries.

```json
{
  "id": "shell",
  "type": "layout.regions",
  "slots": {
    "regions": [
      {"id": "top", "type": "layout.region", "props": {"name": "header", "landmark": "banner", "sticky": true}, "slots": {"default": []}},
      {"id": "body", "type": "layout.region", "props": {"name": "main", "landmark": "main", "placement": "center"}, "slots": {"default": []}},
      {"id": "side", "type": "layout.region", "props": {"name": "aside", "landmark": "complementary", "placement": "end", "label": "Related"}, "slots": {"default": []}},
      {"id": "bottom", "type": "layout.region", "props": {"name": "footer", "landmark": "contentinfo"}, "slots": {"default": []}}
    ]
  }
}
```

The author chooses region names. `header`, `main`, `aside` and `footer` are
ordinary values, not a Framework vocabulary; semantics come from `landmark`.
A region can narrow its accepted categories with `accepts` and its child count
with `min_items`/`max_items`. Array order is DOM, reading and keyboard order.
At container widths from 48rem, `start`, `center` and `end` regions sit side by
side; `block` regions span the row. Columns are logical and mirror in RTL.

`SF.Composition.describeRegions(normalizedDocument)` returns each region with a
digest of its canonical subtree, so a product can invalidate only outputs that
depend on the changed region. A Recipe template fills regions through ordinary
`insertSlot` points: a passed slot replaces defaults, a missing slot inherits
them, and `[]` empties the region.

Regenerate fixtures and the lock after an intentional contract change:

```bash
npm run composition:build
npm run composition:capabilities:build
npm run test:composition-capabilities
php src/core/contracts/composition-regions-v1/checks/digest-parity.php \
  src/core/contracts/composition-regions-v1/fixtures/regions.json
```
