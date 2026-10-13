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
- `icon`
- `link-text`
- `text`
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
