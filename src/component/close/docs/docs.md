# Close

Close is the local, font-independent cross glyph used by dismiss actions. It is
a decorative primitive, not a button. A user-operable close action uses one
native `.sf-icon-button.sf-icon-button--close`; the button owns its stable
accessible name, focus, states and click behavior.

Name the object being closed: “Close dialog”, “Close notification” or “Close
panel” is more useful than several indistinguishable “Close” controls. Modal,
Alert, Toast or the host component owns dismissal and focus return.

The released glyph scale is `1/4`, `1/3`, `1/2`, `1`, `2`, `3`, `4`, `5`, `6`
and `7`. Interactive Icon Button composition supports the shared control sizes
`1/3`, `1/2`, `1`, `2` and `3`; larger glyphs are presentation primitives for
special compositions, not an invitation to create an unbounded action target.

The glyph uses typography size tokens and semantic colour ownership through
`--sf-close-icon--background-color`. Its mask is package-owned and does not
depend on the Material Symbols font. Forced-colours mode uses system colours.

## Looks (component.close 1.2.0)

The three looks of decision C14 are classes of this component, on the button
beside `sf-icon-button--close` and the size class, without an icon button
appearance class: `sf-button-close sf-button-close--ghost` (the default: the
cross in the ink of its place, a spot of `--sf-surface-container-hover` /
`-active` on hover and press), `sf-button-close--plain` (no spot; tags, a
field's clear, an inline remove; the ring around the cross) and
`sf-button-close--media` (over a photo or a video: a black circle at 48 / 64 /
80 with a white cross, the same in both themes). Ink: `sf-button-close--on-surface`
or `--on-surface-variant`; `--backdrop-color` on a coloured place;
`--radius-rounded` for a round spot. `sf-button-close` draws the same classes.
Squares with a border and solid fills (`tonal`, `outline`, `default` icon
buttons) are not close looks.
