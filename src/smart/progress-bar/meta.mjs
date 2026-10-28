// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfProgressBarMeta = {
  "tag": "sf-progress-bar",
  "source": "src/smart/progress-bar/component.json",
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
      "default": "1"
    },
    "value": {
      "kind": "custom",
      "valueType": "number",
      "default": 0,
      "minimum": 0,
      "maximum": 100
    },
    "text-position": {
      "kind": "enum",
      "values": [
        "none",
        "inline-end",
        "bottom",
        "right"
      ],
      "default": "none"
    },
    "status": {
      "kind": "enum",
      "values": [
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "neutral",
      "description": "What the progress reports, in the shared status vocabulary. The word this component used before, primary, is still accepted and means neutral."
    },
    "label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "value-text": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "tone": {
      "kind": "enum",
      "values": [
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "neutral",
      "description": "Legacy name for status, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfProgressBarMeta};
export default sfProgressBarMeta;
