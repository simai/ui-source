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
- `size`
- `height="low|default|high|highest"` (1.8.0, decisions C27 and C35) — the
  control height separate from the size, as on `sf-button`: the size's
  tightness steps on the UI height ladder, the icon keeping the size. The
  button stays square (the step is the padding on all four sides). Size `1`:
  32 / 40 / 48 / 56 on desktop, 28 / 32 / 40 / 48 compact, 28 / 36 / 44 / 52
  on a phone. `kind="close"` takes the same heights; a new close is
  `sf-button-close height="…"`.
- `appearance="default|tonal|outline|ghost"` — four looks (1.6.0, decision
  C15): a fill, a soft fill, an edge, and `ghost`, which keeps nothing until a
  pointer or the keyboard reaches it. `link` is ghost's former name, a dated
  alias. `surface` is retired: it is drawn as `tonal` in `on-surface`, and the
  console notes it until 2027-01-01.
- `scheme="primary|on-surface|on-surface-variant"` — which colour
  family the control takes (`secondary` is retired and drawn as
  `on-surface-variant` until 2027-01-01). A ghost or outline `on-surface-variant`
  glyph darkens to `--sf-on-surface` under the pointer. `on-surface-variant` is `on-surface` one step
  quieter: the same fill and edge, the glyph in `--sf-on-surface-variant`.
  That is what a quiet trigger wants — beside a field, in a panel's head,
  next to a row — and `sf-button` says it the same way. A filled
  (`appearance="default"`) control keeps the inverse glyph of `on-surface`:
  on a dark fill there is no quieter step.
- `status="danger"` — what the control is about. The destructive one, for a
  control that deletes, discards or cannot be undone (decision C13: controls
  say `danger`, fields and messages `error`; `error` is read as `danger`). In
  every appearance it paints with the error
  family's twin of every primary role, so it behaves exactly like a primary
  control and only its colour says what it does. A status wins over the scheme,
  because the two cannot both colour the control.
- `icon`
- `spacing="compact|normal|comfortable|spacious"`
- `radius="default|square|rounded"`
- `root-class`
- `loading` — the spinner in place of the icon, at its size; `aria-busy` and
  native `disabled`
- `disabled`
- `native-type`
- `pressed` — a toggle button: present, it writes `aria-pressed` on the native
  button and, while on, the pressed look (`pressed="false"` says off);
  absent, the button is not a toggle and nothing is said. The pressed look
  (1.5.0, rule C12): the primary container fill, the icon in
  `--sf-on-primary-container` and filled, no visible edge (the height does not
  move) -- two cues, not colour alone, in both themes
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
(on-surface-variant) and `error` (danger).

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
  type="link"
  scheme="on-surface"
  aria-label="Close"
></sf-button-icon>
```

## Host attributes

Attributes the component does not own are copied to the native `<button>` it
renders, so an author's `aria-*` or `title` reach the real control.

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
filled icon.

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

