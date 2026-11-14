# Smart Tooltip

The default template applies `root-class`, author `style` and `root-style`
to its visible root. Use Framework semantic tokens for geometry. These settings
do not belong to the boxless host and must not reset existing component state.

Smart/runtime wrapper for the base `tooltip` component.

## Behavior boundary

This component renders the Tooltip surface and can be the target of the
ordinary Framework `data-tooltip` controller. In that opt-in composition the
native trigger owns focus, while Framework owns hover and keyboard-focus
(`:focus-visible`) visibility, `aria-describedby` and Escape dismissal. A
press on the trigger (a pointer, or Enter or Space) hides the tooltip, and the
focus a mouse press leaves does not show it. The surface never receives focus.
Do not put actions inside a tooltip; use an appropriate dialog or popover.

Without the `.sf-tooltip-anchor` and `data-tooltip` composition,
`<sf-tooltip>` remains a presentational surface. This preserves Range Slider
and other consumers that own their own visibility and positioning.

Linked to a trigger, it follows the tooltip kind of C59 (owner decision
2026-11-11): a pointer resting on the trigger opens it after 0.5 s, its
neighbours open at once while one shows and for 0.3 s after, keyboard focus
opens it at once, and on a touch screen a long press (held 0.5 s) shows it for
as long as the finger is down and 1.5 s after. The timing belongs to the
`data-tooltip` controller (component `tooltip`), not to this element.

No arrow by default (`arrow="none"`); set `arrow` only where a tail is wanted.
The light look has no frame: its elevation is the window's shadow, drawn over
the surface and the tail together. A shortcut is written with `shortcut`
(`mod+s`), never as plain text in `supporting-text`: the kbd component draws
the keys (glyphs on a Mac, words joined by «+» elsewhere).

Long text wraps within the containing block without ellipsis or clipping.
The default is the plain tooltip: `size="1/3"` (the small text step, 12/16
on desktop), regular weight, padding `--sf-space-1/4` by `--sf-space-1/3`
(4 x 8), radius `--sf-radius--ui`, and `appearance="dark"`, the inverse
surface (`--sf-surface-inverse`, light in a dark theme). A rich tooltip -- text
with `supporting-text` -- keeps its first line bold as its title. Tail placement is logical
for RTL. Complex collision, portal and auto-flip policies remain with the
application overlay owner.

Tag:

- `sf-tooltip`

Loading model:

- detected by `tags: ['sf-tooltip']` in `src/smart/tooltip/rule.js`
- loaded as smart bundle `cl-tooltip`
- base styles and base component JS are loaded through relation with `tooltip`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `size`
- `arrow`
- `text`
- `supporting-text`
- `shortcut` -- the trigger's key combination (`mod+b`, `shift+/`), drawn
  after the text as the kbd component's keys, plain and quiet; the trigger
  still says it with `aria-keyshortcuts`

Supported arrow values:

- `none`
- `top-center`
- `bottom-center`
- `inline-start`
- `inline-end`
- `bottom-inline-start`
- `bottom-inline-end`

## Slot overrides

Supported light-DOM slot names:

- `content`
- `text`
- `supporting-text`
- `shortcut`
- `tail`

Example:

```html
<sf-tooltip size="1">
  <span slot="text">Custom title</span>
  <span slot="supporting-text">Custom description</span>
</sf-tooltip>
```

Linked example:

```html
<span class="sf-tooltip-anchor">
  <button type="button" data-tooltip="help-tip">Справка</button>
  <sf-tooltip id="help-tip" text="Короткое пояснение" shortcut="mod+k" hidden></sf-tooltip>
</span>
```

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/tooltip/<template>/index.js`
- `/local/smart/templates/tooltip/<template>/index.css`
