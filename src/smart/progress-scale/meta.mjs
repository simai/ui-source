// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfProgressScaleMeta = {
  "tag": "sf-progress-scale",
  "source": "src/smart/progress-scale/component.json",
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
    "line": {
      "kind": "enum",
      "values": [
        "",
        "1/2",
        "1",
        "2"
      ],
      "default": "",
      "description": "Takes the text line of this form size, for a table cell or a row of fields, so the row keeps its control height."
    },
    "value": {
      "kind": "custom",
      "valueType": "number",
      "default": 0,
      "minimum": 0,
      "maximum": 100
    },
    "show-text": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true"
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

export {sfProgressScaleMeta};
export default sfProgressScaleMeta;
