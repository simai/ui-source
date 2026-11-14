// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfTagMeta = {
  "tag": "sf-tag",
  "source": "src/smart/tag/component.json",
  "attributes": {
    "template": {
      "kind": "custom",
      "valueType": "string",
      "default": "default",
      "description": "Template name."
    },
    "root-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Framework utility classes for the visible root."
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
        "checkbox",
        "icon",
        "default",
        "color",
        "avatar"
      ],
      "default": "checkbox",
      "description": "What the tag carries: a checkbox, an icon, a colour, an avatar, or nothing but its label. The compatibility input quantity is still accepted and means default."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "",
      "description": "What the tag reports, in the shared status vocabulary. Leave it empty for a tag that reports nothing."
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "default",
        "outline",
        "ghost",
        "surface"
      ],
      "default": "default",
      "description": "Visual appearance, read from the neutral alpha ramp and separate from kind: outline keeps a faint fill and a hairline edge, ghost keeps nothing until it is hovered. surface is outline's former name until 2027-01-01 (journal value-tag-appearance-surface-to-outline; C15 retired the word) and draws the same. Only the neutral kinds take it, because a status tag carries its meaning in its colour."
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
      "default": "1/2",
      "description": "Framework size token: sets the label text and the default spacing."
    },
    "line": {
      "kind": "enum",
      "values": [
        "",
        "1/2",
        "1",
        "2"
      ],
      "default": "",
      "description": "Takes the text line of this form size as an inline tag one size down, for a table cell, so the row keeps its control height. Overrides size and inline."
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
      "description": "The tag's height (owner decision C27, as sf-button): the size's tightness steps -- low, default, high, highest, the size's usual step and its neighbours on the height ladder -- through the class sf-tag--height-<height> of component.tags (none for default). A value outside the list reads as default."
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
      "description": "Deprecated until 2027-01-01 (journal attribute-tag-spacing-to-height): the former name of height. compact, comfortable and spacious draw as low, high and highest; height wins when both are given."
    },
    "inline": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Sit on the text line of another control: no block padding, a flush label, and a remove button the height of the line. The host may publish --sf-tag--line."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible tag label."
    },
    "count": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The text of the count after the label: a number or a capped one such as 99+"
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Decorative Framework icon name."
    },
    "color-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Framework semantic background utility for the color marker."
    },
    "avatar-image-url": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Avatar image URL; the visible text remains the accessible label."
    },
    "avatar-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Avatar initials fallback."
    },
    "avatar-status": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Reserved avatar status value for compatible templates."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Disable interactive toggle and close actions."
    },
    "closable": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Absent: removable for the icon, color and avatar kinds, not for checkbox and default; present, it says so for any kind"
    },
    "interactive": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Render the label as a button next to the remove action, for tags that open something (for example a filter chip menu); ignored for checkbox tags."
    },
    "close-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Accessible name of the remove action. Defaults to Remove, or Удалить on a Russian page."
    },
    "active": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A checkbox tag is chosen; the tag toggles it and reports it with change"
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional accessible name override for a selectable tag."
    },
    "type": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Legacy name that answered both questions from one list: a content word reaches kind, a status word reaches status. See contracts/public-api-axes.json."
    }
  }
};

export {sfTagMeta};
export default sfTagMeta;
