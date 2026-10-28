// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfTreeItemMeta = {
  "tag": "sf-tree-item",
  "source": "src/smart/tree-item/component.json",
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
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The node's name; without it the node's own text is"
    },
    "href": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "target": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "rel": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "kind": {
      "kind": "enum",
      "values": [
        "folder",
        "file"
      ],
      "default": "folder",
      "description": "What the tree item is: a folder or a file."
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "The node's id: data-value of its row, the id its events carry"
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "open-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "folder_open"
    },
    "closed-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "folder"
    },
    "icon": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "false hides the folder or file icon"
    },
    "chevron-open-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "keyboard_arrow_down"
    },
    "chevron-closed-icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "chevron_right"
    },
    "open-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "The chevron's name while the branch is closed"
    },
    "close-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "The chevron's name while the branch is open"
    },
    "item-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Classes for the row's box"
    },
    "container-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Classes for the row's line"
    },
    "name-class": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Classes for the row's name"
    },
    "open": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The branch is open"
    },
    "selected": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "active": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The node is the current page: aria-current"
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of label until 2026-12-01."
    },
    "type": {
      "kind": "enum",
      "values": [
        "folder",
        "file"
      ],
      "default": "folder",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfTreeItemMeta};
export default sfTreeItemMeta;
