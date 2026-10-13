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
| step from a picture to its label | `--sf-ui-S--text-space-x` |
| inline padding | `--sf-ui-S--space-x` |

At size 1 on desktop that is a 24px line and 24px pictures in a 40px control.
A part never takes a size of its own to fit: if the ladder size does not fit,
the padding is wrong, not the part.

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

## 4. Verification

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
