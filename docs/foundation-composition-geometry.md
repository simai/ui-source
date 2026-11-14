# Composition geometry

Status: standard. Applies to every component, checked on every change.

Small differences — a picture 2px smaller in one place than in another, a label
3px to the side of the same label elsewhere — are visible to the eye even when
nobody can name them, and they make a product look careless. This standard
removes them by construction and measures that they stay removed.

## 1. One ladder

Every component size is a rung of one ladder. A rung fixes, for every component
that has that size:

| Part | Size at rung `S` |
| --- | --- |
| text line `L` | `--sf-text-height-S` |
| control height `H` | `--sf-ui-S--control-height` |
| icon, avatar, colour dot, checkbox, chevron, check | `L` |
| flag (rectangular picture) | `3/4 · L`, the optical size of an icon's glyph |
| step from a picture to its label in a control (H1, §5) | `--sf-ui-S--text-space-x` |
| inline padding of a control | `--sf-ui-S--space-x` |

At size 1 on desktop that is a 24px line and 24px pictures in a 40px control.
A part never takes a size of its own to fit: if the ladder size does not fit,
the padding is wrong, not the part.

### Small steps below the ladder (indicators and marks)

A non-interactive indicator is not a control: nothing is pressed, so it has
no control height and may stand below the ladder's lowest rung. Below 24 a
mark takes one of five **small steps, 4 · 6 · 8 · 12 · 16** (owner decision
C132, 2026-11-13), the same on a desktop, on a phone and in a compact region.
Nothing is drawn below 4; 4 is only for ticks and separators, and a coloured
mark is never under 6. 16 is the main ladder's step 1/4 (avatar 1/4); 4 to 12
have no public name. The author sets only the host's size: the component
derives each mark from its host's step through one table in core
(`src/core/scss/vars/_sf_var__size.scss`, emitted as the internal
`--sf-micro--*` properties, not public):

| Mark | 1/4 | 1/3 | 1/2 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- | --- | --- |
| status point on an avatar, «something new» dot (one table) | 6 | 6 | 8 | 12 | 12 | 16 |
| count on an avatar or an icon button | — | dot | dot | 16 | 16 | 16 |
| dot: `sf-dot`, a status tag, a timeline step | — | 6 | 6 | 8 | 8 | 12 |
| remove cross of a tag or a chip | — | 8 | 8 | 12 | 12 | 16 (12 in compact and on a phone) |
| company / «verified» badge on an avatar | 8 | 8 | 12 | 12 | 16 | 16 |
| tick, separator | 4 | 4 | 4 | 4 | 4 | 4 |

The surface ring of a point is drawn outside its coloured disc (1 px on 1/4
and 1/3, 2 px from 1/2), so the coloured diameter is the step. The tag cross
is half the tag's text line rounded down to a small step. A badge with text
(`sf-badge`, `sf-badge--line-1/2`) is not a mark: it stays on the main ladder.
A progress track (`sf-progress-bar`, `sf-progress-scale`) is a rule, not a
mark; only its value line is text of the ladder.

**Outside the small steps** (C132 #q-icons, C18). These parts below 24 belong
to the icon row or to the internals of a control, not to marks, and keep their
own sizes until the icon-row study. Nothing else below 24 may take a size off
4 · 6 · 8 · 12 · 16 or a main-ladder step:

| Part | Sizes below 24 |
| --- | --- |
| icon row `sf-icon` (and a glyph a control takes from it) | 14 at 1/2, 20 at 2; 18 / 22 glyphs in controls |
| spinner | 20 / 28 / 36 |
| checkbox | box 20 / 28; check glyph 14 / 18 / 22 |
| radio button | dot 10 / 14 |
| slider | thumb inner 10 / 14 |
| switch | knob |
| close button cross (`sf-button-close`, an icon button's close, alert, toast) | 14 / 16 / 18 / 20, the glyph of its icon-button step |
| «?» of `sf-help-mark` | glyph 20 at 1/2 (an icon) |

A tag's remove cross is a mark, not a close button: it takes the table above.
A box of the main ladder (20 on a phone or in a compact region) is a ladder
step, not a small step.

A colour dot that stands for a picture inside a control (a list row's colour,
a swatch in a field) is a part of that control and takes `L`, as in the table
above. An indicator that can be pressed or focused is a control and takes the
ladder.

## 2. Padding gives up the border

A control's height counts its border. The block padding is what is left:

    padding-block = (H − L) / 2 − border

so `40 = 1 + 7 + 24 + 7 + 1`. Shrinking the content to `L − 2` instead (the
old dropdown did) makes every picture in the control 2px smaller than the same
picture anywhere else.

## 3. Related parts share axes

Parts that belong together line up exactly: a field and its open list, a label
and its control, a row and the header above it. Where a container adds an inset
(a list's padding, a border), the content inside compensates so it starts on
the same axis as its counterpart:

    inner padding = counterpart padding + counterpart border − container inset

A dropdown option therefore starts its picture where the field starts its
picture, its label where the field's value starts, and its check on the axis of
the field's chevron — measured on the glyph, not on the button around it.

Every list in a panel shares that axis, with or without a field above it: a
context menu's items start their content at `space-x + border` from the panel
edge, like a dropdown's options. The context menu publishes the axis on its
content (`--sf-context-menu--item-inset-start-S`, `--sf-context-menu--label-inset-S`)
so anything else a window puts in the panel reads it instead of copying it.

## 4. Multi-line rows

A row has one height per rung, `H`, for one line (rule 2). A row that holds
more than one line keeps the one-line row's block inset and grows by whole
bands, never by a padding or a size of its own (owner decisions C18, C47,
C49):

    height = H + Σ bands          (H = (H − L) / 2 + L + (H − L) / 2)
    text band    = the line height of that text's step
                   (a supporting line, a wrapped line)
    part band    = step + the part's height
                   (a badge or a count under the text: step --sf-space-1/4,
                    the meta's own gap; a control under the text: step
                    --sf-space-1/3)

Every term is a token of the ladder or the space scale, so the height is a
sum the reader can check. The ladder at size 1:

| Row | Desktop | Phone |
| --- | --- | --- |
| one line: `H` | 40 = 8 + 24 + 8 | 36 = 8 + 20 + 8 |
| title + supporting line | 60 = 40 + 20 | 52 = 36 + 16 |
| title + supporting line + badge band (sf-list, narrow) | 88 = 60 + 4 + 24 | 76 = 52 + 4 + 20 |

A block that takes a taller rung for its rows keeps the same sum on its own
`H`: sf-list-attention's row is rung 3 (56, compact 48, phone 52), whose `H`
holds the title and the meta line, `(H − L − l) / 2` above and below; its
head with the summary as a meta line is that `H`, the group page's head adds
one meta line (52 + 16 = 68 on a phone), and a row whose action stands
under its text adds a control band (52 + 8 + 28 = 88). A menu row with a
caption under its name is the same rule (C49).

## 5. Horizontal spacing: six roles (C105)

Every horizontal distance between two parts is one of six roles, each on an
existing token (owner decision C105, 2026-11-12; research
ui-control `control/research/2026-11-12-horizontal-spacing.md`). A token is
one name with three numbers: a compact region (`data-sf-density`, C22/C79) and
the phone move it themselves. There are no role variables: a component reads
the role's token through its own variable, and acceptance measures it.

| Role | Between | Where | Token | normal · compact · phone |
| --- | --- | --- | --- | --- |
| H1 | picture → label inside a **control** | sf-button, tag, tab, segment, button link | `--sf-ui-S--text-space-x` (the button's own step, C76) | 1/2: 7 · 6 · 6; 1: 8 · 7 · 6; 2: 10 · 8 · 8 |
| H2 | picture → text in a **row** | list, menu column, dropdown options, field with a picture, notice, table cell, card row, tree row | `--sf-space-1/2` | 12 · 8 · 8 |
| H3 | picture → text **inside running text** | breadcrumbs, link with an icon, help mark | `--sf-space-1/4` | 4 · 4 · 4 |
| H4 | edge → content of a **value container** | field, dropdown and its options, list, menu, contents | C77: 1/2 `--sf-space-1/2` (never below 12), 1 `--sf-space-1`, 2 `--sf-space-2`, the border inside; in a panel a plate `--sf-space-1/4` + the row's inset less 4 | 1/2: 12 · 12 · 12; 1: 16 · 12 · 12; 2: 20 · 16 · 16 |
| H5 | between **neighbours** | buttons of one group; tags and plates; tabs | buttons `--sf-space-1/3`; tags and plates `--sf-space-1/4`; tabs 0, edge to edge (C99) | 8 · 4 · 8; 4; 0 |
| H6 | between **groups**; a **surface's** inset | group ↔ group, field ↔ button; notice, table cell; card, dialog | groups and cells `--sf-space-1`; card and dialog padding 24 (`--sf-space-3`) | 16 · 12 · 12; 24 · 20 · 16 |

A **control** is one compact object a person presses (button, tag, tab,
segment, icon button); a **row** is a line of content in a container (list,
menu column, options, a field, a notice, a cell, a tree row). A field is a
row, because it lines up with its own list.

Rules that go with the roles:

1. A field and its list share the axis: picture over picture, text over text
   (§3).
2. A group heading in a list stands over the row pictures (H4 from the
   frame's edge), not over their text.
3. In a list where any row has a picture, a row without one keeps the
   picture's place empty, so every text starts on one vertical.
4. A control with a picture starts it at `--sf-ui-S--space-x`; without one,
   its label starts at space-x + text-space-x (the button as it is).
5. A component never uses a layout utility (`gap-2`, `p-2`) for its own
   geometry; it reads the role's token through its own variable. Layout
   utilities are for pages.
6. A nested row steps its child in by its first column and the row gap: the
   child's first column stands under the parent's text (C109; a menu with
   icons on every level). A text-only nested list steps by its H4.
7. A picture with text in a table cell or a card row (HS-14) is one inline
   row with the H2 gap, never a space character (a space is about 4–5 px and
   follows the font):

       <td><span class="inline-flex items-cross-center gap-1/2"><i class="sf-icon" aria-hidden="true">description</i><span>Report.pdf</span></span></td>

## 6. One row, one rung (C103)

A label, its value and a button beside them (copy, an icon action, an icon
link) that stand in one row stand on one rung of the ladder (owner decision
C103, 2026-11-12): text 1/2 → the button is `size="1/2"` (32, icon 20); text
1 → `size="1"` (40, icon 24). The label is not smaller than the value in such
a row; a smaller label stands only above its value (like a field's label). A
button in a row of buttons or in a field takes the size of that row or field.
Density moves the whole row together (C22, C79). Acceptance measures it: the
button's height equals the control height of the row's text rung, its icon the
text line.

## 7. Verification

- A contract test holds each mechanism (the rule that produces the geometry).
- A browser probe measures the result for every kind, size and look at a
  desktop and a mobile width with zero tolerance:
  - `tests/browser/dropdown-alignment.cli.js` on
    `tests/fixtures/dropdown-alignment-lab.html` — a dropdown field against its
    list;
  - `tests/browser/field-composition.cli.js` on
    `tests/fixtures/field-composition-lab.html` — text field, textarea,
    dropdown and phone field against each other in one column, and the phone's
    country list against its field.
  - `tests/browser/panel-composition.cli.js` on
    `tests/fixtures/panel-composition-lab.html` — a context menu's items
    against a dropdown list of the same size, every item's label on one axis,
    and a navigation menu row against a size 1 control.
  - `tests/browser/choice-composition.cli.js` on
    `tests/fixtures/choice-composition-lab.html` — checkbox, radio and switch
    beside a text field: the mark on the text line and on the centre of the
    label's first line, one label step for all three, the description under
    the label.
  - `tests/browser/action-composition.cli.js` on
    `tests/fixtures/action-composition-lab.html` — buttons, icon buttons and
    tags of each size beside a field: one height, pictures on the text line,
    one picture-to-label step, centred text-only labels, a drawn tag remove
    mark with a 24px target.
  - `tests/browser/navigation-composition.cli.js` on
    `tests/fixtures/navigation-composition-lab.html` — every tab variant and
    a pagination row as size 1 controls sharing one centre.
  - `tests/browser/list-row-composition.cli.js` on
    `tests/fixtures/list-row-composition-lab.html` — text, checkbox and icon
    list rows, standalone and in a list: the row as tall as the control of its
    size with its divider, the content on the row's centre.
  - `tests/browser/control-boundary.cli.js` on
    `tests/fixtures/control-boundary-lab.html` — the resting boundary of every
    input control in both themes: at least WCAG 1.4.11's 3:1 against its
    surface, calmer than `--sf-outline`, never weaker on hover.
- A change to a component is not finished until its sizes are measured against
  the ladder and its related parts against each other.

## Arithmetic that survives a consumer

A value a consumer may set and a rule then computes with must survive the
consumer's spelling. A unitless `0` subtracted from a length makes the whole
`calc()` invalid and drops the declaration: write a zero length as
`calc(var(--sf-px) * 0)`, and read a consumer's inset through a fallback that
is a length, never a bare `0`. Where consumers and other components already write a bare `0`
into a variable the arithmetic reads, register it as a length with
`@property` (`syntax: '<length>'`): a bare `0` is then a valid length and the
subtraction holds. Buttons and icon buttons do this for their side border
widths.

## Checklist for a component change

1. List the component's parts per size and check each against the ladder.
2. Check that the block padding follows rule 2 and the height is `H`.
3. Find every counterpart (field and list, label and control, trigger and
   panel) and measure the shared axes at desktop and mobile widths.
4. Encode the mechanism in a contract test; add or extend the browser probe.
