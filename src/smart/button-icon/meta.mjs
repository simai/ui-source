// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfButtonIconMeta = {
  "tag": "sf-button-icon",
  "source": "src/smart/button-icon/component.json",
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
      "description": "Extra classes applied to the inner icon button element."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
    },
    "kind": {
      "kind": "enum",
      "values": [
        "icon",
        "close"
      ],
      "default": "icon",
      "description": "What the icon button is: an ordinary icon action or a close control."
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
      "description": "Icon button size token."
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
      "description": "How the icon button looks, one ladder from the strongest (rule C15): default (filled), tonal, outline, ghost (no fill or edge until a pointer or the keyboard reaches it). link is ghost's former name; surface was retired and is drawn as tonal with the on-surface scheme."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "primary",
        "on-surface",
        "on-surface-variant"
      ],
      "default": "primary",
      "description": "Which colour family the control takes (rule C15): primary, on-surface (the neutral, the text colour) or on-surface-variant (the quiet neutral: a window's head, a table row, a field's clear; under a pointer its glyph darkens to on-surface). A filled (default) control keeps on-surface's inverse glyph with on-surface-variant: on a dark fill there is no quieter step. secondary was retired and is drawn as on-surface-variant. What the control is about is the status axis; a status set there wins over this."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "danger"
      ],
      "default": "",
      "description": "What the control is about (rule C13): danger, a control that deletes, discards or cannot be undone. It paints with the error roles -- the red of an error -- and behaves exactly like a primary control. error is its former name on a control."
    },
    "segment": {
      "kind": "enum",
      "values": [
        "",
        "start",
        "middle",
        "end"
      ],
      "default": "",
      "description": "Joined-control position owned by Button Group composition."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "add",
      "description": "Material icon name."
    },
    "filled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Use the filled glyph axis for the standard icon variant."
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
      "description": "Loading state: the spinner in place of the icon, at the icon's size, in the page's look (data-sf-spinner). Sets aria-busy and disables the native button."
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
    "badge-count": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A count on the icon button (simai/ui-source#12): a whole number above 0 shows, 0 or empty hides the badge. Above badge-cap it reads «<cap>+»; the exact number joins the icon button's accessible name («Уведомления, 5 непрочитанных») and the badge's tooltip. On an anchor of size 1/3 or 1/2 a count is drawn as a dot."
    },
    "badge-dot": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A dot on the icon button, a count with no number: something new. Shown when badge-count is not set; with a count, the count is drawn as a dot. Its text equivalent («есть новое» / «new» by default, badge-label to change it) joins the accessible name."
    },
    "badge-cap": {
      "kind": "custom",
      "valueType": "integer",
      "default": 99,
      "minimum": 1,
      "description": "The largest count drawn as a number; a larger one reads «<cap>+»."
    },
    "badge-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The words the badge adds to the accessible name and its tooltip, in place of the page language's default: for a dot the whole text equivalent; for a count the phrase in plural forms separated by «|» (one|few|many in Russian, one|other in English) with {count} where the number goes."
    },
    "pressed": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Whether this toggle button is on: aria-pressed on the native button and the pressed look -- the primary container fill, its ink, no visible edge and the icon filled (rule C12); pressed=\"false\" says off; absent, the button is not a toggle and nothing is said"
    },
    "label-pressed": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The accessible name while the toggle is on, for a toggle whose name changes («Добавить в избранное» → «Убрать из избранного»). Set, the name says the state and aria-pressed is not written; the pressed look still follows pressed. Empty: aria-label stays the name and aria-pressed says the state"
    },
    "theme-cycle": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A ready theme switch over SF.Loader's theme (the contract of sf-segmented's theme-switch: themePreference, setTheme, sf-theme-change). Present and empty: three values, «as the system», light and dark, in the owner's order -- first the theme opposite to the visible one, then the other, then «as the system» (rule D11d); \"light dark\": two values, every press flips the visible theme. The icons are contrast, light_mode and dark_mode; the words are the page language's («Тема: светлая. Нажмите — тёмная»). cycle is ignored beside it."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The current item of a cycle (its value); a press writes the next one. Read it from the attribute or from change: the value property keeps the settings object it has always given."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible label."
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
    "variant": {
      "kind": "enum",
      "values": [
        "icon",
        "close"
      ],
      "default": "icon",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
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

export {sfButtonIconMeta};
export default sfButtonIconMeta;
