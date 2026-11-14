# Lookup Smart Component

`sf-input-lookup` is a form field that picks people or objects from a search the
host answers: the person types, sees rows with a picture, a name and a
caption, and chooses one or several. Chosen items are removable chips; the
list says when it waits for more letters, searches, finds nothing, is
unavailable or failed.

Use sf-dropdown for a short fixed list given whole, sf-search for site
search. Every record, relation, user and paged lookup field of the field
renderers is this component (owner decision C139 (1), field renderers 1.9.0).

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
- An item may carry `caption` and `avatar` (`{src}` or `{initials}`), or
  `icon` (an sf-icon name) where it has no avatar; the chosen item keeps
  them, so a chip never needs a second read.
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
   an older call is dropped. While it runs the rows of the last answer stay;
   only when it takes longer than 1 s (the spinner's delay, owner decisions
   C130 and C138) the line under them says "Searching..." beside a spinner,
   in one word: the spinner's own label is `label-hidden`. A faster answer
   replaces the rows without a flash (1.10.0).
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

Each item: `{value, label, caption?, avatar?: {src} | {initials}, icon?,
match?}`. An avatar address is shown only for `https:`/`http:`, a `/path`, a
`data:image` or a `blob:` address.

The part of a row that matches the query is set in the medium weight (500),
in the caption too (C139 (8)). Options are matched in place, case and
accents folded. A provider's rows are marked only where the host sends the
ranges: `match: {label: [[start, end]], caption: [[start, end]]}` (or a list
of ranges for the label alone), offsets in UTF-16 units of the text sent; a
row without `match` is not marked.

While a new search runs the rows of the last answer stay one step paler
(`sf-lookup-list--stale`, `aria-busy`); after 1 s, the first search too,
"Searching..." and the spinner stand under them. There is no skeleton
(C139 (4)).

### Recent items and the hint (C139 (3))

With `suggest` (or `min-length="0"`) a focus in the empty field asks the
provider with an empty query and shows what it answers -- the host's recent
or frequent items. Without it, a field with a provider shows the
"Type at least 2 characters" hint at once on focus.

### Create (C139 (2))

With `create` a query that matches no row exactly (label or caption, case
and accents folded) offers «Create «...»» as the last row, under a
separator. Choosing it fires `create` with `{text, kind, respond}`; the host
answers with `respond(item)` -- at once or with a promise -- and the field
chooses that item as it does a row (`change` carries `created: true`), or
with `respond({error: message})`, shown as the polite line under the rows.
`create="email"` offers «Add the address ...» only for a whole mail address,
and an address that is already a row's value is no new address. The value
names of `create` are **PROVISIONAL**.

## Attributes and properties

- `label`, `placeholder`, `hint` -- the field's words; `invalid` with
  `error-message` shows the message in place of the hint.
- `name` -- the form name.
- `value` -- the starting value as JSON (`'{"value":7,"label":"Anna"}'`) or a
  bare value read against the options; a form reset puts it back. The
  property holds the value itself, and takes a bare value too: whether the
  options come before or after it, it shows its option's label (1.7.1).
- `multiple` -- several values as chips; the list stays open after a choice.
  Without it a choice is the value and closes the list; the value's avatar
or icon stands before its name in the field (the caption does not), and
leaves while the person types (C139 (5)).
- `chips="wrap|row"` -- **PROVISIONAL name** (the public name waits for the
  owner; it may change before it is final). Multiple only. `wrap` (the
  default) shows every chip, on as many rows as they take: forms. `row`
  keeps one row and a "+N" chip for the rest: filter bars, table cells, card
  headers (owner decision C58). The "+N" names the hidden items in its
  tooltip and accessible name; a press on it, or the focus coming into the
  field (Tab, a press in the frame), opens the field to every chip, and
  leaving the field closes it to one row again. The count follows the
  field's width.
- `max-items` -- multiple only: the most items; a choice past it is refused
  with the line "No more than N".
- `min-length` (2), `max-results` (20), `debounce` (120) -- the search, as
  above. `suggest` -- ask the provider with an empty query on focus (recent
  items). `create` / `create="email"` -- **PROVISIONAL** -- the create row. `maxlength` -- the most characters the search box takes.
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

### Chips

A chip is the field less `--sf-space-1/4` above and below (owner decision
C58, 1.10.0): 32 in a 40 field, 24 in a 32 one (size 1/2, compact size 1),
28 on a phone (36), 40 at size 2, 48 at size 3, 20 at size 1/3 and at size
1/2 on a phone; a row of chips keeps the field's height. Chips and their rows
stand `--sf-space-1/4` apart. An avatar in a chip is the chip less
`--sf-space-1/4` above and below (24 in a 32 chip). The remove cross is a
small step (owner decision C132): 8 at sizes 1/3, 1/2 and 1, 12 at 2 and 3;
its press target is at least 24 by 24 at every size, density and screen,
the chip's height where the chip is taller. A long name ends in an ellipsis,
the chip no wider than 20rem; the whole name is its tooltip.

The search box beside the chips takes no room while it is empty and not
focused, so it never stands on a row of its own at rest; focused it asks
room for the caret, typed into four characters, and only then wraps when
the chips leave less.

## Methods

- `search(query)` -- searches a query at once, as typing does.
- `retry()` -- repeats the last call to the provider.
- `close()` -- closes the list and drops a search still running.
- `form`, `validity`, `checkValidity()`, `reportValidity()`,
  `setCustomValidity(message)` -- the form control's.

## Events

- `input`, then `change` -- the value changed by the person: a choice, a chip
  removed, Backspace in the empty box. `detail` is `{value, item, action}`,
  `action` one of `added`, `removed`, `replaced`; `created: true` when the
  item came from the create row.
- `create` (`sf-input-lookup-create`) -- the create row was chosen:
  `{text, kind: 'item' | 'email', respond}`.

Typing is not a change: the search box's own `input` stays inside. A value
set from code, a form reset and the browser's restore say nothing.

## Keyboard

- Typing searches; ArrowDown opens the list and moves down, ArrowUp moves
  up; Home and End go to the first and last row while the list is open.
- Enter chooses the active row; in a single field it closes the list.
- Escape closes the list; a second Escape clears the query.
- Backspace in the empty search box removes the last chip.
- The field is one Tab stop, however many chips it holds (C139 (6)). In the
  empty search box ArrowLeft takes the last chip, ArrowLeft and ArrowRight
  walk the chips (mirrored right to left) and ArrowRight past the last
  returns to the box; Delete or Backspace removes the active chip, Escape
  leaves it. Each step is said: "Anna, 1 of 3, Delete to remove". The
  chip's remove cross is still pressed with the mouse (LS-9). With
  `chips="row"` the focus coming in opens the field, so the hidden chips are
  reached too.

## Accessibility

The combobox pattern: the search box is `role="combobox"` with
`aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is
`role="listbox"` (`aria-multiselectable` when multiple) and its rows
`role="option"` with `aria-selected`. The state line under the rows -- the
hint, Searching..., Nothing found, the unavailable line, the error and the
max-items refusal -- is `role="status"`, polite; it is a row of the list high
(40 at size 1 on a desktop). Chips are sf-tag with a remove button named
"Remove Anna", out of the Tab order; the active chip is said through a
second polite status. Colours are role tokens, AA in light and dark.

## On a phone (C139 (7))

Below `lg` a press in the field opens a sheet over the whole page --
sf-search's sheet: the back arrow (named "Done") and the search box on top,
the rows under it, the page locked behind. Choosing in a single field, Done
or Escape closes it and gives the focus back to the field; a multiple field
stays open while chips are added.

## The list's geometry

The list is a dropping panel with the context menu's geometry (owner C05-C07,
docs review R029): its rows stand `--sf-space-1/4` from the panel's edge, are
as tall as a control of the lookup's size and rounded `--sf-radius--ui`, and
their avatar or text stands `--sf-space-1/2` inside the highlight. A row with
a caption is the C49 menu row: the menu's one-line row (size 1/2) plus the
caption's line, 48 on a desktop, 44 compact, 60 under a coarse pointer, at
every size of the field (LS-14); a row without one keeps the one-line
height. A row's
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
