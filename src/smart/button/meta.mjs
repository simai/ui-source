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
    "appearance": {
      "kind": "enum",
      "values": [
        "default",
        "tonal",
        "outline",
        "link",
        "surface"
      ],
      "default": "default",
      "description": "How the button looks. Surface reads the neutral alpha ramp: a faint fill and a border. ghost is the link appearance under its old name (compat until 2026-12-01)."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "primary",
        "secondary",
        "on-surface",
        "on-surface-variant"
      ],
      "default": "primary",
      "description": "Which colour family the control takes. on-surface-variant is the on-surface family one step quieter: the fill and the edge of on-surface, the label and the icons in --sf-on-surface-variant (a search trigger that reads like a field). What the control is about is the status axis; a status set there wins over this."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "error"
      ],
      "default": "",
      "description": "What the control is about, in the shared status vocabulary. The only one a control paints today is `error`, the destructive one: a control that deletes, discards or cannot be undone."
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
      "description": "Semantic internal spacing profile."
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
    "loading": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Loading state: the spinner at the icon's size in place of the start icon (else the end icon); without an icon it lies over the label, which keeps its place, so the width does not change. The spinner takes the page's look (data-sf-spinner). The inner button is unavailable while it loads."
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
      "description": "The value the inner button submits under name when it is the submitter (next, skip)."
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "An address: the button draws a link (an <a href>) with the button's look; role link, Enter and the browser's link keys follow it. A relative address, a fragment, http(s), mailto or tel; any other scheme draws a button. native-type, expanded and pressed do not apply; disabled or loading, the link has no href and says aria-disabled."
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
      "description": "Whether this toggle button is on: aria-pressed on the inner button and the pressed look -- the primary container fill, its ink, no visible edge and the icon filled (component.buttons 1.5.0, rule C12); pressed=\"false\" says off; absent, the button is not a toggle and nothing is said"
    },
    "text-pressed": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The label while the toggle is on, for a toggle whose label changes («В избранное» → «В избранном»). Set, the label says the state and aria-pressed is not written; the pressed look still follows pressed. Empty: the label stays the same and aria-pressed says the state"
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
        "link",
        "surface"
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
