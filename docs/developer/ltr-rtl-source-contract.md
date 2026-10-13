# LTR/RTL source contract

`src/` is the source of truth for direction behavior. Generated `ui` and
`ui-smart` distributions must be updated only by the accepted reproducible
builder; do not patch generated CSS or JavaScript manually.

## Direction rules

- Flow-relative spacing and placement use logical properties such as
  `padding-inline-start`, `inset-inline-start` and `inset-inline-end`.
- Viewport coordinates, drag positions, range geometry and vendor-owned code
  keep physical `left`/`right` semantics.
- Public physical APIs stay supported. Semantic callers should prefer
  `position="inline-start|inline-end"` for modal drawers and
  `text-position="inline-end"` for progress text.
- Smart modal close/minimize buttons use logical inline-end modifiers. The
  base physical custom properties and classes remain available for legacy
  consumers.
- Direction-sensitive `translateX` values require an explicit RTL branch;
  changing only the inset property is insufficient.

## Builder contract

The accepted PostCSS policy emits direction-aware physical fallbacks and keeps
the logical declaration after them (`preserve=true`). Core, Utility, Component
and Smart targets must use the same policy. A source change is not ready for a
generated transition until the source-contract tests and accepted builder
fixtures pass.

Run the source contract with:

```sh
npm test
```

Full RTL readiness additionally requires the Core/Smart reproducibility gate
and the component acceptance matrix; this source contract alone does not make
that claim.
