# sf-modal

Smart modal component.

The base `modal` Loader rule owns the `icon-buttons` and `close` dependencies
used by its generated close action. Smart Modal and Gallery inherit them. When
loading assets manually, include those component styles as well as Modal styles;
loading just modal.js/modal.css does not supply the close glyph.

Keyboard navigation belongs to the top modal. From the initially focused panel,
Tab enters its first available control and Shift+Tab enters its last. Hidden,
disabled, inert and negative-tabindex controls are not tab boundaries. A panel
with no available controls retains focus on itself. These rules are shared with
ordinary Modal; `display="inline"` keeps normal document navigation.

Native named radio groups contribute their checked eligible input as one Tab
boundary. Groups are scoped by form owner and tree, not name alone. Without an
eligible checked input, entry from the panel chooses the first eligible radio,
reverse entry the last. Unnamed radios remain independent. Read current selection
on each Tab; leave checked/tabindex and native arrow-key behavior untouched.

The visible top modal owns two zero-size focus guards outside its panel. Native
Tab traversal can enter either end of an iframe without inspecting its document,
including opaque sandboxed frames. An iframe exit wraps to an available parent
control. If the wrap destination is another frame, focus returns to the meaningful
dialog panel; the next Tab/Shift+Tab enters the first/last child control natively.
Guards follow shared stack ownership and Smart projection and are removed when
no visible modal remains. Inline regions do not acquire them. Child key events
belong to the child document; keep a parent close action accessible rather than
requiring child scripts or bypassing same-origin policy.

Ordinary and Smart modals share their document's modal ordering and scroll-lock
lifetime for visible dialogs, including Gallery's lightbox. Escape and Tab belong to the top window
even when it is a different type. Closing or removing the top window restores
focus into the remaining one; removing a background window does not steal focus.
Existing per-class registries and instance APIs remain separate. Cancelling
`modal:before-close` leaves that window and the page lock intact.

Since 1.1.0 every `modal:*` event bubbles and is composed, as in the base modal
component and `sf-drawer`, so a host can listen on `document`;
`event.detail.modal` names the modal that emitted it. The `on*` helpers and
handlers passed to `SF.create` still receive only their own modal's events. A
listener added with `addEventListener` on an outer modal also hears a nested
one, so check `event.detail.modal`.

The first visible dialog owns the scroll-lock lease until the last visible dialog
leaves, even if the first instance is removed earlier. Pre-existing `overflow-hidden`
classes are preserved independently on html and body. Scrollbar compensation adds
to the computed logical end padding; it does not replace the page's spacing.
Cleanup preserves the original inline value and priority and does not overwrite
padding changed by page code while a dialog was open. With overlay scrollbars or
`preserve-scroll-gap="false"`, Modal does not change the padding declaration.

Calling `open()` while closing cancels the pending close without replacing the
original focus-return target. The interrupted close does not emit
`modal:after-close`; a subsequent completed close emits it once on the component.
The `open` attribute remains until close completes and must not restart the
window while a closing render is being applied.

`open()` enables panel motion by default. `open({animate:false})` (or the compatible
`open(false)` form) disables the panel transition for that accepted opening,
including after an earlier animated opening. Default rendering consumes
`context.animate`; custom templates own their rendering of that choice. The
overlay retains its separate CSS transition. Inline has no panel animation, and
reduced-motion preference disables transitions regardless of this argument.
Inline display neither captures focus on opening nor restores it on closing;
focus outside the inline region remains where the user placed it.

After an accepted close, content immediately becomes inert while the visible
dialog panel retains keyboard focus until the exit transition finishes. Tab stays
on that named panel; actions cannot run again during closing. Background closing
does not steal top-layer focus. Cancelled close leaves content unchanged; reopening
releases only temporary inert attributes, preserving original author inert regions.
The closing guard follows Smart projection and observes new direct panel children
only for the duration of closing. Final close restores focus after hiding content.

Motion uses Framework duration/easing tokens; the close scheduler reads the longest
computed panel/overlay opacity or transform transition (duration plus delay) after
projection, instead of a fixed timer. Reduced motion disables these transitions.
The Close glyph retains system-color mask paint in forced colors, without disabling
native color adjustment on the button or its focus ring.

Focus return checks actual focusability, not just whether the old element still
exists. If the opener is disabled, hidden, inert, detached or rejects focus, use
the remaining visible modal panel. Without a remaining modal, use the nearest
still-available section/article/main/region remembered when opening, then a page
main landmark, then body. Temporary fallback tabindex is removed on blur or removal;
existing or synchronously author-modified tabindex is preserved. A background
modal still never steals focus. No public restore-target option is added.

The default header keeps its title or `header` slot and its actions in normal
flow. Long text wraps, including unbroken words; close and minimize actions keep
their own compact UI-sized targets in both LTR and RTL. The inherited IconButton
UI radius applies to these controls, not the surface radius. Custom content still
owns its internal layout. Ordinary Modal's `headerNodes` replaces the complete
header and does not inject an additional close action.

The dialog and embedded-document surfaces use the semantic large-surface radius
`--sf-radius--surface`. Do not replace it with a numbered radius token. Projects
may change the semantic token once to adapt all large surfaces; header actions
remain on the separate compact-control radius contract.

## Attributes

- `modal-id`
- `title`
- `text`
- `open`
- `autoload`
- `unclose`
- `hide`
- `hide-modifier`
- `minimized`
- `overlay`
- `show-header`
- `show-close`
- `show-footer`
- `close-on-esc`
- `close-on-overlay`
- `preserve-scroll-gap`
- `position="center|inline-start|inline-end|top|bottom"`
  - `inline-start` and `inline-end` are the modal side panel (use them instead of
    a modal `sf-drawer`); they follow the document direction and are the
    preferred values for new interfaces.
  - `left` and `right` remain supported as physical compatibility aliases.
- `mode="inline|ajax|iframe"`
- `display="modal|inline"`
- `src` — URL для загрузки или DOM-селектор (`#id`)
- `preload` — предзагрузка контента (по умолчанию `true` для `mode="ajax"`)
- `fullscreen`
- `width`
- `height`
- `blur`
- `blur-type="none|small|medium|large"`
- `overlay-preset="default|focus"`
- `overlay-class`
- `close-class`
- `surface-class`
- `surface-padding`
- `panel-class`
- `header-class`
- `body-class`
- `content-class`
- `footer-class`

## Overlay presets

Use `overlay-preset` for the standard SIMAI Framework modal behavior:

- `default` (the default value) uses a fixed black 60% scrim without blur;
- `focus` uses the same scrim and adds `backdrop-blur-small`.

The scrim is theme-independent. If `backdrop-filter` is unavailable, the
fixed dark scrim remains visible.

`blur` and `blur-type` remain supported for compatibility and explicit
low-level control. They add `backdrop-blur-*` to the same fixed scrim; they do
not replace it. `overlay-class` remains the final extension point.

`blur-*` blurs the element itself. `backdrop-blur-*` blurs content behind the
element, which is the appropriate effect for a modal overlay.

```html
<sf-modal modal-id="settings" overlay-preset="default">
  <div slot="content">Reader settings</div>
</sf-modal>

<sf-modal modal-id="search" overlay-preset="focus">
  <div slot="content">Search</div>
</sf-modal>
```

## Minimize and restore

`hide()` or adding `minimized` keeps the instance open but removes it from the
active modal layers. Its content becomes inert and hidden from accessibility.
If it was the top dialog, focus returns to the remaining visible dialog or its
original page opener. A minimized background dialog does not steal focus.
The page is unlocked when no visible modal remains; open-instance registries
still retain the minimized instance. `show()` or removing `minimized` reactivates
and raises the dialog, then focuses its panel. Provide an external restore action
because controls inside the minimized dialog cannot be used. Inline display
ignores minimization. The existing before-hide/before-show method events remain
cancelable; changing attributes is direct declarative state, not a method event.

The minimize action uses the standard IconButton `icon` variant and its inherited
semantic foreground. Its decorative line uses `currentColor`, not an icon font;
light/dark and native disabled colors follow the base IconButton role rules.

## Inside a box (`data-sf-overlay-container`)

A modal is rendered at the end of `body` and covers the viewport. When it
stands inside an element with `data-sf-overlay-container`, its backdrop and
surface are rendered inside that element and cover it alone (the box gets
`contain: layout`); the page is not scroll-locked. An editor pane or a
documentation example holds its own modal this way without a stage of its
own. The same attribute frames `sf-drawer`.

```html
<div data-sf-overlay-container style="block-size: 24rem">
  <sf-modal open title="Example">…</sf-modal>
</div>
```

## Slots

- `header`
- `content`
- `footer`

## Methods

- `open()`
- `close()`
- `toggle()`
- `hide()`
- `show()`
- `getModalRoot()`
- `onModalReady(handler)`
- `onModalUpdate(handler)`
- `onBeforeOpen(handler)`
- `onAfterOpen(handler)`
- `onBeforeClose(handler)`
- `onAfterClose(handler)`
- `onBeforeHide(handler)`
- `onAfterHide(handler)`
- `onBeforeShow(handler)`
- `onAfterShow(handler)`
- `setSrc(src)` — динамически загрузить контент из нового источника
- `reloadContent()` — перезагрузить контент из текущего `src`

## Example

```html
<sf-modal id="demo-modal" title="Smart modal">
  <div slot="content">Modal body</div>
  <div slot="footer">
    <button type="button" data-sf-modal-close="demo-modal">Close</button>
  </div>
</sf-modal>
```

### Ajax mode — загрузка по URL

```html
<sf-modal modal-id="ajax-modal" mode="ajax" src="/api/content" title="Loaded via AJAX">
</sf-modal>
```

### Ajax mode — DOM-селектор

```html
<div id="hidden-content" style="display:none;">
  <p>This content will be cloned into the modal.</p>
</div>

<sf-modal modal-id="dom-modal" mode="ajax" src="#hidden-content" title="DOM content">
</sf-modal>
```

### Без предзагрузки

```html
<sf-modal modal-id="lazy-modal" mode="ajax" src="/api/content" preload="false" title="Lazy loaded">
</sf-modal>
```

```js
const modal = document.querySelector('#lazy-modal');
modal.onModalReady(() => {
  modal.reloadContent(); // загружаем контент по запросу
});
```

### Динамическая смена источника

```js
const modal = document.querySelector('#ajax-modal');
modal.setSrc('/api/new-content'); // отменит предыдущую загрузку и загрузит новый контент
```

### Iframe mode

```html
<sf-modal modal-id="iframe-modal" mode="iframe" src="https://example.com" title="External page">
</sf-modal>
```

Iframe загружается автоматически (если `preload` не `false`). Контент отображается в `<iframe>` на всю область модалки.

### Inline mode

```html
<sf-modal modal-id="inline-modal" display="inline" title="Inline content">
  <div slot="content">Этот контент отображается в потоке документа, без overlay и focus trap.</div>
</sf-modal>
```

`display="inline"` — модалка отображается как обычный блок в потоке документа:
- Без overlay
- Без fixed positioning
- Без scroll lock
- Без focus trap
- Esc не закрывает
# Simai Framework Modal contract

The machine-readable contract is [`../contract.json`](../contract.json). It is
the source-owned inventory of parameters, states, events, slots/templates,
dependencies, accessibility, theme extension points and frontend/backend call
surfaces.

Frontend:

```js
const modal = document.querySelector("#profile-modal");
modal.onAfterOpen(() => console.info("opened"));
modal.open();
```

Larena backend adapter:

```php
use Larena\Ui\Facades\Smart;

$artifact = Smart::render(
    'ui.modal',
    [
        'modal-id' => 'profile-modal',
        'title' => 'Profile',
        'aria-label' => 'Profile details',
    ],
    $assetActivation,
    $slots,
);
```

`aria-label` is optional when the default visible title is used: the template
links the dialog to its heading through `aria-labelledby`. Custom header or
headerless variants fall back to the `title` value unless an explicit
`aria-label` is supplied.

For Ajax content, `modal:after-content-upload` is the completion signal for
both `success` and `error`. Its `detail.remote` value already contains the
terminal state; aborted requests do not emit completion.
