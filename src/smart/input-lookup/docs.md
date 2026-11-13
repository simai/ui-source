# Lookup Smart Component

`sf-input-lookup` is a form field that picks people or objects from a search the
host answers: the person types, sees rows with a picture, a name and a
caption, and chooses one or several. Chosen items are removable chips; the
list says when it waits for more letters, searches, finds nothing, is
unavailable or failed.

Use sf-dropdown for a short fixed list without search, sf-search for site
search.

```html
<sf-input-lookup label="Members" name="members" multiple max-items="49"></sf-input-lookup>
<script>
  const lookup = document.querySelector('sf-input-lookup');
  lookup.provider = async (query, {cursor, limit, signal}) => {
    const response = await fetch(`/api/people?q=${encodeURIComponent(query)}&cursor=${cursor ?? ''}&limit=${limit}`, {signal});
    return response.json(); // {items, nextCursor} or {status: 'unavailable'}
  };
</script>
```

## The value

- Single: `{value, label}` or `null`.
- Multiple: a list of `{value, label}` in the order chosen; `[]` when nothing
  is chosen.
- An item may carry `caption` and `avatar` (`{src}` or `{initials}`); the
  chosen item keeps them, so a chip never needs a second read.
- The form gets the values alone: one entry, or one entry per value when
  multiple. Labels are never sent.

This is the value of the property view's lookup field
(`src/smart/field-renderers`, `renderLookupEdit`), so the two read alike.

## The search

The host answers; the component never fetches. `provider` is a property, a
function, usually async:

```js
lookup.provider = async (query, {cursor, limit, signal}) => ({items, nextCursor});
```

1. Below `min-length` (2) the list shows "Type at least 2 characters" and
   nothing is asked.
2. After `debounce` (120 ms) the provider is called with
   `{cursor: null, limit, signal}`; `limit` is `max-results` (20). The
   previous call is aborted through `signal`, and an answer that arrives for
   an older call is dropped.
3. `{items, nextCursor}` shows the rows, or "Nothing found";
   `{status: 'unavailable'}` shows "Search is unavailable" and no reason; a
   thrown error or a rejected promise shows the error line and Retry, which
   repeats the last call.
4. `nextCursor` shows "Show more", which calls the provider with that cursor.
   Without it there is no Show more, however many items came.
5. `notice` in the answer is a line of the host's own under the rows, read
   out with them: `{items, notice: 'First 20 shown, narrow your search'}`.

`exclude` takes values out of every answer (the reader, current members);
the component filters them. `options` is a short list given whole: it is
searched in place, at any length, and the provider is not asked.

Each item: `{value, label, caption?, avatar?: {src} | {initials}}`. An
avatar address is shown only for `https:`/`http:`, a `/path`, a `data:image`
or a `blob:` address.

## Attributes and properties

- `label`, `placeholder`, `hint` -- the field's words; `invalid` with
  `error-message` shows the message in place of the hint.
- `name` -- the form name.
- `value` -- the starting value as JSON (`'{"value":7,"label":"Anna"}'`) or a
  bare value read against the options; a form reset puts it back. The
  property holds the value itself, and takes a bare value too: whether the
  options come before or after it, it shows its option's label (1.7.1).
- `multiple` -- several values as chips; the list stays open after a choice.
  Without it a choice is the value and closes the list.
- `max-items` -- multiple only: the most items; a choice past it is refused
  with the line "No more than N".
- `min-length` (2), `max-results` (20), `debounce` (120) -- the search, as
  above. `maxlength` -- the most characters the search box takes.
- `required` -- the form is not sent while nothing is chosen
  (`value-missing`).
- `disabled`, `readonly` -- a disabled field is not focusable and not sent;
  a read-only one shows and sends its value without remove buttons.
- `size="1/3|1/2|1|2|3"` -- the field ladder; the frame is sf-input's of the
  same size (28 / 32 / 40 / 48 / 56 on a desktop, 1.9.0). `appearance="bordered|filled"` -- sf-input's two boxes (filled with its
  bottom line in `--sf-outline`, C52).
- `options`, `exclude`, `provider` -- properties (lists and a function);
  `options` and `exclude` may also come in the `data-sf-settings` island.
  They are not attributes: an `options="[...]"` attribute is not read.

The clear of a single field holding a value is a glyph without a plate (owner
decision C123, 1.8.0): the field layer's `.sf-field-action`, the size of the
field's leading picture (24 / 20 / 28 at 1, 1/2, 2), quiet at rest and the
text's ink under the pointer, its hit area the field's height.

## Methods

- `search(query)` -- searches a query at once, as typing does.
- `retry()` -- repeats the last call to the provider.
- `close()` -- closes the list and drops a search still running.
- `form`, `validity`, `checkValidity()`, `reportValidity()`,
  `setCustomValidity(message)` -- the form control's.

## Events

- `input`, then `change` -- the value changed by the person: a choice, a chip
  removed, Backspace in the empty box. `detail` is `{value, item, action}`,
  `action` one of `added`, `removed`, `replaced`.

Typing is not a change: the search box's own `input` stays inside. A value
set from code, a form reset and the browser's restore say nothing.

## Keyboard

- Typing searches; ArrowDown opens the list and moves down, ArrowUp moves
  up; Home and End go to the first and last row while the list is open.
- Enter chooses the active row; in a single field it closes the list.
- Escape closes the list; a second Escape clears the query.
- Backspace in the empty search box removes the last chip.
- Tab reaches each chip's remove button and leaves the field.

## Accessibility

The combobox pattern: the search box is `role="combobox"` with
`aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is
`role="listbox"` (`aria-multiselectable` when multiple) and its rows
`role="option"` with `aria-selected`. The state line under the rows -- the
hint, Searching..., Nothing found, the unavailable line, the error and the
max-items refusal -- is `role="status"`, polite. Chips are sf-tag with a remove button named
"Remove Anna". Colours are role tokens, AA in light and dark.

## The list's geometry

The list is a dropping panel with the context menu's geometry (owner C05-C07,
docs review R029): its rows stand `--sf-space-1/4` from the panel's edge, are
as tall as a control of the lookup's size and rounded `--sf-radius--ui`, and
their avatar or text stands `--sf-space-1/2` inside the highlight. A row with
a caption is the one-line row plus the caption's line (owner decision C49);
a row without one keeps the one-line height. A row's
avatar is the field's text line, the same step as a chip's avatar. A chosen
row is its fill alone, without a check (owner decision C08). The state
line and the actions under them start on the same line. The scrollbar shows
only when the rows do not fit; while it takes room the panel is marked
`sf-lookup-panel--scrollbar` and gives up its inline-end padding, so the thumb
stands in the inset with `--sf-space-1/4` on either side: the track is the
inset, the page scrollbar's thumb (`--sf-scroll-thumb-width`) and the inset,
14 (owner decision C106).

## Public CSS variables

`--sf-lookup-background-color`, `--sf-lookup-border-color`,
`--sf-lookup-color`, `--sf-lookup-radius`, `--sf-lookup-padding-inline`,
`--sf-lookup-padding-block`, `--sf-lookup-invalid-border-color` --
sf-input's set under this component's name -- and
`--sf-lookup-list-background-color` for the open list.
