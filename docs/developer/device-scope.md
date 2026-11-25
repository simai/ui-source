# Device scope: layout, pointer, long press

Since the pair of group build 19 (core.runtime above 1.68.0; area A; study S-A, owner question
q-7097831f9f). The rules are on the Touch screens page
([../foundation-touch-screens.md](../foundation-touch-screens.md)); this page
is the scripted contract a component or a set (View, Admin, Pro) calls.

## `SF.device` (`src/core/js/device.js`)

| Name | What it answers |
| --- | --- |
| `PHONE_BELOW` | `600`: below this width (px) of its place a component draws its phone layout |
| `LAYOUTS` | `['phone', 'desktop']` |
| `COARSE_QUERY` | `(pointer: coarse) and (not (any-pointer: fine))` |
| `layoutOf(target)` | `'phone'` or `'desktop'`. An element: the width of its place (`layoutPlace`); a number: that width; a word: itself |
| `layoutOfWidth(width)` | the layout of a width; 0 or no width is `desktop` (not laid out yet) |
| `layoutPlace(element)` | the element or its nearest ancestor with a `container-type` (across a shadow host), else `null` (the page) |
| `watchLayout(element, callback)` | calls `callback(layout)` when the layout changes (a ResizeObserver on the place, else the page's resize); answers `stop()` |
| `pointer()` | `'coarse'` when `COARSE_QUERY` matches, else `'fine'` |
| `watchPointer(callback)` | calls `callback(pointer)` on a change; answers `stop()` |
| `devicesOf(item)` | the layouts an item is scoped to (`devices` as an array or a spaced string; unknown words dropped), or `null` |
| `inLayout(item, layout)` | whether the item is shown in that layout |
| `itemsInLayout(items, layout, {options})` | the items shown in that layout, nested `items` filtered too, and `options` when `options: true`; the given items are not changed |
| `markDevices(items, marks)` | a component's own marks `{id: ['desktop']}` (an object or a Map) put on the items that have no `devices`; nested `items` too; the author's mark wins |

A bundle that imports `device.js` carries its own copy; the module is
stateless, so both copies answer the same.

## `SF.longPress` (`src/core/js/long-press.js`)

`SF.longPress.watch(target, {accepts, press, ms})` -- `press(event)` after a
primary touch is held `ms` (500) on `target` and `accepts(event)` took its
pointerdown. A touch the browser takes for a scroll ends in `pointercancel`
and presses nothing; the browser's own long-press menu is suppressed while
held. It answers `{swallowed(), stop()}`: `swallowed()` is true once, for the
click that follows a fired press. `SF.longPress.ms` is 500. On a surface with
multiple selection `press` chooses the item, else it opens the item's «⋯»
menu (Touch screens rule 6). sf-list and sf-list-item take it from core
through `src/smart/list-item/js/long-press.js`.

## sf-settings 1.11.0

- Any item, a group's item, an option of a `fields` list or of a `choice`:
  `devices: ['phone'] | ['desktop']`. In the other layout it is not drawn
  (menu entries and panel groups); `values`, `reset` and `remember` keep it.
- Setting `device`: `auto` (default) follows `SF.device.layoutOf(element)`;
  `phone` or `desktop` is the host's own word.
- `fields` with `phoneSwitch: true`: each option draws a «На телефоне»
  switch (`role="switch"`, named «<text>: на телефоне»); the option's `phone`
  is its state; `phoneSwitch: false` on an option has none (its place kept).
  The list's value is `[{id, checked, pinned, phone}]`; a press goes out as
  `sf-settings-change` (cancellable) and `sf-settings-changed` of the list.

### What View calls (VL-82, VL-83 phone part, VL-84)

```js
const {markDevices} = globalThis.SF.device;
// View's own marks: table-only settings (S-A q1).
const VIEW_MARKS = {nowrap: ['desktop'], grid_lines: ['desktop']};
settings.items = markDevices(authorItems, VIEW_MARKS);
// The column list: one list, the phone switch per column (S-A q2).
settings.items = [...settings.items, {type: 'group', text: 'Колонки', items: [{
  id: 'columns', type: 'fields', text: 'Колонки', sortable: true, phoneSwitch: true,
  options: columns.map((column) => ({id: column.key, text: column.title,
    checked: column.visible, phone: column.phone,
    ...(column.system ? {sortable: false, phoneSwitch: false} : {})})),
}]}];
settings.addEventListener('sf-settings-changed', ({detail}) => {
  if (detail.id === 'columns') saveColumns(detail.value); // [{id, checked, pinned, phone}]
});
// A host that knows its own layout (the view's container is not a size container):
settings.setAttribute('device', globalThis.SF.device.layoutOf(viewElement));
```

The pair this ships in is the first that carries `SF.device`; a View release
that calls it requires that pair (feature-check `globalThis.SF?.device` for
an older one).
