# Reference Link component

Reference Link is a specialised navigation surface for a named destination and
its compact reference, such as a route, source or section identifier. Use the
ordinary Link component when this additional reference is not useful.

The native anchor owns navigation. Canonical elements are `__main`, `__link`,
`__icon` and `__meta`; historical element classes remain supported aliases.
The complete surface is the pointer target and receives the keyboard-only focus
indicator. An unavailable reference has no `href` and is marked with
`disabled` plus `aria-disabled="true"`.

Opening a new browsing context must be intentional, use `rel="noopener"` and
be disclosed in the visible or accessible name. Icons are decorative.

Since component.reference-link 1.0.2 (C113 follow-up, 2026-11-13): on the
card's hover and press plates the inks step with the plate. The link takes
`--sf-link-hover` / `--sf-link-active`, the icon `--sf-primary-hover` /
`--sf-primary-active`, and the meta `--sf-on-surface-container-variant`, the
dim ink made for a fill. In the dark theme the resting inks fell under 4.5:1
on those plates (3.78 pressed on a card, 3.90 on a popup).
`--sf-reference-link-link-color` still wins for the link. A plain reference
has no plate and keeps its inks.
