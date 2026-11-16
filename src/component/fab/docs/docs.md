# FAB

`fab` defines a circular native button for the single most prominent contextual
action on a screen. The CSS component owns appearance and token geometry; page
layout owns fixed placement, safe-area offsets and overlap with content.

## Public axes

- emphasis/scheme pairs: `default primary`, `default on-surface`,
  `tonal primary`, and `tonal on-surface` (`secondary` is a former name until
  2027-01-01: tonal draws as primary, default as on-surface);
- size: `1`, `2`, or `3` (icon 24 · 28 · 36 on a desktop, one step down on a
  phone and in a compact region);
- state: rest, hover, press, keyboard focus, and native disabled. A floating
  button is filled or tonal and has no pressed state (C211): the `active`
  class and `aria-pressed` draw nothing and the script warns once per button.
  A toggle is an outline or ghost button in on-surface.

Every kind carries the raised place's shadow, `--sf-shadow-raised` (C216).
Place only the filled kind (`default`) over content: tonal is translucent and
lets the text or picture under it show through, so it belongs inside a card or
a panel.

The tonal on-surface icon is `--sf-on-surface-icon`, as on an icon button
(C107); under a pointer it takes `--sf-on-surface`.

The circle is intrinsic to FAB and is not a generic surface-radius variation.
All colours, icon sizes, padding and focus treatment come from Framework role,
typography, spacing and focus tokens.

Use a native `<button type="button">` with a concise accessible name and an
`aria-hidden="true"` icon. Do not place several competing FABs on one screen;
use ordinary or Icon Buttons for secondary actions.

The legacy `Fab` JavaScript constructor is specifically a scroll-to-top helper:
it positions the button, reveals it after scrolling and returns the page to its
start. Its icon is `arrow_upward` (no turned chevron, which would point down
once directional glyphs mirror in a right-to-left part) and, unless the caller
names it, it is named in the page's language: «Наверх», «Back to top». It preserves caller attributes, defaults to size `1` and safe native
button type, and disables smooth scrolling for reduced-motion users. Direct
`.sf-fab` markup remains a generic action and does not acquire that behaviour.
