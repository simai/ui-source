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

Since component.download-file 1.2.0 (decision C25, 2026-11-09):

- A file link downloads in the same tab. A link with `target="_blank"` is a
  file opened to view: it carries `__tab`, the `open_in_new` sign after the
  name, and `__tab-words`, «(откроется в новой вкладке)» for a screen reader.
- The type and the size are two facts in `__meta`: `__type` (PDF), then
  `__size` (2,4 МБ), a dot between them only when both are there.
- A size the component asks for is written in the page's language by the core
  formatter (`SF.format.fileSize`): «2,4 МБ», not «2.4MB».
- No invented file: an absent name is the link's last part, an absent size is
  asked of the file. The defaults were File.pdf and 36MB.
- A root marked `aria-busy="true"` is being prepared: it takes no press, the
  hover and press fills stand still and the pointer says progress. `__spinner`
  is the Framework spinner in the sign's box (the Smart element draws it).

Since component.download-file 1.3.0 (docs pre-check 2026-11-10):

- The public variables carry the element's name: `--sf-file-download-*`
  (`-background-color`, `-border-color`, `-radius`, `-padding`, `-gap`,
  `-icon-size`, `-icon-color`). Each reads its former name,
  `--sf-download-file-*`, under it until 2027-01-01.
- `__stack` holds a file and its notice in one column (the Smart element
  draws it in the error state); the gap is `--sf-space-1/3`.
- A `data:` or `blob:` address is never asked for its size.
- Nor is an address that leads back to the page itself (`#`, `#part`, the
  page's own URL).

Since component.download-file 1.3.1 (C113 follow-up, 2026-11-13): on the
hover and press plates the inks step with the plate. The name and the icon
take `--sf-primary-hover` / `--sf-primary-active` (the accent's own ladder, as
an outline primary button's label), and the type and size take
`--sf-on-surface-container-variant`, the dim ink made for a fill. In the dark
theme the resting inks fell under 4.5:1 on those plates (3.78 pressed on a
card, 3.90 on a popup). `--sf-download-file-icon-color` still wins for the
icon.
