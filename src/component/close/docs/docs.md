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
