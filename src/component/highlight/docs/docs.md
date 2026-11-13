# Highlight

Highlight is the static source-code presentation owner. It lazily loads only the
requested language mode, tokenizes `pre > code`, provides local horizontal
overflow and can compose a language/copy header and line-number gutter. It is not
an editor, terminal, Markdown renderer or inline-code replacement.

Use `data-lang="js"` as the concise language hook. Existing `language-js` and
`lang-js` classes remain supported, including configured aliases. Missing or
unknown languages render through plaintext; an unknown request is exposed as
`data-highlight-state="unsupported"` without hiding the source. Blocks also
expose pending, ready or error state.

Chrome defaults to `data-chrome="auto"`: the generated header identifies the
requested language and creates a named native Framework Icon Button bound to Clipboard.
`data-chrome="none"` omits the header. `data-chrome="static"` lets the host own
the existing header without duplication. The historical
`data-sf-highlight-chrome="static"` input remains compatible. Generated copy
labels follow the document language and may be overridden by `data-copy-label`
and `data-copy-success`.

Use `data-lines` for line numbers and `data-start` for a non-default first number.
The historical `data-line-numbers="true"` and `data-ln-start-from` inputs remain
accepted. Numbers are decorative reference aids, excluded from assistive output
and reconstructed line breaks remain available to Clipboard selection.

Canonical generated structure uses `.sf-highlight`, `.sf-highlight__head` and
`.sf-highlight__wrap`; `.sf--highlight-*` remain compatibility aliases. An
authored `.source` wrapper is still read as the root, but a generated root no
longer carries `source`: that word is also the Doc component's source block,
and on it the Loader fetched the Doc styles, whose inverse fill covered the code
surface (in the dark theme plain identifiers were invisible). The Doc source
rules do not paint a highlighted block (`.sf-code-surface` or its scroller). The large code surface uses the default surface radius while generated
controls retain their UI radius. Spacing, typography, borders and syntax colors
come from semantic Framework tokens.
The syntax colours follow the place the block stands on (1.3.0): the roles
`--sf-highlight-*` are the page's, and the code reads them through the place
hooks (`docs/foundation-backgrounds.md`). On a card, a popup or the grey plate
the comment, the punctuation and the line numbers take the place's dim ink on
a fill. On a strong colour (`bg-primary`) and on glass the text and every hue
take the place's ink, one colour, because a hue over a colour is that colour or
near it. On the grey plate, and on a popup in the dark theme, the block lays no
fill of its own. Every role then holds 4.5:1. On the page nothing changes, a
project's override of a role included.
The head lays itself out in the component's own rule -- the language at the
start, the wrap toggle and copy at the end, on one axis -- so it needs no
utility sheet. Its height is the control height of ladder step 1
(`--sf-ui-1--control-height`), one step above the size-1/2 icon buttons it holds. The code surface offers five public variables:
`--sf-highlight-radius` (default `--sf-radius--surface`; a host that nests the
block, such as a chat bubble, sets it to follow its own corner),
`--sf-highlight-background-color`, `--sf-highlight-color`,
`--sf-highlight-border-color` and `--sf-highlight-border-width`. Code direction remains LTR inside an RTL
document and long lines scroll locally.

Existing and inserted blocks initialize once. Applications can call
`SF.Highlight.highlight(block)` or `SF.Highlight.refresh(block, nextSource)`.
The global `window.hljs` and Loader registration name `hljs` remain available for
compatibility; direct grammar accuracy and application CSP remain outside this
component's presentation contract.
