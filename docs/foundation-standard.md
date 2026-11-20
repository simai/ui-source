# SIMAI Framework foundations standard

One standard for the system decisions every component stands on (owner
decision C181 (4), 2026-11-14). Each theme is one page `docs/foundation-*.md`
in English; every rule on it names the owner decision that set it (`C##`,
recorded in ui-control `control/docs-review/decisions.md` and mapped in
`control/standards/rule-map.json`). The Russian version for readers is the
ui-doc guide (`content/ru/guide/`); it is written there, not generated from
these pages.

## Themes

| Theme | Page | Check in the pair build |
| --- | --- | --- |
| Sizes and the size ladder | [foundation-size-ladder.md](foundation-size-ladder.md) | `tests/foundation-size-ladder-c181.contract.test.mjs` |
| Icons | [foundation-icons.md](foundation-icons.md) | `tests/foundation-icons-c181.contract.test.mjs` |
| Spacing roles H1-H6 | [foundation-spacing-roles.md](foundation-spacing-roles.md) | `tests/foundation-spacing-roles-c181.contract.test.mjs` |
| Layers | [foundation-layers.md](foundation-layers.md) | `tests/foundation-layers-c181.contract.test.mjs` |
| Breakpoints and container steps | [foundation-container-steps.md](foundation-container-steps.md) | `tests/foundation-container-steps-c181.contract.test.mjs` |

Not written yet, from the list in C181 (4): colours, focus, motion and names.
Their rules live in the decisions and in the older pages below until they get
a page of their own.

## How a theme page is built

- `## Rules`: numbered, plain, each with its decision id.
- `## Numbers`: a table `Rule | Token | On | normal | compact | phone`.
  `Token` is a custom property, or a `calc()` over them; `On` names the
  element's classes when a component sets the token. `normal` is a desktop
  page (1440 px), `compact` a `data-sf-density="compact"` region on it,
  `phone` a 390 px page; px at a 16 px root, plain numbers where the token is
  a number; `—` where the token does not exist at that width.
- `## Pending`: what a branch carries that no released pair has yet, with the
  branch and its commit.
- `## Known gaps`: where the code and a decision disagree today. A gap is
  listed, not fixed, on the page; the fix goes through the component's own
  work.
- `## Check`: the tests that hold the theme.

The theme's contract test resolves every Numbers row against the built
sheets (`UI_CORE_ROOT`, which the pair build sets), with a small cascade in
`tests/support/foundation-tokens.mjs`: `@layer` order, `@media` widths,
specificity and inheritance of custom properties. A changed token fails the
test until the page says the new number, and a changed page fails until the
token does.

## Older foundation pages

These came before the standard and stay as the detailed references the theme
pages link to: [foundation-composition-geometry.md](foundation-composition-geometry.md)
(ladder parts, padding, axes, rows, the six roles in detail),
[foundation-control-spacing.md](foundation-control-spacing.md) (density),
[foundation-container-width.md](foundation-container-width.md),
[foundation-layout-tokens.md](foundation-layout-tokens.md),
[foundation-radius-nesting.md](foundation-radius-nesting.md),
[foundation-chart-colours.md](foundation-chart-colours.md),
[foundation-backgrounds.md](foundation-backgrounds.md),
[foundation-paper-and-well.md](foundation-paper-and-well.md),
[foundation-touch-fields.md](foundation-touch-fields.md),
[foundation-logical-sides.md](foundation-logical-sides.md),
[foundation-modern-utilities.md](foundation-modern-utilities.md).
`foundation-control-spacing.md` is still in Russian.

## Exceptions to C18

Owner decision C18: every value comes from a Framework system (palette,
size ladder, space, radius, line and layer tokens), and an exception is
listed by name. These are the listed ones; a value outside them in a sheet is
a defect (`tools/lint-raw-values.mjs` reads px and stacking numbers).

| Exception | Where | Values | Why |
| --- | --- | --- | --- |
| Width of a text column (C18, C212 (3); C396) | `--sf-text--measure`, `--sf-text--measure-narrow`, `--sf-text--measure-wide` (core typography); the `measure*` utilities; `max-w-prose` until 2027-01-01 | 65ch, 45ch, 80ch before C396; since C396 no exception: the steps `--sf-measure-80`, `-52`, `-96` of the width ladder in characters (half the body text size each), and the names are aliases until 2027-01-01 | A line length is counted in characters of the text; since C396 the width ladder counts them on the body text size, so it is a system of its own and follows density and the browser's font size ([foundation-size-ladder.md](foundation-size-ladder.md), rule 12). |
| A line of one or two pixels (C18, C173 (6)) | `--sf-px`, `--sf-line--border`, `--sf-line--indicator`; widths 1 and 2 of `border-*`, `outline-*`, `ring-*`, `divide-*`, `stroke-*`, `decoration-*` | 1 px, 2 px | A hairline stays one device line at any text size. |
| Media (C18) | an image's or a video's own size and ratio | the file's | The picture brings its size; the layout around it uses the systems. |
| Brand colours (C18, C269) | `bg-<brand>` (27 brands, `utility/background-color-brand`) and `fill-<brand>` (24, `utility/fill-brand`): Facebook, Messenger, YouTube, WhatsApp, Instagram, WeChat, TikTok, Sina Weibo, QQ, Telegram, Snapchat, Kuaishou, Qzone, Pinterest, Twitter, Reddit, Quora, Skype, Microsoft Teams, LinkedIn, VK, Viber, Vimeo, OK, Tumblr, Behance, SoundCloud | each brand's own hex (and the gradients of Messenger, Instagram and Skype) | A brand's mark is someone else's sign; its colour is not the Framework's choice. The black brands (TikTok, QQ, Tumblr) get a one-line `--sf-outline-variant` edge inside the box in the dark theme. |
