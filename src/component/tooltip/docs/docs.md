# Tooltip

Tooltip is a short, non-interactive description of an existing native control.
The surface classes own content, skin, size and tail. The optional
`.sf-tooltip-anchor` composition and a short `data-tooltip` reference own
hover/focus visibility, `aria-describedby` and Escape dismissal.

Do not put links, buttons or form fields inside a tooltip. Use a dialog or
popover when the revealed surface needs interaction. Important instructions
must remain visible outside the tooltip.

## Interactive composition

```html
<span class="sf-tooltip-anchor">
  <button class="sf-icon-button" type="button" data-tooltip="save-description"
    aria-label="Сохранить">
    <i class="sf-icon" aria-hidden="true">save</i>
  </button>
  <span id="save-description" class="sf-tooltip sf-tooltip--dark
    sf-tooltip--size-1/3 sf-tooltip--arrow-bottom-center" hidden>
    <span class="sf-tooltip-content">
      <span class="sf-tooltip-text">Сохранить изменения</span>
      <span class="sf-tooltip-tail" aria-hidden="true"></span>
    </span>
  </span>
</span>
```

The trigger remains the action owner. Tooltip does not use `aria-expanded` or
`aria-haspopup`, never receives focus and remains open while the pointer is
over the anchor or surface. It opens on hover and on keyboard focus
(`:focus-visible`) only: the focus a mouse press leaves does not open it, and
a press on the trigger -- a pointer, or Enter or Space -- hides it until the
pointer leaves and the focus goes.

## Surface variants

- skins: `dark`, the inverse surface (`--sf-surface-inverse`, light in a dark
  theme), and `light`, a raised surface;
- the plain tooltip -- a bare `.sf-tooltip` or `sf-tooltip--size-1/3` -- is
  regular text at the small step (12/16 on desktop), padding `--sf-space-1/4`
  by `--sf-space-1/3` (4 x 8), radius `--sf-radius--ui`; a text followed by a
  supporting text keeps the text bold as its title;
- a shortcut after the words: a `<kbd class="sf-kbd--group
  sf-tooltip-shortcut">` with a `<kbd>` per key inside `.sf-tooltip-text`,
  drawn plain and quiet by the kbd component;
- sizes: `1/3`, `1/2`, `1`, `2`, `3`;
- logical tails: `none`, `top-center`, `bottom-center`,
  `inline-start`, `inline-end`, `bottom-inline-start`,
  `bottom-inline-end`.

The tail class also determines placement inside an anchor. Complex collision,
portal and auto-flip policies remain owned by the application overlay layer.
