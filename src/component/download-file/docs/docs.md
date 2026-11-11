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
row keeps that height while the name fits one line (see 1.3.0 below for the
name that wraps).

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
- `__stack` holds a file and what goes with it in one column (the Smart
  element draws it in the error state, and beside «Отменить» or «Скачать»);
  the gap is `--sf-space-1/4`.
- A `data:` or `blob:` address is never asked for its size.
- Nor is an address that leads back to the page itself (`#`, `#part`, the
  page's own URL).

Decision C51 (2026-11-11, still component.download-file 1.3.0, not released
yet):

- The row is as wide as its text (`inline-size: fit-content`, up to its
  container); `--full-width` (the class and the `fullWidth` parameter) fills
  the container, the look before.
- `__text` holds the name and, right after it, `__meta` (type and size). When
  the row has no room for both on one line, `__meta` goes under the name: the
  row's own width decides, so a file in a narrow column of a wide screen does
  the same. Below the `sm` step (32rem, a phone) it is always under the name,
  a step smaller. The name is never cut: it wraps on its spaces and narrows to
  its longest word, never to letters (`overflow-wrap: break-word`); the
  ellipsis and the `title` are gone.
- `__said` is the hidden words a screen reader hears after the name, «, CSV,
  112 байт» with the unit in words; `__meta` is `aria-hidden`. The words come
  from `fileSaid(type, size, node)` and `spokenFileSize(text, node)`.
- `__ring` is the sign's box with the progress ring (class markup
  `.sf-progress-ring`) when the share is known; `__status` the words that take
  the type's and size's place («Готовим… 45 %», «Готово», «Не удалось
  собрать»), in tabular figures.
- `--error` (the error sign, border and status, a group, no hover) and
  `--offer` (the success sign, no hover) are rows that cannot be pressed;
  `__end` holds a button inside the row (Повторить), reaching into the padding
  so the row keeps its height; `__line` puts a button beside the row;
  `__reason` is the small line under it; `__live` the hidden live regions.
- The size is asked (`HEAD`) only of an http(s) address on the page's own
  origin. A bound root is a link or a button only.
