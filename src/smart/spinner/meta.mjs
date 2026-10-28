// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfSpinnerMeta = {
  "tag": "sf-spinner",
  "source": "src/smart/spinner/component.json",
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
        "1/3",
        "1/2",
        "1",
        "2",
        "3"
      ],
      "default": "1",
      "description": "The size ladder: at each step the spinner is the icon of an sf-button of the same size (diameter and stroke), so it can stand in for that icon."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Empty: the text of the page's language (\"Loading…\" in English)."
    },
    "kind": {
      "kind": "enum",
      "values": [
        "",
        "arc",
        "breathing",
        "comet",
        "dots"
      ],
      "default": "",
      "description": "The spinner's look: arc, breathing (the arc grows and shrinks as it turns), comet (an arc with a fading tail) or dots. Empty: the page's look, data-sf-spinner on the nearest ancestor (html, body or a block), else arc."
    },
    "dots": {
      "kind": "custom",
      "valueType": "integer",
      "default": 8,
      "minimum": 1
    },
    "filled": {
      "kind": "custom",
      "valueType": "integer",
      "default": 3,
      "minimum": 0
    },
    "infinite": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "announce": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false"
    },
    "direction": {
      "kind": "enum",
      "values": [
        "clockwise",
        "counterclockwise"
      ],
      "default": "clockwise"
    },
    "variant": {
      "kind": "enum",
      "values": [
        "",
        "arc",
        "breathing",
        "comet",
        "dots"
      ],
      "default": "",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfSpinnerMeta};
export default sfSpinnerMeta;
