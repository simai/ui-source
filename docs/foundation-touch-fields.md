# Field text on touch phones

A text field's text is never below 16px on a touch phone (simai/ui-source#25,
requested by the ui-chat kit). iOS Safari zooms the page into a field whose
computed font size is below 16px when the field takes focus, and does not zoom
back out. On a phone the field steps 1/3, 1/2 and 1 are 12-14px, so every form
jumped on the first tap.

The rule lives in core (`src/core/scss/_sf_css__touch_fields.scss`), so it
covers every field the Framework draws -- `sf-input`, `sf-textarea`, the
dropdown's and the menu's search, the datepicker's field -- and a native
`input`, `textarea` or `select` a product writes itself.

| | |
| --- | --- |
| When | `(hover: none) and (pointer: coarse) and (max-width: 59.98rem)`: a touch primary pointer that cannot hover, below the desktop breakpoint |
| What | the field's `font-size` becomes 16px |
| Unchanged | the line height and so the control height of the step; a field already at 16px or more; anything inside a `--size-3` block; checkboxes, radios, ranges, buttons |
| Desktop | unchanged, as is a touch laptop or a tablet in landscape |

The floor is used instead of `maximum-scale=1` in the viewport meta: that
stops the zoom too, but it also takes pinch zoom away from the reader.

Evidence: `tests/browser/touch-field-text.browser.mjs` (390px touch phone
against a plain window of the same width and 1440px desktop).
