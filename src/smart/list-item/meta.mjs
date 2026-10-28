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
      "default": ""
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
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
      "default": "1"
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "person"
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "color-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "bg-tertiary"
    },
    "avatar-image-url": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
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
    "checked": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "selected": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
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
