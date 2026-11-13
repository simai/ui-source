// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfButtonMeta = {
  "tag": "sf-button",
  "source": "src/smart/button/component.json",
  "attributes": {
    "template": {
      "kind": "custom",
      "valueType": "string",
      "default": "default",
      "description": "Template variant name for SfBaseElement external templates."
    },
    "root-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Extra classes applied to the inner button element."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
    },
    "size": {
      "kind": "enum",
      "values": [
        "1/3",
        "1/2",
        "1",
        "2",
        "3"
      ],
      "default": "1",
      "description": "Button size."
    },
    "height": {
      "kind": "enum",
      "values": [
        "low",
        "default",
        "high",
        "highest"
      ],
      "default": "default",
      "description": "The control height (owner decision C27), separate from size: size sets the text, the icons and the inner scale, height picks the control height from the size's tightness steps of the adaptive-sizing contract -- low, default, high, highest, the size's usual step and its neighbours on the UI height ladder. Desktop 1/3 24/28/32/40, 1/2 28/32/40/48, 1 32/40/48/56, 2 40/48/56/68, 3 48/56/68/80; phone 1/3 20/24/28/36, 1/2 24/28/36/44, 1 28/36/44/52, 2 36/44/52/64, 3 44/52/64/76. The side padding grows with the height by half of what the height adds, so the gap from the end to the icon stays the same. A compact region (data-sf-density) shifts the steps one down and height picks the neighbour there. A value outside the list reads as default, with one console warning."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "default",
        "tonal",
        "outline",
        "ghost"
      ],
      "default": "default",
      "description": "How the button looks: default (filled), tonal, outline or ghost (no fill or edge until hovered; rule C15). link is ghost's former name; a link is made by href, not by the look. surface is a former name until 2027-01-01 (rule C116): it draws as the soft grey button, tonal with the on-surface scheme (C113), and warns once per page. A danger button is default, outline or ghost: tonal and surface with status danger draw as outline until 2027-01-01."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "primary",
        "on-surface",
        "on-surface-variant"
      ],
      "default": "primary",
      "description": "Which colour family the control takes. on-surface-variant is the on-surface family one step quieter: the fill and the edge of on-surface, the label and the icons in --sf-on-surface-variant (a search trigger that reads like a field). secondary is a former name until 2027-01-01 (rule C116): it draws as on-surface and warns once per page; the secondary colour stays in core for badges, tabs and segments. What the control is about is the status axis; a status set there wins over this."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "danger"
      ],
      "default": "",
      "description": "What the control is about (rule C13): danger, a control that deletes, discards or cannot be undone. It paints with the error roles -- the red of an error -- and behaves exactly like a primary control. error is its former name on a control. danger is the only status of a button (rule C116): there are no success, warning or info buttons; another word draws no status and warns once per page."
    },
    "text-position": {
      "kind": "custom",
      "valueType": "string",
      "default": "center",
      "description": "How the label aligns inside a button wider than its content: start, center or end (the text-align utility on the label)."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible button text when no text slot is provided."
    },
    "segment": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The button's place in a joined group: start, middle or end squares the corners it shares with its neighbours; empty: a standalone button."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Single icon name shortcut.",
      "examples": [
        "home",
        "settings",
        "search",
        "edit",
        "check",
        "close"
      ]
    },
    "icon-start": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Logical start icon name.",
      "examples": [
        "home",
        "settings",
        "search",
        "edit",
        "check",
        "close"
      ]
    },
    "icon-end": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Logical end icon name.",
      "examples": [
        "home",
        "settings",
        "search",
        "edit",
        "check",
        "close"
      ]
    },
    "icon-position": {
      "kind": "enum",
      "values": [
        "start",
        "end"
      ],
      "default": "start",
      "description": "Placement for the single icon shortcut."
    },
    "spacing": {
      "kind": "enum",
      "values": [
        "compact",
        "normal",
        "comfortable",
        "spacious"
      ],
      "default": "normal",
      "description": "Deprecated (decision C27, until 2027-01-01): the side padding only -- compact, normal, comfortable or spacious -- at the same height. It keeps working as before with a console warning and is not turned into height; write height for a lower or higher button."
    },
    "radius": {
      "kind": "enum",
      "values": [
        "",
        "default",
        "square",
        "rounded"
      ],
      "default": "",
      "description": "Border radius modifier."
    },
    "full-width": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The control fills its container, as sf-segmented's full-width does, and its content stays in the middle; without it the button is as wide as its content (owner decision C36). The height does not change."
    },
    "loading": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Loading state: the spinner at the icon's size in place of the start icon (else the end icon); without an icon it lies over the label, which keeps its place, so the width does not change. The spinner takes the page's look (data-sf-spinner) and the label's ink. The inner button is unavailable while it loads but keeps its scheme colour (owner decision C36); a button that is also disabled wears the disabled look."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The button is unavailable."
    },
    "native-type": {
      "kind": "enum",
      "values": [
        "button",
        "submit",
        "reset"
      ],
      "default": "button",
      "description": "The inner button's type attribute."
    },
    "form": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The id of the form the inner button submits or resets, as a native button's form attribute: a button outside the form (a wizard's footer) submits it. Not written on a link."
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The name the inner button submits its value under, as a native button's name."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The value the inner button submits under name when it is the submitter (next, skip); for a cycle, the current item's value, which a press moves to the next one."
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "An address: the button draws a link (an <a href>) with the button's look; role link, Enter and the browser's link keys follow it. A relative address, a fragment, http(s), mailto or tel; any other scheme draws a button. native-type, expanded and pressed do not apply; disabled or loading, the link has no href and says aria-disabled."
    },
    "target": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Where a link (href) opens, as an <a target>: _blank opens a new tab. Not written on a button."
    },
    "rel": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The link's relation, as an <a rel>. A link that opens in a new tab (target _blank) with no rel says noopener noreferrer, so the new page cannot reach this one. Not written on a button."
    },
    "shortcut": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A key combination drawn at the end of the button as the kbd component's soft caps in the label's ink: words joined by +, e.g. mod+k (⌘K on a Mac, Ctrl K elsewhere), shift+mod+p (⇧⌘P, Ctrl Shift P), shift+/, / or escape. mod is Cmd on Apple platforms and Ctrl elsewhere. The only input: a page never styles the keys. Also written as aria-keyshortcuts on the inner button. Empty: no keys"
    },
    "shortcut-listen": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The button listens to its shortcut on the page and is pressed by it, as by a click. A combination without mod, ctrl, alt or meta is not heard while focus is in an editable field"
    },
    "expanded": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Whether the panel this button opens is open: aria-expanded on the inner button; absent says nothing"
    },
    "pressed": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Whether this toggle button is on: aria-pressed on the inner button and the pressed look -- the primary container fill, its ink, no visible edge and the icon filled (rule C12); pressed=\"false\" says off; absent, the button is not a toggle and nothing is said"
    },
    "text-pressed": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The label while the toggle is on, for a toggle whose label changes («В избранное» → «В избранном»). Set, the label says the state and aria-pressed is not written; the pressed look still follows pressed. Empty: the label stays the same and aria-pressed says the state"
    },
    "theme-cycle": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A ready theme switch over SF.Loader's theme (the contract of sf-segmented's theme-switch: themePreference, setTheme, sf-theme-change). Present and empty: three values, «as the system», light and dark, in the owner's order -- first the theme opposite to the visible one, then the other, then «as the system» (rule D11d); \"light dark\": two values, every press flips the visible theme. The icons are contrast, light_mode and dark_mode; the words are the page language's («Тема: светлая. Нажмите — тёмная»). cycle is ignored beside it."
    },
    "split": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "With menu: a split button (owner decision C119) -- the label part acts (press) and a square arrow part of the same height, named «Другие варианты: <label>», opens the menu end-aligned under it. Two tab stops; on the arrow Enter, Space and ArrowDown open the menu on its first row, ArrowUp on its last, Escape closes it and returns focus to the arrow. The parts are joined as a button group: inner corners square, a 1 px seam. The main look (default primary) and the regular one (outline) only; another look or a danger button draws as a menu button with one console warning. The main action is not repeated in the menu. Without menu entries split is a plain button."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible label for icon-only or custom buttons."
    },
    "type": {
      "kind": "enum",
      "values": [
        "default",
        "tonal",
        "outline",
        "ghost"
      ],
      "default": "default",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "icon-left": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Compatibility alias for icon-start.",
      "examples": [
        "home",
        "settings",
        "search",
        "edit",
        "check",
        "close"
      ]
    },
    "icon-right": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Compatibility alias for icon-end.",
      "examples": [
        "home",
        "settings",
        "search",
        "edit",
        "check",
        "close"
      ]
    },
    "tightness": {
      "kind": "enum",
      "values": [
        "low",
        "high",
        "highest"
      ],
      "default": "",
      "description": "Compatibility alias for spacing."
    }
  }
};

export {sfButtonMeta};
export default sfButtonMeta;
