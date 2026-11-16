# Placeholder

Placeholder is the Framework empty-state composition. It explains why a region
has no content and may offer one useful next action. Use Skeleton or Spinner
while content is still loading; do not use Placeholder as an input hint.

## Structure

- `.sf-placeholder` owns intrinsic layout and defaults to a centered column.
- `.sf-placeholder__visual` is optional and normally decorative.
- `.sf-placeholder__content` groups the message and actions.
- `.sf-placeholder__header` groups title and description.
- `.sf-placeholder__title` names the state.
- `.sf-placeholder__description` explains the reason or next step.
- `.sf-placeholder__actions` contains native Framework buttons or links.

When the state replaces a named region, use a semantic `section` with
`aria-labelledby`. If it appears after a user action and must be announced, the
host may use an appropriately scoped live-status pattern; the component does
not force every static empty state to announce itself.

## Layout

The default and `.sf-placeholder--column` layouts place the optional visual
above centered content. `.sf-placeholder--row` places them side by side, aligns
copy to inline start and wraps when the host becomes constrained.

The title holds the heading ladder (owner decisions C21 and C44): an `h1` to
`h6` title takes its level's role (36 / 32 / 24 / 20 / 16 / 16 on a desktop,
the phone's steps on a phone, the same in a compact region), any other element
the heading-4 role (20/24), at medium weight. The description is body text in
the quiet ink. `sf-empty-state` draws its block form from these parts and picks
the title's rung by its size.

## Compatibility

`.sf-placeholder-right`, `.sf-placeholder-top` and positional
`.sf-placeholder-top-text` remain presentation aliases for existing markup.
Their existing `--sf-placeholder-right--*`, `--sf-placeholder-top--*` and
`--sf-placeholder-top-text--*` overrides remain fallback inputs.
New markup should use the explicit BEM elements because they do not make
meaning depend on child order.
