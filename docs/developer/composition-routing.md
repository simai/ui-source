# Composition routing

`layout.scope` connects Composite Smart Components through their common parent
without product JavaScript. The normative text, fixtures and lock live in
`src/core/contracts/composition-routing-v1/`; the published port registry is
`src/core/contracts/composition-ports.v1.json`.

```json
{
  "id": "workspace",
  "type": "layout.scope",
  "props": {"routes": [
    {"id": "order-lines", "from": {"endpoint": "orders", "port": "selection"}, "to": {"endpoint": "lines", "port": "context"}}
  ]},
  "slots": {"default": [
    {"id": "orders", "type": "example.records", "extensions": {"simai.composition:endpoint": {"name": "orders"}}},
    {"id": "lines", "type": "example.records", "extensions": {"simai.composition:endpoint": {"name": "lines"}}}
  ]}
}
```

Routes name endpoints and published ports only. A product type rendered by a
Framework element binds to that element's published ports through the port
registry, for example `{manifests: SF.Composition.BUILTIN_PORT_MANIFESTS,
bindings: {"product.records": "sf-table"}}` passed as `options.ports` to
`validate`, `normalize` and `render`, and as `compositionPorts` in the
`resolveRecipe` context (its `ports` field already holds the source-reading
ports). Its renderer puts `data-sf-endpoint` on the `sf-table` element.

Value types are named without a version: `record-ids`, `record-removed`,
`collection-changed` and the rest. The older labels (`record-ids.v1` ...) name
the same types and are read everywhere -- port manifests, fragment
descriptors, routes, `static sfPorts` and the page effects of a port answer --
until the change journal retires them (record `value-types-without-version`,
remove_after 2026-12-01). A route joins a bare name and its older label as one
type. The port registry keeps the older labels as its `value_types` keys and
maps each bare name to its key in `value_type_names`.

At runtime `sf-composition-scope` delivers `sf-table` selection
(`record-ids.v1`, the label its published manifest still declares) to another
table's `context` input. That table clears its
selection, enters loading and emits `sf-table-query-intent` with
`{reason: "context", context: {record_ids}, sequence}`. The product queries
with its own authorization and answers:

```js
document.addEventListener('sf-table-query-intent', async (event) => {
  const table = event.target;
  const {context, sequence} = event.detail;
  const rows = await productQuery(table, context); // product-owned
  table.applyQueryResult(sequence, rows); // false for a stale answer
});
```

Only the newest answer is applied. Removing and re-inserting a scope or table
never duplicates subscriptions; a table whose query was left unanswered asks
again once after remount.

The routing contract and the `sf-table` port declaration are public and stay
here. The `sf-table` element that answers it lives with Larena (package
`larena`, the component folder of `simai/larena-ui`), so a page that routes to
it declares that package (`component-packages.md`). The browser acceptance with
real tables (`tests/browser/composition-routing.browser.mjs` and its lab) moved
with it and runs in the package's own tests.
