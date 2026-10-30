// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfIconButtonMeta = {
  "tag": "sf-icon-button",
  "source": "src/smart/icon-button/component.json",
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
      "default": ""
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
        "link",
        "surface",
        "ghost"
      ],
      "default": "default",
      "description": "How the icon button looks. Surface and ghost read the neutral alpha ramp: surface keeps a faint fill and a border, ghost keeps nothing until it is hovered or focused."
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
      "description": "Which colour family the control takes. on-surface-variant is the on-surface family one step quieter: the fill and the edge of on-surface, the glyph in --sf-on-surface-variant, which is what a quiet trigger beside a field or in a panel's head wants (sf-button 1.2.0 has the same value). A filled (default) control keeps on-surface's inverse glyph: on a dark fill there is no quieter step. What the control is about is the status axis; a status set there wins over this."
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
        "link",
        "surface",
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

export {sfIconButtonMeta};
export default sfIconButtonMeta;
