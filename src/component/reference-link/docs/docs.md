# Reference Link component

Reference Link is a specialised navigation surface for a named destination and
its compact reference, such as a route, source or section identifier. Use the
ordinary Link component when this additional reference is not useful.

The native anchor owns navigation. Canonical elements are `__main`, `__link`,
`__icon` and `__meta`; historical element classes remain supported aliases.
The complete surface is the pointer target and receives the keyboard-only focus
indicator. An unavailable reference has no `href` and is marked with
`disabled` plus `aria-disabled="true"`.

Opening a new browsing context must be intentional, use `rel="noopener"` and
be disclosed in the visible or accessible name. Icons are decorative.

Since component.reference-link 1.0.2 (C113 follow-up, 2026-11-13): on the
card's hover and press plates the inks step with the plate. The link takes
`--sf-link-hover` / `--sf-link-active`, the icon `--sf-primary-hover` /
`--sf-primary-active`, and the meta `--sf-on-surface-container-variant`, the
dim ink made for a fill. In the dark theme the resting inks fell under 4.5:1
on those plates (3.78 pressed on a card, 3.90 on a popup).
`--sf-reference-link-link-color` still wins for the link. A plain reference
has no plate and keeps its inks.

Since component.reference-link 1.2.0 (owner decision C147, 2026-11-14):

- **In text** — `sf-reference-link--inline` on a `<span>` root: the link flows
  with the sentence and takes its text size; no frame, padding or overlay.

  ```html
  <span class="sf-reference-link sf-reference-link--inline"><a class="sf-reference-link__link" href="/tasks/4812/"><i class="sf-reference-link__icon sf-icon" aria-hidden="true">task_alt</i><span class="sf-reference-link__label">Подписать договор</span> <span class="sf-reference-link__number">№ 4812</span></a></span>
  ```

  Write the parts without white space between the icon and the name. The
  icon is one line high (`1lh`), 4 before the name; the label (`__label`) is
  always underlined, the number (`__number`) is the dim ink and never breaks.
- **Underline** — in a card, a size, a line and plain the link is underlined
  under the pointer and on keyboard focus only; in text always.
- **New tab** — after the words `<i class="sf-reference-link__tab sf-icon"
  aria-hidden="true">open_in_new</i>` and `<span
  class="sf-reference-link__tab-words">(откроется в новой вкладке)</span>`
  (read by a screen reader, not seen). The Smart element writes both.
- **Visited** — `--sf-link-visited` only for `--inline` inside
  `[data-sf-visited="on"]` (sites, documentation).
- **Gone** — `sf-reference-link--gone` with `--missing` or `--forbidden`, no
  `<a>`: the words and the `link_off` icon in `--sf-on-surface-variant`, the
  reason in `<span class="sf-reference-link__reason">` after the name (drawn
  after « · »).
- **Copy** — `sf-reference-link--copy` on a card and a `<button
  class="sf-reference-link__copy sf-icon-button …" data-sf-copy="…">` inside
  it: the button stands at the inline end above the overlay, the card keeps
  its height.
- **Long name** — the card's link shows two lines, then an ellipsis.
