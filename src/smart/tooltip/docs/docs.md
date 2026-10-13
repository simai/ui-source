# Smart Tooltip

The default template applies `root-class`, author `style` and `root-style`
to its visible root. Use Framework semantic tokens for geometry. These settings
do not belong to the boxless host and must not reset existing component state.

Smart/runtime wrapper for the base `tooltip` component.

## Behavior boundary

This component renders the Tooltip surface and can be the target of the
ordinary Framework `data-tooltip` controller. In that opt-in composition the
native trigger owns focus, while Framework owns hover/focus visibility,
`aria-describedby` and Escape dismissal. The surface never receives focus.
Do not put actions inside a tooltip; use an appropriate dialog or popover.

Without the `.sf-tooltip-anchor` and `data-tooltip` composition,
`<sf-tooltip>` remains a presentational surface. This preserves Range Slider
and other consumers that own their own visibility and positioning.

Long text wraps within the containing block without ellipsis or clipping.
Sizes remain the existing compact typography scale. Tail placement is logical
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
- `tail`

Example:

```html
<sf-tooltip arrow="bottom-center" size="1">
  <span slot="text">Custom title</span>
  <span slot="supporting-text">Custom description</span>
</sf-tooltip>
```

Linked example:

```html
<span class="sf-tooltip-anchor">
  <button type="button" data-tooltip="help-tip">Справка</button>
  <sf-tooltip id="help-tip" text="Короткое пояснение"
    type="dark" arrow="bottom-center" hidden></sf-tooltip>
</span>
```

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/tooltip/<template>/index.js`
- `/local/smart/templates/tooltip/<template>/index.css`
