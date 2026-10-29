# Smart Settings Menu

`<sf-settings-menu>` — compact settings: a small set of settings a person
changes on the spot, drawn as a menu. A reader's theme and text size, a
table's view options, a chat's settings. A special case of the context menu:
it opens from a trigger, or stands inline in a panel.

The settings are data. The component draws them, keeps the values and reports
every change; what a value means — a dark theme, a dense table, a larger
text — is the page's to apply.

```html
<sf-settings-menu resettable>
  <sf-icon-button slot="trigger" icon="tune" aria-label="Настройки"></sf-icon-button>
  <script type="application/json" data-sf-settings>
    {"items": [
      {"key": "theme", "type": "choice", "label": "Тема", "icon": "contrast", "value": "system", "default": "system",
       "options": [
         {"value": "system", "label": "Как в системе", "icon": "computer"},
         {"value": "light", "label": "Светлая", "icon": "light_mode"},
         {"value": "dark", "label": "Тёмная", "icon": "dark_mode"}]},
      {"key": "language", "type": "choice", "label": "Язык", "icon": "translate", "value": "ru",
       "options": [{"value": "ru", "label": "Русский"}, {"value": "en", "label": "English"}]},
      {"type": "divider"},
      {"key": "sound", "type": "boolean", "label": "Звук", "icon": "volume_up", "value": true, "default": true}
    ]}
  </script>
</sf-settings-menu>
```

## Items

`items` is a list, set as a property (`menu.items = [...]`) or printed as the
JSON island `<script type="application/json" data-sf-settings>{"items": [...]}</script>`
inside the element. Each item:

| Field | Meaning |
| --- | --- |
| `key` | The setting's key; events and `values` name it |
| `type` | `boolean`, `choice`, `range`, `action`, `section` or `divider` |
| `label` | The name |
| `caption` | A line under the name (optional), as a context menu entry's caption |
| `icon` | A leading icon (optional) |
| `options` | A choice's options: `{value, label, icon?}` |
| `value` | The current value: `true`/`false`, an option's value, a number |
| `default` | What reset gives back (optional) |
| `disabled` | The row cannot be changed |
| `tile` | A boolean or a choice drawn as a tile on top |
| `control` | How a choice is drawn: `drill`, `pills` or `select`; by default the template decides |
| `min`, `max`, `step`, `unit` | A range's bounds, step and the unit written after the value (`%`) |

The theme convention: system is `computer`, light is `light_mode`, dark is
`dark_mode`.

## Arrangements

Two templates of the same parts:

- **drill** (the default): a row is the icon, the name and the current value
  under it in small dimmed text, and a chevron. Pressing it opens the list of
  options in place — the same panel, a head with the way back, a check mark on
  the chosen option. A boolean stays in its row as a switch.
- **rows** (`template="rows"`): the name and a caption at the start, the
  control at the end. A boolean is a switch; a choice of up to three icons or
  two short words is a row of quiet pills; anything longer is a compact select
  «value ⇕» that opens a small menu. A name that does not fit beside its
  control takes the whole line and the control drops under it.

Items with `tile: true` stand on top as tiles: the icon, the name and the
current value. A press toggles a boolean, cycles a choice of up to three
options and opens a longer one in place.

The panel has a fixed width (280 px, `--sf-settings-menu-inline-size`) and
never grows with its text: a long name wraps, a long value ends in an ellipsis
with the whole of it in the tooltip.

## Popup and inline

- With a trigger — the `trigger` slot, or `for="<id>"` of a control elsewhere
  in the page — the panel opens over the page against the trigger
  (`placement`, `bottom-end` by default), in the top layer of the browser and
  in the Framework's shared layer stack. Escape and a press outside close it.
- `inline` — always open in the page's flow, for a settings panel or a
  sidebar.

`size` is the ladder rung of the rows: `1/2` (32 px rows, the default) or `1`
(40 px). A row with the value under its name is taller by that line.

## Keyboard and screen readers

The popup is a dialog named by its heading; inline it is a group. Each setting
is a native control: a switch (`role="switch"`), toggle buttons for pills, a
button that opens a menu for a compact select, a listbox of options for a
choice list, a native slider for a range. One control of the panel is in the
tab order.

| Key | Result |
| --- | --- |
| `↓` `↑` | The next or previous row; `Home` and `End` — the first and the last |
| `→` or `Enter` on a choice row | Opens its list in place, focus on the chosen option |
| `←` or `Escape` in a list | Goes back, focus on the row it came from |
| `←` `→` in pills or tiles | The next or previous one in the row |
| `Enter` or `Space` | Toggles a switch, chooses a pill or an option |
| `Escape` on the top level | Closes the popup; focus goes back to the trigger |
| `Tab` | Leaves the popup and closes it |

## Methods and events

| Method | What it does |
| --- | --- |
| `open()` | Opens the popup; refused inline, without a trigger, or when a page cancels `sf-settings-menu-open` |
| `close({reason})` | Closes the popup |
| `toggle()` | Opens or closes it |
| `reset()` | Puts every item that declares a `default` back to it |

`values` holds every item's current value by key: `{theme: 'dark', sound: true}`.

| Event | When |
| --- | --- |
| `sf-settings-menu-change` | A person asks to change a setting, `detail: {key, value, previous}`; cancel it and the value stays |
| `sf-settings-menu-changed` | A setting changed, `detail: {key, value, previous}`; the page applies it |
| `sf-settings-menu-apply` | An action row was chosen, `detail: {action, scope: 'entry', ids}`; a popup closes unless cancelled |
| `sf-settings-menu-reset` | Reset is asked, `detail: {keys}`; can be cancelled |
| `sf-settings-menu-open`, `-opened` | The popup is about to open (can be cancelled), and opened |
| `sf-settings-menu-close`, `-closed` | The popup is about to close (can be cancelled), and closed, `detail.reason`: `close`, `escape`, `outside` or `api` |

```js
const menu = document.querySelector('sf-settings-menu');
menu.addEventListener('sf-settings-menu-changed', ({detail}) => {
  if (detail.key === 'theme') applyTheme(detail.value);
});
```

## Customising

| Variable | What it changes |
| --- | --- |
| `--sf-settings-menu-inline-size` | The panel's width |
| `--sf-settings-menu-background` | The panel's fill |
| `--sf-settings-menu-color` | The panel's text |
| `--sf-settings-menu-border-color` | The panel's edge and dividers |
| `--sf-settings-menu-radius` | The panel's corners |
| `--sf-settings-menu-hover-background` | A row under the pointer |
| `--sf-settings-menu-selected-background` | The chosen pill |
| `--sf-settings-menu-tile-background` | A tile and a compact select |
| `--sf-settings-menu-accent-color` | The check mark, a range's fill |
