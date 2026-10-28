// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
const sfToastMeta = {
  "tag": "sf-toast",
  "source": "src/smart/toast/component.json",
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
      "description": "What the message reports, in the shared status vocabulary. The words this component used before — default and primary — are still accepted and mean neutral and info."
    },
    "icon": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Optional decorative icon name."
    },
    "heading": {
      "kind": "custom",
      "valueType": "string",
      "default": ""
    },
    "supporting-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Concise supporting text at the normal body size."
    },
    "action-text": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Visible label of the one optional action."
    },
    "action": {
      "kind": "custom",
      "valueType": "string",
      "default": "action",
      "description": "Stable action value emitted in sf-toast-action."
    },
    "closable": {
      "kind": "boolean",
      "values": [
        "true",
        "false"
      ],
      "default": "true",
      "description": "Render an explicitly named close action."
    },
    "close-label": {
      "kind": "custom",
      "valueType": "string",
      "description": "Localized accessible name of the close action. Empty: the text of the page's language (\"Close message\" in English)."
    },
    "duration": {
      "kind": "custom",
      "valueType": "number",
      "default": 0,
      "minimum": 0,
      "description": "Explicit lifetime in milliseconds. Zero keeps the message until dismissed."
    },
    "title": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Short result heading."
    },
    "type": {
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
    },
    "role": {
      "kind": "custom",
      "valueType": "string",
      "default": "",
      "description": "Live-region role for dynamically inserted feedback only."
    }
  }
};

export {sfToastMeta};
export default sfToastMeta;
