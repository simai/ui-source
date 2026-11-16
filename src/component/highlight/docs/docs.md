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
The copy button has the icon button's plain look (1.5.0, owner decision C201,
`sf-icon-button--plain`): it is an icon inside the block, so it has no plate
in any state, and only its glyph's ink moves -- the block's dim ink at rest,
the text's ink under the pointer, the primary colour on a press. The wrap
toggle beside it keeps its look. `data-chrome="none"` omits the header. `data-chrome="static"` lets the host own
the existing header without duplication. The historical
`data-sf-highlight-chrome="static"` input remains compatible. Generated copy
labels follow the document language and may be overridden by `data-copy-label`
and `data-copy-success`.

The header's copy and wrap buttons are plain icon buttons (owner decisions
C201, C232; 1.6.0): no fill at rest, the wrap toggle pressed shows the primary
ink and the filled glyph. Each carries its name as a Framework tooltip (C48,
C217). A `<pre><code data-lang="...">` block loads the component by the `data-lang`
attribute: the Loader's markup scan skips the inside of `pre` and `code`, so a
block without any other highlight hook was left unstyled before 1.6.0.

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

Code in a block is one step below the text (1.4.0, owner decision C186 (10)):
step 1/2 (`--sf-text-size-1/2` on `--sf-text-height-1/2`), 14/20 on a
desktop and 12/16 on a phone, in the system mono (`--sf-code--font-family`,
`--sf-mono`; it fell to the browser's monospace, Courier with its Cyrillic in
Times). The hues are the static palette's, not the status roles (C186 (11)):
keyword violet, string and tag green, attribute and number blue, title amber,
built-in teal, tone 40 on the light theme and 80 on the dark, each 4.5:1 or
more on the block. The `--sf-highlight-*` names are unchanged; a project that
set one keeps its value. Long lines scroll, and the head's wrap button wraps
them (C186 (12)).

Existing and inserted blocks initialize once. Applications can call
`SF.Highlight.highlight(block)` or `SF.Highlight.refresh(block, nextSource)`.
The global `window.hljs` and Loader registration name `hljs` remain available for
compatibility; direct grammar accuracy and application CSP remain outside this
component's presentation contract.
