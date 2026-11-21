# Tooltip

Tooltip is a short, non-interactive description of an existing native control.
The surface classes own content, skin, size and tail. The optional
`.sf-tooltip-anchor` composition and a short `data-tooltip` reference own
hover/focus visibility, `aria-describedby` and Escape dismissal.

A tooltip whose words the trigger's accessible name already says -- equal to
it, or whole words of it, such as «Повторить» on an icon button named
«Повторить Отчёт.xlsx» -- is shown but not linked by `aria-describedby`, so a
screen reader does not say it twice (component.tooltip 1.6.1). A tooltip that
says more than the name stays the description.

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
    sf-tooltip--size-1/3" hidden>
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

A trigger whose menu, list or panel is open (its own `aria-expanded="true"`,
as a «⋯» button that opened its menu) shows no tooltip, and one that is
showing goes when the trigger opens what it controls: the tooltip stood over
the open menu and covered its first item (component.tooltip 1.8.1).

Timing (the tooltip kind of C59, owner decision 2026-11-11):

- a pointer resting on the trigger opens the tooltip after 0.5 s, so a pointer
  crossing a toolbar does not open one on every button;
- once a tooltip shows, its neighbours open at once: while one is open and for
  0.3 s after the last one closed;
- keyboard focus opens it at once;
- on a touch screen nothing hovers: a long press (held 0.5 s) shows the
  tooltip, it stays while the finger is down and 1.5 s after; the release of a
  long press is not a press of the trigger (its click is not sent), and the
  browser's own long-press menu does not open over it; a short tap is an
  ordinary press.

No tail by default: write a `sf-tooltip--arrow-*` class only where a tail is
wanted. A tooltip has no frame: its elevation is the window's shadow, drawn
over the content and the tail together (`--sf-shadow-overlay-filter`), so a
tail carries the same shadow as the window -- the dark tooltip as well as the
light one since 1.6.0 (C20, C59). With a tail the tooltip stands so far from
its control that the tail's point keeps 4 px (`--sf-space-1/4`) from it
(`--sf-tooltip--tail-gap`, 1.6.0): it stood at the half side, and the point
reached 2 px into the control.

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
- one size (owner decision C160 (3), 1.4.0): text 12/16 (`--sf-text--size-1/3`),
  padding 4 x 8; the former `sf-tooltip--size-*` classes draw nothing of their
  own and are kept in markup harmlessly;
- at most two lines (C160 (2)), the whole tooltip's: a text alone or a
  supporting text alone is cut after its second line, a text with a supporting
  text under it after one line each (1.6.0; the supporting text was not
  counted), and a linked tooltip says so once per page in the console -- an
  explanation that long belongs in a «?» (sf-help-mark) beside the control;
- placement (C160 (4)): a linked tooltip with no tail stands below its control
  (4 px away) and flips above at the bottom edge of the window;
- logical tails: `none`, `top-center`, `bottom-center`,
  `inline-start`, `inline-end`, `bottom-inline-start`,
  `bottom-inline-end`.

The tail class also determines placement inside an anchor. Complex collision,
portal and auto-flip policies remain owned by the application overlay layer.
