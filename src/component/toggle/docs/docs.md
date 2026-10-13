# Toggle

**Superseded by Switch.** The two components drew the same control: a native
checkbox with `role="switch"`, a track and a moving thumb. They differed only in
the wrapping — Switch carried a description, Toggle did not — and in geometry
that had drifted apart, down to size names on different rungs of the ladder.
Switch now carries both presentations and both of Toggle's variants, so Toggle
is kept for the markup already written and will be removed in the next major.

Moving a Toggle to a Switch:

| Toggle | Switch |
| :--- | :--- |
| `sf-toggle` | `sf-switch` |
| `sf-toggle--size-1` | `sf-switch--size-1` |
| `sf-toggle--size-2` | `sf-switch--size-2` |
| `sf-toggle--simple` | no class: that is the plain Switch |
| `sf-toggle--icon` | `sf-switch--icon` |
| `sf-toggle--short` | `sf-switch--short` |
| `sf-toggle-control` | `sf-switch-toggler` |
| `sf-toggle-container` + `sf-toggle-inner-wrap` | dropped: the thumb sits in the track |
| `sf-toggle-inner` | `sf-switch-inner` |
| `sf-toggle-text` | `sf-switch-text`, inside the container wrap |

The sizes are not a straight swap in pixels. Toggle's own two sizes sat between
the ladder's rungs: its `size-1` drew a track of 40×20 and its `size-2` one of
56×32. On the ladder those become 48×24 and 56×28 in the desktop mode.

Its native checkbox carries `role="switch"` and remains the single owner of
checked, disabled, submitted and reset state.

## Public variations

- `simple` shows a plain moving thumb.
- `icon` places a decorative icon inside the moving thumb; the visible label or
  another accessible naming mechanism must still name the setting.
- `short` uses the shortest track for space-constrained interfaces.
- Sizes `1` and `2` scale control geometry and typography with Framework tokens.

Use Switch when a setting needs a description or a fuller settings-row
presentation. Use Checkbox for deferred form choices and Radio for one choice
from a group.

The whole enabled label is clickable. Pointer interaction is visually quiet;
keyboard focus uses `:focus-visible`. Long labels wrap, track movement follows
logical direction, and forced-colors preserves the difference between track and
thumb. Customization uses semantic color, typography and spacing tokens rather
than raw values.
