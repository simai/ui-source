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
      "default": ""
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
      "description": "Button size token."
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
      "default": "center"
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
      "default": ""
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
      "description": "Loading state: the spinner at the icon's size in place of the start icon (else the end icon); without an icon it lies over the label, which keeps its place, so the width does not change. The spinner takes the page's look (data-sf-spinner). Sets aria-busy and disables the native button."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Disabled state flag."
    },
    "native-type": {
      "kind": "enum",
      "values": [
        "button",
        "submit",
        "reset"
      ],
      "default": "button",
      "description": "Native button type attribute."
    },
    "shortcut": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A key combination drawn at the end of the button as keys, muted: words joined by +, e.g. mod+k (Cmd K on a Mac, Ctrl K elsewhere), shift+/, / or escape. mod is Cmd on Apple platforms and Ctrl elsewhere. Also written as aria-keyshortcuts on the native button. Empty: no keys"
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
      "description": "Whether the panel this button opens is open: aria-expanded on the native button; absent says nothing"
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
