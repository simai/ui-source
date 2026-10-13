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
