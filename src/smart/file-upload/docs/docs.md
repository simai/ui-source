# sf-file-upload

Smart file upload component.

The default template applies root-class, author style and root-style to the
existing .sf-file-upload drop zone. The adjacent .sf-file-upload-files list is
not wrapped or given a duplicate copy of those styles. Use a parent composition
for sizing both areas together. Framework spacing and color tokens remain the
customization interface; root-style takes precedence over author style.

Cosmetic renders retain the native input node, focused drop zone and File objects
in items. They do not repeat selection, error or completion events. Calling
afterRender(callback) uses the base callback API without rebinding listeners.
The native input is deliberately cleared after selection to allow choosing the
same file again; retained File objects are available through getItems().
Disconnect/reconnect of the same host retains those objects without replaying
selection events. A clone of the default rendered host starts with its own empty
items and one picker, not a second copy of the old render. DOM cloning is not a
File-state copy API. Smart owns binding after render and cleanup on disconnect;
ordinary automatic discovery does not also bind its internal drop zone.
The component does not upload to a server: transport, progress updates and server
validation belong to the consumer. Native accept is a picker hint, not a security
check. No native form-submission or persistence contract is implied.

The neutral default icon is upload_file. The error glyph is reserved for an
actual failed item rather than the idle picker state.

Dynamic accept/multiple props project to the shared native picker. Every new
non-empty selection replaces the list; empty selection keeps it. Without multiple
only the first dropped file is retained. Text/link drags are ignored. Disabled
file drops are cancelled without accepting files or firing selection events.

The shared ordinary binder also owns keyboard focus and disabled controls. Tab
reaches the enabled drop zone, Enter/Space opens the picker, and nested file-action
keys do not open it. disabled updates native controls and aria-disabled without
discarding items; re-enabling restores prior tab/action settings. Remove buttons
receive file-specific localized names unless the author supplied an ARIA name.
Focus uses :focus-visible with a real outline in forced colors. These rules are
shared, not template-specific overrides.

setItems() accepts progress and state on each item. Both projections retain
explicit progress across ProgressBar loading; reaching 100 does not implicitly
set done. Error/retry/completion events follow item-state transitions and are not
replayed by cosmetic updates. Consumer code still owns actual network progress.

The same base CSS supplies wrapping file rows and semantic radii in every size.
The drop zone follows --sf-radius--surface; generated remove buttons inherit
--sf-radius--ui from icon-buttons. No surface-radius utility is forced onto those
buttons. Long filenames and retry messages can wrap without pushing the page
sideways or splitting progress percentages into individual characters.

Remove actions use the complete base Icon Button icon/link/on-surface variant,
center their glyph and align to the top rather than stretching with file names.
The base control owns their size, hover/disabled paint, radius and focus ring.

Retry uses shared FileUpload text-control CSS: size-specific UI spacing, UI
radius and an inset focus ring. Forced colors keeps an inward outline; focus
does not change the control's dimensions or paint over neighboring file text.

## Attributes

- `size="1/3|1/2|1|2|3"`
- `icon` — the glyph in the drop zone; the neutral default is `upload_file`
- `link-text` — the link words inside the zone ("Выберите файл", "Click to
  upload"); the component's own words when not set
- `text` — the words **after** the link, on the same line ("или перетащите его
  сюда", "or drag and drop"); the component's own words when not set. It is not
  the whole prompt and does not replace `link-text`
- `formats`
- `supporting-text`
- `accept`
- `multiple`
- `disabled`
- `aria-label`

## Methods

- `getItems()`
- `onFileAdd(handler)`
- `onFileError(handler)`
- `onFileComplete(handler)`
- `onFileRemove(handler)`
- `onFileRetry(handler)`
- `onComplete(handler)`
- `setItems(items)`
- `clear()`
- `removeItem(index)`
- `setState({...})`

## The item

One item is a plain object. `getItems()` returns them, `setItems()` takes them,
and every event carries one as `event.detail.item` with its `index` and the
whole `items` array. The component builds items of this shape from a selection
and keeps the `File` object on each.

| Key | Meaning |
|---|---|
| `id` | The item's identity across `setItems()` calls, which is how state transitions become `file-error`, `file-complete` and `complete` events. A selection uses `<name>-<size>-<lastModified>`. Without an `id`, the name and position identify the item. |
| `name` (or `fileName`) | The file name shown. `File` is shown when neither is set. |
| `fileSize` (or `sizeText`) | The size as text, already formatted ("348KB"). The component does not format a number here. |
| `progress` | `0`–`100`: a fraction is kept, a value outside is clamped, and a value that is not a number reads 0. Reaching 100 does not make an item `done`. Without it, a `done` item reads 100 and any other 0. |
| `state` (or `status`) | `process` (the bar), `done` (the check), `error` (the retry button). Missing or anything else reads `process`, for the row and for the events alike. |
| `errorMessage` (or `retryText`) | The label of the retry button on an `error` item. The component's own "Повторить"/"Try again" when not set. |
| `icon` | The glyph on the row; `cloud_upload` when not set. |
| `file` | The `File` itself, for the consumer's own transport. The component never reads it. |

Transport, progress and server validation belong to the consumer: it sets the
item's `progress` and `state` through `setItems()` as its own upload proceeds.

## Binding before the element is upgraded

`onFileAdd()` and the other `on…()` methods exist once the Loader has upgraded
the element; called on a `<sf-file-upload>` that is still an unknown element
they throw (`… is not a function`). Two ways that always work:

```js
// 1. The event, which does not need the method: it bubbles from the host.
upload.addEventListener('sf-file-upload:file-add', (event) => add(event.detail.item));

// 2. Wait for the definition, then use the methods.
await customElements.whenDefined('sf-file-upload');
upload.onFileAdd((event) => add(event.detail.item));
```

Event names: `sf-file-upload:file-add`, `:file-error`, `:file-complete`,
`:remove`, `:retry`, `:complete` — removal and retry are `sf-file-upload:remove`
and `sf-file-upload:retry`, not `:file-remove` / `:file-retry`. Their detail is
`{item, index, items}`: the removed item, or the retried one already back at
`state: 'process'` and `progress: 0`, and the list after the change.

## A browser-only import: select → validate → store → retry

No server: the files go to IndexedDB and the component shows what happened.

```js
const upload = document.querySelector('sf-file-upload');
const items = new Map();                       // id -> item

upload.addEventListener('sf-file-upload:file-add', async (event) => {
  const item = {...event.detail.item};
  items.set(item.id, item);
  await store(item);
});

upload.addEventListener('sf-file-upload:retry', (event) => {
  const item = items.get(event.detail.item.id);
  if (item) store({...item, state: 'process', progress: 0});
});

async function store(item) {
  const next = {...item, state: 'process', progress: 10};
  items.set(item.id, next);
  upload.setItems([...items.values()]);        // the bar moves
  try {
    if (item.file.size > 5 * 1024 * 1024) throw new Error('Файл больше 5 МБ');
    await put(item.id, item.file);             // IndexedDB
    items.set(item.id, {...next, state: 'done', progress: 100});
  } catch (error) {
    items.set(item.id, {...next, state: 'error', errorMessage: error.message});
  }
  upload.setItems([...items.values()]);
}
```

The retry button carries `errorMessage`, so the message and the action are the
same control: the person reads why it failed and presses it to try again.

## Example

```html
<sf-file-upload
  size="1"
  multiple
  formats="SVG, PNG, JPG or GIF"
  accept=".svg,.png,.jpg,.jpeg,.gif"
></sf-file-upload>
```

```js
const upload = document.querySelector('sf-file-upload');

upload.onFileAdd((event) => {
  console.log(event.detail.item);
});

upload.onFileError((event) => {
  console.log(event.detail.item);
});

upload.onFileComplete((event) => {
  console.log(event.detail.item);
});

upload.onFileRemove((event) => {
  console.log(event.detail.item);
});

upload.onFileRetry((event) => {
  console.log(event.detail.item);
});

upload.onComplete((event) => {
  console.log(event.detail.items);
});
```
