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
      "default": "",
      "description": "Classes added to the root element the component draws."
    },
    "root-style": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Inline style declarations set on the root element the component draws, custom properties included."
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
        "",
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "",
      "description": "What the value reports, in the shared status vocabulary (owner decision C131 (1)). Empty, the default, draws the theme's primary; neutral is grey, as in sf-dot and sf-badge; info, success, warning and error their roles. The word this component used before, primary, is still accepted and means the default. With warning-at or error-at the scale takes the more serious of this status and the threshold the value reached."
    },
    "warning-at": {
      "kind": "custom",
      "valueType": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "A threshold in per cent: from this value on, the component is a warning by itself (a disk 83 % full of a warning-at 80). The page sets the threshold; the component only compares. Unset, no threshold."
    },
    "error-at": {
      "kind": "custom",
      "valueType": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "A threshold in per cent: from this value on, the component is an error by itself (a disk 83 % full of a warning-at 80). The page sets the threshold; the component only compares. Unset, no threshold. Above warning-at when both are set."
    },
    "meter": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The value is an amount within a known range (a quota used, a disk filled), not a task's progress: role meter instead of progressbar (owner decision C131 (7)). A meter always has a value, so it is never indeterminate. The look does not change."
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
        "",
        "neutral",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "",
      "description": "Legacy name for status, still honoured. See contracts/public-api-axes.json."
    }
  }
};

export {sfProgressScaleMeta};
export default sfProgressScaleMeta;
