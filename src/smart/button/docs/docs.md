# Smart Button

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `buttons` component.

Tag:

- `sf-button`

Loading model:

- detected by `tags: ['sf-button']` in `src/smart/button/rule.js`
- loaded as smart bundle `cl-button` (`cl-buttons` is its dated alias until
  2026-12-01, and `smart/buttons/js/buttons.js` a forwarding script that loads
  `smart/button/js/button.js`; change journal `path-smart-buttons-to-button`)
- base styles and base component JS are loaded through relation with `buttons`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching
- `loading` publishes `aria-busy="true"`, disables the native button against
  duplicate activation and shows the spinner at the icon's size: in place of
  the start icon (else the end icon; an icon-only button's icon); without an
  icon it lies over the label, which keeps its place, so the width does not
  change and the label stays the accessible name. Reduced motion: a still arc

Main attributes:

- `template`
- `size`
- `appearance="default|tonal|outline|ghost|surface"` — `ghost` is the quiet
  button with no fill and no edge until a pointer meets it (1.9.0, decision
  C15; `link` is its former name, a dated alias). `href` makes any appearance
  a link. surface reads the neutral alpha ramp rather than a colour of its
  own: a faint fill and a border one step stronger, right in a light and in a
  dark theme without being redeclared.
- `scheme="primary|secondary|on-surface|on-surface-variant"` — which colour
  family the control takes. `on-surface-variant` is the on-surface family one
  step quieter: the fill and the edge of `on-surface`, the label and the icons
  in `--sf-on-surface-variant` (a filled `default` button keeps on-surface's
  inverse ink). Hover, press and disabled are on-surface's. `secondary` in
  the `outline`, `surface` and `ghost` appearances is drawn the same way: the
  on-surface button with the label and the icons in `--sf-secondary`, at rest,
  hovered and pressed; `default` and `tonal` secondary keep their own fill.
- `status="danger"` — what the control is about. The destructive one, for a
  control that deletes, discards or cannot be undone (1.9.0, decision C13:
  controls say `danger`, fields and messages say `error`; `error` is read as
  `danger`). It paints with the error
  family's twin of every primary role, so it behaves exactly like a primary
  control and only its colour says what it does. A status wins over the scheme,
  because the two cannot both colour the control.
- `text`
- `icon`
- `icon-start`
- `icon-end`
- `icon-position`
- `height="low|default|high|highest"` — the control height, separate from
  the size (1.10.0, decision C27). The size sets the text, the icons and the
  inner scale; the height picks the control height from the size's tightness
  steps -- its usual step (`default`) and the neighbours on the UI height
  ladder. The side padding grows by half of what the height adds, so the gap
  from the end to the icon stays the same. A compact region
  (`data-sf-density="compact"`) moves the steps one down and the height picks
  the neighbour there. Another value reads as `default`, with one console
  warning.

  | size | low | default | high | highest |
  |------|-----|---------|------|---------|
  | 1/3  | 24 / 20 | 28 / 24 | 32 / 28 | 40 / 36 |
  | 1/2  | 28 / 24 | 32 / 28 | 40 / 36 | 48 / 44 |
  | 1    | 32 / 28 | 40 / 36 | 48 / 44 | 56 / 52 |
  | 2    | 40 / 36 | 48 / 44 | 56 / 52 | 68 / 64 |
  | 3    | 48 / 44 | 56 / 52 | 68 / 64 | 80 / 76 |

  (px, desktop / phone.) `--sf-button-padding-block` and
  `--sf-button-padding-inline` still win over the height.
- `spacing="compact|normal|comfortable|spacious"` — deprecated (1.10.0,
  decision C27; journal `attribute-button-spacing-to-height`): the side padding
  only, at the same height. It keeps drawing as before until 2027-01-01 with a
  console warning and is not turned into a height; write `height` instead
- `radius="default|square|rounded"`
- `root-class`
- `loading`
- `disabled`
- `native-type`
- `form`, `name`, `value` — a native button's own words (1.5.0): the id of the
  form it submits (a button outside the form submits it), and the name and
  value it submits under when it is the submitter:

  ```html
  <form id="step-address" method="post">…</form>
  <sf-button native-type="submit" form="step-address" name="wizard" value="next" text="Далее"></sf-button>
  ```
- `href` — a link with the button's look (1.4.0): the element draws
  `<a href>` with the button's classes; the role is link, Enter and the
  browser's link keys follow it. A relative address, a fragment, http(s),
  `mailto:` and `tel:` are taken; any other scheme draws a button. Disabled
  or loading, the link loses its `href` and says `aria-disabled`.
  `native-type`, `form`, `name`, `value`, `expanded` and `pressed` do not apply to a link
- `target`, `rel` — where a link opens and its relation, written on the
  `<a>` as they are given (1.7.0). A link that opens a new tab
  (`target="_blank"`) with no `rel` says `rel="noopener noreferrer"`, so the
  opened page cannot reach this one; a `rel` the page writes is kept as it is.
  A button (no `href`) carries neither:

  ```html
  <sf-button href="/docs/import" target="_blank" text="Инструкция" icon-end="open_in_new"></sf-button>
  ```
- `expanded` — present, it writes `aria-expanded` on the native button
  (`expanded="false"` says closed); absent, nothing is said
- `pressed` — a toggle button: present, it writes `aria-pressed` on the native
  button and, while on, the pressed look (`pressed="false"` says off);
  absent, the button is not a toggle and nothing is said. The pressed look
  (1.6.0, rule C12): the primary container fill, the label and the icons in
  `--sf-on-primary-container`, no visible edge (the height does not move) and
  the icons filled -- two cues, not colour alone, in both themes
- `text-pressed` — the label while the toggle is on, for a toggle whose label
  changes: `<sf-button text="В избранное" text-pressed="В избранном"
  icon="star" pressed="false">`. The label then says the state, so
  `aria-pressed` is not written (both at once read «В избранном, нажата»); the
  pressed look still follows `pressed`. A toggle with one label («Жирный»)
  leaves it empty and `aria-pressed` says the state
- `shortcut` — a key combination drawn at the end of the button, see below
- `shortcut-listen` — the button is pressed by its shortcut, see below
- `aria-label` — a host attribute, passed to the native button

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `icon-left` and `icon-right` for `icon-start` and `icon-end`,
`tightness="low|high|highest"` for `spacing="compact|comfortable|spacious"`, and
the values `left` and `right` (icon-position start and end). Until 2027-01-01:
`link` (ghost), `error` and `critical` (danger). The shim writes the new attribute and notes each
use in `SF.deprecations`.

## Shortcut

`shortcut` draws a key combination at the end of the button as keys: words
joined by `+`, the modifiers first and the key last. It is the only input: the
look is the `kbd` component's, and a page never styles the keys.

| Written | On a Mac | Elsewhere |
|:---|:---|:---|
| `mod+k` | ⌘ K | Ctrl K |
| `shift+mod+p` | ⇧ ⌘ P | Ctrl Shift P |
| `alt+n` | ⌥ N | Alt N |
| `/` | / | / |
| `escape` | Esc | Esc |

`mod` is the platform's command modifier: Cmd on Apple platforms, Ctrl
elsewhere; `ctrl`, `alt`, `shift` and `meta` are those keys. The named keys are
`enter`, `escape`, `tab`, `space`, `backspace`, `delete`, `up`, `down`,
`left`, `right`, `home`, `end`, `pageup` and `pagedown`; `plus` is the `+` key.

The keys are the `kbd` component's (a `<span class="sf-button-shortcut">`
holding one `<kbd class="sf-kbd--group">` with a `<kbd>` per key) and are
hidden from assistive technology: the native button
says the combination in `aria-keyshortcuts` (`Meta+K` on a Mac, `Control+K`
elsewhere). With a shortcut the label takes the free room, so a stretched
button reads label … keys and `text-position` places the label.

Inside a button the keys are soft caps (owner decision 2026-11-07, docs
review R030): no edge, the text face at medium weight, sized from the label --
letters at 0.8125em, a cap 1.6em high and at least as wide, 0.4em of room,
0.25em between caps. Their ink is the label's at 80 % and their fill that ink
at 12 %, so they read on every appearance and scheme, filled or not, light or
dark, with nothing of the button's own. A key of one character (P, ⌘, ⇧, ↵) is
a square; a key of several letters (Esc, Ctrl, Shift) hugs its word. Caps
stand apart, so no `+` is drawn between them.

`shortcut-listen` makes the button listen: the combination pressed anywhere on
the page presses the button, exactly as a click does (so `sf-button-press`
follows). It is not heard when another listener already took the key, while the
button is disabled, loading or not shown, and — for a combination without
`mod`, `ctrl`, `alt` or `meta`, like `/` — while focus is in an editable field.
The combination is matched by the physical key too, so `mod+k` works on a
Russian layout.

A search trigger that reads like a field:

```html
<sf-button text="Поиск" icon-start="search" shortcut="mod+k" shortcut-listen
  appearance="tonal" scheme="on-surface-variant" radius="rounded"
  text-position="start" root-class="w-full"></sf-button>
```

## Events

- `sf-button-press` — a person pressed the native button: a click, Enter or
  Space. It is sent once per press, with an empty `detail`, and never while the
  button is disabled or loading. The native `click` still bubbles as before; in
  an assembly a rule hears the press as `<role>.press`.

The empty radius is the normal UI radius. `default` is retained as a legacy
surface-radius override but should not be used for ordinary controls; prefer
`square` or `rounded` only when the design explicitly requires them.

Runtime helpers:

- `element.value`
- `element.onClick(handler)`
- `element.onFocus(handler)`
- `element.onBlur(handler)`
- `element.onMouseEnter(handler)`
- `element.onMouseLeave(handler)`
- `element.focus(options)` — focus the native control inside the host
- `element.blur()`
- `element.dataAttributes` — the `data-*` the author wrote on the host
- `element.removeHostDataAttribute(name)`

Metadata:

- `src/smart/button/meta.mjs`
- `src/smart/button/component.json` — the interface (standard 1.3.8)

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/button/<template>/index.js`
- `/local/smart/templates/button/<template>/index.css`

## The label

Three ways to give the button its label, in this order:

1. a `text` slot (`<span slot="text">…</span>`);
2. the `text` attribute;
3. a text child — `<sf-button>Добавить</sf-button>`, and the same from code:

```js
const add = document.createElement('sf-button');
add.textContent = 'Добавить';     // the label, like on any element
add.dataset.add = 'block';        // stays on the host, see below
panel.append(add);
```

The child is taken into the button as its label when the button draws; it is
not left beside it. An unslotted child *element* is not a label — wrap it in
`slot="text"` or use the attribute.

A `text` attribute that is there, even empty, is the label: setting it to
`''` empties the button, whatever text child it had. Remove the attribute to
let a text child speak again.

## Host attributes

Attributes the component does not own are copied to the native `<button>` it
renders, so an author's `aria-*` or `title` reach the real control.

A `data-*` is **moved, not copied**: it ends up on the native button and the
host no longer has it. One element carries it, and it is the one that has a
box, paints, takes focus, is clicked and is dragged — so a `data-*` works as a
handle:

```js
const save = panel.querySelector('[data-action="save"]');   // the native button
panel.querySelectorAll('[data-action="save"]').length;      // 1
save.focus();                      // it is natively focusable
save.getBoundingClientRect();      // it has a box, so a drag can read one
save.closest('sf-button');         // the host, when that is what you want
```

Delegation reads it either way: `event.target.dataset.action` on the control,
or `event.target.closest('[data-action]')`.

A host is never the match, because a Smart host lays out as
`display: contents`: it generates no box at all, so a selector that answered
the host would answer something that cannot be measured, dragged or painted.
Leaving the attribute on the host as well was worse — then every `data-*` was
on two elements and a count came back doubled.

What the author wrote is still readable from the host, under its own name:

```js
const add = document.createElement('sf-button');
add.textContent = 'Добавить';
add.dataset.add = 'block';         // written on the host as data-add
panel.append(add);
// after the first render:
add.dataAttributes.add;            // 'block' — the host's record
add.dataset.add;                   // undefined — the attribute is on the button
add.querySelector('[data-add]');   // the native button that carries it
add.removeHostDataAttribute('data-add');   // off the record and off the button
```

`element.dataAttributes` reads like `dataset` (`data-add` → `.add`).
Removing a `data-*` from the control alone is undone on the next render,
because the host's record is what the control is given again —
`removeHostDataAttribute()` takes it off both.

Focus reaches the control from the host too. The host takes no focus itself, so
`focus()` on it goes to the native button inside:

```js
const host = panel.querySelector('sf-button');
host.focus();                             // focus lands on the native button
panel.contains(document.activeElement);   // true
```

`blur()` works the same way. Asked before the button has drawn, the focus is
applied on its first render — and skipped if something else took focus while it
waited.

The component's own attributes (the list above, plus `class`, `style`, `id` and
`slot`) are not copied: they are what the component reads.

## Slot overrides

Supported light-DOM slot names:

- `icon-start`
- `icon-end`
- `text`

The legacy slot names `icon-left` and `icon-right` remain compatible.

Example:

```html
<sf-button text="Save">
  <span slot="icon-start"><i class="sf-icon">cloud_upload</i></span>
</sf-button>
```

## Cycle

`cycle` makes one button step through several values (1.9.0, decision D11d):
a speed, a repeat mode, a sort order. Its items are shaped like sf-segmented's:
`value`, `label`, `icon`, and `pressed` for an item drawn with the pressed look.
`value` is the current item (the first by default). A press moves to the next
item and wraps, and sends `change` with `{previous, value, item}`.

```html
<sf-button aria-label="Скорость" value="1"
  cycle='[{"value":"1","label":"1×"},{"value":"1.5","label":"1,5×"},{"value":"2","label":"2×"}]'></sf-button>
```

The accessible name says the current value («Скорость: 1,5×»), the tooltip the
current and the next («… Нажмите — 2×»), and a polite live region announces the
new value after a press. Without an icon the label is the button's text.

`theme-cycle` is the ready theme switch over `SF.Loader` (`setTheme`,
`sf-theme-change`): empty for the three themes, or `"light dark"` for two. The
order is the visible theme's opposite first, then the other, then «как в
системе», whose icon is `contrast`.

A cycle is not a toggle: `pressed` and `text-pressed` are ignored beside it,
and the console says so once.

