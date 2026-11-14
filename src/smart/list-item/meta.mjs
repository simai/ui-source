// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfListItemMeta = {
  "tag": "sf-list-item",
  "source": "src/smart/list-item/component.json",
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
      "description": "Classes added to the root element the component draws."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The row's id: the machine value a parent sf-dropdown reads, and the id its open request carries"
    },
    "kind": {
      "kind": "enum",
      "values": [
        "text",
        "icon",
        "checkbox",
        "avatar",
        "color"
      ],
      "default": "text",
      "description": "What the list item carries: plain text, an icon, a checkbox, an avatar or a colour."
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
      "description": "The row's size on the ladder: its text, its picture and its height (one line the size's control height; two lines the next size's)."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The row's title."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "person",
      "description": "The glyph at the start of an icon row (a Material Symbols name)."
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Makes the row unavailable: it takes the disabled ink and does not answer a press."
    },
    "color-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "bg-tertiary",
      "description": "The background utility of a colour row's mark, such as bg-success."
    },
    "avatar-image-url": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The picture of an avatar row; empty draws the placeholder."
    },
    "avatar-title": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The avatar row's title; empty takes text"
    },
    "supporting": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "A second line under the title"
    },
    "interactive": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A row a person acts on: one Tab stop of its list, open on a press or Enter"
    },
    "sortable-item": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The row's item id in the surrounding sf-sortable list; draws a drag handle"
    },
    "pinned": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "A row of an sf-sortable list that does not move: no handle, its slot kept"
    },
    "divided": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "An inset line under the row, from its text to its end edge, none under the last row of its list (owner decision C148 (4)); off, rows have no line between them"
    },
    "lines": {
      "kind": "enum",
      "values": [
        "1",
        "2"
      ],
      "default": "1",
      "description": "How many lines the title takes before its ellipsis: 1, or 2 for records and documents whose names differ at the end (owner decision C148 (5)); the supporting line is always one line, and a cut title is the row's tooltip"
    },
    "checked": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "Ticks the row's checkbox (a checkbox row, or an option row of a multiple list); selected ticks it as well."
    },
    "selected": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The row is the chosen one: it takes the selected look, an option row says aria-selected, a row of a roving list aria-current, and its checkbox is ticked."
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Accessible name of an option row or of a row in a roving list, in place of its text; an option row also shows it as its tooltip. Empty: the text names it."
    },
    "type": {
      "kind": "enum",
      "values": [
        "text",
        "icon",
        "checkbox",
        "avatar",
        "color"
      ],
      "default": "text",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfListItemMeta};
export default sfListItemMeta;
