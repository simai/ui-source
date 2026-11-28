# Icon Buttons

`icon-buttons` defines a compact native action whose visible content is a
single icon. The native `<button>` owns activation, disabled state, form
behaviour, keyboard focus and the required accessible name. The icon is
decorative and uses `aria-hidden="true"`.

## Public axes

- emphasis: `default`, `tonal`, `outline` or `ghost` (decision C15). The
  former `sf-icon-button--surface` and `sf-icon-button--link` draw exactly
  as `tonal` and `ghost` until 2027-01-01 (1.14.0, RG-IB-2): the runtime says
  so once per button in the console and notes each in `SF.deprecations`
  (journals `class-icon-button-retired-looks-c15`,
  `class-icon-button-link-to-ghost`); the Framework's own markup writes the
  new words;
- plain: `sf-icon-button--plain` (1.11.0, owner decision C201, the name the
  owner's) -- an icon inside another element: a field's action, the help mark
  at a heading, copy in a code block, the plain copy component. No plate in
  any state (hover, press, focus, a pressed toggle); only the glyph's ink
  moves: `--sf-on-surface-variant` at rest, `--sf-on-surface` under the
  pointer, `--sf-primary` on a press and while a toggle is on (its glyph
  filled). The focus ring is every button's, the hit area the icon button's
  of the same size. It is neutral whatever the scheme or the status classes
  say: a destructive or coloured action stays a ghost or an outline. Panels
  and toolbars keep the looks with a plate; the ghost look
  (`sf-icon-button--ghost`) is unchanged. At rest the glyph stands at least
  3:1 from the page, a card, the grey plate and a field's fill in both
  themes. `sf-button-icon` draws it with `appearance="plain"`;
- toggle: `sf-icon-button--toggle` (1.20.0, owner decision C393) -- a quiet
  on/off icon in a row of controls (a view switch, a panel switch) whose state
  reads from the plate, never from the glyph: the icon keeps its outline weight
  in both states. Off: no fill or edge, the glyph `--sf-on-surface-icon`,
  `--sf-surface-container-hover` under the pointer and `-active` on a press.
  On (`sf-icon-button--pressed` or `aria-pressed="true"`): the soft
  `--sf-primary-container` and a 1 px (`--sf-px`) `--sf-primary` ring inside
  the button (an inset shadow, the size holds), the glyph
  `--sf-on-primary-container`; the ring stays on hover
  (`--sf-primary-container-hover`) and press (`-active`). Focus is every
  button's ring outside; disabled takes the disabled ink and an on toggle keeps
  its ring in `--sf-outline-variant`; forced colours draw a Highlight edge. The
  ring stands 6.48:1 from the row in the light theme (page and card), 8.93:1
  on a dark card and 11.13:1 on the dark page (WCAG 1.4.11). Neutral whatever the scheme or the status classes say. The
  pressed look of outline, ghost and default (the filled icon) is unchanged.
  `sf-button-icon` draws it with `appearance="toggle"`;
- scheme: `primary`, `on-surface`, or `on-surface-variant`, one class each
  (1.16.1, SM-CPY-2: `on-surface-variant` alone draws the on-surface fill and
  edge with the quieter glyph; markup that also writes `on-surface` beside it
  draws the same); `secondary` is kept for older markup;
- status: `sf-icon-button--danger` for a destructive control, in every
  emphasis (decision C13); `sf-icon-button--error` is its former name, the
  same rules, until 2027-01-01 (journal class-c13-control-error-to-danger).
  The danger outline's border is red, the error role at the ink family's 64
  step (1.8.0, owner decision C118, as on the buttons); the other outlines
  keep the shared grey `--sf-outline`;
- on a place with its own ink (1.9.0, inverse places 2026-11-14) -- a strong
  coloured place (`bg-primary` ... `bg-error`, a strong alert bar), the duo
  gradient, glass (`sf-surface-media`) or an inverse place: a filled
  `on-surface` (or `secondary`) icon button is the place's ink with the
  place's accent label as its glyph (`--sf-on-primary`: the place's colour,
  black on glass), not `--sf-on-surface-inverse`, which read 1.29:1 on the
  white, as on `sf-button` (component.buttons 1.14.0); an `outline` or ghost
  danger icon button draws its glyph in the place's ink (red read 1.22-2.05:1
  there), its edge and state fills keep their hue. A card or a popup on such
  a place takes the theme's look back;
- size: `1/3`, `1/2`, `1`, `2`, or `3`;
- density: none (1.14.0, owner decision C213). Size and height change an
  icon button and keep it square; `spacing-compact`, `spacing-comfortable`,
  `spacing-spacious` and the older `tightness-low`, `tightness-high`,
  `tightness-highest` moved its side padding only (32 x 40 ... 80 x 56). They
  draw nothing now and the runtime says so once per button and notes them in
  `SF.deprecations` until 2027-01-01 (journal
  `class-icon-button-density-c213`); the constructor's `spacing` and
  `tightness` options are noted the same way. `sf-button` keeps density;
- height (1.5.0, decisions C27 and C35): the default,
  `sf-icon-button--height-low`, `sf-icon-button--height-high` or
  `sf-icon-button--height-highest` -- the size's tightness step on all four
  sides, so the button stays square and stands at the size's line + 2 x the
  step (size 1 on desktop 32 / 40 / 48 / 56; compact 28 / 32 / 40 / 48; phone
  28 / 36 / 44 / 52); the icon keeps the size. A close takes the same heights.
  The lowest control is 24 (1.15.0, RG-CL-4; C14, C36): on a phone a low
  size `1/3` stands at the size's default step, 24, not 20.
  The constructor's option is `height`;
- a close (`sf-icon-button--close`) is drawn as ghost in every look (1.15.0,
  RG-CL-3; owner decision C14: a cross has no square and no solid plate):
  `default`, `tonal`, `outline` and `surface` on a close draw exactly as
  `ghost` until 2027-01-01, said once per button in the console and noted in
  `SF.deprecations` (journal `class-icon-button-close-looks-c14`). A close of
  its own is `sf-button-close`;
- radius: the normal control radius `--sf-radius--ui`, or explicit
  `radius-square` and `radius-rounded` overrides.

The glyph inside an icon button keeps the bottom alignment (1.9.1, owner
decision C151): an icon in running text sits on the middle of the line, but
inside a button the glyph is the whole content. A button laid out without flex
-- `sf-file-preview`'s actions, class markup without `.flex` -- stays on its
ladder height (28 at size 1/2 compact and on a phone, not 28.55).

The glyph is the ink of `sf-button`'s label in the same look and scheme
(1.14.0, RG-IB-1): ghost primary `--sf-primary` and ghost danger
`--sf-error` (they took the darker pressed step, `-active`). A quiet
neutral glyph is `--sf-on-surface-variant` on every look, tonal included:
one scheme, one ink. The tonal plate does not turn it to the container's
variant -- that rule is for text (4.5:1), and the glyph asks 3:1 (C107 (2));
the page role measures 4.17:1 and more on the plate, and stays quieter than
the plain neutral glyph in both themes (RG-IB-1 b). The plain neutral glyph stays
`--sf-on-surface-icon`, the icon of a button with text (owner decision C107
(1), (3)). Under a pointer it follows the label: neutral tonal, outline and
ghost -- plain and quiet alike -- take on-surface's hover and press steps
(`--sf-on-surface-hover` / `-active` in the light theme, `--sf-on-surface` in
the dark one; RG-IB-3: a quiet tonal glyph used to stay put); outline and
ghost primary and danger step to `-hover` and `-active`. `tonal primary`
tints with the primary container role, as on the button.

`radius-default` is the control radius `--sf-radius--ui`, the same as no
radius class; it stays for the Smart `radius="default"` value. The utility
class of that name and the `--sf-radius-default` token were removed on
2026-11-02 (journal `token-radius-default`). Joined positions
`segment-start`, `segment-middle`, and `segment-end` belong to Button Group
composition and use an inset keyboard focus ring. A join is one line, the end
edge of the segment before it, as on the button: between filled segments the
label ink of the look at 24 % (1.20.3, owner remark VL-77), and ghost segments
draw the group's outline (`--sf-outline`) as ghost buttons do.

A link drawn as an icon button, `<a class="sf-icon-button" href>` (what
`sf-button-icon` draws for its `href`, decision C51), takes no link underline,
as `a.sf-button` does; its ink is the icon button's own (1.6.1).

## Name tooltip

A class icon button with an `aria-label` and no visible words shows that name
as the Framework's tooltip by itself (owner decision C248, 1.16.0), as
`<sf-button-icon>` does (C160 (1)): after 0.5 s of hover, its neighbours at
once, keyboard focus at once, a long press on a touch screen, below the
button and flipped above at the bottom edge. Nothing is drawn or fetched
before the first hover, focus or long press; then a `.sf-tooltip` is made
beside the button, linked by `data-tooltip`, and the tooltip controller is
loaded. `data-tooltip="off"` turns it off; a `data-tooltip` naming the page's
own tooltip wins. Never a second tooltip: a button with a `title`, its own
or a host's around it (the browser's tooltip the page chose, or a hint a
component wrote there, as the plain theme button does, C244 -- drop the title
to get the Framework's), is left alone, as is a close
button (`sf-button-close`, C14), a disabled or hidden button, and the button
inside `<sf-button-icon>`, which shows its own.

A control a component draws with no words of its own marks itself
`data-sf-name-tip` and shows its name the same way: its `aria-label`, or, with
none, the name read from its content -- what a reader takes from it, glyphs
and a badge's digits left out, its visually hidden words (a status, a count's
phrase) kept (1.21.0). `data-sf-name-tip="inline-end"` stands the tooltip
beside the control at its inline end with its tail pointing back at it, for a
vertical rail of rows (`sf-menu appearance="rail"`, as sf-admin-menu's rail
tooltips stand): it does not cover the next row.

```html
<button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1" aria-label="Курсив">
  <i class="sf-icon" aria-hidden="true">format_italic</i>
</button>
```

## States

Native `disabled` is the source of truth for an unavailable action. Loading
uses `loading sf-icon-button-state-loading`, `aria-busy="true"`, and native
`disabled`, preventing duplicate activation. A loading icon button shows the
spinner in place of its icon, at the icon's size (an element with
`sf-loader-container sf-loader--infinite sf-icon-button-spinner`; the
constructor draws it), and a still arc under reduced motion. A loading icon
button keeps its scheme colour (1.5.1, the C36 follow-up): the disabled look's
rules skip `sf-icon-button-state-loading`, so the fill, the edge and the icon
colour are the resting button's, and the spinner takes the icon colour unless
`--sf-loader--color` is set; its background ring is that colour at 16 % (the
fill family of the alpha scale; `--sf-spinner-track-color` wins). A button that
is disabled and loading at once adds `.disabled` and wears the disabled look,
the spinner in the disabled ink; the constructor does that for `loading` with
`disabled`. Markup with the bare `loading` class and no state class keeps the
disabled look. Tonal danger greys when disabled, as every other look does.
`aria-disabled="true"` is disabled for the look as well (1.10.0, owner remark
2026-11-15 on the copy button): the disabled look, no hover or press fill, the
arrow cursor; focus and its ring stay. The stripes are gone;
`--sf-icon-button-loading-stripe` is read until 2026-12-01 (journal
`token-button-loading-stripe`). A two-state action -- bold in an editor's
toolbar, wrap lines in a code block -- keeps one name and says its state with
`aria-pressed`. Only a toggle is drawn pressed (1.13.0, owner decision C211
(1)): an `outline` or `ghost` icon button in the neutral scheme
(`on-surface`, its quiet `on-surface-variant`, the former `secondary`), and
a filled (`default`) icon button of any scheme (owner decision C309 (2),
2026-11-18): its fill at the scheme's pressed step, its own ink, the icon
filled. The toggle look (`sf-icon-button--toggle`, 1.20.0, C393, above) is a
toggle too and draws its own on state: the plate and a ring, the icon kept
outline.
Pressed, it wears the pressed look (1.3.0, owner decision 2026-11-07, rule
C12): the primary container fill, the icon in `--sf-on-primary-container` and
filled (`FILL 1`) -- two cues, not colour alone -- an outline toggle keeping
its edge (group build 16 G14, C393: a fill and a frame; a ghost toggle keeps
the border's width transparent, so the height does not move). Hover and press step the container. Focus draws the ring; disabled
wears the disabled look. A `tonal` or `surface` icon button, or an outline or
ghost in another scheme, keeps its own look under `aria-pressed`, and the
runtime says once per button in the console that it is no toggle (the tonal
toggle looks of 1.6.1 are gone with it). A choice of one among several -- a
view, a width, a theme -- is not a set of toggles: write `sf-segmented`.
`sf-icon-button--pressed` draws the same look without `aria-pressed`, for an
action whose name changes with the state («Добавить в избранное» → «Убрать из
избранного»): its name says the state, so it carries no `aria-pressed`
(`sf-button-icon` does it with `label-pressed`). With the Loader's icon subset,
mark the icon of a pressed toggle `sf-icon--filled` as well: the subset holds
the filled glyph only for an icon marked filled.
`--sf-icon-button-pressed-background-color` and
`--sf-icon-button-pressed-color` recolour the resting pressed look.

Pointer activation does not show a focus ring. Keyboard navigation uses
`:focus-visible`, including forced-colours fallback. Constructor-created
buttons default to `type="button"` so they do not submit a surrounding form by
accident.

Smart owner: `sf-icon-button`. The `icon` variant composes Smart Icons; the
`close` variant composes the decorative Smart Close glyph. Both retain one
native button as the action and focus owner.

## Count and dot

A count or a dot inside the button -- `<span class="sf-badge
sf-badge--anchored" data-count="3"></span>` after the icon -- sits at the top
end corner of the button, on its radius (the 45-degree point of a rounded or
round button, the corner of a square one), sized by the button's size; sizes
1/3 and 1/2 carry a dot only. The count joins the button's `aria-label`:
«Уведомления, 3 непрочитанных». See the Badges documentation, section «Бейдж на
якоре» (simai/ui-source#12).

Layout without the script (1.12.0, RG-B-53): the layout the component's
script gives the parts it builds (`json/*.utility.json`) is in the stylesheet
too, so markup a page writes draws the same without the script and where the
script never builds the part: `.sf-icon-button`, `.sf-icon-button .sf-icon`. It stands in `@layer sf.base`, under
the utilities and the component rules, so a utility class on the element still
wins; a root a Smart element drew (a child of `[data-sf-started]`, or printed
`[data-sf-static]`) is left as it was. Generated by
`scripts/generate-utility-hint-layout.mjs` into
`scss/_css__utility_hint_layout.scss`.
