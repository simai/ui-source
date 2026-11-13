# Switch

Switch changes a binary setting immediately. It is backed by a native checkbox
with `role="switch"`, so checked state, disabled state, form data and reset stay
owned by the browser.

## Public variations

- `.sf-switch--size-1` is the normal size and supports label, description and
  optional help icon.
- `.sf-switch--size-2` is the larger size, for forms built on size-2 fields.
- `.sf-switch--short` shortens the track to one and a half times its height
  instead of two, for space-constrained rows.
- `.sf-switch--icon` lets a decorative glyph ride inside the thumb. One glyph
  stays through both states; two, marked `.sf-switch-icon--off` and
  `.sf-switch-icon--on`, cross over as the thumb arrives. Either way the label
  names the setting — the glyph never does.

Two sizes, not five. The ladder has five rungs, but a control this small gains
nothing from the ones that collapse onto their neighbours in the mobile mode,
and the rung's real job is to match the fields and buttons standing beside it in
the same form. Those are built on `1` and, rarely, `2`.

The track stands as tall as the line of its size, the same rule the checkbox box
follows, and its length is twice that height. Both come from the typography
contract, so the mobile and the desktop geometry follow from the mode rather
than from a second list of numbers.

Name the setting itself, for example “Уведомления”, rather than the commands
“Включить” and “Выключить”. Use Checkbox when a value is only submitted later
with the rest of a form. Switch also covers what Toggle used to: a compact
binary setting without supporting text is a Switch without a description.

The thumb travels and the fill changes over one span, `--sf-switch--duration`,
so the two halves read as one movement; `prefers-reduced-motion` stops both.
The thumb used to move by swapping the track's alignment, which no browser
animates, so it jumped while the fill faded under it.

The whole enabled label is clickable. Pointer interaction does not show the
keyboard ring; `:focus-visible` highlights the track. Long labels wrap, logical
geometry follows direction, reduced motion is respected by Framework motion
utilities, and forced-colors keeps track and thumb distinguishable.

An on switch is one primary pill: the track's edge takes the fill colour, where the outline drew a grey ring around it (1.2.1, docs pre-check 2026-11-10 SW-05). A pointer over it still draws the hover edge.

The help mark stands beside the <label>, not inside it (.sf-checkable-row, 1.3.0, C59): pressing «?» never presses the switch. The Smart element's own <label> hugs its content (inline-size: fit-content), so a press on the empty rest of the row does nothing; class markup in list rows, menus and table rows keeps the full row as its target.

A Smart element with text is a row of its step (C63 W5): (control height − line) / 2 above and below, 40 at size 1, 60 with a description, 32 in compact, the touch target under a coarse pointer. The label is regular in all three choice controls (W6). The three share one base (W9): src/smart/helpers/checkable-row.js and checkable-row.css, and the name binding src/component/checkable-text-helper.js.

The label stands `--sf-space-1/2` from the track at every size, on either side of it (C105 H2, 1.3.1): 12 at 1440, 8 compact and on the phone, the row gap of a list row and of a checkbox or radio (C63). `--sf-switch-gap` sets it.

Motion (C66, 1.3.0): a press paints no on look; after the release the colours and the thumb travel run on one clock, 200 ms on `--sf-ease-move` (`calc(var(--sf-duration-fast) * 2)` until the scale has a 200 ms step); `--sf-switch--duration` and `--sf-switch--easing` set it; reduced motion is 0.
