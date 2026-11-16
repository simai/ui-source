# Radio

Radio owns one value inside a mutually exclusive native group. Use the same
`name` for related `input[type="radio"]` elements and wrap the visible choices
in `fieldset` with a meaningful `legend`.

## Sizes

Two rungs, `1` and `2`, the same pair Switch carries. A control this small gains
nothing from the rungs that collapse onto their neighbours in the mobile mode,
and the rung is there to match the fields and buttons standing beside it in the
same form.

## Public variations

- `.sf-radio-button--size-1` is the normal form-control size.
- `.sf-radio-button--size-2` is the larger size, for forms built on size-2 fields.
- The constructor retains `type: "font"`; since 1.5.0 (C222) it draws plain
  radios with their labels, not font-sample tiles, and still creates native
  radios and one submitted value.
  Deprecated since 2026-11-10 (change journal
  `class-radio-type-font-to-segmented`, decision D11b): a choice of one value
  from buttons is `sf-segmented`. The font-sample classes
  (`sf-radio-wrap--type-font`, `sf-radio-group--font`,
  `sf-radio-button--type-font`) keep working until 2027-01-01; new pages use
  `sf-segmented`, and the docs page shows the variant only as a former name.

The native input owns selection, disabled state, arrow-key behavior, form data
and reset. `.active` is only a synchronized visual projection. Invalid choices
use `aria-invalid="true"`, `.error` and a visible explanation.

The whole enabled label is the pointer target. Pointer interaction is visually
quiet; keyboard focus uses `:focus-visible`. Long text wraps, logical layout
follows direction, and system colors preserve selected and disabled states.

Use Framework typography, spacing and role-color tokens for adaptation. The
indicator remains circular; it is not a surface or a configurable card radius.

A radio is named by its label row and described by its description, as the checkbox (1.1.1, docs pre-check 2026-11-10 RA-02; src/component/checkable-text-helper.js).

The help mark stands beside the <label>, not inside it (.sf-checkable-row, 1.2.0, C59): pressing «?» never presses the control. The Smart element's own <label> hugs its content (inline-size: fit-content), so a press on the empty rest of the row does nothing; class markup in list rows, menus, choice lists and table rows keeps the full row as its target.

A Smart element with text is a row of its step (C63 W5): (control height − line) / 2 above and below, 40 at size 1, 60 with a description, 32 in compact, the touch target under a coarse pointer. The label is regular in all three choice controls (W6). The three share one base (W9): src/smart/helpers/checkable-row.js and checkable-row.css, and the name binding src/component/checkable-text-helper.js.

1.5.0 (DEV forms study RG-CB-1, RG-CB-4, RG-RB-1, owner decisions C221 and C222, 2026-11-16): the class `<label class="sf-radio-button">` hugs its content as the Smart row does (C63, C19), so a press on the empty end of a full-width row selects nothing; with the ring at the end the row keeps its full width. Hover marks the ring of an unselected radio only. Error outweighs selected: a selected radio in error draws its ring and dot in `--sf-error` (or `--sf-radio-button-invalid-border-color`) at every size and density. The font-sample tiles are no longer drawn (C222): until 2027-01-01 the runtime redraws a `sf-radio-wrap--type-font` group, written or built with `type: "font"`, as plain radios with their labels in a column (the option's description, else its aria-label, else its value; the group's title above), notes it in `SF.deprecations` and warns once on the console. Write `sf-segmented` instead.
