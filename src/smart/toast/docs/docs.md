# sf-toast

Smart Toast projects the ordinary transient-feedback contract through a custom
element. It owns rendering, optional lifetime and removal of its host; the
application still owns stack placement and business effects.

```html
<sf-toast
  type="success"
  icon="check_circle"
  title="Saved"
  supporting-text="Your changes are available."
  role="status"
  action-text="Undo"
  action="undo"
  close-label="Close message"
></sf-toast>
```

Layout (1.2.0, owner decision C35, remarks R066 and R079), all in tokens, so a
compact region (`data-sf-density="compact"`) moves it by itself:

| | desktop | compact, phone |
|---|---|---|
| inline padding, both sides (`--sf-space-1`) | 16 | 12 |
| block padding (`--sf-space-1/2`) | 12 | 8 |
| status icon (the line's size) | 24 | 20 |
| icon to text (`--sf-space-1/2`) | 12 | 8 |
| title to text | 0 | 0 |
| text to the action (`--sf-space-1/2`) | 12 | 8 |
| action: size 1, `height="low"`, tonal primary; label = text | 32 · 16 | 28 · 14 |
| close: size 1, `height="low"`, centred on the first line | 32 | 28 |
| one-line toast, without the border | 56 | 44 |

The first line stands in the box of the low control, so the icon, the first
line of text and the close share one centre; the action's plate starts at the
text edge; the close's plate hangs out over the inline padding, so its cross
stands where the status icon stands on the other side. Without an icon the text
starts at the padding. Between several actions of a class toast,
`--sf-space-1/3`. The action's plate is the toast's own tone a step stronger
(`--sf-<tone>-container-strong`; neutral `--sf-surface-container-strong`; DEV
look note on C35): the primary container is translucent and over a toast of
the same hue merged with it. `--sf-button-background-color` still wins.

`duration` is milliseconds. Its default `0` keeps the toast until explicit
dismissal; a positive value pauses while pointer or focus is inside the toast.
Keep messages with essential content or actions persistent.

The default template transfers shared `root-class`, `style` and `root-style`
settings to the visual root. Methods: `close()`, `dismiss()`,
`setState(nextState)`, `onAction(handler)` and `onClose(handler)`. Events:
`sf-toast-action` and `sf-toast-close`.
