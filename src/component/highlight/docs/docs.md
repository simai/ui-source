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
toggle beside it keeps its look. A file name (1.9.0, owner decision C285): `data-title="config/app.php"` on
the `code`, its `pre` or the root puts the name where the header shows the
language, in the same header text; the language is not shown then. Without
`data-title` the header names the language as before. A terminal
(`data-frame="terminal"`) keeps its icon and shows the name in place of the
word "Terminal". `data-chrome="none"` omits the header. `data-chrome="static"` lets the host own
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
A number in `data-lines` is the first line's number too (1.10.0):
`data-lines="40"` numbers a file region that starts at line 40, so a page
that shows an excerpt of a longer file needs one attribute. Both are read from
the `code`, its `pre` or the root, as the line-mark attributes are;
`data-start` wins over a number in `data-lines`, and `data-lines="false"`
turns the numbers off. The number column is three digits wide plus its end
room and widens to the longest number of the block (line 998 to 1003: four),
so every row's code starts at the same place (before 1.10.0 the room was
counted inside the three digits, so rows 9 and 10 started their code at
different places). The historical `data-line-numbers="true"` and
`data-ln-start-from` inputs remain accepted (before 1.10.0 the runtime read
neither from the `pre` or the root, and never read `data-ln-start-from`).
Numbers are decorative reference aids, excluded from assistive output
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
them (C186 (12)). The wrap button shows its name as the Framework tooltip on
hover and keyboard focus, as copy does, and the two stand the actions gap
apart, `--sf-gap--actions` (8, compact 4; C144; 1.7.1).

Existing and inserted blocks initialize once. Applications can call
`SF.Highlight.highlight(block)` or `SF.Highlight.refresh(block, nextSource)`.
The global `window.hljs` and Loader registration name `hljs` remain available for
compatibility; direct grammar accuracy and application CSP remain outside this
component's presentation contract.

A code block keeps the rhythm of the text around it (1.6.1, plain group 3
CB-3): it ends with a paragraph's space (`--sf-text--space-bottom`, 16 on a
desktop and 12 on a phone) and what follows brings its own, so a heading after
it keeps its larger top. It was a fixed `--sf-space-4` (32 / 24) on the top of
whatever came next. A block that ends its holder adds no space after it.

Line marks (1.7.0, owner decisions C254-C258). The number column stays the
quiet column (`data-lines`, `data-start`; C254). A line can be marked in two
ways (C258): by attributes of the block, for ranges and for code that cannot be
edited -- `data-mark`, `data-focus`, `data-add`, `data-remove`, each a list such
as `"2,4-5"`, read from the `code`, its `pre` or the root -- and by Shiki's
markers at the end of a line, as Docara and VitePress write them: a comment
holding `[!code ++]`, `[!code --]`, `[!code highlight]` (or `hl`) or
`[!code focus]`, with an optional count for N lines from that one
(`[!code highlight:3]`). The marker and
its comment leave the text before it is coloured, shown or copied; `[!!code ...]`
shows a marker as text, and a Markdown block (`md`, `markdown`) shows markers
as written. The Loader no longer reads `[!name]` inside `pre` or `code` as a
shortcode (it took `[!code ++]` for the shortcode "code"), and since 1.10.0
neither does the boot script of `core.js`: it hid such a marker in a comment
while the page was parsed, so a block in the page's HTML lost its markers
before the highlighter read them.

- Changed lines (C255): the row is tinted with the diff roles
  (`--sf-highlight-addition-background`, `--sf-highlight-deletion-background`:
  the success and error containers) and carries a `+` or `−` sign in a column
  two characters wide; the code on a tint holds 4.5:1. The sign is drawn by the
  stylesheet and a screen reader hears "added" / "removed" before the line.
  Copy gives the result: removed lines and signs are left out.
- Marked and focused lines (C256): a light primary-container fill (12 % light,
  24 % dark) and a 2 px primary bar at the line's start. Focus is drawn the
  same; the other lines are neither dimmed nor blurred.
- Terminal (C257): `data-frame="terminal"`. The frame is the ordinary code
  block of the site's theme; its head shows the `terminal` icon and the word
  "Terminal" in the block's language instead of the language name. A line that
  starts with `$ ` is a command, its prompt drawn by the stylesheet; the other
  lines are its output in the place's dim ink. Copy takes the commands only,
  without prompts or output. A terminal without any `$ ` line is all commands.

Line mark classes (1.10.0). Each mark is a class of the row, so a page that
writes its rows at build time (a documentation site, C252 first paint) marks them with
Framework classes and gets the same look without a rule of its own:

| class | line |
|---|---|
| `sf-code-line--added` | an added line (C255): success tint, `+` sign |
| `sf-code-line--removed` | a removed line (C255): error tint, `−` sign |
| `sf-code-line--highlight` | a marked line (C256): primary-container fill, 2 px primary bar |
| `sf-code-line--focus` | a focused line (C256): drawn as a marked line |
| `sf-code-line--prompt` | a terminal command (C257) |
| `sf-code-line--output` | a terminal command's output (C257): the place's dim ink |

The runtime writes these classes on its rows; the `data-line-diff`,
`data-line-mark`, `data-line-focus`, `data-line-prompt` and
`data-line-output` attributes it wrote before stay on its rows and draw the
same. A block whose rows carry a diff is `sf-code-lines sf-code-lines--diff`.
The parts a mark draws are spans of the row, in this order:
`sf-code-line__number` (the number as `aria-hidden` text), in a diff block
`sf-code-line__sign` on every row (empty; the stylesheet draws the sign) and,
on a changed row, `sf-code-line__state` with the word a screen reader hears
("added: ", "removed: "), on a command row `sf-code-line__prompt` (empty; the
stylesheet draws `$`), then `sf-code-line__content`. Rows a copy leaves
behind (removed lines, terminal output) carry `data-copy="false"`.
Written by hand, the rows stand inside the `code` with no white space between
the spans: code keeps its white space, so a line break between two rows is an
empty line. The example below is indented for reading only.

```html
<span class="sf-code-lines sf-code-lines--diff" role="presentation">
  <span class="sf-code-line sf-code-line--removed" data-copy="false">
    <span class="sf-code-line__number" aria-hidden="true">40</span>
    <span class="sf-code-line__sign" aria-hidden="true"></span>
    <span class="sf-code-line__state">removed: </span>
    <span class="sf-code-line__content">old()</span>
  </span>
  <span class="sf-code-line sf-code-line--added">
    <span class="sf-code-line__number" aria-hidden="true">41</span>
    <span class="sf-code-line__sign" aria-hidden="true"></span>
    <span class="sf-code-line__state">added: </span>
    <span class="sf-code-line__content">next()</span>
  </span>
</span>
```

Rows carry the block's side room (`--sf-space-1`), not the scroller, so a
row's fill reaches the block's edges. A token that runs over several lines (a
block comment, a template string) keeps its colour on every row. Rows are built
when numbers or any mark is present; `data-copy="false"` on a row is what the
core copy reader leaves out.

`--sf-highlight-line-divider` is no longer declared (nothing drew it; C254 has
no line). The legacy `.hljs-ln-numbers` rule still reads it, with the edge
colour as its fallback, until 2027-01-01.

The palette -- the `--sf-highlight-*` roles and the place hooks the code reads
them through -- moved to core styles (`core.css`), so a page that colours its
code at build time (C252 first paint) has the colours before the Highlight
sheet arrives. New roles `--sf-highlight-number`, `--sf-highlight-property`,
`--sf-highlight-operator` and `--sf-highlight-variable` let a host aim at one
kind of token; each is an alias of `--sf-highlight-attribute` (no new hue,
C186 (11)).
