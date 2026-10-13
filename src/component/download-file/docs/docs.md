# Download File component

Download File represents one downloadable resource. Use a native anchor with a
real `href` and `download` whenever the resource is known. Use the button form
only when the application owns an action and will handle
`sf-download-file:click`. An unavailable resource has no `href`.

The default size `1` uses normal body typography. Existing `1/3`, `1/2`, `2`
and `3` modifiers provide intentionally compact or prominent rows. Canonical
BEM elements use `__body`, `__main`, `__icon`, `__name` and `__size`; historical
element classes remain aliases.

Pass a known human-readable file size when possible. For compatibility, an
empty size can still trigger the existing `Content-Length` lookup. The icon is
decorative; the filename or `aria-label` owns the accessible name.
