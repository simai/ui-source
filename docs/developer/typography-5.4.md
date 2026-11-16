# Typography contract 5.4

SF5 5.4 publishes one adaptive typography contract for base scales and the
semantic Label, Body Text, Heading and Display roles. The contract source is
`src/core/contracts/adaptive-sizing.v1.json`; generated SCSS projections carry
its SHA-256 and must pass `npm run adaptive-sizing:check`.

The contract is the only source of those projections: a value is changed in
the contract (or, for how it is written, in
`scripts/generate-adaptive-sizing-contract.mjs`) and the sheets are
regenerated, never edited by hand. Since contract 1.5.0 the desktop media query
is written in rem (`60rem`, as the breakpoint ladder is), and a semantic role
may be pinned to primitives with `fixedSize`/`fixedHeight` (and an optional
`note`, written as a comment) instead of following a size rung; Label large is
pinned to `b4`/`c0`, 14/20 in both modes.
`tests/adaptive-sizing-contract.test.mjs` regenerates the sheets in a scratch
copy and fails when the result differs from the repository.

## Public variables

Canonical 5.4 base variables use the double delimiter:

- `--sf-text--size-*`;
- `--sf-text--height-*`;
- `--sf-title--height-*`.

The historical `--sf-text-size-*`, `--sf-text-height-*` and
`--sf-title-height-*` names remain 5.x compatibility aliases. New first-party
styles use the canonical variables.

After rungs 1..12 the title ladder has one named step (contract 1.7.0, owner
decision C89): `--sf-title--height-card`, the card title line -- 24 px on a
desktop (as rung 2) and 20 px on a phone (as rung 3), the line of 14 px text
there, where rung 2 gives 18. It has no `--sf-title-height-*` alias, and
density does not move it, as it moves no title line.

Semantic roles are exposed as:

- `--sf-label-small|medium|large--size/height`;
- `--sf-text-small|medium|large--size/height`;
- `--sf-heading-1..6--size/height`;
- `--sf-display-1..6--size/height`.

The content heading ladder (docs review R022, contract 1.4.0): H1 is text
rung 6, H2 rung 5, H3 rung 2 and H4 rung 1, each on the title line height of
its rung; H3 and H4 are set apart from body text by weight, not size. H5 and
H6 keep rungs 2 and 1.

Heading flow uses `--sf-heading--space-top` and
`--sf-heading--space-bottom`. H1 has no top margin. H2 opens a section: its
top margin is `--sf-heading--space-top` plus `--sf-content--space-block`, its
bottom margin `--sf-heading--space-bottom`. H3-H6 belong to their section: the
top margin is `--sf-content--space-block`, the bottom margin half of
`--sf-heading--space-bottom`.
`--sf-heading--margin` is retained only as a deprecated compatibility alias.
Body flow uses `--sf-text--space-bottom`.

The shared content rhythm is exposed as:

- `--sf-content--space-text` for ordinary text rhythm;
- `--sf-content--space-related` for closely related elements inside one
  composition;
- `--sf-content--space-block` for independent blocks inside one section;
- `--sf-content--space-section` for a transition to a new section.

The parent flow selects the relationship token. A presentational component
does not own an outer margin by default. Existing text and heading variables
resolve through these content roles, so their computed 5.4 values remain
unchanged.

## Selectors

Native H1-H6, `.sf-h-*`, Display selectors, `.label-*` and
`.body-text-small|medium|large` resolve through their semantic role variables.
The existing `.text*` selectors remain aliases for Body Text. A numeric
`.text-N` utility can opt into title line height with `.heading`.
`utility/headers` remains a compatible entrypoint but consumes the same
Heading role variables as Core; it has no separate size or line-height table.

## Links, text flow and headings (C186)

Owner decision C186 (2026-11-14; study control/research/2026-11-14-plain-group-3.md
in ui-control). One rule for every link, line and heading of running text.

### Links

- **Underline.** A link in running text (`a` without a class, an `a` with a
  `link-*` utility, `sf-link`) is always underlined: the line is the link's
  colour at ink 48 (`--sf-link--underline-ink`, the alpha scale's ink family),
  1px (`--sf-link--underline-weight`), offset `--sf-a3`; under the pointer and
  pressed it takes the full colour. In navigation, a menu, a tab list and a
  table (`nav`, `menu`, `role=navigation|menu|menubar|tablist|table|grid|treegrid`,
  `table`) a link has no line until the pointer or the keyboard comes to it.
  `link-underline-none` still removes the line.
- **Visited.** Off by default: a visited link keeps the link colour. A site or
  documentation turns the visited colour (`--sf-link-visited`) on for a region,
  or the whole page on `<html>`, with `data-sf-visited="on"` -- the switch the
  reference link reads (C147 (5)).
- **New tab.** A link in text with `target="_blank"` gets `arrow_outward`
  after its last word -- the text's size, 4 from the word (`--sf-space-1/4`),
  never on a line of its own -- and «(откроется в новой вкладке)» («(opens in a
  new tab)») for a screen reader in the page's language
  (`core/js/new-tab-link.js`, `SF.newTabLink`; the word is sf-file-download's
  `new-tab-text`). A link that already shows a new-tab icon, and a link that is
  part of a component (a class of its own, or a parent with an `sf-` class),
  is left alone.
- **Keyboard ring.** 2px `--sf-focus`, 2px from the words (`--sf-a2`), the UI
  corner (`--sf-radius--ui`, 4), drawn around each line of a wrapped link
  (`box-decoration-break: clone`).
- **On a strong place** (`bg-<colour>`, glass, the inverse) a link is the
  place's ink (`--sf-place--ink`) and keeps its underline: the theme's link blue
  was 1.0:1 on `bg-primary`.

### Text flow

- **Long runs.** Paragraphs, lists, quotes and tables take
  `overflow-wrap: anywhere` (the deprecated `word-break: break-word` before):
  an address, a mail or a file name breaks where it must, and a table stays
  inside its holder instead of widening it. A word that fits a line is never
  broken. `.table-frame` keeps its words whole and scrolls.
- **Hyphenation.** On in narrow running text only: on a screen of the phone ladder (below the one breakpoint, 60rem), or
  in a container query container under 40rem (`p`, `li`, `dd`, `blockquote`,
  `figcaption`), and wherever `text-hyphens` asks for it. Never in headings,
  code, `address`, mail and phone links and `[translate="no"]` names. It needs
  the page's `lang`.
- **Balance.** h1-h4 (and `.sf-h-1..4`) balance their lines
  (`text-wrap: balance`); running text avoids a lone last word (`pretty`).
- **One family of utilities.** `text-nowrap`, `text-break` (anywhere),
  `text-break-normal`, `text-hyphens`; `truncate` (one line with an ellipsis)
  and `line-clamp-N` cut text. The former names keep drawing what they drew
  until 2027-01-01 and the Loader notes each one once in `SF.deprecations`
  (journal `class-text-flow-utility-aliases`):

  | former | write |
  | --- | --- |
  | `wrap-none` | `text-nowrap` |
  | `text-break-word`, `text-break-all` | `text-break` |
  | `t-ellipsis`, `t-clip` | `truncate` |

### Headings

- The C21 sizes are unchanged. On a phone h3 takes the next title line, 18/24
  (it was 18/20, and a two-line h3 touched); the desktop keeps 24/28
  (`mobileHeight` of the heading role in `adaptive-sizing.v1.json`).
- `.sf-h-1..6` is the only class that makes text look like a heading (C21,
  C44). `.title-N` is a text size on its title line, with no weight, family or
  margins: not a heading. `.title-7..12` are larger than h1 -- the display
  rung, for a banner or a hero.
- `utility/headers` holds the heading sizes only; the copy of core's
  `.bg-surface-overlay` it carried is gone (core keeps the rule).

### Code block

Code in a block is one step below the text: step 1/2, 14/20 on a desktop and
12/16 on a phone, in the system mono (`--sf-code--font-family`). Its hues come
from the static palette (component.highlight 1.4.0).

## Code in running text

A `<code>` in author markup -- a paragraph, a list item, a table cell, a
heading, a link, chat markup -- gets a quiet plate (owner decision
2026-11-07, docs review R024, rule C10). Code in `pre`, the highlighter's
surface, `kbd`, `samp`, a button, a code with an `sf-` class and a code whose
parent has one are left as they are. The rule is in `:where()` in the base
layer: any component, utility or site rule wins.

| Public variable | Default | Ladder |
| --- | --- | --- |
| `--sf-code-background` | `var(--sf-surface-container)` | the alpha plate: reads on `surface-0..3`, stripes and callouts |
| `--sf-code-color` | `var(--sf-on-surface)` | the text's ink |
| `--sf-code-padding` | `0.2em 0.4em` | relative, kept in em (below) |
| `--sf-code-font-size` | `85%` | relative, kept in % (below) |
| `--sf-code-radius` | `var(--sf-a6)` | the a6 step of the size ladder (6px) |
| `--sf-code-font-family` | `var(--sf-mono)` | the mono stack |

The geometry is Gravity UI's and GitHub's. The corner maps to a6 exactly;
the radius ladder has no 6 (`--sf-radius-1/2` is 4px, `--sf-radius-1` 8px).
The room and the size stay relative on purpose: one word of code sits in body
text, a heading, a caption and a table cell, and has to scale with each; no
fixed step is .2em, .4em or 85 % of all of them (at 16px text the code is
13.6px, its room 2.72px by 5.44px). Code stays inline and wraps as text does,
at its spaces and hyphens, so a name at the end of a line may part at a hyphen
(`sf-button-` / `press`) but never between two letters. A run that cannot fit
a line of its own -- a URL, a token -- breaks where it must
(`overflow-wrap: break-word`; C10, 2026-11-10), so it never runs out of a
narrow column. In running text `break-word`, not `anywhere`: inline code
keeps the no-break with the punctuation around it and the height of its line. The code's own line box is `line-height: 1`:
with the inherited text line it rose a pixel above the strut whenever Inter
was ready at the first layout, so a line with code grew 24 -> 25 at 1440.
In a table cell (`td`, `th`) code takes `overflow-wrap: anywhere` (owner
decision C10, variant A, 2026-11-11): a long value -- a JSON default, a rule
address -- lowers the cell's min-content and never widens the table, so a
label column beside it keeps its words. For that the table resets its
`word-break: break-word` (which lowered every cell to a letter) to
`overflow-wrap: break-word`, and its cells inherit it: a cell keeps its words
and breaks one only when it cannot fit the column. The rule is on the table,
not on the cells, so `.table-frame`, whose frame scrolls and which keeps every
word whole (`overflow-wrap: normal` on its table), is not beaten by it.
Cells never get `nowrap`.

The public variables have one dash and are never set by the Framework; set
them on `:root` or any container. The `--sf-code--*` names with two dashes
are the internal defaults they fall back to.

Tones are recipes over existing roles, not classes and not a palette:

```css
/* secondary */
:root { --sf-code-color: var(--sf-secondary); }
/* tertiary on its container */
:root { --sf-code-background: var(--sf-tertiary-container); --sf-code-color: var(--sf-on-tertiary-container); }
/* the highlighter's keyword colour */
:root { --sf-code-color: var(--sf-highlight-keyword); }
```

A tone is a site's or a section's choice, so it is written where the choice is
made. A class would have to work on the container and on the `<code>`, and a
class on the `<code>` itself is an `sf-` class, which the rule reads as
component markup and leaves without a plate.

### Copy on click

Opt-in, never the default. `data-sf-code-copy` on a container turns each code
in running text inside it into a copy control (`core/js/code-copy.js`):
`role="button"`, `tabindex="0"`, an `aria-label` naming what is copied;
a click, Enter or Space copies; a hairline on hover and the base focus ring;
a polite status («Скопировано» / «Copied») above the code. The copy is core's
`copyText` (Clipboard API, `execCommand` fallback); a refused copy selects
the code and says which keys to press. The words are sf-button-copy's, in the
page's language, and a product's words registered for `sf-button-copy` win.
`data-sf-code-copy="false"` turns a part inside off. Blocks of code
(`pre > code`, the highlighter) are never taken. `SF.codeCopy.refresh(root)`
re-reads a part changed without a DOM mutation; added and changed containers
are followed on their own.

## Fonts and compatibility

Core ships Inter Variable (fontsource 5.3.0, OFL-1.1) as the default source for
`--sf-text--family`, `--sf-heading--family` and `--sf-display--family`. The
files live in `src/core/fonts/inter/`, one per script, and `core.css` declares
them with `unicode-range`, so a page fetches only the scripts its text uses —
Latin and Cyrillic come to about 67 KB. The contract does not load Google Fonts
or another remote font service. The licence travels in the third-party notices.

Before Inter is available, Framework uses a local `Inter Fallback` face: Arial
with metric overrides. It keeps the natural font-driven geometry of controls
and text while preventing the webfont swap from moving the header, navigation,
or page columns. Inter uses `font-display: optional`: a cold page keeps the
metric fallback for that document instead of swapping late. A later visit gets
Inter on the first paint only when the files are still in the browser's memory
cache, as on a second navigation in the same tab; in Chrome a new tab whose
files come from the HTTP cache keeps the fallback for that document too
(measured 2026-11-12). A host that wants Inter on those first paints preloads
the faces it needs (`<link rel="preload" as="font" crossorigin>`), as Docara
does for Latin and, on a Cyrillic page, Cyrillic. Projects do not need to
reserve fixed heights, and custom font-family overrides continue to work as
before. The stack ends in the system fonts for an environment without Arial.

First-party typography does not declare a literal `13px`. Historical vendor
sources outside active Framework build roots are not part of this contract.
The correct public spelling is `--sf-body-text--family`; the color token is
`--sf-tertiary` (not `tertiaty`).

## Verification

Run:

```sh
npm test
npm run test:adaptive-sizing
node scripts/generate-adaptive-sizing-contract.mjs --check
UI_DOC_ROOT=/absolute/path/to/ui-doc npm run test:public-docs
```

Public token or behavior changes are incomplete until their generated
documentation projection and the corresponding `ui-doc` guide pass the
cross-repository check. See
`docs/developer/public-contract-documentation-gate.md`.

Core-only and Core plus Utility must yield the same computed H1-H6 and Display
matrix at mobile and desktop breakpoints. Overriding a semantic role must alter
the matching first-party selector; overriding a historical token must continue
to alter a legacy consumer.

`document.fonts.ready` says the files are in, not that the page draws with
them. Under `font-display: optional` a face whose file was not in when its text
was first laid out stays unused for that document while its status reads
`loaded`. Before core.runtime 1.54.2 the Cyrillic Inter face of a Russian page
started only when the first Cyrillic label was drawn (a Smart component's,
after the first frame), so cold loads of the button and segmented demos drew
their labels in the fallback on most cold loads, and the 500 labels looked
regular. core.js now starts the Latin face, and the Cyrillic one where
`<html lang>` is written in Cyrillic, from its first module
(`core/js/text-fonts.js`; opt out with `SF_BOOT_CONFIG.fonts.early = false`).
A probe that compares loads reads the font in use (Chrome DevTools Protocol
`CSS.getPlatformFontsForNode`) rather than `document.fonts`.
