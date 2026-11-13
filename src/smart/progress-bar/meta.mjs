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
        "top",
        "inline-end"
      ],
      "default": "none",
      "description": "Where the percentage stands (owner decision C131 (4)): top -- one line over the bar, the label at the start and the value at the end; inline-end -- the value at the end of the bar's row; none. The words used before, bottom and right, are read as top and inline-end until 2027-01-01 (journal value-progress-text-position)."
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
      "description": "What the value reports, in the shared status vocabulary (owner decision C131 (1)). Empty, the default, draws the theme's primary; neutral is grey, as in sf-dot and sf-badge; info, success, warning and error their roles. The word this component used before, primary, is still accepted and means the default. With warning-at or error-at the bar takes the more serious of this status and the threshold the value reached."
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
    "indeterminate": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The work runs and its size is not known yet: a segment of the fill crosses the track and the value is not read (aria-valuenow is left out). The page takes it off once the size is known and the same bar fills from the value, once (C34). Reduced motion: the segment stands still."
    },
    "paused": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "false",
      "description": "The work is paused: the bar is a warning (unless its status or a threshold says error) and says so to a screen reader: the value text reads «35 %, на паузе» / «35%, paused» when the page gives no value-text (C34). The page sets it where the work really stopped."
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

export {sfProgressBarMeta};
export default sfProgressBarMeta;
