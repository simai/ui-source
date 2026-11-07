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
      "description": "What the progress reports, in the shared status vocabulary. The word this component used before, primary, is still accepted and means neutral. With warning-at or error-at the bar takes the more serious of this status and the threshold the value reached."
    },
    "warning-at": {
      "kind": "custom",
      "valueType": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "A threshold in per cent: from this value on, the bar is a warning by itself (a disk 83 % full of a warning-at 80). The page sets the threshold; the bar only compares. Unset, no threshold."
    },
    "error-at": {
      "kind": "custom",
      "valueType": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "A threshold in per cent: from this value on, the bar is an error by itself. Above warning-at when both are set. Unset, no threshold."
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
