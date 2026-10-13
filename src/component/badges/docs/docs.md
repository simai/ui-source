# Badges

Badge is a compact, non-interactive metadata label for a short status,
category, version or count beside another object. Use a Button or another native
control when the element performs an action.

## Public contract

- emphasis: `main`, `tonal`, `outline`;
- scheme: `neutral`, `primary`, `secondary`, `tertiary`, `info`, `success`,
  `warning`, `danger`, `on-surface`;
- size: `1/3`, `1/2`, `1`;
- optional text and decorative icon at the logical start or end.

`tonal + on-surface` is not a designed pair and normalizes to
`main + on-surface`. Unknown values normalize to the safe neutral defaults.

## Semantics

Use an inline `span` for ordinary markup. The visible word or number provides
the default accessible content, and an icon is `aria-hidden="true"`. An
icon-only or abbreviated value needs a full text equivalent using an `sr-only`
child. A badge with neither visible nor screen-reader text is decorative.

Colour reinforces meaning but never replaces the written status. Badge is not
focusable and does not own hover, live-region or announcement behavior. A host
that updates a time-sensitive status owns `aria-live` or `role="status"`.

## Presentation

The pill radius distinguishes Badge from controls and surfaces. All geometry
uses the corresponding typography and UI-spacing tokens. The outline variant
uses the Framework pixel token and a solid semantic outline. Labels remain
short; use normal content or a different component for sentences.
