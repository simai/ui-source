// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfBadgeMeta = {
  "tag": "sf-badge",
  "source": "src/smart/badge/component.json",
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
        "1"
      ],
      "default": "1/3"
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
    "appearance": {
      "kind": "enum",
      "values": [
        "main",
        "tonal",
        "outline"
      ],
      "default": "main",
      "description": "How the badge looks: the most visible fill, a calmer tonal one, or an outline."
    },
    "scheme": {
      "kind": "enum",
      "values": [
        "neutral",
        "primary",
        "secondary",
        "tertiary",
        "on-surface"
      ],
      "default": "neutral",
      "description": "Which semantic colour the badge takes. A status word given here still works and reaches the status axis."
    },
    "status": {
      "kind": "enum",
      "values": [
        "",
        "info",
        "success",
        "warning",
        "error"
      ],
      "default": "",
      "description": "What the badge reports, in the shared status vocabulary. The word this component used before, danger, is still accepted and means error."
    },
    "text": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-start": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-end": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "icon-position": {
      "kind": "enum",
      "values": [
        "start",
        "end"
      ],
      "default": "start"
    },
    "aria-label": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "type": {
      "kind": "enum",
      "values": [
        "main",
        "tonal",
        "outline"
      ],
      "default": "main",
      "description": "Legacy name for appearance, still honoured. See contracts/public-api-axes.json."
    },
    "icon-left": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-start until 2026-12-01."
    },
    "icon-right": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Dated alias of icon-end until 2026-12-01."
    }
  }
};

export {sfBadgeMeta};
export default sfBadgeMeta;
