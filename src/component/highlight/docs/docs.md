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

The generated header lays itself out from the component's own sheet (1.2.0):
one size-1 control high, the language at the start, the wrap toggle and copy at
the end, every child on the header's middle line, the copy button's box a
quarter step from the header's end as from its top and bottom. It no longer
reads `flex`, `content-main-between` or `items-center` from the utility sheet,
so it keeps its layout where that sheet is missing or arrives late.

Public variables (1.2.0), set on the block or on any ancestor:

| Variable | Default | What it sets |
|:--|:--|:--|
| `--sf-highlight-radius` | `--sf-radius--surface` | the code surface's corner; inside a container that follows the nesting rule, `var(--sf-radius--nested)` |
| `--sf-highlight-background-color` | `--sf-surface-container` | the code surface's fill |
| `--sf-highlight-border-color` | `--sf-outline-variant` | the surface's border and the header's bottom rule |
| `--sf-highlight-border-width` | `--sf-px` | the surface's border width |
| `--sf-highlight-padding` | `--sf-space-1` | the inset of the code inside the surface |
| `--sf-highlight-head-height` | `--sf-ui-1--control-height` | the header's height |

The older `--sf-highlight-text`, `--sf-highlight-keyword` and the other syntax
colours are the theme's: the Framework sets them, so they are not public. Code direction remains LTR inside an RTL
document and long lines scroll locally.

Existing and inserted blocks initialize once. Applications can call
`SF.Highlight.highlight(block)` or `SF.Highlight.refresh(block, nextSource)`.
The global `window.hljs` and Loader registration name `hljs` remain available for
compatibility; direct grammar accuracy and application CSP remain outside this
component's presentation contract.
