# Rich Text Smart Component

`sf-input-rich` is a form field for formatted text: paragraphs, headings 2 to
4, bold, italic, links, bulleted and numbered lists and quotes, with a
toolbar, undo and redo. Its value is HTML of that subset and nothing else.
Larena stores page text as a property of type `html@1`, and this is its
editor.

Use sf-textarea for plain text, sf-input for one line and sf-code-input for
codes.

```html
<sf-input-rich label="Page text" name="body"
  value="<h2>About us</h2><p>We make <strong>tools</strong>.</p>"></sf-input-rich>
```

## The value

The value is a string of HTML limited to

`p h2 h3 h4 strong em a[href] ul ol li blockquote br`

- No attribute is kept but `href` on `<a>`. An `href` is kept for `https:`,
  `mailto:` and `tel:` addresses and for a path on the site (`/docs/a`); the
  scheme is judged with control characters and white space removed, so
  `java\tscript:` does not pass, and `//host` and `/\host` leave the site and
  are not kept. A link whose `href` is not kept becomes its text.
- Any other element is unwrapped: its text stays. `script`, `style` and the
  other containers whose content is not text for a reader (a document's
  head, `template`, `iframe`, `svg`, `math`, form controls' data, media) go
  with their content. An element that stands as a block (`div`, `section`,
  `h1`, a table cell, `pre`) still separates its text from its neighbours.
- `b` and `i` are `strong` and `em`; a span whose style is bold or italic is
  too, and a `b` whose style says `font-weight: normal` is not -- the forms a
  word processor's paste arrives in.
- Text outside a block is wrapped in `p`; a block inside a paragraph splits
  it; a block inside a list item becomes a line of it (`br`); a list holds
  only items, and adjacent lists of one kind are one list. Lists may nest.
- No empty block, no `br` at a block's edge, no white space between blocks,
  marks nested `a > strong > em`. A field with no text has the value `""`,
  never `<p></p>`.

The value is never trusted: what the page gives (the attribute or the
property), every paste and drop, and the editing surface after every edit go
through the same cleaner (`js/rich-text-html.mjs`, which re-exports the core
runtime's `composition/html-subset.mjs`; the Composition renderer cleans a
`content.html` block with it too). The server must clean what it receives
again with the same subset: a request can be written by anyone.

## Attributes

- `label` -- the visible name; it names the editing surface. Without it the
  host's `aria-label` does.
- `name` -- the form name the value is sent under.
- `value` -- the starting value, and what a form reset puts back.
- `placeholder` -- shown while there is no text (`aria-placeholder`).
- `hint` -- the line under the field; `invalid` with `error-message` shows
  the message in its place.
- `required` -- the form is not sent while the value is `""`
  (`value-missing`); after a failed form check the field shows the required
  error as sf-input-textarea does (red frame, «Заполните поле» under it),
  gone once there is text.
- `disabled`, `readonly` -- as on sf-textarea: a disabled field is not
  focusable and not sent; a read-only one is read and selected in the
  read-only frame with no toolbar (C141 (5)), its value sent. A record card
  shows a read-only value as text on the page, without a frame
  (module.smart-field-renderers).
- `maxlength`, `counter` -- the limit of the text a person reads (markup not
  counted), with sf-input-textarea's rule (C141 (1)): the count «131 / 160» at
  the end of the message line from 80 % of the limit (always with `counter`);
  past it the count and the frame are the error colour and the field is
  invalid (`too-long`), so the form is not sent. The text is never cut.
- `size="1/3|1/2|1|2|3"` -- the field ladder, as sf-input's; the frame,
  padding and text are sf-input-textarea's of the same size and the text
  starts where the textarea's does (C77: 12 / 16 / 20 from the outer edge,
  12 in a compact region and on a phone), the toolbar's buttons a rung below
  (1/3 at 1/3)
  (ghost on-surface icon buttons; the block levels P, H2, H3, H4 in the same
  square). Headings in the text stand one level below the page's (C141 (7)):
  h2 is the page's h3, h3 its h4, h4 its h5, all bold, and never below the
  field's climb from its text (h4 the text, h3 a rung above, h2 two), so no
  heading is smaller than the text. On a touch phone the text and the
  headings are at least 16px, on at least the size-1 line, so iOS does not
  zoom in. The link editor is size 1/2 at every field size (C141 (6)): the
  address field and «Применить», then «Убрать ссылку» for an existing link,
  in one row from the start edge, `--sf-space-1/3` apart (C105 H5), the
  dropping panel's inset.
- The toolbar stays at the top of the visible part of the field while the
  page scrolls a long text (C141 (3)). Its groups stand in the order of
  importance (`data-sf-priority`: text levels, bold, italic, link first); the
  «More» control for what does not fit is still to come (R233), so a narrow
  field wraps the row. Icon buttons of one group stand `--sf-space-1/4` apart,
  with the same step on each side of a group's separator line (C105 H5, C144).
- `appearance="bordered|filled"` -- sf-textarea's two boxes (filled with its
  bottom line in `--sf-outline`, C52).
- `rows` -- the fewest lines shown (6); the field grows with its text.
  `max-rows` -- the most before the text scrolls inside.

## Properties and methods

- `value` -- the cleaned HTML now; setting it cleans what it is given and
  says nothing (no `input`, no `change`).
- `runCommand(command)` -- `paragraph`, `heading-2`, `heading-3`,
  `heading-4`, `bold`, `italic`, `link`, `bulleted-list`, `numbered-list`,
  `quote`, `undo`, `redo` on the current selection, as the toolbar does.
- `undo()`, `redo()` -- one step of the field's own history.
- `form`, `validity`, `checkValidity()`, `reportValidity()`,
  `setCustomValidity(message)` -- the form control's.

## Events

- `input` -- the text changed: typing, a paste or drop, a command, undo or
  redo; once per change, after cleaning, from the editing surface.
- `change` -- the person left the field with a changed value.

A value set from code, a form reset and the browser's restore of a form say
nothing.

## Keyboard

- Tab reaches the toolbar (one stop) and then the text; Tab in the text
  leaves the field and never inserts a tab.
- In the toolbar, ArrowLeft and ArrowRight move between the buttons, Home
  and End go to the first and the last; Enter or Space presses one.
- Ctrl+B / Cmd+B bold, Ctrl+I / Cmd+I italic, Ctrl+K / Cmd+K the link
  editor, Ctrl+Z / Cmd+Z undo, Ctrl+Shift+Z / Cmd+Shift+Z and Ctrl+Y redo.
- Bold and Italic say the marks of the text, not how it looks: a heading is
  bold by its type, so Bold is pressed in it only on a bold mark. At a caret
  the mark goes to the text typed next, composed with an IME, or pasted
  as plain text (pasted rich text keeps its own marks); a cancelled
  composition keeps it.
- In the link editor Enter applies and Escape closes; the caret goes back to
  the text. The link editor is a popup form of the form's width; on a phone
  it is a sheet at the bottom of the screen. Its field and buttons are the
  toolbar's size, and while it is open only the link tool looks active.

## Accessibility

The editing surface is `role="textbox"` with `aria-multiline="true"`, named
by the label, described by the hint or the error, with `aria-required`,
`aria-readonly`, `aria-disabled` and `aria-invalid`. The toolbar is
`role="toolbar"`, named in the page language and controlling the surface;
its buttons say `aria-pressed` where they toggle and `aria-keyshortcuts`
where they have one; a button that cannot act now (undo with nothing to
undo, a heading inside a list) is `aria-disabled` and stays reachable.
Colours are role tokens, in light and dark.

## Public CSS variables

`--sf-rich-text-background-color`, `--sf-rich-text-border-color`,
`--sf-rich-text-color`, `--sf-rich-text-radius`,
`--sf-rich-text-padding-inline`, `--sf-rich-text-padding-block`,
`--sf-rich-text-invalid-border-color` -- sf-textarea's set under this
component's name. `--sf-rich-text-sticky-top` -- how far below the top of
the view the toolbar sticks (a page with a fixed header); 0 by default.
