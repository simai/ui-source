// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfSkeletonMeta = {
  "tag": "sf-skeleton",
  "source": "src/smart/skeleton/component.json",
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
        "1/7",
        "1/6",
        "1/5",
        "1/4",
        "1/3",
        "1/2",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7"
      ],
      "default": "1"
    },
    "width": {
      "kind": "custom",
      "valueType": "string",
      "default": "100%"
    },
    "height": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "count": {
      "kind": "custom",
      "valueType": "integer",
      "default": 1,
      "minimum": 1,
      "maximum": 20
    },
    "animation": {
      "kind": "enum",
      "values": [
        "pulse",
        "wave",
        "none"
      ],
      "default": "pulse"
    },
    "kind": {
      "kind": "enum",
      "values": [
        "text",
        "circle",
        "square",
        "rounded"
      ],
      "default": "text",
      "description": "What shape the placeholder takes: a line of text, a circle, a square or a rounded block."
    },
    "type": {
      "kind": "enum",
      "values": [
        "",
        "icon"
      ],
      "default": "",
      "description": "type=\"icon\" marks a placeholder that stands in for an icon; it combines with any kind. Not a legacy name for kind (see contracts/public-api-axes.json), so it has no removal date."
    },
    "items": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "variant": {
      "kind": "enum",
      "values": [
        "text",
        "circle",
        "square",
        "rounded"
      ],
      "default": "text",
      "description": "Legacy name for kind, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfSkeletonMeta};
export default sfSkeletonMeta;
