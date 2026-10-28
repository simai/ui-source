// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfTooltipMeta = {
  "tag": "sf-tooltip",
  "source": "src/smart/tooltip/component.json",
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
      "description": "Framework utility classes for the visible surface root."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "appearance": {
      "kind": "enum",
      "values": [
        "light",
        "dark"
      ],
      "default": "light",
      "description": "How the tooltip looks: light on a dark surface or the reverse."
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
      "description": "Framework typography and spacing scale."
    },
    "arrow": {
      "kind": "enum",
      "values": [
        "none",
        "top-center",
        "bottom-center",
        "inline-start",
        "inline-end",
        "bottom-inline-start",
        "bottom-inline-end"
      ],
      "default": "none",
      "description": "Logical tail placement."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Short primary description."
    },
    "supporting-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional secondary description."
    },
    "type": {
      "kind": "enum",
      "values": [
        "light",
        "dark"
      ],
      "default": "light",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfTooltipMeta};
export default sfTooltipMeta;
