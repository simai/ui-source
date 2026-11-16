# Smart List Item

The default template applies `root-class`, author `style` and `root-style`
to its visible root. Use Framework semantic tokens for geometry. These settings
do not belong to the boxless host and must not reset existing component state.

Smart/runtime wrapper for the list-item styles that live in the `dropdown`
component. `sf-list-item` is a declarative option descriptor for a direct
`sf-dropdown` child; Dropdown captures it and owns listbox semantics, focus,
selection, form state and events.

A standalone `sf-list-item` is a non-interactive visual preview, unless
`interactive` or `sortable-item` makes it a list row (see "List row" below). A
preview deliberately has no `role="button"`, Tab stop or click behavior. Use a Button or Link for an
action and Checkbox/Radio for an independent choice. Do not build an option with
independently interactive descendants; use a collection pattern that owns those
controls instead.

Tag:

- `sf-list-item`

Loading model:

- detected by `tags: ['sf-list-item']` in `src/smart/list-item/rule.js`
- loaded as smart bundle `cl-list-item`
- base styles are loaded through relations with `dropdown`, `checkbox`, `avatars`, `tags`

Current scope:

- types:
  - `text`
  - `icon`
  - `checkbox`
  - `avatar`
  - `color`
- sizes:
  - `1/3`
  - `1/2`
  - `1`
  - `2`
  - `3`

Main attributes:

- `template`
- `value` — the row's id: the machine value the parent Dropdown reads and the
  id `sf-list-item-open` carries. The property answers it as a string;
  writing an object still writes its attributes.
- `kind` (`type` is its dated alias until 2026-12-01)
- `size`
- `text`
- `icon`
- `checked`
- `selected`
- `disabled`
- `color-class`
- `avatar-image-url`
- `avatar-title`
- `aria-label`
- `divided` — an inset line under the row (owner decision C148 (4))
- `lines` — `1` (default) or `2`: how many lines the title takes before its
  ellipsis (C148 (5))

## Slot overrides

Supported light-DOM slot names:

- `leading`
- `text`
- `trailing`

Example:

```html
<sf-dropdown label="Статус" name="status" placeholder="Выберите статус">
  <sf-list-item value="open" text="Открыт"></sf-list-item>
  <sf-list-item value="done" text="Готов"></sf-list-item>
</sf-dropdown>
```

## Accessibility ownership

The shared renderer emits `role="option"`, `aria-selected`, `aria-disabled` and
the machine value only when Dropdown invokes it as an option. Dropdown owns
Arrow Up/Down, Home, End, Enter, Space and Escape. Visual checkbox marks and
leading icons are decorative and never add another focus target. Visible text
is the accessible option name unless `aria-label` explicitly overrides it.

## List row

The same row is the Framework's general list row (simai/ui-source#18 and #29,
requested by ui-mail): admin, chat and editor lists use it instead of a row of
their own. It was extended rather than duplicated as a new element because the
option row already holds what a list row needs -- the size ladder (a one-line
row is the control height of its size), the `leading`, `text` and `trailing`
slots, `selected` and `disabled` -- and a second element would have been a
second set of row geometry to keep on the ladder. What a list row adds is off
for a Dropdown option, so options are unchanged.

| Attribute | What it does |
| --- | --- |
| `supporting` (or a `slot="supporting"` child) | A second line under the title, one step of the ladder smaller (1/3 and 1/2 rows: 1/3; 1: 1/2; 2: 1; 3: 2). A two-line row is the next size's control height, never lower than a menu row with a caption (owner decision C49): one control of step 1/2 plus the caption's line -- 48 on a desktop, 44 in a compact region, 60 under a finger (the step is then the 44 touch target). Size 2 stays 56. Kinds `text`, `icon`, `checkbox` and `avatar` (an avatar row outside a dropdown draws the picture, then the title and the supporting line). |
| `interactive` | A row a person acts on: hover, keyboard focus and `selected` states, a pointer cursor, and `sf-list-item-open` (`detail: {id, trigger}`, vocabulary 1.1.5 `open`, `id` being `value`) on click or Enter. The former `sf-list-item-activate` (`{value, item, trigger}`) follows until 2027-01-01; each use is noted in `SF.deprecations`. A click on a control inside the row (a trailing action) is that control's, not the row's. |
| `sortable-item="<id>"` | The row is an item of the surrounding `sf-sortable` list: the row's own box carries `data-sf-sortable-item` (the host is boxless, so the attribute does not go on the host) and a drag handle stands in a slot before the content. |
| `divided` | An inset line under the row, from its text to its end edge, inside the row's height; none under the last row of its list. Off by default: rows have no lines between them, and groups are told apart by their headings (C40). For long lists of like rows (settings, people). |
| `lines="2"` | The title takes up to two lines before its ellipsis (records and documents whose names differ at the end); the row grows by the second line only when the title needs it. The supporting line is always one line. |
| `pinned` | A row of the list that does not move: no handle and not an item of the list, so it cannot be dragged or picked up. It keeps the handle's slot empty, so its text starts where the other rows' text does. |

**Owner decision C148** (2026-11-14, `control/research/2026-11-14-list-item.md`,
prototype `prototypes/list-item-study.html`):

1. A row with a caption is a menu row with a caption (C49): 48, compact 44,
   60 under a finger.
2. **The end column.** In a row with a caption, a `slot="trailing"` `<span>`
   or `<div>` that holds no buttons is a column: its first line stands on the
   title's line (a time), its second on the caption's (a grey count, C140, or
   a badge), in the caption's type and dim ink; the row keeps its height and
   its title its width. A trailing part of buttons stays a row of buttons.
3. **Buttons in a pressable row.** The controls in an `interactive` row are
   not Tab stops of their own: the row is its list's one stop. ArrowRight
   (ArrowLeft right to left) goes from the row to its first control and on,
   the other arrow back to the previous control and then to the row; Escape,
   ArrowUp and ArrowDown on a control go back to the row. The avatar and the
   icon are pictures, never buttons.
4. **No lines between rows**; `divided` draws an inset one.
5. **One line.** The title is one line cut with an ellipsis (`lines="2"`:
   two); the caption always one. When either is cut, the whole of it is the
   row's tooltip (`title`, set when a pointer comes to the row), unless the
   page gave the host a `title` of its own.
6. **Under a finger.** The row's buttons are 44 (`--sf-d1`) in a row with a
   caption. A long press (0.5 s) on an `interactive` row presses its menu
   button -- the control with `aria-haspopup`, else the last control at the
   row's end, the «⋯» -- and the click its release sends opens nothing. No
   swipe.
7. The drag handle is unchanged (hover and focus, always on touch, its place
   kept); the picture-to-text step is C105 H2 and a text row among rows with a
   picture keeps the picture's place.

```html
<div role="list" aria-label="Беседы">
  <sf-list-item interactive value="a" kind="icon" icon="person" text="Анна Белова"
                supporting="Пришлю договор после обеда">
    <span slot="trailing">10:42<sf-badge text="3" appearance="tonal" size="1/3"
          aria-label="3 непрочитанных"></sf-badge></span>
  </sf-list-item>
  <sf-list-item interactive value="b" kind="icon" icon="person" text="Иван Петров" supporting="Инженер">
    <span slot="trailing">
      <sf-button-icon icon="call" appearance="ghost" aria-label="Позвонить: Иван Петров"></sf-button-icon>
      <sf-button-icon icon="more_horiz" appearance="ghost" aria-haspopup="menu" aria-label="Действия: Иван Петров"></sf-button-icon>
    </span>
  </sf-list-item>
</div>
```

**A row without a picture among rows with one** (owner decision C105) keeps the
picture's place: in a list (`sf-sortable`, `[role="list"]`, `[role="listbox"]`,
`[data-sf-list]`) whose rows have an icon or an avatar, a text row's text starts
where theirs does -- a pinned text row of an `sf-sortable` list too.

**Before the code.** Until the element is defined, core holds the row's box --
one control of its size, the caption row with `supporting` -- and draws its
`text` and `supporting` attributes at the row's inset, so nothing under a list
of rows moves when the code arrives and the words are there from the first
frame. With `lines="2"` the box grows with a title that takes two lines. The
picture and the trailing part come with the code.

**One Tab stop per list.** Interactive and sortable rows are one stop of their
list -- the nearest `sf-sortable`, `[role="listbox"]`, `[role="list"]` or
`[data-sf-list]`, else the row's parent. The row that last had the focus takes
Tab (else the selected one, else the first); ArrowDown, ArrowUp, Home and End
move between rows and skip disabled ones. While a row is picked up for a
keyboard reorder the arrows belong to `sf-sortable`. The trailing slot stands
at the row's end edge: the text block takes the row's free width. The controls
of an `interactive` row are reached from it with the arrows (C148 (3) above);
in a row of an `sf-sortable` list that is not `interactive`, a control keeps
its own Tab stop.

**In `sf-sortable`.** Space or Enter picks a row up, the arrows move it and
Space or Enter drops it, exactly as for any item of the list; Enter therefore
does not activate a sortable row (a click does). Where a pointer can hover, the
handle shows on the row under the pointer and on the focused row; on a touch
screen it is always shown. Its slot is always kept, so nothing moves.
When the host applies `sf-sortable-move` and redraws, it moves or replaces the
`sf-list-item` elements themselves: the element carrying
`data-sf-sortable-item` is the row's box inside the host, and removing only
that box leaves an empty host behind.

```html
<sf-sortable id="blocks" group="blocks" label="Blocks">
  <sf-list-item pinned interactive size="1/2" text="Letter settings" value="settings"></sf-list-item>
  <sf-list-item sortable-item="hero" interactive size="1/2" kind="icon" icon="title"
                text="Heading" supporting="Hello" value="hero">
    <sf-button-icon slot="trailing" icon="more_horiz" aria-haspopup="menu" aria-label="Actions"></sf-button-icon>
  </sf-list-item>
  <sf-list-item sortable-item="text" interactive size="1/2" kind="icon" icon="notes"
                text="Text" supporting="Paragraph" value="text"></sf-list-item>
</sf-sortable>
```

The list owns the role: a selected row says `aria-current="true"`, a disabled
one `aria-disabled="true"`. Probe: `tests/browser/list-row-general.browser.mjs`.

## Interface

The interface is `component.json` (standard simai.smart-component 1.3.8), the
examples `examples.json`, the dated aliases `aliases.json`. Public variables
(read by the class sheet in `component/dropdown`): `--sf-list-item-background-color`,
`--sf-list-item-border-color` (the `divided` line), `--sf-list-item-color` (the title),
`--sf-list-item-supporting-color`, `--sf-list-item-handle-color`.
