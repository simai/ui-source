# Smart Dropdown

Smart/runtime wrapper for base `dropdown`.

Tag:

- `sf-dropdown`

Loading model:

- detected by `tags: ['sf-dropdown']` in `src/smart/dropdown/rule.js`
- loaded as smart bundle `cl-dropdown`
- base styles and behavior are loaded through relations with:
  - `dropdown`
  - `inputs`
  - `icon-buttons`

Current scope:

- child-based options via direct `sf-list-item`
- modes:
  - `select`
  - `tag`
- single and multiple selection

Visible option text is separate from its machine `value`. Search matches the
visible label; zero or one match does not disable the control. With `name`, only
the selected machine value(s) are submitted, not presentation/search inputs.
Multiple values retain the existing comma-separated format.

Multiple text mode displays all selected labels, separated by commas. Selected
tags and the accessible summary follow the submitted value order. Avatar options
use their visible avatarTitle (with text/value fallback), including selected tags
and event labels. Text/checkbox options do not invent a decorative tag icon.
Decorative option glyphs are hidden from assistive technology. This presentation
normalization does not reorder the existing serialized values or change events.

All three size profiles (1/2, 1, 2) use semantic control heights as minima. Form fields have three sizes; a retired `1/3` or `3` renders as `1/2` or `2` with a console warning.
Tag fields grow with wrapped selections, including unbroken long labels. The
toggle has its own place in the row and does not cover the tags; tag-removal
buttons do not shrink with their label. Option labels also wrap inside the
listbox. The same base CSS provides these rules to Smart Dropdown.

While its list is open the dropdown says so on the root
(`document.documentElement.dataset.sfPopoverOpen`, the shared mark sf-popover
raises), so a drawer, a modal or a record panel leaves that Escape alone: they
listen on the document in capture, and without the mark one press closed the
list and the window behind it together. A `multiple` dropdown draws a box
beside every option that has no picture of its own, because a class and
`aria-selected` tell a sighted person nothing about what they have picked.

The actual toggle button is the primary Tab stop. It controls a named listbox;
the optional searchbox is separate from its options. ArrowDown opens search
(or the first available option); ArrowUp opens the last available option.
Arrow keys and Home/End move option focus without changing selection. Enter or
Space selects; Escape closes without changing selection and restores the
button. Tab closes and continues native page traversal. Home/End in search
remain native editing keys. Independent tag-removal buttons remain reachable.

The shared base/Smart interaction adapter derives missing accessible names
from the visible label, preserves explicit author names/references, and
describes selected values to the toggle. Joined-field and option focus is
keyboard-visible, with an inset ring and a forced-colors outline. Global base
outside-click handling asks Smart to close through its own state method;
it does not edit Smart-rendered DOM.

An explicit empty `value`, including `element.value = {value: ''}`, clears the
previous selection rather than restoring a cached value. Disabling an open
dropdown closes it and preserves selection; disabled user selection/removal
is ignored. Re-enabling restores interaction. This does not prevent an author
from setting a new value attribute programmatically.

Native form reset restores the selection captured at the first connection,
including initial `value` or selected child options. Current reflected `value`
does not replace that default. Labels, tags, selected/ARIA state and form payload
are synchronized without input/change events. Cancelled reset is ignored;
disabled and unnamed controls still reset. The reset subscription follows the
native form owner, is released on disconnect and restored on reconnect. No new
reset attribute or separate public value format is introduced.

Checkbox options (`sf-list-item type="checkbox"`) use the checkbox as a
decorative selection indicator, not an independently focusable/form control.
Set the initial selection with dropdown `value` or option `selected`, not a
separate `checked` state. The shared interaction adapter synchronizes native
checked state and its glyph silently through Checkbox's state API. Clicking
the graphic selects the option once; reset does not synthesize child events.
A disabled option does not change the enabled field's appearance. Popup search
hover does not style the field. Repeated synchronization does not rewrite
unchanged glyph/ARIA DOM, avoiding subtree-observer feedback.

The template consumes the standard rootClass/rootStyle context. Component
classes and CSS-variable settings can be supplied through root-class and
root-style; root-style overrides the captured full style attribute. Dynamic
updates can replace the full root-style string, use setRootStyle(), or edit
individual author declarations with style.setProperty()/removeProperty().
The base class keeps a stable author CSSStyleDeclaration separate from the
boxless host; sequential CSSOM changes no longer erase earlier declarations.
Field/tags/compact buttons use the UI radius role; the popup panel uses the
surface default radius. Existing individual corner and border-side variables
remain explicit overrides. Dropdown field defaults use var() fallbacks so an
inherited --sf-dropdown--radius is not shadowed by a child default declaration.

Positioning uses the shared `SF.Position` contract (Floating UI) and is on by
default; `portal="false"` keeps the in-flow list. With Popover API support,
portal panels use the native manual top layer. DOM
ancestry, inherited theme/tokens and Lit-owned nodes remain intact. Without that
API, the same panel is projected into a temporary context containing its
Framework modifiers, resolved SF variables and inherited typography/direction.
The source panel reference remains stable across Lit renders; option and outside
click handlers recognize this owned projection without accepting unrelated nodes.
Ancestor class/style/direction changes refresh the context while it is open.
The fallback context is appended to the closest native modal dialog or
aria-modal dialog boundary, otherwise to body. This keeps it outside clipped
content without placing it behind the modal overlay or in the inert page.
Shared placement measures semantic spacing and clamps to the visual viewport.
Closing restores original DOM position and owned styles/priorities, removes the
temporary context and releases observers. The fallback uses the existing z-index
token scale instead of a hardcoded9999. A hidden/inert ancestor or hidden field
visibility dismisses the panel through its owner, keeping rendered and public
open state consistent. Restoring the ancestor does not reopen the list or emit
a selection event. Historical-engine compatibility remains separate from
feature-disabled Chromium runtime tests.

The portal parameter can change while the list is open. Projection changes
preserve the same search input and its focus; disabling projection restores the
normal DOM position. Base Dropdown watches both portal and data-portal and binds
projected-list pointer handlers only while they are needed. Each selection still
emits one change event, including after repeated mode switches.

## The change event

A selection emits `change` on the host — bubbling and composed, the name to
bind. The former name `sf-dropdown:change` still arrives with the same detail.

The detail answers what was chosen and what is selected now:

```js
field.addEventListener('change', (event) => {
  const {value, label, values, multiple} = event.detail;
  save(multiple ? values : value);
});
```

- `value` — the machine value of the item chosen or cleared, `''` when none;
- `label` — its visible text;
- `values` — every selected value after the change, in submitted order;
- `multiple` — whether several values can be selected;
- `item` — the chosen option's **data**, or `null` when a value was cleared:
  the object the dropdown read from the `sf-list-item` or from the items data
  (`text`, `value`, `type`, `size`, `icon`, `disabled`, `group` and the other
  option fields). It is not the `sf-list-item` element, and its `selected` and
  `checked` are what the option was declared with, not the selection now —
  read `values` for that;
- `root` — the emitting `sf-dropdown`, the live element.

`root` is a **live element, not data**: the detail is not JSON, and
`JSON.stringify(event.detail)` throws on its circular structure. Take the
fields you need — `{value, label, values}` are strings and strings, `item` is
plain data — and log or send those. The same holds for every Smart change detail that names its
emitter: `sf-button-group` sends `component`.

Main attributes:

- `template`
- `size`
- `type`
- `mode`
- `multiple`
- `label`
- `required`
- `placeholder`
- `search`
- `disabled`
- `aria-label`

Children:

- direct `sf-list-item` children are captured as dropdown options

Example:

```html
<sf-dropdown
  size="1/2"
  appearance="outlined"
  mode="select"
  label="Label"
  placeholder="Placeholder"
>
  <sf-list-item kind="text" size="1/2" text="Value 1"></sf-list-item>
  <sf-list-item kind="text" size="1/2" text="Value 2"></sf-list-item>
  <sf-list-item kind="text" size="1/2" text="Value 3" selected></sf-list-item>
</sf-dropdown>
```
