# sf-toast

Smart Toast is a short reply to an action (owner decision C114 (1)), through a
custom element; a page raises it with `SF.notify`, which keeps one
notification area per page. It owns rendering, optional lifetime and removal of its host; the
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
| action: size 1, `height="low"`, tonal surface (`tonal on-surface`); label = text | 32 · 16 | 28 · 14 |
| close: size 1, `height="low"`, centred on the first line | 32 | 28 |
| one-line toast, without the border | 56 | 44 |

The first line stands in the box of the low control, so the icon, the first
line of text and the close share one centre; the action's plate starts at the
text edge; the close's plate hangs out over the inline padding, so its cross
stands where the status icon stands on the other side. Without an icon the text
starts at the padding. Between several actions of a class toast,
`--sf-space-1/3`.

`duration` is milliseconds. Its default `0` keeps the toast until explicit
dismissal; a positive value pauses while pointer or focus is inside the toast.
Keep messages with essential content or actions persistent. An error or a
warning ignores `duration` and stays until a person closes it (1.3.0, owner
decision C114 (6)).

With one action the toast puts it in the row with the text from 20rem of its
own width, centred on the text block (owner decision C115, layout L3a); a
narrower toast keeps it under the text from its start, with the space under
it equal to the space above the capitals of the first line (C114 (5)).

The status icon is an `sf-icon` (1.2.1), as on `sf-alert`: the toast asks the
Loader for its glyph when it draws, so the glyph comes wherever the toast
stands, a region the Loader does not observe (`data-sf-observer="ignore"`)
included. Size, colour and position are those of 1.2.0.

The default template transfers shared `root-class`, `style` and `root-style`
settings to the visual root. Methods: `close()`, `dismiss()`,
`setState(nextState)`, `onAction(handler)` and `onClose(handler)`. Events:
`sf-toast-action` and `sf-toast-close`.
