# FAB

`fab` defines a circular native button for the single most prominent contextual
action on a screen. The CSS component owns appearance and token geometry; page
layout owns fixed placement, safe-area offsets and overlap with content.

## Public axes

- emphasis/scheme pairs: `default primary`, `default on-surface`,
  `tonal secondary`, and `tonal on-surface`;
- size: `1`, `2`, or `3`;
- state: rest, hover, active, keyboard focus, and native disabled.

The circle is intrinsic to FAB and is not a generic surface-radius variation.
All colours, icon sizes, padding and focus treatment come from Framework role,
typography, spacing and focus tokens.

Use a native `<button type="button">` with a concise accessible name and an
`aria-hidden="true"` icon. Do not place several competing FABs on one screen;
use ordinary or Icon Buttons for secondary actions.

The legacy `Fab` JavaScript constructor is specifically a scroll-to-top helper:
it positions the button, reveals it after scrolling and returns the page to its
start. It preserves caller attributes, defaults to size `1` and safe native
button type, and disables smooth scrolling for reduced-motion users. Direct
`.sf-fab` markup remains a generic action and does not acquire that behaviour.
