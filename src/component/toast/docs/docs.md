# Toast

Toast is concise transient overlay feedback that does not interrupt the current
task. It is distinct from persistent inline Alert content.

## Public contract

- Types: `default`, `primary`, `error`, `warning`, `success`.
- Optional decorative icon, title, supporting text, one short action and one
  explicitly named close action.
- Canonical behavior hooks: `data-action`, `data-close`, `data-duration`.
  `data-toast-action` and `data-toast-close` remain compatibility aliases.
- `sf-toast-action` reports the stable action value; `sf-toast-close` is emitted
  once before token motion removes the visual owner.
- A positive `data-duration` enables auto-dismiss. The remaining lifetime pauses
  while pointer or keyboard focus is inside the toast. Zero or no attribute is
  persistent.

## Accessibility and ownership

Use `role="status"` only when non-urgent feedback is inserted dynamically and
`role="alert"` only for a newly inserted urgent error. Omit a live-region role
from content present at initial load. Keep actionable or essential content
persistent. The application owns stack placement, ordering, business effects
and any focus recovery required after removing a focused action.
