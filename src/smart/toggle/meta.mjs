// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfToggleMeta = {
  "tag": "sf-toggle",
  "source": "src/smart/toggle/component.json",
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
    "size": {
      "kind": "enum",
      "values": [
        "1",
        "2"
      ],
      "default": "1",
      "description": "Toggle size token."
    },
    "kind": {
      "kind": "enum",
      "values": [
        "simple",
        "icon",
        "short"
      ],
      "default": "simple",
      "description": "What the toggle carries: nothing, an icon, or a short label."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "disabled": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "name": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "value": {
      "kind": "custom",
      "valueType": "string",
      "default": "on",
      "description": "What a checked toggle submits; without it, \"on\", as a native checkbox (standard 1.3.8 §17.1 item 2)."
    },
    "checked": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "type": {
      "kind": "enum",
      "values": [
        "simple",
        "icon",
        "short"
      ],
      "default": "simple",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfToggleMeta};
export default sfToggleMeta;
