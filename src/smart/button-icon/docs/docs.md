# Smart Icon Button

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `icon-buttons` component.

For the `icon` variant, the base component owns `--sf-icon--color` on the
button root. Standard `.sf-icon` content keeps its existing semantic foreground;
custom decorative content can inherit `currentColor`, including its native
disabled state. An explicit color on the child remains a child override. This
does not change the separate Close glyph contract or introduce a font dependency
for CSS/SVG decorations.

Tag:

- `sf-button-icon`

Loading model:

- detected by `tags: ['sf-button-icon']` in `src/smart/button-icon/rule.js`
- loaded as smart bundle `cl-button-icon` (`cl-icon-buttons` is its dated alias
  until 2026-12-01, and `smart/icon-buttons/js/icon-buttons.js` a forwarding
  script that loads `smart/button-icon/js/button-icon.js`; change journal
  `path-smart-icon-buttons-to-icon-button`)
- base styles and base component JS are loaded through relation with `icon-buttons`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `kind="icon|close"`
- `size` — the icon and the control's step on the ladder, `1` by default.
  Beside a value in a line of text, give it the line's step (decision C103):
  `size="1/2"` beside text 1/2 (32, icon 20), `size="1"` beside text 1 (40,
  icon 24). In a row of buttons or a field it takes their size; density moves
  it with the row.
- `height="low|default|high|highest"` (1.8.0, decisions C27 and C35) — the
  control height separate from the size, as on `sf-button`: the size's
  tightness steps on the UI height ladder, the icon keeping the size. The
  button stays square (the step is the padding on all four sides). Size `1`:
  32 / 40 / 48 / 56 on desktop, 28 / 32 / 40 / 48 compact, 28 / 36 / 44 / 52
  on a phone. `kind="close"` takes the same heights; a new close is
  `sf-button-close height="…"`.
- `appearance="default|tonal|outline|ghost|plain"` — four looks on one ladder
  (1.6.0, decision C15) and `plain` for an icon inside another element
  (1.12.0, below): a fill, a soft fill, an edge, and `ghost`, which keeps nothing until a
  pointer or the keyboard reaches it. `link` is ghost's former name, a dated
  alias. `surface` is retired: it is drawn as `tonal` in `on-surface`, and the
  console notes it until 2027-01-01.
- `plain` (1.12.0, owner decision C201) — an icon inside another
  element: no fill or edge in any state, only the glyph's ink moves —
  `--sf-on-surface-variant` at rest, `--sf-on-surface` under the pointer,
  `--sf-primary` on a press (and while a toggle is on, its glyph filled). The
  focus ring is every button's; the hit area is the icon button's of the same
  size. Take it for a field's action, the help mark at a heading
  (`sf-help-mark`), copy in a code block or the plain copy component; buttons
  in panels and toolbars keep a look with a plate (`ghost` and the others).
  A plain icon button is neutral whatever `scheme` or `status` say: a
  destructive action stays `ghost` or `outline`. The class is
  `sf-icon-button--plain`.

  ```html
  <h3 class="flex items-cross-center gap-1/3">Уровни доступа
    <sf-button-icon size="1/2" appearance="plain" icon="info" aria-label="Подробнее: уровни доступа"></sf-button-icon></h3>
  ```
- `scheme="primary|on-surface|on-surface-variant"` — which colour
  family the control takes (`secondary` is retired and drawn as
  `on-surface-variant` until 2027-01-01). Under the pointer a tonal, outline
  or ghost neutral glyph takes the hover ink of `sf-button`'s label
  (component.icon-buttons 1.14.0); ghost draws with `sf-icon-button--ghost`
  (`link` is the class's former name too). `on-surface-variant` is `on-surface` one step
  quieter: the same fill and edge, the glyph in `--sf-on-surface-variant`.
  That is what a quiet trigger wants — beside a field, in a panel's head,
  next to a row — and `sf-button` says it the same way. A filled
  (`appearance="default"`) control keeps the inverse glyph of `on-surface`:
  on a dark fill there is no quieter step.
- `status="danger"` — what the control is about. The destructive one, for a
  control that deletes, discards or cannot be undone (decision C13: controls
  say `danger`, fields and messages `error`; `error` is read as `danger`). It
  paints with the error family's twin of every primary role, so it behaves
  exactly like a primary control and only its colour says what it does. A
  status wins over the scheme, because the two cannot both colour the control.
  `danger` is the only status of an icon button (decision C116): there are no
  success, warning or info icon buttons; another word draws no status and
  warns once in the console. A danger icon button is `default`, `outline` or,
  in a row, `ghost`; `tonal` (and the retired `surface`) with
  `status="danger"` draws as `outline` until 2027-01-01, with one warning.
- `icon`
- `href`, `target`, `rel`, `download` (1.9.0, decision C51) — with an `href`
  the icon button is a native link (`<a class="sf-icon-button">`) with its
  look: the quiet «Скачать <name>» at the end of a table row is a real link to
  the file, so the browser's link keys, context menu and download work. The
  address takes `sf-button`'s rule (a relative address, a fragment, http(s),
  mailto, tel; any other scheme draws a button); `target="_blank"` with no
  `rel` says `noopener noreferrer`; `download` is the `<a download>` name.
  Disabled or loading, the link has no `href`, says `aria-disabled` and is not
  followed. `native-type`, `pressed` and a cycle do not apply to a link. The
  name is the `aria-label`, as on the button.

  ```html
  <sf-button-icon size="1/2" appearance="ghost" scheme="on-surface-variant" icon="download"
    href="/files/invoice-1043.pdf" download="Счёт 1043.pdf" aria-label="Скачать Счёт 1043.pdf"></sf-button-icon>
  ```
- `radius="default|square|rounded"`
- `root-class`
- `loading` — the spinner in place of the icon, at its size; `aria-busy` and
  native `disabled`. The button keeps its scheme colour -- the fill, the edge
  and the icon colour of the resting one -- and the spinner takes the icon
  colour, its background ring that colour at 16 % (1.8.1, the C36 follow-up;
  before, it wore the grey disabled look). `disabled` and `loading` at once
  wear the disabled look
- `disabled`
- `native-type`
- `pressed` — a toggle button: present, it writes `aria-pressed` on the native
  button and, while on, the pressed look (`pressed="false"` says off);
  absent, the button is not a toggle and nothing is said. The pressed look
  (1.5.0, rule C12): the primary container fill, the icon in
  `--sf-on-primary-container` and filled, no visible edge (the height does not
  move) -- two cues, not colour alone, in both themes. Only a toggle wears it
  (component.icon-buttons 1.13.0, owner decision C211 (1)): `outline` or
  `ghost` in `on-surface` or `on-surface-variant`. A `default` or `tonal`
  icon button, a danger or a primary one keeps its own look with `pressed`
  (`aria-pressed` is still written) and the console says once that it is no
  toggle; the tonal toggle looks of 1.6.1 are gone. A choice of one among
  several -- a view, a width, a theme -- is not a row of toggles: write
  `sf-segmented`
- `label-pressed` — the name while the toggle is on, for a toggle whose name
  changes: `<sf-button-icon icon="star" aria-label="Добавить в избранное"
  label-pressed="Убрать из избранного" pressed="false">`. The name then says
  the state, so `aria-pressed` is not written; the pressed look still follows
  `pressed`. A toggle with one name («Жирный») leaves it empty
- `aria-label`
- `badge-count`, `badge-dot`, `badge-cap` (99), `badge-label` -- a count or a
  dot at the button's top end corner, sized by `size` (1/3 and 1/2: a dot
  only), the phrase joined to `aria-label`: «Уведомления, 3 непрочитанных».
  `0` hides it. See the Badges documentation, «Бейдж на якоре»
  (simai/ui-source#12).

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `variant` for `kind`, and `tightness="low|high|highest"` for
`spacing="compact|comfortable|spacious"`. The shim writes the new attribute and
notes each use in `SF.deprecations`. Until 2027-01-01: `link` (ghost), `secondary`
(on-surface-variant) and `error` (danger). `spacing` (and `tightness`) is
retired (owner decision C213, 2026-11-16): an icon button has no density --
`size` and `height` change it and keep it square -- so it draws nothing, is
noted in `SF.deprecations` and said once per button in the console until
2027-01-01.

- `button-attributes` — an object (a property) for an external project
  template; the built-in template does not read it.
  `element.setButtonAttributes(object)` writes it.

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

- `src/smart/button-icon/meta.mjs`
- `src/smart/button-icon/component.json` — the interface (standard 1.3.8)

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/icon-button/<template>/index.js`
- `/local/smart/templates/icon-button/<template>/index.css`

## Slot overrides

Supported light-DOM slot names:

- `icon`

Example:

```html
<sf-button-icon aria-label="Custom icon">
  <span slot="icon"><i class="sf-icon">favorite</i></span>
</sf-button-icon>
```

Close variant:

```html
<sf-button-icon
  variant="close"
  size="1/3"
  appearance="ghost"
  scheme="on-surface"
  aria-label="Close"
></sf-button-icon>
```

## Name tooltip

An icon button shows its own name as a tooltip (owner decision C160 (1),
1.11.0): hover for 0.5 s, keyboard focus at once, a long press on touch. The
text is the host's `title` if one is written, else the cycle's tooltip, else
the pressed label, else `aria-label`. The native `title` tooltip is not drawn
(the button carries `title=""`), and the text describes the button
(`aria-describedby`) when it differs from its name. The tooltip is the shared
one (`data-tooltip`, component tooltip), made on the first hover or focus: it
stands below the button and flips above at the bottom edge.

- `tooltip="off"` -- no name tooltip; a written `title` stays the native one.
- A page that links its own tooltip (`data-tooltip` on the host) keeps it.

```html
<sf-button-icon icon="format_bold" aria-label="Полужирный"></sf-button-icon>
<sf-button-icon icon="close" aria-label="Закрыть" title="Закрыть без сохранения"></sf-button-icon>
<sf-button-icon icon="help" aria-label="Справка" tooltip="off"></sf-button-icon>
```

## Host attributes

Attributes the component does not own are copied to the native `<button>` it
renders, so an author's `aria-*` reach the real control (`title` and `tooltip`
are the name tooltip's, above).

A `data-*` is **moved, not copied** — the same rule as `<sf-button>`. It ends
up on the native button, which is the one element that has a box, paints, takes
focus, is clicked and is dragged:

```js
const toggle = menu.querySelector('[data-sf-admin-search-toggle]');  // the button
menu.querySelectorAll('[data-sf-admin-search-toggle]').length;       // 1
toggle.focus();                      // natively focusable
toggle.getBoundingClientRect();      // it has a box, so a drag can read one
toggle.closest('sf-button-icon');    // the host, when that is what you want
```

A Smart host lays out as `display: contents` and generates no box, so it is
never the match: a selector that answered the host would answer something that
cannot be measured, dragged or painted.

What the author wrote is readable from the host as
`element.dataAttributes` (`data-column-key` → `.columnKey`), and
`element.removeHostDataAttribute(name)` takes one off the host's record and the
control together.

`focus()` on the host goes to the native button inside, and `blur()` the same
way:

```js
const host = menu.querySelector('sf-button-icon');
host.focus();
menu.contains(document.activeElement);   // true
```

## Cycle

`cycle` makes one icon button step through several values (1.6.0, decision
D11d), as on sf-button: items `{value, label, icon, pressed}`, `value` the
current one, `change` with `{previous, value, item}` after a press. The icon is
the current item's; an item with `pressed` is drawn with the pressed look and a
filled icon (a toggle's look: `outline` or `ghost` in the neutral scheme, C211
(1)).

```html
<sf-button-icon aria-label="Повтор" value="off" cycle='[
  {"value":"off","label":"без повтора","icon":"repeat"},
  {"value":"all","label":"повторять все","icon":"repeat","pressed":true},
  {"value":"one","label":"повторять одну","icon":"repeat_one","pressed":true}]'></sf-button-icon>

<sf-button-icon theme-cycle></sf-button-icon>
<sf-button-icon theme-cycle="light dark"></sf-button-icon>
```

`theme-cycle` is the ready theme switch: the visible theme's opposite first,
then the other, then «как в системе» (icon `contrast`); the name says the
theme now («Тема: как в системе (сейчас тёмная)»), the tooltip the next one,
and a polite live region the new one. `pressed` and `label-pressed` are ignored
beside a cycle, with one console warning.

