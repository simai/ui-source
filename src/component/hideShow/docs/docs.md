# Hide Show

Hide Show is the small behavior-only primitive for revealing and hiding content. The
root is `.sf-hide-show`; controls use the concise `data-action="show|hide|toggle"`
hook and owned content uses `data-content`. Use native buttons for actions and
native `hidden` on content that starts collapsed.

The component owns visibility, relationships and state, not presentation. It
does not add a surface, spacing, typography, motion or a custom hidden class.
Compose those concerns from ordinary Framework components and utilities. This
keeps the primitive usable for disclosures, supplementary details and paired
show/hide actions without imposing Accordion semantics.

On initialization every control receives `aria-controls` for the owned content
and an `aria-expanded` value. The root mirrors the current state as
`data-state="shown|hidden"`; native `hidden` remains the source of rendered
visibility. When a keyboard user activates a show/hide control that then
disappears, focus moves to its visible counterpart without scrolling.

Before a state change the root emits the bubbling, composed and cancellable
`sf-hide-show:change` event. Its detail contains `action`, `hidden` and `shown`.
Cancelling the event keeps the previous state. The registered `HideShow` class
also exposes `show()`, `hide()` and `toggle()` methods.

Nested roots own only their nearest actions and content. Existing and later
inserted roots initialize automatically; detached roots release their listener.
An authored root must contain at least one recognized action and one content
node before it can initialize.

Legacy `.sf-show`, `.sf-hide`, `.sf-hide-show-content`, `.hide-show-block` and
historical root hidden classes remain accepted as bounded compatibility input.
New markup should use the short data hooks and native `hidden`; legacy classes
are normalized during initialization and are not the public state model.
