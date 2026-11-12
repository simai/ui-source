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
`--sf-space-1/3`.

Actions (1.3.0, owner decision C50; the model of `SF.Toast.create`). One light
navigation action («Открыть», «Посмотреть», «Подробнее») is a link at the end
of the text: `action-text` with `action-href`, and no secondary action.

```html
<sf-toast heading="Отчёт готов" supporting-text="Выгрузка за ноябрь собрана."
  action-text="Открыть" action-href="/reports/11" action="open"></sf-toast>
```

The link is `a.sf-toast-link` in the text's own ink, medium weight,
underlined, with the Framework focus ring; it is followed as a link and its
press is `sf-toast-action` with its `action`. `action-href="#"` does not jump:
the page answers the event. A no-break space keeps the link with the last word
of the text (1.3.1), so it never stands alone on a line. Undo, retry, extend and two actions are buttons
under the text (C35, C46): `action-text` alone is one button;
`secondary-action-text` and `secondary-action` add a second, and then both are
buttons and `action-href` does not apply. A toast never shows a link and
buttons together.

```html
<sf-toast heading="Письмо удалено" action-text="Отменить" action="undo"
  secondary-action-text="Корзина" secondary-action="trash"></sf-toast>
```

`duration` is milliseconds. Its default `0` keeps the toast until explicit
dismissal; a positive value pauses while pointer or focus is inside the toast.
Keep messages with essential content or actions persistent.

The status icon is an `sf-icon` (1.2.1), as on `sf-alert`: the toast asks the
Loader for its glyph when it draws, so the glyph comes wherever the toast
stands, a region the Loader does not observe (`data-sf-observer="ignore"`)
included. Size, colour and position are those of 1.2.0.

The default template transfers shared `root-class`, `style` and `root-style`
settings to the visual root. Methods: `close()`, `dismiss()`,
`setState(nextState)`, `onAction(handler)` and `onClose(handler)`. Events:
`sf-toast-action` and `sf-toast-close`.
