# Smart Tabs

`sf-tabs` presents one locally available panel at a time. The default template
supports text buttons and `variant="icons"`; icon tabs use each item's label as
their accessible name. Text slots remain the accessible label of text tabs.
Give each tablist an `aria-label`, or reference a visible heading through
`aria-labelledby`.

The historical `scheme` attribute selects built-in button appearance:
`default`, `outline` or `link`, with the primary semantic color pair. It is not
a selector for arbitrary semantic colors. `type` separately selects the Tabs
skin (`underline`, `pills`, `full`, `vertical`, or the default). Existing attribute
values and custom-template forwarding are preserved.

A nested `sf-tabs` in a panel slot keeps its own skin; parent skin selectors do
not reach into the nested header. Horizontal lists scroll locally instead of
squeezing labels into individual characters or widening the page. Default
controls can wrap a label wider than the list. Prefer concise labels.

The built-in text/icon templates have one enabled native tab stop, unique stable
tab/panel IDs and reciprocal `aria-controls` / `aria-labelledby` relationships.
Panels are keyboard-focusable. Horizontal navigation uses Left/Right (mirrored
in RTL); `type="vertical"` uses Up/Down. Home/End select enabled endpoints.
Arrows skip disabled tabs, wrap and move focus while activating the panel.
Perpendicular arrows retain browser behavior. Keyboard events in panel content
and nested Tabs do not navigate an outer Tabs instance.

`active-index`, `goTo()` and the `sf-tab-change` payload remain compatible.
Programmatic selection does not move focus. Rendering style changes preserves
tab identity, IDs and selection. If an author selects a disabled item, its panel
selection is preserved, but the first enabled tab is the tablist entry point;
an entirely disabled list has no tab stop. Prefer an enabled initial selection.
Use the Smart host's `goTo()` method for imperative selection, not the ordinary
`SF.Tabs.activate()` helper. The ordinary runtime skips the built-in Smart root
and restricts its queries/clicks to the nearest ordinary Tabs owner.

`root-class`, author `style` and `root-style` apply to the visible root. Use
Framework semantic tokens and utilities rather than fixed sizes or colors.
The shared Tabs skin uses an inset keyboard focus indicator, a semantic gap
between the vertical list and panel, and the same selected foreground/background
pair for text and icon tabs. This does not constitute acceptance of every skin,
size, overflow strategy or arbitrary custom template.

Inset focus uses the foreground role belonging to its control surface, rather
than the translucent external focus halo. Its width follows
`--sf-focus-outline-width`. `--sf-tabs--focus-color` is an optional local override
for a custom surface; use a semantic role and recheck its contrast. Forced-colors
mode retains an inset system outline. The shared base component owns this skin.

Arbitrary custom tab component descriptors render without requiring the Loader.
The owned wrapper remains the single named tab and keyboard-focus target; its
rendered Smart visual is inert and hidden from the accessibility tree. Use a
descriptor only as presentation, not to place a second interactive control in
the tab. External custom templates still own their semantic markup.

Reference pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
