# Download File component

Download File represents one downloadable resource. Use a native anchor with a
real `href` and `download` whenever the resource is known. Use the button form
only when the application owns an action and will handle
`sf-download-file:click`. An unavailable resource has no `href`.

The default size `1` uses normal body typography. Existing `1/3`, `1/2`, `2`
and `3` modifiers provide intentionally compact or prominent rows. Canonical
BEM elements use `__body`, `__main`, `__icon`, `__name` and `__size`; historical
element classes remain aliases.

Each size stands as tall as a button of the same size (one height per size,
rule C01): 24, 32, 40, 48 and 56 px on a wide screen, the
`--sf-ui-*--control-height` of the size. The border is drawn inside that
height. The icon is the button's icon of the size, the side padding the
button's and the gaps the button's label inset, all from the size ladder. The
file name is one line: a name longer than the row ends in an ellipsis and is
never broken inside a word; the whole name stays the accessible name and the
`title`.

Pass a known human-readable file size when possible. For compatibility, an
empty size can still trigger the existing `Content-Length` lookup. The icon is
decorative; the filename or `aria-label` owns the accessible name.
